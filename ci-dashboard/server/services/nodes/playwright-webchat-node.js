const BaseNode = require('./base-node');
const { chromium } = require('playwright');
const path = require('path');

class PlaywrightWebchatNode extends BaseNode {
  constructor() {
    super({
      type: 'playwright-webchat',
      category: 'action',
      label: 'Playwright Webchat',
      description: 'Execute Playwright test specifically for Webchat (Classic)',
      icon: 'fa-globe',
      color: '#2b6cb0',
      inputs: [
        { id: 'main', name: 'Test Data', dataType: 'object', required: false }
      ],
      outputs: [
        { id: 'main', name: 'Test Results', dataType: 'object', required: true }
      ],
      config_schema: [
        {
          key: 'platform_url',
          label: 'Webchat URL',
          type: 'text',
          required: true,
          default: 'https://chat.botika.online/EJUnkrW',
          description: 'URL of the webchat interface'
        },
        {
          key: 'tester_name',
          label: 'Tester Name',
          type: 'text',
          required: false,
          default: 'Playwright Bot'
        },
        {
          key: 'tester_email',
          label: 'Tester Email',
          type: 'text',
          required: false,
          default: 'playwright@example.com'
        },
        {
          key: 'tester_phone',
          label: 'Tester Phone',
          type: 'text',
          required: false,
          default: '6281234567890'
        },
        {
          key: 'greeting',
          label: 'Greeting Message',
          type: 'text',
          required: false,
          default: 'Haloo'
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
          label: 'Headless',
          type: 'boolean',
          required: false,
          default: true
        }
      ]
    });
  }

  async execute(context, config, node) {
    const platformUrl = config.platform_url || 'https://chat.botika.online/EJUnkrW';
    const testerName = config.tester_name || 'Playwright Bot';
    const testerEmail = config.tester_email || 'playwright@example.com';
    const testerPhone = config.tester_phone || '6281234567890';
    const greeting = config.greeting !== undefined ? config.greeting : 'Haloo';
    const greeting2 = config.greeting_2 || '';
    const headless = config.headless !== undefined ? config.headless : true;
    const inputData = this.getInput(context, 'main');
    const testData = inputData?.results || [];

    this.log('info', `Starting Playwright Webchat test on: ${platformUrl}`);
    this.log('info', `Tester: ${testerName}, Headless: ${headless}`);
    this.log('info', `Test data count: ${testData.length}`);

    let browser;
    let results = [];

    try {
      this.logTechnical(context, 'info', 'Launching browser...');
      browser = await chromium.launch({ headless });
      const browserContext = await browser.newContext();
      const page = await browserContext.newPage();

      this.logTechnical(context, 'info', 'Navigating to webchat...');
      await page.goto(platformUrl, { waitUntil: 'networkidle', timeout: 60000 });
      await page.waitForTimeout(2000);

      await this.completePrechatForm(page, testerName, testerEmail, testerPhone);

      if (greeting && String(greeting).trim()) {
        this.logTechnical(context, 'info', `Sending greeting message: "${greeting}"`);
        await this.sendMessage(page, greeting);
        await this.waitForReply(page, greeting, 10000);
        this.logTechnical(context, 'info', 'Greeting message sent and handled');
      }

      if (greeting2 && String(greeting2).trim()) {
        this.logTechnical(context, 'info', `Sending second greeting message: "${greeting2}"`);
        await this.sendMessage(page, greeting2);
        await this.waitForReply(page, greeting2, 10000);
        this.logTechnical(context, 'info', 'Second greeting message sent and handled');
      }

      for (let i = 0; i < testData.length; i++) {
        const testItem = testData[i];
        const question = this.getField(testItem, ['question', 'pertanyaan', 'test_case']);
        const expected = this.getField(testItem, ['response_kb', 'expected', 'expected_answer', 'context']);
        const title = this.getField(testItem, ['title', 'topic']) || `Test ${i + 1}`;
        const no = this.getField(testItem, ['no', 'number']) || i + 1;

        this.logTechnical(context, 'info', `[${i + 1}/${testData.length}] Testing question: "${question.substring(0, 50)}..."`);
        this.log('info', `[${i + 1}/${testData.length}] Testing: ${question.substring(0, 50)}...`);
        
        const startTime = Date.now();
        await this.sendMessage(page, question);
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

        if (testData.length > 1 && i < testData.length - 1) {
          await new Promise(r => setTimeout(r, 1000));
        }
      }

      this.log('info', `Test completed: ${results.length} items`);

      return {
        success: true,
        results,
        total_tested: results.length,
        platform: 'webchat',
        url: platformUrl,
        tester_name: testerName
      };
    } catch (error) {
      this.log('error', `Playwright test failed: ${error.message}`);
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
      if (!message || !String(message).trim()) {
        throw new Error('Cannot send empty webchat message');
      }

      const inputSelector = '#input-message, textarea, input[type="text"], [contenteditable="true"]';
      const sendButtonSelector = '#button-send, button[type="submit"], button:has-text("Send"), button:has-text("Kirim")';

      const input = page.locator(inputSelector).first();
      await input.waitFor({ state: 'visible', timeout: 30000 });
      await input.fill(String(message));

      const sendButton = page.locator(sendButtonSelector).first();
      if (await sendButton.isVisible({ timeout: 2000 }).catch(() => false)) {
        await sendButton.click();
      } else {
        await input.press('Enter');
      }
    } catch (error) {
      this.log('warn', `Failed to send message with primary method, trying alternative...`);
      await page.keyboard.type(String(message || ''));
      await page.keyboard.press('Enter');
    }
  }

