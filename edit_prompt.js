const {
  SlashCommandBuilder,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ModalBuilder,
  LabelBuilder,
  StringSelectMenuBuilder,
  RadioGroupBuilder,
  TextInputBuilder,
  TextInputStyle,
} = require('discord.js');

const config = require('../config');
const setupCommand = require('./setup');

const previewStates = new Map();

function createDefaultPreview(select = 'default') {
  const defaultEmbed = config.editPrompt.defaultEmbed;

  return {
    title: defaultEmbed.title,
    description: defaultEmbed.description,
    footerText: defaultEmbed.footerText,
    footerIconUrl: defaultEmbed.footerIconUrl,
    imageUrl: defaultEmbed.imageUrl,
    thumbnailUrl: defaultEmbed.thumbnailUrl,
    color: defaultEmbed.color,
    template: select,
    promptType: config.editPrompt.defaultPromptType,
  };
}

function createStateFromSavedConfig(saved, template = 'default') {
  if (!saved) {
    return createDefaultPreview(template);
  }

  return {
    title: saved.title || config.editPrompt.defaultEmbed.title,
    description: saved.description || config.editPrompt.defaultEmbed.description,
    footerText: saved.footerText || config.editPrompt.defaultEmbed.footerText,
    footerIconUrl: saved.footerIconUrl || config.editPrompt.defaultEmbed.footerIconUrl,
    imageUrl: saved.imageUrl || config.editPrompt.defaultEmbed.imageUrl,
    thumbnailUrl: saved.thumbnailUrl || config.editPrompt.defaultEmbed.thumbnailUrl,
    color: saved.color || config.editPrompt.defaultEmbed.color,
    template: template || saved.template || 'default',
    promptType: saved.promptType || config.editPrompt.defaultPromptType,
  };
}

function buildPromptPreview(state) {
  const embed = new EmbedBuilder()
    .setTitle(state.title)
    .setDescription(state.description)
    .setColor(state.color || config.editPrompt.defaultEmbed.color);

  if (state.footerText) {
    embed.setFooter({
      text: state.footerText,
      iconURL: state.footerIconUrl || undefined,
    });
  }

  if (state.imageUrl) {
    embed.setImage(state.imageUrl);
  }

  if (state.thumbnailUrl) {
    embed.setThumbnail(state.thumbnailUrl);
  }

  return embed;
}

function buildPromptTypeSelectRow(ticketTypes = []) {
  const select = new StringSelectMenuBuilder()
    .setCustomId(config.editPrompt.promptTypeSelect.customId)
    .setPlaceholder(config.editPrompt.promptTypeSelect.placeholder)
    .setMinValues(1)
    .setMaxValues(1)
    .setDisabled(ticketTypes.length === 0)
    .setOptions(
      ticketTypes.length
        ? ticketTypes.map((type) => ({
            label: type.name,
            value: type.type_id,
            ...(type.description ? { description: type.description.slice(0, 100) } : {}),
          }))
        : [
            {
              label: config.editPrompt.promptTypeSelect.noTypesLabel,
              value: config.editPrompt.promptTypeSelect.noTypesValue,
              description: 'Create ticket types in /setup first.',
            },
          ],
    );

  return new ActionRowBuilder().addComponents(select);
}

function buildPromptTypeButtonRow(ticketTypes = []) {
  const row = new ActionRowBuilder();

  if (ticketTypes.length === 0) {
    row.addComponents(
      new ButtonBuilder()
        .setCustomId(`${config.editPrompt.promptTypeButton.customIdPrefix}none`)
        .setLabel(config.editPrompt.promptTypeSelect.noTypesLabel)
        .setStyle(ButtonStyle.Secondary)
        .setDisabled(true),
    );
    return row;
  }

  ticketTypes.slice(0, 5).forEach((type) => {
    row.addComponents(
      new ButtonBuilder()
        .setCustomId(`${config.editPrompt.promptTypeButton.customIdPrefix}${type.type_id}`)
        .setLabel(type.name)
        .setStyle(ButtonStyle.Secondary),
    );
  });

  return row;
}

