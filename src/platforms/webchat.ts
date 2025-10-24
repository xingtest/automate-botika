import { Page } from 'playwright';
import { Modul } from '../utils/modul';
import { EnvFile } from '../utils/envfile';
import { GeminiEvaluator } from '../utils/gemini-evaluator';
import { ResponseCapture } from '../utils/response-capture';
import { TestData, BotData, SummaryData } from '../types';

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

    console.log('🔍 Checking for pre-chat form fields...');

    try {
      const nameInput = await page.locator('#registername');
      if (await nameInput.isVisible()) {
        await nameInput.fill(name);
        console.log('\x1b[32m ✅ pre-chat form name available\x1b[0m');
        webform = true;
        fieldsFound++;
      }
    } catch (error) {
      console.log('Name field not found or not visible');
    }

    try {
      const emailInput = await page.locator('#registeremail');
      if (await emailInput.isVisible()) {
        await emailInput.fill(email);
        console.log('\x1b[32m ✅ pre-chat form email available\x1b[0m');
        webform = true;
        fieldsFound++;
      }
    } catch (error) {
      console.log('Email field not found or not visible');
    }

    try {
      const phoneInput = await page.locator('#registerphone');
      if (await phoneInput.isVisible()) {
        await phoneInput.fill(phone);
        console.log('\x1b[32m ✅ pre-chat form phone available\x1b[0m');
        webform = true;
        fieldsFound++;
      }
    } catch (error) {
      console.log('Phone field not found or not visible');
    }

    if (webform && fieldsFound > 0) {
      console.log(`✅ Pre-chat form detected with ${fieldsFound} fields`);

      try {
        const submitBtn = await page.locator('button[type="submit"]');
        if (await submitBtn.isVisible()) {
          console.log('📤 Submitting pre-chat form...');
          await submitBtn.click();
          await Modul.waitTime(5); // Wait longer for form submission
          console.log('✅ Pre-chat form submitted successfully');
        } else {
          console.log('⚠️ Submit button not found, trying alternative methods');
          // Try pressing Enter on the last field
          try {
            await page.keyboard.press('Enter');
            await Modul.waitTime(3);
          } catch { }
        }
      } catch (error) {
        console.log('❌ Error submitting form:', error);
      }
    } else {
      console.log('\x1b[31m❌ Pre-chat form not available or no fields found\x1b[0m');
      console.log('🔄 Using direct message input instead...');

      try {
        await page.locator('#input-message').fill(greeting);
        await page.keyboard.press('Enter');
        await Modul.waitTime(5);
        console.log('✅ Greeting sent via direct input');
      } catch (error) {
        console.log('❌ Error sending greeting:', error);
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
    const replies: string[] = [];

    try {
      console.log(`🔍 Looking for bot response to: "${question}"`);

      // Wait a moment for messages to stabilize
      await Modul.waitTime(2);

      // Get all message wrappers
      const allMessages = await page.locator('.message-content-wrapper').all();
      console.log(`📊 Total message wrappers: ${allMessages.length}`);

      // Find the index of our question
      let questionIndex = -1;
      for (let i = allMessages.length - 1; i >= 0; i--) {
        try {
          const contents = await allMessages[i].locator('.content').all();
          for (const content of contents) {
            const text = await content.textContent();
            if (text && text.trim().toLowerCase() === question.trim().toLowerCase()) {
              questionIndex = i;
              console.log(`✅ Found question at index ${i}: "${text}"`);
              break;
            }
          }
          if (questionIndex >= 0) break;
        } catch { }
      }

      if (questionIndex < 0) {
        console.log('⚠️ Question not found in message history');
        return replies;
      }

      // Capture ALL bot responses after our question until we hit another user message or end
      console.log(`📝 Capturing responses from index ${questionIndex + 1} onwards...`);

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
            console.log(`🛑 Stopped at index ${i} - found next user message`);
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
              console.log(`✅ Captured bubble ${replies.length}: "${text.substring(0, 60)}..."`);
            }
          }
        } catch (error: any) {
          console.log(`⚠️ Error at index ${i}:`, error.message);
        }
      }

      // Try different approaches to find bot messages
      const strategies = [
        // Strategy 1: Already captured above - skip if we have replies
        async () => {
          if (replies.length > 0) {
            console.log(`✅ Already captured ${replies.length} replies, skipping Strategy 1`);
            return;
          }

          const botMessages = await page.locator('.message:not(.user):not(.system) .content').all();
          console.log(`Strategy 1 Fallback: Found ${botMessages.length} potential bot messages`);

          for (const msg of botMessages.slice(-6)) {
            try {
              const text = await msg.textContent();
              if (text && text.trim() &&
                text.trim().toLowerCase() !== question.trim().toLowerCase() &&
                !text.includes('Ketik pesan')) {
                replies.push(text.trim());
                console.log(`✅ Bot message: "${text.substring(0, 50)}..."`);
              }
            } catch { }
          }
        },

        // Strategy 2: Look for messages that are NOT user messages
        async () => {
          if (replies.length > 0) return;

          const allMessages = await page.locator('.message-content-wrapper').all();
          console.log(`Strategy 2: Checking ${allMessages.length} total messages`);

          // Find our question first
          let questionIndex = -1;
          for (let i = allMessages.length - 1; i >= 0; i--) {
            try {
              const content = await allMessages[i].locator('.content').first().textContent();
              if (content && content.trim().toLowerCase() === question.trim().toLowerCase()) {
                questionIndex = i;
                console.log(`Found question at index ${i}`);
                break;
              }
            } catch { }
          }

          // Get messages after our question
          if (questionIndex >= 0) {
            for (let i = questionIndex + 1; i < allMessages.length; i++) {
              try {
                const messageWrapper = allMessages[i];

                // Check if this is a user message (skip if it is)
                const isUserMessage = await messageWrapper.locator('.user, [class*="user"]').count() > 0;
                if (isUserMessage) {
                  console.log(`Skipping user message at index ${i}`);
                  continue;
                }

                // Get all content parts from this message
                const contentParts = await messageWrapper.locator('.content').all();
                for (const part of contentParts) {
                  const text = await part.textContent();
                  if (text && text.trim() && !text.includes('Ketik pesan')) {
                    replies.push(text.trim());
                    console.log(`✅ Bot response part: "${text.substring(0, 50)}..."`);
                  }
                }
              } catch (error: any) {
                console.log(`Error at index ${i}:`, error.message);
              }
            }
          }
        },

        // Strategy 3: Fallback - get recent non-question messages
        async () => {
          if (replies.length > 0) return;

          console.log('Strategy 3: Fallback method');
          const recentMessages = await page.locator('.message-content-wrapper .content').all();
          const lastFew = recentMessages.slice(-6); // Last 6 content elements

          for (const msg of lastFew) {
            try {
              const text = await msg.textContent();
              if (text && text.trim() &&
                text.trim().toLowerCase() !== question.trim().toLowerCase() &&
                !text.includes('Ketik pesan') &&
                text.length > 5) {
                replies.push(text.trim());
                console.log(`✅ Fallback found: "${text.substring(0, 50)}..."`);
              }
            } catch { }
          }
        }
      ];

      // Execute strategies in order until we get replies
      for (const strategy of strategies) {
        await strategy();
        if (replies.length > 0) break;
      }

    } catch (error) {
      console.error('Error getting reply:', error);
    }

    // Remove duplicates and questions
    const uniqueReplies = [...new Set(replies)].filter(reply =>
      reply.toLowerCase() !== question.trim().toLowerCase()
    );

    console.log(`📋 Final bot responses (${uniqueReplies.length}):`,
      uniqueReplies.map(r => `"${r.substring(0, 40)}..."`));

    return uniqueReplies;
  }

  static async takeScreenshot(page: Page, idTest: string, key: string, question: string): Promise<string> {
    const screenshotDir = 'report/screenshoot';
    const fs = require('fs');
    if (!fs.existsSync(screenshotDir)) {
      fs.mkdirSync(screenshotDir, { recursive: true });
    }

    const sanitizedQuestion = question.substring(0, 30).replace(/[^a-z0-9]/gi, '_');
    const filename = `${idTest}_${key}_${sanitizedQuestion}.png`;
    const filepath = `${screenshotDir}/${filename}`;

    await page.screenshot({ path: filepath, fullPage: true });
    return filename;
  }

  static calculateStatus(score: number): string {
    return score >= 0.75 ? 'PASS' : 'FAILED';
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
    browserName: string
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
          const imageCapture = await this.takeScreenshot(page, idTest, key, question);
          console.log(`📸 Screenshot saved: ${imageCapture}`);

          // Then capture response using utility
          const respondBotArray = await ResponseCapture.captureWebchatResponses(page, question);
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
