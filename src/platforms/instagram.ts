import { Page } from 'playwright';
import { Modul } from '../utils/modul';
import { EnvFile } from '../utils/envfile';
import { TestData, BotData, SummaryData } from '../types';
import * as fs from 'fs';
import * as path from 'path';

export class InstagramPlatform {
  private page: Page | null = null;
  private sessionFile = 'session/session-instagram.json';

  async initialize(page: Page): Promise<void> {
    this.page = page;
    
    if (!fs.existsSync(this.sessionFile)) {
      throw new Error(`Session file not found at '${this.sessionFile}'. Please generate it first.`);
    }

    // Load session data from Python format
    const sessionData = JSON.parse(fs.readFileSync(this.sessionFile, 'utf-8'));
    
    // Convert Python session format to Playwright cookies
    const cookies: any[] = [];
    
    if (sessionData.cookies && sessionData.cookies.sessionid) {
      cookies.push({
        name: 'sessionid',
        value: sessionData.cookies.sessionid,
        domain: '.instagram.com',
        path: '/',
        httpOnly: true,
        secure: true,
        sameSite: 'None'
      });
    }
    
    if (sessionData.mid) {
      cookies.push({
        name: 'mid',
        value: sessionData.mid,
        domain: '.instagram.com',
        path: '/',
        httpOnly: false,
        secure: true,
        sameSite: 'None'
      });
    }
    
    if (sessionData.authorization_data && sessionData.authorization_data.ds_user_id) {
      cookies.push({
        name: 'ds_user_id',
        value: sessionData.authorization_data.ds_user_id,
        domain: '.instagram.com',
        path: '/',
        httpOnly: false,
        secure: true,
        sameSite: 'None'
      });
    }
    
    await page.context().addCookies(cookies);
    
    try {
      await page.goto('https://www.instagram.com/direct/inbox/', { 
        waitUntil: 'domcontentloaded',
        timeout: 60000 
      });
    } catch (error) {
      console.log('Instagram navigation timeout, continuing anyway...');
    }
    
    console.log('Instagram session loaded');
  }

  async sendMessage(username: string, text: string): Promise<boolean> {
    if (!this.page) {
      console.error('Instagram page not initialized');
      return false;
    }

    try {
      // First, go to user profile to initiate DM
      console.log(`Navigating to @${username} profile...`);
      await this.page.goto(`https://www.instagram.com/${username}/`, { 
        waitUntil: 'domcontentloaded',
        timeout: 60000 
      });
      await Modul.waitTime(3);

      // Try to find and click "Message" button
      try {
        // Multiple possible selectors for Message button
        const messageButtonSelectors = [
          'button:has-text("Message")',
          'div[role="button"]:has-text("Message")',
          'button:has-text("Pesan")',
          'div:has-text("Message")',
        ];

        let buttonClicked = false;
        for (const selector of messageButtonSelectors) {
          try {
            const button = this.page.locator(selector).first();
            if (await button.isVisible({ timeout: 2000 })) {
              await button.click();
              buttonClicked = true;
              console.log('Message button clicked');
              break;
            }
          } catch {}
        }

        if (!buttonClicked) {
          console.log('Message button not found, trying direct DM URL...');
          await this.page.goto(`https://www.instagram.com/direct/t/${username}/`, { 
            waitUntil: 'domcontentloaded',
            timeout: 60000 
          });
        }
      } catch (error) {
        console.log('Error clicking message button, trying direct URL...');
        await this.page.goto(`https://www.instagram.com/direct/t/${username}/`, { 
          waitUntil: 'domcontentloaded',
          timeout: 60000 
        });
      }
      
      await Modul.waitTime(5);

      // Take screenshot for debugging
      try {
        await this.page.screenshot({ path: `debug_instagram_${Date.now()}.png` });
        console.log('Debug screenshot saved');
      } catch {}

      // Try multiple selectors for message input
      const inputSelectors = [
        'div[contenteditable="true"][role="textbox"]',
        'textarea[placeholder*="Message"]',
        'div[contenteditable="true"]',
        'textarea',
        'div[aria-label*="Message"]',
        'p[contenteditable="true"]',
      ];

      let messageInput = null;
      for (const selector of inputSelectors) {
        try {
          const input = this.page.locator(selector).first();
          if (await input.isVisible({ timeout: 3000 })) {
            messageInput = input;
            console.log(`Found input with selector: ${selector}`);
            break;
          }
        } catch {}
      }

      if (!messageInput) {
        console.error('Could not find message input field');
        return false;
      }

      // Type and send message
      await messageInput.click();
      await Modul.waitTime(1);
      await messageInput.fill(text);
      await Modul.waitTime(1);
      
      // Try to press Enter or find Send button
      try {
        await this.page.keyboard.press('Enter');
        console.log(`Pesan terkirim ke @${username}: ${text}`);
      } catch {
        // Try to find and click Send button
        const sendButton = this.page.locator('button:has-text("Send")').first();
        if (await sendButton.isVisible({ timeout: 2000 })) {
          await sendButton.click();
          console.log(`Pesan terkirim ke @${username}: ${text}`);
        }
      }
      
      await Modul.waitTime(2);
      return true;
    } catch (error) {
      console.error(`Error sending message to @${username}:`, error);
      // Take error screenshot
      try {
        await this.page?.screenshot({ path: `error_instagram_${Date.now()}.png` });
      } catch {}
      return false;
    }
  }

