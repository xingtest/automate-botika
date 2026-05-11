const BaseNode = require('./base-node');
const XLSX = require('xlsx');
const fs = require('fs');
const path = require('path');

class ReadExcelNode extends BaseNode {
  constructor() {
    super({
      type: 'read-excel',
      category: 'action',
      label: 'Read Excel / CSV',
      description: 'Load data from Excel or CSV file',
      icon: 'fa-file-excel',
      color: '#1d6f42',
      inputs: [
        { id: 'main', name: 'Trigger', dataType: 'any', required: false }
      ],
      outputs: [
        { id: 'main', name: 'Test Data', dataType: 'object', required: true }
      ],
      config_schema: [
        {
          key: 'filePath',
          label: 'File Path',
          type: 'text',
          required: true,
          default: 'test-data/WABIS KB.xlsx',
          description: 'Path to the Excel/CSV file'
        },
        {
          key: 'sheetName',
          label: 'Sheet Name',
          type: 'text',
          required: false,
          default: 'Sheet1',
          description: 'Sheet name for Excel files (optional)'
        }
      ]
    });
  }

  async execute(context, config, node) {
    const filePath = config.filePath || 'test-data/WABIS KB.xlsx';
    const sheetName = config.sheetName || 'Sheet1';

    this.log('info', `Reading Excel/CSV file: ${filePath}`);

    try {
      const fullPath = await this.ensureLocalFile(filePath);

      const workbook = XLSX.readFile(fullPath);
      
      let sheet;
      if (workbook.SheetNames.includes(sheetName)) {
        sheet = workbook.Sheets[sheetName];
      } else {
        sheet = workbook.Sheets[workbook.SheetNames[0]];
        this.log('warn', `Sheet "${sheetName}" not found, using first sheet: ${workbook.SheetNames[0]}`);
      }

      const data = XLSX.utils.sheet_to_json(sheet).map((row) => this.normalizeRow(row));
      
      this.log('info', `Successfully read ${data.length} rows from file`);
      this.logTechnical(context, 'debug', `Sample data: ${JSON.stringify(data.slice(0, 2), null, 2)}`);

      return {
        success: true,
        results: data,
        total_rows: data.length,
        file_path: filePath,
        sheet_name: workbook.SheetNames.includes(sheetName) ? sheetName : workbook.SheetNames[0]
      };
    } catch (error) {
      this.log('error', `Failed to read file: ${error.message}`);
      throw error;
    }
  }

  normalizeRow(row) {
    const getField = (names) => {
      const entries = Object.entries(row);
      for (const name of names) {
        const match = entries.find(([key]) => key.toLowerCase() === name.toLowerCase());
        if (match && match[1] !== undefined && match[1] !== null) {
          return String(match[1]).trim();
        }
      }
      return '';
    };

    return {
      ...row,
      no: row.no || row.No || getField(['number']),
      title: row.title || row.Title || getField(['topic']),
      question: row.question || row.Pertanyaan || getField(['test_case']),
      response_kb: row.response_kb || row.Context || getField(['expected', 'expected_answer'])
    };
  }
}

module.exports = ReadExcelNode;
