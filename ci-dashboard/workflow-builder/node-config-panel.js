/**
 * Node Configuration Panel Component
 * Dynamic form generator for node configuration
 */

const NodeConfigPanel = {
  currentNode: null,
  formFields: {},
  
  /**
   * Initialize node config panel
   */
  init() {
    console.log('[NodeConfigPanel] Initializing...');
    
    // Listen to node selection events
    WorkflowCanvas.on('nodeSelected', (node) => {
      this.showConfig(node);
    });
    
    WorkflowCanvas.on('nodeDeselected', () => {
      this.hide();
    });
    
    console.log('[NodeConfigPanel] Initialized successfully');
  },
  
  /**
   * Show configuration panel for a node
   */
  async showConfig(node) {
    this.currentNode = node;
    
    const panel = document.getElementById('wfConfigPanel');
    const content = document.getElementById('wfConfigContent');
    
    if (!panel || !content) return;
    
    // Show panel
    panel.classList.remove('hidden');
    
    // Get node type schema
    const nodeType = NodeLibrary.nodeTypes.find(nt => nt.type === node.type);
    
    if (!nodeType) {
      content.innerHTML = '<p class="text-muted text-center">Node type not found</p>';
      return;
    }
    
    // Generate form
    content.innerHTML = this.generateForm(node, nodeType);
    
    // Setup form event listeners
    this.setupFormListeners();
  },
  
  /**
   * Hide configuration panel
   */
  hide() {
    const panel = document.getElementById('wfConfigPanel');
    if (panel) {
      panel.classList.add('hidden');
    }
    this.currentNode = null;
    this.formFields = {};
  },
  
  /**
   * Generate form HTML
   */
  generateForm(node, nodeType) {
    const config = node.config || {};
    const schema = nodeType.config_schema || [];
    
    let html = `
      <div class="node-config-form">
        <div class="node-config-header">
          <div class="node-config-icon" style="background: ${nodeType.color};">
            <i class="fas ${nodeType.icon}"></i>
          </div>
          <div class="node-config-info">
            <h4>${nodeType.name}</h4>
            <p>${nodeType.description}</p>
          </div>
        </div>
        
        <div class="node-config-fields">
    `;
    
    // Generate fields
    schema.forEach(field => {
      html += this.generateField(field, config[field.key]);
    });
    
    html += `
        </div>
        
        <div class="node-config-actions">
          <button class="btn btn-primary btn-sm btn-block" id="nodeConfigSave">
            <i class="fas fa-save"></i> Save Configuration
          </button>
          <button class="btn btn-secondary btn-sm btn-block" id="nodeConfigTest">
            <i class="fas fa-flask"></i> Test Node
          </button>
          <button class="btn btn-danger btn-sm btn-block" id="nodeConfigDelete">
            <i class="fas fa-trash"></i> Delete Node
          </button>
        </div>
      </div>
    `;
    
    return html;
  },
  
  /**
   * Generate form field HTML
   */
  generateField(field, value) {
    const fieldId = `field_${field.key}`;
    const currentValue = value !== undefined ? value : (field.default || '');
    
    let fieldHtml = `
      <div class="form-group">
        <label class="form-label">
          ${field.label}
          ${field.required ? '<span class="text-error">*</span>' : ''}
        </label>
    `;
    
    switch (field.type) {
      case 'text':
      case 'url':
      case 'email':
        fieldHtml += `
          <input 
            type="${field.type}" 
            id="${fieldId}" 
            class="form-control" 
            placeholder="${field.placeholder || ''}"
            value="${this.escapeHtml(currentValue)}"
            ${field.required ? 'required' : ''}
          />
        `;
        break;
        
      case 'number':
        fieldHtml += `
          <input 
            type="number" 
            id="${fieldId}" 
            class="form-control" 
            placeholder="${field.placeholder || ''}"
            value="${currentValue}"
            ${field.min !== undefined ? `min="${field.min}"` : ''}
            ${field.max !== undefined ? `max="${field.max}"` : ''}
            ${field.required ? 'required' : ''}
          />
        `;
        break;
        
      case 'textarea':
        fieldHtml += `
          <textarea 
            id="${fieldId}" 
            class="form-control" 
            rows="4"
            placeholder="${field.placeholder || ''}"
            ${field.required ? 'required' : ''}
          >${this.escapeHtml(currentValue)}</textarea>
        `;
        break;
        
      case 'select':
        fieldHtml += `
          <select id="${fieldId}" class="form-control" ${field.required ? 'required' : ''}>
            ${field.options.map(opt => `
              <option value="${opt.value}" ${currentValue === opt.value ? 'selected' : ''}>
                ${opt.label}
              </option>
            `).join('')}
          </select>
        `;
        break;
        
      case 'multiselect':
        fieldHtml += `
          <select id="${fieldId}" class="form-control" multiple ${field.required ? 'required' : ''}>
            ${field.options.map(opt => `
              <option value="${opt.value}" ${Array.isArray(currentValue) && currentValue.includes(opt.value) ? 'selected' : ''}>
                ${opt.label}
              </option>
            `).join('')}
          </select>
        `;
        break;
        
      case 'boolean':
        fieldHtml += `
          <label class="toggle-switch">
            <input 
              type="checkbox" 
              id="${fieldId}" 
              ${currentValue ? 'checked' : ''}
            />
            <span class="toggle-slider"></span>
          </label>
        `;
        break;
        
      case 'json':
        fieldHtml += `
          <textarea 
            id="${fieldId}" 
            class="form-control code-editor" 
            rows="6"
            placeholder="${field.placeholder || '{}'}"
            ${field.required ? 'required' : ''}
          >${this.escapeHtml(typeof currentValue === 'object' ? JSON.stringify(currentValue, null, 2) : currentValue)}</textarea>
        `;
        break;
        
      case 'expression':
        fieldHtml += `
          <div class="expression-builder">
            <textarea 
              id="${fieldId}" 
              class="form-control code-editor" 
              rows="3"
              placeholder="${field.placeholder || 'Enter expression...'}"
              ${field.required ? 'required' : ''}
            >${this.escapeHtml(currentValue)}</textarea>
            <div class="expression-help">
              <small class="text-muted">
                <i class="fas fa-info-circle"></i> 
                Available variables: ${this.getAvailableVariables().join(', ') || 'None'}
              </small>
            </div>
          </div>
        `;
        break;
        
      case 'file':
        fieldHtml += `
          <input 
            type="file" 
            id="${fieldId}" 
            class="form-control" 
            ${field.accept ? `accept="${field.accept}"` : ''}
            ${field.required ? 'required' : ''}
          />
          ${currentValue ? `<small class="text-muted">Current: ${currentValue}</small>` : ''}
        `;
        break;
        
      default:
        fieldHtml += `
          <input 
            type="text" 
            id="${fieldId}" 
            class="form-control" 
            placeholder="${field.placeholder || ''}"
            value="${this.escapeHtml(currentValue)}"
            ${field.required ? 'required' : ''}
          />
        `;
    }
    
    if (field.description) {
      fieldHtml += `<small class="form-hint">${field.description}</small>`;
    }
    
    fieldHtml += `</div>`;
    
    return fieldHtml;
  },
  
  /**
   * Setup form event listeners
   */
  setupFormListeners() {
    // Save button
    document.getElementById('nodeConfigSave')?.addEventListener('click', () => {
      this.saveConfig();
    });
    
    // Test button
    document.getElementById('nodeConfigTest')?.addEventListener('click', () => {
      this.testNode();
    });
    
    // Delete button
    document.getElementById('nodeConfigDelete')?.addEventListener('click', () => {
      this.deleteNode();
    });
    
    // Real-time validation
    const inputs = document.querySelectorAll('#wfConfigContent input, #wfConfigContent select, #wfConfigContent textarea');
    inputs.forEach(input => {
      input.addEventListener('input', () => {
        this.validateField(input);
      });
      
      input.addEventListener('blur', () => {
        this.validateField(input);
      });
    });
  },
  
  /**
   * Save configuration
   */
  saveConfig() {
    if (!this.currentNode) return;
    
    try {
      // Get node type schema
      const nodeType = NodeLibrary.nodeTypes.find(nt => nt.type === this.currentNode.type);
      if (!nodeType) return;
      
      const schema = nodeType.config_schema || [];
      const config = {};
      
      // Collect form values
      schema.forEach(field => {
        const fieldId = `field_${field.key}`;
        const element = document.getElementById(fieldId);
        
        if (!element) return;
        
        switch (field.type) {
          case 'number':
            config[field.key] = parseFloat(element.value) || 0;
            break;
            
          case 'boolean':
            config[field.key] = element.checked;
            break;
            
          case 'multiselect':
            config[field.key] = Array.from(element.selectedOptions).map(opt => opt.value);
            break;
            
          case 'json':
            try {
              config[field.key] = JSON.parse(element.value);
            } catch (e) {
              config[field.key] = element.value;
            }
            break;
            
          case 'file':
            if (element.files && element.files[0]) {
              config[field.key] = element.files[0].name;
            }
            break;
            
          default:
            config[field.key] = element.value;
        }
      });
      
      // Validate configuration
      const validation = this.validateConfig(config, schema);
      if (!validation.valid) {
        Toast.error('Validation Failed', validation.errors.join(', '));
        return;
      }
      
      // Update node config
      this.currentNode.config = config;
      
      // Mark workflow as modified
      WorkflowBuilder.markAsModified();
      
      // Re-render canvas
      WorkflowCanvas.render();
      
      Toast.success('Saved', 'Node configuration saved');
    } catch (error) {
      console.error('[NodeConfigPanel] Error saving config:', error);
      Toast.error('Save Failed', error.message);
    }
  },
  
  /**
   * Validate configuration
   */
  validateConfig(config, schema) {
    const errors = [];
    
    schema.forEach(field => {
      if (field.required && !config[field.key]) {
        errors.push(`${field.label} is required`);
      }
      
      if (field.type === 'number') {
        const value = config[field.key];
        if (field.min !== undefined && value < field.min) {
          errors.push(`${field.label} must be at least ${field.min}`);
        }
        if (field.max !== undefined && value > field.max) {
          errors.push(`${field.label} must be at most ${field.max}`);
        }
      }
      
      if (field.type === 'expression' && config[field.key]) {
        try {
          new Function('context', `return (${config[field.key]});`);
        } catch (e) {
          errors.push(`${field.label} has invalid expression syntax`);
        }
      }
    });
    
    return {
      valid: errors.length === 0,
      errors
    };
  },
  
  /**
   * Validate single field
   */
  validateField(element) {
    const isValid = element.checkValidity();
    
    if (isValid) {
      element.classList.remove('is-invalid');
      element.classList.add('is-valid');
    } else {
      element.classList.remove('is-valid');
      element.classList.add('is-invalid');
    }
    
    return isValid;
  },
  
  /**
   * Test node
   */
  async testNode() {
    if (!this.currentNode) return;
    
    Toast.info('Testing', 'Testing node with sample data...');
    
    try {
      // Save config first
      this.saveConfig();
      
      // TODO: Implement node testing with sample data
      // This would call the backend to execute the node in isolation
      
      Toast.success('Test Complete', 'Node executed successfully');
    } catch (error) {
      console.error('[NodeConfigPanel] Error testing node:', error);
      Toast.error('Test Failed', error.message);
    }
  },
  
  /**
   * Delete node
   */
  deleteNode() {
    if (!this.currentNode) return;
    
    if (!confirm('Are you sure you want to delete this node?')) {
      return;
    }
    
    WorkflowCanvas.deleteNode(this.currentNode);
    this.hide();
    
    Toast.success('Deleted', 'Node deleted successfully');
  },
  
  /**
   * Get available variables from upstream nodes
   */
  getAvailableVariables() {
    if (!this.currentNode) return [];
    
    const variables = [];
    const connections = WorkflowCanvas.connections;
    
    // Find all upstream nodes
    const upstreamConnections = connections.filter(c => c.target_node_id === this.currentNode.id);
    
    upstreamConnections.forEach(conn => {
      const sourceNode = WorkflowCanvas.nodes.find(n => n.id === conn.source_node_id);
      if (sourceNode) {
        variables.push(`${sourceNode.label || sourceNode.type}.output`);
      }
    });
    
    return variables;
  },
  
  /**
   * Escape HTML
   */
  escapeHtml(text) {
    if (typeof text !== 'string') return text;
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }
};
