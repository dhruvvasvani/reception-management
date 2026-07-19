import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

function formatToken(token) {
  if (!token || token <= 0) return '#0';
  return `#${((token - 1) % 50) + 1}`;
}

export default function LiveDisplayScreen({ data }) {
  const [currentTime, setCurrentTime] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  if (!data) return null;

  const activePatient = data.patients.find(p => p.token === data.activeToken);
  const waitingPatients = data.patients.filter(p => p.status === 'waiting' && p.token !== data.activeToken);
  
  // Show up to 5 next patients
  const nextUp = waitingPatients.slice(0, 5);

  const getWaitInfo = (index) => {
    const avgSec = data.averageConsultationTime * 60;
    const EARLY_BUFFER_SEC = 2 * 60;

    let activeHadEarlyCall = false;
    let activeEarlyBufferRem = 0;

    if (activePatient && activePatient.called_at) {
      const prevP = data.patients.find(p => p.token === data.activeToken - 1);
      if (prevP && prevP.called_at && prevP.completed_at) {
        if (prevP.completed_at - prevP.called_at < data.averageConsultationTime * 60 * 1000) {
          activeHadEarlyCall = true;
          const bufferEndMs = activePatient.called_at + EARLY_BUFFER_SEC * 1000;
          activeEarlyBufferRem = Math.max(0, (bufferEndMs - currentTime.getTime()) / 1000);
        }
      }
    }

    const totalElapsedSec = activePatient && activePatient.called_at
      ? Math.max(0, (currentTime.getTime() - activePatient.called_at) / 1000)
      : 0;

    const consultationElapsedSec = activeHadEarlyCall
      ? Math.max(0, totalElapsedSec - EARLY_BUFFER_SEC)
      : totalElapsedSec;

    const isLate = !!activePatient && consultationElapsedSec > avgSec;

    const remainingConsultationSec = activePatient
      ? Math.max(0, avgSec - consultationElapsedSec)
      : 0;

    const rawWaitSec = activeEarlyBufferRem + remainingConsultationSec + index * avgSec;

    const pauseOffsetSec = data.isPaused && data.pauseUntil
      ? Math.max(0, (data.pauseUntil - currentTime.getTime()) / 1000)
      : 0;
    const totalWaitSec = rawWaitSec + pauseOffsetSec;

    if (index === 0 && isLate && pauseOffsetSec === 0) {
      return { kind: 'late' };
    }

    if (totalWaitSec <= 0) {
      return { kind: 'next' };
    }

    const nominalWaitSec = avgSec * (index + 1);
    const isEarly = !isLate && !!activePatient
      && consultationElapsedSec > 0
      && rawWaitSec < nominalWaitSec
      && pauseOffsetSec === 0;

    const effectiveWaitSec = isEarly ? Math.max(EARLY_BUFFER_SEC, totalWaitSec) : totalWaitSec;

    const cdMin = Math.floor(effectiveWaitSec / 60);
    const cdSec = Math.floor(effectiveWaitSec % 60);
    const countdownStr = `${String(cdMin).padStart(2, '0')}:${String(cdSec).padStart(2, '0')}`;

    return {
      kind: isEarly ? 'early' : 'normal',
      countdownStr
    };
  };

  return (
    <div style={{
      width: '100%', height: '100%', 
      background: 'var(--bg-color)',
      display: 'flex', flexDirection: 'column',
      padding: '2rem',
      boxSizing: 'border-box'
    }}>
      <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
        <h1 style={{ fontSize: '2.5rem', margin: 0, color: 'var(--text-color)', fontWeight: 800 }}>Clinic Waiting Room</h1>
        <p style={{ color: 'var(--text-muted)', fontSize: '1.2rem', marginTop: '0.5rem' }}>Please watch this screen for your token.</p>
      </div>

      <div style={{ display: 'flex', gap: '2rem', flex: 1, minHeight: 0 }}>
        {/* Left Side: Currently Serving */}
        <div className="glass-card" style={{ flex: '1.5', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '3rem', border: '2px solid var(--primary-color)' }}>
          <h2 style={{ fontSize: '2rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '2px', marginBottom: '1rem' }}>
            Currently Serving
          </h2>
          <AnimatePresence mode="wait">
            <motion.div
              key={data.activeToken}
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 1.2, opacity: 0 }}
              transition={{ type: 'spring', stiffness: 200, damping: 20 }}
              style={{
                fontSize: '8rem',
                fontWeight: 900,
                color: data.activeToken > 0 ? 'var(--primary-color)' : 'var(--text-muted)',
                lineHeight: 1,
                fontFamily: 'monospace'
              }}
            >
              {data.activeToken > 0 ? formatToken(data.activeToken) : '--'}
            </motion.div>
          </AnimatePresence>
          <AnimatePresence mode="wait">
            <motion.div
              key={activePatient?.name || 'none'}
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              style={{ fontSize: '1.5rem', fontWeight: 600, marginTop: '1rem', color: 'var(--text-muted)' }}
            >
              {activePatient ? 'Please proceed to consultation room' : 'Waiting for next patient'}
            </motion.div>
          </AnimatePresence>
        </div>

        {/* Right Side: Next Up */}
        <div className="glass-card" style={{ flex: '1', display: 'flex', flexDirection: 'column', padding: '2rem', overflow: 'hidden' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', borderBottom: '1px solid var(--glass-border)', paddingBottom: '0.5rem' }}>
            <h2 style={{ fontSize: '1.5rem', color: 'var(--text-muted)', margin: 0 }}>
              Next Up
            </h2>
            <span style={{ fontSize: '1rem', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase' }}>Est. Time</span>
          </div>
          {nextUp.length > 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', overflowY: 'auto' }}>
              <AnimatePresence>
                {nextUp.map((p, i) => {
                  const info = getWaitInfo(i);
                  const isLate = info.kind === 'late';
                  const isNext = info.kind === 'next';

                  return (
                    <motion.div
                      key={p.token}
                      initial={{ opacity: 0, x: 20 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: -20 }}
                      transition={{ delay: i * 0.1 }}
                      style={{
                        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                        background: 'rgba(0,0,0,0.02)', padding: '1rem 1.5rem', borderRadius: '12px',
                        border: '1px solid var(--glass-border)'
                      }}
                    >
                      <span style={{ fontSize: '2rem', fontWeight: 800, color: 'var(--text-color)', fontFamily: 'monospace' }}>
                        {formatToken(p.token)}
                      </span>
                      <div style={{ textAlign: 'right' }}>
                        {isLate ? (
                          <span style={{ fontSize: '1rem', color: '#10b981', fontWeight: 700 }}>Soon</span>
                        ) : isNext ? (
                          <span style={{ fontSize: '1.5rem', color: '#f59e0b', fontWeight: 800 }}>NEXT</span>
                        ) : (
                          <span style={{ fontSize: '1.5rem', color: 'var(--primary-color)', fontWeight: 800, fontFamily: 'monospace' }}>
                            {info.countdownStr}
                          </span>
                        )}
                      </div>
                    </motion.div>
                  );
                })}
              </AnimatePresence>
            </div>
          ) : (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 1, color: 'var(--text-muted)', fontSize: '1.2rem' }}>
              No patients waiting.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
