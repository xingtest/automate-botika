/**
 * Send Notification Node Executor
 * Creates notifications in the dashboard notification panel
 */

const BaseNode = require('./base-node');
const db = require('../../db');

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
          description: 'Message content (supports template variables like {{variable}})'
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
          description: 'Comma-separated list of usernames (optional)'
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
    
    const { title, message, type = 'info', recipients } = config;
    
    // Get input data for template substitution
    const inputData = this.getInput(context, 'input') || {};
    
    // Substitute template variables in title and message
    const processedTitle = this.substituteVariables(title, inputData, context);
    const processedMessage = this.substituteVariables(message, inputData, context);
    
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
        const result = await db.query(
          `INSERT INTO notifications (user_id, title, message, type, is_read, created_at)
           VALUES ($1, $2, $3, $4, false, CURRENT_TIMESTAMP)
           RETURNING id, user_id, title, message, type, is_read, created_at`,
          [targetUserId, processedTitle, processedMessage, type]
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
    
    const output = {
      success: notifications.length > 0,
      notifications_sent: notifications.length,
      notifications: notifications.map(n => ({
        id: n.id,
        user_id: n.user_id,
        title: n.title,
        type: n.type,
        created_at: n.created_at
      })),
      title: processedTitle,
      message: processedMessage,
      type
    };
    
    this.setOutput(context, output, 'output');
    
    return output;
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
        const nodeOutput = context.getNodeOutput(nodeId);
        
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
      const result = await db.query(
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
