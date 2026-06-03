import { Page } from 'playwright';
import { Modul } from '../utils/modul';
import { EvaluatorFactory } from '../utils/ai-evaluator';
import { TestData, BotData, SummaryData } from '../main';
import { TestTracker } from '../utils/test-tracker';
import { log } from '../utils/logger';
import { calculateStatus, EVAL_CONFIG } from '../utils/ai-evaluator';
import { EnvFile } from '../utils/envfile';
import * as fs from 'fs';
import * as path from 'path';
import { runTestLoop } from '../utils/test-runner';

export class WhatsAppPlatform {
  private page: Page | null = null;
  private sessionFile = 'session/session-whatsapp.json';

  // ============================================================
  // INITIALIZE — load cookie session ke browser context
  // ============================================================
  async initialize(page: Page): Promise<void> {
    this.page = page;

    if (!fs.existsSync(this.sessionFile)) {
      throw new Error(
        `WhatsApp session tidak ditemukan di '${this.sessionFile}'.\n` +
        `Cara mendapatkan session:\n` +
        `  1. Buka web.whatsapp.com di Chrome\n` +
        `  2. Scan QR Code\n` +
        `  3. Buka DevTools → Application → Cookies → https://web.whatsapp.com\n` +
        `  4. Copy semua cookies ke JSON dan simpan ke ${this.sessionFile}`
      );
    }

    const cookies = JSON.parse(fs.readFileSync(this.sessionFile, 'utf-8'));
    await page.context().addCookies(cookies);
    log.info('✅ WhatsApp session loaded from file');
  }

  // ============================================================
  // NAVIGATE — buka chat dengan nomor/kontak tertentu
  // Format targetNumber: "628xxxxxxxxxx" (tanpa + atau spasi)
  // ============================================================
  async navigateToChat(targetNumber: string): Promise<void> {
    if (!this.page) throw new Error('WhatsApp page not initialized');

    // Buka WhatsApp Web
    log.info('🌐 Opening WhatsApp Web...');
    try {
      await this.page.goto('https://web.whatsapp.com', { waitUntil: 'networkidle', timeout: 60000 });
    } catch {
      await this.page.goto('https://web.whatsapp.com', { waitUntil: 'domcontentloaded', timeout: 60000 });
    }

    // Tunggu loading selesai — cek apakah QR code muncul (berarti session invalid)
    log.info('⏳ Waiting for WhatsApp Web to load...');
    try {
      await this.page.waitForSelector('div[data-testid="qrcode"]', { timeout: 5000 });
      throw new Error(
        '❌ WhatsApp Web meminta scan QR Code — session cookie expired atau tidak valid.\n' +
        'Silakan generate ulang session dari browser.'
      );
    } catch (err: any) {
      if (err.message.includes('QR Code')) throw err;
      // QR tidak muncul = session valid, lanjut
    }

    // Tunggu sidebar chat muncul (tanda sudah login)
    try {
      await this.page.waitForSelector('div[aria-label="Chat list"], div[data-testid="chat-list"]', { timeout: 30000 });
      log.info('✅ WhatsApp Web loaded and logged in');
    } catch {
      log.warn('⚠️ Chat list not found, continuing anyway...');
    }

    // Navigasi langsung ke chat dengan nomor
    const chatUrl = `https://web.whatsapp.com/send?phone=${targetNumber}`;
    log.info(`📱 Opening chat: ${chatUrl}`);
    try {
      await this.page.goto(chatUrl, { waitUntil: 'networkidle', timeout: 60000 });
    } catch {
      await this.page.goto(chatUrl, { waitUntil: 'domcontentloaded', timeout: 60000 });
    }

    // Tunggu input pesan muncul
    try {
      await this.page.waitForSelector(
        'div[contenteditable="true"][data-testid="conversation-compose-box-input"], div[contenteditable="true"][title="Type a message"]',
        { timeout: 30000 }
      );
      log.info('✅ Chat opened successfully');
    } catch {
      log.warn('⚠️ Message input not found, chat might still be loading...');
    }

    await Modul.waitTime(3);
  }

