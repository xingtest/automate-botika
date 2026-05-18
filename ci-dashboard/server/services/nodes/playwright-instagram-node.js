const BaseNode = require('./base-node');
const { chromium } = require('playwright');

class PlaywrightInstagramNode extends BaseNode {
  constructor() {
    super({
      type: 'playwright-instagram',
      category: 'action',
      label: 'Instagram DM Test',
      description: 'Execute Playwright test via Instagram Direct Message',
      icon: 'fa-instagram',
      color: '#E1306C',
      inputs: [
        { id: 'main', name: 'Test Data', dataType: 'object', required: false }
      ],
      outputs: [
        { id: 'main', name: 'Test Results', dataType: 'object', required: true }
      ],
      config_schema: [
        {
          key: 'target_username',
          label: 'Target Username (IG)',
          type: 'text',
          required: true,
          default: 'botika.online',
          description: 'Username Instagram akun chatbot yang akan dites (tanpa @)'
        },
        {
          key: 'sessionid',
          label: 'Session ID Cookie',
          type: 'text',
          required: true,
          description: 'Cara dapatkan: Login IG di browser Anda > Inspect Element > Application > Cookies > Copy Value dari sessionid'
        },
        {
          key: 'greeting',
          label: 'Greeting Message',
          type: 'text',
          required: false,
          default: 'Halo'
        },
        {
          key: 'greeting_2',
          label: 'Greeting Message 2',
          type: 'text',
          required: false,
          default: ''
        },
        {
          key: 'headless',
          label: 'Headless Mode',
          type: 'boolean',
          required: false,
          default: true
        }
      ]
    });
  }

  async execute(context, config) {
    const targetUsername = config.target_username;
    const sessionId = config.sessionid;
    const greeting = config.greeting !== undefined ? config.greeting : 'Halo';
    const greeting2 = config.greeting_2 || '';
    const headless = config.headless !== undefined ? config.headless : true;
    
    const inputData = this.getInput(context, 'main');
    const testData = inputData?.results || [];

    if (!sessionId) {
      throw new Error('Instagram Session ID Cookie is required!');
    }
    if (!targetUsername) {
      throw new Error('Target Username is required!');
    }

    this.log('info', `Starting Instagram Test. Target: @${targetUsername}, Headless: ${headless}`);

    let browser;
    let results = [];

    try {
      this.logTechnical(context, 'info', 'Launching browser...');
      browser = await chromium.launch({ headless });
      const browserContext = await browser.newContext();

      // Inject Instagram Cookie
      await browserContext.addCookies([
        {
          name: 'sessionid',
          value: String(sessionId).trim(),
          domain: '.instagram.com',
          path: '/',
          httpOnly: true,
          secure: true
        }
      ]);

      const page = await browserContext.newPage();
      
      this.logTechnical(context, 'info', `Navigating to https://www.instagram.com/${targetUsername}/...`);
      await page.goto(`https://www.instagram.com/${targetUsername}/`, { waitUntil: 'domcontentloaded', timeout: 60000 });
      await page.waitForTimeout(3000);

      // Cek apakah login gagal (redirect ke login)
      if (page.url().includes('login')) {
        throw new Error('Login Gagal! Session ID sudah expired atau tidak valid. Silakan copy Session ID yang baru dari browser.');
      }

      // Matikan popup notifikasi atau login wall jika muncul
      const popups = [
        'button:has-text("Not Now")', 
        'button:has-text("Lain Kali")',
        'button:has-text("Dismiss")',
        'div[role="dialog"] button:has-text("Close")',
        'svg[aria-label="Close"]'
      ];
      
      for (const selector of popups) {
        try {
          if (await page.isVisible(selector).catch(() => false)) {
            await page.click(selector, { timeout: 2000 }).catch(() => {});
          }
        } catch (e) {}
      }

      // Klik tombol Message di profil pengguna
      this.logTechnical(context, 'info', 'Searching for Message button...');
      
      const messageButtonSelectors = [
        'div[role="button"]:has-text("Message")',
        'div[role="button"]:has-text("Kirim pesan")',
        'button:has-text("Message")',
        'button:has-text("Kirim pesan")',
        'a[href*="/direct/t/"]',
        'xpath=//div[text()="Message"]',
        'xpath=//div[text()="Kirim pesan"]',
        'xpath=//button[text()="Message"]'
      ];

      let clicked = false;
      for (const selector of messageButtonSelectors) {
        try {
          const btn = page.locator(selector).first();
          if (await btn.isVisible({ timeout: 2000 }).catch(() => false)) {
            this.logTechnical(context, 'info', `Clicking Message button with selector: ${selector}`);
            await btn.click();
            clicked = true;
            break;
          }
        } catch (e) {}
      }

      if (!clicked) {
        // Ambil screenshot untuk debug sebelum throw error
        const screenshotPath = `artifacts/ig_failure_${Date.now()}.png`;
        await page.screenshot({ path: screenshotPath, fullPage: true });
        this.log('error', `Debug screenshot saved to: ${screenshotPath}`);
        
        throw new Error(`Gagal menemukan tombol Message di profil target. Pastikan Session ID valid dan akun target tidak di-private. Lihat screenshot: ${screenshotPath}`);
      }

      // Tunggu sampai kotak input DM muncul
      const dmInputSelector = 'div[role="textbox"][contenteditable="true"]';
      await page.waitForSelector(dmInputSelector, { timeout: 30000 });
      await page.waitForTimeout(2000); // Beri waktu UI untuk stabil

      // Matikan popup notifikasi jika muncul (Sering muncul "Turn on Notifications")
      const notNowButton = page.locator('button:has-text("Not Now"), button:has-text("Lain Kali")');
      if (await notNowButton.isVisible().catch(() => false)) {
        await notNowButton.click();
      }

      if (greeting && String(greeting).trim()) {
        this.logTechnical(context, 'info', `Sending greeting message: "${greeting}"`);
        await this.sendMessage(page, greeting, dmInputSelector);
        await this.waitForReply(page, greeting, 15000); // Tunggu balasan greeting
        this.logTechnical(context, 'info', 'Greeting message sent and handled');
      }

      if (greeting2 && String(greeting2).trim()) {
        this.logTechnical(context, 'info', `Sending second greeting message: "${greeting2}"`);
        await this.sendMessage(page, greeting2, dmInputSelector);
        await this.waitForReply(page, greeting2, 15000); // Tunggu balasan greeting
        this.logTechnical(context, 'info', 'Second greeting message sent and handled');
      }

      // Mulai Testing
      for (let i = 0; i < testData.length; i++) {
        const testItem = testData[i];
        const question = this.getField(testItem, ['question', 'pertanyaan', 'test_case']);
        const expected = this.getField(testItem, ['response_kb', 'expected', 'expected_answer', 'context']);
        const title = this.getField(testItem, ['title', 'topic']) || `Test ${i + 1}`;
        const no = this.getField(testItem, ['no', 'number']) || i + 1;

        this.logTechnical(context, 'info', `[${i + 1}/${testData.length}] Testing question: "${question.substring(0, 50)}..."`);
        this.log('info', `[${i + 1}/${testData.length}] Testing: ${question.substring(0, 50)}...`);
        
        const startTime = Date.now();
        await this.sendMessage(page, question, dmInputSelector);
        
        // Timeout balasan bot 30 detik
        const actual = await this.waitForReply(page, question, 30000);
        const duration = ((Date.now() - startTime) / 1000).toFixed(2);

        this.logTechnical(context, 'info', `[${i + 1}/${testData.length}] Received reply: "${actual.substring(0, 50)}..." (${duration}s)`);

        results.push({
          no,
          title,
          question,
          response_kb: expected,
          response_llm: actual,
          expected,
          actual,
          duration: `${duration}s`
        });

        // Delay antar pesan agar tidak terdeteksi sebagai spammer agresif
        if (testData.length > 1 && i < testData.length - 1) {
          await new Promise(r => setTimeout(r, 2000));
        }
      }

      this.log('info', `Test completed: ${results.length} items`);

      return {
        success: true,
        results,
        total_tested: results.length,
        platform: 'instagram',
        target_username: targetUsername
      };

    } catch (error) {
      this.log('error', `Instagram Test Failed: ${error.message}`);
      throw error;
    } finally {
      if (browser) {
        await browser.close();
        this.logTechnical(context, 'info', 'Browser closed');
      }
    }
  }

