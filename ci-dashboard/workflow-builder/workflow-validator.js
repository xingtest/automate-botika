/**
 * Workflow Validator Component
 * Provides client-side validation for workflow graphs
 */

const WorkflowValidator = {
  /**
   * Validate workflow definition
   * @param {Object} definition - Workflow definition (nodes and connections)
   * @returns {Object} - Validation result { valid: boolean, errors: [], warnings: [] }
   */
  async validate(definition) {
    console.log('[WorkflowValidator] Validating workflow...');
    
    // 1. Basic structure validation
    if (!definition || !definition.nodes) {
      return { valid: false, errors: [{ message: 'Invalid workflow structure', severity: 'error' }] };
    }
    
    const errors = [];
    const warnings = [];
    
    // 2. Node-specific validation
    if (definition.nodes.length === 0) {
      errors.push({ message: 'Workflow must have at least one node', severity: 'error' });
    }
    
    // 3. Trigger check
    const hasTrigger = definition.nodes.some(n => n.type.includes('trigger'));
    if (!hasTrigger) {
      errors.push({ message: 'Workflow must have at least one trigger node', severity: 'error' });
    }
    
    // 4. Isolated nodes check
    definition.nodes.forEach(node => {
      const isConnected = definition.connections.some(c => 
        c.source_node_id === node.id || c.target_node_id === node.id
      );
      
      if (!isConnected && definition.nodes.length > 1) {
        warnings.push({ 
          message: `Node "${node.label || node.type}" is isolated`, 
          nodeId: node.id,
          severity: 'warning' 
        });
      }
      
      // 5. Required config check (shallow check)
      // Full validation is done on the backend or in NodeConfigPanel
    });
    
    // 6. Circular dependency check
    if (this.hasCycles(definition)) {
      errors.push({ message: 'Circular dependency detected', severity: 'error' });
    }
    
    // 7. Backend validation (optional, for deep schema checks)
    try {
      const response = await BackendAPI.post('/workflows/validate', { definition });
      if (response && response.data) {
        // Merge backend errors/warnings
        if (response.data.errors) errors.push(...response.data.errors);
        if (response.data.warnings) warnings.push(...response.data.warnings);
      }
    } catch (e) {
      console.warn('[WorkflowValidator] Backend validation failed:', e);
    }
    
    return {
      valid: errors.length === 0,
      errors: this.uniqueBy(errors, 'message'),
      warnings: this.uniqueBy(warnings, 'message')
    };
  },
  
  /**
   * Check for cycles using Kahn's algorithm or DFS
   */
  hasCycles(definition) {
    const { nodes, connections } = definition;
    const adj = {};
    const inDegree = {};
    
    nodes.forEach(n => {
      adj[n.id] = [];
      inDegree[n.id] = 0;
    });
    
    connections.forEach(c => {
      if (adj[c.source_node_id]) {
        adj[c.source_node_id].push(c.target_node_id);
        inDegree[c.target_node_id]++;
      }
    });
    
    const queue = [];
    nodes.forEach(n => {
      if (inDegree[n.id] === 0) queue.push(n.id);
    });
    
    let count = 0;
    while (queue.length > 0) {
      const u = queue.shift();
      count++;
      
      (adj[u] || []).forEach(v => {
        inDegree[v]--;
        if (inDegree[v] === 0) queue.push(v);
      });
    }
    
    return count !== nodes.length;
  },
  
  /**
   * Helper to deduplicate items by key
   */
  uniqueBy(arr, key) {
    const seen = new Set();
    return arr.filter(item => {
      const k = item[key];
      return seen.has(k) ? false : seen.add(k);
    });
  }
};
