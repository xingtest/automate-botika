const BaseNode = require('./base-node');
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

class PlaywrightWhatsappNode extends BaseNode {
  constructor() {
    super({
      type: 'playwright-whatsapp',
      category: 'action',
      label: 'WhatsApp',
      description: 'Execute Playwright test via WhatsApp Web',
      icon: 'fab fa-whatsapp',
      color: '#25D366',
      inputs: [
        { id: 'main', name: 'Test Data', dataType: 'object', required: false }
      ],
      outputs: [
        { id: 'main', name: 'Test Results', dataType: 'object', required: true }
      ],
      config_schema: [
        {
          key: 'target_number',
          label: 'Target Phone Number',
          type: 'text',
          required: true,
          default: '',
          description: 'Nomor WhatsApp target (format: 628xxxxxxxxxx)'
        },
        {
          key: 'session_file',
          label: 'Session File Path',
          type: 'text',
          required: true,
          default: 'session/session-whatsapp.json',
          description: 'Path ke session storage file'
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
          key: 'max_wait',
          label: 'Max Wait Reply (s)',
          type: 'number',
          required: false,
          default: 30
        },
        {
          key: 'headless',
          label: 'Headless Mode',
          type: 'boolean',
          required: false,
          default: true
        }
      ]
    });
  }

