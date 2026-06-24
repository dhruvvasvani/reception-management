import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

const PAUSE_OPTIONS = [
  { label: '1 min',  ms: 1  * 60 * 1000 },
  { label: '5 min',  ms: 5  * 60 * 1000 },
  { label: '10 min', ms: 10 * 60 * 1000 },
  { label: '30 min', ms: 30 * 60 * 1000 },
  { label: '1 hour', ms: 60 * 60 * 1000 },
];

function formatToken(token) {
  if (!token || token <= 0) return '#0';
  return `#${((token - 1) % 50) + 1}`;
}

function downloadCSV(patients, avgTime) {
  const headers = ['Token', 'Name', 'Phone', 'Status', 'Created At', 'Called At', 'Completed At', 'Waited (min)'];
  const rows = patients.map(p => {
    const createdAt  = p.created_at  ? new Date(p.created_at).toLocaleString()  : '';
    const calledAt   = p.called_at   ? new Date(p.called_at).toLocaleString()   : '';
    const completedAt = p.completed_at ? new Date(p.completed_at).toLocaleString() : '';
    const waitedMin  = p.called_at && p.created_at
      ? ((p.called_at - new Date(p.created_at).getTime()) / 60000).toFixed(1)
      : '';
    return [p.token, p.name, p.phone, p.status, createdAt, calledAt, completedAt, waitedMin];
  });

  const csv = [headers, ...rows]
    .map(row => row.map(cell => `"${String(cell ?? '').replace(/"/g, '""')}"`).join(','))
    .join('\n');

  const blob = new Blob([csv], { type: 'text/csv' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href     = url;
  a.download = `queue-data-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

function getWaitStr(index, activePatient, avgSec, patients, activeToken, currentTime) {
  const EARLY_BUFFER_SEC = 2 * 60;

  let activeHadEarlyCall   = false;
  let activeEarlyBufferRem = 0;

  if (activePatient && activePatient.called_at) {
    const prevP = patients.find(p => p.token === activeToken - 1);
    if (prevP && prevP.called_at && prevP.completed_at) {
      if (prevP.completed_at - prevP.called_at < avgSec * 1000) {
        activeHadEarlyCall = true;
        const bufferEndMs  = activePatient.called_at + EARLY_BUFFER_SEC * 1000;
        activeEarlyBufferRem = Math.max(0, (bufferEndMs - currentTime) / 1000);
      }
    }
  }

  const totalElapsedSec = activePatient && activePatient.called_at
    ? Math.max(0, (currentTime - activePatient.called_at) / 1000)
    : 0;

  const consultationElapsedSec = activeHadEarlyCall
    ? Math.max(0, totalElapsedSec - EARLY_BUFFER_SEC)
    : totalElapsedSec;

  const isLate = !!activePatient && consultationElapsedSec > avgSec;

  const remainingConsultationSec = activePatient
    ? Math.max(0, avgSec - consultationElapsedSec)
    : 0;

  const rawWaitSec = activeEarlyBufferRem + remainingConsultationSec + index * avgSec;

  if (index === 0 && isLate) {
    return { label: 'Delayed', color: '#10b981', isLate: true };
  }

  if (rawWaitSec <= 0) {
    return { label: 'Now', color: '#f59e0b' };
  }

  const nominalWaitSec = avgSec * (index + 1);
  const isEarly = !isLate && !!activePatient && consultationElapsedSec > 0 && rawWaitSec < nominalWaitSec;

  const effectiveWaitSec = isEarly ? Math.max(EARLY_BUFFER_SEC, rawWaitSec) : rawWaitSec;

  const callDate = new Date(currentTime + effectiveWaitSec * 1000);
  const callTime = callDate.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });

  const m = Math.floor(effectiveWaitSec / 60);
  const s = Math.floor(effectiveWaitSec % 60);
  const cd = `${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`;

  return {
    label: `~${cd}`,
    callTime,
    color: isEarly ? '#10b981' : 'var(--primary-color)',
    isEarly,
  };
}

function ReceptionistScreen({ data, socket }) {
  const [name,        setName]        = useState('');
  const [phone,       setPhone]       = useState('');
  const [avgTime,     setAvgTime]     = useState(data.averageConsultationTime);
  const [isCalling,   setIsCalling]   = useState(false);
  const [currentTime, setCurrentTime] = useState(Date.now());
  const [showPauseMenu, setShowPauseMenu] = useState(false);
  const nameInputRef  = useRef(null);

  useEffect(() => {
    const t = setInterval(() => setCurrentTime(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    const handleKeyDown = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'n') {
        e.preventDefault();
        nameInputRef.current?.focus();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const handleAddPatient = (e) => {
    e.preventDefault();
    if (!name || !phone) return;
    socket.emit('add_patient', { name, phone });
    setName('');
    setPhone('');
    nameInputRef.current?.focus();
  };

  const handleUpdateAvgTime = () => {
    const time = parseInt(avgTime, 10);
    if (!isNaN(time) && time > 0) socket.emit('update_avg_time', time);
  };

  const handleCallNext = () => {
    if (isCalling) return;
    setIsCalling(true);
    socket.emit('call_next');
    setTimeout(() => setIsCalling(false), 2000);
  };

  const handleFinishCurrent = () => {
    socket.emit('finish_current');
  };

  const handlePause = (ms) => {
    socket.emit('pause_queue', { durationMs: ms });
    setShowPauseMenu(false);
  };

  const handleResume = () => {
    socket.emit('resume_queue');
  };

  const handleClearData = () => {
    if (window.confirm("Kindly make sure you save the data!\n\nAre you sure you want to permanently clear all queue data?")) {
      socket.emit('clear_data');
    }
  };

  const isPaused = data.isPaused;
  const pauseUntil = data.pauseUntil || 0;

  const pauseRemSec = isPaused ? Math.max(0, Math.ceil((pauseUntil - currentTime) / 1000)) : 0;
  const pauseRemMin = Math.floor(pauseRemSec / 60);
  const pauseRemS   = pauseRemSec % 60;
  const pauseRemStr = `${String(pauseRemMin).padStart(2,'0')}:${String(pauseRemS).padStart(2,'0')}`;

  const activePatient   = data.patients.find(p => p.token === data.activeToken);
  const waitingPatients = data.patients.filter(p => 
    (p.status === 'waiting' || p.status === 'called') && p.token !== data.activeToken
  );
  const avgSec          = data.averageConsultationTime * 60;

  const labelFor = (token) => formatToken(token);

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      className="glass-card"
    >
      <div style={{ marginBottom: '2rem', borderBottom: '1px solid var(--queue-border)', paddingBottom: '1rem', textAlign: 'center' }}>
        <h2 className="hero-text tech-font" style={{ fontSize: '2.5rem', marginBottom: '0.5rem', textTransform: 'uppercase' }}>Demo Clinic Reception</h2>
        <div className="accent-badge" style={{ marginTop: '0.5rem' }}>Dr. Rahul Sharma - MBBS, MD Cardiology</div>
      </div>

      <div className="receptionist-grid">

        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h3>Add New Patient</h3>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', background: 'var(--input-bg)', padding: '0.2rem 0.5rem', borderRadius: '4px', fontFamily: 'monospace' }}>Ctrl + N</span>
          </div>
          <form onSubmit={handleAddPatient}>
            <label className="input-label">Patient Name</label>
            <input
              ref={nameInputRef}
              type="text"
              className="input-field"
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="Patient Name"
              maxLength={20}
              autoFocus
              required
            />
            <label className="input-label">Phone Number</label>
            <input
              type="tel"
              className="input-field"
              value={phone}
              onChange={e => {
                const val = e.target.value.replace(/\D/g, '');
                if (val.length <= 10) setPhone(val);
              }}
              placeholder="Patient Number"
              pattern="[0-9]{10}"
              title="Please enter exactly 10 digits"
              required
            />
            <motion.button
              whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
              type="submit" className="primary-btn" style={{ width: '100%' }}
            >
              Add Patient
            </motion.button>
          </form>

          <div style={{ marginTop: '2rem' }}>
            <div className="glass-card" style={{ padding: '1.5rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                <h3 style={{ margin: 0 }}>Average Consultation Time</h3>
                <div style={{ background: 'var(--primary-color)', color: 'white', padding: '0.3rem 0.8rem', borderRadius: '99px', fontWeight: 'bold', fontSize: '0.875rem' }}>{avgTime} mins</div>
              </div>
              <input
                type="range" style={{ width: '100%', marginBottom: '1rem', accentColor: 'var(--primary-color)' }}
                value={avgTime} onChange={e => setAvgTime(Number(e.target.value))}
                onMouseUp={handleUpdateAvgTime} onTouchEnd={handleUpdateAvgTime}
                min="1" max="60"
              />
              <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--text-muted)', fontSize: '0.75rem', marginBottom: '1rem' }}>
                <span>1 min</span><span>60 mins</span>
              </div>
              <p style={{ fontSize: '0.875rem', color: 'var(--text-muted)', margin: 0 }}>Drag the slider to adjust patient flow speed. The Patient TV screen recalculates instantly.</p>
            </div>
          </div>

          <div style={{ display: 'flex', gap: '0.75rem', marginTop: '1.5rem', flexWrap: 'wrap' }}>

            <motion.button
              whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
              onClick={() => downloadCSV(data.patients, data.averageConsultationTime)}
              style={{
                padding: '0.6rem 1.1rem',
                background: 'rgba(16,185,129,0.12)', border: '1px solid rgba(16,185,129,0.35)',
                borderRadius: '8px', cursor: 'pointer', color: '#10b981',
                fontWeight: '700', fontSize: '0.875rem',
                display: 'flex', alignItems: 'center', gap: '0.4rem', whiteSpace: 'nowrap'
              }}
              title="Download all queue data as CSV"
            >
              ⬇ CSV
            </motion.button>

            <motion.button
              whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
              onClick={handleClearData}
              style={{
                padding: '0.6rem 1.1rem',
                background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.35)',
                borderRadius: '8px', cursor: 'pointer', color: '#ef4444',
                fontWeight: '700', fontSize: '0.875rem',
                display: 'flex', alignItems: 'center', gap: '0.4rem', whiteSpace: 'nowrap'
              }}
              title="Clear all queue data"
            >
              ⚠️ Clear Data
            </motion.button>
          </div>
        </div>

        <div>
          <h3>Queue Control</h3>

          <div style={{ marginBottom: '1.5rem', position: 'relative' }}>
            <AnimatePresence mode="wait">
              {isPaused ? (
                <motion.div
                  key="paused-status"
                  initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}
                  style={{
                    background: 'linear-gradient(135deg, rgba(239,68,68,0.12), rgba(239,68,68,0.05))',
                    border: '1.5px solid rgba(239,68,68,0.4)',
                    borderRadius: '12px',
                    padding: '1rem 1.2rem',
                    display: 'flex', flexDirection: 'column', gap: '0.6rem'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <motion.span
                        animate={{ opacity: [1, 0.3, 1] }}
                        transition={{ duration: 1.2, repeat: Infinity }}
                        style={{ fontSize: '1.1rem' }}
                      >⏸</motion.span>
                      <span style={{ fontWeight: '800', color: '#ef4444', fontSize: '1rem' }}>Queue Paused</span>
                    </div>
                    <div style={{
                      fontFamily: 'monospace', fontWeight: '900', fontSize: '1.4rem',
                      color: '#ef4444', letterSpacing: '1px'
                    }}>
                      {pauseRemStr}
                    </div>
                  </div>
                  <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: '500' }}>
                    Resumes at {new Date(pauseUntil).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })}
                  </div>
                  <motion.button
                    whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.97 }}
                    onClick={handleResume}
                    style={{
                      width: '100%', padding: '0.55rem', borderRadius: '8px',
                      background: 'rgba(239,68,68,0.15)', border: '1px solid rgba(239,68,68,0.45)',
                      color: '#ef4444', fontWeight: '700', fontSize: '0.875rem', cursor: 'pointer'
                    }}
                  >
                    ▶ Resume Now
                  </motion.button>
                </motion.div>
              ) : (
                <motion.div key="pause-btn" initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}>
                  <motion.button
                    whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.97 }}
                    onClick={() => setShowPauseMenu(v => !v)}
                    style={{
                      width: '100%', padding: '0.65rem 1rem',
                      background: 'rgba(245,158,11,0.1)', border: '1px solid rgba(245,158,11,0.4)',
                      borderRadius: '10px', cursor: 'pointer', color: '#f59e0b',
                      fontWeight: '700', fontSize: '0.9rem',
                      display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.5rem'
                    }}
                  >
                    <span>⏸ Pause Queue (Doctor Busy)</span>
                    <span style={{ fontSize: '0.6rem', color: 'var(--text-muted)' }}>{showPauseMenu ? '▲' : '▼'}</span>
                  </motion.button>

                  <AnimatePresence>
                    {showPauseMenu && (
                      <motion.div
                        initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }}
                        style={{
                          position: 'absolute', left: 0, right: 0, top: 'calc(100% + 4px)', zIndex: 9999,
                          background: 'var(--bg-color)', border: '1px solid var(--queue-border)',
                          borderRadius: '10px', overflow: 'hidden',
                          boxShadow: '0 8px 28px rgba(0,0,0,0.5)'
                        }}
                      >
                        <div style={{ padding: '0.5rem 1rem', fontSize: '0.7rem', fontWeight: '700', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '1px', borderBottom: '1px solid var(--queue-border)' }}>
                          Pause duration
                        </div>
                        {PAUSE_OPTIONS.map(opt => (
                          <button
                            key={opt.label}
                            onClick={() => handlePause(opt.ms)}
                            style={{
                              display: 'block', width: '100%', padding: '0.65rem 1rem',
                              textAlign: 'left', border: 'none', cursor: 'pointer',
                              background: 'transparent', color: 'var(--text-color)',
                              fontWeight: '600', fontSize: '0.9rem',
                              borderBottom: '1px solid var(--queue-border)',
                              transition: 'background 0.15s'
                            }}
                            onMouseEnter={e => e.currentTarget.style.background = 'rgba(245,158,11,0.08)'}
                            onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                          >
                            ⏱ {opt.label}
                          </button>
                        ))}
                      </motion.div>
                    )}
                  </AnimatePresence>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          <div style={{ background: 'var(--panel-bg)', padding: '1.5rem', borderRadius: '12px', textAlign: 'center', marginBottom: '2rem' }}>
            <p style={{ margin: 0, color: 'var(--text-muted)' }}>Currently Serving</p>
            <AnimatePresence mode="wait">
              <motion.div
                key={data.activeToken}
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 1.2 }}
                className="hero-text tech-font" style={{ fontSize: '5rem', margin: '0.5rem 0' }}
              >
                {data.activeToken > 0 ? labelFor(data.activeToken) : 'None'}
              </motion.div>
            </AnimatePresence>
            {data.activeToken >= data.nextTokenToIssue - 1 && data.activeToken > 0 ? (
              <motion.button
                whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
                onClick={handleFinishCurrent}
                className="primary-btn"
                style={{
                  width: '100%', fontSize: '1.15rem', fontWeight: '600', padding: '1rem',
                  background: '#f59e0b', color: 'white'
                }}
              >
                Finish Current Patient
              </motion.button>
            ) : (
              <motion.button
                whileHover={{ scale: (isCalling || data.activeToken >= data.nextTokenToIssue - 1) ? 1 : 1.02 }}
                whileTap={{ scale: (isCalling || data.activeToken >= data.nextTokenToIssue - 1) ? 1 : 0.98 }}
                onClick={handleCallNext}
                className="primary-btn"
                style={{
                  width: '100%', fontSize: '1.15rem', fontWeight: '600', padding: '1rem',
                  background: data.activeToken >= data.nextTokenToIssue - 1 ? 'rgba(128,128,128,0.2)' : '#10b981',
                  color: data.activeToken >= data.nextTokenToIssue - 1 ? 'var(--text-muted)' : 'white'
                }}
                disabled={isCalling || data.activeToken >= data.nextTokenToIssue - 1}
              >
                {isCalling ? 'Calling...' : (data.activeToken >= data.nextTokenToIssue - 1 ? 'No Next Patient' : 'Call Next Patient')}
              </motion.button>
            )}
          </div>

          {}
          <h3>Waiting List</h3>

          {}
          {waitingPatients.length > 0 && (
            <div style={{
              display: 'grid', gridTemplateColumns: '0.8fr 1.2fr 1fr 1fr',
              padding: '0.3rem 0.75rem',
              fontSize: '0.68rem', fontWeight: '700', letterSpacing: '1px',
              textTransform: 'uppercase', color: 'var(--text-muted)'
            }}>
              <div>Token</div>
              <div>Patient</div>
              <div style={{ textAlign: 'center' }}>Est. Call</div>
              <div style={{ textAlign: 'right' }}>Wait</div>
            </div>
          )}

          <ul className="queue-list" style={{ padding: 0, margin: 0 }}>
            <AnimatePresence>
              {waitingPatients.map((p, idx) => {

                const isActive = p.status === 'called';

                const waitingOnly = waitingPatients.filter(x => x.status === 'waiting');
                const wIdx        = waitingOnly.findIndex(x => x.token === p.token);

                const waitInfo = !isActive
                  ? getWaitStr(wIdx, activePatient, avgSec, data.patients, data.activeToken, currentTime)
                  : null;

                return (
                  <motion.li
                    key={p.token}
                    initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 20 }}
                    layout
                    style={{
                      display: 'grid',
                      gridTemplateColumns: '0.8fr 1.2fr 1fr 1fr',
                      alignItems: 'center',
                      padding: '0.6rem 0.75rem',
                      borderRadius: '10px',
                      marginBottom: '0.4rem',
                      background: isActive
                        ? 'linear-gradient(135deg, rgba(16,185,129,0.1), rgba(16,185,129,0.04))'
                        : 'var(--panel-bg)',
                      border: isActive ? '1px solid rgba(16,185,129,0.3)' : '1px solid var(--queue-border)',
                      listStyle: 'none'
                    }}
                  >
                    {}
                    <div style={{ fontWeight: '800', color: 'var(--text-color)', fontSize: '1rem' }}>
                      {labelFor(p.token)}
                    </div>

                    {}
                    <div>
                      <div style={{ fontWeight: '600', color: 'var(--text-color)', fontSize: '0.9rem' }}>{p.name}</div>
                      <span style={{
                        fontSize: '0.65rem', fontWeight: '700',
                        background: isActive ? '#10b981' : '#3b82f6',
                        color: 'white', padding: '0.1rem 0.4rem', borderRadius: '4px'
                      }}>
                        {p.status.toUpperCase()}
                      </span>
                    </div>

                    {}
                    <div style={{ textAlign: 'center' }}>
                      {isActive ? (
                        <span style={{ fontSize: '0.75rem', color: '#10b981', fontWeight: '700' }}>In Room</span>
                      ) : waitInfo ? (
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1px' }}>
                          {waitInfo.callTime && (
                            <span style={{ fontSize: '0.82rem', color: waitInfo.color, fontWeight: '800', fontFamily: 'monospace' }}>
                              {waitInfo.callTime}
                            </span>
                          )}
                          {waitInfo.isEarly && (
                            <span style={{ fontSize: '0.6rem', color: '#10b981', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.5px' }}>early</span>
                          )}
                          {waitInfo.isLate && (
                            <span style={{ fontSize: '0.6rem', color: '#10b981', fontWeight: '700', textTransform: 'uppercase' }}>delayed</span>
                          )}
                        </div>
                      ) : null}
                    </div>

                    {}
                    <div style={{ textAlign: 'right' }}>
                      {isActive ? (
                        <span style={{ fontSize: '0.75rem', color: '#10b981', fontWeight: '700' }}>—</span>
                      ) : waitInfo ? (
                        <span style={{
                          fontSize: '0.95rem', fontWeight: '800',
                          color: waitInfo.color,
                          fontFamily: 'monospace', letterSpacing: '0.5px'
                        }}>
                          {waitInfo.label}
                        </span>
                      ) : null}
                    </div>
                  </motion.li>
                );
              })}
            </AnimatePresence>

            {waitingPatients.length === 0 && (
              <motion.li
                initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                style={{ padding: '1rem', textAlign: 'center', color: 'var(--text-muted)', listStyle: 'none' }}
              >
                No patients waiting.
              </motion.li>
            )}
          </ul>
        </div>
      </div>
    </motion.div>
  );
}

export default ReceptionistScreen;
