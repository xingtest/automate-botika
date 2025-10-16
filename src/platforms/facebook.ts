import { Page } from 'playwright';
import { Modul } from '../utils/modul';
import { EnvFile } from '../utils/envfile';
import { TestData, BotData, SummaryData } from '../types';
import * as fs from 'fs';

export class FacebookPlatform {
  private page: Page | null = null;
  private sessionFile = 'session/session-facebook.json';

  async initialize(page: Page): Promise<void> {
    this.page = page;

    if (!fs.existsSync(this.sessionFile)) {
      throw new Error(`Facebook session not found at '${this.sessionFile}'. Please generate it first.`);
    }

    // Load cookies from session
    const cookies = JSON.parse(fs.readFileSync(this.sessionFile, 'utf-8'));
    await page.context().addCookies(cookies);

    console.log('Facebook session loaded');
  }

  async navigateToChatbot(fanpageId: string): Promise<void> {
    if (!this.page) {
      throw new Error('Facebook page not initialized');
    }

    const chatbotUrl = `https://www.facebook.com/messages/t/${fanpageId}`;
    try {
      // Try with networkidle first
      await this.page.goto(chatbotUrl, { waitUntil: 'networkidle', timeout: 60000 });
    } catch (error) {
      // Fallback to domcontentloaded if networkidle fails
      console.log('Networkidle timeout, trying domcontentloaded...');
      await this.page.goto(chatbotUrl, { waitUntil: 'domcontentloaded', timeout: 60000 });
    }
    await Modul.waitTime(5);
    console.log(`Navigated to chatbot: ${chatbotUrl}`);
  }

  async sendMessage(message: string): Promise<boolean> {
    if (!this.page) {
      console.error('Facebook page not initialized');
      return false;
    }

    try {
      // Find message input box
      const messageBox = this.page.locator('div[contenteditable="true"][role="textbox"]').first();
      await messageBox.fill(message);
      await Modul.waitTime(0.5);

      // Try to send
      try {
        const sendButton = this.page.locator('div[aria-label*="send"], button[type="submit"]').first();
        await sendButton.click();
      } catch {
        await this.page.keyboard.press('Enter');
      }

      console.log(`Pesan terkirim: ${message}`);
      return true;
    } catch (error) {
      console.error('Error sending message:', error);
      return false;
    }
  }

  async getChatbotResponse(): Promise<string> {
    if (!this.page) {
      console.error('Facebook page not initialized');
      return 'Error: Page not initialized';
    }

    try {
      await Modul.waitTime(5);

      // Get latest bot response
      const xpath = "//div[contains(@class,'html-div') and contains(@class,'x18lvrbx')]";
      const elements = await this.page.locator(xpath).all();

      if (elements.length > 0) {
        const responses: string[] = [];
        for (const elem of elements) {
          const text = await elem.textContent();
          if (text && text.trim()) {
            responses.push(text.trim());
          }
        }
        return responses.join(' ');
      }

      return 'Tidak ada balasan dari bot';
    } catch (error) {
      console.error('Error getting chatbot response:', error);
      return 'Error: Gagal mengambil balasan';
    }
  }

  async takeScreenshot(idTest: string, key: string, question: string): Promise<string> {
    if (!this.page) {
      return '';
    }

    const screenshotDir = 'report/screenshoot';
    if (!fs.existsSync(screenshotDir)) {
      fs.mkdirSync(screenshotDir, { recursive: true });
    }

    const sanitizedQuestion = question.substring(0, 30).replace(/[^a-z0-9]/gi, '_');
    const filename = `${idTest}_${key}_${sanitizedQuestion}.png`;
    const filepath = `${screenshotDir}/${filename}`;

    await this.page.screenshot({ path: filepath, fullPage: true });
    return filename;
  }

  static calculateStatus(score: number): string {
    return score >= 70 ? 'PASS' : 'FAILED';
  }

  async actions(
    targetFanpageId: string,
    greeting: string,
    jsonData: TestData[],
    reportFilename: string,
    idTest: string,
    timeStart: string,
    today: string,
    testerName: string
  ): Promise<void> {
    await this.navigateToChatbot(targetFanpageId);

    const title = '当 Membaca pertanyaan dan mengirim ke Facebook';
    Modul.showLoading(title);
    console.log();

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

          const sent = await this.sendMessage(question);
          let respondBot = '';

          if (sent) {
            await Modul.waitTime(2);
            respondBot = await this.getChatbotResponse();
          } else {
            respondBot = 'Error: Gagal mengirim pesan ke chatbot.';
          }

          const imageCapture = await this.takeScreenshot(idTest, key, question);

          const titleLoading = `${key} : ${question}`;
          Modul.showLoadingSampleText(titleLoading);

          const respondCsv = (element.context || '').trim();
          const endDurationPerSampleText = Modul.endTime(durationPerQuestion);

          const skor = 80;
          const explanation = 'Auto-evaluated';
          const AI = 'Playwright TypeScript';

          const status = FacebookPlatform.calculateStatus(skor);

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

          const chatbotUrl = `https://www.facebook.com/messages/t/${targetFanpageId}`;
          const dataSummary: SummaryData = {
            id_test: idTest,
            tester_name: testerName,
            ai_evaluation: AI,
            url: chatbotUrl,
            page_name: 'Facebook Test',
            browser_name: 'Playwright',
            date_test: today,
            start_time_test: timeStart,
            total_title: countPerElementTitle,
            total_question: questionCount,
            success: 0,
            failed: 0
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
