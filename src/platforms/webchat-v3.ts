import { Page } from 'playwright';
import { Modul } from '../utils/modul';
import { EnvFile } from '../utils/envfile';
import { EvaluatorFactory } from '../utils/ai-evaluator';
import { TestData, BotData, SummaryData } from '../main';
import { log } from '../utils/logger';
import { TestTracker } from '../utils/test-tracker';

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
                    questionIndex = i;
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
      await input.waitFor({ state: 'visible', timeout: 10000 });
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

  static async waitReply(page: Page, question: string, timeout: number = 40000): Promise<void> {
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

    const countPerElementTitle = jsonData.length;
    const questionCount = jsonData.reduce((sum, item) => {
      return sum + Object.keys(item).filter(key => key.startsWith('pertanyaan')).length;
    }, 0);

    let globalCount = 0;
    for (const element of jsonData) {
      const durationPerTitle = Modul.startTime();
      Modul.showLoading(element.title || 'Untitled');

      for (const [key, value] of Object.entries(element)) {
        if (key.startsWith('pertanyaan') && value && value.trim() !== '') {
          globalCount++;
          const durationPerQuestion = Modul.startTime();
          const question = value;

          console.log(`📤 Sending: "${question}"`);
          await this.sendMessage(page, question);
          await this.waitReply(page, question);

          const imageCapture = await this.takeScreenshot(page, idTest, key, question, screenshotsFolder);
          const respondBotArray = await this.getReplyChat(page, question);
          let respondBot = respondBotArray.join('\n').trim() || 'No response captured';

          console.log(`📝 Final response: "${respondBot.substring(0, 80)}..."`);

          const respondCsv = (element.context || '').trim();
          const endDurationPerSampleText = Modul.endTime(durationPerQuestion);

          console.log(`🤖 Evaluating response with AI...`);
          const aiEvaluator = EvaluatorFactory.getEvaluator();
          const evaluationResult = await aiEvaluator.evaluateResponse(
            question,
            respondCsv,
            respondBot,
            element.title || 'Unknown Topic'
          );

          const skor = evaluationResult.score;
          const status = skor >= 0.7 ? 'pass' : 'failed';

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
            explanation: evaluationResult.explanation
          };

          EnvFile.writeJsonDataBot(dataBotData, reportFilename, idTest);
          testTracker.addResult({
            ...dataBotData,
            score: skor,
            status: status as 'pass' | 'failed',
            explanation: evaluationResult.explanation,
            image_capture: imageCapture || ''
          });

          const dataSummary: SummaryData = {
            id_test: idTest,
            tester_name: testerName,
            ai_evaluation: `${evaluationResult.provider} + V3`,
            url,
            page_name: titlePage,
            browser_name: browserName,
            date_test: today,
            start_time_test: timeStart,
            total_title: countPerElementTitle,
            total_question: questionCount,
            success: testTracker.getSummary().passed,
            failed: testTracker.getSummary().failed
          };
          EnvFile.writeJsonDataSummary(dataSummary, reportFilename, idTest);

          if (globalCount % 5 === 0) {
            console.log('🔄 Reloading page to prevent memory leaks...');
            await page.reload();
            await Modul.waitTime(3);
          }
        }
      }
      const endDurationPerTitle = Modul.endTime(durationPerTitle);
      EnvFile.writeJsonChart({ [element.title || 'Untitled']: endDurationPerTitle }, reportFilename, idTest);
    }

    const endTime = new Date().toTimeString().split(' ')[0];
    const totalDuration = Modul.endTime(start);
    EnvFile.writeEndTimeSummary(endTime, totalDuration, reportFilename, idTest);
  }
}
