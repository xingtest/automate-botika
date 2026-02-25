import { Modul } from './utils/modul';
import { log } from './utils/logger';
import { TestTracker } from './utils/test-tracker';
import {
  cleanupPreviousReport,
  createExecutionContext,
  formatReportFilename,
  getValidatedConfig,
  initializeEnv,
  loadTestData,
  type BotData,
  type SummaryData,
  type TestData
} from './core/config';
import { runPlatform } from './core/platform-runner';
import { generateReports, persistTrackerResults, printTestSummary } from './core/reporting';
import { pushToDatabase, uploadArtifacts } from './core/persistence';

export type { TestData, BotData, SummaryData };

initializeEnv();

async function main(): Promise<void> {
  Modul.initialize('Initialize ...');
  const { today, time: timeStart } = Modul.todays();
  const startDurationMeasurement = Modul.startTime();
  const idTest = Modul.idTest();

  log.info(`Test ID: ${idTest}`);
  log.info(`Date: ${today}`);
  log.info(`Start Time: ${timeStart}`);
  console.log(`Test ID : ${idTest}\nDay : ${today}\nStart Time : ${timeStart}\n`);

  const testTracker = new TestTracker();
  let reportFilename = '';

  try {
    const config = getValidatedConfig();
    reportFilename = formatReportFilename(config.testerName, config.platform);

    const context = createExecutionContext(reportFilename, idTest);
    console.log(`Created report folder: ${context.testFolder}`);
    console.log(`Created screenshots folder: ${context.screenshotsFolder}`);

    Modul.showLoading('Membersihkan file laporan lama...');
    cleanupPreviousReport(reportFilename, idTest);
    Modul.setupLogging(reportFilename, idTest);

    console.log(`Platform Pengujian: ${config.platform.charAt(0).toUpperCase() + config.platform.slice(1)}`);
    if (config.platform === 'dhai') {
      console.log(`DHAI Capture Q&A Media: ${config.dhaiCaptureQaMedia}`);
      console.log(`DHAI Capture Mode: ${config.dhaiCaptureMode}`);
      console.log(`DHAI Capture Max Seconds: ${config.dhaiCaptureMaxSeconds}`);
    }
    console.log(`Greeting: ${config.greeting}\n`);
    console.log(`File Uji yang Digunakan: ${config.filename}\n`);
    console.log(`Tester: ${config.testerName}\n`);

    const jsonData = loadTestData(config.filename);
    if (!jsonData || jsonData.length === 0) {
      throw new Error('Tidak ada data yang dapat dibaca dari file.');
    }

    await runPlatform({
      config,
      testData: jsonData,
      reportFilename,
      idTest,
      timeStart,
      today,
      screenshotsFolder: context.screenshotsFolder
    });
  } catch (error) {
    log.error('Error during execution', error);
    console.error('Error during execution:', error);
    Modul.testDone('Test Failed!');
  } finally {
    const endDurationMeasurement = Modul.endTime(startDurationMeasurement);
    const { time: timeEnd } = Modul.todays();
    console.log(`End Time : ${timeEnd}\nDuration : ${endDurationMeasurement}\n`);
    log.info(`Test completed - Duration: ${endDurationMeasurement}`);

    try {
      if (reportFilename && idTest) {
        await generateReports(reportFilename, idTest);
      }
    } catch (reportError) {
      log.error('Failed to generate reports', reportError);
      console.error('⚠️ Failed to generate reports:', reportError);
    }

    printTestSummary(testTracker);

    if (reportFilename && idTest) {
      const summaryPath = persistTrackerResults(testTracker, reportFilename, idTest);
      const runId = await pushToDatabase(summaryPath);

      if (runId) {
        console.log(`\n📁 Uploading test artifacts...`);
        await uploadArtifacts(runId, reportFilename, idTest);
      }
    }

    Modul.testDone('Test Done!');
    console.log('Terima kasih, semoga harimu menyenangkan! 😎\n');

    const exitCode = testTracker.getExitCode();
    if (exitCode !== 0) {
      log.warn(`Exiting with code ${exitCode} due to test failures`);
      console.log(`\n⚠️ Some tests failed. Exit code: ${exitCode}\n`);
    }
    process.exit(exitCode);
  }
}

main().catch(console.error);
