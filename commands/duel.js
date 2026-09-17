const {
  SlashCommandBuilder,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ComponentType,
} = require('discord.js');
const db = require('../database');
const duelManager = require('../utils/duelManager');
const { formatTier } = require('../utils/tiers');
const { computeFlowChange } = require('../utils/flowCalculator');

const ACCEPT_TIMEOUT_MS = 60 * 1000; // time the opponent has to accept/decline
const RESULT_COOLDOWN_MS = 60 * 1000; // "go fight, come back in a minute" cooldown

module.exports = {
  data: new SlashCommandBuilder()
    .setName('duel')
    .setDescription('Challenge another Mizu clan member to a FLOW duel.')
    .addUserOption((opt) =>
      opt.setName('opponent').setDescription('Who do you want to duel?').setRequired(true),
    ),

  async execute(interaction) {
    const challenger = interaction.user;
    const opponent = interaction.options.getUser('opponent');

    if (opponent.id === challenger.id) {
      return interaction.reply({ content: "You can't duel yourself.", ephemeral: true });
    }
    if (opponent.bot) {
      return interaction.reply({ content: "You can't duel a bot.", ephemeral: true });
    }
    if (duelManager.isBusy(challenger.id)) {
      return interaction.reply({
        content: 'You already have a duel in progress. Finish that one first, or use /cancelduel.',
        ephemeral: true,
      });
    }
    if (duelManager.isBusy(opponent.id)) {
      return interaction.reply({
        content: `${opponent.username} already has a duel in progress. Try again shortly.`,
        ephemeral: true,
      });
    }

    // `context` is the single shared object for this duel's lifetime. It's
    // registered with duelManager (keyed by both participants) so /cancelduel
    // can find it and tear down whatever stage is currently active.
    const context = {
      challenger,
      opponent,
      stage: 'pending_accept',
      cancelled: false,
      acceptCollector: null,
      cooldownTimeout: null,
      resultCollector: null,
      challengeMessage: null,
      resultMessage: null,
    };
    duelManager.lock(context);

    const challengeEmbed = new EmbedBuilder()
      .setColor(0x3498db)
      .setTitle('🌊 FLOW Duel Challenge')
      .setDescription(
        `${challenger} has challenged ${opponent} to a FLOW duel!\n\n` +
          `${opponent}, do you accept?`,
      )
      .setFooter({ text: 'This request expires in 60 seconds.' });

    const acceptRow = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId('duel_accept').setLabel('Accept').setStyle(ButtonStyle.Success),
      new ButtonBuilder().setCustomId('duel_decline').setLabel('Decline').setStyle(ButtonStyle.Danger),
    );

    const challengeMessage = await interaction.reply({
      content: `${opponent}`,
      embeds: [challengeEmbed],
      components: [acceptRow],
      fetchReply: true,
    });
    context.challengeMessage = challengeMessage;

    const acceptCollector = challengeMessage.createMessageComponentCollector({
      componentType: ComponentType.Button,
      time: ACCEPT_TIMEOUT_MS,
      max: 1,
      filter: (i) => {
        if (i.user.id !== opponent.id) {
          i.reply({ content: 'This duel request is not for you.', ephemeral: true });
          return false;
        }
        return true;
      },
    });
    context.acceptCollector = acceptCollector;

    acceptCollector.on('collect', async (i) => {
      if (i.customId === 'duel_decline') {
        duelManager.unlock(context);
        await i.update({
          content: '',
          embeds: [
            EmbedBuilder.from(challengeEmbed)
              .setColor(0xe74c3c)
              .setDescription(`${opponent} declined the duel from ${challenger}.`)
              .setFooter(null),
          ],
          components: [],
        });
        return;
      }

      // Accepted
      context.stage = 'cooldown';
      await i.update({
        content: '',
        embeds: [
          EmbedBuilder.from(challengeEmbed)
            .setColor(0x2ecc71)
            .setDescription(
              `${opponent} accepted the duel from ${challenger}! ⚔️\n\n` +
                `Duel has started. Come back here after your fight is over to report the result.`,
            )
            .setFooter(null),
        ],
        components: [],
      });

      startResultPhase(interaction, context);
    });

    acceptCollector.on('end', (collected, reason) => {
      if (reason === 'cancelled') return; // already handled by cancelDuel()
      if (collected.size === 0) {
        duelManager.unlock(context);
        interaction
          .editReply({
            content: '',
            embeds: [
              EmbedBuilder.from(challengeEmbed)
                .setColor(0x95a5a6)
                .setDescription(`Duel request from ${challenger} to ${opponent} expired.`)
                .setFooter(null),
            ],
            components: [],
          })
          .catch(() => {});
      }
    });
  },

  // Exposed so /cancelduel can tear down a duel at whatever stage it's in.
  cancelDuel,
};

