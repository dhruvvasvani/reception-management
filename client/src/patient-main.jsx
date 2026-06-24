import { StrictMode, useState, useEffect } from 'react';
import { createRoot } from 'react-dom/client';
import { io } from 'socket.io-client';
import './index.css';
import PatientScreen from './components/PatientScreen';
import LiveBackground from './components/LiveBackground';

// Force light mode
document.body.setAttribute('data-theme', 'light');

const socket = io('https://reception-management.onrender.com', {
  transports: ['websocket', 'polling']
});

function PatientApp() {
  const [queueState, setQueueState] = useState(null);

  useEffect(() => {
    socket.on('queue_updated', (data) => setQueueState(data));
    return () => socket.off('queue_updated');
  }, []);

  if (!queueState) {
    return (
      <div className="flex-center h-screen">
        <div className="loader">
          <div className="bar1"></div><div className="bar2"></div><div className="bar3"></div>
          <div className="bar4"></div><div className="bar5"></div><div className="bar6"></div>
          <div className="bar7"></div><div className="bar8"></div><div className="bar9"></div>
          <div className="bar10"></div><div className="bar11"></div><div className="bar12"></div>
        </div>
      </div>
    );
  }

  return (
    <>
      <LiveBackground />
      <PatientScreen data={queueState} />
    </>
  );
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <PatientApp />
  </StrictMode>
);
