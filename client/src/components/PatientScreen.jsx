import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

const TOKEN_MODES = [
  { id: 'hash',   label: '#1–#100',  format: (n) => n > 0 ? `#${((n - 1) % 100) + 1}` : '#0' },
  { id: 'plain',  label: '1–100',    format: (n) => n > 0 ? `${((n - 1) % 100) + 1}` : '0' },
  { id: 'alpha',  label: 'A–Z',      format: (n) => {
    let result = '';
    let num = n;
    while (num > 0) {
      num--;
      result = String.fromCharCode(65 + (num % 26)) + result;
      num = Math.floor(num / 26);
    }
    return result;
  }},
];

function formatToken(token, modeId) {
  const mode = TOKEN_MODES.find(m => m.id === modeId) || TOKEN_MODES[0];
  return mode.format(token);
}

function PatientScreen({ data }) {
  const [currentTime, setCurrentTime] = useState(new Date());
  const [isDelayed, setIsDelayed] = useState(false);
  const [showPauseOverlay, setShowPauseOverlay] = useState(false);
  const prevActiveTokenRef = useRef(data.activeToken);
  const prevIsPausedRef    = useRef(data.isPaused);
  const pauseOverlayTimer  = useRef(null);

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const announceToken = (token, mode) => {
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
      let spokenToken = formatToken(token, mode);

      let prefix = mode === 'hash' ? 'Token number' : 'Token';
      const utterance = new SpeechSynthesisUtterance(
        `${prefix} ${spokenToken.replace('#', '')}, please proceed to the consultation room.`
      );
      utterance.rate = 0.9;
      utterance.pitch = 1;
      window.speechSynthesis.speak(utterance);
    }
  };

  useEffect(() => {
    if (data.activeToken > 0 && data.activeToken !== prevActiveTokenRef.current) {
      prevActiveTokenRef.current = data.activeToken;
      announceToken(data.activeToken, data.tokenMode);
    }
  }, [data.activeToken, data.tokenMode]);

  useEffect(() => {
    if (data.isPaused && !prevIsPausedRef.current) {
      setShowPauseOverlay(true);
      if (pauseOverlayTimer.current) clearTimeout(pauseOverlayTimer.current);
      pauseOverlayTimer.current = setTimeout(() => setShowPauseOverlay(false), 15000);
    }
    if (!data.isPaused) {
      setShowPauseOverlay(false);
      if (pauseOverlayTimer.current) clearTimeout(pauseOverlayTimer.current);
    }
    prevIsPausedRef.current = data.isPaused;
  }, [data.isPaused]);

  useEffect(() => () => {
    if (pauseOverlayTimer.current) clearTimeout(pauseOverlayTimer.current);
  }, []);

  if (!data) return <div className="flex-center h-screen"><div className="loader"></div></div>;

  const waitingPatients = data.patients.filter(p => p.status === 'waiting').slice(0, 4);
  const activePatient   = data.patients.find(p => p.token === data.activeToken);

  let elapsedSec    = 0;
  let stopwatchText = '';
  let inTimeStr     = '';

  if (activePatient && activePatient.called_at) {
    elapsedSec = Math.floor((currentTime.getTime() - activePatient.called_at) / 1000);
    if (elapsedSec >= 0) {
      const m = Math.floor(elapsedSec / 60);
      const s = elapsedSec % 60;
      stopwatchText = `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
    }
    const calledDate = new Date(activePatient.called_at);
    inTimeStr = calledDate.toLocaleString(undefined, {
      weekday: 'long', month: 'long', day: 'numeric',
      hour: '2-digit', minute: '2-digit'
    });
  }

  useEffect(() => {
    if (activePatient && activePatient.called_at && data.averageConsultationTime) {
      const diffMins = (currentTime.getTime() - activePatient.called_at) / 60000;
      setIsDelayed(diffMins > data.averageConsultationTime);
    } else {
      setIsDelayed(false);
    }
  }, [currentTime, activePatient, data.averageConsultationTime]);

  const EARLY_BUFFER_MS = 2 * 60 * 1000; // 2 minutes
  let isInEarlyBuffer   = false;
  let earlyBufferStr    = '';
  let earlyBufferRemSec = 0;

  if (activePatient && activePatient.called_at) {
    const prevPatient = data.patients.find(p => p.token === data.activeToken - 1);
    if (prevPatient && prevPatient.called_at && prevPatient.completed_at) {
      const prevServedMs = prevPatient.completed_at - prevPatient.called_at;
      const avgMs        = data.averageConsultationTime * 60 * 1000;
      if (prevServedMs < avgMs) {

        const bufferEndMs = activePatient.called_at + EARLY_BUFFER_MS;
        const remMs       = bufferEndMs - currentTime.getTime();
        if (remMs > 0) {
          isInEarlyBuffer   = true;
          earlyBufferRemSec = remMs / 1000;
          const m = Math.floor(earlyBufferRemSec / 60);
          const s = Math.floor(earlyBufferRemSec % 60);
          earlyBufferStr = `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
        }
      }
    }
  }

  const dateStr = currentTime.toLocaleDateString(undefined, {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
  });
  const timeStr = currentTime.toLocaleTimeString(undefined, {
    hour: '2-digit', minute: '2-digit', second: '2-digit'
  });

  const getWaitInfo = (index) => {
    const avgSec          = data.averageConsultationTime * 60;
    const EARLY_BUFFER_SEC = 2 * 60;

    let activeHadEarlyCall   = false;
    let activeEarlyBufferRem = 0; // seconds left in the buffer right now (0 when done)

    if (activePatient && activePatient.called_at) {
      const prevP = data.patients.find(p => p.token === data.activeToken - 1);
      if (prevP && prevP.called_at && prevP.completed_at) {
        if (prevP.completed_at - prevP.called_at < data.averageConsultationTime * 60 * 1000) {
          activeHadEarlyCall = true;
          const bufferEndMs  = activePatient.called_at + EARLY_BUFFER_SEC * 1000;
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

    const extraDelaySec = isLate ? consultationElapsedSec - avgSec : 0;

    const rawWaitSec = activeEarlyBufferRem + remainingConsultationSec + index * avgSec;

    const pauseOffsetSec = data.isPaused && data.pauseUntil
      ? Math.max(0, (data.pauseUntil - currentTime.getTime()) / 1000)
      : 0;
    const totalWaitSec = rawWaitSec + pauseOffsetSec;

    if (index === 0 && isLate && pauseOffsetSec === 0) {
      return { kind: 'late', extraDelaySec };
    }

    if (totalWaitSec <= 0) {
      return { kind: 'next' };
    }

    const nominalWaitSec = avgSec * (index + 1);
    const isEarly = !isLate && !!activePatient
      && consultationElapsedSec > 0
      && rawWaitSec < nominalWaitSec
      && pauseOffsetSec === 0;   // no "early" badge during a pause

    const effectiveWaitSec = isEarly ? Math.max(EARLY_BUFFER_SEC, totalWaitSec) : totalWaitSec;

    const callDate    = new Date(currentTime.getTime() + effectiveWaitSec * 1000);
    const callTimeStr = callDate.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });

    const cdMin = Math.floor(effectiveWaitSec / 60);
    const cdSec = Math.floor(effectiveWaitSec % 60);
    const countdownStr = `${String(cdMin).padStart(2, '0')}:${String(cdSec).padStart(2, '0')}`;

    return {
      kind: isEarly ? 'early' : 'normal',
      rawWaitSec,
      effectiveWaitSec,
      callTimeStr,
      countdownStr,
      extraDelaySec,
      isEarly
    };
  };

  const pauseRemMs  = data.isPaused && data.pauseUntil ? Math.max(0, data.pauseUntil - currentTime.getTime()) : 0;
  const pauseRemMin = Math.ceil(pauseRemMs / 60000);

  return (
    <motion.div
      className="patient-container"
      initial={{ opacity: 0, scale: 0.98 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0 }}
    >
      {}
      <AnimatePresence>
        {showPauseOverlay && (
          <motion.div
            key="pause-overlay"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            style={{
              position: 'fixed', inset: 0, zIndex: 9999,
              display: 'flex', flexDirection: 'column',
              alignItems: 'center', justifyContent: 'center',
              background: 'radial-gradient(ellipse at center, rgba(239,68,68,0.18) 0%, rgba(10,10,20,0.97) 70%)',
              backdropFilter: 'blur(12px)',
              textAlign: 'center', padding: '2rem'
            }}
          >
            {}
            <motion.div
              animate={{ scale: [1, 1.12, 1] }}
              transition={{ duration: 1.5, repeat: Infinity, ease: 'easeInOut' }}
              style={{ fontSize: 'clamp(4rem, 10vw, 8rem)', marginBottom: '2rem', lineHeight: 1 }}
            >
              ⏸
            </motion.div>

            <motion.h1
              initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.15 }}
              style={{
                fontSize: 'clamp(2rem, 5vw, 4rem)', fontWeight: '900',
                background: 'linear-gradient(135deg, #ef4444, #f97316)',
                WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
                marginBottom: '1rem', lineHeight: 1.2
              }}
            >
              Sorry for the Inconvenience
            </motion.h1>

            <motion.p
              initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.25 }}
              style={{
                fontSize: 'clamp(1.2rem, 2.5vw, 2rem)', color: 'rgba(255,255,255,0.85)',
                fontWeight: '600', marginBottom: '0.75rem', maxWidth: '600px'
              }}
            >
              The doctor is currently unavailable.
            </motion.p>

            <motion.p
              initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.35 }}
              style={{
                fontSize: 'clamp(1rem, 2vw, 1.6rem)', color: 'rgba(255,255,255,0.6)',
                fontWeight: '500', marginBottom: '2.5rem'
              }}
            >
              Please wait — queue will resume in approximately&nbsp;
              <strong style={{ color: '#f97316' }}>{pauseRemMin} min{pauseRemMin !== 1 ? 's' : ''}</strong>.
            </motion.p>

            {}
            <motion.div
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.5 }}
              style={{ width: 'min(420px, 80vw)' }}
            >
              <div style={{ height: '4px', background: 'rgba(255,255,255,0.1)', borderRadius: '99px', overflow: 'hidden' }}>
                <motion.div
                  initial={{ width: '100%' }}
                  animate={{ width: '0%' }}
                  transition={{ duration: 15, ease: 'linear' }}
                  style={{ height: '100%', background: 'linear-gradient(90deg, #ef4444, #f97316)', borderRadius: '99px' }}
                />
              </div>
              <p style={{ fontSize: 'clamp(0.7rem, 1vw, 0.9rem)', color: 'rgba(255,255,255,0.35)', marginTop: '0.75rem', fontWeight: '500' }}>
                Returning to dashboard in 15 seconds…
              </p>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <div style={{ textAlign: 'center', marginBottom: '2vh' }}>
        <h2 className="hero-text" style={{ fontSize: 'clamp(2rem, 3vw, 4rem)', marginBottom: '0.5vh' }}>
          Demo Clinic Waiting Room
        </h2>
        <div className="accent-badge" style={{ fontSize: 'clamp(0.8rem, 1vw, 1.2rem)' }}>
          Dr. Rahul Sharma - MBBS, MD Cardiology
        </div>
      </div>

      {}
      <AnimatePresence>
        {data.isPaused && !showPauseOverlay && (
          <motion.div
            key="pause-banner"
            initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}
            style={{
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '1rem',
              background: 'linear-gradient(135deg, rgba(239,68,68,0.15), rgba(249,115,22,0.08))',
              border: '1.5px solid rgba(239,68,68,0.35)',
              borderRadius: '12px', padding: '0.8vh 2vw', marginBottom: '1.5vh',
              flexWrap: 'wrap', textAlign: 'center'
            }}
          >
            <motion.span
              animate={{ opacity: [1, 0.4, 1] }}
              transition={{ duration: 1.2, repeat: Infinity }}
              style={{ fontSize: 'clamp(1.1rem, 2vw, 1.6rem)' }}
            >⏸</motion.span>
            <span style={{ color: '#ef4444', fontWeight: '800', fontSize: 'clamp(0.9rem, 1.4vw, 1.3rem)' }}>
              Queue Paused — Doctor temporarily unavailable
            </span>
            <span style={{ color: '#f97316', fontWeight: '700', fontFamily: 'monospace', fontSize: 'clamp(0.9rem, 1.4vw, 1.3rem)' }}>
              Resumes in ~{pauseRemMin} min{pauseRemMin !== 1 ? 's' : ''}
            </span>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="patient-dashboard" style={{ flex: 1, minHeight: 0, height: '100%', gap: '2vw' }}>

        {}
        <div className="glass-card" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', height: '100%', padding: '2vw', position: 'relative' }}>
          <AnimatePresence mode="wait">
            {data.activeToken > 0 ? (
              <>
                <h2 style={{ color: 'var(--text-muted)', fontSize: 'clamp(1.5rem, 2vw, 2.5rem)', margin: 0 }}>Now Serving</h2>
                <motion.div
                  key={data.activeToken}
                  initial={{ scale: 0.5, opacity: 0, y: 50 }}
                  animate={{ scale: 1, opacity: 1, y: 0 }}
                  exit={{ scale: 0.5, opacity: 0, y: -50 }}
                  transition={{ type: 'spring', stiffness: 400, damping: 25 }}
                  className="hero-text pulse-animation"
                  style={{ fontSize: 'clamp(8rem, 15vw, 18rem)', margin: '2vh 0', lineHeight: 1 }}
                >
                  {formatToken(data.activeToken, data.tokenMode)}
                </motion.div>
              </>
            ) : (
              <motion.div
                key="waiting"
                initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.9 }}
                style={{ textAlign: 'center', margin: '4vh 0' }}
              >
                <div className="hero-text" style={{ fontSize: 'clamp(3rem, 6vw, 6rem)', WebkitTextFillColor: 'var(--text-muted)' }}>
                  {(() => {
                    const hour = currentTime.getHours();
                    if (hour >= 5 && hour < 12) return 'Good Morning!';
                    if (hour >= 12 && hour < 17) return 'Good Afternoon!';
                    return 'Good Evening!';
                  })()}
                </div>
                <div style={{ fontSize: 'clamp(1.2rem, 2vw, 2.5rem)', color: 'var(--text-muted)', marginTop: '2rem', fontWeight: '600' }}>
                  Welcome to Demo Clinic
                </div>
                <div style={{ fontSize: 'clamp(1rem, 1.5vw, 1.8rem)', color: 'var(--text-muted)', marginTop: '0.8rem', opacity: 0.7 }}>
                  The queue will begin shortly.
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          <AnimatePresence mode="wait">
            {data.activeToken > 0 && isInEarlyBuffer ? (
              
              <motion.div
                key={`early-${data.activeToken}`}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                style={{ textAlign: 'center', width: '100%' }}
              >
                {}
                <motion.div
                  animate={{ scale: [1, 1.04, 1] }}
                  transition={{ duration: 1.8, repeat: Infinity, ease: 'easeInOut' }}
                  style={{
                    display: 'inline-block',
                    background: 'linear-gradient(135deg, rgba(16,185,129,0.15), rgba(16,185,129,0.05))',
                    border: '1.5px solid rgba(16,185,129,0.5)',
                    borderRadius: '12px',
                    padding: '0.6vh 1.5vw',
                    marginBottom: '1.5vh'
                  }}
                >
                  <span style={{ fontSize: 'clamp(0.9rem, 1.3vw, 1.6rem)', color: '#10b981', fontWeight: '800', letterSpacing: '1px', textTransform: 'uppercase' }}>
                    Early Access
                  </span>
                </motion.div>

                <p style={{ fontSize: 'clamp(1rem, 1.5vw, 2rem)', color: 'var(--text-muted)', margin: '0 0 0.5vh 0', fontWeight: '600' }}>
                  Token <strong style={{ color: 'var(--text-color)' }}>{formatToken(data.activeToken, data.tokenMode)}</strong>, please wait —
                </p>
                <p style={{ fontSize: 'clamp(0.9rem, 1.2vw, 1.5rem)', color: 'var(--text-muted)', margin: '0 0 2vh 0' }}>
                  Your consultation room will be ready in:
                </p>

                {}
                <motion.div
                  key={earlyBufferStr}
                  initial={{ opacity: 0.7, scale: 0.97 }}
                  animate={{ opacity: 1, scale: 1 }}
                  style={{
                    fontSize: 'clamp(4rem, 8vw, 9rem)',
                    fontWeight: '900',
                    fontFamily: 'monospace',
                    color: '#10b981',
                    letterSpacing: '4px',
                    lineHeight: 1,
                    margin: '0 0 1.5vh 0'
                  }}
                >
                  {earlyBufferStr}
                </motion.div>
                <p style={{ fontSize: 'clamp(0.75rem, 1vw, 1.2rem)', color: 'var(--text-muted)', margin: 0, letterSpacing: '2px', textTransform: 'uppercase', fontWeight: '600' }}>
                  min : sec
                </p>
              </motion.div>

            ) : data.activeToken > 0 ? (
              
              <motion.div
                key={`serving-${data.activeToken}`}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                style={{ textAlign: 'center' }}
              >
                <p style={{ fontSize: 'clamp(1.2rem, 1.8vw, 2.5rem)', color: '#10b981', fontWeight: 'bold', margin: '0 0 1vh 0' }}>
                  Please proceed to the consultation room
                </p>
                {inTimeStr && (
                  <p style={{ fontSize: 'clamp(1rem, 1.2vw, 1.5rem)', color: 'var(--text-muted)', margin: '0 0 1vh 0' }}>
                    Called in at: <strong>{inTimeStr}</strong>
                  </p>
                )}
                {stopwatchText && (
                  <p style={{ fontSize: 'clamp(2rem, 3vw, 4rem)', color: '#f59e0b', fontWeight: 'bold', margin: 0, fontFamily: 'monospace', letterSpacing: '2px' }}>
                    {stopwatchText}
                  </p>
                )}
                <AnimatePresence>
                  {isDelayed && (
                    <motion.div
                      initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}
                      style={{ marginTop: '2vh', padding: '1rem', background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: '12px', color: '#ef4444', textAlign: 'center', display: 'inline-block' }}
                    >
                      <strong style={{ fontSize: 'clamp(1rem, 1.5vw, 1.5rem)' }}>Consultation running over average time.</strong><br />
                      <span style={{ fontSize: 'clamp(0.9rem, 1vw, 1rem)' }}>Sorry, please wait for few more mins.</span>
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            ) : null}
          </AnimatePresence>
        </div>

        {}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '2vh', height: '100%', minHeight: 0 }}>

          {}
          <div className="glass-card" style={{ padding: '1.5vh', textAlign: 'center', flexShrink: 0 }}>
            <div style={{ fontSize: 'clamp(2rem, 3vw, 3.5rem)', fontWeight: '800', color: 'var(--text-color)', fontFamily: 'monospace', letterSpacing: '-1px', lineHeight: 1 }}>{timeStr}</div>
            <div style={{ fontSize: 'clamp(1rem, 1.2vw, 1.5rem)', color: 'var(--text-muted)', fontWeight: '600', marginTop: '0.5vh' }}>{dateStr}</div>
          </div>

          {}
          <div className="glass-card" style={{ flex: 1, display: 'flex', flexDirection: 'column', padding: '2vh 2vw', minHeight: 0 }}>
            <h3 style={{ marginBottom: '1vh', borderBottom: '1px solid var(--queue-border)', paddingBottom: '1vh', fontSize: 'clamp(1.2rem, 1.8vw, 2rem)' }}>Next Up</h3>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '1vh', flex: 1, justifyContent: 'space-evenly' }}>

              {}
              {waitingPatients.length > 0 && (
                <div style={{ display: 'grid', gridTemplateColumns: '0.7fr 1.5fr 1fr 1fr', padding: '0 0.8vw', color: 'var(--text-muted)', fontSize: 'clamp(0.65rem, 0.85vw, 1rem)', fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: '1.5px' }}>
                  <div>Token</div>
                  <div>Patient</div>
                  <div style={{ textAlign: 'center' }}>Est. Time</div>
                  <div style={{ textAlign: 'right' }}>Countdown</div>
                </div>
              )}

              {}
              {waitingPatients.length > 0 ? waitingPatients.map((p, index) => {
                const info = getWaitInfo(index);
                const isLateKind  = info.kind === 'late';
                const isNextKind  = info.kind === 'next';
                const isEarlyKind = info.kind === 'early';

                const borderColor = isLateKind
                  ? 'rgba(16,185,129,0.4)'
                  : isEarlyKind
                    ? 'rgba(16,185,129,0.4)'
                    : 'var(--queue-border)';

                const countdownColor = isEarlyKind ? '#10b981' : 'var(--primary-color)';

                return (
                  <motion.div
                    key={p.token}
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    style={{
                      display: 'grid',
                      gridTemplateColumns: '0.7fr 1.5fr 1fr 1fr',
                      alignItems: 'center',
                      background: 'var(--panel-bg)',
                      padding: '1.4vh 0.8vw',
                      borderRadius: '12px',
                      border: `1px solid ${borderColor}`,
                      boxShadow: isEarlyKind || isLateKind
                        ? '0 4px 15px rgba(16,185,129,0.07)'
                        : '0 4px 15px rgba(0,0,0,0.04)'
                    }}
                  >
                    {}
                    <div style={{ fontSize: 'clamp(1.4rem, 2.2vw, 2.6rem)', fontWeight: '900', color: 'var(--text-color)', lineHeight: 1 }}>
                      {formatToken(p.token, data.tokenMode)}
                    </div>

                    {}
                    <div style={{ fontSize: 'clamp(0.95rem, 1.5vw, 1.7rem)', color: 'var(--text-muted)', fontWeight: '600', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {p.name}
                    </div>

                    {}
                    <div style={{ textAlign: 'center' }}>
                      {isLateKind ? (
                        <span style={{ fontSize: 'clamp(0.75rem, 1vw, 1.1rem)', color: '#10b981', fontWeight: '700', lineHeight: 1.3 }}>
                          Soon
                        </span>
                      ) : isNextKind ? (
                        <span style={{ fontSize: 'clamp(1.2rem, 1.8vw, 2.2rem)', color: '#f59e0b', fontWeight: '900', fontFamily: 'monospace' }}>
                          NEXT
                        </span>
                      ) : isEarlyKind ? (
                        
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.15vh' }}>
                          <span style={{
                            fontSize: 'clamp(0.55rem, 0.75vw, 0.85rem)',
                            color: '#10b981', fontWeight: '700',
                            textTransform: 'uppercase', letterSpacing: '1px',
                            background: 'rgba(16,185,129,0.14)',
                            padding: '0.15rem 0.5rem', borderRadius: '4px'
                          }}>Early Call</span>
                          <span style={{
                            fontSize: 'clamp(1rem, 1.5vw, 1.8rem)',
                            color: '#10b981',
                            fontWeight: '800', fontFamily: 'monospace'
                          }}>
                            {info.callTimeStr}
                          </span>
                          <span style={{ fontSize: 'clamp(0.55rem, 0.72vw, 0.82rem)', color: 'var(--text-muted)', fontWeight: '500' }}>
                            est. call
                          </span>
                        </div>
                      ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.2vh' }}>
                          <span style={{
                            fontSize: 'clamp(1.1rem, 1.6vw, 2rem)',
                            color: 'var(--text-color)',
                            fontWeight: '800', fontFamily: 'monospace', letterSpacing: '0.5px'
                          }}>
                            {info.callTimeStr}
                          </span>
                          <span style={{ fontSize: 'clamp(0.6rem, 0.75vw, 0.85rem)', color: 'var(--text-muted)', fontWeight: '500' }}>
                            est. call
                          </span>
                        </div>
                      )}
                    </div>

                    {}
                    <div style={{ textAlign: 'right' }}>
                      {isLateKind ? (
                        <span style={{ fontSize: 'clamp(0.75rem, 1vw, 1.1rem)', color: '#10b981', fontWeight: '700', lineHeight: 1.3 }}>
                          Wait a<br />few more min
                        </span>
                      ) : isNextKind ? null : isEarlyKind ? (
                        
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '0.15vh' }}>
                          <span style={{
                            fontSize: 'clamp(0.55rem, 0.72vw, 0.82rem)',
                            color: '#10b981', fontWeight: '600',
                            textTransform: 'uppercase', letterSpacing: '0.8px'
                          }}>within</span>
                          <span style={{
                            fontSize: 'clamp(1.4rem, 2.1vw, 2.7rem)',
                            color: '#10b981',
                            fontWeight: '800', fontFamily: 'monospace',
                            letterSpacing: '1px', lineHeight: 1
                          }}>
                            {info.countdownStr}
                          </span>
                          <span style={{ fontSize: 'clamp(0.55rem, 0.72vw, 0.82rem)', color: 'var(--text-muted)', fontWeight: '500' }}>
                            min : sec
                          </span>
                        </div>
                      ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '0.2vh' }}>
                          <span style={{
                            fontSize: 'clamp(1.4rem, 2.1vw, 2.7rem)',
                            color: countdownColor,
                            fontWeight: '800', fontFamily: 'monospace',
                            letterSpacing: '1px', lineHeight: 1
                          }}>
                            {info.countdownStr}
                          </span>
                          <span style={{ fontSize: 'clamp(0.6rem, 0.75vw, 0.85rem)', color: 'var(--text-muted)', fontWeight: '500' }}>
                            min : sec
                          </span>
                        </div>
                      )}
                    </div>
                  </motion.div>
                );
              }) : (
                <div style={{ color: 'var(--text-muted)', fontSize: 'clamp(1.2rem, 1.8vw, 2rem)', textAlign: 'center', margin: 'auto' }}>
                  No more patients waiting.
                </div>
              )}

            </div>
          </div>
        </div>
      </div>
    </motion.div>
  );
}

export default PatientScreen;