  async execute(context, config) {
    const phoneNumber = config.target_number;
    const sessionFile = config.session_file;
    const greeting = config.greeting;
    const greeting2 = config.greeting_2;
    const maxWait = (config.max_wait || 30) * 1000;
    const headless = config.headless !== undefined ? config.headless : true;
    
    const inputData = this.getInput(context, 'main');
    const testData = inputData?.results || [];

    if (!phoneNumber) throw new Error('Target Phone Number is required!');
    if (!sessionFile) throw new Error('Session File Path is required!');

    const sessionPath = path.resolve(process.cwd(), sessionFile);
    if (!fs.existsSync(sessionPath)) {
      throw new Error(`Session file not found at ${sessionPath}. Please generate session first.`);
    }

    this.log('info', `Starting WhatsApp Test. Target: ${phoneNumber}, Headless: ${headless}`);

    let browser;
    let results = [];

    try {
      this.logTechnical(context, 'info', 'Launching browser...');
      browser = await chromium.launch({ 
        headless,
        args: ['--no-sandbox', '--disable-setuid-sandbox'] 
      });
      
      const browserContext = await browser.newContext({
        storageState: sessionPath,
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      });

      const page = await browserContext.newPage();
      
      const chatbotUrl = `https://web.whatsapp.com/send?phone=${phoneNumber}`;
      this.logTechnical(context, 'info', `Navigating to ${chatbotUrl}...`);
      
      await page.goto(chatbotUrl, { waitUntil: 'domcontentloaded', timeout: 60000 });
      
      // Try multiple selectors as WhatsApp Web updates its DOM frequently
      const inputSelector = 'footer div[contenteditable="true"], div[title="Type a message"], div[data-tab="10"]';
      
      this.logTechnical(context, 'info', 'Waiting for WhatsApp chat interface to load (up to 60s)...');
      try {
        await page.waitForSelector(inputSelector, { timeout: 60000 });
      } catch (e) {
        // If not found, might need to scan QR or number invalid
        const html = await page.content();
        
        // Take screenshot for debugging
        const screenshotDir = path.join(process.cwd(), 'temp_data');
        if (!fs.existsSync(screenshotDir)) fs.mkdirSync(screenshotDir, { recursive: true });
        const screenshotPath = path.join(screenshotDir, `wa-error-${Date.now()}.png`);
        await page.screenshot({ path: screenshotPath });
        this.logTechnical(context, 'info', `Screenshot saved to: ${screenshotPath}`);
        
        if (html.includes('data-ref') || html.includes('canvas')) {
          throw new Error('WhatsApp requires login. Session expired. Please re-authenticate.');
        } else if (html.includes('Phone number shared via url is invalid')) {
          throw new Error(`Invalid phone number: ${phoneNumber}`);
        } else {
          throw new Error(`Timeout waiting for chat input. Screenshot saved to ${screenshotPath}. Session might be invalid or DOM changed.`);
        }
      }

      this.logTechnical(context, 'info', 'Chat interface loaded successfully.');

      if (greeting && String(greeting).trim()) {
        this.logTechnical(context, 'info', `Sending greeting message: "${greeting}"`);
        await this.sendMessage(page, greeting, inputSelector);
        await this.waitForReply(page, greeting, 15000);
      }

      if (greeting2 && String(greeting2).trim()) {
        this.logTechnical(context, 'info', `Sending second greeting message: "${greeting2}"`);
        await this.sendMessage(page, greeting2, inputSelector);
        await this.waitForReply(page, greeting2, 15000);
      }

      // Mulai Testing
      for (let i = 0; i < testData.length; i++) {
        const testItem = testData[i];
        const question = this.getField(testItem, ['question', 'pertanyaan', 'test_case']);
        const expected = this.getField(testItem, ['response_kb', 'expected', 'expected_answer', 'context']);
        const title = this.getField(testItem, ['title', 'topic']) || `Test ${i + 1}`;
        const no = this.getField(testItem, ['no', 'number']) || i + 1;

        this.logTechnical(context, 'info', `[${i + 1}/${testData.length}] Testing question: "${question.substring(0, 50)}..."`);
        this.log('info', `[${i + 1}/${testData.length}] Testing: ${question.substring(0, 50)}...`);
        
        const startTime = Date.now();
        await this.sendMessage(page, question, inputSelector);
        
        const actual = await this.waitForReply(page, question, maxWait);
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
          await new Promise(r => setTimeout(r, 2000));
        }
      }

      this.log('info', `Test completed: ${results.length} items`);

      return {
        success: true,
        results,
        total_tested: results.length,
        platform: 'whatsapp',
        phone: phoneNumber
      };

    } catch (error) {
      this.log('error', `WhatsApp Test Failed: ${error.message}`);
      throw error;
    } finally {
      if (browser) {
        await browser.close();
        this.logTechnical(context, 'info', 'Browser closed');
      }
    }
  }

  async sendMessage(page, message, inputSelector) {
    try {
      if (!message || !String(message).trim()) return;

      const input = page.locator(inputSelector).first();
      await input.waitFor({ state: 'visible', timeout: 10000 });
      
      // WhatsApp requires typing directly or pasting and waiting
      await input.fill(String(message));
      await page.waitForTimeout(500);
      
      await input.press('Enter');
      
    } catch (error) {
      this.log('warn', `Failed to send message: ${error.message}`);
      throw error;
    }
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
      await page.waitForTimeout(lastResponse ? 2000 : 1000);
    }

    return lastResponse || 'No response captured';
  }

  async captureResponse(page, question) {
    try {
      const result = await page.evaluate((q) => {
        const normalize = (value) => (value || '').replace(/\s+/g, ' ').trim();
        const target = normalize(q).toLowerCase();
        
        // Find all message rows
        const rows = Array.from(document.querySelectorAll('div[role="row"]'));
        if (!rows.length) return '';

        let questionIndex = -1;
        for (let i = rows.length - 1; i >= 0; i--) {
          const textElement = rows[i].querySelector('.copyable-text');
          const text = textElement ? normalize(textElement.innerText || textElement.textContent).toLowerCase() : '';
          
          if (target && text.includes(target)) {
            questionIndex = i;
            break;
          }
        }

        if (questionIndex < 0) return '';

        const replies = [];
        const start = questionIndex + 1;
        
        for (let i = start; i < rows.length; i++) {
          const row = rows[i];
          
          // Check if it's an incoming message (message-in)
          if (!row.querySelector('.message-in')) {
            // It's a message-out (we sent something else?) skip
            continue; 
          }

          const textElement = row.querySelector('.copyable-text');
          const spanTextElement = textElement ? textElement.querySelector('span.selectable-text') : null;
          
          let text = '';
          if (spanTextElement) {
              text = spanTextElement.innerText || spanTextElement.textContent;
          } else if (textElement) {
              text = textElement.innerText || textElement.textContent;
          }
          
          text = normalize(text);
          if (!text) continue;
          
          if (!replies.includes(text)) {
            replies.push(text);
          }
        }

        return replies.join('\n').trim();
      }, String(question || ''));

      return result || '';
    } catch (error) {
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

module.exports = PlaywrightWhatsappNode;
