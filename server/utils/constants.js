module.exports = {
  ROLES: ['player', 'admin'],
  // Statuses that hold a tournament slot.
  ACTIVE_REG_STATUSES: ['pending_payment', 'pending_approval', 'confirmed', 'suspended'],
  REG_STATUSES: ['pending_payment', 'pending_approval', 'confirmed', 'suspended', 'cancelled', 'rejected', 'expired'],
  PAYMENT_STATUSES: ['pending', 'success', 'failed', 'refunded'],
  TOURNAMENT_LIFECYCLE: ['draft', 'published', 'cancelled', 'completed'],
  GAMES: [
    { key: 'bgmi', name: 'BGMI', sizes: [1, 2, 4], teamsPerMatch: 25 },
    { key: 'free-fire', name: 'Free Fire', sizes: [1, 2, 4], teamsPerMatch: 12 },
    { key: 'valorant', name: 'Valorant', sizes: [5, 6], teamsPerMatch: 2 },
    { key: 'cs2', name: 'Counter-Strike 2', sizes: [5, 6], teamsPerMatch: 2 },
    { key: 'codm', name: 'Call of Duty Mobile', sizes: [1, 2, 3, 4, 5], teamsPerMatch: 2 },
    { key: 'other', name: 'Other', sizes: [1, 2, 3, 4, 5, 6], teamsPerMatch: 2 },
  ],
};
