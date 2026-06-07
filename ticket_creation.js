const {
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ChannelType,
  PermissionsBitField,
} = require('discord.js');

const config = require('./config');
const setupCommand = require('./commands/setup');

function buildTicketCreationModal(typeId, ticketTypeName) {
  return {
    custom_id: `${config.ticketCreation.modal.customId}:${typeId}`,
    title: `${config.ticketCreation.modal.title}: ${ticketTypeName}`,
    components: [
      {
        type: 18,
        label: config.ticketCreation.reasonInput.label,
        description: 'Explain why you are opening this ticket.',
        component: {
          type: 4,
          custom_id: config.ticketCreation.reasonInput.customId,
          style: 2,
          required: true,
          placeholder: config.ticketCreation.reasonInput.placeholder,
          max_length: 1024,
        },
      },
      {
        type: 18,
        label: config.ticketCreation.imageInput.label,
        description: 'Optional image attachment.',
        component: {
          type: 19,
          custom_id: config.ticketCreation.imageInput.customId,
          required: false,
          min_values: 0,
          max_values: 1,
        },
      },
    ],
  };
}

function sanitizeChannelName(username) {
  return username
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .substring(0, 20);
}

function getTicketType(db, guildId, typeId) {
  return setupCommand
    .getTicketTypesForGuild(db, guildId)
    .find((type) => type.type_id === typeId);
}

async function handlePromptTypeSelect(interaction, db) {
  if (!interaction.inGuild()) return;

  const selected = interaction.values?.[0];
  if (!selected || selected === config.editPrompt.promptTypeSelect.noTypesValue) {
    await interaction.reply({
      content: 'No valid ticket type was selected.',
      ephemeral: true,
    });
    return;
  }

  const selectedType = getTicketType(db, interaction.guildId, selected);
  if (!selectedType) {
    await interaction.reply({
      content: 'That ticket type no longer exists. Please try again later.',
      ephemeral: true,
    });
    return;
  }

  await interaction.showModal(buildTicketCreationModal(selectedType.type_id, selectedType.name));
}

async function handlePromptTypeButton(interaction, db) {
  if (!interaction.inGuild()) return;

  const selectedTypeId = interaction.customId.replace(
    config.editPrompt.promptTypeButton.customIdPrefix,
    '',
  );

  if (!selectedTypeId || selectedTypeId === config.editPrompt.promptTypeSelect.noTypesValue) {
    await interaction.reply({
      content: 'Ticket type selection is unavailable.',
      ephemeral: true,
    });
    return;
  }

  const selectedType = getTicketType(db, interaction.guildId, selectedTypeId);
  if (!selectedType) {
    await interaction.reply({
      content: 'That ticket type no longer exists. Please try again later.',
      ephemeral: true,
    });
    return;
  }

  await interaction.showModal(buildTicketCreationModal(selectedType.type_id, selectedType.name));
}

