const { SlashCommandBuilder } = require('discord.js');
const duelManager = require('../utils/duelManager');
const { hasEvaluatorRole } = require('../utils/permissions');
const { cancelDuel } = require('./duel');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('cancelduel')
    .setDescription('Cancel your current duel, at any stage, so you can start a new one.'),

  async execute(interaction) {
    const context = duelManager.getActiveDuel(interaction.user.id);

    if (!context) {
      return interaction.reply({ content: "You don't have an active duel to cancel.", ephemeral: true });
    }

    const isParticipant =
      interaction.user.id === context.challenger.id || interaction.user.id === context.opponent.id;
    if (!isParticipant && !hasEvaluatorRole(interaction)) {
      return interaction.reply({ content: "You can only cancel a duel you're part of.", ephemeral: true });
    }

    const cancelled = await cancelDuel(context, interaction.user);
    if (!cancelled) {
      return interaction.reply({
        content: 'That duel just resolved or was already being cancelled — nothing to do.',
        ephemeral: true,
      });
    }

    return interaction.reply({
      content: `Duel cancelled. ${context.challenger.username} and ${context.opponent.username} are both free to start new duels.`,
      ephemeral: true,
    });
  },
};
