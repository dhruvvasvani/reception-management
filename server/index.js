const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const Database = require('better-sqlite3');
const path = require('path');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'your_super_secret_jwt_key_here';
const app = express();
app.use(cors());
app.use(express.json());

const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

const db = new Database(path.join(__dirname, 'queue.db'));

// Multi-tenant DB setup
db.exec(`
  CREATE TABLE IF NOT EXISTS clinics (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    clinic_name TEXT,
    email TEXT UNIQUE,
    phone TEXT,
    password_hash TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS patients (
    token INTEGER,
    clinic_id INTEGER,
    name TEXT,
    phone TEXT,
    status TEXT DEFAULT 'waiting',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    called_at INTEGER,
    completed_at INTEGER,
    PRIMARY KEY (clinic_id, token),
    FOREIGN KEY(clinic_id) REFERENCES clinics(id)
  );
  
  CREATE TABLE IF NOT EXISTS settings (
    clinic_id INTEGER PRIMARY KEY,
    activeToken INTEGER DEFAULT 0,
    averageConsultationTime INTEGER DEFAULT 10,
    pauseUntil INTEGER DEFAULT 0,
    tokenMode TEXT DEFAULT 'hash',
    FOREIGN KEY(clinic_id) REFERENCES clinics(id)
  );
`);

// Authentication API Endpoints
app.post('/api/register', async (req, res) => {
  try {
    const { clinic_name, email, phone, password } = req.body;
    if (!clinic_name || !email || !password) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const existing = db.prepare('SELECT id FROM clinics WHERE email = ?').get(email);
    if (existing) {
      return res.status(400).json({ error: 'Email already registered' });
    }

    const salt = await bcrypt.genSalt(10);
    const password_hash = await bcrypt.hash(password, salt);

    const stmt = db.prepare('INSERT INTO clinics (clinic_name, email, phone, password_hash) VALUES (?, ?, ?, ?)');
    const info = stmt.run(clinic_name, email, phone, password_hash);
    
    // Initialize settings for new clinic
    db.prepare("INSERT INTO settings (clinic_id, activeToken, averageConsultationTime, pauseUntil, tokenMode) VALUES (?, 0, 10, 0, 'hash')").run(info.lastInsertRowid);

    const token = jwt.sign({ id: info.lastInsertRowid, email }, JWT_SECRET, { expiresIn: '7d' });
    res.json({ token, clinic_id: info.lastInsertRowid, clinic_name });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Server error during registration' });
  }
});

app.post('/api/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    const clinic = db.prepare('SELECT * FROM clinics WHERE email = ?').get(email);
    
    if (!clinic) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    const validPassword = await bcrypt.compare(password, clinic.password_hash);
    if (!validPassword) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    const token = jwt.sign({ id: clinic.id, email: clinic.email }, JWT_SECRET, { expiresIn: '7d' });
    res.json({ token, clinic_id: clinic.id, clinic_name: clinic.clinic_name });
  } catch (error) {
    res.status(500).json({ error: 'Server error during login' });
  }
});

app.post('/api/demo-login', async (req, res) => {
  try {
    const { clinicNumber } = req.body;
    const num = clinicNumber || 1;
    const demoEmail = `demo${num}@queuecure.com`;
    const clinicName = `Demo Clinic ${num}`;

    let clinic = db.prepare('SELECT * FROM clinics WHERE email = ?').get(demoEmail);
    
    if (!clinic) {
      const salt = await bcrypt.genSalt(10);
      const password_hash = await bcrypt.hash('demopassword', salt);
      const stmt = db.prepare('INSERT INTO clinics (clinic_name, email, phone, password_hash) VALUES (?, ?, ?, ?)');
      const info = stmt.run(clinicName, demoEmail, '1234567890', password_hash);
      
      db.prepare("INSERT INTO settings (clinic_id, activeToken, averageConsultationTime, pauseUntil, tokenMode) VALUES (?, 0, 5, 0, 'hash')").run(info.lastInsertRowid);
      
      clinic = db.prepare('SELECT * FROM clinics WHERE id = ?').get(info.lastInsertRowid);
    }
    
    // Clear demo data occasionally if we want, but for now just issue the token
    const token = jwt.sign({ id: clinic.id, email: clinic.email }, JWT_SECRET, { expiresIn: '7d' });
    res.json({ token, clinic_id: clinic.id, clinic_name: clinic.clinic_name });
  } catch (error) {
    res.status(500).json({ error: 'Server error during demo login' });
  }
});

