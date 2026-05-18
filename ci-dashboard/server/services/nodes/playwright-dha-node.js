const BaseNode = require('./base-node');
const { chromium } = require('playwright');

class PlaywrightDHANode extends BaseNode {
  constructor() {
    super({
      type: 'playwright-dha',
      category: 'action',
      label: 'DHA Webchat Test',
      description: 'Execute Playwright test for DHA (Luna) Platform',
      icon: 'fa-robot',
      color: '#4B9CD3',
      inputs: [
        { id: 'main', name: 'Test Data', dataType: 'object', required: false }
      ],
      outputs: [
        { id: 'main', name: 'Test Results', dataType: 'object', required: true }
      ],
      config_schema: [
        {
          key: 'target_url',
          label: 'Target URL',
          type: 'text',
          required: true,
          default: 'https://dha.botika.online/',
          description: 'URL Webchat DHA yang akan dites'
        },
        {
          key: 'greeting',
          label: 'Greeting Message',
          type: 'text',
          required: false,
          default: 'Halo'
        },
        {
          key: 'greeting_2',
          label: 'Greeting Message 2',
          type: 'text',
          required: false,
          default: ''
        },
        {
          key: 'headless',
          label: 'Headless Mode',
          type: 'boolean',
          required: false,
          default: true
        },
        {
          key: 'wait_time',
          label: 'Wait Time (seconds)',
          type: 'number',
          required: false,
          default: 5,
          description: 'Waktu tunggu setelah mengirim pesan'
        }
      ]
    });
  }

  async execute(context, config) {
    const targetUrl = config.target_url || 'https://dha.botika.online/';
    const greeting = config.greeting !== undefined ? config.greeting : 'Halo';
    const greeting2 = config.greeting_2 || '';
    const headless = config.headless !== undefined ? config.headless : true;
    const waitTime = config.wait_time || 5;
    
    const inputData = this.getInput(context, 'main');
    const testData = inputData?.results || [];

    if (!targetUrl) {
      throw new Error('Target URL is required!');
    }

    this.log('info', `Starting DHA Test. Target: ${targetUrl}, Headless: ${headless}`);

    let browser;
    let results = [];

    try {
      this.logTechnical(context, 'info', 'Launching browser...');
      browser = await chromium.launch({ headless });
      const browserContext = await browser.newContext();
      const page = await browserContext.newPage();
      
      this.logTechnical(context, 'info', `Navigating to ${targetUrl}...`);
      await page.goto(targetUrl, { waitUntil: 'networkidle', timeout: 60000 });
      
      // Step 1: Start Chat (from dhai.ts)
      this.logTechnical(context, 'info', 'Initializing chat...');
      
      // Click "Tap to Start" button
      const tapToStartButton = page.locator('button:has-text("Tap to Start")');
      await tapToStartButton.waitFor({ state: 'visible', timeout: 30000 });
      await tapToStartButton.click();
      this.logTechnical(context, 'info', 'Clicked "Tap to Start" button.');
      await page.waitForTimeout(2000);

      // Click second interaction button
      const interactionButton = page.locator('#button-action-chat');
      await interactionButton.waitFor({ state: 'visible', timeout: 10000 });
      await interactionButton.click();
      this.logTechnical(context, 'info', 'Clicked interaction button.');

      // Wait for textarea to appear
      await page.locator('textarea').waitFor({ state: 'visible', timeout: 30000 });
      this.logTechnical(context, 'info', 'Chat interface ready.');

      // Send Greetings
      if (greeting && String(greeting).trim()) {
        this.logTechnical(context, 'info', `Sending greeting message: "${greeting}"`);
        await this.sendMessage(page, greeting);
        await page.waitForTimeout(waitTime * 1000);
      }

      if (greeting2 && String(greeting2).trim()) {
        this.logTechnical(context, 'info', `Sending second greeting message: "${greeting2}"`);
        await this.sendMessage(page, greeting2);
        await page.waitForTimeout(waitTime * 1000);
      }

      // Start Testing
      for (let i = 0; i < testData.length; i++) {
        const testItem = testData[i];
        const question = this.getField(testItem, ['question', 'pertanyaan', 'test_case']);
        const expected = this.getField(testItem, ['response_kb', 'expected', 'expected_answer', 'context']);
        const title = this.getField(testItem, ['title', 'topic']) || `Test ${i + 1}`;
        const no = this.getField(testItem, ['no', 'number']) || i + 1;

        if (!question) {
          this.log('warn', `Skipping item ${i + 1}: No question found`);
          continue;
        }

        this.logTechnical(context, 'info', `[${i + 1}/${testData.length}] Testing question: "${question.substring(0, 50)}..."`);
        
        const startTime = Date.now();
        await this.sendMessage(page, question);
        
        // Wait for reply (adapted from getReply in dhai.ts)
        const actual = await this.waitForReply(page, question, 30000);
        const duration = ((Date.now() - startTime) / 1000).toFixed(2);

        this.logTechnical(context, 'info', `[${i + 1}/${testData.length}] Received reply: "${actual.substring(0, 50)}..." (${duration}s)`);

        results.push({
          no,
          title,
          question,
          response_kb: expected,
          response_llm: actual,
          expected,
          actual,
          duration: `${duration}s`
        });

        // Delay antar pesan
        if (testData.length > 1 && i < testData.length - 1) {
          await page.waitForTimeout(2000);
        }
      }

      this.log('info', `Test completed: ${results.length} items`);

      return {
        success: true,
        results,
        total_tested: results.length,
        platform: 'dha',
        target_url: targetUrl
      };

    } catch (error) {
      this.log('error', `DHA Test Failed: ${error.message}`);
      throw error;
    } finally {
      if (browser) {
        await browser.close();
        this.logTechnical(context, 'info', 'Browser closed');
      }
    }
  }

