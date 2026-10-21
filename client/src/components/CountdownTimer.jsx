import useCountdown from '../hooks/useCountdown';

export default function CountdownTimer({ target, large = false, offset = 0, doneLabel = 'Started', label }) {
  const c = useCountdown(target, offset);
  if (c.done) return <span className="chip chip-live">{doneLabel}</span>;
  const units = [['days', c.days], ['hrs', c.hours], ['min', c.minutes], ['sec', c.seconds]];
  const text = `${c.days} days ${c.hours} hours ${c.minutes} minutes ${c.seconds} seconds`;
  return (
    <div className={`cd ${large ? 'lg' : ''}`} role="timer" aria-label={`${label || 'Time remaining'}: ${text}`}>
      {units.map(([name, v]) => (
        <div className="cd-unit" key={name} aria-hidden="true"><b>{String(v).padStart(2, '0')}</b><small>{name}</small></div>
      ))}
    </div>
  );
}