app.get('/api/me', (req, res) => {
    const authHeader = req.headers.authorization;
    if (!authHeader) return res.status(401).json({error: 'No token'});
    const token = authHeader.split(' ')[1];
    try {
        const decoded = jwt.verify(token, JWT_SECRET);
        const clinic = db.prepare('SELECT id, clinic_name, email FROM clinics WHERE id = ?').get(decoded.id);
        if (!clinic) return res.status(404).json({error: 'Clinic not found'});
        res.json(clinic);
    } catch(err) {
        res.status(401).json({error: 'Invalid token'});
    }
});


let pauseTimers = {};

function getFullState(clinic_id) {
  const settingsRow = db.prepare('SELECT * FROM settings WHERE clinic_id = ?').get(clinic_id);
  if (!settingsRow) return null;

  const patients = db.prepare('SELECT * FROM patients WHERE clinic_id = ? ORDER BY token ASC').all(clinic_id);
  
  const lastPatient = db.prepare('SELECT token FROM patients WHERE clinic_id = ? ORDER BY token DESC LIMIT 1').get(clinic_id);
  const nextTokenToIssue = lastPatient ? lastPatient.token + 1 : 1;

  const pauseUntil = settingsRow.pauseUntil || 0;
  const isPaused = pauseUntil > Date.now();

  return {
    activeToken: settingsRow.activeToken,
    nextTokenToIssue: nextTokenToIssue,
    averageConsultationTime: settingsRow.averageConsultationTime,
    patients: patients,
    pauseUntil: isPaused ? pauseUntil : 0,
    isPaused: isPaused,
    tokenMode: settingsRow.tokenMode || 'hash'
  };
}

// Socket authentication middleware
io.use((socket, next) => {
  const token = socket.handshake.auth.token;
  const patient_clinic_id = socket.handshake.query.clinic_id;

  if (token) {
    jwt.verify(token, JWT_SECRET, (err, decoded) => {
      if (err) return next(new Error("Authentication error"));
      socket.clinic_id = decoded.id;
      socket.is_receptionist = true;
      next();
    });
  } else if (patient_clinic_id) {
    const clinicExists = db.prepare('SELECT id FROM clinics WHERE id = ?').get(patient_clinic_id);
    if (!clinicExists) return next(new Error("Clinic not found"));
    
    socket.clinic_id = parseInt(patient_clinic_id, 10);
    socket.is_receptionist = false;
    next();
  } else {
    return next(new Error("Authentication or clinic_id required"));
  }
});

