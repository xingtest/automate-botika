import { TelegramClient } from 'telegram';
import { StringSession } from 'telegram/sessions';
import * as fs from 'fs';
import * as path from 'path';
import * as readline from 'readline';
import { Modul } from '../utils/modul';
import { EnvFile } from '../utils/envfile';
import { EvaluatorFactory } from '../utils/ai-evaluator';
import { TestData, BotData, SummaryData } from '../main';
import { TestTracker } from '../utils/test-tracker';

export class TelegramPlatform {
  private client: TelegramClient | null = null;
  private sessionFile = 'session/session-telegram.json';

  private promptUser(query: string): Promise<string> {
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    });

    return new Promise<string>(resolve => {
      rl.question(query, (answer) => {
        rl.close();
        resolve(answer);
      });
    });
  }

  private async generateSession(apiId: string, apiHash: string): Promise<string | void> {
    console.log('\n🔐 Session Telegram belum ada. Membuat session baru...\n');

    const stringSession = new StringSession('');
    const client = new TelegramClient(stringSession, parseInt(apiId), apiHash, {
      connectionRetries: 5,
    });

    await client.start({
      phoneNumber: () => this.promptUser('📞 Masukkan nomor telepon (dengan kode negara, contoh: +6281234567890): '),
      password: () => this.promptUser('🔒 Masukkan password 2FA (jika ada, tekan Enter jika tidak): '),
      phoneCode: () => this.promptUser('📨 Masukkan kode verifikasi dari Telegram: '),
      onError: (err) => console.error('❌ Error:', err),
    });

    const sessionString = client.session.save();

    // Save to session file
    const sessionDir = path.dirname(this.sessionFile);
    if (!fs.existsSync(sessionDir)) {
      fs.mkdirSync(sessionDir, { recursive: true });
    }

    const sessionData = {
      apiId: apiId,
      apiHash: apiHash,
      sessionString: sessionString,
      createdAt: new Date().toISOString()
    };

    fs.writeFileSync(this.sessionFile, JSON.stringify(sessionData, null, 2));
    console.log(`\n✅ Session saved to: ${this.sessionFile}`);
    console.log('⚠️  JANGAN SHARE session ini ke siapapun!\n');

    await client.disconnect();
    return sessionString;
  }

  async initialize(apiId?: string, apiHash?: string, sessionString?: string): Promise<void> {
    let finalApiId = apiId;
    let finalApiHash = apiHash;
    let finalSessionString = sessionString;

    // Try to load from session file first (like Instagram/Facebook)
    if (fs.existsSync(this.sessionFile)) {
      console.log('📂 Loading session from file...');
      const sessionData = JSON.parse(fs.readFileSync(this.sessionFile, 'utf-8'));
      finalApiId = finalApiId || sessionData.apiId;
      finalApiHash = finalApiHash || sessionData.apiHash;
      finalSessionString = finalSessionString || sessionData.sessionString;
      console.log('✅ Session loaded from file');
    } else if (finalApiId && finalApiHash && !finalSessionString) {
      // Session file doesn't exist and no session string provided - generate new session
      console.log('⚠️  Session file tidak ditemukan di: ' + this.sessionFile);
      const newSession = await this.generateSession(finalApiId, finalApiHash);
      if (newSession) {
        finalSessionString = newSession;
      }
    }

    if (!finalApiId || !finalApiHash || !finalSessionString) {
      throw new Error('Telegram credentials not found. Please set API_ID and API_HASH in .env file');
    }

    try {
      console.log('🔌 Initializing Telegram client...');
      console.log(`📱 API ID: ${finalApiId}`);
      console.log(`🔑 API Hash: ${finalApiHash.substring(0, 8)}...`);
      console.log(`📝 Session: ${finalSessionString.substring(0, 20)}...`);

      const stringSession = new StringSession(finalSessionString);
      this.client = new TelegramClient(stringSession, parseInt(finalApiId), finalApiHash, {
        connectionRetries: 5,
        requestRetries: 3,
        timeout: 10000,
        useWSS: false,
        autoReconnect: false, // Disable auto-reconnect to prevent timeout errors
      });

      await this.client.connect();
      console.log('✅ Telegram client connected successfully');

      // Test connection by getting dialogs
      const dialogs = await this.client.getDialogs({ limit: 1 });
      console.log(`✅ Connection verified - found ${dialogs.length} dialog(s)`);
    } catch (error: any) {
      console.error('❌ Failed to initialize Telegram client:', error.message);
      if (error.message.includes('AUTH_KEY')) {
        console.error('💡 Hint: Session string mungkin expired atau invalid. Hapus file session dan coba lagi.');
        console.error(`   File: ${this.sessionFile}`);
      } else if (error.message.includes('FLOOD_WAIT')) {
        console.error('💡 Hint: Telegram rate limit. Tunggu beberapa menit sebelum mencoba lagi.');
      } else if (error.message.includes('API_ID')) {
        console.error('💡 Hint: API_ID atau API_HASH tidak valid. Cek kembali kredensial dari my.telegram.org');
      }
      throw error;
    }
  }

  private formatUsername(username: string): string {
    return username.startsWith('@') ? username : `@${username}`;
  }

  async sendMessage(botUsername: string, text: string): Promise<boolean> {
    if (!this.client) {
      console.error('❌ Telegram client not initialized');
      return false;
    }

    try {
      const formattedUsername = this.formatUsername(botUsername);
      await this.client.sendMessage(formattedUsername, { message: text });
      console.log(`✅ Pesan terkirim ke '${formattedUsername}': ${text.substring(0, 50)}${text.length > 50 ? '...' : ''}`);
      return true;
    } catch (error: any) {
      console.error(`❌ Error saat mengirim pesan ke '${botUsername}':`, error.message);
      if (error.message.includes('PEER_ID_INVALID')) {
        console.error('💡 Hint: Bot username tidak valid atau belum pernah chat dengan bot ini. Coba buka bot di Telegram dulu dan kirim /start.');
      } else if (error.message.includes('FLOOD_WAIT')) {
        console.error('💡 Hint: Terlalu banyak request. Tunggu beberapa detik.');
      }
      return false;
    }
  }

  async getLatestMessage(botUsername: string): Promise<string> {
    if (!this.client) {
      console.error('❌ Telegram client not initialized');
      return 'Error: Client not initialized';
    }

    try {
      const formattedUsername = this.formatUsername(botUsername);
      const messages = await this.client.getMessages(formattedUsername, { limit: 1 });
      if (messages && messages.length > 0) {
        const latestMessage = messages[0];
        console.log(`Pesan diterima dari '${formattedUsername}': ${latestMessage.text}`);
        return latestMessage.text || 'Tidak ada pesan ditemukan.';
      }
      return 'Tidak ada pesan ditemukan.';
    } catch (error: any) {
      console.error(`❌ Error saat mengambil pesan dari '${botUsername}':`, error.message);
      return 'Error: Gagal mengambil pesan';
    }
  }

  async getAllBotResponses(botUsername: string, userMessage: string, maxWaitSeconds: number = 20): Promise<string> {
    if (!this.client) {
      console.error('❌ Telegram client not initialized');
      return 'Error: Client not initialized';
    }

    try {
      const formattedUsername = this.formatUsername(botUsername);
      console.log(`🔍 Capturing bot responses for: "${userMessage.substring(0, 50)}..."`);

      const initialMessages = await this.client.getMessages(formattedUsername, { limit: 5 });
      console.log(`⏳ Waiting for bot reply (max ${maxWaitSeconds}s)...`);

      let botResponses: string[] = [];
      let attempts = 0;
      const maxAttempts = Math.ceil(maxWaitSeconds / 2);

      while (attempts < maxAttempts) {
        await Modul.waitTime(2);
        attempts++;

        const messages = await this.client.getMessages(formattedUsername, { limit: 50 });

        if (attempts === 1) {
          console.log(`📨 Total messages retrieved: ${messages.length}`);
        }

        let questionIndex = -1;
        const normalizedUserMessage = userMessage.trim().toLowerCase();

        for (let i = 0; i < messages.length; i++) {
          const msg = messages[i];
          if (msg.out && msg.text) {
            const normalizedMsgText = msg.text.trim().toLowerCase();
            if (normalizedMsgText === normalizedUserMessage || normalizedMsgText.includes(normalizedUserMessage)) {
              questionIndex = i;
              console.log(`✅ Found user message at index ${i}: "${msg.text.substring(0, 50)}..."`);
              break;
            }
          }
        }

        if (questionIndex === -1) {
          if (attempts === 1 || attempts % 3 === 0) {
            console.log(`⏳ Attempt ${attempts}/${maxAttempts}: User message not found yet, waiting...`);
          }
          continue;
        }

        const currentBotResponses: string[] = [];
        for (let i = 0; i < questionIndex; i++) {
          const msg = messages[i];
          if (!msg.out && msg.text) {
            currentBotResponses.push(msg.text);
          }
        }

        if (currentBotResponses.length > 0) {
          const previousCount = botResponses.length;
          botResponses = currentBotResponses;

          if (previousCount === botResponses.length && previousCount > 0 && attempts > 1) {
            console.log(`✅ Found stable response with ${botResponses.length} messages`);
            break;
          }

          console.log(`📨 Received ${botResponses.length} bot messages (attempt ${attempts}/${maxAttempts}), waiting for more...`);
        }
      }

      if (botResponses.length === 0) {
        console.log(`⚠️ Timeout (${maxWaitSeconds}s) - no bot responses found`);

        const messages = await this.client.getMessages(formattedUsername, { limit: 50 });
        console.log(`📨 Retrieved ${messages.length} messages from chat (fallback)`);

        for (let i = 0; i < Math.min(10, messages.length); i++) {
          const msg = messages[i];
          const preview = msg.text ? msg.text.substring(0, 50) : '[no text]';
          const isOutgoing = msg.out ? '(sent by me)' : '(received)';
          const timestamp = msg.date ? new Date(msg.date * 1000).toLocaleTimeString() : 'unknown';
          console.log(`  [${i}] ${timestamp} ${isOutgoing}: ${preview}...`);
        }

        const recentBotMessages: string[] = [];
        for (let i = 0; i < Math.min(15, messages.length); i++) {
          const msg = messages[i];
          if (!msg.out && msg.text) {
            recentBotMessages.push(msg.text);
          }
        }

        if (recentBotMessages.length > 0) {
          botResponses = recentBotMessages;
          console.log(`📋 Using ${botResponses.length} recent bot messages as fallback`);
        } else {
          console.error('❌ No bot messages found even in fallback mode');
          return 'No response captured';
        }
      }

      console.log(`📋 Total responses captured: ${botResponses.length}`);

      console.log('📨 Messages from API (newest first):');
      for (let i = 0; i < botResponses.length; i++) {
        console.log(`  [${i}] "${botResponses[i].substring(0, 50)}..."`);
      }

      botResponses.reverse();

      console.log('📨 Final order for report (oldest to newest):');
      for (let i = 0; i < botResponses.length; i++) {
        console.log(`  ✅ Bot message ${i + 1}: "${botResponses[i].substring(0, 50)}..."`);
      }

      const fullResponse = botResponses.join('\n');
      console.log(`📝 Final response (${fullResponse.length} chars): "${fullResponse.substring(0, 150)}..."`);

      return fullResponse;
    } catch (error: any) {
      console.error(`❌ Error saat mengambil pesan dari '${botUsername}':`, error.message);
      if (error.message.includes('PEER_ID_INVALID')) {
        console.error('💡 Hint: Bot username tidak valid. Pastikan format: @botusername atau botusername');
      } else if (error.message.includes('FLOOD_WAIT')) {
        const waitTime = error.message.match(/\d+/)?.[0] || 'beberapa';
        console.error(`💡 Hint: Rate limit dari Telegram API. Tunggu ${waitTime} detik.`);
      } else if (error.message.includes('AUTH_KEY')) {
        console.error('💡 Hint: Session expired. Perlu generate session string baru.');
      } else if (error.message.includes('TIMEOUT')) {
        console.error('💡 Hint: Koneksi timeout. Cek koneksi internet atau coba lagi.');
      }
      return `Error: Gagal mengambil pesan - ${error.message}`;
    }
  }

  static calculateStatus(score: number): string {
    return score >= 0.7 ? 'pass' : 'failed';
  }

  async actions(
    targetBotUsername: string,
    greeting: string,
    greeting2: string,
    jsonData: TestData[],
    reportFilename: string,
    idTest: string,
    timeStart: string,
    today: string,
    testerName: string,
    testTracker: TestTracker,
    screenshotsFolder?: string
  ): Promise<void> {
    const start = Modul.startTime();
    
    console.log(`🤖 Activating bot with /start command...`);
    await this.sendMessage(targetBotUsername, '/start');
    await Modul.waitTime(3);

    Modul.showLoading(`Mengirim sapaan awal ke ${targetBotUsername}...`);
    await this.sendMessage(targetBotUsername, greeting);
    await Modul.waitTime(5);

    if (greeting2 && greeting2.trim() !== '') {
      Modul.showLoading(`Mengirim sapaan kedua ke ${targetBotUsername}...`);
      await this.sendMessage(targetBotUsername, greeting2);
      await Modul.waitTime(5);
    }
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

          let respondBot = await this.getAllBotResponses(targetBotUsername, question, 20);
          if (!respondBot || respondBot.trim() === '') {
            respondBot = 'No response captured';
          }

          const titleLoading = `${key} : ${question}`;
          Modul.showLoadingSampleText(titleLoading);

          const respondCsv = (element.context || '').trim();
          const endDurationPerSampleText = Modul.endTime(durationPerQuestion);

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
          const AI = evaluationResult.success ? `${evaluationResult.provider} + Telegram Client` : `Telegram Client (${evaluationResult.provider} fallback)`;

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
            image_capture: '',
            explanation: explanation
          });

          const trackerSummary = testTracker.getSummary();

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

  async disconnect(): Promise<void> {
    if (this.client) {
      try {
        await this.client.disconnect();
        console.log('✅ Telegram client disconnected');
      } catch (error: any) {
        // Suppress timeout errors during disconnect
        if (!error.message.includes('TIMEOUT')) {
          console.error('Error during disconnect:', error.message);
        }
      }
    }
  }
}
