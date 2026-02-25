import * as fs from 'fs';
import * as path from 'path';
import { BotData, SummaryData } from '../main';
import { log } from './logger';

interface HtmlRenderState {
  writesSinceLastRender: number;
  lastRenderAt: number;
  timer: NodeJS.Timeout | null;
}

export class EnvFile {
  private static readonly HTML_RENDER_THROTTLE_MS = EnvFile.readPositiveIntEnv('INCREMENTAL_HTML_THROTTLE_MS', 4000);
  private static readonly HTML_RENDER_BATCH_SIZE = EnvFile.readPositiveIntEnv('INCREMENTAL_HTML_BATCH_SIZE', 5);
  private static readonly htmlRenderStates = new Map<string, HtmlRenderState>();

  private static readPositiveIntEnv(name: string, fallback: number): number {
    const rawValue = process.env[name];
    const parsedValue = Number.parseInt(rawValue || '', 10);

    if (Number.isFinite(parsedValue) && parsedValue > 0) {
      return parsedValue;
    }

    return fallback;
  }

  private static getHtmlRenderState(reportFilename: string, idTest: string): HtmlRenderState {
    const key = `${reportFilename}-${idTest}`;
    const existingState = this.htmlRenderStates.get(key);

    if (existingState) {
      return existingState;
    }

    const newState: HtmlRenderState = {
      writesSinceLastRender: 0,
      lastRenderAt: Date.now(),
      timer: null
    };

    this.htmlRenderStates.set(key, newState);
    return newState;
  }

  private static renderHtmlIncrementalNow(
    reportFilename: string,
    idTest: string,
    reason: 'batch' | 'timer',
    state: HtmlRenderState
  ): void {
    const now = Date.now();
    const elapsedMs = now - state.lastRenderAt;

    this.generateHtmlReportIncremental(reportFilename, idTest);

    log.debug('Incremental HTML render executed', {
      reportFilename,
      idTest,
      reason,
      writesSinceLastRender: state.writesSinceLastRender,
      elapsedMs,
      throttleMs: this.HTML_RENDER_THROTTLE_MS,
      batchSize: this.HTML_RENDER_BATCH_SIZE
    });

    state.writesSinceLastRender = 0;
    state.lastRenderAt = now;

    if (state.timer) {
      clearTimeout(state.timer);
      state.timer = null;
    }
  }

  private static scheduleIncrementalHtmlRender(reportFilename: string, idTest: string): void {
    const state = this.getHtmlRenderState(reportFilename, idTest);

    state.writesSinceLastRender += 1;

    if (state.writesSinceLastRender >= this.HTML_RENDER_BATCH_SIZE) {
      this.renderHtmlIncrementalNow(reportFilename, idTest, 'batch', state);
      return;
    }

    if (!state.timer) {
      state.timer = setTimeout(() => {
        const activeState = this.getHtmlRenderState(reportFilename, idTest);
        this.renderHtmlIncrementalNow(reportFilename, idTest, 'timer', activeState);
      }, this.HTML_RENDER_THROTTLE_MS);

      state.timer.unref?.();

      log.debug('Incremental HTML render scheduled', {
        reportFilename,
        idTest,
        writesSinceLastRender: state.writesSinceLastRender,
        throttleMs: this.HTML_RENDER_THROTTLE_MS,
        batchSize: this.HTML_RENDER_BATCH_SIZE
      });
    }
  }

  static writeJsonDataBot(data: BotData, reportFilename: string, idTest: string): void {
    const reportDir = path.join('report', 'json');
    if (!fs.existsSync(reportDir)) {
      fs.mkdirSync(reportDir, { recursive: true });
    }

    const filePath = path.join(reportDir, `${reportFilename}-${idTest}.json`);
    let existingData: BotData[] = [];

    if (fs.existsSync(filePath)) {
      const fileContent = fs.readFileSync(filePath, 'utf-8');
      existingData = JSON.parse(fileContent);
    }

    // Format skor to 3 decimal places
    const formattedData = {
      ...data,
      skor: parseFloat(data.skor.toFixed(3))
    };

    existingData.push(formattedData);
    fs.writeFileSync(filePath, JSON.stringify(existingData, null, 2));

    // Realtime update for HTML report only (throttled)
    try {
      this.scheduleIncrementalHtmlRender(reportFilename, idTest);
    } catch (error) {
      // Log the error but don't throw to avoid breaking the test flow
      console.error('❌ Error during incremental report generation:', error);
    }
  }

