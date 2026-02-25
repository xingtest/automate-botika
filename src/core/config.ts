import * as dotenv from 'dotenv';
import * as fs from 'fs';
import * as path from 'path';
import { EnvFile } from '../utils/envfile';

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
}

export interface ExecutionContext {
  reportFilename: string;
  idTest: string;
  testFolder: string;
  screenshotsFolder: string;
}

export function initializeEnv(): void {
  dotenv.config();
}

export function getValidatedConfig(argv: string[] = process.argv): PlatformConfig {
  const cliPlatform = argv[2] || '';
  const platform = (cliPlatform || process.env.PLATFORM || '').toLowerCase();

  if (!platform) {
    throw new Error("Environment variable 'PLATFORM' tidak diatur");
  }

  const filename = process.env.FILENAME;
  if (!filename) {
    throw new Error('Nama file data uji tidak ditemukan.');
  }

  return {
    platform,
    filename,
    testerName: process.env.TESTER_NAME || 'Nama Penguji Baru',
    greeting: process.env.GREETING || 'Halo'
  };
}

export function formatReportFilename(testerName: string, platform: string, now: Date = new Date()): string {
  const dateStr = now.toISOString().split('T')[0].replace(/-/g, '-');
  const timeStr = now.toTimeString().split(' ')[0].replace(/:/g, '-');
  const testerNameClean = testerName.replace(/\s+/g, '_');
  return `${testerNameClean}_${platform}_${dateStr}_${timeStr}`;
}

export function createExecutionContext(reportFilename: string, idTest: string): ExecutionContext {
  const fullReportFolderName = `${reportFilename}-${idTest}`;
  const testFolder = path.join('report', 'html', fullReportFolderName);
  const screenshotsFolder = path.join(testFolder, 'screenshots');

  if (!fs.existsSync(testFolder)) {
    fs.mkdirSync(testFolder, { recursive: true });
  }
  if (!fs.existsSync(screenshotsFolder)) {
    fs.mkdirSync(screenshotsFolder, { recursive: true });
  }

  return { reportFilename, idTest, testFolder, screenshotsFolder };
}

export function cleanupPreviousReport(reportFilename: string, idTest: string): void {
  const fullReportName = `${reportFilename}-${idTest}`;
  const reportFilePath = path.join('report', 'json', `${fullReportName}.json`);

  if (!fs.existsSync(reportFilePath)) {
    return;
  }

  fs.unlinkSync(reportFilePath);
}

export function loadTestData(filename: string): TestData[] {
  const ext = path.extname(filename).toLowerCase();

  if (ext === '.json') {
    const filePath = path.join('assets', 'json', filename);
    if (!fs.existsSync(filePath)) {
      throw new Error(`File not found: ${filePath}`);
    }
    return JSON.parse(fs.readFileSync(filePath, 'utf-8'));
  }

  if (ext === '.csv') {
    return EnvFile.convertCsvToJson(filename);
  }

  if (ext === '.xlsx' || ext === '.xls') {
    return EnvFile.convertExcelToJson(filename);
  }

  throw new Error(`Unsupported file format: ${ext}`);
}
