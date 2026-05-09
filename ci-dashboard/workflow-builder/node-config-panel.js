/**
 * Node Configuration Panel Component
 * n8n-style multi-tab configuration with dynamic display logic
 */

const NodeConfigPanel = {
  currentNode: null,
  activeTab: 'parameters',
  initialized: false,
  
  init() {
    if (this.initialized) return;
    console.log('[NodeConfigPanel] Initializing...');
    this.initialized = true;
    
    WorkflowCanvas.on('nodeDoubleClicked', (node) => {
      this.showConfig(node);
    });
    
    WorkflowCanvas.on('nodeDeselected', () => {
      this.hide();
    });
  },
  
  async showConfig(node) {
    this.currentNode = node;
    this.activeTab = 'parameters';
    
    const panel = document.getElementById('wfConfigPanel');
    const content = document.getElementById('wfConfigContent');
    
    if (!panel || !content) return;
    
    panel.classList.remove('hidden');
    this.render();
  },
  
  hide() {
    const panel = document.getElementById('wfConfigPanel');
    if (panel) panel.classList.add('hidden');
    this.currentNode = null;
  },

  switchTab(tab) {
    this.activeTab = tab;
    this.render();
  },
  
  render() {
    const content = document.getElementById('wfConfigContent');
    if (!content || !this.currentNode) return;
    
    const nodeType = NodeLibrary.nodeTypes.find(nt => nt.name === this.currentNode.type);
    
    if (!nodeType) {
      content.innerHTML = '<div class="p-4 text-center text-muted">Node configuration not available</div>';
      return;
    }
    
    content.innerHTML = `
      <div class="node-config-container h-full flex flex-col">
        <!-- Header -->
        <div class="node-config-header">
          <div class="node-config-icon" style="background: ${nodeType.color}">
            <i class="fas ${nodeType.icon}"></i>
          </div>
          <div class="node-config-info">
            <h4>${this.currentNode.label || nodeType.displayName}</h4>
            <p>${nodeType.description}</p>
          </div>
        </div>

        <!-- Tabs -->
        <div class="node-config-tabs flex border-b bg-white">
          <button onclick="NodeConfigPanel.switchTab('parameters')" class="flex-1 py-2 text-xs font-bold ${this.activeTab === 'parameters' ? 'border-b-2 border-blue-500 text-blue-500' : 'text-gray-500'}">Parameters</button>
          <button onclick="NodeConfigPanel.switchTab('settings')" class="flex-1 py-2 text-xs font-bold ${this.activeTab === 'settings' ? 'border-b-2 border-blue-500 text-blue-500' : 'text-gray-500'}">Settings</button>
          <button onclick="NodeConfigPanel.switchTab('output')" class="flex-1 py-2 text-xs font-bold ${this.activeTab === 'output' ? 'border-b-2 border-blue-500 text-blue-500' : 'text-gray-500'}">Output</button>
        </div>

        <!-- Form Content -->
        <div class="node-config-body flex-1 overflow-y-auto p-4 bg-white">
          ${this.activeTab === 'parameters' ? this.renderParameters(nodeType) : this.activeTab === 'settings' ? this.renderSettings() : this.renderOutput()}
        </div>

        <!-- Footer Actions -->
        <div class="node-config-footer p-4 border-t flex gap-2 bg-gray-50">
          <button onclick="NodeConfigPanel.saveConfig()" class="btn btn-primary flex-1 btn-sm"><i class="fas fa-save mr-2"></i>Save</button>
          <button onclick="NodeConfigPanel.deleteNode()" class="btn btn-danger btn-sm"><i class="fas fa-trash"></i></button>
        </div>
      </div>
    `;

    this.setupEventListeners();
  },

  renderParameters(nodeType) {
    const config = this.currentNode.config || {};
    let html = '<div class="space-y-4">';
    
    // Node Label (Global Field)
    html += `
      <div class="form-group mb-4">
        <div class="config-field-header">
          <label class="config-field-label">Node Name</label>
        </div>
        <input type="text" id="nodeLabelInput" class="form-control text-sm" value="${this.currentNode.label || ''}" placeholder="${nodeType.displayName}">
      </div>
      <div class="border-b my-4"></div>
    `;

    nodeType.properties.forEach(prop => {
      // Check if property is explicitly hidden
      if (prop.hidden) {
        return;
      }

      // Check display conditions
      if (prop.displayOptions && !this.checkDisplayOptions(prop.displayOptions)) {
        return;
      }

      html += `
        <div class="form-group mb-4" data-prop-name="${prop.name}">
          <div class="config-field-header">
            <label class="config-field-label">
              ${prop.displayName}
              ${prop.required ? '<span class="required-marker">*</span>' : ''}
              ${prop.description ? this.renderTooltipIcon(prop.description) : ''}
            </label>
            ${prop.type !== 'boolean' ? '<button class="expression-btn" title="Toggle expression">{ }</button>' : ''}
          </div>
          ${this.renderField(prop, config[prop.name])}
        </div>
      `;
    });

    html += '</div>';
    return html;
  },

  renderField(prop, value) {
    const id = `prop_${prop.name}`;
    const val = value !== undefined ? value : prop.default;
    const placeholder = prop.placeholder ? `placeholder="${prop.placeholder}"` : '';

    switch (prop.type) {
      case 'options':
        return `
          <select id="${id}" class="form-control text-sm" onchange="NodeConfigPanel.onFieldChange()">
            ${prop.options.map(opt => `<option value="${opt.value}" ${val === opt.value ? 'selected' : ''}>${opt.name}</option>`).join('')}
          </select>
        `;
      case 'boolean':
        return `
          <div class="flex items-center">
             <input type="checkbox" id="${id}" ${val ? 'checked' : ''} class="w-4 h-4 text-blue-600 rounded focus:ring-blue-500">
             <span class="ml-2 text-xs text-gray-600">Enabled</span>
          </div>
        `;
      case 'number':
        return `<input type="number" id="${id}" class="form-control text-sm" value="${val}" ${placeholder} ${prop.min !== undefined ? `min="${prop.min}"` : ''} ${prop.max !== undefined ? `max="${prop.max}"` : ''}>`;
      case 'textarea':
        return `<textarea id="${id}" class="form-control text-sm font-mono" rows="4" ${placeholder}>${val}</textarea>`;
      case 'json':
        return `<textarea id="${id}" class="form-control text-sm font-mono" rows="6" ${placeholder}>${typeof val === 'object' ? JSON.stringify(val, null, 2) : val}</textarea>`;
      default:
        return `<input type="text" id="${id}" class="form-control text-sm" value="${val || ''}" ${placeholder}>`;
    }
  },

  renderTooltipIcon(description) {
    return `<span class="tooltip-icon" data-tooltip="${description}">ⓘ</span>`;
  },

  renderOutput() {
    if (!this.currentNode) {
      return '<div class="p-4 text-center text-muted">Belum ada data output. Jalankan workflow untuk melihat output node ini.</div>';
    }

    if (this.currentNode.lastError) {
      return this.renderErrorTab();
    }

    if (this.currentNode.lastOutput) {
      return `<pre class="output-preview">${JSON.stringify(this.currentNode.lastOutput, null, 2)}</pre>`;
    }

    return '<div class="p-4 text-center text-muted">Belum ada data output. Jalankan workflow untuk melihat output node ini.</div>';
  },

  renderErrorTab() {
    if (!this.currentNode || !this.currentNode.lastError) {
      return '<div class="p-4 text-center text-muted">Tidak ada error</div>';
    }

    return `
      <div class="error-tab-content">
        <div class="error-node-name">Error pada node: ${this.currentNode.label || this.currentNode.type}</div>
        <div class="error-message">${this.currentNode.lastError}</div>
      </div>
    `;
  },

  renderSettings() {
    const settings = this.currentNode.settings || {};
    return `
      <div class="space-y-6">
        <div class="setting-group">
          <label class="form-label text-[10px] uppercase font-bold text-gray-400 mb-2 block">Execution Settings</label>
          <div class="space-y-4">
            <div class="flex items-center justify-between">
              <span class="text-xs text-gray-700">Continue on Fail</span>
              <input type="checkbox" id="setting_continueOnFail" ${settings.continueOnFail ? 'checked' : ''} class="w-4 h-4">
            </div>
            <div class="flex items-center justify-between">
              <span class="text-xs text-gray-700">Always Output Data</span>
              <input type="checkbox" id="setting_alwaysOutputData" ${settings.alwaysOutputData ? 'checked' : ''} class="w-4 h-4">
            </div>
            <div class="flex items-center justify-between">
              <span class="text-xs text-gray-700">Execute Once</span>
              <input type="checkbox" id="setting_executeOnce" ${settings.executeOnce ? 'checked' : ''} class="w-4 h-4">
            </div>
          </div>
        </div>

        <div class="border-b"></div>

        <div class="setting-group">
          <label class="form-label text-[10px] uppercase font-bold text-gray-400 mb-2 block">Retry Settings</label>
          <div class="space-y-4">
            <div class="form-group">
              <span class="text-[10px] text-gray-500 mb-1 block">Number of Retries</span>
              <input type="number" id="setting_retryCount" class="form-control text-sm" value="${settings.retryCount || 0}" min="0" max="5">
            </div>
            <div class="form-group">
              <span class="text-[10px] text-gray-500 mb-1 block">Retry Delay (ms)</span>
              <input type="number" id="setting_retryDelay" class="form-control text-sm" value="${settings.retryDelay || 1000}" step="500">
            </div>
          </div>
        </div>
      </div>
    `;
  },

  checkDisplayOptions(options) {
    if (!options || !options.show) return true;
    
    // options.show = { propertyName: ['value1', 'value2'] }
    for (const [propName, values] of Object.entries(options.show)) {
      // Find current value of dependency property
      const el = document.getElementById(`prop_${propName}`);
      let currentVal;
      if (el) {
        currentVal = el.value;
      } else {
        // Check current node config if element not yet in DOM
        currentVal = (this.currentNode.config || {})[propName];
        // If still not found, check node type defaults
        if (currentVal === undefined) {
           const nodeType = NodeLibrary.nodeTypes.find(nt => nt.name === this.currentNode.type);
           const prop = nodeType.properties.find(p => p.name === propName);
           currentVal = prop ? prop.default : undefined;
        }
      }
      
      if (!values.includes(currentVal)) return false;
    }
    return true;
  },

  onFieldChange() {
    // Re-render to handle displayOptions
    this.render();
  },

  setupEventListeners() {
    // No specific global listeners needed as we use inline handlers for simplicity in this version
  },

  saveConfig() {
    if (!this.currentNode) return;
    
    const nodeType = NodeLibrary.nodeTypes.find(nt => nt.name === this.currentNode.type);
    if (!nodeType) return;

    // Save Label
    const labelInput = document.getElementById('nodeLabelInput');
    if (labelInput) this.currentNode.label = labelInput.value;

    // Save Parameters
    const config = {};
    nodeType.properties.forEach(prop => {
      const el = document.getElementById(`prop_${prop.name}`);
      if (el) {
        if (prop.type === 'boolean') {
          config[prop.name] = el.checked;
        } else if (prop.type === 'number') {
          config[prop.name] = parseFloat(el.value);
        } else if (prop.type === 'json') {
          try {
            config[prop.name] = JSON.parse(el.value);
          } catch (e) {
            config[prop.name] = el.value;
          }
        } else {
          config[prop.name] = el.value;
        }
      }
    });
    this.currentNode.config = config;

    // Save Settings
    const settings = {
      continueOnFail: document.getElementById('setting_continueOnFail')?.checked || false,
      alwaysOutputData: document.getElementById('setting_alwaysOutputData')?.checked || false,
      executeOnce: document.getElementById('setting_executeOnce')?.checked || false,
      retryCount: parseInt(document.getElementById('setting_retryCount')?.value) || 0,
      retryDelay: parseInt(document.getElementById('setting_retryDelay')?.value) || 1000
    };
    this.currentNode.settings = settings;

    WorkflowCanvas.render();
    if (typeof WorkflowManager !== 'undefined') {
      WorkflowManager.markAsModified();
    }
    Toast.success('Saved', 'Configuration saved successfully');
  },

  deleteNode() {
    if (confirm('Are you sure you want to delete this node?')) {
      WorkflowCanvas.deleteNode(this.currentNode.id);
      this.hide();
    }
  }
};
