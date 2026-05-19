import { Page } from 'playwright';
import { Modul } from '../utils/modul';
import { EnvFile } from '../utils/envfile';
import { EvaluatorFactory } from '../utils/ai-evaluator';
import { TestData, BotData, SummaryData } from '../main';
import { TestTracker } from '../utils/test-tracker';
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
          } catch { }
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
        } catch { }
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
      } catch { }
      return false;
    }
  }

  async getAllBotResponses(username: string, userMessage: string, afterTimestamp: number): Promise<string> {
    if (!this.page) {
      console.error('Instagram page not initialized');
      return 'Error: Page not initialized';
    }

    // Wait for messages to stabilize - Instagram may send multiple bubbles
    console.log(`⏳ Waiting for all message bubbles to load...`);

    let previousResponseCount = 0;
    let stableCount = 0;
    const maxAttempts = 5;
    let finalResponse = '';

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      // Wait between checks
      const waitTime = attempt === 1 ? 5 : 3; // First wait 5s, then 3s each
      await Modul.waitTime(waitTime);

      console.log(`🔍 Checking for responses (attempt ${attempt}/${maxAttempts})...`);

      const response = await this.extractBotResponse(username, userMessage, afterTimestamp);

      // Count number of response bubbles (split by newline)
      const currentResponseCount = response && response !== 'No response captured'
        ? response.split('\n').filter(r => r.trim()).length
        : 0;

      console.log(`📊 Found ${currentResponseCount} response bubble(s)`);

      if (currentResponseCount > 0) {
        finalResponse = response;

        // Check if response count is stable (no new bubbles)
        if (currentResponseCount === previousResponseCount) {
          stableCount++;
          console.log(`✅ Response stable (${stableCount}/2 checks)`);

          // If stable for 2 consecutive checks, we're done
          if (stableCount >= 2) {
            console.log(`✅ All ${currentResponseCount} bubble(s) captured!`);
            return finalResponse;
          }
        } else {
          // Response count changed, reset stable counter
          stableCount = 0;
          console.log(`🔄 New bubble detected, continuing to wait...`);
        }

        previousResponseCount = currentResponseCount;
      } else {
        // No response yet
        if (attempt < maxAttempts) {
          console.log(`⏳ No response yet, waiting...`);
        }
      }
    }

    // Return whatever we got
    if (finalResponse && finalResponse !== 'No response captured') {
      console.log(`⚠️ Timeout reached, returning ${previousResponseCount} bubble(s)`);
      return finalResponse;
    }

    return 'No response captured';
  }

  private async extractBotResponse(username: string, userMessage: string, afterTimestamp: number): Promise<string> {
    if (!this.page) {
      return 'Error: Page not initialized';
    }

    try {
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
        } catch { }
      }

      console.log(`📊 Total messages: ${messages.length}`);

      if (messages.length === 0) {
        console.log('⚠️ No messages found');
        return 'No response captured';
      }

      // Find ALL occurrences of the question
      const questionIndices: number[] = [];
      for (let i = 0; i < messages.length; i++) {
        try {
          const text = await messages[i].textContent();
          if (text && (text.trim() === userMessage.trim() || text.includes(userMessage.substring(0, 20)))) {
            questionIndices.push(i);
          }
        } catch { }
      }

      if (questionIndices.length === 0) {
        console.log('⚠️ Question not found in messages');
        console.log(`💡 Looking for: "${userMessage}"`);

        // Fallback: return last 3 messages
        const recentMessages: string[] = [];
        for (let i = Math.max(0, messages.length - 3); i < messages.length; i++) {
          try {
            const text = await messages[i].textContent();
            if (text && text.trim() && text.trim() !== userMessage.trim()) {
              recentMessages.push(text.trim());
            }
          } catch { }
        }

        if (recentMessages.length > 0) {
          console.log(`📊 Using ${recentMessages.length} recent messages as fallback`);
          return recentMessages.join('\n');
        }

        return 'No response captured';
      }

      // Use the LAST occurrence (most recent)
      const questionIndex = questionIndices[questionIndices.length - 1];
      console.log(`✅ Found ${questionIndices.length} occurrence(s) of question`);
      console.log(`✅ Using LAST occurrence at index ${questionIndex}`);

      // Collect bot responses after the question
      const botResponses: string[] = [];
      const startIndex = questionIndex + 1;

      console.log(`📝 Capturing bot responses from index ${startIndex}...`);

      // Identify next user message to know where to stop
      const userMessageIndices: number[] = [questionIndex];
      for (let i = questionIndex + 1; i < messages.length; i++) {
        try {
          const text = await messages[i].textContent();
          if (text) {
            const cleanText = text.trim();
            // Detect user questions
            if (cleanText.toLowerCase().startsWith('apa itu ') ||
              cleanText.toLowerCase().startsWith('apa yang ') ||
              cleanText.toLowerCase().startsWith('bagaimana ') ||
              cleanText.toLowerCase().startsWith('mengapa ') ||
              cleanText.toLowerCase().startsWith('siapa ') ||
              cleanText.toLowerCase().startsWith('kapan ') ||
              cleanText.toLowerCase().startsWith('dimana ') ||
              cleanText.toLowerCase().startsWith('berapa ')) {
              userMessageIndices.push(i);
              console.log(`🔍 Detected user question at index ${i}`);
            }
          }
        } catch { }
      }

      // Find next user message after current question
      let nextUserMessageIndex = messages.length;
      for (const idx of userMessageIndices) {
        if (idx > questionIndex) {
          nextUserMessageIndex = idx;
          console.log(`🛑 Next user message at index ${idx}, stopping there`);
          break;
        }
      }

      // UI noise to filter - ONLY match exact short phrases, not words within sentences
      const uiNoisePatterns = [
        /^You sent$/i,
        /^Enter$/i,
        /^Message$/i,
        /^Send$/i,
        /^Sent$/i,
        /^Delivered$/i,
        /^Seen$/i,
        /^Active \d+[mh] ago$/i,
        /^Active now$/i,
        /^@\w+$/,  // Just username
        /^[0-9]+$/,  // Just numbers
        /^Press Enter to send$/i,
      ];

      for (let i = startIndex; i < nextUserMessageIndex; i++) {
        try {
          const text = await messages[i].textContent();
          if (!text || !text.trim()) continue;

          let cleanText = text.trim();

          // Skip if it's the user's message
          if (cleanText === userMessage.trim()) {
            console.log(`  ⏭️ Skipping user message at ${i}`);
            continue;
          }

          // Check if ENTIRE text is just UI noise (skip only if exact match)
          const isExactNoise = uiNoisePatterns.some(pattern => pattern.test(cleanText));
          if (isExactNoise) {
            console.log(`  ⏭️ Skipping UI noise at ${i}: "${cleanText}"`);
            continue;
          }

          // Clean/hide noise words from within the text (but keep the rest)
          cleanText = cleanText
            .replace(/ahmadnurbrasta2\.2/gi, '')  // Remove username
            .replace(/Enter/gi, '')  // Remove "Enter" (with or without word boundary)
            .replace(/Sent/gi, '')  // Remove "Sent"
            .replace(/Delivered/gi, '')  // Remove "Delivered"
            .replace(/Seen/gi, '')  // Remove "Seen"
            .replace(/You sent/gi, '')  // Remove "You sent"
            .replace(/respond/gi, '')  // Remove "respond"
            .replace(/\s+/g, ' ')  // Normalize spaces
            .trim();

          // Skip if cleaning removed everything
          if (!cleanText || cleanText.length < 2) {
            console.log(`  ⏭️ Skipping empty after cleaning at ${i}`);
            continue;
          }

          // Skip if this is a duplicate of the last message
          if (botResponses.length > 0 && botResponses[botResponses.length - 1] === cleanText) {
            console.log(`  ⏭️ Skipping duplicate at ${i}: "${cleanText.substring(0, 40)}..."`);
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
        return 'No response captured';
      }

      console.log(`📊 Captured ${botResponses.length} bot responses (after deduplication)`);
      return botResponses.join('\n');
    } catch (error) {
      console.error('Error extracting bot response:', error);
      return 'Error: Gagal mengambil pesan';
    }
  }

  async takeScreenshot(idTest: string, key: string, question: string, screenshotsFolder: string): Promise<string> {
    if (!this.page) {
      return '';
    }

    const screenshotDir = screenshotsFolder || 'report/screenshoot';
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
    return score >= 0.7 ? 'pass' : 'failed';
  }

  async actions(
    targetUsername: string,
    greeting: string,
    greeting2: string,
    jsonData: TestData[],
    reportFilename: string,
    idTest: string,
    timeStart: string,
    today: string,
    testerName: string,
    screenshotsFolder: string,
    testTracker: TestTracker
  ): Promise<void> {
    const start = Modul.startTime();
    
    Modul.showLoading(`Mengirim sapaan awal ke @${targetUsername}...`);
    const greetingTimestamp = Date.now();
    await this.sendMessage(targetUsername, greeting);
    await Modul.waitTime(10);

    if (greeting2 && greeting2.trim() !== '') {
      Modul.showLoading(`Mengirim sapaan kedua ke @${targetUsername}...`);
      await this.sendMessage(targetUsername, greeting2);
      await Modul.waitTime(10);
    }
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
            respondBot = 'No response captured';
          }

          // Take screenshot
          const imageCapture = await this.takeScreenshot(idTest, key, question, screenshotsFolder);
          console.log(`📸 Screenshot saved: ${imageCapture}`);

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
            url: `Instagram DM (@${targetUsername})`,
            page_name: 'Instagram Test',
            browser_name: 'Playwright',
            date_test: today,
            start_time_test: timeStart,
            total_title: countPerElementTitle,
            total_question: questionCount,
            success: trackerSummary.passed,
            failed: trackerSummary.failed
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
    
    // Write end time and total duration
    const endTime = new Date().toTimeString().split(' ')[0];
    const totalDuration = Modul.endTime(start);
    EnvFile.writeEndTimeSummary(endTime, totalDuration, reportFilename, idTest);
    
    console.log(`✅ Test completed at: ${endTime}`);
    console.log(`⏱️ Total test duration: ${totalDuration}`);
  }
}
