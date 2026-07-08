import { Page } from 'playwright';
import { Modul } from '../utils/modul';
import { EnvFile } from '../utils/envfile';
import { EvaluatorFactory } from '../utils/ai-evaluator';
import { TestData, BotData, SummaryData } from '../main';
import { log } from '../utils/logger';
import { TestTracker } from '../utils/test-tracker';
import { runTestLoop } from '../utils/test-runner';

export class WebchatPlatform {
  /**
   * Capture responses using DirectMessage strategy
   * Primary method for capturing bot responses based on position after question
   */
  private static async captureDirectMessage(page: Page, question: string): Promise<{ foundQuestion: boolean; replies: string[] }> {
    const replies: string[] = [];

    try {
      log.debug('[DirectMessage] Starting capture for question', { question });

      // Get all message wrappers
      const allMessages = await page.locator('.message-content-wrapper').all();
      log.debug(`[DirectMessage] Found ${allMessages.length} message wrappers`);

      // Find the index of our question
      let questionIndex = -1;
      for (let i = allMessages.length - 1; i >= 0; i--) {
        try {
          const contents = await allMessages[i].locator('.content').all();
          for (const content of contents) {
            const text = await content.textContent();
            if (text && text.trim().toLowerCase() === question.trim().toLowerCase()) {
              questionIndex = i;
              log.debug(`[DirectMessage] Found question at index ${i}`);
              break;
            }
          }
          if (questionIndex >= 0) break;
        } catch (error) {
          // Continue searching
        }
      }

      if (questionIndex < 0) {
        log.warn('[DirectMessage] Question not found in message history');
        return { foundQuestion: false, replies };
      }

      // Capture ALL bot responses after our question until we hit another user message
      log.debug(`[DirectMessage] Capturing responses from index ${questionIndex + 1} onwards`);

      for (let i = questionIndex + 1; i < allMessages.length; i++) {
        try {
          const messageWrapper = allMessages[i];

          // Check if this is a user message - if yes, STOP here
          const hasUserClass = await messageWrapper.evaluate((el) => {
            return el.classList.contains('user') ||
              el.closest('.user') !== null ||
              el.querySelector('.user') !== null;
          });

          if (hasUserClass) {
            log.debug(`[DirectMessage] Stopped at index ${i} - found next user message`);
            break;
          }

          // Get all content parts from this bot message
          const contentParts = await messageWrapper.locator('.content').all();
          for (const part of contentParts) {
            const text = await part.textContent();
            if (text && text.trim() &&
              !text.includes('Ketik pesan') &&
              text.trim().length > 2) {
              replies.push(text.trim());
              log.debug(`[DirectMessage] Captured bubble ${replies.length}`, {
                preview: text.substring(0, 60) + '...'
              });
            }
          }
        } catch (error: any) {
          log.warn(`[DirectMessage] Error at index ${i}`, { error: error.message });
        }
      }

      log.capture.strategy('DirectMessage', replies.length > 0, replies.length);
      return { foundQuestion: true, replies };

    } catch (error: any) {
      log.error('[DirectMessage] Capture failed', error);
      return { foundQuestion: false, replies };
    }
  }

  /**
   * Capture responses using Fallback strategy
   * Used when DirectMessage fails to capture responses
   */
  private static async captureFallback(page: Page, question: string): Promise<string[]> {
    const replies: string[] = [];

    try {
      log.debug('[Fallback] Starting fallback capture');

      // Strategy 1: Look for bot messages (not user, not system)
      const botMessages = await page.locator('.message:not(.user):not(.system) .content').all();
      log.debug(`[Fallback] Found ${botMessages.length} potential bot messages`);

      // Take last 6 messages to avoid capturing old messages
      const recentMessages = botMessages.slice(-6);

      for (const msg of recentMessages) {
        try {
          const text = await msg.textContent();
          if (text && text.trim() &&
            text.trim().toLowerCase() !== question.trim().toLowerCase() &&
            !text.includes('Ketik pesan') &&
            text.length > 5) {
            replies.push(text.trim());
            log.debug('[Fallback] Captured message', {
              preview: text.substring(0, 50) + '...'
            });
          }
        } catch (error) {
          // Continue with next message
        }
      }

      // If still no replies, try Strategy 2: Get recent content elements
      if (replies.length === 0) {
        log.debug('[Fallback] Trying alternative method');

        const recentContent = await page.locator('.message-content-wrapper .content').all();
        const lastFew = recentContent.slice(-6);

        for (const msg of lastFew) {
          try {
            const text = await msg.textContent();
            if (text && text.trim() &&
              text.trim().toLowerCase() !== question.trim().toLowerCase() &&
              !text.includes('Ketik pesan') &&
              text.length > 5) {
              replies.push(text.trim());
            }
          } catch (error) {
            // Continue
          }
        }
      }

      log.capture.strategy('Fallback', replies.length > 0, replies.length);
      return replies;

    } catch (error: any) {
      log.error('[Fallback] Fallback capture failed', error);
      return replies;
    }
  }

