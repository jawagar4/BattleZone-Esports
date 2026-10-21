// Mirrors server/utils/constants.js GAMES (names must match exactly).
export const GAMES = [
  { name: 'Free Fire', sizes: [1, 2, 4], colors: ['#f59e0b', '#7c2d12'], art: 'ring' },
  { name: 'BGMI', sizes: [1, 2, 4], colors: ['#ff7a18', '#7a1230'], art: 'flame' },
  { name: 'Clash Squrad', sizes: [5, 6], colors: ['#ff4655', '#1b0f2e'], art: 'chevron' },
];
export const gameMeta = (name) => GAMES.find((g) => g.name === name) || GAMES[GAMES.length - 1];
