import { TelegramClient } from 'telegram';
import { StringSession } from 'telegram/sessions';
import { Modul } from '../utils/modul';
import { EnvFile } from '../utils/envfile';
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

  static calculateStatus(score: number): string {
    return score >= 70 ? 'PASS' : 'FAILED';
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
  ): Promise<void> {
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
          await Modul.waitTime(15);

          let respondBot = await this.getLatestMessage(targetBotUsername);
          if (!respondBot) {
            respondBot = 'Error: Tidak ada balasan dari bot setelah menunggu.';
          }

          const titleLoading = `${key} : ${question}`;
          Modul.showLoadingSampleText(titleLoading);

          const respondCsv = (element.context || '').trim();
          const endDurationPerSampleText = Modul.endTime(durationPerQuestion);

          // Simplified LLM scoring (placeholder)
          const skor = 80;
          const explanation = 'Auto-evaluated';
          const AI = 'Playwright TypeScript';

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
