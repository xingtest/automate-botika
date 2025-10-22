import { Page } from 'playwright';
import { Modul } from '../utils/modul';
import { EnvFile } from '../utils/envfile';
import { GeminiEvaluator } from '../utils/gemini-evaluator';
import { ResponseCapture } from '../utils/response-capture';
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

  async getAllBotResponses(username: string, userMessage: string, afterTimestamp: number): Promise<string> {
    if (!this.page) {
      console.error('Instagram page not initialized');
      return 'Error: Page not initialized';
    }

    try {
      console.log(`🔍 Capturing bot responses for: "${userMessage}"`);
      await Modul.waitTime(15);

      // Try multiple selectors for messages - prioritize more specific ones
      const messageSelectors = [
        'div[role="row"]',
        'div[class*="x1n2onr6"]', // Instagram message container
        'div[dir="auto"]',
      ];

      let messages: any[] = [];
      for (const selector of messageSelectors) {
        try {
          const found = await this.page.locator(selector).all();
          if (found.length > 0) {
            messages = found;
            console.log(`Found ${found.length} messages with selector: ${selector}`);
            break;
          }
        } catch {}
      }

      console.log(`📊 Total messages: ${messages.length}`);

      if (messages.length === 0) {
        console.log('⚠️ No messages found');
        return 'Tidak ada balasan dari bot.';
      }

      // Find user's question message (search from end)
      let questionIndex = -1;
      for (let i = messages.length - 1; i >= 0; i--) {
        try {
          const text = await messages[i].textContent();
          if (text && text.trim() === userMessage.trim()) {
            questionIndex = i;
            console.log(`✅ Found question at index ${i}: "${text}"`);
            break;
          }
        } catch {}
      }

      if (questionIndex < 0) {
        console.log('⚠️ Question not found in messages, trying partial match...');
        // Try partial match
        for (let i = messages.length - 1; i >= 0; i--) {
          try {
            const text = await messages[i].textContent();
            if (text && text.includes(userMessage.substring(0, 20))) {
              questionIndex = i;
              console.log(`✅ Found question (partial) at index ${i}`);
              break;
            }
          } catch {}
        }
      }

      // Collect bot responses after the question
      const botResponses: string[] = [];
      const startIndex = questionIndex >= 0 ? questionIndex + 1 : Math.max(0, messages.length - 3);
      
      console.log(`📝 Capturing bot responses from index ${startIndex}...`);
      
      // UI noise to filter (but keep actual bot responses)
      const uiNoisePatterns = [
        /^You sent$/i,
        /^Enter$/i,
        /^Message$/i,
        /^Send$/i,
        /^Active \d+[mh] ago$/i,
        /^Active now$/i,
        /^@\w+$/,
        /^[0-9]+$/,  // Just numbers
        /ahmadnurbrasta2\.2/i,  // Username noise
        /^Enter\s+@?\w+/i,  // "Enter username"
        /@?\w+respond/i,  // "usernamerespond"
        /@?\w+Enter/i,  // "usernameEnter"
      ];
      
      for (let i = startIndex; i < messages.length; i++) {
        try {
          const text = await messages[i].textContent();
          if (!text || !text.trim()) continue;
          
          let cleanText = text.trim();
          
          // Skip if it's the user's message
          if (cleanText === userMessage.trim()) {
            console.log(`  ⏭️ Skipping user message at ${i}`);
            continue;
          }
          
          // Skip UI noise patterns
          const isNoise = uiNoisePatterns.some(pattern => pattern.test(cleanText));
          if (isNoise) {
            console.log(`  ⏭️ Skipping UI noise at ${i}: "${cleanText}"`);
            continue;
          }
          
          // Clean up username artifacts from text
          cleanText = cleanText
            .replace(/ahmadnurbrasta2\.2/gi, '')
            .replace(/^Enter\s+/i, '')
            .replace(/respond$/i, '')
            .replace(/Enter$/i, '')
            .trim();
          
          // Skip if cleaning removed everything
          if (!cleanText || cleanText.length < 2) {
            console.log(`  ⏭️ Skipping empty after cleaning at ${i}`);
            continue;
          }
          
          // Accept messages with at least 2 characters (to catch "Hi", "Ok", etc)
          botResponses.push(cleanText);
          console.log(`  ✅ Bot message ${botResponses.length}: "${cleanText.substring(0, 80)}..."`);
        } catch (err) {
          console.log(`  ⚠️ Error reading message at ${i}`);
        }
      }

      if (botResponses.length === 0) {
        console.log('⚠️ No bot responses captured after filtering');
        
        // Last resort: try to get any text after question
        console.log('🔄 Trying fallback method...');
        try {
          const allText = await this.page.locator('div[dir="auto"]').allTextContents();
          console.log(`Found ${allText.length} text elements`);
          
          // Find question and get next elements
          const qIndex = allText.findIndex(t => t.trim() === userMessage.trim());
          if (qIndex >= 0 && qIndex < allText.length - 1) {
            for (let i = qIndex + 1; i < allText.length; i++) {
              const txt = allText[i].trim();
              if (txt && txt.length >= 2 && txt !== userMessage.trim()) {
                botResponses.push(txt);
                console.log(`  ✅ Fallback captured: "${txt}"`);
              }
            }
          }
        } catch {}
        
        if (botResponses.length === 0) {
          return 'Tidak ada balasan dari bot.';
        }
      }

      console.log(`📊 Total captured: ${botResponses.length} bot responses`);
      const result = botResponses.join('\n');
      console.log(`📝 Final result: "${result.substring(0, 100)}..."`);
      return result;
    } catch (error) {
      console.error('Error getting bot responses:', error);
      return 'Error: Gagal mengambil pesan';
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
    const filepath = path.join(screenshotDir, filename);

    try {
      await this.page.screenshot({ path: filepath, fullPage: false });
      return filename;
    } catch (error) {
      console.error('Error taking screenshot:', error);
      return '';
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

          let respondBot = await this.getAllBotResponses(targetUsername, question, sentTimestamp);
          if (!respondBot) {
            respondBot = 'Error: Tidak ada balasan dari bot setelah menunggu.';
          }

          // Take screenshot
          const imageCapture = await this.takeScreenshot(idTest, key, question);
          console.log(`📸 Screenshot saved: ${imageCapture}`);

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

          const status = InstagramPlatform.calculateStatus(skor);

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
