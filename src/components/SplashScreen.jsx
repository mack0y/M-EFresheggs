import { useState, useEffect } from 'react';

export default function SplashScreen({ onFinish }) {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let innerTimer;
    const timer = setTimeout(() => {
      setReady(true);
      // Wait for 400ms fade-out transition before telling parent it's done
      innerTimer = setTimeout(onFinish, 500);
    }, 1200);
    return () => {
      clearTimeout(timer);
      if (innerTimer) clearTimeout(innerTimer);
    };
  }, [onFinish]);

  return (
    <div className={`splash-overlay${ready ? ' fade-out' : ''}`}>
      <img
        src={`${import.meta.env.BASE_URL}logo.png`}
        alt=""
        className="splash-logo"
      />
      <span className="splash-title">M&E Fresh Eggs</span>
      <span className="splash-sub">Inventory · Sales · Deliveries</span>
      <div className="splash-spinner" />
    </div>
  );
}