function startResultPhase(interaction, context) {
  const { challenger, opponent } = context;

  context.cooldownTimeout = setTimeout(async () => {
    if (context.cancelled) return; // cancelled mid-cooldown, nothing more to do

    context.stage = 'awaiting_results';
    const reportMinutes = db.getReportTimeoutMinutes();

    const resultEmbed = new EmbedBuilder()
      .setColor(0xf39c12)
      .setTitle('🌊 Result')
      .setDescription(
        `${challenger} vs ${opponent}\n\n` +
          `Both players: choose your outcome. FLOW updates automatically. ` +
          `If you both claim the same thing, FLOW doesn't change for anyone. ` +
          `In that case, if you have proof of the outcome, inform it to our staff.`,
      )
      .setFooter({ text: `You have ${reportMinutes} minute${reportMinutes === 1 ? '' : 's'} to report.` });

    const resultRow = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId('duel_won').setLabel('I Won').setStyle(ButtonStyle.Success),
      new ButtonBuilder().setCustomId('duel_lost').setLabel('I Lost').setStyle(ButtonStyle.Danger),
    );

    const resultMessage = await interaction.channel.send({
      content: `${challenger} ${opponent}`,
      embeds: [resultEmbed],
      components: [resultRow],
    });
    context.resultMessage = resultMessage;

    const responses = new Map(); // userId -> 'won' | 'lost'

    const resultCollector = resultMessage.createMessageComponentCollector({
      componentType: ComponentType.Button,
      time: db.getReportTimeoutMs(),
      filter: (i) => i.user.id === challenger.id || i.user.id === opponent.id,
    });
    context.resultCollector = resultCollector;

    resultCollector.on('collect', async (i) => {
      if (responses.has(i.user.id)) {
        await i.reply({ content: 'You already submitted your result for this duel.', ephemeral: true });
        return;
      }

      const choice = i.customId === 'duel_won' ? 'won' : 'lost';
      responses.set(i.user.id, choice);
      await i.reply({ content: `Recorded: you reported **${choice === 'won' ? 'a win' : 'a loss'}**.`, ephemeral: true });

      if (responses.size === 2) {
        resultCollector.stop('both_reported');
      }
    });

    resultCollector.on('end', async (collected, reason) => {
      if (reason === 'cancelled') return; // already handled by cancelDuel()
      duelManager.unlock(context);

      if (reason !== 'both_reported') {
        await resultMessage
          .edit({
            embeds: [
              EmbedBuilder.from(resultEmbed)
                .setColor(0x95a5a6)
                .setDescription(
                  `${challenger} vs ${opponent} — duel result was not fully reported in time. No FLOW changes made. Use /duel to start a fresh one.`,
                )
                .setFooter(null),
            ],
            components: [],
          })
          .catch(() => {});
        return;
      }

      const challengerChoice = responses.get(challenger.id);
      const opponentChoice = responses.get(opponent.id);

      let outcomeText;
      let color = 0x95a5a6;

      if (challengerChoice === opponentChoice) {
        // Both said "won" or both said "lost" — contradictory, no changes.
        outcomeText =
          challengerChoice === 'won'
            ? `Both ${challenger} and ${opponent} claimed victory. Results conflict - no FLOW changes made.`
            : `Both ${challenger} and ${opponent} claimed a loss. Results conflict - no FLOW changes made.`;
      } else {
        const winner = challengerChoice === 'won' ? challenger : opponent;
        const loser = challengerChoice === 'won' ? opponent : challenger;

        // FLOW awards scale with the pre-duel rating gap, so a strong
        // player beating a much weaker one earns little, and an upset
        // by the lower-rated player earns a lot. Read flows BEFORE
        // applying any change.
        const winnerBefore = db.getUser(winner.id);
        const loserBefore = db.getUser(loser.id);
        const { winnerDelta, loserDelta, wasUnderdog } = computeFlowChange(winnerBefore.flow, loserBefore.flow);

        const winnerRec = db.addFlow(winner.id, winnerDelta, { win: true });
        const loserRec = db.addFlow(loser.id, loserDelta, { loss: true });

        color = 0x2ecc71;
        outcomeText =
          `🏆 **${winner.username} won the duel!**${wasUnderdog ? ' 🐺 Underdog victory!' : ''}\n\n` +
          `${winner} +${winnerDelta} FLOW → **${winnerRec.flow}** (${formatTier(winnerRec.flow)})\n` +
          `${loser} ${loserDelta} FLOW → **${loserRec.flow}** (${formatTier(loserRec.flow)})`;
      }

      await resultMessage
        .edit({
          embeds: [
            EmbedBuilder.from(resultEmbed).setColor(color).setDescription(outcomeText).setFooter(null),
          ],
          components: [],
        })
        .catch(() => {});
    });
  }, RESULT_COOLDOWN_MS);
}

/**
 * Cancels a duel at whatever stage it's currently in (pending accept,
 * on cooldown, or awaiting result reports). Stops any live collector,
 * clears the cooldown timer if it hasn't fired yet, unlocks both
 * participants, and edits the most recent duel message to reflect the
 * cancellation. Returns false if the duel was already resolved/cancelled.
 */
async function cancelDuel(context, canceledBy) {
  if (context.cancelled) return false;
  context.cancelled = true;

  if (context.cooldownTimeout) clearTimeout(context.cooldownTimeout);
  if (context.acceptCollector && !context.acceptCollector.ended) context.acceptCollector.stop('cancelled');
  if (context.resultCollector && !context.resultCollector.ended) context.resultCollector.stop('cancelled');

  duelManager.unlock(context);

  const cancelEmbed = new EmbedBuilder()
    .setColor(0x95a5a6)
    .setTitle('🌊 Duel Cancelled')
    .setDescription(
      `The duel between ${context.challenger} and ${context.opponent} was cancelled by ${canceledBy}. No FLOW changes made.`,
    );

  const targetMessage = context.resultMessage || context.challengeMessage;
  if (targetMessage) {
    await targetMessage.edit({ content: '', embeds: [cancelEmbed], components: [] }).catch(() => {});
  }

  return true;
}
