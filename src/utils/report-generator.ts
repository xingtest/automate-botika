import * as fs from 'fs';
import * as path from 'path';
import * as ejs from 'ejs';

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

function findLatestTestFiles(): { jsonFile: string | null; summaryFile: string | null; chartFile: string | null } {
  const jsonDir = 'report/json';
  
  if (!fs.existsSync(jsonDir)) {
    return { jsonFile: null, summaryFile: null, chartFile: null };
  }

  const files = fs.readdirSync(jsonDir)
    .filter(f => f.endsWith('.json') && !f.endsWith('-summary.json') && !f.endsWith('-chart.json'));

  if (files.length === 0) {
    return { jsonFile: null, summaryFile: null, chartFile: null };
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
  const chartFile = `${baseName}-chart.json`;

  return { jsonFile: latestFile, summaryFile, chartFile };
}

function createTestFolder(baseName: string): { testFolder: string; screenshotsFolder: string } {
  const testFolder = path.join('report', 'html', baseName);
  const screenshotsFolder = path.join(testFolder, 'screenshots');

  if (!fs.existsSync(testFolder)) {
    fs.mkdirSync(testFolder, { recursive: true });
  }

  if (!fs.existsSync(screenshotsFolder)) {
    fs.mkdirSync(screenshotsFolder, { recursive: true });
  }

  return { testFolder, screenshotsFolder };
}

/* moveScreenshots removed - screenshots are written directly to each report's screenshots folder in real time */


function calculateTotalDuration(testData: TestData[]): string {
  let totalSeconds = 0;

  for (const item of testData) {
    const durationStr = item.duration || '00:00:00';
    if (durationStr.includes(':')) {
      const parts = durationStr.split(':');
      if (parts.length === 3) {
        const hours = parseInt(parts[0]);
        const minutes = parseInt(parts[1]);
        const seconds = parseInt(parts[2]);
        totalSeconds += (hours * 3600) + (minutes * 60) + seconds;
      } else if (parts.length === 2) {
        const minutes = parseInt(parts[0]);
        const seconds = parseInt(parts[1]);
        totalSeconds += (minutes * 60) + seconds;
      }
    }
  }

  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
}

function renderTemplate(templatePath: string, data: any): string {
  const template = fs.readFileSync(templatePath, 'utf-8');
  return ejs.render(template, data);
}

export async function generateReportFromLatestTest(openInBrowser: boolean = false): Promise<string | null> {
  const { jsonFile, summaryFile, chartFile } = findLatestTestFiles();

  if (!jsonFile) {
    console.log('❌ No test files found in report/json directory');
    return null;
  }

  const jsonPath = path.join('report/json', jsonFile);
  const summaryPath = path.join('report/json', summaryFile!);
  const chartPath = path.join('report/json', chartFile!);

  console.log(`📊 Using test data: ${jsonFile}`);

  try {
    // Load test data
    const testData: TestData[] = JSON.parse(fs.readFileSync(jsonPath, 'utf-8'));

    // Load summary data
    let summaryData: any = {};
    if (fs.existsSync(summaryPath)) {
      summaryData = JSON.parse(fs.readFileSync(summaryPath, 'utf-8'));
    } else {
      console.log(`⚠️ Summary file not found: ${summaryFile}`);
    }

    // Load or create chart data
    let chartData: any[] = [];
    if (fs.existsSync(chartPath)) {
      chartData = JSON.parse(fs.readFileSync(chartPath, 'utf-8'));
    } else {
      console.log(`⚠️ Chart file not found, creating from test data`);
      chartData = testData.map(item => ({
        [item.title || 'Unknown']: item.duration || '00:00:00'
      }));
    }

    // Calculate summary statistics
    const totalTests = testData.length;
    const passedTests = testData.filter(item => item.status?.toUpperCase() === 'PASS').length;
    const failedTests = totalTests - passedTests;
    const totalDuration = calculateTotalDuration(testData);

    // Prepare summary data
    const summary: SummaryData = {
      id_test: summaryData.id_test || 'N/A',
      tester_name: summaryData.tester_name || 'N/A',
      date_test: summaryData.date_test || 'N/A',
      start_time_test: summaryData.start_time_test || 'N/A',
      end_time_test: new Date().toTimeString().split(' ')[0].replace(/:/g, '.'),
      ai_evaluation: summaryData.ai_evaluation || 'Playwright TypeScript',
      browser_name: summaryData.browser_name || 'N/A',
      url: summaryData.url || 'N/A',
      page_name: summaryData.page_name || 'N/A',
      total_title: totalTests,
      total_question: totalTests,
      success: passedTests,
      failed: failedTests,
      duration: totalDuration
    };

    // Create test folder
    const baseName = jsonFile.replace('.json', '');
    const { testFolder, screenshotsFolder } = createTestFolder(baseName);

    // Prepare test data with correct screenshot paths (screenshots are stored in testFolder/screenshots)
    const testDataForTemplate = testData.map(item => {
      let screenshotPath = '';
      if (item.image_capture) {
        const screenshotName = item.image_capture;
        const candidate = path.join(screenshotsFolder, screenshotName);
        if (fs.existsSync(candidate)) {
          screenshotPath = `screenshots/${screenshotName}`;
        } else {
          // If not found, leave empty (template will show no image)
          console.log(`⚠️ Screenshot not found for report: ${candidate}`);
        }
      }

      return {
        title: item.title || '',
        question: item.question || '',
        response_kb: item.response_kb || '',
        response_llm: item.response_llm || '',
        explanation: item.explanation || '',
        image_capture: screenshotPath,
        skor: item.skor || 0,
        status: (item.status || '').toUpperCase(),
        duration: item.duration || ''
      };
    });

    // Render template
    const templatePath = path.join('report', 'template', 'template.ejs');
    const htmlOutput = renderTemplate(templatePath, {
      summary: [summary],
      chart: chartData,
      test_data: testDataForTemplate
    });

    // Save HTML file
    const outputFile = path.join(testFolder, 'dashboard.html');
    fs.writeFileSync(outputFile, htmlOutput, 'utf-8');

    // Create test info file
    const summaryInfo = {
      test_id: summary.id_test,
      tester_name: summary.tester_name,
      date_test: summary.date_test,
      platform: 'webchat',
      total_questions: testData.length,
      folder_path: testFolder
    };

    const summaryFilePath = path.join(testFolder, 'test_info.json');
    fs.writeFileSync(summaryFilePath, JSON.stringify(summaryInfo, null, 2), 'utf-8');

    console.log(`✅ Test folder created: ${testFolder}`);
    console.log(`📁 HTML report: ${outputFile}`);
    
  console.log(`📋 Test info: ${summaryFilePath}`);

    // Open in browser if requested
    if (openInBrowser) {
      const { exec } = require('child_process');
      const absolutePath = path.resolve(outputFile);
      exec(`start "" "${absolutePath}"`, (error: any) => {
        if (error) {
          console.log(`⚠️ Could not open browser: ${error.message}`);
        } else {
          console.log(`🌐 Report opened in browser`);
        }
      });
    }

    return outputFile;
  } catch (error) {
    console.log(`❌ Error generating report: ${error}`);
    return null;
  }
}