  /**
   * Main capture method that tries DirectMessage first, then Fallback
   */
  private static async captureResponses(page: Page, question: string): Promise<{ responses: string[]; strategyUsed: string; success: boolean }> {
    log.debug('Starting response capture', { question });

    // Try DirectMessage strategy first
    try {
      log.debug('Trying strategy: DirectMessage');
      const result = await this.captureDirectMessage(page, question);

      if (result.foundQuestion) {
        // Remove duplicates and filter out the question itself
        const uniqueResponses = [...new Set(result.replies)].filter(
          r => r.toLowerCase() !== question.trim().toLowerCase()
        );

        // If the question was found in the DOM, we do NOT fall back to fallback strategy.
        // Doing so would grab older messages when the bot is just slow to reply.
        log.info(`[DirectMessage] Question found in chat log. Captured responses: ${uniqueResponses.length}`);
        return {
          responses: uniqueResponses,
          strategyUsed: 'DirectMessage',
          success: uniqueResponses.length > 0
        };
      }
      log.debug('Strategy DirectMessage did not find the question in chat history');
    } catch (error: any) {
      log.warn('Strategy DirectMessage failed', { error: error.message });
    }

    // Try Fallback strategy only if DirectMessage couldn't find the question
    try {
      log.debug('Trying strategy: Fallback');
      const responses = await this.captureFallback(page, question);

      if (responses.length > 0) {
        const uniqueResponses = [...new Set(responses)].filter(
          r => r.toLowerCase() !== question.trim().toLowerCase()
        );

        if (uniqueResponses.length > 0) {
          log.info(`✅ Successfully captured ${uniqueResponses.length} responses using Fallback`);
          return {
            responses: uniqueResponses,
            strategyUsed: 'Fallback',
            success: true
          };
        }
      }
      log.debug('Strategy Fallback returned no valid responses');
    } catch (error: any) {
      log.warn('Strategy Fallback failed', { error: error.message });
    }

    // All strategies failed
    log.capture.noResponse(question);
    return {
      responses: [],
      strategyUsed: 'none',
      success: false
    };
  }

  static async prechatForm(
    page: Page,
    greeting: string,
    greeting2: string,
    name: string,
    email: string,
    phone: string
  ): Promise<void> {
    Modul.showLoading('Checking for available webchat pre-chat form');

    await Modul.waitTime(10);
    let webform = false;
    let fieldsFound = 0;

    log.platform.action('Checking for pre-chat form fields');

    try {
      const nameInput = await page.locator('#registername');
      if (await nameInput.isVisible()) {
        await nameInput.fill(name);
        log.info('✅ Pre-chat form name field available');
        webform = true;
        fieldsFound++;
      }
    } catch (error) {
      log.debug('Name field not found or not visible');
    }

    try {
      const emailInput = await page.locator('#registeremail');
      if (await emailInput.isVisible()) {
        await emailInput.fill(email);
        log.info('✅ Pre-chat form email field available');
        webform = true;
        fieldsFound++;
      }
    } catch (error) {
      log.debug('Email field not found or not visible');
    }

    try {
      const phoneInput = await page.locator('#registerphone');
      if (await phoneInput.isVisible()) {
        await phoneInput.fill(phone);
        log.info('✅ Pre-chat form phone field available');
        webform = true;
        fieldsFound++;
      }
    } catch (error) {
      log.debug('Phone field not found or not visible');
    }

    if (webform && fieldsFound > 0) {
      log.info(`✅ Pre-chat form detected with ${fieldsFound} fields`);

      try {
        const submitBtn = await page.locator('button[type="submit"]');
        if (await submitBtn.isVisible()) {
          log.platform.action('Submitting pre-chat form');
          await submitBtn.click();
          await Modul.waitTime(2);
          log.info('✅ Pre-chat form submitted successfully');
        } else {
          log.warn('⚠️ Submit button not found, trying alternative methods');
          // Try pressing Enter on the last field
          try {
            await page.keyboard.press('Enter');
            await Modul.waitTime(2);
          } catch { }
        }
      } catch (error) {
        log.error('Error submitting form', error);
      }
    } else {
      log.warn('❌ Pre-chat form not available or no fields found');
      log.info('🔄 Proceeding directly to chat');
    }
  }