  async sendMessage(page, message) {
    try {
      if (!message || !String(message).trim()) return;

      const textarea = page.locator('textarea');
      await textarea.waitFor({ state: 'visible', timeout: 10000 });
      await textarea.click();
      await textarea.fill(String(message));
      await page.waitForTimeout(500);
      await page.keyboard.press('Enter');
      
    } catch (error) {
      this.log('warn', `Failed to send message: ${error.message}`);
      throw error;
    }
  }

  async waitForReply(page, userMessage, timeoutMs = 30000) {
    const startedAt = Date.now();
    let responses = [];

    // DHA typically takes some time to process
    await page.waitForTimeout(3000);

    while (Date.now() - startedAt < timeoutMs) {
      responses = await this.extractBotResponse(page, userMessage);
      if (responses.length > 0) {
        return responses.join('\n');
      }
      await page.waitForTimeout(2000);
    }

    return 'No response captured';
  }

  async extractBotResponse(page, userMessage) {
    try {
      return await page.evaluate((userMsg) => {
        const messageSelectors = [
          'span.whitespace-pre-line',
          'span[data-v-4699965e]',
          'span[class*="whitespace"]',
          'div[class*="message"]',
          'div[class*="chat"]',
          'div[class*="bubble"]',
        ];

        let chatMessages = [];
        for (const selector of messageSelectors) {
          const found = Array.from(document.querySelectorAll(selector));
          if (found.length > 0) {
            chatMessages = found;
            break;
          }
        }

        if (chatMessages.length === 0) return [];

        const questionIndices = [];
        chatMessages.forEach((el, i) => {
          if (el.textContent && el.textContent.includes(userMsg)) {
            questionIndices.push(i);
          }
        });

        if (questionIndices.length === 0) {
           // Fallback: last 3 messages that don't include userMsg
           return chatMessages.slice(-3)
            .map(el => el.textContent.trim())
            .filter(text => text && !text.includes(userMsg))
            .slice(-1); // Just the very last one for simplicity if no question match
        }

        const questionIndex = questionIndices[questionIndices.length - 1];
        const botResponses = [];
        
        const uiNoisePatterns = [
          /^Enter$/i,
          /^Send$/i,
          /^Sent$/i,
          /^\d{2}:\d{2}$/,
          /^[0-9]+$/,
        ];

        for (let i = questionIndex + 1; i < chatMessages.length; i++) {
          const text = chatMessages[i].textContent;
          if (!text || !text.trim()) continue;

          let cleanText = text.trim();
          if (cleanText.includes(userMsg)) continue;

          const isExactNoise = uiNoisePatterns.some(pattern => pattern.test(cleanText));
          if (isExactNoise) continue;

          if (botResponses.length > 0 && botResponses[botResponses.length - 1] === cleanText) continue;

          botResponses.push(cleanText);
        }

        return botResponses;
      }, userMessage);
    } catch (error) {
      return [];
    }
  }

  getField(item, names) {
    if (!item || typeof item !== 'object') return '';
    const entries = Object.entries(item);
    for (const name of names) {
      const match = entries.find(([key]) => key.toLowerCase() === name.toLowerCase());
      if (match && match[1] !== undefined && match[1] !== null) {
        return String(match[1]).trim();
      }
    }
    return '';
  }
}

module.exports = PlaywrightDHANode;