  static writeJsonDataSummary(data: SummaryData, reportFilename: string, idTest: string): void {
    const reportDir = path.join('report', 'json');
    if (!fs.existsSync(reportDir)) {
      fs.mkdirSync(reportDir, { recursive: true });
    }

    const filePath = path.join(reportDir, `${reportFilename}-${idTest}-summary.json`);
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
  }

  static writeJsonChart(chart: Record<string, string>, reportFilename: string, idTest: string): void {
    const reportDir = path.join('report', 'json');
    if (!fs.existsSync(reportDir)) {
      fs.mkdirSync(reportDir, { recursive: true });
    }

    const filePath = path.join(reportDir, `${reportFilename}-${idTest}-chart.json`);
    let existingData: Record<string, string> = {};

    if (fs.existsSync(filePath)) {
      const fileContent = fs.readFileSync(filePath, 'utf-8');
      existingData = JSON.parse(fileContent);
    }

    Object.assign(existingData, chart);
    fs.writeFileSync(filePath, JSON.stringify(existingData, null, 2));
  }

  static writeEndTimeSummary(timeEnd: string, duration: string, reportFilename: string, idTest: string): void {
    const reportDir = path.join('report', 'json');
    const filePath = path.join(reportDir, `${reportFilename}-${idTest}-summary.json`);

    if (fs.existsSync(filePath)) {
      const fileContent = fs.readFileSync(filePath, 'utf-8');
      const data = JSON.parse(fileContent);
      data.end_time_test = timeEnd;
      data.duration = duration;
      fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
    }
  }

  static convertExcelToJson(filename: string): any[] {
    try {
      const XLSX = require('xlsx');
      const filePath = path.join('assets', 'xlsx', filename);

      if (!fs.existsSync(filePath)) {
        console.log(`⚠️ Excel file not found: ${filePath}`);
        return [];
      }

      console.log(`📊 Reading Excel file: ${filename}`);

      // Read the Excel file
      const workbook = XLSX.readFile(filePath);

      // Get the first sheet name
      const sheetName = workbook.SheetNames[0];
      console.log(`📋 Reading sheet: ${sheetName}`);

      // Convert sheet to JSON
      const worksheet = workbook.Sheets[sheetName];
      const rawData = XLSX.utils.sheet_to_json(worksheet);

      // Normalize key names to lowercase
      const jsonData = rawData.map((row: any) => {
        const normalizedRow: any = {};
        Object.keys(row).forEach(key => {
          const normalizedKey = key.toLowerCase();
          normalizedRow[normalizedKey] = row[key];
        });
        return normalizedRow;
      });

      console.log(`✅ Successfully converted Excel to JSON: ${jsonData.length} rows`);
      console.log('📋 Sample data:', JSON.stringify(jsonData[0], null, 2));

      return jsonData;

    } catch (error) {
      console.error(`❌ Error reading Excel file ${filename}:`, error);
      console.log(`Please make sure the file exists at assets/xlsx/${filename}`);
      return [];
    }
  }

  static convertCsvToJson(filename: string): any[] {
    try {
      const csvPath = path.join('assets', 'csv', filename);

      if (!fs.existsSync(csvPath)) {
        console.log(`⚠️ CSV file not found: ${csvPath}`);
        return [];
      }

      const csvContent = fs.readFileSync(csvPath, 'utf-8');
      const lines = csvContent.trim().split('\n');

      if (lines.length < 2) {
        console.log(`⚠️ CSV file must have at least header and one data row`);
        return [];
      }

      // Parse header
      const headers = lines[0].split(',').map(h => h.trim());

      // Parse data rows
      const jsonData = [];
      for (let i = 1; i < lines.length; i++) {
        const values = lines[i].split(',').map(v => v.trim());
        const rowData: any = {};

        headers.forEach((header, index) => {
          rowData[header] = values[index] || '';
        });

        jsonData.push(rowData);
      }

      console.log(`✅ Successfully converted CSV to JSON: ${jsonData.length} records`);
      return jsonData;
    } catch (error) {
      console.error(`❌ Error converting CSV to JSON:`, error);
      return [];
    }
  }