io.on('connection', (socket) => {
  console.log('A user connected:', socket.id, 'Clinic:', socket.clinic_id, 'Is Receptionist:', socket.is_receptionist);
  
  const clinic_id = socket.clinic_id;
  const room = `clinic_${clinic_id}`;
  socket.join(room);

  const state = getFullState(clinic_id);
  if (state) {
      socket.emit('queue_updated', state);
  }

  const broadcastUpdate = () => {
      io.to(room).emit('queue_updated', getFullState(clinic_id));
  };

  socket.on('add_patient', (data) => {
    if (!socket.is_receptionist) return;
    const last = db.prepare('SELECT MAX(token) as maxToken FROM patients WHERE clinic_id = ?').get(clinic_id);
    const nextToken = (last && last.maxToken) ? last.maxToken + 1 : 1;

    const stmt = db.prepare('INSERT INTO patients (clinic_id, token, name, phone, status) VALUES (?, ?, ?, ?, ?)');
    stmt.run(clinic_id, nextToken, data.name, data.phone, 'waiting');
    
    broadcastUpdate();
    console.log(`Added patient for clinic ${clinic_id}: Token #${nextToken}`);
  });

  socket.on('call_next', () => {
    if (!socket.is_receptionist) return;
    const state = getFullState(clinic_id);
    if (!state) return;

    const nextPatient = db.prepare("SELECT token FROM patients WHERE clinic_id = ? AND status = 'waiting' ORDER BY token ASC LIMIT 1").get(clinic_id);
    
    if (nextPatient) {
      const currentToken = state.activeToken;
      const nextToken = nextPatient.token;
      
      const updatePatientCalled = db.prepare('UPDATE patients SET status = ?, called_at = ? WHERE clinic_id = ? AND token = ?');
      const updatePatientComplete = db.prepare('UPDATE patients SET status = ?, completed_at = ? WHERE clinic_id = ? AND token = ?');
      
      const transaction = db.transaction(() => {
        if (currentToken > 0) {
          updatePatientComplete.run('completed', Date.now(), clinic_id, currentToken);
        }
        updatePatientCalled.run('called', Date.now(), clinic_id, nextToken);
        db.prepare('UPDATE settings SET activeToken = ? WHERE clinic_id = ?').run(nextToken, clinic_id);
      });
      
      transaction();
      broadcastUpdate();
    } else {
      socket.emit('error_message', 'No patients in the queue.');
    }
  });

  socket.on('update_avg_time', (newTime) => {
    if (!socket.is_receptionist) return;
    if (typeof newTime === 'number' && newTime > 0) {
      db.prepare('UPDATE settings SET averageConsultationTime = ? WHERE clinic_id = ?').run(newTime, clinic_id);
      broadcastUpdate();
    }
  });

  socket.on('pause_queue', ({ durationMs }) => {
    if (!socket.is_receptionist) return;
    if (typeof durationMs !== 'number' || durationMs <= 0) return;
    const pauseUntil = Date.now() + durationMs;
    db.prepare('UPDATE settings SET pauseUntil = ? WHERE clinic_id = ?').run(pauseUntil, clinic_id);
    broadcastUpdate();

    if (pauseTimers[clinic_id]) clearTimeout(pauseTimers[clinic_id]);
    pauseTimers[clinic_id] = setTimeout(() => {
      db.prepare('UPDATE settings SET pauseUntil = 0 WHERE clinic_id = ?').run(clinic_id);
      broadcastUpdate();
    }, durationMs);
  });

  socket.on('resume_queue', () => {
    if (!socket.is_receptionist) return;
    if (pauseTimers[clinic_id]) {
        clearTimeout(pauseTimers[clinic_id]);
        delete pauseTimers[clinic_id];
    }
    db.prepare('UPDATE settings SET pauseUntil = 0 WHERE clinic_id = ?').run(clinic_id);
    broadcastUpdate();
  });

  socket.on('finish_current', () => {
    if (!socket.is_receptionist) return;
    const state = getFullState(clinic_id);
    if (state && state.activeToken > 0) {
      db.prepare('UPDATE patients SET status = ?, completed_at = ? WHERE clinic_id = ? AND token = ?').run('completed', Date.now(), clinic_id, state.activeToken);
      db.prepare('UPDATE settings SET activeToken = 0 WHERE clinic_id = ?').run(clinic_id);
      broadcastUpdate();
    }
  });

  socket.on('update_token_mode', (newMode) => {
    if (!socket.is_receptionist) return;
    const transaction = db.transaction(() => {
      db.prepare('UPDATE settings SET tokenMode = ? WHERE clinic_id = ?').run(newMode, clinic_id);
      db.prepare('DELETE FROM patients WHERE clinic_id = ?').run(clinic_id);
      db.prepare('UPDATE settings SET activeToken = 0, pauseUntil = 0 WHERE clinic_id = ?').run(clinic_id);
    });
    transaction();
    broadcastUpdate();
  });

  socket.on('clear_data', () => {
    if (!socket.is_receptionist) return;
    const transaction = db.transaction(() => {
      db.prepare('DELETE FROM patients WHERE clinic_id = ?').run(clinic_id);
      db.prepare('UPDATE settings SET activeToken = 0, pauseUntil = 0 WHERE clinic_id = ?').run(clinic_id);
    });
    transaction();
    broadcastUpdate();
  });

  socket.on('disconnect', () => {
    console.log('User disconnected:', socket.id);
  });
});

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
});
