import { Page } from 'playwright';
import { Modul } from '../utils/modul';
import { EnvFile } from '../utils/envfile';
import { EvaluatorFactory } from '../utils/ai-evaluator';
import { TestData, BotData, SummaryData } from '../main';
import { log } from '../utils/logger';
import { TestTracker } from '../utils/test-tracker';
import { runTestLoop } from '../utils/test-runner';

export class WebchatV3Platform {
  /**
   * Capture responses for V3
   */
  private static async captureResponses(page: Page, question: string): Promise<{ responses: string[]; strategyUsed: string; success: boolean }> {
    try {
      const result = await page.evaluate((q) => {
        const container = document.querySelector('.chat-messages');
        if (!container) return { responses: [], strategyUsed: 'no-container' };

        const rows = Array.from(container.children);
        console.log(`[V3-Eval] Total rows in container: ${rows.length}`);
        
        // 1. Find our question
        let questionIndex = -1;
        for (let i = rows.length - 1; i >= 0; i--) {
          const text = rows[i].textContent || '';
          if (text.toLowerCase().includes(q.toLowerCase())) {
            questionIndex = i;
            break;
          }
        }

        // 2. If not found by text, try fallback (last user message)
        if (questionIndex === -1) {
            for (let i = rows.length - 1; i >= 0; i--) {
                const row = rows[i];
                const isUser = row.classList.contains('justify-end') || 
                             row.querySelector('.justify-end') !== null ||
                             row.innerHTML.includes('bg-primary');
                if (isUser) {
                    const text = row.textContent || '';
                    const qSnippet = q.substring(0, Math.min(5, q.length)).toLowerCase();
                    if (text.toLowerCase().includes(qSnippet)) {
                        questionIndex = i;
                    }
                    break;
                }
            }
        }

        if (questionIndex === -1) return { responses: [], strategyUsed: 'no-user-message-found' };

        // 3. Capture all bot messages after the question
        const replies: string[] = [];
        for (let i = questionIndex + 1; i < rows.length; i++) {
          const row = rows[i];
          const isUser = row.classList.contains('justify-end') || 
                         row.querySelector('.justify-end') !== null ||
                         row.innerHTML.includes('bg-primary');

          if (!isUser) {
            // It's a bot message. Try to get text from various potential Vuetify elements
            const messageElement = row.querySelector('.v-card-text, .v-sheet, .v-list-item-title') || row;
            let text = (messageElement as HTMLElement).innerText || messageElement.textContent || '';
            
            // Clean up timestamps
            text = text.replace(/\d{1,2}:\d{2}\s*(?:AM|PM)?/gi, '').trim();
            // Remove common icon/UI text
            text = text.replace(/mdi-\w+/g, '').trim();
            
            if (text.length > 0) {
              replies.push(text);
            }
          } else {
            // Stop if we hit another user message
            break;
          }
        }

        return { 
          responses: replies, 
          strategyUsed: 'v3-refined-dom',
          success: replies.length > 0
        };
      }, question);

      if (result.responses.length > 0) {
          log.debug(`[V3] Captured ${result.responses.length} bubbles for: "${question}"`);
      }

      return { 
        responses: result.responses, 
        strategyUsed: result.strategyUsed, 
        success: !!result.success 
      };
    } catch (error: any) {
      log.error('[V3] Capture failed', error);
      return { responses: [], strategyUsed: 'error', success: false };
    }
  }

  static async sendMessage(page: Page, question: string): Promise<void> {
    try {
      const inputSelector = 'textarea.v-field__input, textarea[placeholder="Message"]';
      const input = page.locator(inputSelector).first();
      await input.waitFor({ state: 'visible', timeout: 60000 });
      await input.fill(question);
      await Modul.waitTime(1);
      
      const sendButtonSelector = 'i.mdi-send';
      const sendButton = page.locator(sendButtonSelector).first();
      if (await sendButton.isVisible()) {
          await sendButton.click();
      } else {
          await page.keyboard.press('Enter');
      }

      await Modul.waitTime(2);
    } catch (error) {
      console.error('Error sending message in V3:', error);
      throw error;
    }
  }

