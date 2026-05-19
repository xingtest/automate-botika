import { Page } from 'playwright';
import { Modul } from '../utils/modul';
import { EnvFile } from '../utils/envfile';
import { EvaluatorFactory } from '../utils/ai-evaluator';
import { TestData, BotData, SummaryData } from '../main';
import { TestTracker } from '../utils/test-tracker';

export class DhaiPlatform {
  static async startChat(page: Page): Promise<void> {
    try {
      // Click "Tap to Start" button
      const tapToStartButton = page.locator('button:has-text("Tap to Start")');
      await tapToStartButton.click();
      console.log('Tombol "Tap to Start" diklik.');
      await Modul.waitTime(2);

      // Click second interaction button
      const interactionButton = page.locator('#button-action-chat');
      await interactionButton.click();
      console.log('Tombol interaksi kedua diklik.');

      // Wait for textarea to appear
      await page.locator('textarea').waitFor({ state: 'visible', timeout: 30000 });
      console.log('Antarmuka obrolan DHAI (Luna) siap.');
    } catch (error) {
      console.error('Error saat memulai obrolan DHAI (Luna):', error);
      throw error;
    }
  }

  static async sendMessage(page: Page, message: string): Promise<void> {
    try {
      const textarea = page.locator('textarea');
      await textarea.click();
      await textarea.fill(message);
      await Modul.waitTime(1);
      await page.keyboard.press('Enter');
      console.log(`Pesan terkirim: ${message}`);
    } catch (error) {
      console.error('Error saat mengirim pesan di DHAI:', error);
      throw error;
    }
  }

