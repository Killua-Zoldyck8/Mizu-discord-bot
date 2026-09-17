// Dynamic FLOW awards based on the gap between the two duelists' ratings,
// so a high-FLOW player can't just farm easy wins off much weaker members.
// Brackets are keyed by |flowA - flowB|; each bracket defines separate
// win/loss amounts depending on whether the winner was the higher- or
// lower-rated player going in. `min` thresholds are checked highest-first.
const BRACKETS = [
  { min: 300, higherWin: 1, higherLoss: -7, lowerWin: 8, lowerLoss: -1 },
  { min: 250, higherWin: 1, higherLoss: -7, lowerWin: 8, lowerLoss: -1 },
  { min: 200, higherWin: 2, higherLoss: -6, lowerWin: 8, lowerLoss: -1 },
  { min: 150, higherWin: 2, higherLoss: -6, lowerWin: 8, lowerLoss: -1 },
  { min: 100, higherWin: 3, higherLoss: -5, lowerWin: 7, lowerLoss: -1 },
  { min: 50, higherWin: 4, higherLoss: -4, lowerWin: 6, lowerLoss: -2 },
  { min: 0, higherWin: 5, higherLoss: -3, lowerWin: 5, lowerLoss: -3 },
];

function getBracket(diff) {
  for (const bracket of BRACKETS) {
    if (diff >= bracket.min) return bracket;
  }
  return BRACKETS[BRACKETS.length - 1];
}

/**
 * Given the pre-duel FLOW of the winner and loser, returns
 * { winnerDelta, loserDelta, wasUnderdog } for that result.
 * `wasUnderdog` is true when the winner had the lower FLOW going in
 * (equal FLOW is treated as neither side being the underdog).
 */
function computeFlowChange(winnerFlow, loserFlow) {
  const diff = Math.abs(winnerFlow - loserFlow);
  const bracket = getBracket(diff);

  if (winnerFlow > loserFlow) {
    return { winnerDelta: bracket.higherWin, loserDelta: bracket.higherLoss, wasUnderdog: false };
  }
  if (winnerFlow < loserFlow) {
    return { winnerDelta: bracket.lowerWin, loserDelta: bracket.lowerLoss, wasUnderdog: true };
  }
  // Equal FLOW: falls in the 0-49 bracket anyway, higher/lower values match.
  return { winnerDelta: bracket.higherWin, loserDelta: bracket.higherLoss, wasUnderdog: false };
}

module.exports = { BRACKETS, getBracket, computeFlowChange };