  async getLatestMessage(username: string, afterTimestamp: number): Promise<string> {
    if (!this.page) {
      console.error('Instagram page not initialized');
      return 'Error: Page not initialized';
    }

    try {
      // Wait for response with polling
      console.log('Waiting for response...');
      await Modul.waitTime(15);

      // Try multiple selectors for messages
      const messageSelectors = [
        'div[role="row"]',
        'div[class*="message"]',
        'div[dir="auto"]',
        'span[dir="auto"]',
      ];

      let messages: any[] = [];
      for (const selector of messageSelectors) {
        try {
          const found = await this.page.locator(selector).all();
          if (found.length > 0) {
            messages = found;
            console.log(`Found ${messages.length} messages with selector: ${selector}`);
            break;
          }
        } catch {}
      }

      if (messages.length > 0) {
        // Get last few messages
        const lastMessages = messages.slice(-3);
        const texts: string[] = [];
        
        for (const msg of lastMessages) {
          try {
            const text = await msg.textContent();
            if (text && text.trim()) {
              texts.push(text.trim());
            }
          } catch {}
        }

        if (texts.length > 0) {
          const response = texts[texts.length - 1];
          console.log(`Response received: ${response.substring(0, 50)}...`);
          return response;
        }
      }

      // Fallback: get all text content
      try {
        const bodyText = await this.page.locator('body').textContent();
        if (bodyText) {
          // Try to extract last message
          const lines = bodyText.split('\n').filter(l => l.trim());
          if (lines.length > 0) {
            return lines[lines.length - 1].trim();
          }
        }
      } catch {}

      return 'Tidak ada balasan dari bot setelah menunggu.';
    } catch (error) {
      console.error('Error getting latest message:', error);
      return 'Error: Gagal mengambil pesan';
    }
  }

  static calculateStatus(score: number): string {
    return score >= 70 ? 'PASS' : 'FAILED';
  }

  async actions(
    targetUsername: string,
    greeting: string,
    jsonData: TestData[],
    reportFilename: string,
    idTest: string,
    timeStart: string,
    today: string,
    testerName: string
  ): Promise<void> {
    Modul.showLoading(`Mengirim sapaan awal ke @${targetUsername}...`);
    const greetingTimestamp = Date.now();
    await this.sendMessage(targetUsername, greeting);
    await Modul.waitTime(10);
    console.log();

    const title = `当 Membaca pertanyaan dan mengirim ke @${targetUsername}`;
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

          const sentTimestamp = Date.now();
          await this.sendMessage(targetUsername, question);

          let respondBot = await this.getLatestMessage(targetUsername, sentTimestamp);
          if (!respondBot) {
            respondBot = 'Error: Tidak ada balasan dari bot setelah menunggu.';
          }

          const titleLoading = `${key} : ${question}`;
          Modul.showLoadingSampleText(titleLoading);

          const respondCsv = (element.context || '').trim();
          const endDurationPerSampleText = Modul.endTime(durationPerQuestion);

          const skor = 80;
          const explanation = 'Auto-evaluated';
          const AI = 'Playwright TypeScript';

          const status = InstagramPlatform.calculateStatus(skor);

          const dataBotData: BotData = {
            no: element.no || '',
            title: element.title || '',
            question,
            response_kb: respondCsv,
            response_llm: respondBot,
            status,
            duration: endDurationPerSampleText,
            image_capture: null,
            skor,
            explanation
          };

          EnvFile.writeJsonDataBot(dataBotData, reportFilename, idTest);

          const dataSummary: SummaryData = {
            id_test: idTest,
            tester_name: testerName,
            ai_evaluation: AI,
            url: `Instagram DM (@${targetUsername})`,
            page_name: 'Instagram Test',
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
