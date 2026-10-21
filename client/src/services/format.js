export const inr = (rupees = 0) => (rupees === 0 ? 'Free' : `₹${Number(rupees).toLocaleString('en-IN')}`);
export const inrPaise = (paise = 0) => `₹${(paise / 100).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
export const fmtDateTime = (d, tz = 'Asia/Kolkata') =>
  d ? new Date(d).toLocaleString('en-IN', { timeZone: tz, day: 'numeric', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit' }) : '—';
export const fmtDate = (d, tz = 'Asia/Kolkata') => (d ? new Date(d).toLocaleDateString('en-IN', { timeZone: tz, day: 'numeric', month: 'short', year: 'numeric' }) : '—');
export const PHASE_LABEL = {
  upcoming: 'Upcoming', registration_open: 'Registration open', full: 'Full', live: 'Live', completed: 'Completed',
  registration_closed: 'Registration closed', paused: 'Paused', cancelled: 'Cancelled', draft: 'Draft',
};
export const STATUS_LABEL = {
  pending_payment: 'Awaiting payment', pending_approval: 'Awaiting approval', confirmed: 'Confirmed', cancelled: 'Cancelled', rejected: 'Rejected', expired: 'Expired',
  suspended: 'Suspended', success: 'Paid', pending: 'Pending', failed: 'Failed', refunded: 'Refunded', active: 'Active', published: 'Published', scheduled: 'Scheduled',
};
export const toLocalInput = (d) => { // ISO -> value for <input type="datetime-local"> in the browser's zone
  if (!d) return '';
  const x = new Date(d); x.setMinutes(x.getMinutes() - x.getTimezoneOffset());
  return x.toISOString().slice(0, 16);
};
