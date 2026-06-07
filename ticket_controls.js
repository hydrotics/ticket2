const {
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  PermissionsBitField,
} = require('discord.js');

const config = require('./config');
const setupCommand = require('./commands/setup');

function formatRelativeAge(timestamp) {
  if (!timestamp) return '';
  const then = new Date(timestamp).getTime();
  const now = Date.now();
  const diff = Math.max(0, now - then);
  const seconds = Math.floor(diff / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (days >= 1) return `${days} day${days === 1 ? '' : 's'} ago`;
  if (hours >= 1) return `${hours} hour${hours === 1 ? '' : 's'} ago`;
  if (minutes >= 1) return `${minutes} minute${minutes === 1 ? '' : 's'} ago`;
  return `${seconds} second${seconds === 1 ? '' : 's'} ago`;
}

function buildTicketEmbed(ticketTypeName, creatorId, reason, status, claimedBy, updatedAt) {
  const statusValue = status === 'closed'
    ? updatedAt
      ? `Closed · <t:${Math.floor(new Date(updatedAt).getTime() / 1000)}:R>`
      : 'Closed'
    : 'Open';

  return new EmbedBuilder()
    .setTitle(`${ticketTypeName} ticket created`)
    .setDescription(`Ticket created by <@${creatorId}>\n\n**Reason**\n${reason || 'No reason provided'}`)
    .addFields(
      {
        name: 'Status',
        value: statusValue,
        inline: true,
      },
      {
        name: 'Claimed by',
        value: claimedBy ? `<@${claimedBy}>` : 'No one',
        inline: true,
      },
    )
    .setColor(0x2b2d31)
    .setTimestamp();
}

function buildTicketButtons(status, claimedBy) {
  const row = new ActionRowBuilder();

  if (status === 'closed') {
    row.addComponents(
      new ButtonBuilder()
        .setCustomId(config.ticket.reopenButton.customId)
        .setLabel(config.ticket.reopenButton.label)
        .setStyle(config.ticket.reopenButton.style),
      new ButtonBuilder()
        .setCustomId(config.ticket.deleteButton.customId)
        .setLabel(config.ticket.deleteButton.label)
        .setStyle(config.ticket.deleteButton.style),
    );
    return [row];
  }

  row.addComponents(
    new ButtonBuilder()
      .setCustomId(config.ticket.claimButton.customId)
      .setLabel(claimedBy ? 'Ticket claimed' : config.ticket.claimButton.label)
      .setStyle(config.ticket.claimButton.style)
      .setDisabled(Boolean(claimedBy)),
    new ButtonBuilder()
      .setCustomId(config.ticket.closeButton.customId)
      .setLabel(config.ticket.closeButton.label)
      .setStyle(config.ticket.closeButton.style),
  );

  return [row];
}

function buildConfirmRow(action) {
  const row = new ActionRowBuilder();

  if (action === 'close') {
    row.addComponents(
      new ButtonBuilder()
        .setCustomId(config.ticket.confirmCloseButton.customId)
        .setLabel(config.ticket.confirmCloseButton.label)
        .setStyle(config.ticket.confirmCloseButton.style),
      new ButtonBuilder()
        .setCustomId(config.ticket.cancelButton.customId)
        .setLabel(config.ticket.cancelButton.label)
        .setStyle(config.ticket.cancelButton.style),
    );
    return [row];
  }

  if (action === 'delete') {
    row.addComponents(
      new ButtonBuilder()
        .setCustomId(config.ticket.confirmDeleteButton.customId)
        .setLabel(config.ticket.confirmDeleteButton.label)
        .setStyle(config.ticket.confirmDeleteButton.style),
      new ButtonBuilder()
        .setCustomId(config.ticket.cancelButton.customId)
        .setLabel(config.ticket.cancelButton.label)
        .setStyle(config.ticket.cancelButton.style),
    );
    return [row];
  }

  return [
    new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId(config.ticket.cancelButton.customId)
        .setLabel(config.ticket.cancelButton.label)
        .setStyle(config.ticket.cancelButton.style),
    ),
  ];
}

