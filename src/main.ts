import * as dotenv from 'dotenv';
import * as fs from 'fs';
import * as path from 'path';
import { Modul } from './utils/modul';
import { EnvFile } from './utils/envfile';
import { WebchatPlatform } from './platforms/webchat';
import { TelegramPlatform } from './platforms/telegram';
import { InstagramPlatform } from './platforms/instagram';
import { FacebookPlatform } from './platforms/facebook';
import { DhaiPlatform } from './platforms/dhai';
// import { DhaiWakeupPlatform } from './platforms/dhai-wakeup'; // Temporarily commented
import { PlatformConfig, TestData } from './types';

dotenv.config();

function cleanupPreviousReport(reportFilename: string, idTest: string): void {
  Modul.showLoading('Membersihkan file laporan lama...');
  const fullReportName = `${reportFilename}-${idTest}`;
  const reportFilePath = path.join('report', 'json', `${fullReportName}.json`);

  if (fs.existsSync(reportFilePath)) {
    try {
      fs.unlinkSync(reportFilePath);
      console.log(`Berhasil menghapus file laporan lama: ${reportFilePath}`);
    } catch (error) {
      console.error(`Error saat menghapus file ${reportFilePath}:`, error);
    }
  } else {
    console.log('Tidak ada file laporan lama ditemukan untuk dihapus. Memulai proses baru.');
  }
  console.log();
}

function loadTestData(filename: string): TestData[] {
  const ext = path.extname(filename).toLowerCase();

  if (ext === '.json') {
    const filePath = path.join('assets', 'json', filename);
    if (!fs.existsSync(filePath)) {
      throw new Error(`File not found: ${filePath}`);
    }
    return JSON.parse(fs.readFileSync(filePath, 'utf-8'));
  } else if (ext === '.csv') {
    return EnvFile.convertCsvToJson(filename);
  } else if (ext === '.xlsx' || ext === '.xls') {
    return EnvFile.convertExcelToJson(filename);
  } else {
    throw new Error(`Unsupported file format: ${ext}`);
  }
}

