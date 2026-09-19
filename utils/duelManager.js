// Tracks duels that are currently "in flight" (pending accept, on cooldown,
// or awaiting result reports), keyed by each participant's user ID so a
// person can't be dragged into two overlapping duels at once, and so a
// duel can be looked up and cancelled by any participant.
//
// This is intentionally in-memory only — a bot restart clears any stuck
// duels, which is the safe failure mode (nobody's FLOW gets double-counted).
//
// `context` is a plain object owned by commands/duel.js (and reused by
// commands/openchallenge.js). It's expected to have at least `challenger`
// (a Discord User) and `opponent` (a Discord User, or null for an open
// challenge nobody has accepted yet); duel.js attaches whatever else it
// needs (collectors, timeouts, message refs) to the same object.

const activeDuels = new Map(); // userId -> context

function isBusy(userId) {
  return activeDuels.has(userId);
}

function getActiveDuel(userId) {
  return activeDuels.get(userId);
}

/**
 * Associates one or more user IDs with a duel context. If `userIds` is
 * omitted, defaults to [challenger.id, opponent.id] (skipping opponent if
 * it's not set yet) — which covers the normal /duel case where both
 * participants are known upfront. /openchallenge instead locks just the
 * challenger at first, then calls lock(context, [opponentId]) again once
 * someone accepts.
 */
function lock(context, userIds) {
  const ids = userIds || [context.challenger?.id, context.opponent?.id].filter(Boolean);
  for (const id of ids) activeDuels.set(id, context);
}

/** Removes every mapping currently pointing at this exact context object. */
function unlock(context) {
  for (const [id, ctx] of activeDuels) {
    if (ctx === context) activeDuels.delete(id);
  }
}

module.exports = { isBusy, getActiveDuel, lock, unlock };