function buildPromptComponents(state, ticketTypes = []) {
  if (state.promptType === 'buttons') {
    return [buildPromptTypeButtonRow(ticketTypes)];
  }

  return [buildPromptTypeSelectRow(ticketTypes)];
}

function buildPreviewButtons() {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(config.editPrompt.buttons.edit.customId)
      .setLabel(config.editPrompt.buttons.edit.label)
      .setStyle(config.editPrompt.buttons.edit.style),
    new ButtonBuilder()
      .setCustomId(config.editPrompt.buttons.send.customId)
      .setLabel(config.editPrompt.buttons.send.label)
      .setStyle(config.editPrompt.buttons.send.style),
  );
}

function buildPromptEditModal(state) {
  return new ModalBuilder()
    .setCustomId(config.editPrompt.modal.customId)
    .setTitle(config.editPrompt.modal.title)
    .addLabelComponents(
      new LabelBuilder()
        .setLabel(config.editPrompt.modal.titleInput.label)
        .setDescription('Edit the embed title.')
        .setTextInputComponent(
          new TextInputBuilder()
            .setCustomId(config.editPrompt.modal.titleInput.customId)
            .setPlaceholder(config.editPrompt.modal.titleInput.placeholder)
            .setRequired(true)
            .setStyle(TextInputStyle.Short)
            .setValue(state.title),
        ),
      new LabelBuilder()
        .setLabel(config.editPrompt.modal.descriptionInput.label)
        .setDescription('Edit the embed description.')
        .setTextInputComponent(
          new TextInputBuilder()
            .setCustomId(config.editPrompt.modal.descriptionInput.customId)
            .setPlaceholder(config.editPrompt.modal.descriptionInput.placeholder)
            .setRequired(true)
            .setStyle(TextInputStyle.Paragraph)
            .setValue(state.description),
        ),
      new LabelBuilder()
        .setLabel(config.editPrompt.modal.footerInput.label)
        .setDescription('Edit the footer text.')
        .setTextInputComponent(
          new TextInputBuilder()
            .setCustomId(config.editPrompt.modal.footerInput.customId)
            .setPlaceholder(config.editPrompt.modal.footerInput.placeholder)
            .setRequired(false)
            .setStyle(TextInputStyle.Short)
            .setValue(state.footerText || ''),
        ),
      new LabelBuilder()
        .setLabel(config.editPrompt.modal.imageInput.label)
        .setDescription('Edit the main image URL.')
        .setTextInputComponent(
          new TextInputBuilder()
            .setCustomId(config.editPrompt.modal.imageInput.customId)
            .setPlaceholder(config.editPrompt.modal.imageInput.placeholder)
            .setRequired(false)
            .setStyle(TextInputStyle.Short)
            .setValue(state.imageUrl || ''),
        ),
      new LabelBuilder()
        .setLabel(config.editPrompt.modal.colorInput.label)
        .setDescription('Edit the embed color in hex format.')
        .setTextInputComponent(
          new TextInputBuilder()
            .setCustomId(config.editPrompt.modal.colorInput.customId)
            .setPlaceholder(config.editPrompt.modal.colorInput.placeholder)
            .setRequired(false)
            .setStyle(TextInputStyle.Short)
            .setValue(`#${state.color.toString(16).padStart(6, '0')}`),
        ),
    );
}

function buildConfigModal() {
  return new ModalBuilder()
    .setCustomId(config.editPrompt.configModal.customId)
    .setTitle('Prompt configuration')
    .addLabelComponents(
      new LabelBuilder()
        .setLabel(config.editPrompt.modal.promptType.label)
        .setDescription(config.editPrompt.modal.promptType.description)
        .setRadioGroupComponent(
          new RadioGroupBuilder()
            .setCustomId(config.editPrompt.modal.promptType.customId)
            .setOptions(config.editPrompt.promptTypeConfig.options),
        ),
    );
}

