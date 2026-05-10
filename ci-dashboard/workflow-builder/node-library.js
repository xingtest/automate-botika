/**
 * Node Library Component
 * Displays available node types that can be dragged onto the canvas
 * Refactored to n8n-style declarative architecture
 */

const NodeLibrary = {
  nodeTypes: [],
  searchQuery: '',
  selectedCategory: 'all',
  initialized: false,
  
  /**
   * Initialize node library
   */
  async init() {
    if (this.initialized) return;
    console.log('[NodeLibrary] Initializing...');
    this.initialized = true;
    await this.loadNodeTypes();
    this.setupEventListeners();
    this.render();
  },
  
  /**
   * Load node types (using hardcoded defaults for now)
   */
  async loadNodeTypes() {
    // We'll use the deeply enhanced declarative schemas here
    this.nodeTypes = this.getDeclarativeNodeTypes();
    console.log('[NodeLibrary] Loaded declarative node types:', this.nodeTypes.length);
  },
  
  /**
   * n8n-style declarative node definitions
   */
  getDeclarativeNodeTypes() {
    return [
      // --- TRIGGERS ---
      {
        displayName: 'Manual Trigger',
        name: 'manual-trigger',
        category: 'Triggers',
        description: 'Start workflow manually',
        icon: 'fa-hand-pointer',
        color: '#f59e0b',
        inputs: [],
        outputs: ['main'],
        properties: [
          {
            displayName: 'Initial Data',
            name: 'initialData',
            type: 'json',
            default: '{}',
            description: 'Mock data to inject at start'
          }
        ]
      },
      {
        displayName: 'Schedule Trigger',
        name: 'schedule-trigger',
        category: 'Triggers',
        description: 'Start workflow on schedule',
        icon: 'fa-clock',
        color: '#f59e0b',
        inputs: [],
        outputs: ['main'],
        properties: [
          {
            displayName: 'Mode',
            name: 'mode',
            type: 'options',
            options: [
              { name: 'Every Minute', value: 'everyMinute' },
              { name: 'Every Hour', value: 'everyHour' },
              { name: 'Custom (Cron)', value: 'cron' }
            ],
            default: 'everyHour'
          },
          {
            displayName: 'Cron Expression',
            name: 'cronExpression',
            type: 'string',
            displayOptions: { show: { mode: ['cron'] } },
            default: '0 * * * *',
            description: 'Standard cron expression'
          }
        ]
      },
      {
        displayName: 'Read Excel / CSV',
        name: 'read-excel',
        category: 'Actions',
        description: 'Load data from Excel or CSV file',
        icon: 'fa-file-excel',
        color: '#1d6f42',
        inputs: ['main'],
        outputs: ['main'],
        properties: [
          {
            displayName: 'File Path',
            name: 'filePath',
            type: 'string',
            default: 'test-data/WABIS KB.xlsx',
            description: 'Path to the Excel/CSV file'
          },
          {
            displayName: 'Sheet Name',
            name: 'sheetName',
            type: 'string',
            default: 'Sheet1',
            displayOptions: { show: { fileType: ['excel'] } }
          }
        ]
      },
      // --- TEST AUTOMATION ---
      {
        displayName: 'Run Test',
        name: 'run-test',
        category: 'Actions',
        description: 'Execute platform tests',
        icon: 'fa-play-circle',
        color: '#3b82f6',
        inputs: ['main'],
        outputs: ['main'],
        properties: [
          {
            displayName: 'Platform',
            name: 'platform',
            type: 'options',
            options: [
              { name: 'WebChat', value: 'webchat' },
              { name: 'Telegram', value: 'telegram' },
              { name: 'Facebook', value: 'facebook' },
              { name: 'Instagram', value: 'instagram' },
              { name: 'DHAI', value: 'dhai' }
            ],
            default: 'webchat'
          },
          {
            displayName: 'Target URL',
            name: 'url',
            type: 'string',
            default: '',
            description: 'Override target URL'
          },
          {
            displayName: 'Headless',
            name: 'headless',
            type: 'boolean',
            default: true
          }
        ]
      },
      {
        displayName: 'Playwright Webchat',
        name: 'playwright-webchat',
        category: 'Actions',
        description: 'Execute Playwright test specifically for Webchat (Classic)',
        icon: 'fa-globe',
        color: '#2b6cb0',
        inputs: ['main'],
        outputs: ['main'],
        properties: [
          {
            displayName: 'Webchat URL',
            name: 'platform_url',
            type: 'string',
            required: true,
            default: 'https://chat.botika.online/EJUnkrW',
            placeholder: 'https://example.com/webchat',
            description: 'URL of the webchat interface'
          },
          {
            displayName: 'Test Data File',
            name: 'test_data_file',
            type: 'string',
            required: false,
            hidden: true,
            description: 'Path to CSV/Excel file (Optional if using input)'
          },
          {
            displayName: 'Tester Name',
            name: 'tester_name',
            type: 'string',
            default: 'Playwright Bot'
          },
          {
            displayName: 'Tester Email',
            name: 'tester_email',
            type: 'string',
            default: 'playwright@example.com'
          },
          {
            displayName: 'Tester Phone',
            name: 'tester_phone',
            type: 'string',
            default: '6281234567890'
          },
          {
            displayName: 'Greeting Message',
            name: 'greeting',
            type: 'string',
            default: 'Haloo'
          },
          {
            displayName: 'Headless',
            name: 'headless',
            type: 'boolean',
            default: true
          }
        ]
      },

      // --- AI & JUDGING ---
      {
        displayName: 'AI Evaluate',
        name: 'ai-evaluate',
        category: 'Actions',
        description: 'Evaluate with AI',
        icon: 'fa-brain',
        color: '#8b5cf6',
        inputs: ['main'],
        outputs: ['main'],
        properties: [
          {
            displayName: 'Resource',
            name: 'resource',
            type: 'options',
            options: [
              { name: 'Evaluation', value: 'evaluation' },
              { name: 'Prompt Builder', value: 'prompt' }
            ],
            default: 'evaluation'
          },
          {
            displayName: 'Operation',
            name: 'operation',
            type: 'options',
            displayOptions: { show: { resource: ['evaluation'] } },
            options: [
              { name: 'Score Response', value: 'score' },
              { name: 'Verify Safety', value: 'safety' }
            ],
            default: 'score'
          },
          {
            displayName: 'AI Provider',
            name: 'provider',
            type: 'options',
            options: [
              { name: 'Groq', value: 'groq' },
              { name: 'Gemini', value: 'gemini' },
              { name: 'OpenAI', value: 'openai' }
            ],
            default: 'groq'
          },
          {
            displayName: 'API Key',
            name: 'apiKey',
            type: 'string',
            default: '',
            description: 'Optional: Use a custom API key for this node. If empty, uses global settings.'
          },
          {
            displayName: 'Model (Groq)',
            name: 'model_groq',
            type: 'options',
            displayOptions: { show: { provider: ['groq'] } },
            options: [
              { name: 'Llama-3.1-8b-instant', value: 'llama-3.1-8b-instant' },
              { name: 'Llama3-8b-8192', value: 'llama3-8b-8192' },
              { name: 'Llama3-70b-8192', value: 'llama3-70b-8192' },
              { name: 'Mixtral-8x7b-32768', value: 'mixtral-8x7b-32768' }
            ],
            default: 'llama-3.1-8b-instant'
          },
          {
            displayName: 'Model (Gemini)',
            name: 'model_gemini',
            type: 'options',
            displayOptions: { show: { provider: ['gemini'] } },
            options: [
              { name: 'Gemini 3.1 Flash Lite (Preview)', value: 'gemini-3.1-flash-lite-preview' },
              { name: 'Gemini 1.5 Flash', value: 'gemini-1.5-flash' },
              { name: 'Gemini 1.5 Pro', value: 'gemini-1.5-pro' }
            ],
            default: 'gemini-3.1-flash-lite-preview'
          },
          {
            displayName: 'System Prompt',
            name: 'systemPrompt',
            type: 'textarea',
            displayOptions: { show: { operation: ['score'] } },
            default: `Anda adalah Senior QA Automation Judge. Tugas Anda adalah mengevaluasi kualitas jawaban Chatbot dibandingkan dengan jawaban referensi (Expected Answer).

KRITERIA EVALUASI:
1. Akurasi Faktual (0.0 - 0.4): Apakah informasi inti benar sesuai referensi?
2. Kelengkapan (0.0 - 0.3): Apakah semua poin penting dalam referensi disebutkan?
3. Relevansi & Nada (0.0 - 0.3): Apakah jawaban menjawab pertanyaan dengan nada yang tepat?

SCORING:
- Berikan skor total antara 0.00 hingga 1.00.
- Pass Threshold default adalah 0.70.

FORMAT OUTPUT (Wajib JSON):
{
  "score": 0.95,
  "explanation": "[✓] Jawaban sangat akurat dan mencakup semua poin referensi. Nada profesional."
}`,
            description: 'Define the persona of the judge'
          },
          {
            displayName: 'Temperature',
            name: 'temperature',
            type: 'number',
            default: 0.3,
            min: 0,
            max: 1
          },
          {
            displayName: 'Pass Threshold',
            name: 'scoring_threshold',
            type: 'number',
            default: 0.7,
            min: 0,
            max: 1,
            description: 'Nilai minimum (0.0–1.0) agar dianggap lulus'
          }
        ]
      },
      {
        displayName: 'Groq AI',
        name: 'groq-ai',
        category: 'AI',
        description: 'AI Evaluation using Groq models with custom credentials',
        icon: 'fa-bolt',
        color: '#f59e0b',
        inputs: ['main'],
        outputs: ['main'],
        properties: [
          {
            displayName: 'Groq API Key',
            name: 'apiKey',
            type: 'string',
            default: '',
            description: 'Custom API Key for Groq'
          },
          {
            displayName: 'Model',
            name: 'model',
            type: 'options',
            options: [
              { name: 'Llama-3.1-8b-instant', value: 'llama-3.1-8b-instant' },
              { name: 'Llama3-8b-8192', value: 'llama3-8b-8192' },
              { name: 'Llama3-70b-8192', value: 'llama3-70b-8192' },
              { name: 'Mixtral-8x7b-32768', value: 'mixtral-8x7b-32768' }
            ],
            default: 'llama-3.1-8b-instant'
          },
          {
            displayName: 'System Prompt',
            name: 'systemPrompt',
            type: 'textarea',
            default: `Anda adalah Senior QA Automation Judge. Tugas Anda adalah mengevaluasi kualitas jawaban Chatbot...`,
          },
          {
            displayName: 'Temperature',
            name: 'temperature',
            type: 'number',
            default: 0.3,
            min: 0,
            max: 1
          },
          {
            displayName: 'Pass Threshold',
            name: 'scoring_threshold',
            type: 'number',
            default: 0.7,
            min: 0,
            max: 1
          }
        ]
      },
      {
        displayName: 'Gemini AI',
        name: 'gemini-ai',
        category: 'AI',
        description: 'AI Evaluation using Google Gemini models with custom credentials',
        icon: 'fa-gem',
        color: '#4285f4',
        inputs: ['main'],
        outputs: ['main'],
        properties: [
          {
            displayName: 'Gemini API Key',
            name: 'apiKey',
            type: 'string',
            default: '',
            description: 'Custom API Key for Gemini'
          },
          {
            displayName: 'Model',
            name: 'model',
            type: 'options',
            options: [
              { name: 'Gemini 3.1 Flash Lite (Preview)', value: 'gemini-3.1-flash-lite-preview' },
              { name: 'Gemini 1.5 Flash', value: 'gemini-1.5-flash' },
              { name: 'Gemini 1.5 Pro', value: 'gemini-1.5-pro' },
              { name: 'Gemini 1.0 Pro', value: 'gemini-1.0-pro' }
            ],
            default: 'gemini-3.1-flash-lite-preview'
          },
          {
            displayName: 'System Prompt',
            name: 'systemPrompt',
            type: 'textarea',
            default: `Anda adalah Senior QA Automation Judge. Tugas Anda adalah mengevaluasi kualitas jawaban Chatbot...`,
          },
          {
            displayName: 'Temperature',
            name: 'temperature',
            type: 'number',
            default: 0.3,
            min: 0,
            max: 1
          },
          {
            displayName: 'Pass Threshold',
            name: 'scoring_threshold',
            type: 'number',
            default: 0.7,
            min: 0,
            max: 1
          }
        ]
      },

      // --- HTTP & API ---
      {
        displayName: 'HTTP Request',
        name: 'http-request',
        category: 'Actions',
        description: 'Call external API',
        icon: 'fa-globe',
        color: '#10b981',
        inputs: ['main'],
        outputs: ['main'],
        properties: [
          {
            displayName: 'Method',
            name: 'method',
            type: 'options',
            options: [
              { name: 'GET', value: 'GET' },
              { name: 'POST', value: 'POST' },
              { name: 'PUT', value: 'PUT' },
              { name: 'DELETE', value: 'DELETE' }
            ],
            default: 'GET'
          },
          {
            displayName: 'URL',
            name: 'url',
            type: 'string',
            default: 'https://',
            required: true
          },
          {
            displayName: 'Headers',
            name: 'headers',
            type: 'json',
            default: '{}'
          },
          {
            displayName: 'Body',
            name: 'body',
            type: 'textarea',
            displayOptions: { show: { method: ['POST', 'PUT'] } },
            default: ''
          }
        ]
      },

      // --- FLOW CONTROL ---
      {
        displayName: 'IF / Condition',
        name: 'condition',
        category: 'Control',
        description: 'Branch based on condition',
        icon: 'fa-code-branch',
        color: '#f59e0b',
        inputs: ['main'],
        outputs: ['true', 'false'],
        properties: [
          {
            displayName: 'Value 1',
            name: 'value1',
            type: 'string',
            default: '{{ $json.score }}',
            description: 'Dynamic value to check'
          },
          {
            displayName: 'Comparison',
            name: 'comparison',
            type: 'options',
            options: [
              { name: 'Equal', value: 'equal' },
              { name: 'Greater Than', value: 'gt' },
              { name: 'Less Than', value: 'lt' },
              { name: 'Contains', value: 'contains' }
            ],
            default: 'gt'
          },
          {
            displayName: 'Value 2',
            name: 'value2',
            type: 'string',
            default: '0.7'
          }
        ]
      },
      {
        displayName: 'Wait',
        name: 'wait',
        category: 'Control',
        description: 'Pause execution',
        icon: 'fa-hourglass-half',
        color: '#64748b',
        inputs: ['main'],
        outputs: ['main'],
        properties: [
          {
            displayName: 'Duration (ms)',
            name: 'duration',
            type: 'number',
            default: 1000
          }
        ]
      },

      // --- DATA ---
      {
        displayName: 'Transform',
        name: 'transform-data',
        category: 'Transform',
        description: 'Manipulate data with JavaScript',
        icon: 'fa-exchange-alt',
        color: '#06b6d4',
        inputs: ['main'],
        outputs: ['main'],
        properties: [
          {
            displayName: 'Code',
            name: 'jsCode',
            type: 'textarea',
            default: '// Custom JS\nreturn items.map(item => {\n  item.processed = true;\n  return item;\n});',
            description: 'JavaScript code to execute'
          }
        ]
      },

      // --- REPORTING & NOTIFICATIONS ---
      {
        displayName: 'Generate Report',
        name: 'generate-report',
        category: 'Transform', // Mapping to Transform category in UI for now
        description: 'Create test reports',
        icon: 'fa-file-alt',
        color: '#10b981',
        inputs: ['main'],
        outputs: ['main'],
        properties: [
          {
            displayName: 'Report Format',
            name: 'format',
            type: 'options',
            options: [
              { name: 'HTML', value: 'html' },
              { name: 'Excel', value: 'excel' },
              { name: 'PDF', value: 'pdf' }
            ],
            default: 'html'
          },
          {
            displayName: 'Template',
            name: 'template',
            type: 'string',
            default: 'standard-report'
          }
        ]
      },
      {
        displayName: 'Send Notification',
        name: 'send-notification',
        category: 'Control',
        description: 'Send notifications',
        icon: 'fa-bell',
        color: '#ec4899',
        inputs: ['main'],
        outputs: ['main'],
        properties: [
          {
            displayName: 'Channel',
            name: 'channel',
            type: 'options',
            options: [
              { name: 'Email', value: 'email' },
              { name: 'Slack', value: 'slack' },
              { name: 'Telegram', value: 'telegram' },
              { name: 'Discord', value: 'discord' }
            ],
            default: 'email'
          },
          {
            displayName: 'Recipient',
            name: 'recipient',
            type: 'string',
            default: '',
            description: 'Email address or Channel ID'
          },
          {
            displayName: 'Message',
            name: 'message',
            type: 'textarea',
            default: 'Workflow completed successfully!'
          }
        ]
      },
      {
        displayName: 'SQL Database',
        name: 'sql-database',
        category: 'Actions',
        description: 'Execute SQL queries',
        icon: 'fa-database',
        color: '#334155',
        inputs: ['main'],
        outputs: ['main'],
        properties: [
          {
            displayName: 'Operation',
            name: 'operation',
            type: 'options',
            options: [
              { name: 'Insert', value: 'insert' },
              { name: 'Select', value: 'select' },
              { name: 'Update', value: 'update' }
            ],
            default: 'select'
          },
          {
            displayName: 'Table',
            name: 'table',
            type: 'string',
            default: 'test_results'
          },
          {
            displayName: 'Query',
            name: 'query',
            type: 'textarea',
            default: 'SELECT * FROM test_results WHERE status = "failed"'
          }
        ]
      },
      {
        displayName: 'Set Variable',
        name: 'set-variable',
        category: 'Transform',
        description: 'Define workflow variables',
        icon: 'fa-tag',
        color: '#8b5cf6',
        inputs: ['main'],
        outputs: ['main'],
        properties: [
          {
            displayName: 'Variables',
            name: 'variables',
            type: 'json',
            default: '{\n  "status": "active",\n  "version": "1.0"\n}'
          }
        ]
      },
      {
        displayName: 'Slack Notification',
        name: 'slack',
        category: 'Control',
        description: 'Send message to Slack',
        icon: 'fa-slack',
        color: '#4a154b',
        inputs: ['main'],
        outputs: ['main'],
        properties: [
          {
            displayName: 'Webhook URL',
            name: 'webhookUrl',
            type: 'string',
            default: ''
          },
          {
            displayName: 'Text',
            name: 'text',
            type: 'textarea',
            default: 'Automation report ready'
          }
        ]
      },
      {
        displayName: 'Telegram',
        name: 'telegram',
        category: 'Control',
        description: 'Send message to Telegram',
        icon: 'fa-paper-plane',
        color: '#0088cc',
        inputs: ['main'],
        outputs: ['main'],
        properties: [
          {
            displayName: 'Chat ID',
            name: 'chatId',
            type: 'string',
            default: ''
          },
          {
            displayName: 'Message',
            name: 'text',
            type: 'textarea',
            default: 'Evaluation finished'
          }
        ]
      }
    ];
  },
  
  setupEventListeners() {
    const searchInput = document.getElementById('nodeLibrarySearch');
    if (searchInput) {
      searchInput.addEventListener('input', (e) => {
        this.searchQuery = e.target.value.toLowerCase();
        this.render();
      });
    }
    
    const categoryBtns = document.querySelectorAll('.node-category-btn');
    categoryBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        this.selectedCategory = btn.dataset.category;
        categoryBtns.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        this.render();
      });
    });
  },
  
  render() {
    const container = document.getElementById('nodeLibraryList');
    if (!container) return;
    
    const filteredNodes = this.filterNodes();
    const grouped = this.groupByCategory(filteredNodes);
    
    container.innerHTML = '';
    
    if (filteredNodes.length === 0) {
      container.innerHTML = `<div class="node-library-empty"><i class="fas fa-search"></i><p>No nodes found</p></div>`;
      return;
    }
    
    Object.keys(grouped).forEach(category => {
      const categoryEl = document.createElement('div');
      categoryEl.className = 'node-category';
      categoryEl.innerHTML = `
        <div class="node-category-header">
          <i class="fas ${this.getCategoryIcon(category)}"></i>
          <span>${category}</span>
          <span class="node-count">${grouped[category].length}</span>
        </div>
        <div class="node-category-list">
          ${grouped[category].map(node => this.renderNodeCard(node)).join('')}
        </div>
      `;
      container.appendChild(categoryEl);
    });
    
    this.setupDragEvents();
  },
  
  filterNodes() {
    return this.nodeTypes.filter(node => {
      if (this.selectedCategory !== 'all' && node.category !== this.selectedCategory) return false;
      if (this.searchQuery) {
        const searchLower = this.searchQuery.toLowerCase();
        return node.displayName.toLowerCase().includes(searchLower) || node.description.toLowerCase().includes(searchLower);
      }
      return true;
    });
  },
  
  groupByCategory(nodes) {
    const grouped = {};
    nodes.forEach(node => {
      if (!grouped[node.category]) grouped[node.category] = [];
      grouped[node.category].push(node);
    });
    return grouped;
  },
  
  renderNodeCard(node) {
    return `
      <div class="node-card" draggable="true" data-node-type="${node.name}">
        <div class="node-card-icon" style="background: ${node.color};"><i class="fas ${node.icon}"></i></div>
        <div class="node-card-content">
          <div class="node-card-name">${node.displayName}</div>
          <div class="node-card-description text-xs opacity-70">${node.description}</div>
        </div>
      </div>
    `;
  },
  
  setupDragEvents() {
    const nodeCards = document.querySelectorAll('.node-card');
    nodeCards.forEach(card => {
      card.addEventListener('dragstart', (e) => {
        e.dataTransfer.setData('text/plain', card.dataset.nodeType);
        e.dataTransfer.effectAllowed = 'copy';
        card.classList.add('dragging');
      });
      card.addEventListener('dragend', () => card.classList.remove('dragging'));
      
      card.addEventListener('click', () => {
        const nodeData = this.nodeTypes.find(n => n.name === card.dataset.nodeType);
        if (nodeData) {
          const centerX = (window.innerWidth / 2 - WorkflowCanvas.panX) / WorkflowCanvas.zoom;
          const centerY = (window.innerHeight / 2 - WorkflowCanvas.panY) / WorkflowCanvas.zoom;
          WorkflowCanvas.addNode({
            ...nodeData,
            type: nodeData.name, // compatibility with canvas
            x: centerX - 100,
            y: centerY - 50
          });
        }
      });
    });
  },
  
  getCategoryIcon(category) {
    const icons = { 'Triggers': 'fa-bolt', 'Actions': 'fa-play', 'Control': 'fa-code-branch' };
    return icons[category] || 'fa-cube';
  }
};
