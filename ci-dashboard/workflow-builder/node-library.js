/**
 * Node Library Component
 * Displays available node types that can be dragged onto the canvas
 */

const NodeLibrary = {
  nodeTypes: [],
  searchQuery: '',
  selectedCategory: 'all',
  
  /**
   * Initialize node library
   */
  async init() {
    console.log('[NodeLibrary] Initializing...');
    
    // Load node types from backend
    await this.loadNodeTypes();
    
    // Setup event listeners
    this.setupEventListeners();
    
    // Initial render
    this.render();
    
    console.log('[NodeLibrary] Initialized successfully');
  },
  
  /**
   * Load node types from backend
   */
  async loadNodeTypes() {
    try {
      const response = await BackendAPI.get('/workflows/node-types');
      
      if (response && response.data) {
        this.nodeTypes = response.data;
        console.log('[NodeLibrary] Loaded node types:', this.nodeTypes.length);
      } else {
        // Fallback to default node types if backend is not available
        this.nodeTypes = this.getDefaultNodeTypes();
        console.warn('[NodeLibrary] Using default node types');
      }
    } catch (error) {
      console.error('[NodeLibrary] Error loading node types:', error);
      this.nodeTypes = this.getDefaultNodeTypes();
    }
  },
  
  /**
   * Get default node types (fallback)
   */
  getDefaultNodeTypes() {
    return [
      // Triggers
      {
        type: 'manual-trigger',
        category: 'Triggers',
        name: 'Manual Trigger',
        description: 'Start workflow manually',
        icon: 'fa-hand-pointer',
        color: '#f59e0b',
        inputs: [],
        outputs: [{ id: 'output', label: 'Output', dataType: 'any' }]
      },
      {
        type: 'schedule-trigger',
        category: 'Triggers',
        name: 'Schedule Trigger',
        description: 'Start workflow on schedule',
        icon: 'fa-clock',
        color: '#f59e0b',
        inputs: [],
        outputs: [{ id: 'output', label: 'Output', dataType: 'any' }]
      },
      
      // Actions
      {
        type: 'run-test',
        category: 'Actions',
        name: 'Run Test',
        description: 'Execute platform tests',
        icon: 'fa-play-circle',
        color: '#3b82f6',
        inputs: [{ id: 'input', label: 'Input', dataType: 'any' }],
        outputs: [{ id: 'output', label: 'Output', dataType: 'object' }]
      },
      {
        type: 'ai-evaluate',
        category: 'Actions',
        name: 'AI Evaluate',
        description: 'Evaluate with AI',
        icon: 'fa-brain',
        color: '#8b5cf6',
        inputs: [{ id: 'input', label: 'Input', dataType: 'object' }],
        outputs: [{ id: 'output', label: 'Output', dataType: 'object' }]
      },
      {
        type: 'generate-report',
        category: 'Actions',
        name: 'Generate Report',
        description: 'Create test reports',
        icon: 'fa-file-alt',
        color: '#10b981',
        inputs: [{ id: 'input', label: 'Input', dataType: 'object' }],
        outputs: [{ id: 'output', label: 'Output', dataType: 'object' }]
      },
      {
        type: 'send-notification',
        category: 'Actions',
        name: 'Send Notification',
        description: 'Send notifications',
        icon: 'fa-bell',
        color: '#ec4899',
        inputs: [{ id: 'input', label: 'Input', dataType: 'any' }],
        outputs: [{ id: 'output', label: 'Output', dataType: 'object' }]
      },
      
      // Control
      {
        type: 'condition',
        category: 'Control',
        name: 'Condition',
        description: 'Branch based on condition',
        icon: 'fa-code-branch',
        color: '#f59e0b',
        inputs: [{ id: 'input', label: 'Input', dataType: 'any' }],
        outputs: [
          { id: 'true', label: 'True', dataType: 'any' },
          { id: 'false', label: 'False', dataType: 'any' }
        ]
      },
      {
        type: 'wait',
        category: 'Control',
        name: 'Wait',
        description: 'Pause execution',
        icon: 'fa-hourglass-half',
        color: '#64748b',
        inputs: [{ id: 'input', label: 'Input', dataType: 'any' }],
        outputs: [{ id: 'output', label: 'Output', dataType: 'any' }]
      },
      
      // Transform
      {
        type: 'transform-data',
        category: 'Transform',
        name: 'Transform Data',
        description: 'Transform and map data',
        icon: 'fa-exchange-alt',
        color: '#06b6d4',
        inputs: [{ id: 'input', label: 'Input', dataType: 'any' }],
        outputs: [{ id: 'output', label: 'Output', dataType: 'any' }]
      }
    ];
  },
  
  /**
   * Setup event listeners
   */
  setupEventListeners() {
    // Search input
    const searchInput = document.getElementById('nodeLibrarySearch');
    if (searchInput) {
      searchInput.addEventListener('input', (e) => {
        this.searchQuery = e.target.value.toLowerCase();
        this.render();
      });
    }
    
    // Category filter
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
  
  /**
   * Render node library
   */
  render() {
    const container = document.getElementById('nodeLibraryList');
    if (!container) return;
    
    // Filter nodes
    const filteredNodes = this.filterNodes();
    
    // Group by category
    const grouped = this.groupByCategory(filteredNodes);
    
    // Render
    container.innerHTML = '';
    
    if (filteredNodes.length === 0) {
      container.innerHTML = `
        <div class="node-library-empty">
          <i class="fas fa-search"></i>
          <p>No nodes found</p>
        </div>
      `;
      return;
    }
    
    // Render each category
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
    
    // Setup drag events
    this.setupDragEvents();
  },
  
  /**
   * Filter nodes based on search and category
   */
  filterNodes() {
    return this.nodeTypes.filter(node => {
      // Category filter
      if (this.selectedCategory !== 'all' && node.category !== this.selectedCategory) {
        return false;
      }
      
      // Search filter
      if (this.searchQuery) {
        const searchLower = this.searchQuery.toLowerCase();
        return (
          node.name.toLowerCase().includes(searchLower) ||
          node.description.toLowerCase().includes(searchLower) ||
          node.category.toLowerCase().includes(searchLower)
        );
      }
      
      return true;
    });
  },
  
  /**
   * Group nodes by category
   */
  groupByCategory(nodes) {
    const grouped = {};
    
    nodes.forEach(node => {
      if (!grouped[node.category]) {
        grouped[node.category] = [];
      }
      grouped[node.category].push(node);
    });
    
    return grouped;
  },
  
  /**
   * Render node card
   */
  renderNodeCard(node) {
    return `
      <div class="node-card" 
           draggable="true" 
           data-node-type="${node.type}">
        <div class="node-card-icon" style="background: ${node.color};">
          <i class="fas ${node.icon}"></i>
        </div>
        <div class="node-card-content">
          <div class="node-card-name">${node.name}</div>
          <div class="node-card-description">${node.description}</div>
        </div>
      </div>
    `;
  },
  
  /**
   * Setup drag events
   */
  setupDragEvents() {
    const nodeCards = document.querySelectorAll('.node-card');
    
    nodeCards.forEach(card => {
      // Drag start
      card.addEventListener('dragstart', (e) => {
        const nodeType = card.dataset.nodeType;
        if (nodeType) {
          e.dataTransfer.setData('text/plain', nodeType);
          e.dataTransfer.effectAllowed = 'copy';
          card.classList.add('dragging');
        }
      });
      
      card.addEventListener('dragend', (e) => {
        card.classList.remove('dragging');
      });
      
      // Click fallback (easier to use)
      card.addEventListener('click', () => {
        const nodeType = card.dataset.nodeType;
        const nodeData = this.nodeTypes.find(n => n.type === nodeType);
        
        if (nodeData) {
          // Add to center of canvas or random offset from center
          const centerX = (window.innerWidth / 2 - WorkflowCanvas.panX) / WorkflowCanvas.zoom;
          const centerY = (window.innerHeight / 2 - WorkflowCanvas.panY) / WorkflowCanvas.zoom;
          
          const newNode = {
            ...nodeData,
            x: centerX - 100 + (Math.random() * 40 - 20),
            y: centerY - 50 + (Math.random() * 40 - 20)
          };
          
          WorkflowCanvas.addNode(newNode);
          Toast.success('Node Added', `${nodeData.name} added to canvas`);
        }
      });
    });
    
    // Setup drop zone on canvas
    const canvas = document.getElementById('workflowCanvasContainer');
    if (canvas) {
      canvas.addEventListener('dragover', (e) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'copy';
      });
      
      canvas.addEventListener('drop', (e) => {
        e.preventDefault();
        
        try {
          const nodeType = e.dataTransfer.getData('text/plain');
          if (!nodeType) {
            console.warn('[NodeLibrary] No node type received in drop event');
            return;
          }
          
          const nodeData = this.nodeTypes.find(n => n.type === nodeType);
          if (!nodeData) {
            console.error('[NodeLibrary] Unknown node type dropped:', nodeType);
            return;
          }
          
          const rect = canvas.getBoundingClientRect();
          
          // Calculate drop position in canvas coordinates
          const x = (e.clientX - rect.left - WorkflowCanvas.panX) / WorkflowCanvas.zoom;
          const y = (e.clientY - rect.top - WorkflowCanvas.panY) / WorkflowCanvas.zoom;
          
          // Create a copy of node data
          const newNode = {
            ...nodeData,
            x: x - 100, // Center node on cursor
            y: y - 50
          };
          
          WorkflowCanvas.addNode(newNode);
          
          Toast.success('Node Added', `${nodeData.name} added to canvas`);
        } catch (error) {
          console.error('[NodeLibrary] Error adding node:', error);
          Toast.error('Error', 'Failed to add node. Please try clicking the node instead.');
        }
      });
    }
  },
  
  /**
   * Get category icon
   */
  getCategoryIcon(category) {
    const icons = {
      'Triggers': 'fa-bolt',
      'Actions': 'fa-play',
      'Control': 'fa-code-branch',
      'Transform': 'fa-exchange-alt',
      'Notifications': 'fa-bell'
    };
    return icons[category] || 'fa-cube';
  },
  
  /**
   * Get all categories
   */
  getCategories() {
    const categories = new Set();
    this.nodeTypes.forEach(node => categories.add(node.category));
    return Array.from(categories).sort();
  }
};
