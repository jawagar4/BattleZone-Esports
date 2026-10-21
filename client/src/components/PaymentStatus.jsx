import { PHASE_LABEL, STATUS_LABEL } from '../services/format';

export default function PaymentStatus({ status, kind = 'status' }) {
  const label = (kind === 'phase' ? PHASE_LABEL : STATUS_LABEL)[status] || status;
  return <span className={`chip chip-${status}`}>{label}</span>;
}
