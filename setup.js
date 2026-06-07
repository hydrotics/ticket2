const {
  SlashCommandBuilder,
  ModalBuilder,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  LabelBuilder,
  RoleSelectMenuBuilder,
  ChannelSelectMenuBuilder,
  TextInputBuilder,
  TextInputStyle,
} = require('discord.js');

const config = require('../config');

function createPromptConfigTableIfNeeded(db) {
  db.prepare(`
    CREATE TABLE IF NOT EXISTS guild_ticket_prompts (
      guild_id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      description TEXT NOT NULL,
      footer_text TEXT,
      footer_icon_url TEXT,
      image_url TEXT,
      thumbnail_url TEXT,
      color INTEGER NOT NULL,
      prompt_type TEXT NOT NULL,
      updated_at TEXT NOT NULL
    )
  `).run();
}

function createTicketMetadataTableIfNeeded(db) {
  db.prepare(`
    CREATE TABLE IF NOT EXISTS guild_tickets (
      channel_id TEXT PRIMARY KEY,
      guild_id TEXT NOT NULL,
      type_id TEXT NOT NULL,
      creator_id TEXT NOT NULL,
      claim_user_id TEXT,
      reason TEXT NOT NULL,
      status TEXT NOT NULL,
      ticket_message_id TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    )
  `).run();

  const ticketMetadataInfo = db.prepare('PRAGMA table_info(guild_tickets)').all();
  if (!ticketMetadataInfo.some((column) => column.name === 'reason')) {
    db.prepare('ALTER TABLE guild_tickets ADD COLUMN reason TEXT NOT NULL DEFAULT "No reason provided"').run();
  }
}

function getGuildPromptConfig(db, guildId) {
  const row = db
    .prepare('SELECT * FROM guild_ticket_prompts WHERE guild_id = ?')
    .get(guildId);

  if (!row) return null;
  return {
    guildId: row.guild_id,
    title: row.title,
    description: row.description,
    footerText: row.footer_text,
    footerIconUrl: row.footer_icon_url,
    imageUrl: row.image_url,
    thumbnailUrl: row.thumbnail_url,
    color: row.color,
    promptType: row.prompt_type,
    updatedAt: row.updated_at,
  };
}

function saveGuildPromptConfig(db, guildId, promptData) {
  db.prepare(`
    INSERT INTO guild_ticket_prompts (
      guild_id,
      title,
      description,
      footer_text,
      footer_icon_url,
      image_url,
      thumbnail_url,
      color,
      prompt_type,
      updated_at
    ) VALUES (
      @guild_id,
      @title,
      @description,
      @footer_text,
      @footer_icon_url,
      @image_url,
      @thumbnail_url,
      @color,
      @prompt_type,
      @updated_at
    )
    ON CONFLICT(guild_id) DO UPDATE SET
      title = excluded.title,
      description = excluded.description,
      footer_text = excluded.footer_text,
      footer_icon_url = excluded.footer_icon_url,
      image_url = excluded.image_url,
      thumbnail_url = excluded.thumbnail_url,
      color = excluded.color,
      prompt_type = excluded.prompt_type,
      updated_at = excluded.updated_at
  `).run({
    guild_id: guildId,
    title: promptData.title,
    description: promptData.description,
    footer_text: promptData.footerText || null,
    footer_icon_url: promptData.footerIconUrl || null,
    image_url: promptData.imageUrl || null,
    thumbnail_url: promptData.thumbnailUrl || null,
    color: promptData.color,
    prompt_type: promptData.promptType,
    updated_at: new Date().toISOString(),
  });
}

function saveTicketMetadata(db, ticketData) {
  db.prepare(`
    INSERT INTO guild_tickets (
      channel_id,
      guild_id,
      type_id,
      creator_id,
      claim_user_id,
      reason,
      status,
      ticket_message_id,
      created_at,
      updated_at
    ) VALUES (
      @channel_id,
      @guild_id,
      @type_id,
      @creator_id,
      @claim_user_id,
      @reason,
      @status,
      @ticket_message_id,
      @created_at,
      @updated_at
    )
    ON CONFLICT(channel_id) DO UPDATE SET
      claim_user_id = excluded.claim_user_id,
      reason = excluded.reason,
      status = excluded.status,
      ticket_message_id = excluded.ticket_message_id,
      updated_at = excluded.updated_at
  `).run({
    channel_id: ticketData.channelId,
    guild_id: ticketData.guildId,
    type_id: ticketData.typeId,
    creator_id: ticketData.creatorId,
    claim_user_id: ticketData.claimUserId || null,
    reason: ticketData.reason || 'No reason provided',
    status: ticketData.status,
    ticket_message_id: ticketData.ticketMessageId || null,
    created_at: ticketData.createdAt || new Date().toISOString(),
    updated_at: new Date().toISOString(),
  });
}

