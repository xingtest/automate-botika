const BaseNode = require('./base-node');
const { TelegramClient } = require('telegram');
const { StringSession } = require('telegram/sessions');

class TelegramNode extends BaseNode {
  constructor() {
    super('telegram', 'Telegram Client', 'action');
    this.description = 'Interact with Telegram bots using GramJS';
    this.icon = 'fa-paper-plane';
    this.color = '#0088cc';
  }

  async execute(context, inputData) {
    const apiId = this.getField(context, inputData, 'api_id');
    const apiHash = this.getField(context, inputData, 'api_hash');
    const sessionString = this.getField(context, inputData, 'session_string');
    const botUsername = this.getField(context, inputData, 'bot_username');
    const greeting = this.getField(context, inputData, 'greeting');
    const maxWaitSeconds = parseInt(this.getField(context, inputData, 'max_wait') || '20', 10);

    if (!apiId || !apiHash || !sessionString || !botUsername) {
      throw new Error('Missing required Telegram credentials: api_id, api_hash, session_string, or bot_username');
    }

    this.logTechnical(context, 'info', `Connecting to Telegram for bot: ${botUsername}`);

    const stringSession = new StringSession(sessionString);
    const client = new TelegramClient(stringSession, parseInt(apiId), apiHash, {
      connectionRetries: 5,
    });

    try {
      await client.connect();
      this.logTechnical(context, 'info', 'Telegram client connected');

      const results = [];
      const testCases = Array.isArray(inputData) ? inputData : (inputData.testCases || []);

      // Handle greeting
      if (greeting) {
        await client.sendMessage(botUsername, { message: greeting });
        await this.waitForBot(client, botUsername, greeting, maxWaitSeconds);
      }

      for (const testCase of testCases) {
        const question = testCase.pertanyaan || testCase.question;
        if (!question) continue;

        this.logTechnical(context, 'info', `Sending question: "${question}"`);
        const startTime = Date.now();
        
        await client.sendMessage(botUsername, { message: question });
        const responseText = await this.captureResponse(client, botUsername, question, maxWaitSeconds);
        
        const duration = Date.now() - startTime;
        results.push({
          ...testCase,
          actual_response: responseText,
          duration_ms: duration,
          status: responseText ? 'success' : 'failed'
        });

        this.logTechnical(context, 'info', `Captured response: ${responseText.substring(0, 50)}...`);
      }

      await client.disconnect();
      return {
        success: true,
        results,
        total_tested: results.length,
        platform: 'telegram',
        bot_username: botUsername
      };

    } catch (error) {
      this.logTechnical(context, 'error', `Telegram execution failed: ${error.message}`);
      if (client) await client.disconnect();
      throw error;
    }
  }

  async captureResponse(client, botUsername, userMessage, maxWait) {
    let attempts = 0;
    const normalizedUser = userMessage.trim().toLowerCase();
    
    while (attempts < maxWait / 2) {
      await new Promise(r => setTimeout(r, 2000));
      attempts++;

      const messages = await client.getMessages(botUsername, { limit: 10 });
      let qIndex = -1;

      for (let i = 0; i < messages.length; i++) {
        const msg = messages[i];
        if (msg.out && msg.text && msg.text.trim().toLowerCase().includes(normalizedUser)) {
          qIndex = i;
          break;
        }
      }

      if (qIndex !== -1) {
        const botReplies = [];
        for (let i = 0; i < qIndex; i++) {
          const msg = messages[i];
          if (!msg.out && msg.text) {
            botReplies.push(msg.text);
          }
        }
        if (botReplies.length > 0) {
          return botReplies.reverse().join('\n');
        }
      }
    }
    return '';
  }

  async waitForBot(client, botUsername, userMessage, maxWait) {
    await this.captureResponse(client, botUsername, userMessage, maxWait);
  }

  getField(context, inputData, fieldName) {
    if (context.config && context.config[fieldName] !== undefined) {
      return context.config[fieldName];
    }
    if (inputData && inputData[fieldName] !== undefined) {
      return inputData[fieldName];
    }
    return null;
  }
}

module.exports = TelegramNode;