  static async getReply(page: Page, userMessage: string): Promise<string[]> {
    // Retry logic: try up to 3 times with increasing wait time
    const maxRetries = 3;
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        const waitTime = attempt === 1 ? 5 : attempt * 3; // 5s, 6s, 9s
        await Modul.waitTime(waitTime);

        console.log(`🔍 Capturing bot responses for: "${userMessage}" (attempt ${attempt}/${maxRetries})`);

        const responses = await this.extractBotResponse(page, userMessage);

        if (responses.length > 0) {
          return responses;
        }

        if (attempt < maxRetries) {
          console.log(`⏳ No response yet, retrying in ${(attempt + 1) * 3}s...`);
        }
      } catch (error) {
        console.error(`Error on attempt ${attempt}:`, error);
        if (attempt === maxRetries) {
          return [];
        }
      }
    }

    return [];
  }

  private static async extractBotResponse(page: Page, userMessage: string): Promise<string[]> {
    try {
      // Try multiple selectors for DHAI messages - prioritize specific ones
      const messageSelectors = [
        'span.whitespace-pre-line',  // DHAI bot response
        'span[data-v-4699965e]',  // DHAI specific
        'span[class*="whitespace"]',
        'div[class*="message"]',
        'div[class*="chat"]',
        'div[class*="bubble"]',
      ];

      let chatMessages: any[] = [];
      for (const selector of messageSelectors) {
        try {
          const found = await page.locator(selector).all();
          if (found.length > 0) {
            chatMessages = found;
            console.log(`📊 Found ${found.length} messages with selector: ${selector}`);
            break;
          }
        } catch { }
      }

      console.log(`📊 Total messages: ${chatMessages.length}`);

      if (chatMessages.length > 0) {
        // Find ALL occurrences of the question
        const questionIndices: number[] = [];
        for (let i = 0; i < chatMessages.length; i++) {
          const text = await chatMessages[i].textContent();
          if (text && text.includes(userMessage)) {
            questionIndices.push(i);
          }
        }

        if (questionIndices.length === 0) {
          console.log('⚠️ Question not found');

          // Fallback: return last 3 messages
          const recentMessages: string[] = [];
          for (let i = Math.max(0, chatMessages.length - 3); i < chatMessages.length; i++) {
            const text = await chatMessages[i].textContent();
            if (text && text.trim() && !text.includes(userMessage)) {
              recentMessages.push(text.trim());
            }
          }

          if (recentMessages.length > 0) {
            console.log(`📊 Using ${recentMessages.length} recent messages as fallback`);
            return recentMessages;
          }

          return [];
        }

        // Use the LAST occurrence (most recent)
        const questionIndex = questionIndices[questionIndices.length - 1];
        console.log(`✅ Found ${questionIndices.length} occurrence(s) of question`);
        console.log(`✅ Using LAST occurrence at index ${questionIndex}`);

        // Collect bot responses after the question
        const botResponses: string[] = [];
        const startIndex = questionIndex + 1;

        console.log(`📝 Capturing from index ${startIndex} to ${chatMessages.length}...`);

        // Check if there are messages after the question
        if (startIndex >= chatMessages.length) {
          console.log('⚠️ No messages after question, question is at the end');
          return [];
        }

        // UI noise patterns
        const uiNoisePatterns = [
          /^Enter$/i,
          /^Send$/i,
          /^Sent$/i,
          /^\d{2}:\d{2}$/,  // Time stamps
          /^[0-9]+$/,  // Just numbers
        ];

        for (let i = startIndex; i < chatMessages.length; i++) {
          const text = await chatMessages[i].textContent();
          if (!text || !text.trim()) continue;

          let cleanText = text.trim();

          // Skip if it's the user's message
          if (cleanText.includes(userMessage)) {
            console.log(`  ⏭️ Skipping user message at ${i}`);
            continue;
          }

          // Check if ENTIRE text is just UI noise
          const isExactNoise = uiNoisePatterns.some(pattern => pattern.test(cleanText));
          if (isExactNoise) {
            console.log(`  ⏭️ Skipping UI noise at ${i}: "${cleanText}"`);
            continue;
          }

          // Skip if this is a duplicate of the last message
          if (botResponses.length > 0 && botResponses[botResponses.length - 1] === cleanText) {
            console.log(`  ⏭️ Skipping duplicate at ${i}: "${cleanText.substring(0, 40)}..."`);
            continue;
          }

          botResponses.push(cleanText);
          console.log(`  ✅ Bot message ${botResponses.length}: "${cleanText.substring(0, 80)}..."`);
        }

        if (botResponses.length > 0) {
          console.log(`📊 Captured ${botResponses.length} bot responses (after deduplication)`);
          return botResponses;
        }
      }

      // Fallback: try to get all visible text
      console.log('💡 Trying fallback: get all visible text');
      try {
        // Try bubble-msg first
        const bubbleMsg = await page.locator('#bubble-msg').textContent();
        if (bubbleMsg && bubbleMsg.trim()) {
          const lines = bubbleMsg.split('\n').filter(line => {
            const trimmed = line.trim();
            return trimmed && !/^\d{2}:\d{2}$/.test(trimmed) && !trimmed.includes(userMessage);
          });

          if (lines.length > 0) {
            console.log(`📊 Captured ${lines.length} lines from bubble-msg`);
            return lines.map(l => l.trim());
          }
        }
      } catch { }

      // Last resort: get all text content from body
      try {
        console.log('💡 Last resort: scanning all text in page');
        const allText = await page.locator('body').allTextContents();
        if (allText.length > 0) {
          const fullText = allText.join('\n');
          const lines = fullText.split('\n').filter(line => {
            const trimmed = line.trim();
            return trimmed &&
              trimmed.length > 10 &&  // At least 10 chars
              !/^\d{2}:\d{2}$/.test(trimmed) &&
              !trimmed.includes(userMessage) &&
              !trimmed.includes('Tap to Start') &&
              !trimmed.includes('Send');
          });

          if (lines.length > 0) {
            // Take last 3 lines as bot response
            const recentLines = lines.slice(-3);
            console.log(`📊 Captured ${recentLines.length} lines from page scan`);
            return recentLines.map(l => l.trim());
          }
        }
      } catch { }

      console.log('⚠️ No bot responses captured');
      return [];
    } catch (error) {
      console.error('❌ Error:', error);
      return [];
    }
  }

  static async takeScreenshot(page: Page, idTest: string, key: string, question: string, screenshotsFolder: string): Promise<string> {
    const fs = require('fs');
    const path = require('path');
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
    return score >= 0.7 ? 'pass' : 'failed';
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
    
    const title = '当 Membaca pertanyaan dan mengirim ke DHAI';
    Modul.showLoading(title);
    console.log();

    try {
      await this.startChat(page);
      await Modul.waitTime(5);

      // Send greetings
      if (greeting && greeting.trim() !== '') {
        console.log(`📤 Sending greeting 1: "${greeting}"`);
        await this.sendMessage(page, greeting);
        await Modul.waitTime(5);
      }

      if (greeting2 && greeting2.trim() !== '') {
        console.log(`📤 Sending greeting 2: "${greeting2}"`);
        await this.sendMessage(page, greeting2);
        await Modul.waitTime(5);
      }
    } catch (error) {
      console.error('Gagal memulai obrolan atau mengirim sapaan di DHAI:', error);
      return;
    }

    const countPerElementTitle = jsonData.length;
    const questionCount = jsonData.reduce((sum, item) => {
      return sum + Object.keys(item).filter(key => key.startsWith('pertanyaan')).length;
    }, 0);

    for (const element of jsonData) {
      const durationPerTitle = Modul.startTime();
      Modul.showLoading(element.title || 'Untitled');
      console.log();

      for (const [key, value] of Object.entries(element)) {
        if (key.startsWith('pertanyaan') && value && value.trim() !== '') {
          const durationPerQuestion = Modul.startTime();
          const question = value;

          try {
            await this.sendMessage(page, question);
            await Modul.waitTime(5);

            // Get bot response first
            const respondBotList = await this.getReply(page, question);
            let respondBot = respondBotList.join('\n').trim();

            if (!respondBot) {
              respondBot = 'No response captured';
            }

            // Take screenshot AFTER bot responds
            const imageCapture = await this.takeScreenshot(page, idTest, key, question, screenshotsFolder);

            const titleLoading = `${key} : ${question}`;
            Modul.showLoadingSampleText(titleLoading);

            const respondCsv = (element.context || '').trim();
            const endDurationPerSampleText = Modul.endTime(durationPerQuestion);

            // AI evaluation using selected provider
            console.log(`🤖 Evaluating response with ${process.env.AI_PROVIDER || 'Gemini'} AI...`);
            const aiEvaluator = EvaluatorFactory.getEvaluator();
            const evaluationResult = await aiEvaluator.evaluateResponse(
              question,
              respondCsv,
              respondBot,
              element.title || 'Unknown Topic'
            );

            const skor = evaluationResult.score;
            const explanation = evaluationResult.explanation;
            const AI = evaluationResult.success ? `${evaluationResult.provider} + Playwright TypeScript` : `Playwright TypeScript (${evaluationResult.provider} fallback)`;

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

            // Add result to tracker
            testTracker.addResult({
              no: element.no || '',
              title: element.title || '',
              question,
              response_kb: respondCsv,
              response_llm: respondBot,
              score: skor,
              status: status as 'pass' | 'failed',
              duration: endDurationPerSampleText,
              image_capture: imageCapture,
              explanation: explanation
            });

            const trackerSummary = testTracker.getSummary();

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
              success: trackerSummary.passed,
              failed: trackerSummary.failed
            };

            EnvFile.writeJsonDataSummary(dataSummary, reportFilename, idTest);
          } catch (error) {
            console.error(`Error selama interaksi DHAI untuk pertanyaan '${question}':`, error);
          }
        }
      }

      const endDurationPerTitle = Modul.endTime(durationPerTitle);
      const chart = { [element.title || 'Untitled']: endDurationPerTitle };
      EnvFile.writeJsonChart(chart, reportFilename, idTest);
      console.log(`\n竢ｳ Total durasi Topik '${element.title || 'Untitled'}' : ${endDurationPerTitle}\n`);
    }

    console.log('識 Topik Terakhir \n');
    
    // Write end time and total duration
    const endTime = new Date().toTimeString().split(' ')[0];
    const totalDuration = Modul.endTime(start);
    EnvFile.writeEndTimeSummary(endTime, totalDuration, reportFilename, idTest);
    
    console.log(`✅ Test completed at: ${endTime}`);
    console.log(`⏱️ Total test duration: ${totalDuration}`);
  }
}
