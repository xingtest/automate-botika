/**
 * Send Notification Node Executor
 * Creates notifications in the dashboard notification panel, Telegram, or Email
 */

const BaseNode = require('./base-node');
const { pool: db } = require('../../db');

class SendNotificationNode extends BaseNode {
  constructor() {
    super({
      type: 'send-notification',
      category: 'Actions',
      name: 'Send Notification',
      description: 'Send notification to dashboard notification panel',
      icon: 'fa-bell',
      color: '#9333ea',
      inputs: [
        {
          id: 'input',
          label: 'Input',
          dataType: 'any',
          required: false
        }
      ],
      outputs: [
        {
          id: 'output',
          label: 'Output',
          dataType: 'object'
        }
      ],
      config_schema: [
        {
          key: 'channel',
          label: 'Channel',
          type: 'select',
          required: true,
          default: 'dashboard',
          options: [
            { value: 'dashboard', label: 'Dashboard' },
            { value: 'telegram', label: 'Telegram' },
            { value: 'email', label: 'Email' }
          ],
          description: 'Channel pengiriman notifikasi'
        },
        {
          key: 'recipient',
          label: 'Recipient',
          type: 'text',
          required: false,
          placeholder: 'Email, Chat ID, or username',
          description: 'Alamat email, Chat ID Telegram, atau username dashboard'
        },
        {
          key: 'title',
          label: 'Title',
          type: 'text',
          required: true,
          placeholder: 'Notification title',
          description: 'Title of the notification'
        },
        {
          key: 'message',
          label: 'Message',
          type: 'textarea',
          required: true,
          placeholder: 'Notification message',
          description: 'Isi pesan. Gunakan {{variable}} untuk menyisipkan data dinamis'
        },
        {
          key: 'type',
          label: 'Type',
          type: 'select',
          required: true,
          default: 'info',
          options: [
            { value: 'info', label: 'Info' },
            { value: 'success', label: 'Success' },
            { value: 'warning', label: 'Warning' },
            { value: 'error', label: 'Error' }
          ],
          description: 'Notification type'
        },
        {
          key: 'recipients',
          label: 'Recipients',
          type: 'text',
          required: false,
          placeholder: 'user1,user2 (leave empty for current user)',
          description: 'Comma-separated list of usernames (optional, dashboard channel only)'
        }
      ]
    });
  }

  /**
   * Execute the send notification node
   * @param {ExecutionContext} context - Execution context
   * @param {Object} config - Node configuration
   * @param {Object} node - Full node object
   * @returns {Promise<Object>} - Notification metadata
   */
  async execute(context, config, node) {
    this.log('info', `Executing Send Notification node: ${node.id}`);

    // Get input data for template substitution
    const inputData = this.getInput(context, 'input') || {};

    // Substitute template variables in title and message
    const processedTitle = this.substituteVariables(config.title, inputData, context);
    const processedMessage = this.substituteVariables(config.message, inputData, context);

    const channel = config.channel || 'dashboard';
    let result;

    switch (channel) {
      case 'telegram':
        result = await this.sendTelegramNotification(config, processedTitle, processedMessage);
        break;
      case 'email':
        result = await this.sendEmailNotification(config, processedTitle, processedMessage);
        break;
      case 'dashboard':
      default:
        result = await this.sendDashboardNotification(context, config, processedTitle, processedMessage);
        break;
    }

    this.setOutput(context, result, 'output');

    return result;
  }

  /**
   * Send notification to the dashboard notification panel
   * @param {ExecutionContext} context
   * @param {Object} config
   * @param {string} title
   * @param {string} message
   * @returns {Promise<Object>}
   */
  async sendDashboardNotification(context, config, title, message) {
    const { type = 'info', recipients } = config;

    // Parse recipients
    const recipientList = recipients
      ? recipients.split(',').map(r => r.trim()).filter(r => r)
      : [];

    // If no recipients specified, use current user
    const userId = context.user_id;
    const targetUserIds = recipientList.length > 0
      ? await this.getUserIdsByUsernames(recipientList)
      : [userId];

    // Create notifications for each recipient
    const notifications = [];
    for (const targetUserId of targetUserIds) {
      try {
        const result = await db.queryOriginal(
          `INSERT INTO notifications (user_id, title, message, type, is_read, created_at)
           VALUES ($1, $2, $3, $4, false, CURRENT_TIMESTAMP)
           RETURNING id, user_id, title, message, type, is_read, created_at`,
          [targetUserId, title, message, type]
        );

        notifications.push(result.rows[0]);

        this.log('info', `Notification created for user ${targetUserId}`, {
          notification_id: result.rows[0].id,
          type
        });
      } catch (error) {
        this.log('error', `Failed to create notification for user ${targetUserId}`, {
          error: error.message
        });
      }
    }

    return {
      success: notifications.length > 0,
      notifications_sent: notifications.length,
      notifications: notifications.map(n => ({
        id: n.id,
        user_id: n.user_id,
        title: n.title,
        type: n.type,
        created_at: n.created_at
      })),
      title,
      message,
      type
    };
  }

