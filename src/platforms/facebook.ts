import { Page } from 'playwright';
import { Modul } from '../utils/modul';
import { EnvFile } from '../utils/envfile';
import { GeminiEvaluator } from '../utils/gemini-evaluator';
import { ResponseCapture } from '../utils/response-capture';
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

  async getChatbotResponse(userMessage: string): Promise<string> {
    if (!this.page) {
      console.error('Facebook page not initialized');
      return 'Error: Page not initialized';
    }

    try {
      await Modul.waitTime(5);

      console.log(`🔍 Capturing bot responses for: "${userMessage}"`);

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
        } catch {}
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
          } catch {}
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
          } catch {}
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

      // Find question (search from end for most recent)
      let questionIndex = -1;
      for (let i = messageTexts.length - 1; i >= 0; i--) {
        if (messageTexts[i].toLowerCase().includes(userMessage.toLowerCase())) {
          questionIndex = i;
          console.log(`✅ Found question at index ${i}: "${messageTexts[i].substring(0, 50)}..."`);
          break;
        }
      }

      if (questionIndex < 0) {
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

      // Collect bot responses after question until next user message
      const botResponses: string[] = [];
      
      console.log(`📝 Capturing from index ${questionIndex + 1}...`);
      
      // First, identify all user messages (questions) to know where to stop
      const userMessageIndices: number[] = [];
      for (let i = 0; i < messageTexts.length; i++) {
        const text = messageTexts[i];
        // Heuristic: User messages are typically questions or short commands
        // In Facebook, user messages from test data usually start with "Apa"
        if (text.toLowerCase().startsWith('apa ') || 
            text.toLowerCase().includes('?') ||
            text.length < 50) { // Short messages might be user messages
          userMessageIndices.push(i);
        }
      }
      
      console.log(`📋 Detected ${userMessageIndices.length} potential user messages at indices: ${userMessageIndices.join(', ')}`);
      
      // Find next user message after current question
      let nextUserMessageIndex = messageTexts.length; // Default to end
      for (const idx of userMessageIndices) {
        if (idx > questionIndex) {
          nextUserMessageIndex = idx;
          console.log(`🛑 Next user message found at index ${idx}`);
          break;
        }
      }
      
      // Collect bot responses between current question and next user message
      for (let i = questionIndex + 1; i < nextUserMessageIndex; i++) {
        const text = messageTexts[i];
        botResponses.push(text);
        console.log(`  ✅ Bot message ${botResponses.length}: "${text.substring(0, 60)}..."`);
      }

      if (botResponses.length === 0) {
        console.log('⚠️ No bot responses after question');
        return 'Tidak ada balasan dari bot';
      }

      console.log(`📊 Captured ${botResponses.length} bot responses`);
      return botResponses.join('\n');
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
            respondBot = await this.getChatbotResponse(question);
          } else {
            respondBot = 'Error: Gagal mengirim pesan ke chatbot.';
          }

          const imageCapture = await this.takeScreenshot(idTest, key, question);

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
