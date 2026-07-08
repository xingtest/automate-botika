import * as fs from 'fs';
import * as path from 'path';
// @ts-ignore
import * as XLSX from 'xlsx-js-style';
import { EVAL_CONFIG } from './ai-evaluator';

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

const PASS_THRESHOLD = EVAL_CONFIG.thresholds.good;

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
    const passedTests = testData.filter(item => {
      const status = item.status?.toLowerCase() || (item.skor >= PASS_THRESHOLD ? 'pass' : 'failed');
      return status === 'pass';
    }).length;
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
      [`Passed (≥${PASS_THRESHOLD})`, passedTests],
      [`Failed (<${PASS_THRESHOLD})`, failedTests],
      ['Success Rate', `${((passedTests / totalTests) * 100).toFixed(2)}%`],
      ['Average Score', avgScore.toFixed(3)],
      ['Pass Threshold', PASS_THRESHOLD]
    ];

    const ws1 = XLSX.utils.aoa_to_sheet(summarySheet);
    ws1['!cols'] = [{ wch: 25 }, { wch: 50 }];

    // Style Sheet 1
    if (ws1['A1']) {
      ws1['A1'].s = {
        font: { size: 16, bold: true, color: { rgb: '1F497D' } }
      };
    }
    for (let r = 3; r <= 11; r++) {
      if (ws1[`A${r}`]) ws1[`A${r}`].s = { font: { bold: true } };
    }
    if (ws1['A13']) {
      ws1['A13'].s = {
        font: { size: 13, bold: true, color: { rgb: '1F497D' } }
      };
    }
    for (let r = 14; r <= 19; r++) {
      if (ws1[`A${r}`]) ws1[`A${r}`].s = { font: { bold: true } };
    }

    XLSX.utils.book_append_sheet(workbook, ws1, 'Summary');

    // Sheet 2: Test Results
    const testResultsData = testData.map((item, index) => {
      const status = item.status?.toLowerCase() || (item.skor >= PASS_THRESHOLD ? 'pass' : 'failed');
      return {
        'No': index + 1,
        'Title': item.title,
        'Question': item.question,
        'Expected Response (KB)': item.response_kb,
        'Actual Response (LLM)': item.response_llm,
        'Explanation': item.explanation,
        'Score': item.skor,
        'Status': status,
        'Duration': item.duration,
        'Screenshot': item.image_capture || 'N/A'
      };
    });

    const ws2 = XLSX.utils.json_to_sheet(testResultsData);
    ws2['!cols'] = [
      { wch: 5 }, { wch: 30 }, { wch: 40 }, { wch: 40 }, 
      { wch: 40 }, { wch: 50 }, { wch: 10 }, { wch: 10 }, 
      { wch: 12 }, { wch: 30 }
    ];

    // Style Sheet 2 Headers
    const cols = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J'];
    for (const col of cols) {
      const headerCell = ws2[`${col}1`];
      if (headerCell) {
        headerCell.s = {
          fill: { patternType: 'solid', fgColor: { rgb: '1F497D' } },
          font: { color: { rgb: 'FFFFFF' }, bold: true },
          alignment: { horizontal: 'center', vertical: 'center' }
        };
      }
    }

    // Style Sheet 2 Rows
    for (let r = 2; r <= testResultsData.length + 1; r++) {
      // Style Column E (Actual Response) if "No response captured"
      const cellKey = `E${r}`;
      const cell = ws2[cellKey];
      if (cell && cell.v === 'No response captured') {
        cell.s = {
          fill: { patternType: 'solid', fgColor: { rgb: 'FFC7CE' } }, // Soft red background
          font: { color: { rgb: '9C0006' }, bold: true } // Dark red bold text
        };
      }

      // Style Column H (Status) for pass/failed status
      const statusKey = `H${r}`;
      const statusCell = ws2[statusKey];
      if (statusCell) {
        if (statusCell.v === 'failed') {
          statusCell.s = {
            fill: { patternType: 'solid', fgColor: { rgb: 'FFC7CE' } },
            font: { color: { rgb: '9C0006' }, bold: true }
          };
        } else if (statusCell.v === 'pass') {
          statusCell.s = {
            fill: { patternType: 'solid', fgColor: { rgb: 'C6EFCE' } }, // Soft green background
            font: { color: { rgb: '006100' }, bold: true } // Dark green bold text
          };
        }
      }
    }

    XLSX.utils.book_append_sheet(workbook, ws2, 'Test Results');

    // Sheet 3: Statistics
    const statsData = [
      { 'Status': `PASS (≥${PASS_THRESHOLD})`, 'Count': passedTests, 'Percentage': `${((passedTests / totalTests) * 100).toFixed(2)}%` },
      { 'Status': `FAILED (<${PASS_THRESHOLD})`, 'Count': failedTests, 'Percentage': `${((failedTests / totalTests) * 100).toFixed(2)}%` },
      { 'Status': 'TOTAL', 'Count': totalTests, 'Percentage': '100%' }
    ];

    const ws3 = XLSX.utils.json_to_sheet(statsData);
    ws3['!cols'] = [{ wch: 20 }, { wch: 10 }, { wch: 15 }];

    // Style Sheet 3 Headers
    const statCols = ['A', 'B', 'C'];
    for (const col of statCols) {
      const headerCell = ws3[`${col}1`];
      if (headerCell) {
        headerCell.s = {
          fill: { patternType: 'solid', fgColor: { rgb: '1F497D' } },
          font: { color: { rgb: 'FFFFFF' }, bold: true },
          alignment: { horizontal: 'center', vertical: 'center' }
        };
      }
    }

    // Style Sheet 3 Rows
    if (ws3['A2']) ws3['A2'].s = { font: { color: { rgb: '006100' }, bold: true } };
    if (ws3['A3']) ws3['A3'].s = { font: { color: { rgb: '9C0006' }, bold: true } };
    if (ws3['A4']) ws3['A4'].s = { font: { bold: true } };

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