function isSupportUser(interaction, setupData) {
  if (!interaction.member || !setupData) return false;
  const memberRoles = interaction.member.roles?.cache;
  if (memberRoles?.has(setupData.supportRoleId)) return true;
  return interaction.member.permissions?.has(PermissionsBitField.Flags.Administrator);
}

async function fetchTicketMessage(channel, ticketData) {
  if (!ticketData?.ticketMessageId) return null;

  try {
    return await channel.messages.fetch(ticketData.ticketMessageId);
  } catch {
    return null;
  }
}

async function updateTicketEmbed(channel, ticketData, ticketType, db) {
  const ticketMessage = await fetchTicketMessage(channel, ticketData);
  const embed = buildTicketEmbed(
    ticketType.name,
    ticketData.creatorId,
    ticketData.reason,
    ticketData.status,
    ticketData.claimUserId,
    ticketData.updatedAt,
  );

  const components = buildTicketButtons(ticketData.status, ticketData.claimUserId);

  if (ticketMessage) {
    await ticketMessage.edit({ embeds: [embed], components });
    return ticketMessage;
  }

  const newMessage = await channel.send({ embeds: [embed], components });
  if (db) {
    setupCommand.updateTicketMetadata(db, channel.id, {
      ticketMessageId: newMessage.id,
    });
  }
  return newMessage;
}

async function handleClaimButton(interaction, db) {
  if (!interaction.inGuild()) return;

  const setupData = setupCommand.getGuildSetup(db, interaction.guildId);
  const ticketData = setupCommand.getTicketByChannel(db, interaction.channelId);
  if (!setupData || !ticketData) {
    await interaction.reply({ content: 'This ticket is not registered in the system.', ephemeral: true });
    return;
  }

  if (!isSupportUser(interaction, setupData)) {
    await interaction.reply({ content: 'Only support team members can claim tickets.', ephemeral: true });
    return;
  }

  if (ticketData.status !== 'open') {
    await interaction.reply({ content: 'Only open tickets can be claimed.', ephemeral: true });
    return;
  }

  if (ticketData.claimUserId === interaction.user.id) {
    await interaction.reply({ content: 'You already claimed this ticket.', ephemeral: true });
    return;
  }

  const ticketType = setupCommand.getTicketTypeById(db, interaction.guildId, ticketData.typeId);
  if (!ticketType) {
    await interaction.reply({ content: 'The ticket type configuration is missing. Please ask an admin to update setup.', ephemeral: true });
    return;
  }

  const updatedTicket = setupCommand.updateTicketMetadata(db, interaction.channelId, {
    claimUserId: interaction.user.id,
  });

  if (updatedTicket) {
    await updateTicketEmbed(interaction.channel, updatedTicket, ticketType, db);
  }

  await interaction.reply({ content: `This ticket will be handled by <@${interaction.user.id}>.`, ephemeral: false });
}

async function handleCloseButton(interaction, db) {
  if (!interaction.inGuild()) return;

  const setupData = setupCommand.getGuildSetup(db, interaction.guildId);
  if (!setupData) {
    await interaction.reply({ content: 'Setup is incomplete for this server.', ephemeral: true });
    return;
  }

  if (!isSupportUser(interaction, setupData)) {
    await interaction.reply({ content: 'Only support team members can close tickets.', ephemeral: true });
    return;
  }

  await interaction.reply({
    content: 'Are you sure you want to close this ticket?',
    components: buildConfirmRow('close'),
    ephemeral: true,
  });
}

async function handleConfirmCloseButton(interaction, db) {
  if (!interaction.inGuild()) return;

  const setupData = setupCommand.getGuildSetup(db, interaction.guildId);
  const ticketData = setupCommand.getTicketByChannel(db, interaction.channelId);

  if (!setupData || !ticketData) {
    await interaction.reply({ content: 'This ticket is not registered in the system.', ephemeral: true });
    return;
  }

  if (!isSupportUser(interaction, setupData)) {
    await interaction.reply({ content: 'Only support team members can close tickets.', ephemeral: true });
    return;
  }

  if (ticketData.status === 'closed') {
    await interaction.reply({ content: 'This ticket is already closed.', ephemeral: true });
    return;
  }

  const ticketType = setupCommand.getTicketTypeById(db, interaction.guildId, ticketData.typeId);
  if (!ticketType) {
    await interaction.reply({ content: 'The ticket type configuration is missing. Please ask an admin to update setup.', ephemeral: true });
    return;
  }

  await interaction.channel.setParent(setupData.closedTicketsCategoryId, { lockPermissions: false });
  await interaction.channel.permissionOverwrites.edit(ticketData.creatorId, {
    ViewChannel: false,
    SendMessages: false,
    ReadMessageHistory: false,
  });

  const updatedTicket = setupCommand.updateTicketMetadata(db, interaction.channelId, {
    status: 'closed',
  });

  if (updatedTicket) {
    await updateTicketEmbed(interaction.channel, updatedTicket, ticketType, db);
  }

  await interaction.reply({ content: 'Ticket closed successfully.', ephemeral: true });
}