  async completePrechatForm(page, name, email, phone) {
    const hasPrechatForm = await page.locator('#registername').first()
      .waitFor({ state: 'visible', timeout: 10000 })
      .then(() => true)
      .catch(() => false);

    if (!hasPrechatForm) return;

    this.log('info', 'Pre-chat form detected, submitting tester identity');

    const fields = [
      ['#registername', name || 'Playwright Bot'],
      ['#registeremail', email || 'playwright@example.com'],
      ['#registerphone', phone || '6281234567890']
    ];

    for (const [selector, value] of fields) {
      const field = page.locator(selector).first();
      if (await field.count()) {
        await field.fill(String(value), { force: true });
      }
    }

    await page.locator('#formRegisterUser button[type="submit"], button[type="submit"]').first().click({ force: true });
    await page.locator('#formRegisterUser').waitFor({ state: 'hidden', timeout: 10000 }).catch(() => {});
    await page.waitForTimeout(2000);
  }

  async waitForReply(page, question, timeoutMs = 30000) {
    const startedAt = Date.now();
    let lastResponse = '';

    while (Date.now() - startedAt < timeoutMs) {
      const response = await this.captureResponse(page, question);
      if (response) {
        if (response === lastResponse) {
          return response;
        }
        lastResponse = response;
      }
      await page.waitForTimeout(lastResponse ? 1500 : 750);
    }

    return lastResponse || 'No response captured';
  }

  async captureResponse(page, question) {
    try {
      const result = await page.evaluate((q) => {
        const normalize = (value) => (value || '').replace(/\s+/g, ' ').trim();
        const target = normalize(q).toLowerCase();
        const selectors = [
          '.message-content-wrapper',
          '.chat-messages > *',
          '.message',
          '.chat-message',
          '[class*="message"]'
        ];

        const seen = new Set();
        const rows = [];
        for (const selector of selectors) {
          document.querySelectorAll(selector).forEach((el) => {
            if (!seen.has(el)) {
              seen.add(el);
              rows.push(el);
            }
          });
          if (rows.length > 0) break;
        }

        let questionIndex = -1;
        for (let i = rows.length - 1; i >= 0; i--) {
          const text = normalize(rows[i].textContent);
          if (target && text.toLowerCase().includes(target)) {
            questionIndex = i;
            break;
          }
        }

        const replies = [];
        const start = questionIndex >= 0 ? questionIndex + 1 : Math.max(rows.length - 6, 0);
        for (let i = start; i < rows.length; i++) {
          const row = rows[i];
          const classText = row.className ? String(row.className).toLowerCase() : '';
          const isUser = classText.includes('user') ||
            classText.includes('message-out') ||
            row.closest('.user, .justify-end, .message-out') ||
            row.querySelector('.user, .justify-end, .message-out, .bg-primary');

          if (questionIndex >= 0 && isUser) break;

          const contentNodes = row.querySelectorAll('.content, .v-card-text, .v-sheet, .v-list-item-title');
          const rawText = contentNodes.length
            ? Array.from(contentNodes).map((node) => node.textContent || '').join('\n')
            : row.textContent || '';
          const text = normalize(rawText)
            .replace(/\d{1,2}:\d{2}\s*(?:AM|PM)?/gi, '')
            .replace(/mdi-\w+/g, '')
            .trim();

          if (
            text &&
            text.length > 2 &&
            text.toLowerCase() !== target &&
            !text.includes('Ketik pesan') &&
            !replies.includes(text)
          ) {
            replies.push(text);
          }
        }

        return replies.join('\n').trim();
      }, String(question || ''));

      return result || '';
    } catch (error) {
      this.log('warn', `Failed to capture reply: ${error.message}`);
      return '';
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

module.exports = PlaywrightWebchatNode;
