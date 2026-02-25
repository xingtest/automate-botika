import * as path from 'path';
import { EnvFile } from '../utils/envfile';
import { log } from '../utils/logger';
import { TestTracker } from '../utils/test-tracker';

export async function generateReports(reportFilename: string, idTest: string): Promise<void> {
  const incrementalExcel = process.env.INCREMENTAL_EXCEL === 'true';

  console.log('📊 Generating HTML report...');
  log.info('Generating HTML report');
  EnvFile.generateHtmlReport(reportFilename, idTest);

  console.log('📊 Generating Excel report...');
  log.info('Generating Excel report', { incrementalExcel });

  const { generateExcelReport, generateExcelReportIncremental } = await import('../utils/excel-report-generator');
  if (incrementalExcel) {
    generateExcelReportIncremental(reportFilename, idTest);
  } else {
    generateExcelReport(reportFilename, idTest);
  }
}

export function persistTrackerResults(testTracker: TestTracker, reportFilename: string, idTest: string): string {
  const summaryPath = path.join('report', 'json', `${reportFilename}-${idTest}-summary.json`);
  testTracker.saveResults(summaryPath);
  return summaryPath;
}

export function printTestSummary(testTracker: TestTracker): void {
  testTracker.printSummary();
}
