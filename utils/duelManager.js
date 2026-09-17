// Tracks duels that are currently "in flight" (pending accept, on cooldown,
// or awaiting result reports), keyed by each participant's user ID so a
// person can't be dragged into two overlapping duels at once, and so a
// duel can be looked up and cancelled by either participant.
//
// This is intentionally in-memory only — a bot restart clears any stuck
// duels, which is the safe failure mode (nobody's FLOW gets double-counted).
//
// `context` is a plain object owned by commands/duel.js. It's expected to
// have at least `challenger` and `opponent` (Discord User objects); duel.js
// attaches whatever else it needs (collectors, timeouts, message refs) to
// the same object.

const activeDuels = new Map(); // userId -> context

function isBusy(userId) {
  return activeDuels.has(userId);
}

function getActiveDuel(userId) {
  return activeDuels.get(userId);
}

function lock(context) {
  activeDuels.set(context.challenger.id, context);
  activeDuels.set(context.opponent.id, context);
}

function unlock(context) {
  activeDuels.delete(context.challenger.id);
  activeDuels.delete(context.opponent.id);
}

module.exports = { isBusy, getActiveDuel, lock, unlock };
