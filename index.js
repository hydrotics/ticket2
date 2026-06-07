require('dotenv').config();

const fs = require('node:fs');
const path = require('node:path');


const Database = require('better-sqlite3');
const {
  Client,
  Collection,
  Events,
  GatewayIntentBits,
  REST,
  Routes,
} = require('discord.js');

const config = require('./config');

const TOKEN = process.env.DISCORD_TOKEN;
const CLIENT_ID = process.env.CLIENT_ID;
const GUILD_ID = process.env.GUILD_ID;

if (!TOKEN) {
  throw new Error('Missing DISCORD_TOKEN in .env');
}

const db = new Database(config.setup.database.filePath);
const setupCommand = require('./commands/setup');
const editPromptCommand = require('./commands/edit_prompt');
const ticketCreationCommand = require('./ticket_creation');
const ticketControls = require('./ticket_controls');


setupCommand.createTableIfNeeded(db);

const commands = new Collection();
const commandsPath = path.join(__dirname, 'commands');
const commandFiles = fs
  .readdirSync(commandsPath)
  .filter((file) => file.endsWith('.js'));

for (const file of commandFiles) {
  const command = require(path.join(commandsPath, file));
  if (command?.data?.name) {
    commands.set(command.data.name, command);
  }
}

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
  ],
});

async function registerCommands(appId) {
  const applicationId = CLIENT_ID || appId;
  if (!applicationId) {
    console.warn('Command registration skipped because application ID is unavailable.');
    return;
  }

  const rest = new REST({ version: '10' }).setToken(TOKEN);
  const body = [...commands.values()].map((command) => command.data.toJSON());

  if (GUILD_ID) {
    await rest.put(Routes.applicationGuildCommands(applicationId, GUILD_ID), {
      body,
    });
    console.log(`Registered ${body.length} command(s) to guild ${GUILD_ID}`);
    return;
  }

  await rest.put(Routes.applicationCommands(applicationId), { body });
  console.log(`Registered ${body.length} global command(s)`);
}

client.once(Events.ClientReady, async (readyClient) => {
  console.log(`Logged in as ${readyClient.user.tag}`);

  if (!CLIENT_ID) {
    await client.application.fetch();
  }

  await registerCommands(client.application.id);
});

client.on(Events.InteractionCreate, async (interaction) => {
  try {
    if (interaction.isChatInputCommand()) {
      const command = commands.get(interaction.commandName);
      if (!command) return;
      await command.execute(interaction, { db });
      return;
    }

    if (interaction.isModalSubmit()) {
      if (interaction.customId === config.setup.modal.customId) {
        await setupCommand.handleModalSubmit(interaction, db);
      } else if (
        interaction.customId === config.setup.ticketTypes.modal.customId
      ) {
        await setupCommand.handleTicketTypeModalSubmit(interaction, db);
      } else if (
        interaction.customId === config.editPrompt.modal.customId
      ) {
        await editPromptCommand.handleEditPromptModalSubmit(interaction, db);
      } else if (
        interaction.customId === config.editPrompt.configModal.customId
      ) {
        await editPromptCommand.handleConfigModalSubmit(interaction, db);
      } else if (
        interaction.customId.startsWith(config.ticketCreation.modal.customId)
      ) {
        await ticketCreationCommand.handleTicketCreationModalSubmit(interaction, db);
      }
      return;
    }

    if (interaction.isStringSelectMenu()) {
      if (interaction.customId === config.editPrompt.promptTypeSelect.customId) {
        await ticketCreationCommand.handlePromptTypeSelect(interaction, db);
      }
      return;
    }

    if (interaction.isButton()) {
      if (interaction.customId === config.setup.finishButton.customId) {
        await setupCommand.handleFinishButton(interaction, db);
      } else if (
        interaction.customId === config.setup.ticketTypes.addButton.customId
      ) {
        await setupCommand.handleAddTicketTypeButton(interaction);
      } else if (
        interaction.customId === config.editPrompt.buttons.edit.customId
      ) {
        await editPromptCommand.handleEditButton(interaction, db);
      } else if (
        interaction.customId === config.editPrompt.buttons.send.customId
      ) {
        await editPromptCommand.handleSendButton(interaction, db);
      } else if (
        interaction.customId === config.ticket.claimButton.customId
      ) {
        await ticketControls.handleClaimButton(interaction, db);
      } else if (
        interaction.customId === config.ticket.closeButton.customId
      ) {
        await ticketControls.handleCloseButton(interaction, db);
      } else if (
        interaction.customId === config.ticket.confirmCloseButton.customId
      ) {
        await ticketControls.handleConfirmCloseButton(interaction, db);
      } else if (
        interaction.customId === config.ticket.deleteButton.customId
      ) {
        await ticketControls.handleDeleteButton(interaction, db);
      } else if (
        interaction.customId === config.ticket.confirmDeleteButton.customId
      ) {
        await ticketControls.handleConfirmDeleteButton(interaction, db);
      } else if (
        interaction.customId === config.ticket.reopenButton.customId
      ) {
        await ticketControls.handleReopenButton(interaction, db);
      } else if (
        interaction.customId === config.ticket.cancelButton.customId
      ) {
        await ticketControls.handleCancelButton(interaction, db);
      } else if (
        interaction.customId.startsWith(config.editPrompt.promptTypeButton.customIdPrefix)
      ) {
        await ticketCreationCommand.handlePromptTypeButton(interaction, db);
      }
    }
  } catch (error) {
    console.error(error);

    if (
      interaction.isRepliable() &&
      !interaction.replied &&
      !interaction.deferred
    ) {
      await interaction.reply({
        content: 'Something went wrong while handling that interaction.',
        ephemeral: true,
      }).catch(() => {});
    }
  }
});

client.login(TOKEN);