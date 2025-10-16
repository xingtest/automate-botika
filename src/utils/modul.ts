import { chromium, Browser, Page, BrowserContext } from 'playwright';
import * as fs from 'fs';
import * as path from 'path';
import { v4 as uuidv4 } from 'uuid';

export class Modul {
  static showLoading(title: string): void {
    const animation = "|/-\\";
    let i = 0;
    const interval = setInterval(() => {
      process.stdout.write(`\r\x1b[34m${title}${animation[i % animation.length]}\x1b[0m`);
      i++;
      if (i >= 15) {
        clearInterval(interval);
        process.stdout.write(`\r\x1b[34m${title} ✔\x1b[0m\n`);
      }
    }, 100);
  }

  static showLoadingSampleText(title: string): void {
    console.log(`\x1b[37m${title} ✔\x1b[0m`);
  }

  static initialize(text: string): void {
    console.log(`\x1b[31m${text}\x1b[0m`);
  }

  static testDone(text: string): void {
    console.log(`\x1b[32m${text}\x1b[0m`);
  }

  static todays(): { today: string; time: string } {
    const now = new Date();
    const options: Intl.DateTimeFormatOptions = { 
      weekday: 'long', 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric' 
    };
    const today = now.toLocaleDateString('id-ID', options);
    const time = now.toLocaleTimeString('id-ID');
    return { today, time };
  }

  static startTime(): number {
    return Date.now();
  }

  static endTime(start: number): string {
    const duration = Date.now() - start;
    const hours = Math.floor(duration / 3600000);
    const minutes = Math.floor((duration % 3600000) / 60000);
    const seconds = Math.floor((duration % 60000) / 1000);
    return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
  }

  static idTest(): string {
    return uuidv4().substring(0, 8);
  }

  static waitTime(seconds: number = 1): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, seconds * 1000));
  }

  static async readBrowser(url: string, browserType: string = 'chromium'): Promise<{ browser: Browser; context: BrowserContext; page: Page; title: string; browserName: string }> {
    const title = `Choose ${browserType.toUpperCase()} as a main browser and open the URL`;
    this.showLoading(title);

    const browser = await chromium.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-dev-shm-usage', '--disable-gpu']
    });

    const context = await browser.newContext({
      viewport: { width: 1920, height: 1080 }
    });

    const page = await context.newPage();
    await page.goto(url, { waitUntil: 'networkidle' });
    const pageTitle = await page.title();

    return {
      browser,
      context,
      page,
      title: pageTitle,
      browserName: 'Chromium (Headless)'
    };
  }

  static async closeBrowser(browser: Browser): Promise<void> {
    this.showLoading('🟡 Closing environment');
    this.showLoading('🔴 Deleting cookies');
    this.showLoading('🟠 Close browser');
    await browser.close();
    console.log();
  }

  static setupLogging(reportFilename: string, idTest: string): void {
    const logDir = path.join('log', new Date().toISOString().split('T')[0]);
    if (!fs.existsSync(logDir)) {
      fs.mkdirSync(logDir, { recursive: true });
    }
    const logFile = path.join(logDir, `${reportFilename}-${idTest}.log`);
    console.log(`Logging to: ${logFile}`);
  }
}