  // ============================================================
  // SEND MESSAGE
  // ============================================================
  async sendMessage(message: string): Promise<boolean> {
    if (!this.page) {
      log.error('❌ WhatsApp page not initialized');
      return false;
    }

    try {
      // Coba beberapa selector untuk input box
      const inputSelectors = [
        'div[contenteditable="true"][data-testid="conversation-compose-box-input"]',
        'div[contenteditable="true"][title="Type a message"]',
        'div[data-testid="conversation-compose-box-input"]',
        'div[contenteditable="true"][spellcheck="true"]',
      ];

      let inputBox = null;
      for (const selector of inputSelectors) {
        try {
          const el = this.page.locator(selector).first();
          if (await el.isVisible({ timeout: 2000 })) {
            inputBox = el;
            break;
          }
        } catch { }
      }

      if (!inputBox) {
        log.error('❌ Message input box not found');
        return false;
      }

      await inputBox.click();
      await inputBox.fill(message);
      await Modul.waitTime(0.5);

      // Kirim dengan Enter atau tombol send
      try {
        const sendBtn = this.page.locator('button[data-testid="send"], span[data-testid="send"]').first();
        if (await sendBtn.isVisible({ timeout: 2000 })) {
          await sendBtn.click();
        } else {
          await this.page.keyboard.press('Enter');
        }
      } catch {
        await this.page.keyboard.press('Enter');
      }

      log.info(`✅ Message sent: "${message.substring(0, 60)}${message.length > 60 ? '...' : ''}"`);
      return true;
    } catch (error: any) {
      log.error(`❌ Error sending message: ${error.message}`);
      return false;
    }
  }

  // ============================================================
  // WAIT FOR REPLY — tunggu sampai ada pesan baru dari bot
  // ============================================================
  async waitForReply(userMessage: string, maxWaitSeconds: number = 30): Promise<void> {
    log.info(`⏳ Waiting for WhatsApp reply (max ${maxWaitSeconds}s)...`);
    const deadline = Date.now() + maxWaitSeconds * 1000;
    let lastCount = 0;

    // Hitung pesan awal
    try {
      const msgs = await this.page!.locator('div[data-testid="msg-container"]').all();
      lastCount = msgs.length;
    } catch { }

    while (Date.now() < deadline) {
      await Modul.waitTime(1);
      try {
        const msgs = await this.page!.locator('div[data-testid="msg-container"]').all();
        if (msgs.length > lastCount) {
          // Pesan baru muncul — cek apakah dari bot (incoming)
          const lastMsg = msgs[msgs.length - 1];
          const isIncoming = await lastMsg.evaluate(el =>
            !el.classList.contains('message-out') &&
            !el.closest('.message-out')
          ).catch(() => true);

          if (isIncoming) {
            log.info(`✅ Bot replied!`);
            await Modul.waitTime(1.5); // Buffer untuk multi-bubble
            return;
          }
          lastCount = msgs.length;
        }
      } catch { }
    }

    log.warn(`⚠️ Timeout waiting for reply to: "${userMessage}"`);
  }

