import * as fs from 'fs';
import * as path from 'path';
import { BotData, SummaryData } from '../types';

export class EnvFile {
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

    existingData.push(data);
    fs.writeFileSync(filePath, JSON.stringify(existingData, null, 2));
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
    // Placeholder - untuk sementara return empty array
    // User harus convert Excel ke JSON terlebih dahulu
    console.log(`⚠️  Excel parsing not yet implemented.`);
    console.log(`Please convert ${filename} to JSON format first.`);
    console.log(`Or use existing JSON file from assets/json/converted/`);
    return [];
  }

  static convertCsvToJson(filename: string): any[] {
    // Placeholder - untuk sementara return empty array
    // User harus convert CSV ke JSON terlebih dahulu
    console.log(`⚠️  CSV parsing not yet implemented.`);
    console.log(`Please convert ${filename} to JSON format first.`);
    console.log(`Or use existing JSON file from assets/json/converted/`);
    return [];
  }
}