  static generateHtmlReportIncremental(reportFilename: string, idTest: string): void {
    // Incremental HTML generation - called after each data write
    // Silent mode - no console logs to avoid cluttering output
    try {
      const reportDir = path.join('report', 'json');
      const htmlDir = path.join('report', 'html');
      const templateHtmlPath = path.join('report', 'template', 'template.html');
      const templateEjsPath = path.join('report', 'template', 'template.ejs');

      if (!fs.existsSync(htmlDir)) {
        fs.mkdirSync(htmlDir, { recursive: true });
      }

      // Choose template: prefer template.html, fallback to template.ejs
      let templatePath: string | null = null;
      if (fs.existsSync(templateHtmlPath)) {
        templatePath = templateHtmlPath;
      } else if (fs.existsSync(templateEjsPath)) {
        templatePath = templateEjsPath;
      } else {
        console.warn(`⚠️ No template found at ${templateHtmlPath} or ${templateEjsPath}. Skipping HTML generation.`);
        return;
      }

      const botDataPath = path.join(reportDir, `${reportFilename}-${idTest}.json`);
      const summaryDataPath = path.join(reportDir, `${reportFilename}-${idTest}-summary.json`);
      const chartDataPath = path.join(reportDir, `${reportFilename}-${idTest}-chart.json`);

      if (!fs.existsSync(botDataPath)) {
        console.warn(`⚠️ Bot data not ready yet at ${botDataPath}. Incremental HTML generation skipped.`);
        return; // Not ready yet
      }

      const botData: BotData[] = JSON.parse(fs.readFileSync(botDataPath, 'utf-8'));

      // Use default summary if not exists yet
      let summaryData: SummaryData;
      if (fs.existsSync(summaryDataPath)) {
        summaryData = JSON.parse(fs.readFileSync(summaryDataPath, 'utf-8'));
      } else {
        // Create temporary summary with current data
        summaryData = {
          id_test: idTest,
          tester_name: 'In Progress...',
          ai_evaluation: 'N/A',
          url: 'N/A',
          page_name: 'N/A',
          browser_name: 'N/A',
          date_test: new Date().toLocaleDateString(),
          start_time_test: 'N/A',
          end_time_test: 'In Progress...',
          duration: 'In Progress...',
          total_title: 0,
          total_question: botData.length,
          success: botData.filter(d => d.status === 'PASS').length,
          failed: botData.filter(d => d.status === 'FAILED').length
        };
      }

      const chartData = fs.existsSync(chartDataPath) ? JSON.parse(fs.readFileSync(chartDataPath, 'utf-8')) : {};

      const htmlTemplate = fs.readFileSync(templatePath, 'utf-8');

      // Create folder for this report early so we can resolve screenshot paths
      const reportFolderPath = path.join(htmlDir, `${reportFilename}-${idTest}`);
      if (!fs.existsSync(reportFolderPath)) {
        fs.mkdirSync(reportFolderPath, { recursive: true });
      }

      // Prepare botData so that image_capture points to a relative screenshots/ path
      const screenshotsInReport = path.join(reportFolderPath, 'screenshots');
      const botDataForRender = botData.map(item => {
        if (item.image_capture) {
          const candidate1 = path.join(screenshotsInReport, item.image_capture);
          const candidate2 = path.join('report', 'screenshots', item.image_capture);
          if (fs.existsSync(candidate1)) {
            return { ...item, image_capture: path.posix.join('screenshots', item.image_capture) };
          } else if (fs.existsSync(candidate2)) {
            // If screenshots were placed into a global folder, prefer referencing screenshots/<file>
            return { ...item, image_capture: path.posix.join('screenshots', item.image_capture) };
          }
        }
        return item;
      });

      // If template is EJS, render using EJS with proper data context
      let htmlContent = '';
      try {
        if (path.extname(templatePath).toLowerCase() === '.ejs') {
          const ejs = require('ejs');
          htmlContent = ejs.render(htmlTemplate, { test_data: botDataForRender, summary: [summaryData], chartData }, { rmWhitespace: true });
        } else {
          htmlContent = this.processTemplate(htmlTemplate, botDataForRender, summaryData, chartData);
        }
      } catch (err) {
        console.error('❌ Error rendering template (incremental):', err);
        // Fallback to simple processing (best-effort)
        htmlContent = this.processTemplate(htmlTemplate, botDataForRender, summaryData, chartData);
      }

      // Write HTML file
      const htmlFilePath = path.join(reportFolderPath, 'dashboard.html');
      fs.writeFileSync(htmlFilePath, htmlContent);
    } catch (error) {
      console.error('❌ Error in generateHtmlReportIncremental:', error);
    }
  }

