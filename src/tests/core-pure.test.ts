import test from 'node:test';
import assert from 'node:assert/strict';
import { formatReportFilename } from '../core/config';
import { mapSummaryToDbPayload } from '../core/persistence';

test('formatReportFilename formats tester/platform/date consistently', () => {
  const fixedDate = new Date('2025-01-02T03:04:05.000Z');
  const filename = formatReportFilename('QA Engineer', 'telegram', fixedDate);
  assert.equal(filename, 'QA_Engineer_telegram_2025-01-02_03-04-05');
});

test('mapSummaryToDbPayload maps fallback fields for DB API', () => {
  const prevUserId = process.env.USER_ID;
  const prevRunName = process.env.RUN_NAME;
  const prevFilename = process.env.FILENAME;
  const prevPlatform = process.env.PLATFORM;

  process.env.USER_ID = '123';
  process.env.RUN_NAME = 'Nightly Run';
  process.env.FILENAME = 'input.xlsx';
  process.env.PLATFORM = 'facebook';

  const payload = mapSummaryToDbPayload(
    {
      id_test: 'T-001',
      tester_name: 'Alice',
      ai_evaluation: 'good',
      url: 'https://example.com',
      page_name: 'Example',
      browser_name: 'chromium',
      date_test: '2025-01-02',
      start_time_test: '10:00:00',
      duration: '1m',
      total_title: 10,
      success: 8,
      failed: 2,
      results: [{ id: 1 }],
      summary: {
        totalTests: 10,
        platform: 'telegram',
        averageScore: 87,
        passed: 8,
        failed: 2,
        filename: 'source.csv',
        totalDuration: '1m'
      }
    },
    ['node', 'dist/main.js', 'instagram']
  );

  assert.equal(payload.summary.user_id, 123);
  assert.equal(payload.summary.run_title, 'Nightly Run');
  assert.equal(payload.summary.platform, 'telegram');
  assert.equal(payload.summary.filename, 'source.csv');
  assert.equal(payload.summary.total_question, 10);
  assert.equal(payload.summary.success, 8);
  assert.equal(payload.summary.failed, 2);
  assert.equal(payload.summary.avg_score, 87);
  assert.deepEqual(payload.results, [{ id: 1 }]);

  if (prevUserId === undefined) delete process.env.USER_ID; else process.env.USER_ID = prevUserId;
  if (prevRunName === undefined) delete process.env.RUN_NAME; else process.env.RUN_NAME = prevRunName;
  if (prevFilename === undefined) delete process.env.FILENAME; else process.env.FILENAME = prevFilename;
  if (prevPlatform === undefined) delete process.env.PLATFORM; else process.env.PLATFORM = prevPlatform;
});
