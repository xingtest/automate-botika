/**
 * Node Registry
 * Central registry for all node types and their executors
 */

const ManualTriggerNode = require('./nodes/manual-trigger-node');
const ScheduleTriggerNode = require('./nodes/schedule-trigger-node');
const RunTestNode = require('./nodes/run-test-node');
const AIEvaluateNode = require('./nodes/ai-evaluate-node');
const ConditionNode = require('./nodes/condition-node');
const WaitNode = require('./nodes/wait-node');
const TransformDataNode = require('./nodes/transform-data-node');
const GenerateReportNode = require('./nodes/generate-report-node');
const SendNotificationNode = require('./nodes/send-notification-node');
const TelegramNode = require('./nodes/telegram-node');
const ReadExcelNode = require('./nodes/read-excel-node');

class NodeRegistry {
  constructor() {
    this.nodeTypes = new Map();
    this.nodeExecutors = new Map();
    this.registerAllNodes();
  }
  
  /**
   * Register all available node types
   */
  registerAllNodes() {
    // Trigger nodes
    this.register('manual-trigger', ManualTriggerNode);
    this.register('schedule-trigger', ScheduleTriggerNode);
    
    // Action nodes
    this.register('run-test', RunTestNode);
    this.register('ai-evaluate', AIEvaluateNode);
    this.register('generate-report', GenerateReportNode);
    this.register('send-notification', SendNotificationNode);
    this.register('telegram', TelegramNode);
    this.register('read-excel', ReadExcelNode);
    
    // Control flow nodes
    this.register('condition', ConditionNode);
    this.register('wait', WaitNode);
    
    // Transform nodes
    this.register('transform-data', TransformDataNode);
  }
  
  /**
   * Register a node type
   * @param {string} type - Node type identifier
   * @param {Class} ExecutorClass - Node executor class
   */
  register(type, ExecutorClass) {
    const executor = new ExecutorClass();
    this.nodeExecutors.set(type, executor);
    
    if (executor.schema) {
      this.nodeTypes.set(type, executor.schema);
    }
    console.log(`[NodeRegistry] Registered node type: ${type}`);
  }
  
  /**
   * Get node executor by type
   * @param {string} type - Node type
   * @returns {BaseNode} - Node executor instance
   */
  getNodeExecutor(type) {
    return this.nodeExecutors.get(type);
  }
  
  /**
   * Get node type schema
   * @param {string} type - Node type
   * @returns {Object} - Node schema
   */
  getNodeTypeSchema(type) {
    return this.nodeTypes.get(type);
  }
  
  /**
   * Get all node types
   * @returns {Array} - Array of node type schemas
   */
  getAllNodeTypes() {
    const types = [];
    for (const [type, schema] of this.nodeTypes.entries()) {
      types.push({
        type,
        ...schema
      });
    }
    return types;
  }
  
  /**
   * Get node types by category
   * @param {string} category - Category name
   * @returns {Array} - Array of node type schemas
   */
  getNodeTypesByCategory(category) {
    const types = [];
    for (const [type, schema] of this.nodeTypes.entries()) {
      if (schema.category === category) {
        types.push({
          type,
          ...schema
        });
      }
    }
    return types;
  }
}

module.exports = new NodeRegistry();
