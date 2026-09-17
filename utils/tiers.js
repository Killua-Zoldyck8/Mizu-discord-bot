// Tier thresholds, checked highest-first.
// Matches the Mizu FLOW spec exactly.
const TIERS = [
  { min: 1000, name: "Mizu's Elite", emoji: '👑' },
  { min: 800, name: 'S Tier', emoji: '🔴' },
  { min: 600, name: 'A Tier', emoji: '🟠' },
  { min: 400, name: 'B Tier', emoji: '🟡' },
  { min: 200, name: 'C Tier', emoji: '🟢' },
  { min: 0, name: 'D Tier', emoji: '🟤' },
];

/**
 * Returns the tier object { min, name, emoji } for a given FLOW value.
 * FLOW is clamped to 0 minimum elsewhere (in database.js), but this
 * function is defensive in case a negative value ever reaches it.
 */
function getTier(flow) {
  const safeFlow = Number.isFinite(flow) ? flow : 0;
  for (const tier of TIERS) {
    if (safeFlow >= tier.min) return tier;
  }
  return TIERS[TIERS.length - 1];
}

function formatTier(flow) {
  const tier = getTier(flow);
  return `${tier.emoji} ${tier.name}`;
}

module.exports = { TIERS, getTier, formatTier };
