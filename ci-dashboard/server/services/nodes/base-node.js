/**
 * Base Node Executor
 * Base class for all node executors
 */

const { resolveConfigValue, resolveApiKey } = require('../utils/config-resolver');
const { resolveTemplate } = require('../utils/template-engine');

class BaseNode {
  constructor(schema) {
    this.schema = schema;
  }
  
  /**
   * Execute the node
   * @param {ExecutionContext} context - Execution context
   * @param {Object} config - Node configuration
   * @param {Object} node - Full node object
   * @returns {Promise<any>} - Node output
   */
  async execute(context, config, node) {
    throw new Error('execute() must be implemented by subclass');
  }
  
  /**
   * Validate node configuration
   * @param {Object} config - Node configuration
   * @returns {Object} - { valid: boolean, errors: Array }
   */
  validate(config) {
    const errors = [];
    
    if (!this.schema || !this.schema.config_schema) {
      return { valid: true, errors: [] };
    }
    
    for (const field of this.schema.config_schema) {
      if (field.required && !config[field.key]) {
        errors.push({
          field: field.key,
          message: `${field.label} is required`
        });
      }
    }
    
    return {
      valid: errors.length === 0,
      errors
    };
  }
  
  /**
   * Get input from context
   * @param {ExecutionContext} context - Execution context
   * @param {string} portName - Input port name
   * @returns {any} - Input data
   */
  getInput(context, portName = 'main') {
    const data = context.getInput(portName);
    this.log('info', `getInput called for port: ${portName}, found data: ${data ? 'yes' : 'no'}`);
    if (!data) {
      this.log('warn', `No data found for port: ${portName} on node ${context?.current_node_id}`);
      this.log('warn', `Available connections: ${JSON.stringify(context?.connections || [])}`);
    }
    return data;
  }
  
  /**
   * Set output to context
   * @param {ExecutionContext} context - Execution context
   * @param {any} data - Output data
   * @param {string} portName - Output port name
   */
  setOutput(context, data, portName = 'output') {
    context.setOutput(portName, data);
  }

  /**
   * Resolve a configuration value using config, environment, or default.
   */
  resolveConfigValue(config, key, envVar, defaultValue = undefined) {
    return resolveConfigValue(config, key, envVar, defaultValue);
  }

  /**
   * Resolve API key for provider shortcuts and env fallback.
   */
  resolveApiKey(config, provider) {
    return resolveApiKey(config, provider);
  }

  /**
   * Resolve template expressions in text using runtime context.
   */
  resolveTemplate(template, input = {}, context = null) {
    return resolveTemplate(template, input, context);
  }
  
  /**
   * Log message to technical logs table for UI visibility
   */
  async logTechnical(context, level, message) {
    if (!context || !context.execution_id || !context.current_node_id) {
      this.log(level, message);
      return;
    }

    try {
      const { pool: db } = require('../../db');
      await db.queryOriginal(
        `INSERT INTO workflow_node_logs (execution_id, node_id, level, message)
         VALUES ($1, $2, $3, $4)`,
        [context.execution_id, context.current_node_id, level, message]
      );
    } catch (err) {
      console.error('Failed to save technical log:', err.message);
    }

    // Also log to console for server-side visibility
    this.log(level, message);
  }

  /**
   * Log message
   * @param {string} level - Log level (info, warn, error)
   * @param {string} message - Log message
   * @param {Object} data - Additional data
   */
  log(level, message, data = {}) {
    const timestamp = new Date().toISOString();
    console.log(`[${timestamp}] [${level.toUpperCase()}] ${message}`, data);
  }

  /**
   * Ensures a file exists locally. If it's a URL, it downloads it to a temp folder.
   * Enhanced to search in assets directories if not found.
   * @param {string} filePathOrUrl 
   * @returns {Promise<string>} - Local file path
   */
  async ensureLocalFile(filePathOrUrl) {
    if (!filePathOrUrl) return null;
    
    const fs = require('fs');
    const path = require('path');
    const axios = require('axios');

    if (filePathOrUrl.startsWith('http')) {
      this.log('info', `Downloading remote file: ${filePathOrUrl}`);
      try {
        const tempDir = path.join(process.cwd(), 'temp_data');
        if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir, { recursive: true });
        
        const fileName = path.basename(new URL(filePathOrUrl).pathname) || `downloaded_${Date.now()}.xlsx`;
        const localPath = path.join(tempDir, fileName);
        
        const response = await axios({
          method: 'get',
          url: filePathOrUrl,
          responseType: 'stream'
        });
        
        const writer = fs.createWriteStream(localPath);
        response.data.pipe(writer);
        
        return new Promise((resolve, reject) => {
          writer.on('finish', () => resolve(localPath));
          writer.on('error', reject);
        });
      } catch (error) {
        this.log('error', `Failed to download file: ${error.message}`);
        throw new Error(`Failed to download file from URL: ${filePathOrUrl}`);
      }
    }
    
    // 1. Cek path langsung (literal check)
    if (fs.existsSync(filePathOrUrl)) {
      return filePathOrUrl;
    }
    
    // 2. Cek apakah ada di folder assets (xlsx, json, csv)
    const baseFileName = path.basename(filePathOrUrl);
    
    // Coba bersihkan prefix umum jika ada
    let cleanFileName = filePathOrUrl;
    const prefixesToStrip = ['test-data/', 'test-data\\', 'assets/', 'assets\\'];
    for (const prefix of prefixesToStrip) {
      if (cleanFileName.toLowerCase().startsWith(prefix.toLowerCase())) {
        cleanFileName = cleanFileName.slice(prefix.length);
        break;
      }
    }
    
    const candidates = [
      path.join(process.cwd(), 'assets', 'xlsx', cleanFileName),
      path.join(process.cwd(), 'assets', 'json', cleanFileName),
      path.join(process.cwd(), 'assets', 'csv', cleanFileName),
      path.join(process.cwd(), 'assets', 'xlsx', baseFileName),
      path.join(process.cwd(), 'assets', 'json', baseFileName),
      path.join(process.cwd(), 'assets', 'csv', baseFileName),
      path.join(process.cwd(), 'ci-dashboard', 'assets', 'xlsx', baseFileName),
      path.join(process.cwd(), 'ci-dashboard', 'assets', 'json', baseFileName),
      path.join(process.cwd(), 'ci-dashboard', 'assets', 'csv', baseFileName)
    ];

    for (const candidate of candidates) {
      if (fs.existsSync(candidate)) {
        this.log('info', `File found at fallback location: ${candidate}`);
        return candidate;
      }
    }
    
    throw new Error(`File not found: ${filePathOrUrl}. Pastikan file ada di folder assets/`);
  }
}

module.exports = BaseNode;
