import { TelegramClient } from 'telegram';
import { StringSession } from 'telegram/sessions';
import { Modul } from '../utils/modul';
import { EnvFile } from '../utils/envfile';
import { GeminiEvaluator } from '../utils/gemini-evaluator';
import { ResponseCapture } from '../utils/response-capture';
import { TestData, BotData, SummaryData } from '../types';

export class TelegramPlatform {
  private client: TelegramClient | null = null;

  async initialize(apiId: string, apiHash: string, sessionString: string): Promise<void> {
    const stringSession = new StringSession(sessionString);
    this.client = new TelegramClient(stringSession, parseInt(apiId), apiHash, {
      connectionRetries: 5,
    });

    await this.client.connect();
    console.log('Telegram client connected');
  }

  async sendMessage(botUsername: string, text: string): Promise<boolean> {
    if (!this.client) {
      console.error('Telegram client not initialized');
      return false;
    }

    try {
      await this.client.sendMessage(botUsername, { message: text });
      console.log(`Pesan terkirim ke '${botUsername}': ${text}`);
      return true;
    } catch (error) {
      console.error(`Error saat mengirim pesan ke '${botUsername}':`, error);
      return false;
    }
  }

  async getLatestMessage(botUsername: string): Promise<string> {
    if (!this.client) {
      console.error('Telegram client not initialized');
      return 'Error: Client not initialized';
    }

    try {
      const messages = await this.client.getMessages(botUsername, { limit: 1 });
      if (messages && messages.length > 0) {
        const latestMessage = messages[0];
        console.log(`Pesan diterima dari '${botUsername}': ${latestMessage.text}`);
        return latestMessage.text || 'Tidak ada pesan ditemukan.';
      }
      return 'Tidak ada pesan ditemukan.';
    } catch (error) {
      console.error(`Error saat mengambil pesan dari '${botUsername}':`, error);
      return 'Error: Gagal mengambil pesan';
    }
  }

