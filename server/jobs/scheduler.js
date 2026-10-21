const config = require('../config/env');
const logger = require('../utils/logger');
const Tournament = require('../models/Tournament');
const Registration = require('../models/Registration');
const Match = require('../models/Match');
const { computePhase } = require('../utils/phase');
const { notifyMany } = require('../services/notify');
const { releaseRegistration } = require('../services/registrationService');
const { generateSchedule } = require('../services/scheduleService');
const { emitToTournament } = require('../sockets');

const fmt = (d, tz) => d.toLocaleString('en-IN', { timeZone: tz || config.DEFAULT_TIMEZONE, dateStyle: 'medium', timeStyle: 'short' });
const captainsOf = async (tournamentId, statuses = ['confirmed']) =>
  (await Registration.find({ tournamentId, status: { $in: statuses } }).select('captainId').lean()).map((r) => r.captainId);

// 1. Unpaid holds that ran out give their slot back.
async function expireHolds(now) {
  const stale = await Registration.find({ status: 'pending_payment', holdExpiresAt: { $lt: now } }).select('_id').limit(200).lean();
  for (const r of stale) await releaseRegistration(r._id, 'expired');
  return stale.length;
}

// 2. Phase transitions, reminders and schedule generation. All state lives in MongoDB, so a restart
//    simply picks up where it left off; every write is conditional so duplicate ticks are harmless.
async function processTournaments(now) {
  const tournaments = await Tournament.find({ status: 'published' });
  for (const t of tournaments) {
    const phase = computePhase(t, now);
    if (phase !== t.lastPhase) {
      const claimed = await Tournament.findOneAndUpdate({ _id: t._id, lastPhase: t.lastPhase ?? null }, { lastPhase: phase }, { returnDocument: 'after' });
      if (claimed) {
        emitToTournament(String(t._id), 'tournament:update', { id: String(t._id), phase, reservedSlots: t.reservedSlots, availableSlots: t.availableSlots });
        if (phase === 'live') await notifyMany(await captainsOf(t._id), `${t.name} is live`, `The tournament has started. Check your match schedule and room details.`, `/tournaments/${t._id}`);
        if (phase === 'registration_closed' || phase === 'full') {
          if (t.autoGenerateSchedule && !t.scheduleGenerated) {
            const n = await generateSchedule(claimed);
            if (n) await notifyMany(await captainsOf(t._id), 'Match schedule published', `${t.name}: ${n} matches have been scheduled.`, `/tournaments/${t._id}`);
          }
        }
      }
    }
    // Start-time reminders (e.g. 60 and 15 minutes before).
    for (const mins of t.reminderMinutes) {
      const fireAt = t.tournamentStart.getTime() - mins * 60000;
      if (now.getTime() >= fireAt && now < t.tournamentStart && !t.remindersSent.includes(mins)) {
        const won = await Tournament.updateOne({ _id: t._id, remindersSent: { $ne: mins } }, { $push: { remindersSent: mins } });
        if (won.modifiedCount) await notifyMany(await captainsOf(t._id), `${t.name} starts in ${mins >= 60 ? mins / 60 + ' hour' + (mins >= 120 ? 's' : '') : mins + ' minutes'}`, `Kick-off is ${fmt(t.tournamentStart, t.timezone)}. Get your squad ready.`, `/tournaments/${t._id}`);
      }
    }
  }
}

// 3. Reminders for individual matches (15 minutes before).
async function matchReminders(now) {
  const soon = await Match.find({ status: 'scheduled', reminderSent: false, scheduledAt: { $lte: new Date(now.getTime() + 15 * 60000), $gt: now } }).limit(200);
  for (const m of soon) {
    const won = await Match.updateOne({ _id: m._id, reminderSent: false }, { reminderSent: true });
    if (!won.modifiedCount) continue;
    const regs = await Registration.find({ tournamentId: m.tournamentId, teamId: { $in: m.participatingTeams }, status: 'confirmed' }).select('captainId').lean();
    await notifyMany(regs.map((r) => r.captainId), 'Match starting soon', `${m.label || 'Your match'} starts at ${fmt(m.scheduledAt)}.`, `/tournaments/${m.tournamentId}`);
  }
}

async function tick() {
  const now = new Date();
  try {
    await expireHolds(now);
    await processTournaments(now);
    await matchReminders(now);
  } catch (err) { logger.error({ err }, 'scheduler tick failed'); }
}

let timer = null, queue = null, worker = null;
async function startScheduler() {
  if (config.isTest) return;
  if (config.REDIS_URL) {
    // Production: one repeatable BullMQ job. Redis guarantees it runs once per interval across all instances.
    const { Queue, Worker } = require('bullmq');
    const IORedis = require('ioredis');
    const connection = new IORedis(config.REDIS_URL, { maxRetriesPerRequest: null });
    queue = new Queue('battlezone-scheduler', { connection });
    await queue.add('tick', {}, { repeat: { every: config.SCHEDULER_INTERVAL_SECONDS * 1000 }, jobId: 'tick', removeOnComplete: true, removeOnFail: 50 });
    worker = new Worker('battlezone-scheduler', tick, { connection, concurrency: 1 });
    worker.on('failed', (_j, err) => logger.error({ err }, 'scheduler job failed'));
    logger.info('Scheduler running on BullMQ/Redis');
  } else {
    timer = setInterval(tick, config.SCHEDULER_INTERVAL_SECONDS * 1000);
    tick();
    logger.warn('REDIS_URL not set: using the in-process scheduler (fine for development, use Redis in production)');
  }
}
async function stopScheduler() {
  if (timer) clearInterval(timer);
  if (worker) await worker.close();
  if (queue) await queue.close();
}
module.exports = { startScheduler, stopScheduler, tick, expireHolds };