  // ============================================================
  // GET BOT RESPONSES — ambil semua bubble balasan setelah pesan user
  // ============================================================
  async getBotResponses(userMessage: string): Promise<string> {
    if (!this.page) return 'Error: Page not initialized';

    try {
      // Tunggu DOM stabil
      await Modul.waitTime(2);

      // Ambil semua message container
      const allMsgContainers = await this.page.locator(
        'div[data-testid="msg-container"], div.message-in, div.message-out'
      ).all();

      log.info(`📊 Total message containers: ${allMsgContainers.length}`);

      // Kumpulkan semua pesan dengan info arahnya (in/out)
      const messages: { text: string; isOutgoing: boolean }[] = [];

      for (const container of allMsgContainers) {
        try {
          const isOut = await container.evaluate(el =>
            el.classList.contains('message-out') ||
            !!el.closest('.message-out') ||
            el.getAttribute('data-id')?.startsWith('true') === true
          ).catch(() => false);

          // Ambil teks dari bubble
          const textSelectors = [
            'span[data-testid="msg-text"] span',
            'span[data-testid="msg-text"]',
            'div.selectable-text span',
            'span.selectable-text',
          ];

          let text = '';
          for (const sel of textSelectors) {
            try {
              const el = container.locator(sel).first();
              const t = await el.textContent({ timeout: 500 });
              if (t && t.trim()) {
                text = t.trim();
                break;
              }
            } catch { }
          }

          if (text) {
            messages.push({ text, isOutgoing: isOut });
          }
        } catch { }
      }

      log.info(`📋 Parsed ${messages.length} messages`);

      // Cari posisi pesan user yang paling terakhir
      const normalizedUserMsg = userMessage.trim().toLowerCase();
      let questionIndex = -1;

      for (let i = messages.length - 1; i >= 0; i--) {
        if (messages[i].isOutgoing &&
          messages[i].text.toLowerCase().trim() === normalizedUserMsg) {
          questionIndex = i;
          log.info(`✅ Found user message at index ${i}`);
          break;
        }
      }

      if (questionIndex === -1) {
        log.warn(`⚠️ User message not found, using last 3 incoming messages as fallback`);
        const fallback = messages
          .filter(m => !m.isOutgoing)
          .slice(-3)
          .map(m => m.text);
        return fallback.length > 0 ? fallback.join('\n') : 'No response captured';
      }

      // Ambil semua pesan incoming setelah questionIndex
      const botResponses: string[] = [];
      for (let i = questionIndex + 1; i < messages.length; i++) {
        if (messages[i].isOutgoing) break; // Stop saat ketemu pesan user berikutnya
        if (messages[i].text) {
          botResponses.push(messages[i].text);
        }
      }

      // Deduplicate
      const unique = [...new Set(botResponses)];
      log.info(`📊 Captured ${unique.length} bot response(s)`);

      return unique.length > 0 ? unique.join('\n') : 'No response captured';

    } catch (error: any) {
      log.error(`❌ Error getting bot responses: ${error.message}`);
      return 'Error: Failed to capture responses';
    }
  }

  // ============================================================
  // SCREENSHOT
  // ============================================================
  async takeScreenshot(idTest: string, key: string, question: string, screenshotsFolder: string): Promise<string> {
    if (!this.page) return '';

    const dir = screenshotsFolder || 'report/screenshoot';
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

    const sanitized = question.substring(0, 30).replace(/[^a-z0-9]/gi, '_');
    const filename = `${idTest}_${key}_${sanitized}.png`;
    const filepath = path.join(dir, filename);

    await this.page.screenshot({ path: filepath, fullPage: true });
    return filename;
  }

  // ============================================================
  // ACTIONS — main test loop
  // ============================================================
  async actions(
    targetNumber: string,
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

    // Buka chat
    await this.navigateToChat(targetNumber);

    // Kirim greeting
    if (greeting && greeting.trim() !== '') {
      log.info(`📤 Sending greeting 1: "${greeting}"`);
      await this.sendMessage(greeting);
      await Modul.waitTime(3);
    }

    if (greeting2 && greeting2.trim() !== '') {
      log.info(`📤 Sending greeting 2: "${greeting2}"`);
      await this.sendMessage(greeting2);
      await Modul.waitTime(3);
    }

    const title = '当 Membaca pertanyaan dan mengirim ke WhatsApp';
    Modul.showLoading(title);
    log.info('');

    const waUrl = `https://web.whatsapp.com/send?phone=${targetNumber}`;

    await runTestLoop({
      sendMessage: async (q) => {
        await this.sendMessage(q);
        await this.waitForReply(q, 30);
      },
      getReply: (q) => this.getBotResponses(q),
      takeScreenshot: (iTest, key, question, ssFolder) =>
        this.takeScreenshot(iTest, key, question, ssFolder),
      jsonData,
      reportFilename,
      idTest,
      screenshotsFolder: screenshotsFolder || '',
      testerName,
      url: waUrl,
      pageName: 'WhatsApp Web Test',
      browserName: 'Playwright Chromium',
      today,
      timeStart,
      platformLabel: 'Playwright TypeScript',
      testTracker,
      postSendDelay: 2,
    });
  }
}
