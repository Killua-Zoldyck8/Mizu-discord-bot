const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const db = require('../database');
const { hasEvaluatorRole } = require('../utils/permissions');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('l')
    .setDescription("(authorized person only) Set a player's loss count directly.")
    .addUserOption((opt) => opt.setName('user').setDescription('Who to adjust').setRequired(true))
    .addIntegerOption((opt) =>
      opt.setName('amount').setDescription('New loss count (replaces the old one)').setRequired(true).setMinValue(0),
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

    const rec = db.setLosses(target.id, amount);

    const embed = new EmbedBuilder()
      .setColor(0xe74c3c)
      .setDescription(
        `${interaction.user} set ${target}'s loss count to **${rec.losses}**.\n` +
          `Record is now **${rec.wins}W - ${rec.losses}L**.`,
      );

    return interaction.reply({ embeds: [embed] });
  },
};
