import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';

export default function LiveBackground() {
  const [mousePosition, setMousePosition] = useState({
    x: window.innerWidth / 2,
    y: window.innerHeight / 2
  });

  useEffect(() => {
    let animationFrameId;
    
    const handleMouseMove = (e) => {
      // Throttle state updates using requestAnimationFrame for smoother performance
      cancelAnimationFrame(animationFrameId);
      animationFrameId = requestAnimationFrame(() => {
        setMousePosition({ x: e.clientX, y: e.clientY });
      });
    };

    window.addEventListener('mousemove', handleMouseMove);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      cancelAnimationFrame(animationFrameId);
    };
  }, []);

  return (
    <div className="live-bg">
      <motion.div
        className="orb orb-1"
        animate={{
          x: mousePosition.x - 300,
          y: mousePosition.y - 300,
        }}
        transition={{ type: "tween", ease: "easeOut", duration: 1.5 }}
      />
      <motion.div
        className="orb orb-2"
        animate={{
          x: window.innerWidth - mousePosition.x - 300,
          y: window.innerHeight - mousePosition.y - 300,
        }}
        transition={{ type: "tween", ease: "easeOut", duration: 2.5 }}
      />
    </div>
  );
}