function getTicketByChannel(db, channelId) {
  const row = db
    .prepare('SELECT * FROM guild_tickets WHERE channel_id = ?')
    .get(channelId);

  if (!row) return null;
  return {
    channelId: row.channel_id,
    guildId: row.guild_id,
    typeId: row.type_id,
    creatorId: row.creator_id,
    claimUserId: row.claim_user_id,
    reason: row.reason,
    status: row.status,
    ticketMessageId: row.ticket_message_id,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function deleteTicketMetadata(db, channelId) {
  db.prepare('DELETE FROM guild_tickets WHERE channel_id = ?').run(channelId);
}

function updateTicketMetadata(db, channelId, updates) {
  const current = getTicketByChannel(db, channelId);
  if (!current) return null;
  const merged = {
    ...current,
    ...updates,
    updatedAt: new Date().toISOString(),
  };

  saveTicketMetadata(db, merged);
  return merged;
}

function createTableIfNeeded(db) {
  db.prepare(`
    CREATE TABLE IF NOT EXISTS ${config.setup.database.tableName} (
      guild_id TEXT PRIMARY KEY,
      support_role_id TEXT NOT NULL,
      ticket_prompt_channel_id TEXT NOT NULL,
      closed_tickets_category_id TEXT NOT NULL,
      ticket_count INTEGER NOT NULL DEFAULT 0,
      updated_at TEXT NOT NULL
    )
  `).run();

  db.prepare(`
    CREATE TABLE IF NOT EXISTS ${config.setup.database.ticketTypesTableName} (
      type_id TEXT PRIMARY KEY,
      guild_id TEXT NOT NULL,
      name TEXT NOT NULL,
      category_id TEXT NOT NULL,
      description TEXT,
      created_at TEXT NOT NULL
    )
  `).run();

  const ticketTypeInfo = db
    .prepare(`PRAGMA table_info(${config.setup.database.ticketTypesTableName})`)
    .all();

  if (!ticketTypeInfo.some((column) => column.name === 'description')) {
    db.prepare(`ALTER TABLE ${config.setup.database.ticketTypesTableName} ADD COLUMN description TEXT`).run();
  }

  const settingsInfo = db
    .prepare(`PRAGMA table_info(${config.setup.database.tableName})`)
    .all();

  if (!settingsInfo.some((column) => column.name === 'ticket_count')) {
    db.prepare(`ALTER TABLE ${config.setup.database.tableName} ADD COLUMN ticket_count INTEGER NOT NULL DEFAULT 0`).run();
  }

  createPromptConfigTableIfNeeded(db);
  createTicketMetadataTableIfNeeded(db);
}

function getGuildSetup(db, guildId) {
  const row = db
    .prepare(`SELECT * FROM ${config.setup.database.tableName} WHERE guild_id = ?`)
    .get(guildId);

  if (!row) return null;

  return {
    guildId: row.guild_id,
    supportRoleId: row.support_role_id,
    ticketPromptChannelId: row.ticket_prompt_channel_id,
    closedTicketsCategoryId: row.closed_tickets_category_id,
    ticketCount: row.ticket_count || 0,
    updatedAt: row.updated_at,
  };
}

function getTicketTypesForGuild(db, guildId) {
  return db
    .prepare(`SELECT * FROM ${config.setup.database.ticketTypesTableName} WHERE guild_id = ? ORDER BY created_at`)
    .all(guildId);
}

function getTicketTypeById(db, guildId, typeId) {
  return db
    .prepare(`SELECT * FROM ${config.setup.database.ticketTypesTableName} WHERE guild_id = ? AND type_id = ?`)
    .get(guildId, typeId);
}

function saveGuildSetup(db, guildId, data) {
  db.prepare(`
    INSERT INTO ${config.setup.database.tableName} (
      guild_id,
      support_role_id,
      ticket_prompt_channel_id,
      closed_tickets_category_id,
      updated_at
    ) VALUES (
      @guild_id,
      @support_role_id,
      @ticket_prompt_channel_id,
      @closed_tickets_category_id,
      @updated_at
    )
    ON CONFLICT(guild_id) DO UPDATE SET
      support_role_id = excluded.support_role_id,
      ticket_prompt_channel_id = excluded.ticket_prompt_channel_id,
      closed_tickets_category_id = excluded.closed_tickets_category_id,
      updated_at = excluded.updated_at
  `).run({
    guild_id: guildId,
    support_role_id: data.supportRoleId,
    ticket_prompt_channel_id: data.ticketPromptChannelId,
    closed_tickets_category_id: data.closedTicketsCategoryId,
    updated_at: new Date().toISOString(),
  });
}

function saveTicketType(db, guildId, name, categoryId, description) {
  const typeId = `${guildId}-${Date.now()}-${Math.floor(Math.random() * 1000000)}`;
  db.prepare(`
    INSERT INTO ${config.setup.database.ticketTypesTableName} (
      type_id,
      guild_id,
      name,
      category_id,
      description,
      created_at
    ) VALUES (
      @type_id,
      @guild_id,
      @name,
      @category_id,
      @description,
      @created_at
    )
  `).run({
    type_id: typeId,
    guild_id: guildId,
    name,
    category_id: categoryId,
    description,
    created_at: new Date().toISOString(),
  });
}

function buildSetupModal(previousSettings = {}) {
  const supportRoleSelect = new RoleSelectMenuBuilder()
    .setCustomId(config.setup.modal.supportRole.customId)
    .setPlaceholder(config.setup.modal.supportRole.placeholder)
    .setRequired(true)
    .setMinValues(1)
    .setMaxValues(1);

  if (previousSettings?.support_role_id) {
    supportRoleSelect.setDefaultRoles(previousSettings.support_role_id);
  }

  const ticketPromptChannelSelect = new ChannelSelectMenuBuilder()
    .setCustomId(config.setup.modal.ticketPromptChannel.customId)
    .setPlaceholder(config.setup.modal.ticketPromptChannel.placeholder)
    .setChannelTypes(...config.setup.modal.ticketPromptChannel.channelTypes)
    .setRequired(true)
    .setMinValues(1)
    .setMaxValues(1);

  if (previousSettings?.ticket_prompt_channel_id) {
    ticketPromptChannelSelect.setDefaultChannels(previousSettings.ticket_prompt_channel_id);
  }

  const closedCategorySelect = new ChannelSelectMenuBuilder()
    .setCustomId(config.setup.modal.closedTicketsCategory.customId)
    .setPlaceholder(config.setup.modal.closedTicketsCategory.placeholder)
    .setChannelTypes(...config.setup.modal.closedTicketsCategory.channelTypes)
    .setRequired(true)
    .setMinValues(1)
    .setMaxValues(1);

  if (previousSettings?.closed_tickets_category_id) {
    closedCategorySelect.setDefaultChannels(previousSettings.closed_tickets_category_id);
  }

  return new ModalBuilder()
    .setCustomId(config.setup.modal.customId)
    .setTitle(config.setup.modal.title)
    .addLabelComponents(
      new LabelBuilder()
        .setLabel(config.setup.modal.supportRole.label)
        .setDescription(config.setup.modal.supportRole.description)
        .setRoleSelectMenuComponent(supportRoleSelect),
      new LabelBuilder()
        .setLabel(config.setup.modal.ticketPromptChannel.label)
        .setDescription(config.setup.modal.ticketPromptChannel.description)
        .setChannelSelectMenuComponent(ticketPromptChannelSelect),
      new LabelBuilder()
        .setLabel(config.setup.modal.closedTicketsCategory.label)
        .setDescription(config.setup.modal.closedTicketsCategory.description)
        .setChannelSelectMenuComponent(closedCategorySelect),
    );
}

function buildTicketTypesEmbed(interaction, ticketTypes = []) {
  const typeFields = ticketTypes.length
    ? ticketTypes.map((type, index) => ({
        name: `${index + 1}. ${type.name}`,
        value: type.description
          ? `${type.description}\n<#${type.category_id}>`
          : `<#${type.category_id}>`,
        inline: false,
      }))
    : [
        {
          name: 'No ticket types yet',
          value: config.setup.ticketTypes.embed.noTypesText,
          inline: false,
        },
      ];

  return new EmbedBuilder()
    .setColor(config.setup.embed.color)
    .setTitle(config.setup.ticketTypes.embed.title)
    .setDescription(config.setup.ticketTypes.embed.description)
    .addFields(typeFields);
}

function buildSummaryEmbed(interaction, data, ticketTypes = []) {
  const supportRole = interaction.guild.roles.cache.get(data.supportRoleId);
  const promptChannel = interaction.guild.channels.cache.get(data.ticketPromptChannelId);
  const closedCategory = interaction.guild.channels.cache.get(data.closedTicketsCategoryId);

  const ticketTypesValue = ticketTypes.length
    ? ticketTypes.map((type) => `• **${type.name}** → <#${type.category_id}>`).join('\n')
    : 'No ticket types were created during setup.';

  return new EmbedBuilder()
    .setColor(config.setup.embed.color)
    .setTitle(config.setup.messages.summaryTitle)
    .setDescription(config.setup.messages.summaryDescription)
    .addFields(
      {
        name: 'Support role',
        value: supportRole ? `<@&${supportRole.id}>` : `\`${data.supportRoleId}\``,
        inline: false,
      },
      {
        name: 'Ticket prompt channel',
        value: promptChannel ? `<#${promptChannel.id}>` : `\`${data.ticketPromptChannelId}\``,
        inline: false,
      },
      {
        name: 'Closed tickets category',
        value: closedCategory ? `\`${closedCategory.name}\`` : `\`${data.closedTicketsCategoryId}\``,
        inline: false,
      },
      {
        name: 'Ticket types',
        value: ticketTypesValue,
        inline: false,
      },
    );
}

function buildSetupRow() {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(config.setup.ticketTypes.addButton.customId)
      .setLabel(config.setup.ticketTypes.addButton.label)
      .setStyle(ButtonStyle.Primary),
    new ButtonBuilder()
      .setCustomId(config.setup.finishButton.customId)
      .setLabel(config.setup.finishButton.label)
      .setStyle(ButtonStyle.Success),
  );
}

function buildTicketTypeModal() {
  return new ModalBuilder()
    .setCustomId(config.setup.ticketTypes.modal.customId)
    .setTitle(config.setup.ticketTypes.modal.title)
    .addLabelComponents(
      new LabelBuilder()
        .setLabel(config.setup.ticketTypes.modal.name.label)
        .setDescription(config.setup.ticketTypes.modal.name.description)
        .setTextInputComponent(
          new TextInputBuilder()
            .setCustomId(config.setup.ticketTypes.modal.name.customId)
            .setPlaceholder(config.setup.ticketTypes.modal.name.placeholder)
            .setRequired(true)
            .setStyle(TextInputStyle.Short)
            .setMaxLength(50),
        ),
      new LabelBuilder()
        .setLabel(config.setup.ticketTypes.modal.description.label)
        .setDescription(config.setup.ticketTypes.modal.description.description)
        .setTextInputComponent(
          new TextInputBuilder()
            .setCustomId(config.setup.ticketTypes.modal.description.customId)
            .setPlaceholder(config.setup.ticketTypes.modal.description.placeholder)
            .setRequired(false)
            .setStyle(TextInputStyle.Short)
            .setMaxLength(100),
        ),
      new LabelBuilder()
        .setLabel(config.setup.ticketTypes.modal.category.label)
        .setDescription(config.setup.ticketTypes.modal.category.description)
        .setChannelSelectMenuComponent(
          new ChannelSelectMenuBuilder()
            .setCustomId(config.setup.ticketTypes.modal.category.customId)
            .setPlaceholder(config.setup.ticketTypes.modal.category.placeholder)
            .setChannelTypes(...config.setup.ticketTypes.modal.category.channelTypes)
            .setRequired(true)
            .setMinValues(1)
            .setMaxValues(1),
        ),
    );
}

async function handleAddTicketTypeButton(interaction) {
  if (!interaction.inGuild()) return;
  await interaction.showModal(buildTicketTypeModal());
}

async function handleTicketTypeModalSubmit(interaction, db) {
  if (!interaction.inGuild()) return;

  const ticketTypeName = interaction.fields.getTextInputValue(
    config.setup.ticketTypes.modal.name.customId,
  );
  const ticketTypeDescription = interaction.fields.getTextInputValue(
    config.setup.ticketTypes.modal.description.customId,
  ).trim();

  const selectedCategories = interaction.fields.getSelectedChannels(
    config.setup.ticketTypes.modal.category.customId,
    true,
    config.setup.ticketTypes.modal.category.channelTypes,
  );

  const category = selectedCategories.first();

  if (!ticketTypeName || !category) {
    await interaction.reply({
      content: 'Ticket type name and category are required.',
      ephemeral: true,
    });
    return;
  }

  saveTicketType(
    db,
    interaction.guildId,
    ticketTypeName.trim(),
    category.id,
    ticketTypeDescription || null,
  );
  const ticketTypes = getTicketTypesForGuild(db, interaction.guildId);

  if (interaction.isFromMessage() && interaction.message) {
    await interaction.update({
      content: null,
      embeds: [buildTicketTypesEmbed(interaction, ticketTypes)],
      components: [buildSetupRow()],
    });
    return;
  }

  await interaction.reply({
    embeds: [buildTicketTypesEmbed(interaction, ticketTypes)],
    components: [buildSetupRow()],
    ephemeral: true,
  });
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName(config.setup.commandName)
    .setDescription(config.setup.commandDescription),

  createTableIfNeeded,
  getGuildSetup,
  getTicketTypesForGuild,
  getTicketTypeById,
  getGuildPromptConfig,
  saveGuildPromptConfig,
  saveGuildSetup,
  saveTicketMetadata,
  getTicketByChannel,
  updateTicketMetadata,
  deleteTicketMetadata,
  buildSetupModal,
  handleAddTicketTypeButton,
  handleTicketTypeModalSubmit,

  async execute(interaction, { db }) {
    if (!interaction.inGuild()) {
      await interaction.reply({
        content: 'This command can only be used inside a server.',
        ephemeral: true,
      });
      return;
    }

    const previousSettings = getGuildSetup(db, interaction.guildId);
    await interaction.showModal(buildSetupModal(previousSettings));
  },

  async handleModalSubmit(interaction, db) {
    if (!interaction.inGuild()) return;

    const supportRoles = interaction.fields.getSelectedRoles(
      config.setup.modal.supportRole.customId,
      true,
    );

    const promptChannels = interaction.fields.getSelectedChannels(
      config.setup.modal.ticketPromptChannel.customId,
      true,
      config.setup.modal.ticketPromptChannel.channelTypes,
    );

    const closedCategories = interaction.fields.getSelectedChannels(
      config.setup.modal.closedTicketsCategory.customId,
      true,
      config.setup.modal.closedTicketsCategory.channelTypes,
    );

    const supportRole = supportRoles.first();
    const promptChannel = promptChannels.first();
    const closedCategory = closedCategories.first();

    if (!supportRole || !promptChannel || !closedCategory) {
      await interaction.reply({
        content: 'One or more setup values were missing.',
        ephemeral: true,
      });
      return;
    }

    const data = {
      supportRoleId: supportRole.id,
      ticketPromptChannelId: promptChannel.id,
      closedTicketsCategoryId: closedCategory.id,
    };

    saveGuildSetup(db, interaction.guildId, data);
    const ticketTypes = getTicketTypesForGuild(db, interaction.guildId);

    await interaction.reply({
      embeds: [buildTicketTypesEmbed(interaction, ticketTypes)],
      components: [buildSetupRow()],
      ephemeral: true,
    });
  },

  async handleFinishButton(interaction, db) {
    if (interaction.customId !== config.setup.finishButton.customId) return;

    const setupData = getGuildSetup(db, interaction.guildId);
    const ticketTypes = getTicketTypesForGuild(db, interaction.guildId);

    if (!setupData) {
      await interaction.reply({
        content: 'Saved setup data not found. Please run /setup again.',
        ephemeral: true,
      });
      return;
    }

    await interaction.update({
      content: null,
      embeds: [buildSummaryEmbed(interaction, setupData, ticketTypes)],
      components: [],
    });
  },
};