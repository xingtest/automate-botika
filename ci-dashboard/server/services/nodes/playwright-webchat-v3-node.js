const BaseNode = require('./base-node');
const { chromium } = require('playwright');

class PlaywrightWebchatV3Node extends BaseNode {
  constructor() {
    super({
      type: 'playwright-webchat-v3',
      category: 'action',
      label: 'Webchat V3',
      description: 'Execute Playwright test specifically for Webchat V3 platform',
      icon: 'fa-comments',
      color: '#3b82f6',
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
          default: 'https://v3.botika.online/',
          description: 'URL of the Webchat V3 interface'
        },
        {
          key: 'prechat_name',
          label: 'Pre-chat Name',
          type: 'text',
          required: false,
          default: 'Tester'
        },
        {
          key: 'prechat_email',
          label: 'Pre-chat Email',
          type: 'text',
          required: false,
          default: 'tester@example.com'
        },
        {
          key: 'prechat_phone',
          label: 'Pre-chat Phone',
          type: 'text',
          required: false,
          default: '08123456789'
        },
        {
          key: 'greeting',
          label: 'Greeting Message',
          type: 'text',
          required: false,
          default: ''
        },
        {
          key: 'greeting_2',
          label: 'Greeting Message 2',
          type: 'text',
          required: false,
          default: ''
        },
        {
          key: 'wait_time',
          label: 'Wait Time (s)',
          type: 'number',
          required: false,
          default: 5,
          description: 'Delay between questions'
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

  async execute(context, config, node) {
    const targetUrl = config.target_url || 'https://v3.botika.online/';
    const greeting = config.greeting;
    const greeting2 = config.greeting_2;
    const waitTime = parseInt(config.wait_time || '5', 10);
    const headless = config.headless !== false;

    // Optional pre-chat info
    const prechatName = config.prechat_name || 'Tester';
    const prechatEmail = config.prechat_email || 'tester@example.com';
    const prechatPhone = config.prechat_phone || '08123456789';

    // Get input data from upstream node
    const inputData = this.getInput(context, 'main');
    this.logTechnical(context, 'info', `Starting Webchat V3 testing on ${targetUrl}`);
    
    // Extract test cases from input data
    let testCases = [];
    if (Array.isArray(inputData)) {
      testCases = inputData;
    } else if (inputData && typeof inputData === 'object') {
      this.logTechnical(context, 'info', `Upstream data keys: ${Object.keys(inputData).join(', ')}`);
      testCases = inputData.results || inputData.testCases || inputData.data || inputData.rows || [];
      
      // Fallback: if inputData itself has question fields, treat as single test case
      if (testCases.length === 0 && (inputData.pertanyaan || inputData.question)) {
        testCases = [inputData];
      }
    }

    this.logTechnical(context, 'info', `Found ${testCases.length} test cases to process.`);

    const browser = await chromium.launch({ headless });
    const page = await browser.newPage();
    const results = [];

    try {
      await page.goto(targetUrl, { waitUntil: 'networkidle', timeout: 60000 });
      this.logTechnical(context, 'info', `Navigated to ${targetUrl}`);

      // Handle Pre-chat form if present
      await this.handlePrechat(context, page, prechatName, prechatEmail, prechatPhone);

      // Handle Initial Greetings
      if (greeting && String(greeting).trim()) {
        await this.sendMessage(context, page, greeting);
        await this.waitForReply(context, page, greeting);
      }
      if (greeting2 && String(greeting2).trim()) {
        await this.sendMessage(context, page, greeting2);
        await this.waitForReply(context, page, greeting2);
      }

      for (const testCase of testCases) {
        const question = testCase.pertanyaan || testCase.question || testCase.Question || testCase.Pertanyaan;
        if (!question) {
          this.logTechnical(context, 'debug', `Skipping test case without question: ${JSON.stringify(testCase)}`);
          continue;
        }

        this.logTechnical(context, 'info', `Testing question: "${question}"`);
        
        const startTime = Date.now();
        await this.sendMessage(context, page, question);
        await this.waitForReply(context, page, question);
        
        const responseArray = await this.extractBotResponse(page, question);
        const responseText = responseArray.join('\n').trim() || 'No response captured';
        const duration = Date.now() - startTime;

        results.push({
          ...testCase,
          question: question,
          actual: responseText,
          response_llm: responseText,
          duration_ms: duration,
          status: responseText !== 'No response captured' ? 'success' : 'failed'
        });

        this.logTechnical(context, 'info', `Captured response: ${responseText.substring(0, 50)}...`);
        
        if (waitTime > 0) {
          await page.waitForTimeout(waitTime * 1000);
        }
      }

      await browser.close();
      this.logTechnical(context, 'info', `Completed Webchat V3 testing. Processed ${results.length} test cases.`);

      return {
        success: true,
        results,
        total_tested: results.length,
        platform: 'webchat-v3',
        target_url: targetUrl
      };

    } catch (error) {
      this.logTechnical(context, 'error', `Webchat V3 execution failed: ${error.message}`);
      if (browser) await browser.close();
      throw error;
    }
  }

  async handlePrechat(context, page, name, email, phone) {
    try {
      this.logTechnical(context, 'info', 'Checking for Webchat V3 pre-chat form...');
      
      try {
        await Promise.race([
          page.waitForSelector('textarea.v-field__input', { timeout: 8000 }),
          page.waitForSelector('#registername, #registeremail, .v-select, .v-input', { timeout: 8000 })
        ]);
      } catch (e) {
        this.logTechnical(context, 'debug', 'No clear form or chat input detected quickly, continuing...');
      }

      if (await page.locator('textarea.v-field__input').isVisible()) {
        this.logTechnical(context, 'info', 'Chat interface detected directly, skipping pre-chat.');
        return;
      }

      let fieldsFound = 0;

      // 1. Fill Name
      const nameSelectors = ['#registername', 'input[placeholder*="Name"]', 'input[label*="Name"]', '.v-input:has-text("Name") input'];
      for (const selector of nameSelectors) {
        const input = page.locator(selector).first();
        if (await input.isVisible()) {
          await input.fill(name);
          fieldsFound++;
          this.logTechnical(context, 'info', `Filled name field (${selector})`);
          break;
        }
      }

      // 2. Fill Email
      const emailSelectors = ['#registeremail', 'input[placeholder*="Email"]', 'input[label*="Email"]', 'input[type="email"]', '.v-input:has-text("Email") input'];
      for (const selector of emailSelectors) {
        const input = page.locator(selector).first();
        if (await input.isVisible()) {
          await input.fill(email);
          fieldsFound++;
          this.logTechnical(context, 'info', `Filled email field (${selector})`);
          break;
        }
      }

      // 3. Fill Phone
      const phoneSelectors = ['#registerphone', 'input[placeholder*="Phone"]', 'input[label*="Phone"]', 'input[type="tel"]', '.v-input:has-text("Phone") input'];
      for (const selector of phoneSelectors) {
        const input = page.locator(selector).first();
        if (await input.isVisible()) {
          await input.fill(phone);
          fieldsFound++;
          this.logTechnical(context, 'info', `Filled phone field (${selector})`);
          break;
        }
      }

      // 4. Handle Gender or other dropdowns
      const dropdownSelectors = ['.v-select', '.v-combobox', '.v-autocomplete', '.v-input--select'];
      for (const selector of dropdownSelectors) {
        const dropdowns = page.locator(selector);
        const count = await dropdowns.count();
        for (let i = 0; i < count; i++) {
          const dropdown = dropdowns.nth(i);
          if (await dropdown.isVisible()) {
            this.logTechnical(context, 'info', `Dropdown detected (${selector}), attempting to select first option...`);
            await dropdown.click();
            await page.waitForTimeout(1000);
            
            const option = page.locator('.v-list-item, .v-overlay-container .v-list-item, [role="option"]').first();
            if (await option.isVisible()) {
              await option.click();
              fieldsFound++;
              this.logTechnical(context, 'info', 'Selected an option from dropdown.');
              await page.waitForTimeout(500);
            } else {
              await page.mouse.click(100, 100); 
            }
          }
        }
      }

      // 5. Brute force fill any remaining empty visible inputs
      const allInputs = page.locator('input:visible, textarea:visible');
      const inputCount = await allInputs.count();
      for (let i = 0; i < inputCount; i++) {
        const input = allInputs.nth(i);
        const val = await input.inputValue();
        if (!val) {
          try {
            await input.fill('Tester');
            fieldsFound++;
          } catch (e) {}
        }
      }

      // 6. Click Start/Register button
      if (fieldsFound > 0 || await page.locator('button:visible').count() > 0) {
        this.logTechnical(context, 'info', `Attempting to submit pre-chat form (fields filled: ${fieldsFound})...`);
        const startChatButton = page.locator('button:has-text("Mulai Obrolan"), button:has-text("Start Chat"), button:has-text("Kirim"), button:has-text("Submit"), #btn-submit-register, .btn-submit, button[type="submit"]').first();
        if (await startChatButton.isVisible()) {
          await startChatButton.click();
          this.logTechnical(context, 'info', 'Clicked submit button, waiting for chat interface...');
          await page.waitForTimeout(4000);
        }
      }
    } catch (e) {
      this.logTechnical(context, 'debug', `Pre-chat check skipped or failed: ${e.message}`);
    }
  }

  async sendMessage(context, page, message) {
    const inputSelector = 'textarea.v-field__input, textarea[placeholder="Message"]';
    const input = page.locator(inputSelector).first();
    await input.waitFor({ state: 'visible', timeout: 30000 });
    await input.fill(message);
    
    const sendButton = page.locator('i.mdi-send').first();
    if (await sendButton.isVisible()) {
      await sendButton.click();
    } else {
      await page.keyboard.press('Enter');
    }
    await page.waitForTimeout(1000);
  }

  async waitForReply(context, page, question, timeout = 60000) {
    const startTime = Date.now();
    let lastLength = 0;
    let stableCount = 0;
    const requiredStability = 3; 

    while (Date.now() - startTime < timeout) {
      const responses = await this.extractBotResponse(page, question);
      const currentText = responses.join('\n');
      
      if (currentText.length > 0) {
        if (currentText.length === lastLength && lastLength > 0) {
          stableCount++;
          if (stableCount >= requiredStability) return;
        } else {
          lastLength = currentText.length;
          stableCount = 0;
        }
      }
      await page.waitForTimeout(1000);
    }
  }

  async extractBotResponse(page, question) {
    return await page.evaluate((q) => {
      const container = document.querySelector('.chat-messages');
      if (!container) return [];

      const rows = Array.from(container.children);
      let questionIndex = -1;

      for (let i = rows.length - 1; i >= 0; i--) {
        const text = rows[i].textContent || '';
        if (text.toLowerCase().includes(q.toLowerCase())) {
          questionIndex = i;
          break;
        }
      }

      if (questionIndex === -1) {
        for (let i = rows.length - 1; i >= 0; i--) {
          const row = rows[i];
          const isUser = row.classList.contains('justify-end') || 
                       row.querySelector('.justify-end') !== null ||
                       row.innerHTML.includes('bg-primary');
          if (isUser) {
            questionIndex = i;
            break;
          }
        }
      }

      if (questionIndex === -1) return [];

      const replies = [];
      for (let i = questionIndex + 1; i < rows.length; i++) {
        const row = rows[i];
        const isUser = row.classList.contains('justify-end') || 
                     row.querySelector('.justify-end') !== null ||
                     row.innerHTML.includes('bg-primary');

        if (!isUser) {
          const messageElement = row.querySelector('.v-card-text, .v-sheet, .v-list-item-title') || row;
          let text = messageElement.innerText || messageElement.textContent || '';
          text = text.replace(/\d{1,2}:\d{2}\s*(?:AM|PM)?/gi, '').trim();
          text = text.replace(/mdi-\w+/g, '').trim();
          if (text.length > 0) replies.push(text);
        } else {
          break;
        }
      }

      return replies;
    }, question);
  }
}

module.exports = PlaywrightWebchatV3Node;