  /**
   * Send notification via Telegram Bot API
   * @param {Object} config
   * @param {string} title
   * @param {string} message
   * @returns {Promise<Object>}
   */
  async sendTelegramNotification(config, title, message) {
    const botToken = process.env.TELEGRAM_BOT_TOKEN;
    if (!botToken) {
      return { success: false, error_message: 'TELEGRAM_BOT_TOKEN is not configured' };
    }

    const chatId = config.recipient;
    if (!chatId) {
      return { success: false, error_message: 'Telegram Chat ID (recipient) is required' };
    }

    try {
      const text = `*${title}*\n${message}`;
      const response = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chat_id: chatId, text, parse_mode: 'Markdown' })
      });
      const data = await response.json();

      if (data.ok) {
        return {
          success: true,
          notifications_sent: 1,
          notifications: [{ channel: 'telegram', chat_id: chatId }],
          title,
          message
        };
      } else {
        return { success: false, error_message: data.description || 'Telegram API error' };
      }
    } catch (err) {
      this.log('error', 'Telegram notification failed', { error: err.message });
      return { success: false, error_message: err.message };
    }
  }

  /**
   * Send notification via Email using nodemailer
   * @param {Object} config
   * @param {string} title
   * @param {string} message
   * @returns {Promise<Object>}
   */
  async sendEmailNotification(config, title, message) {
    try {
      const nodemailer = require('nodemailer');
      const transporter = nodemailer.createTransport({
        host: process.env.SMTP_HOST || 'localhost',
        port: parseInt(process.env.SMTP_PORT || '587'),
        secure: false,
        auth: process.env.SMTP_USER ? {
          user: process.env.SMTP_USER,
          pass: process.env.SMTP_PASS
        } : undefined
      });

      await transporter.sendMail({
        from: process.env.SMTP_FROM || process.env.SMTP_USER || 'noreply@ci-dashboard.local',
        to: config.recipient,
        subject: title,
        text: message,
        html: `<h2>${title}</h2><p>${message}</p>`
      });

      return {
        success: true,
        notifications_sent: 1,
        notifications: [{ channel: 'email', recipient: config.recipient }],
        title,
        message
      };
    } catch (err) {
      this.log('error', 'Email notification failed', { error: err.message });
      return { success: false, error_message: err.message };
    }
  }

  /**
   * Substitute template variables in text
   * @param {string} text - Text with template variables
   * @param {Object} inputData - Input data
   * @param {ExecutionContext} context - Execution context
   * @returns {string} - Processed text
   */
  substituteVariables(text, inputData, context) {
    if (!text) return '';

    let result = text;

    // Replace {{variable}} with values from input data
    result = result.replace(/\{\{([^}]+)\}\}/g, (match, variable) => {
      const trimmed = variable.trim();

      // Check if it's a node output reference (e.g., node_id.field)
      if (trimmed.includes('.')) {
        const [nodeId, ...fieldPath] = trimmed.split('.');
        const nodeOutput = context.getNodeOutput ? context.getNodeOutput(nodeId) : null;

        if (nodeOutput) {
          return this.getNestedValue(nodeOutput, fieldPath.join('.')) || match;
        }
      }

      // Check input data
      if (inputData.hasOwnProperty(trimmed)) {
        return inputData[trimmed];
      }

      // Return original if not found
      return match;
    });

    return result;
  }

  /**
   * Get nested value from object using dot notation
   * @param {Object} obj - Object
   * @param {string} path - Dot-separated path
   * @returns {any} - Value or undefined
   */
  getNestedValue(obj, path) {
    return path.split('.').reduce((current, key) => current?.[key], obj);
  }

  /**
   * Get user IDs by usernames
   * @param {Array<string>} usernames - Array of usernames
   * @returns {Promise<Array<number>>} - Array of user IDs
   */
  async getUserIdsByUsernames(usernames) {
    if (usernames.length === 0) return [];

    try {
      const placeholders = usernames.map((_, i) => `$${i + 1}`).join(',');
      const result = await db.queryOriginal(
        `SELECT id FROM users WHERE username IN (${placeholders})`,
        usernames
      );

      return result.rows.map(row => row.id);
    } catch (error) {
      this.log('error', 'Failed to get user IDs by usernames', {
        error: error.message,
        usernames
      });
      return [];
    }
  }
}

module.exports = SendNotificationNode;