  async getAllBotResponses(botUsername: string, userMessage: string, maxWaitSeconds: number = 15): Promise<string> {
    if (!this.client) {
      console.error('Telegram client not initialized');
      return 'Error: Client not initialized';
    }

    try {
      console.log(`🔍 Capturing bot responses for: "${userMessage.substring(0, 50)}..."`);
      
      // Get initial message count to know when new messages arrive
      const initialMessages = await this.client.getMessages(botUsername, { limit: 5 });
      const initialCount = initialMessages.length;
      
      console.log(`⏳ Waiting for bot reply (max ${maxWaitSeconds}s)...`);
      
      // Poll for new incoming messages
      let botResponses: string[] = [];
      let attempts = 0;
      const maxAttempts = Math.ceil(maxWaitSeconds / 2); // Check every 2 seconds to avoid flood wait
      
      while (attempts < maxAttempts) {
        await Modul.waitTime(2);
        attempts++;
        
        // Get recent messages
        const messages = await this.client.getMessages(botUsername, { limit: 30 });
        
        // Find the user's question message (should be outgoing)
        let questionIndex = -1;
        for (let i = 0; i < messages.length; i++) {
          const msg = messages[i];
          if (msg.out && msg.text && msg.text.includes(userMessage)) {
            questionIndex = i;
            break;
          }
        }
        
        if (questionIndex === -1) {
          continue; // Question not found yet, keep waiting
        }
        
        // Collect all bot responses BEFORE the question in the array (which means AFTER in time)
        // Since messages are in reverse chronological order (newest first at index 0)
        // We need to collect from index 0 to questionIndex-1
        const currentBotResponses: string[] = [];
        for (let i = 0; i < questionIndex; i++) {
          const msg = messages[i];
          // Only collect incoming messages (from bot)
          if (!msg.out && msg.text) {
            currentBotResponses.push(msg.text);
          }
        }
        
        // Check if we got new responses
        if (currentBotResponses.length > 0) {
          const previousCount = botResponses.length;
          botResponses = currentBotResponses;
          
          // Check if response is stable (same count for 2 consecutive checks)
          if (previousCount === botResponses.length && previousCount > 0) {
            // Wait one more cycle to ensure stability
            if (attempts > 1) {
              console.log(`✅ Found stable response with ${botResponses.length} messages`);
              break;
            }
          }
          
          console.log(`📨 Received ${botResponses.length} bot messages (attempt ${attempts}/${maxAttempts}), waiting for more...`);
        }
      }
      
      if (botResponses.length === 0) {
        console.log(`⚠️ Timeout (${maxWaitSeconds}s) - no bot responses found`);
        
        // Fallback: get latest incoming messages
        const messages = await this.client.getMessages(botUsername, { limit: 30 });
        console.log(`📨 Retrieved ${messages.length} messages from chat (fallback)`);
        
        // Debug: show first few messages
        for (let i = 0; i < Math.min(5, messages.length); i++) {
          const msg = messages[i];
          const preview = msg.text ? msg.text.substring(0, 50) : '[no text]';
          const isOutgoing = msg.out ? '(sent by me)' : '(received)';
          console.log(`  [${i}] ${isOutgoing}: ${preview}...`);
        }
        
        // Get all recent incoming (bot) messages
        const recentBotMessages: string[] = [];
        for (let i = 0; i < Math.min(10, messages.length); i++) {
          const msg = messages[i];
          if (!msg.out && msg.text) {
            recentBotMessages.push(msg.text);
          }
        }
        
        if (recentBotMessages.length > 0) {
          botResponses = recentBotMessages;
          console.log(`📋 Using ${botResponses.length} recent bot messages as fallback`);
        } else {
          return 'Tidak ada balasan dari bot.';
        }
      }
      
      console.log(`📋 Total responses captured: ${botResponses.length}`);
      
      // Show captured messages (from API - newest first)
      console.log('📨 Messages from API (newest first):');
      for (let i = 0; i < botResponses.length; i++) {
        console.log(`  [${i}] "${botResponses[i].substring(0, 50)}..."`);
      }
      
      // Reverse to get chronological order (oldest to newest) for report
      botResponses.reverse();
      
      // Show final order
      console.log('📨 Final order for report (oldest to newest):');
      for (let i = 0; i < botResponses.length; i++) {
        console.log(`  ✅ Bot message ${i + 1}: "${botResponses[i].substring(0, 50)}..."`);
      }
      
      // Join all responses with newline
      const fullResponse = botResponses.join('\n');
      console.log(`📝 Final response (${fullResponse.length} chars): "${fullResponse.substring(0, 150)}..."`);
      
      return fullResponse;
    } catch (error) {
      console.error(`Error saat mengambil pesan dari '${botUsername}':`, error);
      return 'Error: Gagal mengambil pesan';
    }
  }

  static calculateStatus(score: number): string {
    return score >= 0.7 ? 'PASS' : 'FAILED';
  }

  async actions(
    targetBotUsername: string,
    greeting: string,
    jsonData: TestData[],
    reportFilename: string,
    idTest: string,
    timeStart: string,
    today: string,
    testerName: string
  , screenshotsFolder?: string
  ): Promise<void> {
    // Send /start command first to activate bot
    console.log(`🤖 Activating bot with /start command...`);
    await this.sendMessage(targetBotUsername, '/start');
    await Modul.waitTime(3);
    
    Modul.showLoading(`Mengirim sapaan awal ke ${targetBotUsername}...`);
    await this.sendMessage(targetBotUsername, greeting);
    await Modul.waitTime(5);
    console.log();

    const title = `当 Membaca pertanyaan dan mengirim ke ${targetBotUsername}`;
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

          await this.sendMessage(targetBotUsername, question);

          // Capture all bot responses with built-in polling
          let respondBot = await this.getAllBotResponses(targetBotUsername, question, 15);
          if (!respondBot) {
            respondBot = 'Error: Tidak ada balasan dari bot setelah menunggu.';
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
          const AI = evaluationResult.success ? 'Gemini AI + Telegram Client' : 'Telegram Client (Gemini fallback)';

          const status = TelegramPlatform.calculateStatus(skor);

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
            url: `Telegram Bot (${targetBotUsername})`,
            page_name: 'Telegram Test',
            browser_name: 'Telegram Client',
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

  async disconnect(): Promise<void> {
    if (this.client) {
      await this.client.disconnect();
      console.log('Telegram client disconnected');
    }
  }
}
