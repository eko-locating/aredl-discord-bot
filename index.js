require('dotenv').config();

const {
  Client,
  GatewayIntentBits,
  REST,
  Routes,
  SlashCommandBuilder,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle
} = require('discord.js');

const client = new Client({
  intents: [GatewayIntentBits.Guilds]
});


// AREDL API CONFIGURATION

const AREDL_LEVELS_API =
  'https://api.aredl.net/v2/api/aredl/levels?exclude_legacy=true&exclude_pending=true&exclude_removed=true';

const AREDL_PLAYERS_API =
  'https://api.aredl.net/v2/api/aredl/leaderboard';

const PER_PAGE = 10;

// DISCORD SLASH COMMANDS

const commands = [
  new SlashCommandBuilder()
    .setName('aredl')
    .setDescription('Explore the AREDL'),

  new SlashCommandBuilder()
    .setName('demons')
    .setDescription('Browse the AREDL demonlist'),

  new SlashCommandBuilder()
    .setName('players')
    .setDescription('Browse the AREDL player leaderboard'),

  new SlashCommandBuilder()
    .setName('search')
    .setDescription('Search for an AREDL demon')
    .addStringOption(option =>
      option
        .setName('level')
        .setDescription('The demon name')
        .setRequired(true)
    )
];

// ==========================================
// API FUNCTIONS
// ==========================================

async function fetchJSON(url) {
  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(`API error: ${response.status}`);
  }

  return response.json();
}

async function getLevels() {
  const result = await fetchJSON(AREDL_LEVELS_API);

  if (Array.isArray(result)) return result;
  if (Array.isArray(result.data)) return result.data;
  if (Array.isArray(result.levels)) return result.levels;

  throw new Error('Unexpected demonlist response format');
}

async function getPlayers(page) {
  const url =
    `${AREDL_PLAYERS_API}?page=${page}&per_page=${PER_PAGE}`;

  return fetchJSON(url);
}

// ==========================================
// DEMON LEADERBOARD
// ==========================================

function createDemonPage(levels, page) {
  const start = page * PER_PAGE;

  const pageLevels = levels.slice(
    start,
    start + PER_PAGE
  );

  const description = pageLevels.map((level, index) => {
    const rank = level.position ?? start + index + 1;

    return (
      `**#${rank} — ${level.name}**\n` +
      `${Number(level.points ?? 0).toLocaleString()} points`
    );
  }).join('\n\n');

  return new EmbedBuilder()
    .setColor(0x5865F2)
    .setTitle('AREDL Demonlist')
    .setDescription(description || 'No demons found.')
    .setFooter({
      text: `Page ${page + 1} of ${Math.max(1, Math.ceil(levels.length / PER_PAGE))} • ${levels.length} demons`
    })
    .setURL('https://aredl.net/');
}

function createDemonButtons(page, totalPages) {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId('demons_previous')
      .setLabel('Previous')
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(page === 0),

    new ButtonBuilder()
      .setCustomId('demons_next')
      .setLabel('Next')
      .setStyle(ButtonStyle.Primary)
      .setDisabled(page >= totalPages - 1)
  );
}

// ==========================================
// PLAYER LEADERBOARD
// ==========================================

function createPlayerPage(result) {
  const players = result.data || [];

  const description = players.map(player => {
    const name =
      player.user?.global_name ||
      player.user?.username ||
      'Unknown player';

    const hardest =
      player.hardest?.name || 'Unknown';

    const clan =
      player.clan?.tag || 'No clan';

    return [
      `**#${player.rank} — ${name}**`,
      `🏆 ${Number(player.total_points ?? 0).toLocaleString()} points`,
      `👹 ${Number(player.extremes ?? 0).toLocaleString()} extremes`,
      `⚔️ Hardest: ${hardest}`,
      `🏷️ Clan: ${clan}`
    ].join('\n');
  }).join('\n\n');

  return new EmbedBuilder()
    .setColor(0xE6B84A)
    .setTitle('AREDL Player Leaderboard')
    .setDescription(description || 'No players found.')
    .setFooter({
      text: `Page ${result.page} of ${result.pages} • ${Number(result.count ?? 0).toLocaleString()} players`
    })
    .setURL('https://aredl.net/');
}

function createPlayerButtons(page, pages) {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId('players_previous')
      .setLabel('Previous')
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(page <= 1),

    new ButtonBuilder()
      .setCustomId('players_next')
      .setLabel('Next')
      .setStyle(ButtonStyle.Primary)
      .setDisabled(page >= pages)
  );
}

// ==========================================
// INDIVIDUAL DEMON INFORMATION
// ==========================================

function createDemonCard(level) {
  return new EmbedBuilder()
    .setColor(0x5865F2)
    .setTitle(level.name ?? 'Unknown demon')
    .setDescription(
      level.description || 'No description available.'
    )
    .addFields(
      {
        name: 'Rank',
        value: `#${level.position ?? 'Unknown'}`,
        inline: true
      },
      {
        name: 'Points',
        value: String(level.points ?? 'Unknown'),
        inline: true
      },
      {
        name: 'Status',
        value: level.status ?? 'Unknown',
        inline: true
      },
      {
        name: 'Geometry Dash ID',
        value: String(level.level_id ?? 'Unknown'),
        inline: true
      },
      {
        name: 'Two-player',
        value: level.two_player ? 'Yes' : 'No',
        inline: true
      },
      {
        name: 'Song ID',
        value: String(level.song ?? 'Unknown'),
        inline: true
      },
      {
        name: 'Tags',
        value: level.tags?.length
          ? level.tags.join(', ').slice(0, 1024)
          : 'None listed'
      }
    )
    .setFooter({
      text: 'AREDL Explorer'
    });
}

