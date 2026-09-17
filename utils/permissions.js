// Checks whether the user running a command holds the configured
// "Mizu Evaluation Team" role (or is a server Administrator, as a
// sensible fallback so owners aren't locked out if the role isn't set up yet).
function hasEvaluatorRole(interaction) {
  const roleId = process.env.EVALUATOR_ROLE_ID;
  if (!interaction.member) return false;

  if (interaction.member.permissions?.has('Administrator')) return true;
  if (!roleId) return false;

  return interaction.member.roles.cache.has(roleId);
}

module.exports = { hasEvaluatorRole };
