const { Server } = require('socket.io');
const jwt = require('jsonwebtoken');
const cookie = require('cookie');
const config = require('../config/env');
const User = require('../models/User');

let io = null;

function initSockets(httpServer) {
  
    const allowedOrigins = [
    ...new Set([
      ...String(config.CLIENT_URL || "")
        .split(",")
        .map((origin) => origin.trim())
        .filter(Boolean),
      "https://battle-zone-esports.vercel.app",
      "http://localhost:5173",
    ]),
  ];
   io = new Server(httpServer, {
    cors: {
      origin: allowedOrigins,
      methods: ["GET", "POST"],
      credentials: true,
    },
  });

  io.use(async (socket, next) => {
    try {
      const token = cookie.parse(socket.request.headers.cookie || '').token;
      if (!token) return next(); // anonymous sockets may watch public tournament rooms
      const payload = jwt.verify(token, config.JWT_SECRET);
      const user = await User.findById(payload.sub).select('+tokenVersion role accountStatus');
      if (user && user.accountStatus === 'active' && user.tokenVersion === payload.tv) socket.user = user;
      next();
    } catch { next(); }
  });

  io.on('connection', (socket) => {
    if (socket.user) {
      socket.join(`user:${socket.user.id}`);
      if (socket.user.role === 'admin') socket.join('admins');
    }
    socket.on('tournament:join', (id) => { if (typeof id === 'string' && id.length < 40) socket.join(`tournament:${id}`); });
    socket.on('tournament:leave', (id) => socket.leave(`tournament:${id}`));
  });
  return io;
}

const getIO = () => io;
const emitToUser = (userId, event, payload) => io && io.to(`user:${userId}`).emit(event, payload);
const emitToTournament = (id, event, payload) => io && io.to(`tournament:${id}`).emit(event, payload);
const emitToAdmins = (event, payload) => io && io.to('admins').emit(event, payload);

module.exports = { initSockets, getIO, emitToUser, emitToTournament, emitToAdmins };
