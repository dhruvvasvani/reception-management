const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const Database = require('better-sqlite3');
const path = require('path');

const app = express();
app.use(cors());

const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

const db = new Database(path.join(__dirname, 'queue.db'));

db.exec(`
  CREATE TABLE IF NOT EXISTS patients (
    token INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT,
    phone TEXT,
    status TEXT DEFAULT 'waiting',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );
  
  CREATE TABLE IF NOT EXISTS settings (
    id INTEGER PRIMARY KEY,
    activeToken INTEGER DEFAULT 0,
    averageConsultationTime INTEGER DEFAULT 10,
    pauseUntil INTEGER DEFAULT 0,
    tokenMode TEXT DEFAULT 'hash'
  );
`);

try {
  db.exec('ALTER TABLE patients ADD COLUMN called_at INTEGER;');
} catch (e) {}
try {
  db.exec('ALTER TABLE patients ADD COLUMN completed_at INTEGER;');
} catch (e) {}
try {
  db.exec('ALTER TABLE settings ADD COLUMN pauseUntil INTEGER DEFAULT 0;');
} catch (e) {}
try {
  db.exec("ALTER TABLE settings ADD COLUMN tokenMode TEXT DEFAULT 'hash';");
} catch (e) {}

db.exec(`
  INSERT OR IGNORE INTO settings (id, activeToken, averageConsultationTime, pauseUntil, tokenMode) VALUES (1, 0, 10, 0, 'hash');
`);

let pauseTimer = null;

function getFullState() {
  const settingsRow = db.prepare('SELECT * FROM settings WHERE id = 1').get();
  const patients = db.prepare('SELECT * FROM patients ORDER BY token ASC').all();
  
  const lastPatient = db.prepare('SELECT token FROM patients ORDER BY token DESC LIMIT 1').get();
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

io.on('connection', (socket) => {
  console.log('A user connected:', socket.id);

  socket.emit('queue_updated', getFullState());

  socket.on('add_patient', (data) => {
    const last = db.prepare('SELECT MAX(token) as maxToken FROM patients').get();
    const nextToken = (last && last.maxToken) ? last.maxToken + 1 : 1;

    const stmt = db.prepare('INSERT INTO patients (token, name, phone, status, timestamp) VALUES (?, ?, ?, ?, ?)');
    stmt.run(nextToken, data.name, data.phone, 'waiting', Date.now());
    
    io.emit('queue_updated', getFullState());
    console.log(`Added patient: Token #${nextToken}`);
  });

  socket.on('call_next', () => {
    const state = getFullState();
    
    const nextPatient = db.prepare('SELECT token FROM patients WHERE status = "waiting" ORDER BY token ASC LIMIT 1').get();
    
    if (nextPatient) {
      const currentToken = state.activeToken;
      const nextToken = nextPatient.token;
      
      const updatePatientCalled = db.prepare('UPDATE patients SET status = ?, called_at = ? WHERE token = ?');
      const updatePatientComplete = db.prepare('UPDATE patients SET status = ?, completed_at = ? WHERE token = ?');
      
      const transaction = db.transaction(() => {
        if (currentToken > 0) {
          updatePatientComplete.run('completed', Date.now(), currentToken);
        }
        updatePatientCalled.run('called', Date.now(), nextToken);
        db.prepare('UPDATE settings SET activeToken = ? WHERE id = 1').run(nextToken);
      });
      
      transaction();
      
      io.emit('queue_updated', getFullState());
      console.log(`Called next patient: Token #${nextToken}`);
    } else {
      socket.emit('error_message', 'No patients in the queue.');
    }
  });

  socket.on('update_avg_time', (newTime) => {
    if (typeof newTime === 'number' && newTime > 0) {
      db.prepare('UPDATE settings SET averageConsultationTime = ? WHERE id = 1').run(newTime);
      io.emit('queue_updated', getFullState());
      console.log(`Updated average consultation time: ${newTime} mins`);
    }
  });

  socket.on('pause_queue', ({ durationMs }) => {
    if (typeof durationMs !== 'number' || durationMs <= 0) return;
    const pauseUntil = Date.now() + durationMs;
    db.prepare('UPDATE settings SET pauseUntil = ? WHERE id = 1').run(pauseUntil);
    io.emit('queue_updated', getFullState());
    console.log(`Queue paused until ${new Date(pauseUntil).toLocaleTimeString()}`);

    if (pauseTimer) clearTimeout(pauseTimer);
    pauseTimer = setTimeout(() => {
      db.prepare('UPDATE settings SET pauseUntil = 0 WHERE id = 1').run();
      io.emit('queue_updated', getFullState());
      console.log('Queue auto-resumed');
    }, durationMs);
  });

  socket.on('resume_queue', () => {
    if (pauseTimer) clearTimeout(pauseTimer);
    pauseTimer = null;
    db.prepare('UPDATE settings SET pauseUntil = 0 WHERE id = 1').run();
    io.emit('queue_updated', getFullState());
    console.log('Queue manually resumed');
  });

  socket.on('finish_current', () => {
    const state = getFullState();
    if (state.activeToken > 0) {
      db.prepare('UPDATE patients SET status = ?, completed_at = ? WHERE token = ?').run('completed', Date.now(), state.activeToken);
      db.prepare('UPDATE settings SET activeToken = 0 WHERE id = 1').run();
      io.emit('queue_updated', getFullState());
      console.log('Finished current patient.');
    }
  });

  socket.on('update_token_mode', (newMode) => {
    const transaction = db.transaction(() => {

      db.prepare('UPDATE settings SET tokenMode = ? WHERE id = 1').run(newMode);

      db.prepare('DELETE FROM patients').run();
      try {
        db.prepare('DELETE FROM sqlite_sequence WHERE name="patients"').run();
      } catch (e) {}
      db.prepare('UPDATE settings SET activeToken = 0, pauseUntil = 0 WHERE id = 1').run();
    });
    transaction();
    io.emit('queue_updated', getFullState());
    console.log(`Token mode changed to ${newMode} and data cleared.`);
  });

  socket.on('clear_data', () => {
    const transaction = db.transaction(() => {
      db.prepare('DELETE FROM patients').run();
      try {
        db.prepare('DELETE FROM sqlite_sequence WHERE name="patients"').run();
      } catch (e) {

      }
      db.prepare('UPDATE settings SET activeToken = 0, pauseUntil = 0 WHERE id = 1').run();
    });
    transaction();
    io.emit('queue_updated', getFullState());
    console.log('All data cleared by receptionist');
  });

  socket.on('disconnect', () => {
    console.log('User disconnected:', socket.id);
  });
});

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
});