function parseColor(value, fallback) {
  if (!value) return fallback;
  const trimmed = value.trim().replace(/^#/, '');
  if (/^[0-9A-Fa-f]{6}$/.test(trimmed)) {
    return Number.parseInt(trimmed, 16);
  }
  if (/^[0-9A-Fa-f]{3}$/.test(trimmed)) {
    return Number.parseInt(trimmed.split('').map((c) => c + c).join(''), 16);
  }
  return fallback;
}

async function handleEditButton(interaction, db) {
  if (!interaction.inGuild()) return;

  const savedPromptState = setupCommand.getGuildPromptConfig(db, interaction.guildId);
  const currentState = previewStates.get(interaction.guildId) || createStateFromSavedConfig(savedPromptState, 'default');
  await interaction.showModal(buildPromptEditModal(currentState));
}

async function handleSendButton(interaction, db) {
  if (!interaction.inGuild()) return;

  const setupData = setupCommand.getGuildSetup(db, interaction.guildId);
  if (!setupData || !setupData.ticketPromptChannelId) {
    await interaction.reply({
      content: 'No prompt channel is configured. Please run /setup first.',
      ephemeral: true,
    });
    return;
  }

  const promptChannel = interaction.guild.channels.cache.get(setupData.ticketPromptChannelId);
  if (!promptChannel || !promptChannel.isTextBased()) {
    await interaction.reply({
      content: 'The configured prompt channel is unavailable. Please rerun /setup and choose a valid text channel.',
      ephemeral: true,
    });
    return;
  }

  const state = previewStates.get(interaction.guildId) || createDefaultPreview('default');
  const ticketTypes = setupCommand.getTicketTypesForGuild(db, interaction.guildId);
  await promptChannel.send({
    embeds: [buildPromptPreview(state)],
    components: buildPromptComponents(state, ticketTypes),
  });

  await interaction.reply({
    content: `Prompt embed sent to <#${setupData.ticketPromptChannelId}>.`,
    ephemeral: true,
  });
}

async function handlePromptTypeSelect(interaction) {
  if (!interaction.inGuild()) return;

  const selected = interaction.values?.[0];
  if (!selected) {
    await interaction.reply({
      content: 'No ticket type was selected.',
      ephemeral: true,
    });
    return;
  }

  await interaction.reply({
    content: `Selected ticket type: ${selected}.`,
    ephemeral: true,
  });
}

async function handlePromptTypeButton(interaction) {
  if (!interaction.inGuild()) return;

  const selectedTypeId = interaction.customId.replace(config.editPrompt.promptTypeButton.customIdPrefix, '');
  if (!selectedTypeId) {
    await interaction.reply({
      content: 'Ticket type selection is unavailable.',
      ephemeral: true,
    });
    return;
  }

  await interaction.reply({
    content: `Selected ticket type: ${selectedTypeId}.`,
    ephemeral: true,
  });
}

async function handleEditPromptModalSubmit(interaction, db) {
  if (!interaction.inGuild()) return;

  const savedPromptState = setupCommand.getGuildPromptConfig(db, interaction.guildId);
  const previousState = previewStates.get(interaction.guildId) || createStateFromSavedConfig(savedPromptState, 'default');
  const title = interaction.fields.getTextInputValue(config.editPrompt.modal.titleInput.customId);
  const description = interaction.fields.getTextInputValue(config.editPrompt.modal.descriptionInput.customId);
  const footerText = interaction.fields.getTextInputValue(config.editPrompt.modal.footerInput.customId).trim();
  const imageUrl = interaction.fields.getTextInputValue(config.editPrompt.modal.imageInput.customId).trim();
  const colorInput = interaction.fields.getTextInputValue(config.editPrompt.modal.colorInput.customId).trim();

  const updatedState = {
    ...previousState,
    title: title || previousState.title,
    description: description || previousState.description,
    footerText: footerText || '',
    footerIconUrl: previousState.footerIconUrl || '',
    imageUrl: imageUrl || '',
    color: parseColor(colorInput, previousState.color),
  };

  previewStates.set(interaction.guildId, updatedState);
  setupCommand.saveGuildPromptConfig(db, interaction.guildId, updatedState);

  const ticketTypes = setupCommand.getTicketTypesForGuild(db, interaction.guildId);

  if (interaction.isFromMessage() && interaction.message) {
    await interaction.update({
      content: 'Embed saved successfully.',
      embeds: [buildPromptPreview(updatedState)],
      components: [...buildPromptComponents(updatedState, ticketTypes), buildPreviewButtons()],
    });
    return;
  }

  await interaction.reply({
    content: 'Embed saved successfully.',
    embeds: [buildPromptPreview(updatedState)],
    components: [...buildPromptComponents(updatedState, ticketTypes), buildPreviewButtons()],
    ephemeral: true,
  });
}

async function handleConfigModalSubmit(interaction, db) {
  if (!interaction.inGuild()) return;

  const savedPromptState = setupCommand.getGuildPromptConfig(db, interaction.guildId);
  const previousState = previewStates.get(interaction.guildId) || createStateFromSavedConfig(savedPromptState, 'default');
  const promptType = interaction.fields.getRadioGroup(config.editPrompt.modal.promptType.customId, false) || previousState.promptType;
  const updatedState = {
    ...previousState,
    promptType,
  };

  previewStates.set(interaction.guildId, updatedState);
  setupCommand.saveGuildPromptConfig(db, interaction.guildId, updatedState);

  const ticketTypes = setupCommand.getTicketTypesForGuild(db, interaction.guildId);

  await interaction.reply({
    content: 'Prompt configuration saved successfully.',
    embeds: [buildPromptPreview(updatedState)],
    components: [...buildPromptComponents(updatedState, ticketTypes), buildPreviewButtons()],
    ephemeral: true,
  });
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName(config.editPrompt.commandName)
    .setDescription(config.editPrompt.commandDescription)
    .addStringOption((option) =>
      option
        .setName(config.editPrompt.embedOption.name)
        .setDescription(config.editPrompt.embedOption.description)
        .setRequired(false)
        .addChoices(...config.editPrompt.embedOption.choices),
    )
    .addBooleanOption((option) =>
      option
        .setName(config.editPrompt.configOption.name)
        .setDescription(config.editPrompt.configOption.description)
        .setRequired(false),
    ),

  handleEditButton,
  handleSendButton,
  handlePromptTypeSelect,
  handlePromptTypeButton,
  handleEditPromptModalSubmit,
  handleConfigModalSubmit,

  async execute(interaction, { db }) {
    if (!interaction.inGuild()) {
      await interaction.reply({
        content: 'This command must be used inside a server.',
        ephemeral: true,
      });
      return;
    }

    const template = interaction.options.getString(config.editPrompt.embedOption.name);
    const openConfig = interaction.options.getBoolean(config.editPrompt.configOption.name);

    if (!template && !openConfig) {
      await interaction.reply({
        content: 'You must provide at least one option: embed or config.',
        ephemeral: true,
      });
      return;
    }

    const savedPromptState = setupCommand.getGuildPromptConfig(db, interaction.guildId);
    const state = savedPromptState
      ? createStateFromSavedConfig(savedPromptState, template || 'default')
      : createDefaultPreview(template || 'default');
    previewStates.set(interaction.guildId, state);

    if (openConfig) {
      await interaction.showModal(buildConfigModal());
      return;
    }

    const ticketTypes = setupCommand.getTicketTypesForGuild(db, interaction.guildId);
    await interaction.reply({
      embeds: [buildPromptPreview(state)],
      components: [...buildPromptComponents(state, ticketTypes), buildPreviewButtons()],
      ephemeral: true,
    });
  },
};
