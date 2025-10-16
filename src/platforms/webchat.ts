import { Page } from 'playwright';
import { Modul } from '../utils/modul';
import { EnvFile } from '../utils/envfile';
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

    await Modul.waitTime(3);
    let webform = false;

    try {
      const nameInput = await page.locator('#registername');
      if (await nameInput.isVisible()) {
        await nameInput.fill(name);
        console.log('\x1b[32m * pre-chat form name available\x1b[0m');
        webform = true;
      }
    } catch {}

    try {
      const emailInput = await page.locator('#registeremail');
      if (await emailInput.isVisible()) {
        await emailInput.fill(email);
        console.log('\x1b[32m * pre-chat form email available\x1b[0m');
        webform = true;
      }
    } catch {}

    try {
      const phoneInput = await page.locator('#registerphone');
      if (await phoneInput.isVisible()) {
        await phoneInput.fill(phone);
        console.log('\x1b[32m * pre-chat form phone available\x1b[0m');
        webform = true;
      }
    } catch {}

    try {
      const submitBtn = await page.locator('button[type="submit"]');
      if (await submitBtn.isVisible()) {
        await submitBtn.click();
        await Modul.waitTime(3);
      }
    } catch {}

    if (!webform) {
      console.log('\x1b[31m❌ Pre-chat form not available\x1b[0m\n');
      await page.locator('#input-message').fill(greeting);
      await page.keyboard.press('Enter');
      await Modul.waitTime(5);
    }
  }

  static async sendMessage(page: Page, question: string): Promise<void> {
    try {
      await page.locator('#input-message').fill(question);
      await Modul.waitTime(1);
      await page.locator('#button-send').click();
    } catch (error) {
      console.error('Error sending message:', error);
    }
  }

  static async waitReply(page: Page, question: string, timeout: number = 120000): Promise<void> {
    const startTime = Date.now();
    
    while (Date.now() - startTime < timeout) {
      try {
        const lastMessage = page.locator('.message-content-wrapper').last();
        const content = await lastMessage.locator('.content').textContent();
        
        if (content && content.trim().toLowerCase() !== question.trim().toLowerCase() && content.trim() !== '') {
          return;
        }
      } catch {}
      
      await Modul.waitTime(0.5);
    }
  }

  static async getReplyChat(page: Page, question: string): Promise<string[]> {
    const replies: string[] = [];
    
    try {
      const messages = await page.locator('.message-content-wrapper').all();
      
      for (let i = messages.length - 1; i >= 0; i--) {
        try {
          const content = await messages[i].locator('.content').textContent();
          if (content && content.trim().toLowerCase() === question.trim().toLowerCase()) {
            // Found our question, get replies after it
            for (let j = i + 1; j < messages.length; j++) {
              const messageContents = await messages[j].locator('.message-content').all();
              for (const msgContent of messageContents) {
                const text = await msgContent.textContent();
                if (text && text.trim()) {
                  replies.push(text.trim());
                }
              }
            }
            break;
          }
        } catch {}
      }
    } catch (error) {
      console.error('Error getting reply:', error);
    }

    return replies;
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

          await this.sendMessage(page, question);
          await this.waitReply(page, question);

          if (count % 5 === 0) {
            await Modul.waitTime(2);
            await page.reload();
          }

          const imageCapture = await this.takeScreenshot(page, idTest, key, question);
          const respondBotArray = await this.getReplyChat(page, question);
          let respondBot = respondBotArray.join('\n').trim();

          const titleLoading = `${key} : ${question}`;
          Modul.showLoadingSampleText(titleLoading);

          const respondCsv = (element.context || '').trim();
          const endDurationPerSampleText = Modul.endTime(durationPerQuestion);

          // Simplified LLM scoring (placeholder)
          const skor = 80; // Placeholder
          const explanation = 'Auto-evaluated';
          const AI = 'Playwright TypeScript';

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
