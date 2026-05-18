/**
 * Node Configuration Panel Component
 * n8n-style multi-tab configuration with dynamic display logic
 */

const NodeConfigPanel = {
  currentNode: null,
  activeTab: 'parameters',
  initialized: false,
  tempData: null,
  originalSnapshot: null,
  
  init() {
    if (this.initialized) return;
    console.log('[NodeConfigPanel] Initializing...');
    this.initialized = true;
    
    WorkflowCanvas.on('nodeDoubleClicked', (node) => {
      this.showConfig(node);
    });
    
    WorkflowCanvas.on('nodeDeselected', () => {
      this.requestHide();
    });
  },
  
  getDefaultSettings() {
    return {
      continueOnFail: false,
      alwaysOutputData: false,
      executeOnce: false,
      retryCount: 0,
      retryDelay: 1000
    };
  },

  getDefaultConfig(nodeType) {
    const config = {};
    if (nodeType && nodeType.properties) {
        nodeType.properties.forEach(prop => {
            config[prop.name] = prop.default;
        });
    }
    return config;
  },

  async showConfig(node, options = {}) {
    this.currentNode = node;
    this.activeTab = 'parameters';
    this.highlightFields = options.highlightFields || [];
    
    const nodeType = NodeLibrary.nodeTypes.find(nt => nt.name === node.type);
    
    // Create temp data with defaults + current values
    this.tempData = {
        label: node.label || '',
        config: {
            ...this.getDefaultConfig(nodeType),
            ...(node.config || {})
        },
        settings: {
            ...this.getDefaultSettings(),
            ...(node.settings || {})
        }
    };
    
    // Deep clone to ensure no references
    this.tempData = JSON.parse(JSON.stringify(this.tempData));
    
    // Store original state for dirty checking
    this.originalSnapshot = JSON.stringify(this.tempData);

    const panel = document.getElementById('wfConfigPanel');
    const content = document.getElementById('wfConfigContent');
    
    if (!panel || !content) return;
    
    panel.classList.remove('hidden');
    this.render();
  },
  
  requestHide() {
    if (!this.currentNode) {
        this.hide();
        return;
    }
    
    // Sync current tab before checking
    this.syncCurrentTabToTemp();
    
    if (this.isDirty()) {
        openModal('unsavedChangesModal');
        
        document.getElementById('unsavedSaveBtn').onclick = () => {
            this.saveConfig();
            closeModal('unsavedChangesModal');
            this.hide();
        };
        
        document.getElementById('unsavedDiscardBtn').onclick = () => {
            closeModal('unsavedChangesModal');
            this.hide();
        };
        
        return;
    }
    
    this.hide();
  },

  hide() {
    const panel = document.getElementById('wfConfigPanel');
    if (panel) panel.classList.add('hidden');
    this.currentNode = null;
    this.tempData = null;
    this.originalSnapshot = null;
    this.highlightFields = [];
  },

  isDirty() {
    if (!this.tempData || !this.originalSnapshot) return false;
    // We use a normalized comparison
    return JSON.stringify(this.tempData) !== this.originalSnapshot;
  },

  switchTab(tab) {
    this.syncCurrentTabToTemp();
    this.activeTab = tab;
    this.render();
  },
  
  syncCurrentTabToTemp() {
    if (!this.currentNode || !this.tempData) return;

    if (this.activeTab === 'parameters') {
        const labelInput = document.getElementById('nodeLabelInput');
        if (labelInput) this.tempData.label = labelInput.value;

        const nodeType = NodeLibrary.nodeTypes.find(nt => nt.name === this.currentNode.type);
        if (nodeType) {
            nodeType.properties.forEach(prop => {
                const el = document.getElementById(`prop_${prop.name}`);
                if (el) {
                    if (prop.type === 'boolean') {
                        this.tempData.config[prop.name] = el.checked;
                    } else if (prop.type === 'number') {
                        const val = parseFloat(el.value);
                        this.tempData.config[prop.name] = isNaN(val) ? el.value : val;
                    } else if (prop.type === 'json') {
                        try {
                            this.tempData.config[prop.name] = JSON.parse(el.value);
                        } catch (e) {
                            this.tempData.config[prop.name] = el.value;
                        }
                    } else {
                        this.tempData.config[prop.name] = el.value;
                    }
                }
            });
        }
    } else if (this.activeTab === 'settings') {
        this.tempData.settings = {
            continueOnFail: document.getElementById('setting_continueOnFail')?.checked || false,
            alwaysOutputData: document.getElementById('setting_alwaysOutputData')?.checked || false,
            executeOnce: document.getElementById('setting_executeOnce')?.checked || false,
            retryCount: parseInt(document.getElementById('setting_retryCount')?.value) || 0,
            retryDelay: parseInt(document.getElementById('setting_retryDelay')?.value) || 1000
        };
    }
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
            <i class="${nodeType.icon && nodeType.icon.includes(' ') ? nodeType.icon : 'fas ' + nodeType.icon}"></i>
          </div>
          <div class="node-config-info">
            <h4>${this.tempData.label || nodeType.displayName}</h4>
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
    const config = this.tempData.config || {};
    let html = '<div class="space-y-4">';
    
    // Node Label (Global Field)
    html += `
      <div class="form-group mb-4">
        <div class="config-field-header">
          <label class="config-field-label">Node Name</label>
        </div>
        <input type="text" id="nodeLabelInput" class="form-control text-sm" value="${this.tempData.label || ''}" placeholder="${nodeType.displayName}" oninput="NodeConfigPanel.onFieldChange()">
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

      const isHighlighted = this.highlightFields && this.highlightFields.includes(prop.name);
      html += `
        <div class="form-group mb-4 ${isHighlighted ? 'field-error-highlight' : ''}" data-prop-name="${prop.name}">
          <div class="config-field-header">
            <label class="config-field-label">
              ${prop.displayName}
              ${prop.required ? '<span class="required-marker">*</span>' : ''}
              ${prop.description ? this.renderTooltipIcon(prop.description) : ''}
            </label>
            ${prop.type !== 'boolean' ? '<button class="expression-btn" title="Toggle expression">{ }</button>' : ''}
          </div>
          ${this.renderField(prop, config[prop.name], isHighlighted)}
        </div>
      `;
    });

    html += '</div>';
    return html;
  },

  renderField(prop, value, isError = false) {
    const id = `prop_${prop.name}`;
    const val = value !== undefined ? value : prop.default;
    const placeholder = prop.placeholder ? `placeholder="${prop.placeholder}"` : '';
    const errorClass = isError ? 'border-red-500 bg-red-50' : '';

    let fieldHtml = '';
    switch (prop.type) {
      case 'options':
        fieldHtml = `
          <select id="${id}" class="form-control text-sm ${errorClass}" onchange="NodeConfigPanel.onFieldChange()">
            ${prop.options.map(opt => `<option value="${opt.value}" ${val === opt.value ? 'selected' : ''}>${opt.name}</option>`).join('')}
          </select>
        `;
        break;
      case 'boolean':
        fieldHtml = `
          <div class="flex items-center">
             <input type="checkbox" id="${id}" ${val ? 'checked' : ''} class="w-4 h-4 text-blue-600 rounded focus:ring-blue-500" onchange="NodeConfigPanel.onFieldChange()">
             <span class="ml-2 text-xs text-gray-600">Enabled</span>
          </div>
        `;
        break;
      case 'number':
        fieldHtml = `<input type="number" id="${id}" class="form-control text-sm ${errorClass}" value="${val}" ${placeholder} ${prop.min !== undefined ? `min="${prop.min}"` : ''} ${prop.max !== undefined ? `max="${prop.max}"` : ''} oninput="NodeConfigPanel.onFieldChange()">`;
        break;
      case 'textarea':
        fieldHtml = `<textarea id="${id}" class="form-control text-sm font-mono" rows="4" ${placeholder} oninput="NodeConfigPanel.onFieldChange()">${val}</textarea>`;
        break;
      case 'json':
        fieldHtml = `<textarea id="${id}" class="form-control text-sm font-mono" rows="6" ${placeholder} oninput="NodeConfigPanel.onFieldChange()">${typeof val === 'object' ? JSON.stringify(val, null, 2) : val}</textarea>`;
        break;
      default:
        fieldHtml = `<input type="text" id="${id}" class="form-control text-sm ${errorClass}" value="${val || ''}" ${placeholder} oninput="NodeConfigPanel.onFieldChange()">`;
        break;
    }

    // Add custom button for Instagram session extraction
    if (prop.name === 'sessionid' && this.currentNode?.type === 'playwright-instagram') {
      fieldHtml += `
        <button onclick="NodeConfigPanel.extractInstagramSession()" type="button" class="mt-2 w-full btn btn-sm" style="background-color: #E1306C; color: white;">
          <i class="fas fa-magic mr-1"></i> Auto-Get Cookie dari Browser
        </button>
        <div id="ig_auth_status" class="text-xs mt-1 hidden"></div>
      `;
    }

    // Add custom button for Facebook session extraction
    if ((prop.name === 'c_user' || prop.name === 'xs') && this.currentNode?.type === 'playwright-facebook') {
      if (prop.name === 'c_user') {
        fieldHtml += `
          <button onclick="NodeConfigPanel.extractFacebookSession()" type="button" class="mt-2 w-full btn btn-sm" style="background-color: #1877F2; color: white;">
            <i class="fas fa-magic mr-1"></i> Auto-Get Cookie dari Browser
          </button>
          <div id="fb_auth_status" class="text-xs mt-1 hidden"></div>
        `;
      }
    }

    // Add custom button for Excel/CSV upload
    if (prop.name === 'filePath' && this.currentNode?.type === 'read-excel') {
      fieldHtml += `
        <div class="flex gap-2 mt-2">
          <input type="file" id="excel_upload_input" class="hidden" accept=".xlsx,.xls,.csv,.json" onchange="NodeConfigPanel.handleExcelUpload(this)">
          <button onclick="document.getElementById('excel_upload_input').click()" type="button" class="flex-1 btn btn-sm" style="background-color: #1d6f42; color: white;">
            <i class="fas fa-upload mr-1"></i> Upload File Baru
          </button>
        </div>
        <div id="excel_upload_status" class="text-xs mt-1 hidden"></div>
      `;
    }

    // Add custom button for Telegram session generation
    if (prop.name === 'session_string' && this.currentNode?.type === 'telegram-client') {
      fieldHtml += `
        <button onclick="NodeConfigPanel.generateTelegramSession()" type="button" class="mt-2 w-full btn btn-sm" style="background-color: #0088cc; color: white;">
          <i class="fas fa-key mr-1"></i> Generate Session via API
        </button>
        <div id="tg_auth_status" class="text-xs mt-1 hidden"></div>
      `;
    }

    return fieldHtml;
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
    const settings = this.tempData.settings || {};
    return `
      <div class="space-y-6">
        <div class="setting-group">
          <label class="form-label text-[10px] uppercase font-bold text-gray-400 mb-2 block">Execution Settings</label>
          <div class="space-y-4">
            <div class="flex items-center justify-between">
              <span class="text-xs text-gray-700">Continue on Fail</span>
              <input type="checkbox" id="setting_continueOnFail" ${settings.continueOnFail ? 'checked' : ''} class="w-4 h-4" onchange="NodeConfigPanel.onFieldChange()">
            </div>
            <div class="flex items-center justify-between">
              <span class="text-xs text-gray-700">Always Output Data</span>
              <input type="checkbox" id="setting_alwaysOutputData" ${settings.alwaysOutputData ? 'checked' : ''} class="w-4 h-4" onchange="NodeConfigPanel.onFieldChange()">
            </div>
            <div class="flex items-center justify-between">
              <span class="text-xs text-gray-700">Execute Once</span>
              <input type="checkbox" id="setting_executeOnce" ${settings.executeOnce ? 'checked' : ''} class="w-4 h-4" onchange="NodeConfigPanel.onFieldChange()">
            </div>
          </div>
        </div>

        <div class="border-b"></div>

        <div class="setting-group">
          <label class="form-label text-[10px] uppercase font-bold text-gray-400 mb-2 block">Retry Settings</label>
          <div class="space-y-4">
            <div class="form-group">
              <span class="text-[10px] text-gray-500 mb-1 block">Number of Retries</span>
              <input type="number" id="setting_retryCount" class="form-control text-sm" value="${settings.retryCount || 0}" min="0" max="5" oninput="NodeConfigPanel.onFieldChange()">
            </div>
            <div class="form-group">
              <span class="text-[10px] text-gray-500 mb-1 block">Retry Delay (ms)</span>
              <input type="number" id="setting_retryDelay" class="form-control text-sm" value="${settings.retryDelay || 1000}" step="500" oninput="NodeConfigPanel.onFieldChange()">
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
      // Use tempData instead of DOM for display logic to be more consistent
      const currentVal = this.tempData.config[propName];
      
      if (currentVal === undefined) {
         // Check node type defaults
         const nodeType = NodeLibrary.nodeTypes.find(nt => nt.name === this.currentNode.type);
         const prop = nodeType.properties.find(p => p.name === propName);
         if (prop && !values.includes(prop.default)) return false;
      } else if (!values.includes(currentVal)) {
          return false;
      }
    }
    return true;
  },

  onFieldChange() {
    this.syncCurrentTabToTemp();
    
    // Clear highlights when user starts typing to provide immediate feedback
    if (this.highlightFields && this.highlightFields.length > 0) {
      this.highlightFields = [];
    }

    // Save focus to prevent cursor jumping
    const activeId = document.activeElement?.id;
    const selectionStart = document.activeElement?.selectionStart;
    const selectionEnd = document.activeElement?.selectionEnd;

    // Re-render to handle displayOptions
    this.render();

    // Restore focus
    if (activeId) {
      const el = document.getElementById(activeId);
      if (el) {
        el.focus();
        if (selectionStart !== undefined && el.setSelectionRange && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA')) {
          try {
            el.setSelectionRange(selectionStart, selectionEnd);
          } catch (e) { /* ignore if not support */ }
        }
      }
    }
  },

  setupEventListeners() {
    // No specific global listeners needed as we use inline handlers for simplicity in this version
  },

  saveConfig() {
    if (!this.currentNode || !this.tempData) return;
    
    this.syncCurrentTabToTemp();

    // Commit temp data to node
    this.currentNode.label = this.tempData.label;
    this.currentNode.config = JSON.parse(JSON.stringify(this.tempData.config));
    this.currentNode.settings = JSON.parse(JSON.stringify(this.tempData.settings));

    WorkflowCanvas.render();
    if (typeof WorkflowManager !== 'undefined') {
      WorkflowManager.markAsModified();
    }
    
    // Auto-save workflow to DB to prevent data loss on hard reload
    if (typeof WorkflowBuilder !== 'undefined' && WorkflowManager.currentWorkflow?.id) {
      WorkflowBuilder.saveWorkflow(true);
    }
    
    // Update snapshot after save
    this.originalSnapshot = JSON.stringify(this.tempData);
    
    Toast.success('Saved', 'Configuration saved successfully');
  },

  deleteNode() {
    if (confirm('Are you sure you want to delete this node?')) {
      WorkflowCanvas.deleteNode(this.currentNode.id);
      this.hide();
    }
  },

  async extractInstagramSession() {
    const statusEl = document.getElementById('ig_auth_status');
    statusEl.classList.remove('hidden', 'text-red-500', 'text-green-500');
    statusEl.classList.add('text-blue-500');
    statusEl.innerText = 'Membuka browser... silakan login di jendela baru.';
    
    try {
      const response = await BackendAPI.post('/workflows/instagram-auth', {});
      if (response && response.success) {
        document.getElementById('prop_sessionid').value = response.sessionid;
        this.tempData.config.sessionid = response.sessionid;
        statusEl.classList.replace('text-blue-500', 'text-green-500');
        statusEl.innerText = 'Berhasil! Session ID telah diisi otomatis.';
        this.saveConfig();
      } else {
        statusEl.classList.replace('text-blue-500', 'text-red-500');
        statusEl.innerText = response.error || 'Gagal mengambil session.';
      }
    } catch (e) {
      statusEl.classList.replace('text-blue-500', 'text-red-500');
      statusEl.innerText = 'Error: ' + e.message;
    }
  },

  async extractFacebookSession() {
    const statusEl = document.getElementById('fb_auth_status');
    statusEl.classList.remove('hidden', 'text-red-500', 'text-green-500');
    statusEl.classList.add('text-blue-500');
    statusEl.innerText = 'Membuka browser... silakan login di jendela baru.';
    
    try {
      const response = await BackendAPI.post('/workflows/facebook-auth', {});
      if (response && response.success) {
        document.getElementById('prop_c_user').value = response.c_user;
        document.getElementById('prop_xs').value = response.xs;
        this.tempData.config.c_user = response.c_user;
        this.tempData.config.xs = response.xs;
        statusEl.classList.replace('text-blue-500', 'text-green-500');
        statusEl.innerText = 'Berhasil! Cookies c_user & xs telah diisi otomatis.';
        this.saveConfig();
      } else {
        statusEl.classList.replace('text-blue-500', 'text-red-500');
        statusEl.innerText = response.error || 'Gagal mengambil session.';
      }
    } catch (e) {
      statusEl.classList.replace('text-blue-500', 'text-red-500');
      statusEl.innerText = 'Error: ' + e.message;
    }
  },

  async handleExcelUpload(input) {
    const file = input.files[0];
    if (!file) return;

    const statusEl = document.getElementById('excel_upload_status');
    const pathInput = document.getElementById('prop_filePath');
    
    if (!statusEl || !pathInput) return;
    
    statusEl.innerHTML = '<i class="fas fa-spinner fa-spin text-blue-500 mr-1"></i> Mengunggah...';
    statusEl.classList.remove('hidden');
    statusEl.className = 'text-xs mt-1 text-blue-500';
    
    try {
      const b64 = await new Promise((res, rej) => {
        const r = new FileReader();
        r.onload = () => res(r.result.split(',')[1]);
        r.onerror = rej;
        r.readAsDataURL(file);
      });

      const response = await BackendAPI.post('/test-data/upload', {
        filename: file.name,
        file_data: b64
      });

      if (response && response.success) {
        pathInput.value = response.path;
        this.tempData.config.filePath = response.path;
        this.onFieldChange();
        statusEl.innerHTML = `<i class="fas fa-check-circle mr-1"></i> File "${file.name}" berhasil diunggah!`;
        statusEl.className = 'text-xs mt-1 text-green-600 font-bold';
        // Auto save to workflow
        this.saveConfig();
      } else {
        throw new Error(response.error || 'Gagal mengunggah file');
      }
    } catch (error) {
      statusEl.innerHTML = `<i class="fas fa-exclamation-circle mr-1"></i> ${error.message}`;
      statusEl.className = 'text-xs mt-1 text-red-500 font-bold';
    } finally {
      input.value = ''; // Reset input so same file can be uploaded again if needed
    }
  },

  // Telegram Session Generation Logic
  generateTelegramSession() {
    const apiId = this.tempData.config.api_id;
    const apiHash = this.tempData.config.api_hash;
    
    if (!apiId || !apiHash) {
        Toast.warning('Missing Credentials', 'Please fill API ID and API Hash first');
        return;
    }
    
    document.getElementById('tgStep1').classList.remove('hidden');
    document.getElementById('tgStep2').classList.add('hidden');
    document.getElementById('tgLoading').classList.add('hidden');
    openModal('telegramLoginModal');
  },

  async tgRequestCode() {
    const phone = document.getElementById('tgPhoneInput').value;
    if (!phone) {
        Toast.warning('Required', 'Phone number is required');
        return;
    }
    
    this.showTgLoading('Requesting code...');
    
    try {
        const response = await BackendAPI.post('/workflows/telegram-auth/request-code', {
            apiId: this.tempData.config.api_id,
            apiHash: this.tempData.config.api_hash,
            phone: phone
        });
        
        if (response && response.success) {
            this.tgSessionToken = response.token; // Store token for step 2
            document.getElementById('tgStep1').classList.add('hidden');
            document.getElementById('tgStep2').classList.remove('hidden');
            document.getElementById('tgLoading').classList.add('hidden');
        } else {
            throw new Error(response.error || 'Failed to request code');
        }
    } catch (error) {
        this.hideTgLoading();
        Toast.error('Error', error.message);
    }
  },

  async tgFinalizeLogin() {
    const code = document.getElementById('tgCodeInput').value;
    const password = document.getElementById('tgPasswordInput').value;
    
    if (!code) {
        Toast.warning('Required', 'Verification code is required');
        return;
    }
    
    this.showTgLoading('Generating session string...');
    
    try {
        const response = await BackendAPI.post('/workflows/telegram-auth/finalize', {
            token: this.tgSessionToken,
            code: code,
            password: password
        });
        
        if (response && response.success && response.sessionString) {
            document.getElementById('prop_session_string').value = response.sessionString;
            this.tempData.config.session_string = response.sessionString;
            this.onFieldChange();
            this.saveConfig();
            closeModal('telegramLoginModal');
            Toast.success('Success', 'Telegram session generated and saved!');
        } else {
            throw new Error(response.error || 'Failed to finalize login');
        }
    } catch (error) {
        this.hideTgLoading();
        Toast.error('Error', error.message);
    }
  },

  tgBackToStep1() {
    document.getElementById('tgStep2').classList.add('hidden');
    document.getElementById('tgStep1').classList.remove('hidden');
  },

  showTgLoading(text) {
    document.getElementById('tgStep1').classList.add('hidden');
    document.getElementById('tgStep2').classList.add('hidden');
    document.getElementById('tgLoading').classList.remove('hidden');
    document.getElementById('tgLoadingText').innerText = text;
  },

  hideTgLoading() {
    document.getElementById('tgLoading').classList.add('hidden');
    // Logic to return to current step would be better, but for now:
    if (this.tgSessionToken) {
        document.getElementById('tgStep2').classList.remove('hidden');
    } else {
        document.getElementById('tgStep1').classList.remove('hidden');
    }
  },

  cancelTelegramLogin() {
    this.tgSessionToken = null;
    closeModal('telegramLoginModal');
  }
};