  static async waitReply(page: Page, question: string, timeout: number = 300000): Promise<void> {
    console.log(`⏳ Waiting for bot reply in V3 to: "${question}" (with stabilization)`);
    const startTime = Date.now();
    let lastTextLength = 0;
    let stableStartTime = 0;
    const requiredStabilityMs = 3500; // Harus stabil selama 3.5 detik

    // Tunggu awal agar bot mulai memproses
    await page.waitForTimeout(2000);

    while (Date.now() - startTime < timeout) {
      const result = await this.captureResponses(page, question);
      const currentText = result.responses.join('\n');
      
      if (result.success && currentText.length > 0) {
        if (currentText.length > lastTextLength) {
          // Teks bertambah, bot masih mengetik atau bubble baru muncul
          if (lastTextLength > 0) {
            log.debug(`[V3] Response still growing: ${lastTextLength} -> ${currentText.length}`);
          }
          lastTextLength = currentText.length;
          stableStartTime = Date.now();
        } else {
          // Panjang teks sama, cek sudah berapa lama stabil
          const elapsedStable = Date.now() - stableStartTime;
          if (elapsedStable >= requiredStabilityMs) {
            console.log(`✅ Response stabilized after ${elapsedStable}ms`);
            return;
          }
        }
      }
      
      // Cek lebih sering agar responsif (setiap 1 detik)
      await page.waitForTimeout(1000);
    }
    
    if (lastTextLength > 0) {
      console.log(`⚠️ Stability timeout reached, but we have some response (${lastTextLength} chars)`);
    } else {
      console.log(`⚠️ Timeout: No reply found for: "${question}"`);
    }
  }

  static async getReplyChat(page: Page, question: string): Promise<string[]> {
    const result = await this.captureResponses(page, question);
    return result.responses;
  }

  static async takeScreenshot(page: Page, idTest: string, key: string, question: string, screenshotsFolder: string): Promise<string> {
    if (page.isClosed()) return 'page_closed.png';
    const fs = require('fs');
    const path = require('path');
    const screenshotDir = screenshotsFolder || 'report/screenshoot';
    if (!fs.existsSync(screenshotDir)) {
      fs.mkdirSync(screenshotDir, { recursive: true });
    }

    const sanitizedQuestion = question.substring(0, 30).replace(/[^a-z0-9]/gi, '_');
    const filename = `${idTest}_${key}_${sanitizedQuestion}.png`;
    const filepath = path.join(screenshotDir, filename);

    try {
        await page.screenshot({ path: filepath, fullPage: true });
        return filename;
    } catch (error) {
        console.error('Screenshot failed:', error);
        return 'error_screenshot.png';
    }
  }

  static async prechatForm(
    page: Page,
    greeting: string,
    greeting2: string,
    name: string,
    email: string,
    phone: string
  ): Promise<void> {
    Modul.showLoading('Checking for available webchat V3 pre-chat form');

    try {
      // Wait for either the chat input OR pre-chat form elements to appear
      await Promise.race([
        page.waitForSelector('textarea.v-field__input, textarea[placeholder="Message"]', { timeout: 10000 }),
        page.waitForSelector('#registername, #registeremail, .v-input, button:has-text("Submit"), button:has-text("Mulai Obrolan")', { timeout: 10000 })
      ]).catch(() => {
        log.debug('No elements detected during initial page load race, continuing');
      });
    } catch (e) {
      // Ignore wait errors
    }

    if (await page.locator('textarea.v-field__input, textarea[placeholder="Message"]').first().isVisible()) {
      log.info('✅ Chat interface detected directly, skipping pre-chat form');
      return;
    }

    let fieldsFound = 0;
    log.platform.action('Checking for pre-chat form fields in V3');

    try {
      // 1. Name
      const nameSelectors = [
        '#registername', 
        'input[placeholder*="Name"]', 
        'input[label*="Name"]',
        '.v-input:has-text("Name") input',
        '.v-input:has-text("Nama") input'
      ];
      for (const selector of nameSelectors) {
        const input = page.locator(selector).first();
        if (await input.isVisible()) {
          await input.fill(name);
          log.info(`✅ Filled name field (${selector})`);
          fieldsFound++;
          break;
        }
      }

      // 2. Email
      const emailSelectors = [
        '#registeremail', 
        'input[placeholder*="Email"]', 
        'input[label*="Email"]', 
        'input[type="email"]',
        '.v-input:has-text("Email") input'
      ];
      for (const selector of emailSelectors) {
        const input = page.locator(selector).first();
        if (await input.isVisible()) {
          await input.fill(email);
          log.info(`✅ Filled email field (${selector})`);
          fieldsFound++;
          break;
        }
      }

      // 3. Phone
      const phoneSelectors = [
        '#registerphone', 
        'input[placeholder*="Phone"]', 
        'input[label*="Phone"]', 
        'input[placeholder*="telp"]',
        'input[type="tel"]',
        '.v-input:has-text("Phone") input',
        '.v-input:has-text("telp") input'
      ];
      for (const selector of phoneSelectors) {
        const input = page.locator(selector).first();
        if (await input.isVisible()) {
          await input.fill(phone);
          log.info(`✅ Filled phone field (${selector})`);
          fieldsFound++;
          break;
        }
      }

      // 4. Gender or other dropdowns
      const dropdownSelectors = ['.v-select', '.v-combobox', '.v-autocomplete'];
      const dropdowns = page.locator(dropdownSelectors.join(','));
      const count = await dropdowns.count();
      
      for (let i = 0; i < count; i++) {
        const dropdown = dropdowns.nth(i);
        if (await dropdown.isVisible()) {
          const text = await dropdown.textContent() || '';
          if (text.toLowerCase().includes('gender') || text.toLowerCase().includes('jenis kelamin')) {
            log.info('✅ Gender dropdown detected, selecting first option');
            await dropdown.click();
            await page.waitForTimeout(1000);
            
            const option = page.locator('.v-list-item, .v-overlay-container .v-list-item').first();
            if (await option.isVisible()) {
              await option.click();
              fieldsFound++;
              await page.waitForTimeout(500);
            }
          }
        }
      }

      // 5. Fallback brute-force fill for any other empty visible inputs
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

      if (fieldsFound > 0) {
        log.info(`✅ Pre-chat form detected with ${fieldsFound} fields in V3`);

        const startChatButton = page.locator('button:has-text("Mulai Obrolan"), button:has-text("Start Chat"), button:has-text("Kirim"), button:has-text("Submit"), #btn-submit-register, .btn-submit, button[type="submit"]').first();
        if (await startChatButton.isVisible()) {
          await startChatButton.click();
          log.info('✅ Clicked submit button, waiting for chat interface...');
          await Modul.waitTime(4);
        }
      } else {
        log.debug('No pre-chat form detected in V3, proceeding directly');
      }
    } catch (error) {
      log.error('Error handling pre-chat form', error);
    }
  }