  static generateHtmlReport(reportFilename: string, idTest: string): void {
    try {
      const reportDir = path.join('report', 'json');
      const htmlDir = path.join('report', 'html');
      const templatePath = path.join('report', 'template', 'template.html');

      if (!fs.existsSync(htmlDir)) {
        fs.mkdirSync(htmlDir, { recursive: true });
      }

      // Check if template exists
      if (!fs.existsSync(templatePath)) {
        console.log('⚠️ Template file not found at report/template/template.html');
        return;
      }

      // Read JSON data files
      const botDataPath = path.join(reportDir, `${reportFilename}-${idTest}.json`);
      const summaryDataPath = path.join(reportDir, `${reportFilename}-${idTest}-summary.json`);
      const chartDataPath = path.join(reportDir, `${reportFilename}-${idTest}-chart.json`);

      if (!fs.existsSync(botDataPath) || !fs.existsSync(summaryDataPath)) {
        console.log('⚠️ Required JSON files not found for HTML report generation');
        return;
      }

      const botData: BotData[] = JSON.parse(fs.readFileSync(botDataPath, 'utf-8'));
      const summaryData: SummaryData = JSON.parse(fs.readFileSync(summaryDataPath, 'utf-8'));
      const chartData = fs.existsSync(chartDataPath) ? JSON.parse(fs.readFileSync(chartDataPath, 'utf-8')) : {};

      // Read template
      let htmlTemplate = fs.readFileSync(templatePath, 'utf-8');

      // Create folder for this report early so we can resolve screenshot paths
      const reportFolderPath = path.join(htmlDir, `${reportFilename}-${idTest}`);
      if (!fs.existsSync(reportFolderPath)) {
        fs.mkdirSync(reportFolderPath, { recursive: true });
      }

      // Prepare botData so that image_capture points to a relative screenshots/ path
      const screenshotsInReport = path.join(reportFolderPath, 'screenshots');
      const botDataForRender = botData.map(item => {
        if (item.image_capture) {
          const candidate1 = path.join(screenshotsInReport, item.image_capture);
          const candidate2 = path.join('report', 'screenshots', item.image_capture);
          if (fs.existsSync(candidate1)) {
            return { ...item, image_capture: path.posix.join('screenshots', item.image_capture) };
          } else if (fs.existsSync(candidate2)) {
            return { ...item, image_capture: path.posix.join('screenshots', item.image_capture) };
          }
        }
        return item;
      });

      // Generate HTML content using template, support EJS templates as well
      let htmlContent = '';
      try {
        if (path.extname(templatePath).toLowerCase() === '.ejs') {
          const ejs = require('ejs');
          htmlContent = ejs.render(htmlTemplate, { test_data: botDataForRender, summary: [summaryData], chartData }, { rmWhitespace: true });
        } else {
          htmlContent = this.processTemplate(htmlTemplate, botDataForRender, summaryData, chartData);
        }
      } catch (err) {
        console.error('❌ Error rendering template:', err);
        // Fallback to simple processing
        htmlContent = this.processTemplate(htmlTemplate, botDataForRender, summaryData, chartData);
      }

      // Write HTML file
      const htmlFilePath = path.join(reportFolderPath, 'dashboard.html');
      fs.writeFileSync(htmlFilePath, htmlContent);

      console.log(`✅ HTML report generated: ${htmlFilePath}`);
    } catch (error) {
      console.error('❌ Error generating HTML report:', error);
    }
  }

