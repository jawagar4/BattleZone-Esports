const express = require('express');
const v = require('../middleware/validate');
const s = require('../validators');
const rl = require('../middleware/rateLimit');
const { authenticate, requireAdmin } = require('../middleware/auth');
const { uploadImage } = require('../middleware/upload');
const auth = require('../controllers/authController');
const users = require('../controllers/userController');
const teams = require('../controllers/teamController');
const tournaments = require('../controllers/tournamentController');
const registrations = require('../controllers/registrationController');
const payments = require('../controllers/paymentController');
const admin = require('../controllers/adminController');

const router = express.Router();

/* Auth */
const a = express.Router();
a.post('/register', rl.auth, v({ body: s.register }), auth.register);
a.post('/login', rl.auth, v({ body: s.login }), auth.login);
a.post('/logout', auth.logout);
a.post('/forgot-password', rl.auth, v({ body: s.forgot }), auth.forgotPassword);
a.post('/reset-password', rl.auth, v({ body: s.reset }), auth.resetPassword);
a.post('/verify-email', rl.auth, v({ body: s.verifyEmail }), auth.verifyEmail);
a.post('/resend-verification', authenticate, rl.auth, auth.resendVerification);
a.get('/me', authenticate, auth.me);
router.use('/auth', a);

/* Users + notifications */
router.get('/users/profile', authenticate, users.getProfile);
router.patch('/users/profile', authenticate, v({ body: s.profile }), users.updateProfile);
router.get('/users/dashboard', authenticate, users.dashboard);
router.get('/notifications', authenticate, users.listNotifications);
router.post('/notifications/read-all', authenticate, users.markAllRead);
router.patch('/notifications/:id/read', authenticate, v({ params: s.id }), users.markRead);

/* Teams */
router.post('/teams', authenticate, v({ body: s.teamCreate }), teams.create);
router.get('/teams/my-teams', authenticate, teams.mine);
router.get('/teams/:id', authenticate, v({ params: s.id }), teams.get);
router.patch('/teams/:id', authenticate, v({ params: s.id, body: s.teamUpdate }), teams.update);
router.delete('/teams/:id', authenticate, v({ params: s.id }), teams.remove);
router.post('/teams/:id/logo', authenticate, v({ params: s.id }), uploadImage, teams.uploadLogo);
router.post('/teams/:id/members', authenticate, v({ params: s.id, body: s.member }), teams.addMember);
router.patch('/teams/:id/members/:memberId', authenticate, v({ params: s.memberParams, body: s.member }), teams.updateMember);
router.delete('/teams/:id/members/:memberId', authenticate, v({ params: s.memberParams }), teams.removeMember);

/* Tournaments */
router.get('/tournaments', v({ query: s.listQuery }), tournaments.list);
router.get('/tournaments/meta/games', tournaments.games);
router.get('/tournaments/:id', v({ params: s.id }), tournaments.get);
router.get('/tournaments/:id/teams', v({ params: s.id }), tournaments.publicTeams);
router.post('/tournaments/:id/register', authenticate, v({ params: s.id, body: s.registerTeam }), tournaments.register);
router.get('/tournaments/:id/registrations', ...requireAdmin, v({ params: s.id, query: s.listQuery }), tournaments.registrations);

/* Registrations */
router.get('/registrations/my', authenticate, registrations.mine);
router.get('/registrations/:id', authenticate, v({ params: s.id }), registrations.get);
router.delete('/registrations/:id', authenticate, v({ params: s.id }), registrations.cancelUnpaid);

/* Payments (webhook is mounted in app.js with a raw body parser) */
router.post('/payments/create-order', authenticate, rl.payments, v({ body: s.createOrder }), payments.createOrder);
router.post('/payments/verify', authenticate, rl.payments, v({ body: s.verifyPayment }), payments.verify);
router.get('/payments/history', authenticate, v({ query: s.listQuery }), payments.history);
router.get('/payments/:id/receipt', authenticate, v({ params: s.id }), payments.receipt);

/* Admin: every route sits behind authenticate + requireRole('admin') */
const ad = express.Router();
ad.use(...requireAdmin);
ad.get('/dashboard', admin.dashboard);
ad.get('/tournaments', v({ query: s.listQuery }), admin.listTournaments);
ad.post('/tournaments', v({ body: s.tournament }), admin.createTournament);
ad.get('/tournaments/:id', v({ params: s.id }), admin.getTournament);
ad.patch('/tournaments/:id', v({ params: s.id, body: s.tournament.partial() }), admin.updateTournament);
ad.delete('/tournaments/:id', v({ params: s.id }), admin.deleteTournament);
ad.post('/tournaments/:id/banner', v({ params: s.id }), uploadImage, admin.uploadBanner);
ad.get('/tournaments/:id/matches', v({ params: s.id }), admin.listMatches);
ad.post('/tournaments/:id/matches', v({ params: s.id, body: s.match }), admin.createMatch);
ad.post('/tournaments/:id/matches/generate', v({ params: s.id }), admin.generateMatches);
ad.patch('/tournaments/:id/matches/:matchId', v({ params: s.memberParams.extend({ matchId: s.id.shape.id }).omit({ memberId: true }), body: s.match }), admin.updateMatch);
ad.post('/registrations/:id/approve', v({ params: s.id }), admin.approveRegistration);
ad.post('/registrations/:id/reject', v({ params: s.id, body: s.cancelReg }), admin.rejectRegistration);
ad.post('/registrations/:id/cancel', v({ params: s.id, body: s.cancelReg }), admin.cancelRegistration);
ad.get('/teams', v({ query: s.listQuery }), admin.listTeams);
ad.get('/teams/export', v({ query: s.listQuery }), admin.exportTeams);
ad.get('/teams/:id', v({ params: s.id }), admin.getTeam);
ad.patch('/teams/:id', v({ params: s.id, body: s.adminTeamUpdate }), admin.updateTeam);
ad.get('/payments', v({ query: s.listQuery }), admin.listPayments);
ad.get('/payments/export', v({ query: s.listQuery }), admin.exportPayments);
ad.post('/payments/:id/reconcile', v({ params: s.id }), admin.reconcilePayment);
ad.post('/payments/:id/refund', v({ params: s.id, body: s.refund }), admin.refundPayment);
ad.get('/users', v({ query: s.listQuery }), admin.listUsers);
ad.get('/users/:id', v({ params: s.id }), admin.getUser);
ad.patch('/users/:id', v({ params: s.id, body: s.adminUserUpdate }), admin.updateUser);
ad.get('/audit-logs', v({ query: s.listQuery }), admin.auditLogs);
router.use('/admin', ad);

module.exports = router;
