import { Page } from 'playwright';
import { Modul } from '../utils/modul';
import { EnvFile } from '../utils/envfile';
import { GeminiEvaluator } from '../utils/gemini-evaluator';
import { ResponseCapture } from '../utils/response-capture';
import { TestData, BotData, SummaryData } from '../types';

export class DhaiPlatform {
  static async startChat(page: Page): Promise<void> {
    try {
      // Click "Tap to Start" button
      const tapToStartButton = page.locator('button:has-text("Tap to Start")');
      await tapToStartButton.click();
      console.log('Tombol "Tap to Start" diklik.');
      await Modul.waitTime(2);

      // Click second interaction button
      const interactionButton = page.locator('button').nth(2);
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
    try {
      console.log(`🔍 Capturing bot responses for: "${userMessage}"`);
      await Modul.waitTime(3);

      // Try to find all chat messages
      const chatMessages = await page.locator('div[class*="message"], div[class*="chat"], div[class*="bubble"]').all();

      console.log(`📊 Total messages: ${chatMessages.length}`);

      if (chatMessages.length > 0) {
        // Find user's question
        let questionIndex = -1;
        for (let i = 0; i < chatMessages.length; i++) {
          const text = await chatMessages[i].textContent();
          if (text && text.includes(userMessage)) {
            questionIndex = i;
            console.log(`✅ Found question at index ${i}`);
            break;
          }
        }

        if (questionIndex < 0) {
          console.log('⚠️ Question not found, using recent messages');
        }

        // Collect bot responses after the question
        const botResponses: string[] = [];
        const startIndex = questionIndex >= 0 ? questionIndex + 1 : Math.max(0, chatMessages.length - 3);
        
        console.log(`📝 Capturing from index ${startIndex}...`);
        
        for (let i = startIndex; i < chatMessages.length; i++) {
          const text = await chatMessages[i].textContent();
          if (text && text.trim() && !text.includes(userMessage)) {
            botResponses.push(text.trim());
            console.log(`  ✅ Bot message ${botResponses.length}: "${text.substring(0, 60)}..."`);
          }
        }

        if (botResponses.length > 0) {
          console.log(`📊 Captured ${botResponses.length} bot responses`);
          return botResponses;
        }
      }

      // Fallback to bubble-msg
      console.log('💡 Trying fallback: bubble-msg');
      const bubbleMsg = await page.locator('#bubble-msg').textContent();
      if (bubbleMsg) {
        const lines = bubbleMsg.split('\n').filter(line => {
          const trimmed = line.trim();
          return trimmed && !/^\d{2}:\d{2}$/.test(trimmed) && !trimmed.includes(userMessage);
        });
        
        if (lines.length > 0) {
          console.log(`📊 Captured ${lines.length} lines from bubble-msg`);
          return lines.map(l => l.trim());
        }
      }

      console.log('⚠️ No bot responses captured');
      return [];
    } catch (error) {
      console.error('❌ Error:', error);
      return [];
    }
  }

  static async takeScreenshot(page: Page, idTest: string, key: string, question: string): Promise<string> {
    const fs = require('fs');
    const screenshotDir = 'report/screenshoot';
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
    return score >= 70 ? 'PASS' : 'FAILED';
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
    const title = '当 Membaca pertanyaan dan mengirim ke DHAI';
    Modul.showLoading(title);
    console.log();

    try {
      await this.startChat(page);
      await Modul.waitTime(5);
    } catch (error) {
      console.error('Gagal memulai obrolan DHAI:', error);
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

            const imageCapture = await this.takeScreenshot(page, idTest, key, question);
            const respondBotList = await this.getReply(page, question);
            let respondBot = respondBotList.join('\n').trim();

            if (!respondBot) {
              respondBot = 'Error: Tidak ada balasan dari bot.';
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
              success: 0,
              failed: 0
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
  }
}
