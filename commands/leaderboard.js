const {
  SlashCommandBuilder,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ComponentType,
} = require('discord.js');
const db = require('../database');
const { formatTier } = require('../utils/tiers');

const MEDALS = ['🥇', '🥈', '🥉'];
const PAGE_SIZE = 10;
const BUTTON_TIMEOUT_MS = 5 * 60 * 1000; // how long the Prev/Next buttons stay live

module.exports = {
  data: new SlashCommandBuilder()
    .setName('leaderboard')
    .setDescription('Show the top FLOW rankings in the clan.')
    .addIntegerOption((opt) =>
      opt
        .setName('page')
        .setDescription('Page number (10 per page), defaults to 1')
        .setRequired(false)
        .setMinValue(1),
    ),

  async execute(interaction) {
    await interaction.deferReply();

    const all = db.getLeaderboard();
    if (all.length === 0) {
      return interaction.editReply('No FLOW records yet — get some duels going!');
    }

    const totalPages = Math.ceil(all.length / PAGE_SIZE);
    const requestedPage = interaction.options.getInteger('page') || 1;

    if (requestedPage > totalPages) {
      return interaction.editReply(`There's no page ${requestedPage}. The leaderboard only has ${all.length} ranked members.`);
    }

    let page = requestedPage;
    const { embed, row } = await buildPage(interaction, page);
    const message = await interaction.editReply({ embeds: [embed], components: row ? [row] : [] });

    if (!row) return; // only one page — no buttons needed

    const collector = message.createMessageComponentCollector({
      componentType: ComponentType.Button,
      time: BUTTON_TIMEOUT_MS,
    });

    collector.on('collect', async (i) => {
      if (i.customId === 'lb_prev') page -= 1;
      if (i.customId === 'lb_next') page += 1;

      const { embed: newEmbed, row: newRow } = await buildPage(interaction, page);
      await i.update({ embeds: [newEmbed], components: newRow ? [newRow] : [] });
    });

    collector.on('end', () => {
      message.edit({ components: [] }).catch(() => {});
    });
  },
};

/**
 * Builds the embed + Prev/Next button row for a given page. Re-reads the
 * leaderboard from the DB each time so navigating stays up to date with
 * any duels/adjustments that happened while the message is open.
 */
async function buildPage(interaction, page) {
  const all = db.getLeaderboard();
  const totalPages = Math.max(1, Math.ceil(all.length / PAGE_SIZE));
  const clampedPage = Math.min(Math.max(page, 1), totalPages);

  const start = (clampedPage - 1) * PAGE_SIZE;
  const slice = all.slice(start, start + PAGE_SIZE);

  const lines = await Promise.all(
    slice.map(async ([userId, rec], i) => {
      const rank = start + i + 1;
      const medal = MEDALS[rank - 1] || `**${rank}.**`;
      let name = rec.username;
      try {
        const user = await interaction.client.users.fetch(userId);
        name = user.username;
      } catch {
        name = name || `Unknown (${userId})`;
      }
      return `${medal} ${name} — **${rec.flow} FLOW** (${formatTier(rec.flow)})`;
    }),
  );

  const embed = new EmbedBuilder()
    .setColor(0x9b59b6)
    .setTitle('🏆 Mizu FLOW Leaderboard')
    .setDescription(lines.join('\n') || 'Nothing on this page.')
    .setFooter({ text: `Page ${clampedPage} of ${totalPages} • ${all.length} ranked members` });

  if (totalPages <= 1) {
    return { embed, row: null };
  }

  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId('lb_prev')
      .setLabel('◀ Previous')
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(clampedPage <= 1),
    new ButtonBuilder()
      .setCustomId('lb_next')
      .setLabel('Next ▶')
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(clampedPage >= totalPages),
  );

  return { embed, row };
}
