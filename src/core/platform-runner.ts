import * as path from 'path';
import { Modul } from '../utils/modul';
import { WebchatPlatform } from '../platforms/webchat';
import { TelegramPlatform } from '../platforms/telegram';
import { InstagramPlatform } from '../platforms/instagram';
import { FacebookPlatform } from '../platforms/facebook';
import { DhaiPlatform } from '../platforms/dhai';
import type { PlatformConfig, TestData } from './config';

export interface PlatformRunParams {
  config: PlatformConfig;
  testData: TestData[];
  reportFilename: string;
  idTest: string;
  timeStart: string;
  today: string;
  screenshotsFolder: string;
}

export async function runPlatform(params: PlatformRunParams): Promise<void> {
  const { config, testData, reportFilename, idTest, timeStart, today, screenshotsFolder } = params;
  const { platform, greeting, testerName } = config;

  if (platform === 'webchat') {
    const url = process.env.TARGET_URL;
    if (!url) throw new Error("TARGET_URL tidak diatur untuk platform 'webchat'.");

    const { browser, page, title, browserName } = await Modul.readBrowser(url, 'chromium');
    const webchatName = process.env.WEBCHAT_NAME || 'Tester';
    const webchatEmail = process.env.WEBCHAT_EMAIL || 'tester@example.com';
    const webchatPhone = process.env.WEBCHAT_PHONE || '081234567890';
    await WebchatPlatform.prechatForm(page, greeting, webchatName, webchatEmail, webchatPhone);
    await WebchatPlatform.actions(page, testData, reportFilename, idTest, timeStart, today, testerName, url, title, browserName, screenshotsFolder);
    await Modul.closeBrowser(browser);
    return;
  }

  if (platform === 'telegram') {
    const targetBotUsername = process.env.TARGET_BOT_USERNAME;
    const apiId = process.env.API_ID;
    const apiHash = process.env.API_HASH;
    const sessionString = process.env.TELEGRAM_SESSION;

    if (!targetBotUsername || !apiId || !apiHash) {
      throw new Error('Telegram credentials tidak lengkap. Pastikan TARGET_BOT_USERNAME, API_ID, dan API_HASH sudah diset di .env');
    }

    const telegramPlatform = new TelegramPlatform();
    await telegramPlatform.initialize(apiId, apiHash, sessionString);
    await telegramPlatform.actions(targetBotUsername, greeting, testData, reportFilename, idTest, timeStart, today, testerName, screenshotsFolder);
    await telegramPlatform.disconnect();
    return;
  }

  if (platform === 'instagram') {
    const targetUsername = process.env.TARGET_USERNAME;
    if (!targetUsername) throw new Error("TARGET_USERNAME tidak diatur untuk platform 'instagram'.");

    const { browser, page } = await Modul.readBrowser('https://www.instagram.com', 'chromium');
    const instagramPlatform = new InstagramPlatform();
    await instagramPlatform.initialize(page);
    await instagramPlatform.actions(targetUsername, greeting, testData, reportFilename, idTest, timeStart, today, testerName, screenshotsFolder);
    await Modul.closeBrowser(browser);
    return;
  }

  if (platform === 'facebook') {
    const targetFanpageId = process.env.TARGET_FANPAGE_ID;
    if (!targetFanpageId) throw new Error("TARGET_FANPAGE_ID tidak diatur untuk platform 'facebook'.");

    const { browser, page } = await Modul.readBrowser('https://www.facebook.com', 'chromium');
    const facebookPlatform = new FacebookPlatform();
    await facebookPlatform.initialize(page);
    await facebookPlatform.actions(targetFanpageId, greeting, testData, reportFilename, idTest, timeStart, today, testerName, screenshotsFolder);
    await Modul.closeBrowser(browser);
    return;
  }

  if (platform === 'dhai') {
    const url = process.env.DHAI_TARGET_URL;
    if (!url) throw new Error("DHAI_TARGET_URL tidak diatur untuk platform 'dhai'.");

    const headlessMode = process.env.HEADLESS !== 'false';
    const dhaiViewport = { width: 1280, height: 720 };
    const { browser, page, title, browserName } = await Modul.readBrowser(url, 'chromium', headlessMode, dhaiViewport);
    await DhaiPlatform.actions(page, testData, reportFilename, idTest, timeStart, today, testerName, url, title, browserName, screenshotsFolder, {
      enabled: config.dhaiCaptureQaMedia,
      mode: config.dhaiCaptureMode,
      maxSeconds: config.dhaiCaptureMaxSeconds,
      mediaFolder: path.join('report', 'html', `${reportFilename}-${idTest}`, 'media')
    });
    await Modul.closeBrowser(browser);
    return;
  }

  throw new Error(`Platform '${platform}' tidak didukung.`);
}
