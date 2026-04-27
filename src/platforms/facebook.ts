import { Page } from 'playwright';
import { Modul } from '../utils/modul';
import { EnvFile } from '../utils/envfile';
import { EvaluatorFactory } from '../utils/ai-evaluator';
import { TestData, BotData, SummaryData } from '../main';
import { TestTracker } from '../utils/test-tracker';
import * as fs from 'fs';
import * as path from 'path';

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

  async getChatbotResponse(userMessage: string): Promise<string> {
    if (!this.page) {
      console.error('Facebook page not initialized');
      return 'Error: Page not initialized';
    }

    // Wait for messages to stabilize - Facebook may send multiple bubbles
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

      const response = await this.extractBotResponse(userMessage);

      // Count number of response bubbles (split by newline)
      const currentResponseCount = response && response !== 'Tidak ada balasan dari bot'
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
    if (finalResponse && finalResponse !== 'Tidak ada balasan dari bot') {
      console.log(`⚠️ Timeout reached, returning ${previousResponseCount} bubble(s)`);
      return finalResponse;
    }

    return 'Tidak ada balasan dari bot';
  }

  private async extractBotResponse(userMessage: string): Promise<string> {
    if (!this.page) {
      return 'Error: Page not initialized';
    }

    // Get ALL messages including user and bot
    // Try to get message containers first
    const containerSelectors = [
      'div[role="row"]',
      'div[data-scope="messages_table"]'
    ];

    let messageContainers: any[] = [];

    for (const selector of containerSelectors) {
      try {
        const containers = await this.page.locator(selector).all();
        if (containers.length > 0) {
          messageContainers = containers;
          console.log(`📊 Found ${containers.length} message containers`);
          break;
        }
      } catch { }
    }

    // If containers found, extract text from each
    let allMessages: any[] = [];

    if (messageContainers.length > 0) {
      // Extract text from containers
      for (const container of messageContainers) {
        try {
          const textElements = await container.locator('div[dir="auto"], span[dir="auto"]').all();
          for (const elem of textElements) {
            allMessages.push(elem);
          }
        } catch { }
      }
      console.log(`📊 Extracted ${allMessages.length} text elements from containers`);
    } else {
      // Fallback: try direct text selectors
      const textSelectors = [
        "//div[contains(@class,'html-div') and contains(@class,'x18lvrbx')]",
        "div[dir='auto']",
        "span[dir='auto']"
      ];

      for (const selector of textSelectors) {
        try {
          const messages = selector.startsWith('//')
            ? await this.page.locator(selector).all()
            : await this.page.locator(selector).all();

          if (messages.length > 0) {
            allMessages = messages;
            console.log(`📊 Found ${messages.length} messages with selector: ${selector.substring(0, 50)}`);
            break;
          }
        } catch { }
      }
    }

    if (allMessages.length === 0) {
      console.log('⚠️ No messages found with any selector');
      return 'Tidak ada balasan dari bot';
    }

    // Extract message texts and show first few for debugging
    const messageTexts: string[] = [];
    for (let i = 0; i < allMessages.length; i++) {
      const text = await allMessages[i].textContent();
      if (text && text.trim()) {
        messageTexts.push(text.trim());
        if (i < 5) {
          console.log(`  [${i}] "${text.trim().substring(0, 50)}..."`);
        }
      }
    }

    console.log(`📋 Total message texts: ${messageTexts.length}`);

    // Find ALL occurrences of the question
    const questionIndices: number[] = [];
    for (let i = 0; i < messageTexts.length; i++) {
      if (messageTexts[i].toLowerCase().includes(userMessage.toLowerCase())) {
        questionIndices.push(i);
      }
    }

    if (questionIndices.length === 0) {
      console.log('⚠️ Question not found');
      console.log(`💡 Looking for: "${userMessage}"`);
      console.log(`💡 Available messages: ${messageTexts.length}`);

      // Show all messages for debugging
      messageTexts.forEach((msg, idx) => {
        console.log(`  [${idx}] "${msg.substring(0, 60)}..."`);
      });

      // Fallback: return last 5 messages
      const recentMessages = messageTexts.slice(-5).filter(msg =>
        !msg.toLowerCase().includes(userMessage.toLowerCase())
      );

      if (recentMessages.length > 0) {
        console.log(`📊 Using ${recentMessages.length} recent messages as fallback`);
        return recentMessages.join('\n');
      }

      return 'Tidak ada balasan dari bot';
    }

    // Use the LAST occurrence (most recent)
    const questionIndex = questionIndices[questionIndices.length - 1];
    console.log(`✅ Found ${questionIndices.length} occurrence(s) of question`);
    console.log(`✅ Using LAST occurrence at index ${questionIndex}: "${messageTexts[questionIndex].substring(0, 50)}..."`)

    // Collect bot responses after question until next user message
    const botResponses: string[] = [];

    console.log(`📝 Capturing from index ${questionIndex + 1}...`);

    // Identify user messages more carefully
    // User messages typically start with "Apa" based on test data
    const userMessageIndices: number[] = [questionIndex]; // Start with current question

    for (let i = questionIndex + 1; i < messageTexts.length; i++) {
      const text = messageTexts[i];
      // Only mark as user message if it clearly starts with question pattern
      // Be more conservative to avoid cutting off bot responses
      if (text.toLowerCase().startsWith('apa itu ') ||
        text.toLowerCase().startsWith('apa yang ') ||
        text.toLowerCase().startsWith('bagaimana ') ||
        text.toLowerCase().startsWith('mengapa ') ||
        text.toLowerCase().startsWith('siapa ') ||
        text.toLowerCase().startsWith('kapan ') ||
        text.toLowerCase().startsWith('dimana ') ||
        text.toLowerCase().startsWith('berapa ')) {
        userMessageIndices.push(i);
        console.log(`🔍 Detected user question at index ${i}: "${text.substring(0, 40)}..."`);
      }
    }

    console.log(`📋 Found ${userMessageIndices.length} user messages`);

    // Find next user message after current question
    let nextUserMessageIndex = messageTexts.length; // Default to end
    for (const idx of userMessageIndices) {
      if (idx > questionIndex) {
        nextUserMessageIndex = idx;
        console.log(`🛑 Next user message at index ${idx}, stopping there`);
        break;
      }
    }

    // UI noise patterns to filter out
    const uiNoisePatterns = [
      /^Enter$/i,
      /^Send$/i,
      /^Message$/i,
      /^You sent$/i,
      /^Sent$/i,
      /^Delivered$/i,
      /^Seen$/i,
      /^Active now$/i,
      /^Active \d+[mh] ago$/i,
      /^[0-9]+$/,  // Just numbers
      /^Press Enter to send$/i,
    ];

    // Collect ALL bot responses between current question and next user message
    for (let i = questionIndex + 1; i < nextUserMessageIndex; i++) {
      let text = messageTexts[i];

      // Skip empty or very short noise
      if (!text || text.length < 2) {
        console.log(`  ⏭️ Skipping empty/short at ${i}`);
        continue;
      }

      // Check if ENTIRE text is just UI noise (skip only if exact match)
      const isExactNoise = uiNoisePatterns.some(pattern => pattern.test(text));
      if (isExactNoise) {
        console.log(`  ⏭️ Skipping UI noise at ${i}: "${text}"`);
        continue;
      }

      // Clean up text - remove "Enter" prefix/suffix if attached to actual content
      text = text.replace(/^Enter\s+/i, '').replace(/\s+Enter$/i, '').trim();

      // Skip if cleaning removed everything
      if (!text || text.length < 2) {
        console.log(`  ⏭️ Skipping empty after cleaning at ${i}`);
        continue;
      }

      // Skip if this is a duplicate of the last message (Facebook DOM duplicates)
      if (botResponses.length > 0 && botResponses[botResponses.length - 1] === text) {
        console.log(`  ⏭️ Skipping duplicate at ${i}: "${text.substring(0, 40)}..."`);
        continue;
      }

      botResponses.push(text);
      console.log(`  ✅ Bot message ${botResponses.length}: "${text.substring(0, 80)}..."`);
    }

    if (botResponses.length === 0) {
      console.log('⚠️ No bot responses after question');
      return 'Tidak ada balasan dari bot';
    }

    console.log(`📊 Captured ${botResponses.length} bot responses (after deduplication)`);
    return botResponses.join('\n');
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

    await this.page.screenshot({ path: filepath, fullPage: true });
    return filename;
  }

  static calculateStatus(score: number): string {
    return score >= 0.7 ? 'pass' : 'failed';
  }

  async actions(
    targetFanpageId: string,
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
    
    await this.navigateToChatbot(targetFanpageId);

    // Send greetings
    if (greeting && greeting.trim() !== '') {
      console.log(`📤 Sending greeting 1: "${greeting}"`);
      await this.sendMessage(greeting);
      await Modul.waitTime(5);
    }

    if (greeting2 && greeting2.trim() !== '') {
      console.log(`📤 Sending greeting 2: "${greeting2}"`);
      await this.sendMessage(greeting2);
      await Modul.waitTime(5);
    }

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
            respondBot = await this.getChatbotResponse(question);
          } else {
            respondBot = 'Error: Gagal mengirim pesan ke chatbot.';
          }

          const imageCapture = await this.takeScreenshot(idTest, key, question, screenshotsFolder);

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
