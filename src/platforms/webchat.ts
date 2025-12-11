import { Page } from 'playwright';
import { Modul } from '../utils/modul';
import { EnvFile } from '../utils/envfile';
import { GeminiEvaluator } from '../utils/gemini-evaluator';
import { TestData, BotData, SummaryData } from '../types';
import { log } from '../utils/logger';
import { WebchatResponseCapture } from '../strategies/webchat/response-capture.manager';

export class WebchatPlatform {
  static async prechatForm(
    page: Page,
    greeting: string,
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
          // Wait for bot response after form submission
          await this.waitReply(page, greeting, 30000);
        } else {
          log.warn('⚠️ Submit button not found, trying alternative methods');
          // Try pressing Enter on the last field
          try {
            await page.keyboard.press('Enter');
            await Modul.waitTime(2);
            await this.waitReply(page, greeting, 30000);
          } catch { }
        }
      } catch (error) {
        log.error('Error submitting form', error);
      }
    } else {
      log.warn('❌ Pre-chat form not available or no fields found');
      log.info('🔄 Using direct message input instead');

      try {
        await page.locator('#input-message').fill(greeting);
        await page.keyboard.press('Enter');
        await Modul.waitTime(2);
        log.info('✅ Greeting sent via direct input');
        // Wait for bot response after greeting
        await this.waitReply(page, greeting, 30000);
      } catch (error) {
        log.error('Error sending greeting', error);
      }
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

  static async waitReply(page: Page, question: string, timeout: number = 30000): Promise<void> {
    const startTime = Date.now();
    let lastResponseCount = 0;
    let stableCount = 0;

    console.log(`⏳ Waiting for bot reply to: "${question}" (max ${timeout / 1000}s)`);

    // Get initial message count
    try {
      lastResponseCount = await page.locator('.message-content-wrapper').count();
    } catch { }

    while (Date.now() - startTime < timeout) {
      try {
        // Count all messages to detect new responses
        const currentMessages = await page.locator('.message-content-wrapper').count();

        if (currentMessages > lastResponseCount) {
          // New message detected
          lastResponseCount = currentMessages;
          stableCount = 0;

          // Get the latest message
          const lastMessage = page.locator('.message-content-wrapper').last();
          const content = await lastMessage.locator('.content').textContent();

          // Check if it's a bot response (not our question)
          if (content &&
            content.trim().toLowerCase() !== question.trim().toLowerCase() &&
            content.trim() !== '' &&
            !content.includes('Ketik pesan')) {

            console.log(`✅ Bot replied: "${content.substring(0, 50)}..."`);

            // Wait a short time for any additional messages
            await Modul.waitTime(1);
            return;
          }
        } else {
          // No new messages, increment stable count
          stableCount++;

          // If we have messages and they've been stable for a while, check if we have a response
          if (currentMessages > 1 && stableCount > 3) {
            const lastMessage = page.locator('.message-content-wrapper').last();
            const content = await lastMessage.locator('.content').textContent();

            if (content &&
              content.trim().toLowerCase() !== question.trim().toLowerCase() &&
              content.trim() !== '' &&
              !content.includes('Ketik pesan')) {

              console.log(`✅ Found stable response: "${content.substring(0, 50)}..."`);
              return;
            }
          }
        }
      } catch { }

      await Modul.waitTime(0.5); // Check more frequently
    }

    console.log(`⚠️ Timeout (${timeout / 1000}s) waiting for reply to: "${question}"`);
  }

  static async getReplyChat(page: Page, question: string): Promise<string[]> {
    // Use new response capture manager with strategy pattern
    const captureManager = new WebchatResponseCapture();
    const result = await captureManager.capture(page, question);

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
    return score >= 0.7 ? 'PASS' : 'FAILED';
  }

  static async actions(
    page: Page,
    jsonData: TestData[],
    reportFilename: string,
    idTest: string,
    timeStart: string,
    today: string,
    testerName: string,
    url: string,
    titlePage: string,
    browserName: string,
    screenshotsFolder: string
  ): Promise<void> {
    const start = Modul.startTime();
    const title = '当 Membaca pertanyaan dan mengirim ke webchat';
    Modul.showLoading(title);
    console.log();

    const countPerElementTitle = jsonData.length;
    const questionCount = jsonData.reduce((sum, item) => {
      return sum + Object.keys(item).filter(key => key.startsWith('pertanyaan')).length;
    }, 0);

    for (const element of jsonData) {
      await page.reload();
      await Modul.waitTime(3);
      const durationPerTitle = Modul.startTime();
      Modul.showLoading(element.title || 'Untitled');
      console.log();

      let count = 0;
      for (const [key, value] of Object.entries(element)) {
        if (key.startsWith('pertanyaan') && value && value.trim() !== '') {
          count++;
          const durationPerQuestion = Modul.startTime();
          const question = value;

          console.log(`📤 Sending: "${question}"`);
          await this.sendMessage(page, question);

          console.log(`⏳ Waiting for response...`);
          await this.waitReply(page, question);

          // Wait a bit more to ensure all content is loaded
          await Modul.waitTime(2);

          // Take screenshot first while page is stable
          const imageCapture = await this.takeScreenshot(page, idTest, key, question, screenshotsFolder);
          console.log(`📸 Screenshot saved: ${imageCapture}`);

          // Then capture response using new strategy pattern
          const respondBotArray = await this.getReplyChat(page, question);
          let respondBot = respondBotArray.join('\n').trim();

          console.log(`📝 Final response: "${respondBot ? respondBot.substring(0, 80) + '...' : 'NO RESPONSE'}"`);

          if (!respondBot) {
            console.log('⚠️ No bot response captured, using fallback message');
            respondBot = 'Bot tidak memberikan response atau response tidak tertangkap';
          }

          // Reload page every 5 questions to prevent memory issues
          if (count % 5 === 0) {
            console.log('🔄 Reloading page...');
            await page.reload();
            await Modul.waitTime(2);
          }

          const titleLoading = `${key} : ${question}`;
          Modul.showLoadingSampleText(titleLoading);

          const respondCsv = (element.context || '').trim();
          const endDurationPerSampleText = Modul.endTime(durationPerQuestion);

          // AI evaluation using Gemini
          console.log('🤖 Evaluating response with Gemini AI...');
          const geminiEvaluator = new GeminiEvaluator();
          const evaluationResult = await geminiEvaluator.evaluateResponse(
            question,
            respondCsv,
            respondBot,
            element.title || 'Unknown Topic'
          );

          const skor = evaluationResult.score;
          const explanation = evaluationResult.explanation;
          const AI = evaluationResult.success ? 'Gemini AI + Playwright TypeScript' : 'Playwright TypeScript (Gemini fallback)';

          const status = this.calculateStatus(skor);

          const dataBotData: BotData = {
            no: element.no || '',
            title: element.title || '',
            question,
            response_kb: respondCsv,
            response_llm: respondBot,
            status,
            duration: endDurationPerSampleText,
            image_capture: imageCapture,
            skor,
            explanation
          };

          EnvFile.writeJsonDataBot(dataBotData, reportFilename, idTest);

          // Calculate pass/fail counts
          const passCount = 0; // Placeholder
          const failedCount = 0; // Placeholder

          const dataSummary: SummaryData = {
            id_test: idTest,
            tester_name: testerName,
            ai_evaluation: AI,
            url,
            page_name: titlePage,
            browser_name: browserName,
            date_test: today,
            start_time_test: timeStart,
            total_title: countPerElementTitle,
            total_question: questionCount,
            success: passCount,
            failed: failedCount
          };

          EnvFile.writeJsonDataSummary(dataSummary, reportFilename, idTest);
        }
      }

      const endDurationPerTitle = Modul.endTime(durationPerTitle);
      const chart = { [element.title || 'Untitled']: endDurationPerTitle };
      EnvFile.writeJsonChart(chart, reportFilename, idTest);
      console.log(`\n竢ｳ Total durasi Topik '${element.title || 'Untitled'}' : ${endDurationPerTitle}\n`);
    }

    console.log('識 Topik Terakhir \n');
  }
}
