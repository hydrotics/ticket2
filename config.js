const { ChannelType, ButtonStyle } = require('discord.js');

module.exports = {
  setup: {
    commandName: 'setup',
    commandDescription: 'Open the ticket system setup modal.',
    modal: {
      customId: 'ticket_setup_modal',
      title: 'Ticket System Setup',
      supportRole: {
        label: 'Support role',
        description: 'Select the role that should handle tickets.',
        placeholder: 'Choose the support team role',
        customId: 'setup_support_role',
      },
      ticketPromptChannel: {
        label: 'Ticket prompt channel',
        description: 'Where the ticket prompt message will be sent.',
        placeholder: 'Choose the prompt channel',
        customId: 'setup_ticket_prompt_channel',
        channelTypes: [ChannelType.GuildText],
      },
      closedTicketsCategory: {
        label: 'Closed tickets category',
        description: 'Category used for closed or archived tickets.',
        placeholder: 'Choose the closed tickets category',
        customId: 'setup_closed_tickets_category',
        channelTypes: [ChannelType.GuildCategory],
      },
    },
    finishButton: {
      customId: 'setup_finish',
      label: 'Finish setup',
    },
    messages: {
      summaryTitle: 'Ticket setup confirmation',
      summaryDescription: 'Review the saved settings below.',
      completedPublicText: 'Setup completed successfully!',
      completedEphemeralText: 'Setup completed successfully!',
    },
    ticketTypes: {
      addButton: {
        customId: 'setup_add_ticket_type',
        label: 'Add ticket type',
      },
      modal: {
        customId: 'ticket_type_modal',
        title: 'Create ticket type',
        name: {
          label: 'Ticket type name',
          description: 'Enter a name for this ticket type.',
          placeholder: 'e.g. Support request',
          customId: 'ticket_type_name',
        },
        category: {
          label: 'Ticket category',
          description: 'Choose the category to place tickets under.',
          placeholder: 'Select category',
          customId: 'ticket_type_category',
          channelTypes: [ChannelType.GuildCategory],
        },
        description: {
          label: 'Ticket type description',
          description: 'Optional description shown in the ticket type selector.',
          placeholder: 'Optional description',
          customId: 'ticket_type_description',
        },
      },
      embed: {
        title: 'Ticket type creation',
        description:
          'Create ticket types now and assign each one to a category where the ticket will be opened.',
        noTypesText: 'No ticket types created yet. Click the button below to add one.',
      },
      messages: {
        createdTypeText: 'Ticket type saved successfully.',
      },
    },
    embed: {
      color: 0x2b2d31,
    },
    database: {
      filePath: './ticket-system.sqlite',
      tableName: 'guild_ticket_settings',
      ticketTypesTableName: 'guild_ticket_types',
    },
  },
  editPrompt: {
    commandName: 'edit_prompt',
    commandDescription: 'Preview and edit the ticket creation prompt embed before sending.',
    embedOption: {
      name: 'embed',
      description: 'Choose which prompt template to preview.',
      choices: [{ name: 'default', value: 'default' }],
    },
    configOption: {
      name: 'config',
      description: 'Open the prompt configuration modal.',
    },
    configModal: {
      customId: 'edit_prompt_config_modal',
    },
    promptTypeSelect: {
      customId: 'prompt_ticket_type_select',
      placeholder: 'Choose a ticket type',
      noTypesLabel: 'No ticket types available',
      noTypesValue: 'none',
    },
    promptTypeButton: {
      customIdPrefix: 'prompt_ticket_type_button_',
    },
    promptTypeConfig: {
      customId: 'prompt_type_selector',
      label: 'Prompt interaction type',
      description: 'Choose whether the prompt should use a dropdown or buttons.',
      options: [
        {
          label: 'Dropdown',
          value: 'dropdown',
          description: 'Show ticket type choices in a dropdown.',
        },
        {
          label: 'Buttons',
          value: 'buttons',
          description: 'Show ticket type choices as buttons.',
        },
      ],
    },
    defaultPromptType: 'dropdown',
    defaultEmbed: {
      title: 'Create a ticket',
      description: 'Use the dropdown below to choose a ticket type. Our support team is ready to help.',
      color: 0x2b2d31,
      footerText: 'Ticket system prompt',
      footerIconUrl: '',
      imageUrl: '',
      thumbnailUrl: '',
    },
    buttons: {
      edit: {
        customId: 'edit_prompt_edit',
        label: 'Edit preview',
        style: ButtonStyle.Primary,
      },
      send: {
        customId: 'edit_prompt_send',
        label: 'Send prompt',
        style: ButtonStyle.Success,
      },
    },
    modal: {
      customId: 'edit_prompt_modal',
      title: 'Edit prompt embed',
      promptType: {
        label: 'Prompt component style',
        description: 'Choose whether the prompt uses a dropdown or buttons.',
        customId: 'prompt_type_choice',
      },
      titleInput: {
        label: 'Embed title',
        placeholder: 'Enter the prompt title',
        customId: 'prompt_title',
      },
      descriptionInput: {
        label: 'Embed description',
        placeholder: 'Enter the prompt description',
        customId: 'prompt_description',
      },
      footerInput: {
        label: 'Footer text',
        placeholder: 'Enter footer text',
        customId: 'prompt_footer',
      },
      imageInput: {
        label: 'Image URL',
        placeholder: 'https://example.com/image.png',
        customId: 'prompt_image',
      },
      thumbnailInput: {
        label: 'Thumbnail URL',
        placeholder: 'https://example.com/thumb.png',
        customId: 'prompt_thumbnail',
      },
      colorInput: {
        label: 'Embed color (hex)',
        placeholder: '#2b2d31',
        customId: 'prompt_color',
      },
    },
    previewTitle: 'Prompt preview',
  },
  ticketCreation: {
    modal: {
      customId: 'ticket_creation_modal',
      title: 'Open a ticket',
    },
    reasonInput: {
      label: 'Reason for opening',
      placeholder: 'Why do you need support?',
      customId: 'ticket_reason',
    },
    imageInput: {
      label: 'Optional attachment',
      placeholder: 'Upload an image or video file',
      customId: 'ticket_attachment',
    },
  },
  ticket: {
    claimButton: {
      customId: 'ticket_claim',
      label: 'Claim Ticket',
      style: ButtonStyle.Secondary,
    },
    closeButton: {
      customId: 'ticket_close',
      label: 'Close Ticket',
      style: ButtonStyle.Danger,
    },
    reopenButton: {
      customId: 'ticket_reopen',
      label: 'Reopen Ticket',
      style: ButtonStyle.Success,
    },
    deleteButton: {
      customId: 'ticket_delete',
      label: 'Delete Ticket',
      style: ButtonStyle.Danger,
    },
    confirmCloseButton: {
      customId: 'ticket_confirm_close',
      label: 'Close',
      style: ButtonStyle.Danger,
    },
    confirmDeleteButton: {
      customId: 'ticket_confirm_delete',
      label: 'Delete',
      style: ButtonStyle.Danger,
    },
    cancelButton: {
      customId: 'ticket_cancel',
      label: 'Cancel',
      style: ButtonStyle.Secondary,
    },
  },
};