  static async sendMessage(page: Page, question: string): Promise<void> {
    try {
      // Clear and fill input
      await page.locator('#input-message').clear();
      await page.locator('#input-message').fill(question);
      await Modul.waitTime(1);

      // Try multiple ways to send message
      try {
        // First try clicking the send button
        await page.locator('#button-send').click({ timeout: 5000 });
      } catch {
        try {
          // If button click fails, try pressing Enter
          await page.locator('#input-message').press('Enter');
        } catch {
          // If both fail, try force clicking the button
          await page.locator('#button-send').click({ force: true });
        }
      }

      await Modul.waitTime(2);
    } catch (error) {
      console.error('Error sending message:', error);
      throw error;
    }
  }

  static async waitReply(page: Page, question: string, timeout: number = 300000): Promise<void> {
    console.log(`⏳ Waiting for bot reply to: "${question}" (with stabilization)`);
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
            log.debug(`[Webchat] Response still growing: ${lastTextLength} -> ${currentText.length}`);
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
    // Use internal capture method
    const result = await this.captureResponses(page, question);

    if (!result.success || result.responses.length === 0) {
      log.capture.noResponse(question);
      return [];
    }

    log.info(`📋 Captured ${result.responses.length} responses using ${result.strategyUsed}`);
    return result.responses;
  }

  static async takeScreenshot(page: Page, idTest: string, key: string, question: string, screenshotsFolder: string): Promise<string> {
    const fs = require('fs');
    const path = require('path');
    // Use the provided screenshotsFolder directly (ensure it exists)
    const screenshotDir = screenshotsFolder || 'report/screenshoot';
    if (!fs.existsSync(screenshotDir)) {
      fs.mkdirSync(screenshotDir, { recursive: true });
    }

    const sanitizedQuestion = question.substring(0, 30).replace(/[^a-z0-9]/gi, '_');
    const filename = `${idTest}_${key}_${sanitizedQuestion}.png`;
    const filepath = path.join(screenshotDir, filename);

    await page.screenshot({ path: filepath, fullPage: true });
    return filename;
  }

  static calculateStatus(score: number): string {
    return score >= 0.6 ? 'pass' : 'failed';
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
    const title = '当 Membaca pertanyaan dan mengirim ke webchat';
    Modul.showLoading(title);
    console.log('\n🚀 Starting Webchat Actions');

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
      console.log(`⏳ Waiting for welcome message ("${welcomeText}") to appear...`);
      try {
        const welcomeMessage = page.locator('.message-content-wrapper .content')
                                   .filter({ hasText: welcomeRegex })
                                   .first();
        await welcomeMessage.waitFor({ state: 'visible', timeout: 20000 });
        console.log('✅ Welcome message detected!');
      } catch (error) {
        console.log('⚠️ Timeout waiting for welcome message, proceeding anyway');
      }
    } else {
      console.log('Skip waiting for initial welcome message (WELCOME_MESSAGE_TEXT not set), proceeding directly.');
    }

    // Handle initial greetings
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
        // Tunggu hingga bot selesai merespons sebelum mengambil chat
        await this.waitReply(page, q, 120000);
        const raw = await this.getReplyChat(page, q);
        return raw.join('\n').trim();
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
      platformLabel: 'Playwright TypeScript',
      testTracker,
      onBeforeQuestion: async (count) => {
        if (count % 5 === 0) {
          log.info('🔄 Reloading page in Webchat to prevent memory issues...');
          await page.reload();
          await Modul.waitTime(2);
        }
      }
    });
  }
}
