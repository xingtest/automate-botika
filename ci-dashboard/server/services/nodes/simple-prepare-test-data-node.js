const BaseNode = require('./base-node');
const XLSX = require('xlsx');
const path = require('path');
const fs = require('fs');
const { getEnvelope, getItems, normalizeItem, withResults } = require('./llm-judge-utils');

class SimplePrepareTestDataNode extends BaseNode {
  constructor() {
    super({
      type: 'simple-prepare-test-data',
      category: 'simple',
      label: 'Prepare Test Data',
      description: 'Load, normalize, validate, and lightly enrich chatbot test data',
      icon: 'fa-table-list',
      color: '#0f766e',
      inputs: [{ id: 'main', name: 'Input', dataType: 'object', required: false }],
      outputs: [{ id: 'main', name: 'Prepared Test Data', dataType: 'object', required: true }],
      config_schema: [
        { key: 'source', label: 'Source', type: 'select', required: false, default: 'sample', options: [
          { label: 'Sample Demo Data', value: 'sample' },
          { label: 'Excel / CSV File', value: 'file' },
          { label: 'Input Data', value: 'input' }
        ] },
        { key: 'filePath', label: 'File Path', type: 'text', required: false, default: 'test-data/WABIS KB.xlsx' },
        { key: 'sheetName', label: 'Sheet Name', type: 'text', required: false, default: 'Worksheet' },
        { key: 'fail_on_invalid', label: 'Fail on Invalid Rows', type: 'boolean', required: false, default: true }
      ]
    });
  }

  async execute(context, config) {
    const input = config.source === 'input' ? (this.getInput(context, 'main') || {}) : {};
    let rows = [];

    if ((config.source || 'sample') === 'file') {
      const filePath = config.filePath || 'test-data/WABIS KB.xlsx';
      const fullPath = await this.ensureLocalFile(filePath);
      rows = this.readFile(fullPath, config.sheetName || 'Worksheet');
    } else if (config.source === 'input') {
      rows = getItems(input);
    } else {
      rows = this.sampleRows();
    }

    const results = rows.map((row, index) => {
      const normalized = normalizeItem(row, index);
      const errors = [];
      if (!normalized.question) errors.push('question is required');
      if (!normalized.response_kb) errors.push('response_kb is required');
      return { ...normalized, schema_valid: errors.length === 0, schema_errors: errors };
    });

    const invalid = results.filter(row => !row.schema_valid);
    if (config.fail_on_invalid !== false && invalid.length) {
      throw new Error(`Prepare Test Data failed: ${invalid.length} invalid row(s)`);
    }

    const topics = [...new Set(results.map(row => row.category || row.title).filter(Boolean))];
    return withResults(getEnvelope(input), results, {
      simple_mode: true,
      prepare_summary: {
        total: results.length,
        invalid: invalid.length,
        topics
      },
      knowledge_base_text: results.map(row => row.response_kb).filter(Boolean).join('\n')
    });
  }

  readFile(fullPath, sheetName) {
    // Note: fullPath is now expected to be resolved via ensureLocalFile
    const workbook = XLSX.readFile(fullPath);
    const sheet = workbook.Sheets[workbook.SheetNames.includes(sheetName) ? sheetName : workbook.SheetNames[0]];
    return XLSX.utils.sheet_to_json(sheet);
  }

  sampleRows() {
    return [
      {
        no: 1,
        title: 'Lokasi Kantor Botika',
        category: 'Lokasi',
        question: 'Kantor Botika ada di mana sih?',
        response_kb: 'Kantor Botika berada di Yogyakarta. Head office berada di Jl Perumnas Blok E III No 50 Seturan Yogyakarta.',
        response_llm: 'Kantor Botika berada di Yogyakarta. Head office Botika berada di Jl Perumnas Blok E III No 50 Seturan Yogyakarta.',
        must_include: ['Yogyakarta', 'Jl Perumnas'],
        must_not_include: ['Jakarta', 'Bandung']
      },
      {
        no: 2,
        title: 'Kontak Botika',
        category: 'Kontak',
        question: 'Gimana cara menghubungi Botika?',
        response_kb: 'Botika dapat dihubungi melalui email support@botika.online dan WhatsApp +6281802207000.',
        response_llm: 'Kamu dapat menghubungi Botika melalui email support@botika.online atau WhatsApp +6281802207000.',
        must_include: ['support@botika.online', '+6281802207000'],
        must_not_include: ['password', 'token']
      }
    ];
  }
}

module.exports = SimplePrepareTestDataNode;
