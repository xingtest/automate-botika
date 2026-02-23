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

import { log } from './utils/logger';
import { TestTracker } from './utils/test-tracker';
import { ArtifactHelper } from './utils/artifact-helper';

// ============================================
// Type Definitions (exported for other modules)
// ============================================

export interface TestData {
  no: string;
  title: string;
  [key: string]: string;
}

export interface BotData {
  no: string;
  title: string;
  question: string;
  response_kb: string;
  response_llm: string;
  status: string;
  duration: string;
  image_capture: string | null;
  skor: number;
  explanation: string;
}

export interface SummaryData {
  id_test: string;
  tester_name: string;
  ai_evaluation: string;
  url: string;
  page_name: string;
  browser_name: string;
  date_test: string;
  start_time_test: string;
  end_time_test?: string;
  duration?: string;
  total_title: number;
  total_question: number;
  success: number;
  failed: number;
}

export interface PlatformConfig {
  platform: string;
  filename: string;
  testerName: string;
  greeting: string;
  targetUrl?: string;
  targetBotUsername?: string;
  targetUsername?: string;
  targetFanpageId?: string;
  dhaiTargetUrl?: string;
}

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

  log.info(`Test ID: ${idTest}`);
  log.info(`Date: ${today}`);
  log.info(`Start Time: ${timeStart}`);
  console.log(`Test ID : ${idTest}\nDay : ${today}\nStart Time : ${timeStart}\n`);

  // Initialize test tracker
  const testTracker = new TestTracker();

  // Declare reportFilename outside try block so it's accessible in finally
  let reportFilename = '';

  try {
    // Prefer CLI argument (e.g. `node dist/main.js instagram`) over .env
    const cliPlatform = process.argv[2] || '';
    const platform = (cliPlatform || process.env.PLATFORM || '').toLowerCase();
    if (!platform) {
      log.error("Environment variable 'PLATFORM' tidak diatur");
      console.error("Error: Environment variable 'PLATFORM' tidak diatur.");
      Modul.testDone('Test Failed!');
      process.exit(1);
    }

    const filenameWithExt = process.env.FILENAME;
    const testerName = process.env.TESTER_NAME || 'Nama Penguji Baru';
    const greeting = process.env.GREETING || 'Halo';

    const now = new Date();
    const dateStr = now.toISOString().split('T')[0].replace(/-/g, '-');
    const timeStr = now.toTimeString().split(' ')[0].replace(/:/g, '-');
    const testerNameClean = testerName.replace(/\s+/g, '_');
    reportFilename = `${testerNameClean}_${platform}_${dateStr}_${timeStr}`;

    // Create test folder and screenshots folder directly (include idTest so names match report json)
    const fullReportFolderName = `${reportFilename}-${idTest}`;
    const testFolder = path.join('report', 'html', fullReportFolderName);
    const screenshotsFolder = path.join(testFolder, 'screenshots');

    if (!fs.existsSync(testFolder)) {
      fs.mkdirSync(testFolder, { recursive: true });
    }
    if (!fs.existsSync(screenshotsFolder)) {
      fs.mkdirSync(screenshotsFolder, { recursive: true });
    }
    console.log(`Created report folder: ${testFolder}`);
    console.log(`Created screenshots folder: ${screenshotsFolder}`);

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
      const webchatName = process.env.WEBCHAT_NAME || 'Tester';
      const webchatEmail = process.env.WEBCHAT_EMAIL || 'tester@example.com';
      const webchatPhone = process.env.WEBCHAT_PHONE || '081234567890';
      await WebchatPlatform.prechatForm(page, greeting, webchatName, webchatEmail, webchatPhone);
      await WebchatPlatform.actions(page, jsonData, reportFilename, idTest, timeStart, today, testerName, url, title, browserName, screenshotsFolder);
      await Modul.closeBrowser(browser);

    } else if (platform === 'telegram') {
      const targetBotUsername = process.env.TARGET_BOT_USERNAME;
      const apiId = process.env.API_ID;
      const apiHash = process.env.API_HASH;
      const sessionString = process.env.TELEGRAM_SESSION; // Optional, will auto-generate if not provided

      if (!targetBotUsername || !apiId || !apiHash) {
        console.error('Error: Telegram credentials tidak lengkap. Pastikan TARGET_BOT_USERNAME, API_ID, dan API_HASH sudah diset di .env');
        Modul.testDone('Test Failed!');
        return;
      }

      console.log(`Target Bot Telegram: ${targetBotUsername}\n`);
      const telegramPlatform = new TelegramPlatform();
      await telegramPlatform.initialize(apiId, apiHash, sessionString);
      await telegramPlatform.actions(targetBotUsername, greeting, jsonData, reportFilename, idTest, timeStart, today, testerName, screenshotsFolder);
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
      await instagramPlatform.actions(targetUsername, greeting, jsonData, reportFilename, idTest, timeStart, today, testerName, screenshotsFolder);
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
      await facebookPlatform.actions(targetFanpageId, greeting, jsonData, reportFilename, idTest, timeStart, today, testerName, screenshotsFolder);
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
      // Check environment for HEADLESS mode (CI/CD usually sets this to true)
      const headlessMode = process.env.HEADLESS !== 'false'; // Defaults to true if not set
      const dhaiViewport = { width: 1280, height: 720 };
      const { browser, page, title, browserName } = await Modul.readBrowser(url, 'chromium', headlessMode, dhaiViewport);
      await DhaiPlatform.actions(page, jsonData, reportFilename, idTest, timeStart, today, testerName, url, title, browserName, screenshotsFolder);
      await Modul.closeBrowser(browser);

    }
    else {
      console.error(`Error: Platform '${platform}' tidak didukung.`);
      Modul.testDone('Test Failed!');
      return;
    }

  } catch (error) {
    log.error('Error during execution', error);
    console.error('Error during execution:', error);
    Modul.testDone('Test Failed!');
    process.exit(1);
  } finally {
    const endDurationMeasurement = Modul.endTime(startDurationMeasurement);
    const { today: todayEnd, time: timeEnd } = Modul.todays();
    console.log(`End Time : ${timeEnd}\nDuration : ${endDurationMeasurement}\n`);
    log.info(`Test completed - Duration: ${endDurationMeasurement}`);

    // Generate HTML and Excel reports even if test failed (if data exists)
    try {
      if (reportFilename && idTest) {
        console.log('📊 Generating HTML report...');
        log.info('Generating HTML report');
        EnvFile.generateHtmlReport(reportFilename, idTest);

        console.log('📊 Generating Excel report...');
        log.info('Generating Excel report');
        const { generateExcelReport } = await import('./utils/excel-report-generator');
        generateExcelReport(reportFilename, idTest);
      }
    } catch (reportError) {
      log.error('Failed to generate reports', reportError);
      console.error('⚠️ Failed to generate reports:', reportError);
    }

    // Print test summary
    testTracker.printSummary();

    // Save test results to JSON
    if (reportFilename && idTest) {
      const summaryPath = path.join('report', 'json', `${reportFilename}-${idTest}-summary.json`);
      testTracker.saveResults(summaryPath);

      // Push to MySQL Database and get run ID
      const runId = await pushToDatabase(summaryPath);

      // Upload artifacts to database
      if (runId) {
        console.log(`\n📁 Uploading test artifacts...`);
        const backendUrl = process.env.BACKEND_URL || 'http://localhost:3001';
        await ArtifactHelper.uploadTestArtifacts(backendUrl, runId, reportFilename, idTest);
      }
    }

    Modul.testDone('Test Done!');
    console.log('Terima kasih, semoga harimu menyenangkan! 😎\n');

    // Exit with appropriate code based on test results
    const exitCode = testTracker.getExitCode();
    if (exitCode !== 0) {
      log.warn(`Exiting with code ${exitCode} due to test failures`);
      console.log(`\n⚠️ Some tests failed. Exit code: ${exitCode}\n`);
    }
    process.exit(exitCode);
  }
}

