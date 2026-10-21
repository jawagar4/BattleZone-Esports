import { useEffect, useState } from 'react';

export default function useCountdown(target, offsetMs = 0) {
  const calc = () => Math.max(0, new Date(target).getTime() - (Date.now() + offsetMs));
  const [ms, setMs] = useState(calc);
  useEffect(() => {
    setMs(calc());
    const t = setInterval(() => setMs(calc()), 1000);
    return () => clearInterval(t);
  }, [target, offsetMs]); // eslint-disable-line react-hooks/exhaustive-deps
  const s = Math.floor(ms / 1000);
  return { done: ms === 0, days: Math.floor(s / 86400), hours: Math.floor((s % 86400) / 3600), minutes: Math.floor((s % 3600) / 60), seconds: s % 60, totalMs: ms };
}
