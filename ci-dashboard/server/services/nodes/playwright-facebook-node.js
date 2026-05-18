const BaseNode = require('./base-node');
const { chromium } = require('playwright');

class PlaywrightFacebookNode extends BaseNode {
  constructor() {
    super({
      type: 'playwright-facebook',
      category: 'action',
      label: 'Facebook DM',
      description: 'Execute Playwright test via Facebook Direct Message',
      icon: 'fab fa-facebook',
      color: '#1877F2',
      inputs: [
        { id: 'main', name: 'Test Data', dataType: 'object', required: false }
      ],
      outputs: [
        { id: 'main', name: 'Test Results', dataType: 'object', required: true }
      ],
      config_schema: [
        {
          key: 'fanpage_id',
          label: 'Fanpage ID / Username',
          type: 'text',
          required: true,
          default: '',
          description: 'ID atau Username Facebook Fanpage (contoh: 123456789 atau botika.online)'
        },
        {
          key: 'c_user',
          label: 'c_user Cookie',
          type: 'text',
          required: true,
          description: 'Copy value dari cookie "c_user" di browser setelah login Facebook'
        },
        {
          key: 'xs',
          label: 'xs Cookie',
          type: 'text',
          required: true,
          description: 'Copy value dari cookie "xs" di browser setelah login Facebook'
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
        }
      ]
    });
  }

  async execute(context, config) {
    const fanpageId = config.fanpage_id;
    const cUser = config.c_user;
    const xs = config.xs;
    const greeting = config.greeting !== undefined ? config.greeting : 'Halo';
    const greeting2 = config.greeting_2 || '';
    const headless = config.headless !== undefined ? config.headless : true;
    
    const inputData = this.getInput(context, 'main');
    const testData = inputData?.results || [];

    if (!cUser || !xs) {
      throw new Error('Facebook Session Cookies (c_user & xs) are required!');
    }
    if (!fanpageId) {
      throw new Error('Fanpage ID / Username is required!');
    }

    this.log('info', `Starting Facebook Test. Target: ${fanpageId}, Headless: ${headless}`);

    let browser;
    let results = [];

    try {
      this.logTechnical(context, 'info', 'Launching browser...');
      browser = await chromium.launch({ headless });
      const browserContext = await browser.newContext();

      // Inject Facebook Cookies
      await browserContext.addCookies([
        {
          name: 'c_user',
          value: String(cUser).trim(),
          domain: '.facebook.com',
          path: '/',
          httpOnly: true,
          secure: true
        },
        {
          name: 'xs',
          value: String(xs).trim(),
          domain: '.facebook.com',
          path: '/',
          httpOnly: true,
          secure: true
        }
      ]);

      const page = await browserContext.newPage();
      
      const chatbotUrl = `https://www.facebook.com/messages/t/${fanpageId}`;
      this.logTechnical(context, 'info', `Navigating to ${chatbotUrl}...`);
      
      try {
        await page.goto(chatbotUrl, { waitUntil: 'networkidle', timeout: 60000 });
      } catch (error) {
        this.logTechnical(context, 'info', 'Networkidle timeout, falling back to domcontentloaded...');
        await page.goto(chatbotUrl, { waitUntil: 'domcontentloaded', timeout: 60000 });
      }
      
      await page.waitForTimeout(5000);

      // Cek apakah login gagal
      if (page.url().includes('login')) {
        throw new Error('Login Gagal! Cookies Facebook sudah expired atau tidak valid. Silakan update c_user dan xs.');
      }

      const dmInputSelector = 'div[contenteditable="true"][role="textbox"]';
      await page.waitForSelector(dmInputSelector, { timeout: 30000 });

      if (greeting && String(greeting).trim()) {
        this.logTechnical(context, 'info', `Sending greeting message: "${greeting}"`);
        await this.sendMessage(page, greeting, dmInputSelector);
        await this.waitForReply(page, greeting, 15000);
        this.logTechnical(context, 'info', 'Greeting message sent and handled');
      }

      if (greeting2 && String(greeting2).trim()) {
        this.logTechnical(context, 'info', `Sending second greeting message: "${greeting2}"`);
        await this.sendMessage(page, greeting2, dmInputSelector);
        await this.waitForReply(page, greeting2, 15000);
        this.logTechnical(context, 'info', 'Second greeting message sent and handled');
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
        await this.sendMessage(page, question, dmInputSelector);
        
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
          await new Promise(r => setTimeout(r, 2000));
        }
      }

      this.log('info', `Test completed: ${results.length} items`);

      return {
        success: true,
        results,
        total_tested: results.length,
        platform: 'facebook',
        fanpage_id: fanpageId
      };

    } catch (error) {
      this.log('error', `Facebook Test Failed: ${error.message}`);
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
      
      await input.fill(String(message));
      await page.waitForTimeout(500);
      
      try {
        const sendButton = page.locator('div[aria-label*="send"], button[type="submit"]').first();
        if (await sendButton.isVisible({ timeout: 2000 })) {
          await sendButton.click();
        } else {
          await input.press('Enter');
        }
      } catch {
        await input.press('Enter');
      }
      
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
        
        // Facebook message rows - focus on the main chat area to avoid sidebar noise
        const mainArea = document.querySelector('div[role="main"], div[aria-label^="Messages"], div[role="grid"]');
        const rows = Array.from((mainArea || document).querySelectorAll('div[role="row"]'));
        if (!rows.length) return '';

        // Find the index of our question
        let questionIndex = -1;
        for (let i = rows.length - 1; i >= 0; i--) {
          const text = normalize(rows[i].textContent).toLowerCase();
          // Look for precise match or variations like "You: [msg]"
          if (target && (text === target || 
              text.includes('you: ' + target) || 
              (text.includes(target) && (text.includes('you') || text.includes('sent'))))) {
            questionIndex = i;
            break;
          }
        }

        // If question not found, do not fallback to random messages
        if (questionIndex < 0) return '';

        // Collect bot responses after our question
        const replies = [];
        const start = questionIndex + 1;
        
        for (let i = start; i < rows.length; i++) {
          const row = rows[i];
          const text = normalize(row.textContent);
          
          // Basic noise filtering for FB
          if (!text || text.length < 2) continue;
          
          // Enhanced noise filter: skip UI buttons and self-message indicators
          if (/^(Enter|Send|Message|You sent|Sent|Delivered|Seen|Active now|Seen by .*|Replied to .*)$/i.test(text)) continue;
          if (text.includes('You: ') || text.includes('You sent')) continue;
          
          // Skip if it contains the user question (likely metadata/sent status/repetition)
          if (target && text.toLowerCase().includes(target)) continue;

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

module.exports = PlaywrightFacebookNode;
