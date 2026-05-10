/**
 * Node Registry - Enhanced & Robust Version
 * Central registry for all node types and their executors
 * Auto-detects nodes and provides fallback mechanisms
 */

const fs = require('fs');
const path = require('path');

class FallbackNode {
  constructor(type) {
    this.type = type;
    this.schema = {
      type: type,
      category: 'action',
      label: `${type} (Fallback)`,
      description: `Node type "${type}" not found. Please create the executor file.`,
      icon: 'fa-exclamation-triangle',
      color: '#ef4444',
      inputs: [{ id: 'main', name: 'Input', dataType: 'any', required: false }],
      outputs: [{ id: 'main', name: 'Output', dataType: 'any', required: true }],
      config_schema: []
    };
  }

  async execute(context, config, node) {
    const errorMsg = `Node executor for "${this.type}" not implemented yet.`;
    console.error(`[FallbackNode] ${errorMsg}`);
    throw new Error(errorMsg);
  }
}

class NodeRegistry {
  constructor() {
    this.nodeTypes = new Map();
    this.nodeExecutors = new Map();
    this.missingNodes = new Set();
    this.nodesDir = path.resolve(__dirname, 'nodes');
    
    console.log('[NodeRegistry] Initializing enhanced node registry...');
    this.registerAllNodes();
  }
  
  /**
   * Auto-discover and register all node types from the nodes directory
   */
  registerAllNodes() {
    try {
      if (!fs.existsSync(this.nodesDir)) {
        console.error('[NodeRegistry] Nodes directory not found:', this.nodesDir);
        return;
      }

      const nodeFiles = fs.readdirSync(this.nodesDir)
        .filter(file => file.endsWith('-node.js'));

      console.log(`[NodeRegistry] Found ${nodeFiles.length} node files`);

      for (const file of nodeFiles) {
        try {
          const nodePath = path.join(this.nodesDir, file);
          const NodeClass = require(nodePath);
          
          if (NodeClass && typeof NodeClass === 'function') {
            const tempInstance = new NodeClass();
            const nodeType = tempInstance.schema?.type || this.inferNodeTypeFromFile(file);
            
            this.register(nodeType, NodeClass);
          }
        } catch (error) {
          console.error(`[NodeRegistry] Failed to load node from ${file}:`, error.message);
        }
      }

      console.log(`[NodeRegistry] Successfully registered ${this.nodeExecutors.size} nodes`);
    } catch (error) {
      console.error('[NodeRegistry] Error during node discovery:', error);
    }
  }

  /**
   * Infer node type from filename
   * @param {string} filename - Node filename (e.g., "read-excel-node.js")
   * @returns {string} Node type (e.g., "read-excel")
   */
  inferNodeTypeFromFile(filename) {
    return filename.replace('-node.js', '');
  }
  
  /**
   * Register a node type
   * @param {string} type - Node type identifier
   * @param {Class} ExecutorClass - Node executor class
   */
  register(type, ExecutorClass) {
    try {
      const executor = new ExecutorClass();
      this.nodeExecutors.set(type, executor);
      
      if (executor.schema) {
        this.nodeTypes.set(type, executor.schema);
      }
      
      console.log(`[NodeRegistry] ✓ Registered node type: ${type}`);
      
      if (this.missingNodes.has(type)) {
        this.missingNodes.delete(type);
        console.log(`[NodeRegistry] ✓ Resolved missing node: ${type}`);
      }
    } catch (error) {
      console.error(`[NodeRegistry] ✗ Failed to register node ${type}:`, error.message);
    }
  }
  
  /**
   * Get node executor by type with fallback mechanism
   * @param {string} type - Node type
   * @returns {BaseNode} - Node executor instance
   */
  getNodeExecutor(type) {
    let executor = this.nodeExecutors.get(type);
    
    if (!executor) {
      if (!this.missingNodes.has(type)) {
        this.missingNodes.add(type);
        console.warn(`[NodeRegistry] ⚠️ Node executor not found: ${type}`);
        console.warn(`[NodeRegistry] ℹ️ Create file: ${path.join(this.nodesDir, `${type}-node.js`)}`);
      }
      
      executor = new FallbackNode(type);
      this.nodeExecutors.set(type, executor);
    }
    
    return executor;
  }
  
  /**
   * Get node type schema with fallback
   * @param {string} type - Node type
   * @returns {Object} - Node schema
   */
  getNodeTypeSchema(type) {
    let schema = this.nodeTypes.get(type);
    
    if (!schema) {
      console.warn(`[NodeRegistry] ⚠️ Node schema not found: ${type}, using fallback`);
      const fallback = new FallbackNode(type);
      schema = fallback.schema;
      this.nodeTypes.set(type, schema);
    }
    
    return schema;
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

  /**
   * Get list of missing nodes
   * @returns {Array<string>} List of missing node types
   */
  getMissingNodes() {
    return Array.from(this.missingNodes);
  }

  /**
   * Check if a node is available
   * @param {string} type - Node type
   * @returns {boolean} True if node is available
   */
  isNodeAvailable(type) {
    return this.nodeExecutors.has(type) && !this.missingNodes.has(type);
  }

  /**
   * Validate workflow definition for missing nodes
   * @param {Object} workflowDefinition - Workflow definition
   * @returns {Object} Validation result
   */
  validateWorkflow(workflowDefinition) {
    const nodes = workflowDefinition?.nodes || [];
    const missingNodes = [];
    const availableNodes = [];

    for (const node of nodes) {
      const nodeType = node.type;
      if (this.isNodeAvailable(nodeType)) {
        availableNodes.push(nodeType);
      } else {
        missingNodes.push(nodeType);
      }
    }

    return {
      valid: missingNodes.length === 0,
      missingNodes,
      availableNodes,
      totalNodes: nodes.length
    };
  }
}

console.log('[NodeRegistry] Loading enhanced node registry module...');
module.exports = new NodeRegistry();
