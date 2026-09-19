const {
  SlashCommandBuilder,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ComponentType,
} = require('discord.js');
const duelManager = require('../utils/duelManager');
const { startResultPhase } = require('./duel');

// Open challenges sit out longer than a 1:1 /duel request (60s) since
// they're addressed to the whole clan, not one specific person.
const ACCEPT_TIMEOUT_MS = 5 * 60 * 1000;

const DEFAULT_MESSAGE =
  'has openly challenged the entire clan for a FLOW duel!\n\n' +
  "Got balls to accept their challenge?\n" +
  "Who's taking the fight? 🗡️🩸";

module.exports = {
  data: new SlashCommandBuilder()
    .setName('openchallenge')
    .setDescription('Challenge the whole clan to a FLOW duel — first person to accept fights you.')
    .addStringOption((opt) =>
      opt
        .setName('message')
        .setDescription('Custom challenge text (optional) — shown after your name')
        .setRequired(false)
        .setMaxLength(500),
    ),

  async execute(interaction) {
    const challenger = interaction.user;

    if (duelManager.isBusy(challenger.id)) {
      return interaction.reply({
        content: 'You already have a duel in progress. Finish that one first, or use /cancelduel.',
        ephemeral: true,
      });
    }

    // Only the challenger is locked for now — nobody has accepted yet.
    const context = {
      challenger,
      opponent: null,
      stage: 'open_pending',
      cancelled: false,
      acceptCollector: null,
      cooldownTimeout: null,
      resultCollector: null,
      challengeMessage: null,
      resultMessage: null,
    };
    duelManager.lock(context, [challenger.id]);

    const customMessage = interaction.options.getString('message');
    const bodyText = `${challenger} ${customMessage || DEFAULT_MESSAGE}`;

    const challengeEmbed = new EmbedBuilder()
      .setColor(0x3498db)
      .setTitle('🌊 Open FLOW Challenge')
      .setDescription(bodyText)
      .setFooter({ text: 'First person to click Accept fights. This expires in 5 minutes.' });

    const acceptRow = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId('open_accept').setLabel('Accept').setStyle(ButtonStyle.Success),
    );

    const challengeMessage = await interaction.reply({
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
        if (i.user.id === challenger.id) {
          i.reply({ content: "You can't accept your own challenge.", ephemeral: true });
          return false;
        }
        if (i.user.bot) return false;
        if (duelManager.isBusy(i.user.id)) {
          i.reply({ content: "You're already in a duel — finish or cancel that first.", ephemeral: true });
          return false;
        }
        return true;
      },
    });
    context.acceptCollector = acceptCollector;

    acceptCollector.on('collect', async (i) => {
      // Guard against a near-simultaneous double-accept.
      if (context.opponent) {
        await i.reply({ content: 'Someone already accepted this challenge.', ephemeral: true }).catch(() => {});
        return;
      }

      context.opponent = i.user;
      context.stage = 'cooldown';
      duelManager.lock(context, [i.user.id]);

      await i.update({
        embeds: [
          EmbedBuilder.from(challengeEmbed)
            .setColor(0x2ecc71)
            .setDescription(
              `${i.user} accepted ${challenger}'s open challenge! ⚔️\n\n` +
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
            embeds: [
              EmbedBuilder.from(challengeEmbed)
                .setColor(0x95a5a6)
                .setDescription(`${challenger}'s open challenge expired — nobody accepted.`)
                .setFooter(null),
            ],
            components: [],
          })
          .catch(() => {});
      }
    });
  },
};
