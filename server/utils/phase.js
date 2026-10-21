// Derives the public-facing tournament phase from stored lifecycle + dates + slots.
function computePhase(t, now = new Date()) {
  if (t.status === 'draft') return 'draft';
  if (t.status === 'cancelled') return 'cancelled';
  if (t.status === 'completed') return 'completed';
  if (now >= t.tournamentStart) return 'live';
  if (t.isPaused) return 'paused';
  if (now < t.registrationStart) return 'upcoming';
  if (t.reservedSlots >= t.maxTeams) return 'full';
  if (now < t.registrationEnd) return 'registration_open';
  return 'registration_closed';
}
function computeFee(entryFee, platformPct = 0, taxPct = 0) {
  const base = Math.round(entryFee * 100);
  const platform = Math.round((base * platformPct) / 100);
  const tax = Math.round(((base + platform) * taxPct) / 100);
  return { entryFee: base, platformFee: platform, tax, total: base + platform + tax }; // paise
}
module.exports = { computePhase, computeFee };
