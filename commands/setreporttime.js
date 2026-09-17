const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const db = require('../database');
const { hasEvaluatorRole } = require('../utils/permissions');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('setreporttime')
    .setDescription('(Evaluators only) Set how many minutes players get to report a duel result.')
    .addIntegerOption((opt) =>
      opt
        .setName('minutes')
        .setDescription('New report window in minutes (1-30)')
        .setRequired(true)
        .setMinValue(1)
        .setMaxValue(30),
    ),

  async execute(interaction) {
    if (!hasEvaluatorRole(interaction)) {
      return interaction.reply({
        content: 'You need the Mizu Evaluation Team role to use this command.',
        ephemeral: true,
      });
    }

    const minutes = interaction.options.getInteger('minutes');
    db.setReportTimeoutMinutes(minutes);

    const embed = new EmbedBuilder()
      .setColor(0x3498db)
      .setDescription(
        `⏱️ Duel result report window is now **${minutes} minute${minutes === 1 ? '' : 's'}**.\n` +
          `This applies to duels started from now on — anything already in progress keeps its old window.`,
      );

    return interaction.reply({ embeds: [embed] });
  },
};