// ==========================================
// BOT READY
// ==========================================

client.once('ready', () => {
  console.log(`Logged in as ${client.user.tag}!`);
});

// ==========================================
// INTERACTION HANDLER
// ==========================================

client.on('interactionCreate', async interaction => {
  try {

    // --------------------------------------
    // SLASH COMMANDS
    // --------------------------------------

    if (interaction.isChatInputCommand()) {

      // MAIN MENU
      if (interaction.commandName === 'aredl') {
        const embed = new EmbedBuilder()
          .setColor(0x5865F2)
          .setTitle('AREDL Explorer')
          .setDescription(
            'Welcome to the All Rated Extreme Demons List Explorer!\n\n' +
            '📋 `/demons` — Browse the demonlist\n' +
            '🏆 `/players` — Browse player rankings\n' +
            '🔎 `/search` — Search for a demon'
          )
          .setURL('https://aredl.net/');

        await interaction.reply({
          embeds: [embed]
        });
      }

      // DEMON LEADERBOARD
      else if (interaction.commandName === 'demons') {
        await interaction.deferReply();

        const levels = await getLevels();

        if (!levels.length) {
          await interaction.editReply(
            'The AREDL demonlist is empty.'
          );
          return;
        }

        let page = 0;

        const totalPages = Math.ceil(
          levels.length / PER_PAGE
        );

        const message = await interaction.editReply({
          embeds: [createDemonPage(levels, page)],
          components: [
            createDemonButtons(page, totalPages)
          ]
        });

        const collector = message.createMessageComponentCollector({
          time: 120000
        });

        collector.on('collect', async button => {
          if (button.user.id !== interaction.user.id) {
            await button.reply({
              content: 'This leaderboard belongs to someone else!',
              ephemeral: true
            });
            return;
          }

          if (button.customId === 'demons_previous') {
            page--;
          }

          if (button.customId === 'demons_next') {
            page++;
          }

          await button.update({
            embeds: [createDemonPage(levels, page)],
            components: [
              createDemonButtons(page, totalPages)
            ]
          });
        });

        collector.on('end', async () => {
          await interaction.editReply({
            components: []
          }).catch(console.error);
        });
      }

      // PLAYER LEADERBOARD
      else if (interaction.commandName === 'players') {
        await interaction.deferReply();

        let currentPage = 1;

        const result = await getPlayers(currentPage);

        const message = await interaction.editReply({
          embeds: [createPlayerPage(result)],
          components: [
            createPlayerButtons(
              result.page,
              result.pages
            )
          ]
        });

        const collector = message.createMessageComponentCollector({
          time: 120000
        });

        collector.on('collect', async button => {
          if (button.user.id !== interaction.user.id) {
            await button.reply({
              content: 'This leaderboard belongs to someone else!',
              ephemeral: true
            });
            return;
          }

          if (button.customId === 'players_previous') {
            currentPage--;
          }

          if (button.customId === 'players_next') {
            currentPage++;
          }

          try {
            const nextResult = await getPlayers(currentPage);

            await button.update({
              embeds: [createPlayerPage(nextResult)],
              components: [
                createPlayerButtons(
                  nextResult.page,
                  nextResult.pages
                )
              ]
            });

          } catch (error) {
            console.error('Player error:', error);

            await button.reply({
              content: 'Could not retrieve the player page.',
              ephemeral: true
            });
          }
        });

        collector.on('end', async () => {
          await interaction.editReply({
            components: []
          }).catch(console.error);
        });
      }

      // DEMON SEARCH
      else if (interaction.commandName === 'search') {
        await interaction.deferReply();

        const query = interaction.options
          .getString('level')
          .toLowerCase();

        const levels = await getLevels();

        const matches = levels
          .filter(level =>
            level.name?.toLowerCase().includes(query)
          )
          .slice(0, 10);

        if (!matches.length) {
          await interaction.editReply(
            `I couldn't find a demon matching **${query}**.`
          );
          return;
        }

        await interaction.editReply({
          embeds: matches.map(createDemonCard)
        });
      }
    }

  } catch (error) {
    console.error('Interaction error:', error);

    const message =
      'Something went wrong while contacting AREDL. Check the Codespaces terminal.';

    if (interaction.deferred || interaction.replied) {
      await interaction.editReply(message).catch(console.error);
    } else {
      await interaction.reply({
        content: message,
        ephemeral: true
      }).catch(console.error);
    }
  }
});

// ==========================================
// START BOT AND REGISTER COMMANDS
// ==========================================

async function main() {
  const rest = new REST({ version: '10' })
    .setToken(process.env.DISCORD_TOKEN);

  await rest.put(
    Routes.applicationGuildCommands(
      process.env.CLIENT_ID,
      process.env.GUILD_ID
    ),
    {
      body: commands.map(command => command.toJSON())
    }
  );

  console.log('Commands registered successfully!');

  await client.login(process.env.DISCORD_TOKEN);
}

main().catch(console.error);