/**
 * Push test results to the MySQL database via the Backend API
 */
async function pushToDatabase(summaryPath: string): Promise<number | null> {
  try {
    const backendUrl = process.env.BACKEND_URL || 'http://localhost:3001';
    const apiUrl = `${backendUrl}/api/test-runs`;

    if (!fs.existsSync(summaryPath)) {
      log.warn(`Cannot push to DB: Summary file not found at ${summaryPath}`);
      return null;
    }

    const fileContent = fs.readFileSync(summaryPath, 'utf-8');
    const data = JSON.parse(fileContent);

    // Prepare payload for the API
    const payload = {
      summary: {
        user_id: process.env.USER_ID ? parseInt(process.env.USER_ID) : null,
        id_test: data.id_test,
        platform: data.summary?.platform || (process.argv[2] || process.env.PLATFORM || '').toLowerCase(),
        tester_name: data.tester_name,
        filename: data.summary?.filename || process.env.FILENAME,
        ai_evaluation: data.ai_evaluation,
        url: data.url,
        page_name: data.page_name,
        browser_name: data.browser_name,
        date_test: data.date_test,
        start_time_test: data.start_time_test,
        end_time_test: data.summary?.end_time_test || new Date().toLocaleTimeString(),
        duration: data.summary?.totalDuration || data.duration,
        total_title: data.total_title,
        total_question: data.total_question || data.summary?.totalTests,
        success: data.summary?.passed || data.success,
        failed: data.summary?.failed || data.failed,
        avg_score: data.summary?.averageScore || 0
      },
      results: data.results || []
    };

    console.log(`\n📤 Sending results to database (${backendUrl})...`);
    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    if (response.ok) {
      const result: any = await response.json();
      console.log(`✅ Results successfully synced to MySQL (ID: ${result.id})`);
      log.info(`Results synced to database with ID: ${result.id}`);
      return result.id;
    } else {
      console.warn(`⚠️ Failed to sync results to database: HTTP ${response.status}`);
      log.warn(`Database sync failed with status ${response.status}`);
      return null;
    }
  } catch (error: any) {
    console.warn(`⚠️ Database sync error: ${error.message}`);
    log.error('Error pushing to database', error);
    return null;
  }
}

main().catch(console.error);
