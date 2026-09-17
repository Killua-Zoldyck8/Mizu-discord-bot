const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const db = require('../database');
const { formatTier } = require('../utils/tiers');
const { hasEvaluatorRole } = require('../utils/permissions');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('subflow')
    .setDescription('(authorized person only) Manually subtract FLOW from a member.')
    .addUserOption((opt) => opt.setName('user').setDescription('Who to adjust').setRequired(true))
    .addIntegerOption((opt) =>
      opt.setName('amount').setDescription('How much FLOW to subtract').setRequired(true).setMinValue(1),
    ),

  async execute(interaction) {
    if (!hasEvaluatorRole(interaction)) {
      return interaction.reply({
        content: 'You arent strong enough to do that lil bro.',
        ephemeral: true,
      });
    }

    const target = interaction.options.getUser('user');
    const amount = interaction.options.getInteger('amount');

    const rec = db.addFlow(target.id, -amount);

    const embed = new EmbedBuilder()
      .setColor(0xe74c3c)
      .setDescription(
        `${interaction.user} subtracted **-${amount} FLOW** from ${target}.\n` +
          `New total: **${rec.flow}** (${formatTier(rec.flow)})`,
      );

    return interaction.reply({ embeds: [embed] });
  },
};