  static async actions(
    page: Page,
    greeting: string,
    greeting2: string,
    jsonData: TestData[],
    reportFilename: string,
    idTest: string,
    timeStart: string,
    today: string,
    testerName: string,
    url: string,
    titlePage: string,
    browserName: string,
    screenshotsFolder: string,
    testTracker: TestTracker
  ): Promise<void> {
    const start = Modul.startTime();
    console.log('\n🚀 Starting Webchat V3 Actions');

    // Tunggu pesan sambutan bahasa muncul di layar (maksimal 20 detik)
    // Default: disabled (hidden) unless explicitly configured via env var.
    const welcomeText = process.env.WELCOME_MESSAGE_TEXT;
    const isEnabled =
      typeof welcomeText === 'string' &&
      welcomeText.trim() !== '' &&
      welcomeText.toLowerCase() !== 'false' &&
      welcomeText.toLowerCase() !== 'none';

    if (isEnabled) {
      const welcomeRegex = new RegExp(welcomeText!, 'i');
      console.log(`⏳ Waiting for welcome message ("${welcomeText}") to appear in V3...`);
      try {
        const welcomeMessage = page.locator('.chat-messages, .v-card-text, .v-sheet, .v-list-item-title')
                                   .filter({ hasText: welcomeRegex })
                                   .first();
        await welcomeMessage.waitFor({ state: 'visible', timeout: 20000 });
        console.log('✅ Welcome message detected!');
      } catch (error) {
        console.log('⚠️ Timeout waiting for welcome message in V3, proceeding anyway');
      }
    } else {
      console.log('Skip waiting for initial welcome message in V3 (WELCOME_MESSAGE_TEXT not set), proceeding directly.');
    }

    // Handle initial greetings for V3
    if (greeting) {
        console.log(`📤 Sending Greeting 1: ${greeting}`);
        await this.sendMessage(page, greeting);
        await this.waitReply(page, greeting);
    }
    if (greeting2) {
        console.log(`📤 Sending Greeting 2: ${greeting2}`);
        await this.sendMessage(page, greeting2);
        await this.waitReply(page, greeting2);
    }

    await runTestLoop({
      sendMessage: (q) => this.sendMessage(page, q),
      getReply: async (q) => {
        await this.waitReply(page, q, 120000);
        const res = await this.getReplyChat(page, q);
        return res.join('\n').trim();
      },
      takeScreenshot: (idTest, key, question, screenshotsFolder) => this.takeScreenshot(page, idTest, key, question, screenshotsFolder),
      jsonData,
      reportFilename,
      idTest,
      screenshotsFolder: screenshotsFolder || '',
      testerName,
      url,
      pageName: titlePage,
      browserName,
      today,
      timeStart,
      platformLabel: 'V3',
      testTracker,
      onBeforeQuestion: async (count) => {
        if (count % 5 === 0) {
          log.info('🔄 Reloading page in Webchat V3 to prevent memory issues...');
          await page.reload();
          await Modul.waitTime(2);
        }
      }
    });
  }
}
