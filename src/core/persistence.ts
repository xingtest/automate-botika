import * as fs from 'fs';
import { ArtifactHelper } from '../utils/artifact-helper';
import { log } from '../utils/logger';

interface SummaryPayload {
  summary: {
    user_id: number | null;
    id_test: string;
    run_title: string;
    platform: string;
    tester_name: string;
    filename: string;
    ai_evaluation: string;
    url: string;
    page_name: string;
    browser_name: string;
    date_test: string;
    start_time_test: string;
    end_time_test: string;
    duration: string;
    total_title: number;
    total_question: number;
    success: number;
    failed: number;
    avg_score: number;
  };
  results: unknown[];
}

export function mapSummaryToDbPayload(data: any, argv: string[] = process.argv): SummaryPayload {
  return {
    summary: {
      user_id: process.env.USER_ID ? parseInt(process.env.USER_ID, 10) : null,
      id_test: data.id_test,
      run_title: process.env.RUN_NAME || '',
      platform: data.summary?.platform || (argv[2] || process.env.PLATFORM || '').toLowerCase(),
      tester_name: data.tester_name,
      filename: data.summary?.filename || process.env.FILENAME || '',
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
}

export async function pushToDatabase(summaryPath: string): Promise<number | null> {
  try {
    const backendUrl = process.env.BACKEND_URL || 'http://localhost:3001';
    const apiUrl = `${backendUrl}/api/test-runs`;

    if (!fs.existsSync(summaryPath)) {
      log.warn(`Cannot push to DB: Summary file not found at ${summaryPath}`);
      return null;
    }

    const fileContent = fs.readFileSync(summaryPath, 'utf-8');
    const data = JSON.parse(fileContent);
    const payload = mapSummaryToDbPayload(data);

    console.log(`\n📤 Sending results to database (${backendUrl})...`);
    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      console.warn(`⚠️ Failed to sync results to database: HTTP ${response.status}`);
      log.warn(`Database sync failed with status ${response.status}`);
      return null;
    }

    const result: any = await response.json();
    console.log(`✅ Results successfully synced to MySQL (ID: ${result.id})`);
    log.info(`Results synced to database with ID: ${result.id}`);
    return result.id;
  } catch (error: any) {
    console.warn(`⚠️ Database sync error: ${error.message}`);
    log.error('Error pushing to database', error);
    return null;
  }
}

export async function uploadArtifacts(runId: number, reportFilename: string, idTest: string): Promise<void> {
  const backendUrl = process.env.BACKEND_URL || 'http://localhost:3001';
  await ArtifactHelper.uploadTestArtifacts(backendUrl, runId, reportFilename, idTest);
}