async function handleDeleteButton(interaction, db) {
  if (!interaction.inGuild()) return;

  const setupData = setupCommand.getGuildSetup(db, interaction.guildId);
  if (!setupData) {
    await interaction.reply({ content: 'Setup is incomplete for this server.', ephemeral: true });
    return;
  }

  if (!isSupportUser(interaction, setupData)) {
    await interaction.reply({ content: 'Only support team members can delete tickets.', ephemeral: true });
    return;
  }

  await interaction.reply({
    content: 'Delete this ticket permanently?',
    components: buildConfirmRow('delete'),
    ephemeral: true,
  });
}

async function handleConfirmDeleteButton(interaction, db) {
  if (!interaction.inGuild()) return;

  const setupData = setupCommand.getGuildSetup(db, interaction.guildId);
  const ticketData = setupCommand.getTicketByChannel(db, interaction.channelId);

  if (!setupData || !ticketData) {
    await interaction.reply({ content: 'This ticket is not registered in the system.', ephemeral: true });
    return;
  }

  if (!isSupportUser(interaction, setupData)) {
    await interaction.reply({ content: 'Only support team members can delete tickets.', ephemeral: true });
    return;
  }

  await interaction.reply({ content: 'Deleting ticket...', ephemeral: true });
  setupCommand.deleteTicketMetadata(db, interaction.channelId);
  await interaction.channel.delete('Ticket deleted by support team');
}

async function handleReopenButton(interaction, db) {
  if (!interaction.inGuild()) return;

  const setupData = setupCommand.getGuildSetup(db, interaction.guildId);
  const ticketData = setupCommand.getTicketByChannel(db, interaction.channelId);

  if (!setupData || !ticketData) {
    await interaction.reply({ content: 'This ticket is not registered in the system.', ephemeral: true });
    return;
  }

  if (!isSupportUser(interaction, setupData)) {
    await interaction.reply({ content: 'Only support team members can reopen tickets.', ephemeral: true });
    return;
  }

  if (ticketData.status !== 'closed') {
    await interaction.reply({ content: 'Only closed tickets can be reopened.', ephemeral: true });
    return;
  }

  const ticketType = setupCommand.getTicketTypeById(db, interaction.guildId, ticketData.typeId);
  if (!ticketType) {
    await interaction.reply({ content: 'The ticket type configuration is missing. Please ask an admin to update setup.', ephemeral: true });
    return;
  }

  await interaction.channel.setParent(ticketType.category_id, { lockPermissions: false });
  await interaction.channel.permissionOverwrites.edit(ticketData.creatorId, {
    ViewChannel: true,
    SendMessages: true,
    ReadMessageHistory: true,
    AttachFiles: true,
  });

  const updatedTicket = setupCommand.updateTicketMetadata(db, interaction.channelId, {
    status: 'open',
  });

  if (updatedTicket) {
    await updateTicketEmbed(interaction.channel, updatedTicket, ticketType, db);
  }

  await interaction.reply({ content: 'Ticket has been reopened.', ephemeral: true });
}

async function handleCancelButton(interaction) {
  if (!interaction.isRepliable()) return;
  await interaction.reply({ content: 'Action cancelled.', ephemeral: true });
}

module.exports = {
  handleClaimButton,
  handleCloseButton,
  handleConfirmCloseButton,
  handleDeleteButton,
  handleConfirmDeleteButton,
  handleReopenButton,
  handleCancelButton,
};