  private static processTemplate(
    template: string,
    botData: BotData[],
    summaryData: SummaryData,
    chartData: Record<string, string>
  ): string {
    // Calculate statistics
    const totalQuestions = botData.length;
    const passedQuestions = botData.filter(item => item.status === 'PASS').length;
    const failedQuestions = botData.filter(item => item.status === 'FAILED').length;

    // Create summary array for template compatibility
    const summaryArray = [summaryData];

    // Replace template variables
    let processedTemplate = template;

    // Replace summary data placeholders
    processedTemplate = processedTemplate.replace(/\{\{\s*summary\[0\]\.success\s*\}\}/g, passedQuestions.toString());
    processedTemplate = processedTemplate.replace(/\{\{\s*summary\[0\]\.failed\s*\}\}/g, failedQuestions.toString());
    processedTemplate = processedTemplate.replace(/\{\{\s*summary\[0\]\.total_title\s*\}\}/g, summaryData.total_title.toString());
    processedTemplate = processedTemplate.replace(/\{\{\s*summary\[0\]\.total_question\s*\}\}/g, summaryData.total_question.toString());
    processedTemplate = processedTemplate.replace(/\{\{\s*summary\[0\]\.duration\s*\}\}/g, summaryData.duration || 'N/A');
    processedTemplate = processedTemplate.replace(/\{\{\s*summary\[0\]\.id_test\s*\}\}/g, summaryData.id_test);
    processedTemplate = processedTemplate.replace(/\{\{\s*summary\[0\]\.tester_name\s*\}\}/g, summaryData.tester_name);
    processedTemplate = processedTemplate.replace(/\{\{\s*summary\[0\]\.date_test\s*\}\}/g, summaryData.date_test);
    processedTemplate = processedTemplate.replace(/\{\{\s*summary\[0\]\.ai_evaluation\s*\}\}/g, summaryData.ai_evaluation);
    processedTemplate = processedTemplate.replace(/\{\{\s*summary\[0\]\.browser_name\s*\}\}/g, summaryData.browser_name);
    processedTemplate = processedTemplate.replace(/\{\{\s*summary\[0\]\.url\s*\}\}/g, summaryData.url);
    processedTemplate = processedTemplate.replace(/\{\{\s*summary\[0\]\.start_time_test\s*\}\}/g, summaryData.start_time_test);
    processedTemplate = processedTemplate.replace(/\{\{\s*summary\[0\]\.end_time_test\s*\}\}/g, summaryData.end_time_test || 'N/A');

    // Process test data loop ({% for test_item in test_data %})
    const forLoopRegex = /\{\%\s*for\s+test_item\s+in\s+test_data\s*\%\}([\s\S]*?)\{\%\s*endfor\s*\%\}/g;
    processedTemplate = processedTemplate.replace(forLoopRegex, (match, loopContent) => {
      return botData.map((item, idx) => {
        let itemContent = loopContent;

        // Replace test_item placeholders
        itemContent = itemContent.replace(/\{\{\s*test_item\.title\s*\}\}/g, this.escapeHtml(item.title));
        itemContent = itemContent.replace(/\{\{\s*test_item\.question\s*\}\}/g, this.escapeHtml(item.question));
        itemContent = itemContent.replace(/\{\{\s*test_item\.response_kb\s*\}\}/g, this.escapeHtml(item.response_kb));
        itemContent = itemContent.replace(/\{\{\s*test_item\.response_llm\s*\}\}/g, this.escapeHtml(item.response_llm));
        itemContent = itemContent.replace(/\{\{\s*test_item\.explanation\s*\}\}/g, this.escapeHtml(item.explanation));
        itemContent = itemContent.replace(/\{\{\s*test_item\.skor\s*\}\}/g, item.skor.toString());
        // Provide a sequential number (No). Prefer item.no if present, otherwise use index+1
        const seqNo = (item.no && String(item.no).trim()) ? String(item.no) : String(idx + 1);
        itemContent = itemContent.replace(/\{\{\s*test_item\.no\s*\}\}/g, seqNo);
        itemContent = itemContent.replace(/\{\{\s*test_item\.status\s*\}\}/g, item.status);
        itemContent = itemContent.replace(/\{\{\s*test_item\.duration\s*\}\}/g, item.duration);

        // Handle image capture with conditional
        const imageConditionRegex = /\{\%\s*if\s+test_item\.image_capture\s*\%\}([\s\S]*?)\{\%\s*else\s*\%\}([\s\S]*?)\{\%\s*endif\s*\%\}/g;
        itemContent = itemContent.replace(imageConditionRegex, (match: string, ifContent: string, elseContent: string) => {
          if (item.image_capture) {
            // Use relative path since screenshot is copied to same folder as HTML
            return ifContent.replace(/\{\{\s*test_item\.image_capture\s*\}\}/g, item.image_capture);
          } else {
            return elseContent;
          }
        });

        return itemContent;
      }).join('');
    });

    // Update title for DHAI Wake-up Word
    processedTemplate = processedTemplate.replace(
      /<title>Dashboard Analytics<\/title>/,
      `<title>🎤 DHAI Wake-up Word Test Report - ${summaryData.id_test}</title>`
    );

    // Update main title
    processedTemplate = processedTemplate.replace(
      /Hello, Champ!/,
      '🎤 DHAI Wake-up Word Test Report'
    );

    return processedTemplate;
  }

  private static escapeHtml(text: string): string {
    const div = { innerHTML: '' } as any;
    div.textContent = text;
    return div.innerHTML || text.replace(/[&<>"']/g, (match: string) => {
      const escapeMap: { [key: string]: string } = {
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#39;'
      };
      return escapeMap[match];
    });
  }
}