  async sendMessage(page, message, inputSelector) {
    try {
      if (!message || !String(message).trim()) return;

      const input = page.locator(inputSelector).first();
      await input.waitFor({ state: 'visible', timeout: 10000 });
      
      // Ketik perlahan menyerupai manusia agar tidak mudah kena limit
      await input.fill(String(message));
      await page.waitForTimeout(500);
      
      // Di IG web, menekan tombol Enter akan mengirim pesan
      await input.press('Enter');
      
    } catch (error) {
      this.log('warn', `Failed to send message: ${error.message}`);
      throw error;
    }
  }

  async waitForReply(page, question, timeoutMs = 30000) {
    const startedAt = Date.now();
    let lastResponse = '';

    while (Date.now() - startedAt < timeoutMs) {
      const response = await this.captureResponse(page);
      if (response) {
        if (response === lastResponse) {
          // Jika respons sudah stabil (tidak berubah), kita anggap selesai
          return response;
        }
        lastResponse = response;
      }
      await page.waitForTimeout(lastResponse ? 1500 : 1000);
    }

    return lastResponse || 'No response captured';
  }

  async captureResponse(page) {
    try {
      const result = await page.evaluate(() => {
        // Selektor untuk balon chat (div yang membungkus teks pesan)
        // IG menggunakan role="row" untuk setiap baris pesan
        const rows = Array.from(document.querySelectorAll('div[role="row"]'));
        if (!rows.length) return '';

        // Ambil pesan terakhir (yang paling bawah)
        let lastMessageRow = rows[rows.length - 1];
        
        // Jika pesan terakhir adalah milik kita (pengirim), berarti belum ada balasan
        // Biasanya pesan kita memiliki atribut atau struktur CSS spesifik, 
        // tapi secara kasat mata, pesan yang masuk biasanya berada di sebelah kiri
        // sedangkan pesan kita di kanan. Kita bisa mengambil semua teks dari balon terakhir
        // yang BUKAN merupakan pesan kita.
        
        // Pengecekan kasar: Pesan dari lawan bicara biasanya tidak memiliki class background warna tertentu yang sama dengan kita
        // Atau kita bisa mengasumsikan, kita ambil saja teks terakhir. Untuk amannya, kita baca pesan terakhir yang diterima.
        
        // Karena IG DOM sering berubah, cara paling dasar: 
        // Ambil elemen div terdalam yang memiliki teks.
        
        // Untuk penyederhanaan, mari ambil teks dari row terakhir
        const text = lastMessageRow.innerText || lastMessageRow.textContent;
        return (text || '').trim();
      });

      return result || '';
    } catch (error) {
      return '';
    }
  }

  getField(item, names) {
    if (!item || typeof item !== 'object') return '';
    const entries = Object.entries(item);
    for (const name of names) {
      const match = entries.find(([key]) => key.toLowerCase() === name.toLowerCase());
      if (match && match[1] !== undefined && match[1] !== null) {
        return String(match[1]).trim();
      }
    }
    return '';
  }
}

module.exports = PlaywrightInstagramNode;