async function handleTicketCreationModalSubmit(interaction, db) {
  if (!interaction.inGuild()) return;

  const customIdParts = interaction.customId.split(':');
  if (customIdParts[0] !== config.ticketCreation.modal.customId || !customIdParts[1]) {
    await interaction.reply({
      content: 'Invalid ticket creation interaction.',
      ephemeral: true,
    });
    return;
  }

  const ticketTypeId = customIdParts[1];
  const ticketType = getTicketType(db, interaction.guildId, ticketTypeId);
  if (!ticketType) {
    await interaction.reply({
      content: 'The selected ticket type is unavailable. Please try again later.',
      ephemeral: true,
    });
    return;
  }

  const setupData = setupCommand.getGuildSetup(db, interaction.guildId);
  if (!setupData) {
    await interaction.reply({
      content: 'This server has not completed setup yet. Run /setup first.',
      ephemeral: true,
    });
    return;
  }

  const supportRole = interaction.guild.roles.cache.get(setupData.supportRoleId);
  const category = interaction.guild.channels.cache.get(ticketType.category_id);
  if (!supportRole || !category || category.type !== ChannelType.GuildCategory) {
    await interaction.reply({
      content: 'The ticket category or support role is unavailable. Please ask an admin to rerun /setup.',
      ephemeral: true,
    });
    return;
  }

  const reason = interaction.fields.getTextInputValue(config.ticketCreation.reasonInput.customId).trim();
  const uploadedFiles = interaction.fields.getUploadedFiles(config.ticketCreation.imageInput.customId, false);
  const uploadedFile = uploadedFiles?.first();
  const nextTicketNumber = (setupData.ticketCount || 0) + 1;
  db.prepare(`
    UPDATE ${config.setup.database.tableName}
    SET ticket_count = ticket_count + 1
    WHERE guild_id = ?
  `).run(interaction.guildId);

  const safeName = sanitizeChannelName(interaction.user.username) || interaction.user.id.slice(0, 8);
  const channelName = `ticket-${safeName}-${nextTicketNumber}`;

  const ticketChannel = await interaction.guild.channels.create({
    name: channelName,
    type: ChannelType.GuildText,
    parent: category.id,
    permissionOverwrites: [
      {
        id: interaction.guild.roles.everyone.id,
        deny: [
          PermissionsBitField.Flags.ViewChannel,
          PermissionsBitField.Flags.SendMessages,
          PermissionsBitField.Flags.ReadMessageHistory,
        ],
      },
      {
        id: supportRole.id,
        allow: [
          PermissionsBitField.Flags.ViewChannel,
          PermissionsBitField.Flags.SendMessages,
          PermissionsBitField.Flags.ReadMessageHistory,
          PermissionsBitField.Flags.AttachFiles,
        ],
      },
      {
        id: interaction.user.id,
        allow: [
          PermissionsBitField.Flags.ViewChannel,
          PermissionsBitField.Flags.SendMessages,
          PermissionsBitField.Flags.ReadMessageHistory,
          PermissionsBitField.Flags.AttachFiles,
        ],
      },
    ],
    reason: `Ticket created for ${interaction.user.tag} (${ticketType.name})`,
  });

  const ticketEmbed = new EmbedBuilder()
    .setTitle(`${ticketType.name} ticket created`)
    .setDescription(`Ticket created by <@${interaction.user.id}>\n\n**Reason**\n${reason || 'No reason provided'}`)
    .setColor(0x2b2d31)
    .addFields(
      { name: 'Status', value: 'Open', inline: true },
      { name: 'Claimed by', value: 'No one', inline: true },
    )
    .setTimestamp();

  const files = [];
  if (uploadedFile) {
    files.push(uploadedFile);
    if (uploadedFile.contentType?.startsWith('image/') && uploadedFile.name) {
      ticketEmbed.setImage(`attachment://${uploadedFile.name}`);
    }
  }

  const ticketMessage = await ticketChannel.send({
    embeds: [ticketEmbed],
    components: [
      new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId(config.ticket.claimButton.customId)
          .setLabel(config.ticket.claimButton.label)
          .setStyle(config.ticket.claimButton.style),
        new ButtonBuilder()
          .setCustomId(config.ticket.closeButton.customId)
          .setLabel(config.ticket.closeButton.label)
          .setStyle(config.ticket.closeButton.style),
      ),
    ],
    files,
  });

  setupCommand.saveTicketMetadata(db, {
    channelId: ticketChannel.id,
    guildId: interaction.guildId,
    typeId: ticketType.type_id,
    creatorId: interaction.user.id,
    claimUserId: null,
    reason,
    status: 'open',
    ticketMessageId: ticketMessage.id,
  });

  await interaction.reply({
    content: `${ticketType.name} successfully created <#${ticketChannel.id}>`,
    ephemeral: true,
  });
}

module.exports = {
  handlePromptTypeSelect,
  handlePromptTypeButton,
  handleTicketCreationModalSubmit,
};
