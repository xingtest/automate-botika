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

  static async readBrowser(
    url: string,
    browserType: string = 'chromium',
    headless: boolean = true,
    customViewport?: { width: number; height: number },
    recordVideoDir?: string
  ): Promise<{ browser: Browser; context: BrowserContext; page: Page; title: string; browserName: string }> {
    const title = `Choose ${browserType.toUpperCase()} as a main browser and open the URL`;
    this.showLoading(title);

    // Determine viewport size (default Full HD, or custom for DHAI)
    const viewport = customViewport || { width: 1920, height: 1080 };

    // Optimized args for faster startup
    let launchArgs: string[] = [
      '--no-sandbox',
      '--disable-dev-shm-usage',
      '--disable-background-timer-throttling',
      '--disable-backgrounding-occluded-windows',
      '--disable-renderer-backgrounding',
      '--disable-features=TranslateUI',
      '--disable-ipc-flooding-protection'
    ];

    if (headless) {
      // Headless mode - minimal args for CI/CD
      launchArgs.push(
        '--use-fake-ui-for-media-stream',
        '--use-fake-device-for-media-stream',
        '--autoplay-policy=no-user-gesture-required'
      );
    } else {
      // Visible mode - optimized for speed
      launchArgs.push(
        '--use-fake-ui-for-media-stream',
        '--use-fake-device-for-media-stream',
        '--autoplay-policy=no-user-gesture-required',
        '--allow-file-access-from-files',
        '--disable-web-security',
        `--window-size=${viewport.width},${viewport.height}`,
        '--disable-infobars',
        '--no-first-run',
        '--disable-default-apps',
        '--disable-popup-blocking',
        '--disable-extensions',
        '--disable-plugins'
      );
    }

    // Optimized browser launch with faster timeouts
    const browser = await chromium.launch({
      channel: 'chrome', // Use installed Google Chrome for better microphone support
      headless: headless,
      args: launchArgs,
      timeout: 30000, // Reduced from 90000 to 30000
      slowMo: 0,
      devtools: false
    });

    const contextOptions: Parameters<Browser['newContext']>[0] = {
      viewport: viewport,
      permissions: ['microphone', 'camera', 'notifications'],
      ignoreHTTPSErrors: true,
      bypassCSP: true,
      acceptDownloads: true
    };

    if (recordVideoDir) {
      if (!fs.existsSync(recordVideoDir)) {
        fs.mkdirSync(recordVideoDir, { recursive: true });
      }
      contextOptions.recordVideo = {
        dir: recordVideoDir,
        size: viewport
      };
    }

    const context = await browser.newContext(contextOptions);

    const page = await context.newPage();

    // Optimized page loading with shorter timeouts
    console.log('🌐 Loading page...');
    try {
      // Try fastest loading first
      await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
      console.log('✅ Page loaded with domcontentloaded');
    } catch (error) {
      console.log('⚠️ Trying with load event...');
      try {
        await page.goto(url, { waitUntil: 'load', timeout: 20000 });
        console.log('✅ Page loaded with load event');
      } catch (secondError) {
        console.log('⚠️ Trying with networkidle...');
        await page.goto(url, { waitUntil: 'networkidle', timeout: 25000 });
        console.log('✅ Page loaded with networkidle');
      }
    }

    const pageTitle = await page.title();

    return {
      browser,
      context,
      page,
      title: pageTitle,
      browserName: headless ? 'Chrome (Headless)' : 'Chrome (Visible)'
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
