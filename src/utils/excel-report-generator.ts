import * as fs from 'fs';
import * as path from 'path';
import * as XLSX from 'xlsx';

interface TestData {
  title: string;
  question: string;
  response_kb: string;
  response_llm: string;
  explanation: string;
  image_capture: string;
  skor: number;
  status: string;
  duration: string;
}

interface SummaryData {
  id_test: string;
  tester_name: string;
  date_test: string;
  start_time_test: string;
  end_time_test: string;
  ai_evaluation: string;
  browser_name: string;
  url: string;
  page_name: string;
  total_title: number;
  total_question: number;
  success: number;
  failed: number;
  duration: string;
}

const PASS_THRESHOLD = 0.7;

function findLatestTestFiles(): { jsonFile: string | null; summaryFile: string | null } {
  const jsonDir = 'report/json';
  
  if (!fs.existsSync(jsonDir)) {
    return { jsonFile: null, summaryFile: null };
  }

  const files = fs.readdirSync(jsonDir)
    .filter(f => f.endsWith('.json') && !f.endsWith('-summary.json') && !f.endsWith('-chart.json'));

  if (files.length === 0) {
    return { jsonFile: null, summaryFile: null };
  }

  // Sort by modification time
  files.sort((a, b) => {
    const statA = fs.statSync(path.join(jsonDir, a));
    const statB = fs.statSync(path.join(jsonDir, b));
    return statB.mtimeMs - statA.mtimeMs;
  });

  const latestFile = files[0];
  const baseName = latestFile.replace('.json', '');
  const summaryFile = `${baseName}-summary.json`;

  return { jsonFile: latestFile, summaryFile };
}

export function generateExcelReportIncremental(reportFilename: string, idTest: string): string | null {
  try {
    const reportDir = path.join('report', 'json');
    const htmlDir = path.join('report', 'html');
    
    // Read JSON data files
    const botDataPath = path.join(reportDir, `${reportFilename}-${idTest}.json`);
    const summaryDataPath = path.join(reportDir, `${reportFilename}-${idTest}-summary.json`);

    if (!fs.existsSync(botDataPath)) {
      return null; // Silent fail for incremental
    }

    const testData: TestData[] = JSON.parse(fs.readFileSync(botDataPath, 'utf-8'));
    
    let summaryData: SummaryData | null = null;
    if (fs.existsSync(summaryDataPath)) {
      summaryData = JSON.parse(fs.readFileSync(summaryDataPath, 'utf-8'));
    }

    // Calculate evaluation summary
    const totalTests = testData.length;
    const passedTests = testData.filter(item => item.skor >= PASS_THRESHOLD).length;
    const failedTests = totalTests - passedTests;
    const avgScore = totalTests > 0 ? (testData.reduce((sum, item) => sum + item.skor, 0) / totalTests) : 0;

    // Create workbook
    const workbook = XLSX.utils.book_new();

    // Sheet 1: Summary with Evaluation
    const summarySheet = [
      ['Test Report Summary'],
      [],
      ['Test ID', summaryData?.id_test || idTest],
      ['Tester Name', summaryData?.tester_name || 'In Progress...'],
      ['Date', summaryData?.date_test || new Date().toLocaleDateString()],
      ['Start Time', summaryData?.start_time_test || 'N/A'],
      ['End Time', summaryData?.end_time_test || 'In Progress...'],
      ['Duration', summaryData?.duration || 'In Progress...'],
      ['Platform', summaryData?.ai_evaluation || 'N/A'],
      ['Browser', summaryData?.browser_name || 'N/A'],
      ['URL', summaryData?.url || 'N/A'],
      [],
      ['Evaluation Summary'],
      ['Total Questions', totalTests],
      ['Passed (≥0.7)', passedTests],
      ['Failed (<0.7)', failedTests],
      ['Success Rate', `${((passedTests / totalTests) * 100).toFixed(2)}%`],
      ['Average Score', avgScore.toFixed(3)],
      ['Pass Threshold', PASS_THRESHOLD]
    ];

    const ws1 = XLSX.utils.aoa_to_sheet(summarySheet);
    ws1['!cols'] = [{ wch: 20 }, { wch: 50 }];
    XLSX.utils.book_append_sheet(workbook, ws1, 'Summary');

    // Sheet 2: Test Results
    const testResultsData = testData.map((item, index) => ({
      'No': index + 1,
      'Title': item.title,
      'Question': item.question,
      'Expected Response (KB)': item.response_kb,
      'Actual Response (LLM)': item.response_llm,
      'Explanation': item.explanation,
      'Score': item.skor,
      'Status': item.skor >= PASS_THRESHOLD ? 'pass' : 'failed',
      'Duration': item.duration,
      'Screenshot': item.image_capture || 'N/A'
    }));

    const ws2 = XLSX.utils.json_to_sheet(testResultsData);
    ws2['!cols'] = [
      { wch: 5 }, { wch: 30 }, { wch: 40 }, { wch: 40 }, 
      { wch: 40 }, { wch: 50 }, { wch: 10 }, { wch: 10 }, 
      { wch: 12 }, { wch: 30 }
    ];
    XLSX.utils.book_append_sheet(workbook, ws2, 'Test Results');

    // Sheet 3: Statistics
    const statsData = [
      { 'Status': 'PASS (≥0.7)', 'Count': passedTests, 'Percentage': `${((passedTests / totalTests) * 100).toFixed(2)}%` },
      { 'Status': 'FAILED (<0.7)', 'Count': failedTests, 'Percentage': `${((failedTests / totalTests) * 100).toFixed(2)}%` },
      { 'Status': 'TOTAL', 'Count': totalTests, 'Percentage': '100%' }
    ];

    const ws3 = XLSX.utils.json_to_sheet(statsData);
    ws3['!cols'] = [{ wch: 20 }, { wch: 10 }, { wch: 15 }];
    XLSX.utils.book_append_sheet(workbook, ws3, 'Statistics');

    // Save to report/html folder (same as HTML report)
    const reportFolderPath = path.join(htmlDir, `${reportFilename}-${idTest}`);
    if (!fs.existsSync(reportFolderPath)) {
      fs.mkdirSync(reportFolderPath, { recursive: true });
    }

    const excelFilePath = path.join(reportFolderPath, 'report.xlsx');
    XLSX.writeFile(workbook, excelFilePath);

    return excelFilePath;

  } catch (error) {
    return null; // Silent fail for incremental
  }
}

export function generateExcelReport(reportFilename: string, idTest: string): string | null {
  const result = generateExcelReportIncremental(reportFilename, idTest);
  if (result) {
    console.log(`📊 Excel report generated: ${result}`);
  }
  return result;
}

export async function generateExcelReportFromLatest(): Promise<string | null> {
  const { jsonFile, summaryFile } = findLatestTestFiles();

  if (!jsonFile) {
    console.log('❌ No test files found in report/json directory');
    return null;
  }

  console.log(`📊 Using test data: ${jsonFile}`);

  // Extract reportFilename and idTest from filename
  // Format: reportFilename-idTest.json
  const baseName = jsonFile.replace('.json', '');
  const lastDashIndex = baseName.lastIndexOf('-');
  
  if (lastDashIndex === -1) {
    console.log('❌ Invalid filename format');
    return null;
  }

  const reportFilename = baseName.substring(0, lastDashIndex);
  const idTest = baseName.substring(lastDashIndex + 1);

  return generateExcelReport(reportFilename, idTest);
}