async function main(): Promise<void> {
  Modul.initialize('Initialize ...');
  const { today, time: timeStart } = Modul.todays();
  const startDurationMeasurement = Modul.startTime();
  const idTest = Modul.idTest();

  console.log(`Test ID : ${idTest}\nDay : ${today}\nStart Time : ${timeStart}\n`);

  // Declare reportFilename outside try block so it's accessible in finally
  let reportFilename = '';

  try {
    const platform = (process.env.PLATFORM || '').toLowerCase();
    if (!platform) {
      console.error("Error: Environment variable 'PLATFORM' tidak diatur.");
      Modul.testDone('Test Failed!');
      return;
    }

    const filenameWithExt = process.env.FILENAME;
    const testerName = process.env.TESTER_NAME || 'Nama Penguji Baru';
    const greeting = process.env.GREETING || 'Halo';

    const now = new Date();
    const dateStr = now.toISOString().split('T')[0].replace(/-/g, '-');
    const timeStr = now.toTimeString().split(' ')[0].replace(/:/g, '-');
    const testerNameClean = testerName.replace(/\s+/g, '_');
    reportFilename = `${testerNameClean}_${platform}_${dateStr}_${timeStr}`;

    cleanupPreviousReport(reportFilename, idTest);
    Modul.setupLogging(reportFilename, idTest);

    console.log(`Platform Pengujian: ${platform.charAt(0).toUpperCase() + platform.slice(1)}`);
    console.log(`Greeting: ${greeting}\n`);

    if (!filenameWithExt) {
      console.error("Error: Nama file data uji tidak ditemukan.");
      Modul.testDone('Test Failed!');
      return;
    }

    console.log(`File Uji yang Digunakan: ${filenameWithExt}\n`);
    console.log(`Tester: ${testerName}\n`);

    const jsonData = loadTestData(filenameWithExt);
    if (!jsonData || jsonData.length === 0) {
      console.error('Error: Tidak ada data yang dapat dibaca dari file.');
      Modul.testDone('Test Failed!');
      return;
    }

    // Execute based on platform
    if (platform === 'webchat') {
      const url = process.env.TARGET_URL;
      if (!url) {
        console.error("Error: TARGET_URL tidak diatur untuk platform 'webchat'.");
        Modul.testDone('Test Failed!');
        return;
      }
      console.log(`URL Pengujian: ${url}\n`);

      const { browser, page, title, browserName } = await Modul.readBrowser(url, 'chromium');
      await WebchatPlatform.prechatForm(page, greeting, 'Tester', 'tester@example.com', '081234567890');
      await WebchatPlatform.actions(page, jsonData, reportFilename, idTest, timeStart, today, testerName, url, title, browserName);
      await Modul.closeBrowser(browser);

    } else if (platform === 'telegram') {
      const targetBotUsername = process.env.TARGET_BOT_USERNAME;
      const apiId = process.env.API_ID;
      const apiHash = process.env.API_HASH;
      const sessionString = process.env.TELEGRAM_SESSION;

      if (!targetBotUsername || !apiId || !apiHash || !sessionString) {
        console.error('Error: Telegram credentials tidak lengkap.');
        Modul.testDone('Test Failed!');
        return;
      }

      console.log(`Target Bot Telegram: ${targetBotUsername}\n`);
      const telegramPlatform = new TelegramPlatform();
      await telegramPlatform.initialize(apiId, apiHash, sessionString);
      await telegramPlatform.actions(targetBotUsername, greeting, jsonData, reportFilename, idTest, timeStart, today, testerName);
      await telegramPlatform.disconnect();

    } else if (platform === 'instagram') {
      const targetUsername = process.env.TARGET_USERNAME;
      if (!targetUsername) {
        console.error("Error: TARGET_USERNAME tidak diatur untuk platform 'instagram'.");
        Modul.testDone('Test Failed!');
        return;
      }

      console.log(`Target User Instagram: @${targetUsername}\n`);
      const { browser, page } = await Modul.readBrowser('https://www.instagram.com', 'chromium');
      const instagramPlatform = new InstagramPlatform();
      await instagramPlatform.initialize(page);
      await instagramPlatform.actions(targetUsername, greeting, jsonData, reportFilename, idTest, timeStart, today, testerName);
      await Modul.closeBrowser(browser);

    } else if (platform === 'facebook') {
      const targetFanpageId = process.env.TARGET_FANPAGE_ID;
      if (!targetFanpageId) {
        console.error("Error: TARGET_FANPAGE_ID tidak diatur untuk platform 'facebook'.");
        Modul.testDone('Test Failed!');
        return;
      }

      console.log(`Target Fanpage ID: ${targetFanpageId}\n`);
      const { browser, page } = await Modul.readBrowser('https://www.facebook.com', 'chromium');
      const facebookPlatform = new FacebookPlatform();
      await facebookPlatform.initialize(page);
      await facebookPlatform.actions(targetFanpageId, greeting, jsonData, reportFilename, idTest, timeStart, today, testerName);
      await Modul.closeBrowser(browser);

    } else if (platform === 'dhai') {
      const url = process.env.DHAI_TARGET_URL;
      if (!url) {
        console.error("Error: DHAI_TARGET_URL tidak diatur untuk platform 'dhai'.");
        Modul.testDone('Test Failed!');
        return;
      }

      console.log(`URL Pengujian: ${url}\n`);
      // Show browser for DHAI with optimized viewport (1280x720)
      const headlessMode = false; // Set to true for headless, false to see browser
      const dhaiViewport = { width: 1280, height: 720 };
      const { browser, page, title, browserName } = await Modul.readBrowser(url, 'chromium', headlessMode, dhaiViewport);
      await DhaiPlatform.actions(page, jsonData, reportFilename, idTest, timeStart, today, testerName, url, title, browserName);
      await Modul.closeBrowser(browser);

    }
    // Temporarily commented - dhai-wakeup file missing
    // else if (platform === 'dhai-wakeup') {
    //   const url = process.env.DHAI_WAKEUP_URL || process.env.DHAI_TARGET_URL;
    //   if (!url) {
    //     console.error("Error: DHAI_WAKEUP_URL atau DHAI_TARGET_URL tidak diatur untuk platform 'dhai-wakeup'.");
    //     Modul.testDone('Test Failed!');
    //     return;
    //   }

    //   const wakeWord = process.env.DHAI_WAKE_WORD || 'halo luna';
    //   console.log(`URL Pengujian: ${url}`);
    //   console.log(`Wake Word: "${wakeWord}"\n`);

    //   // Show browser for DHAI Wake-up Word with optimized viewport (1280x720)
    //   const headlessMode = false; // Set to true for headless, false to see browser
    //   const dhaiViewport = { width: 1280, height: 720 }; // Optimized for DHAI avatar display
    //   const { browser, page, title, browserName } = await Modul.readBrowser(url, 'chromium', headlessMode, dhaiViewport);
    //   await DhaiWakeupPlatform.actions(page, jsonData, reportFilename, idTest, timeStart, today, testerName, url, title, browserName, wakeWord);
    //   await Modul.closeBrowser(browser);
    // } 
    else {
      console.error(`Error: Platform '${platform}' tidak didukung.`);
      Modul.testDone('Test Failed!');
      return;
    }

  } catch (error) {
    console.error('Error during execution:', error);
    Modul.testDone('Test Failed!');
  } finally {
    const endDurationMeasurement = Modul.endTime(startDurationMeasurement);
    const { today: todayEnd, time: timeEnd } = Modul.todays();
    console.log(`End Time : ${timeEnd}\nDuration : ${endDurationMeasurement}\n`);

    // Generate HTML and Excel reports even if test failed (if data exists)
    try {
      if (reportFilename && idTest) {
        console.log('📊 Generating HTML report...');
        EnvFile.generateHtmlReport(reportFilename, idTest);
        
        console.log('📊 Generating Excel report...');
        const { generateExcelReport } = await import('./utils/excel-report-generator');
        generateExcelReport(reportFilename, idTest);
      }
    } catch (reportError) {
      console.error('⚠️ Failed to generate reports:', reportError);
    }

    Modul.testDone('Test Done!');
    console.log('Terima kasih, semoga harimu menyenangkan! 😎\n');
  }
}

main().catch(console.error);
