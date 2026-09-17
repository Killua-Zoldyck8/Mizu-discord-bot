const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const db = require('../database');
const { formatTier } = require('../utils/tiers');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('flow')
    .setDescription("View your or another member's FLOW rating.")
    .addUserOption((opt) =>
      opt.setName('user').setDescription('Whose FLOW to look up (defaults to you)').setRequired(false),
    ),

  async execute(interaction) {
    const target = interaction.options.getUser('user') || interaction.user;
    const rec = db.getUser(target.id, target.username);

    const embed = new EmbedBuilder()
      .setColor(0x87CEEB)
      .setTitle(`🌊 ${target.username}'s FLOW`)
      .setThumbnail(target.displayAvatarURL())
      .addFields(
        { name: 'FLOW', value: `${rec.flow}`, inline: true },
        { name: 'Tier', value: formatTier(rec.flow), inline: true },
        { name: 'Record', value: `${rec.wins}W - ${rec.losses}L`, inline: true },
      );

    return interaction.reply({ embeds: [embed] });
  },
};
