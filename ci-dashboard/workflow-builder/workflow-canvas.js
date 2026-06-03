/**
 * Workflow Canvas Component
 * Visual drag-and-drop canvas for creating workflows (n8n-style)
 */

const WorkflowCanvas = {
  // Canvas state
  canvas: null,
  ctx: null,
  svg: null,
  nodes: [],
  connections: [],
  selectedNode: null,
  selectedNodes: [], // NEW: Support for multiple selections
  selectedConnection: null,
  draggedNode: null,
  dragOffset: { x: 0, y: 0 },
  
  // Canvas transform
  zoom: 1,
  panX: 0,
  panY: 0,
  isPanning: false,
  panStart: { x: 0, y: 0 },
  
  // Clipboard
  clipboard: null,
  
  // Connection creation
  connectionStart: null,
  connectionPreview: null,
  
  // Connection dragging
  draggedConnection: null,
  dragStartPos: { x: 0, y: 0 },
  
  // Grid settings
  gridSize: 20,
  gridColor: 'rgba(100, 116, 139, 0.1)',
  
  listeners: {},
  on(event, callback) {
    if (!this.listeners[event]) this.listeners[event] = [];
    this.listeners[event].push(callback);
  },
  off(event, callback) {
    if (!this.listeners[event]) return;
    this.listeners[event] = this.listeners[event].filter(cb => cb !== callback);
  },
  emit(event, data) {
    if (!this.listeners[event]) return;
    this.listeners[event].forEach(cb => cb(data));
  },
  
  initialized: false,
  
  /**
   * Initialize the canvas
   */
  init() {
    if (this.initialized) {
      console.log('[WorkflowCanvas] Already initialized, skipping...');
      this.render(); // Ensure fresh render
      return;
    }
    
    console.log('[WorkflowCanvas] Initializing...');
    this.initialized = true;
    
    // Get canvas container
    const container = document.getElementById('workflowCanvasContainer');
    if (!container) {
      console.error('[WorkflowCanvas] Container not found');
      return;
    }
    
    // Create SVG canvas for connections
    this.svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    this.svg.id = 'workflowCanvasSVG';
    this.svg.style.cssText = 'position:absolute;top:0;left:0;width:100%;height:100%;pointer-events:none;z-index:1;';
    container.appendChild(this.svg);
    
    // Create canvas for grid
    this.canvas = document.createElement('canvas');
    this.canvas.id = 'workflowCanvasGrid';
    this.canvas.style.cssText = 'position:absolute;top:0;left:0;width:100%;height:100%;z-index:0;';
    container.insertBefore(this.canvas, this.svg);
    
    this.ctx = this.canvas.getContext('2d');
    
    // Set canvas size
    this.resize();
    
    // Load saved state
    this.loadState();
    
    // Setup event listeners
    this.setupEventListeners();
    
    // Initial render
    this.render();
    
    console.log('[WorkflowCanvas] Initialized successfully');
  },
  
  /**
   * Setup event listeners
   */
  setupEventListeners() {
    const container = document.getElementById('workflowCanvasContainer');
    if (!container) return;
    
    // Mouse events for panning
    container.addEventListener('mousedown', (e) => this.onMouseDown(e));
    container.addEventListener('mousemove', (e) => this.onMouseMove(e));
    window.addEventListener('mouseup', (e) => this.onMouseUp(e));
    container.addEventListener('mouseleave', (e) => this.onMouseUp(e));
    
    // Wheel event for zooming
    container.addEventListener('wheel', (e) => this.onWheel(e), { passive: false });
    
    // Window resize
    window.addEventListener('resize', () => this.resize());
    
    // Keyboard shortcuts
    document.addEventListener('keydown', (e) => this.onKeyDown(e));
    
    // Context menu
    container.addEventListener('contextmenu', (e) => this.onContextMenu(e));
    
    // Double click
    container.addEventListener('dblclick', (e) => this.onDoubleClick(e));

    // Drag and drop from library
    container.addEventListener('dragover', (e) => {
      e.preventDefault();
      e.dataTransfer.dropEffect = 'copy';
    });
    
    container.addEventListener('drop', (e) => {
      e.preventDefault();
      const nodeType = e.dataTransfer.getData('text/plain');
      if (nodeType) {
        const rect = container.getBoundingClientRect();
        const x = (e.clientX - rect.left - this.panX) / this.zoom;
        const y = (e.clientY - rect.top - this.panY) / this.zoom;
        
        // Find node data from library (assuming NodeLibrary is globally accessible)
        if (typeof NodeLibrary !== 'undefined') {
          const nodeData = NodeLibrary.nodeTypes.find(n => n.name === nodeType);
          if (nodeData) {
            this.addNode({
              ...nodeData,
              type: nodeData.name,
              x: x - 100, // Center node on drop point
              y: y - 50
            });
          }
        }
      }
    });
  },
  
  /**
   * Handle mouse down
   */
  onMouseDown(e) {
    document.body.classList.add('canvas-interacting');
    // Prevent default browser behavior (text selection) when interacting with canvas
    // But allow it for input/textarea if any are inside (though there shouldn't be on the canvas directly)
    if (e.target.tagName !== 'INPUT' && e.target.tagName !== 'TEXTAREA') {
        // We'll clear selection later if a drag actually starts
    }

    const container = document.getElementById('workflowCanvasContainer');
    const rect = container.getBoundingClientRect();
    const x = (e.clientX - rect.left - this.panX) / this.zoom;
    const y = (e.clientY - rect.top - this.panY) / this.zoom;
    
    // NEW: Check for port click globally first (easier to hit, prevents accidental node drag)
    const globalPort = this.getGlobalPortAt(x, y);
    if (globalPort) {
      e.preventDefault();
      if (this.selectedConnection) {
        this.selectedConnection = null;
        this.render();
      }
      this.startConnection(globalPort.node, globalPort.port, globalPort.type);
      return;
    }

    // Check if clicking on a node
    const clickedNode = this.getNodeAt(x, y);
    
    if (clickedNode) {
      e.preventDefault(); // Prevent text selection when starting to drag a node
      window.getSelection()?.removeAllRanges(); // Clear any existing selection
      
      // Check for double click
      const now = Date.now();
      if (this.lastClick && now - this.lastClick < 300 && this.lastClickNode === clickedNode) {
        this.emit('nodeDoubleClicked', clickedNode);
        this.lastClick = 0;
        return;
      }
      this.lastClick = now;
      this.lastClickNode = clickedNode;

      // NEW: Handle multi-selection with Ctrl key
      if (e.ctrlKey) {
        if (!this.selectedNodes) this.selectedNodes = [];
        const index = this.selectedNodes.indexOf(clickedNode);
        if (index > -1) {
          this.selectedNodes.splice(index, 1);
          if (this.selectedNode === clickedNode) {
            this.selectedNode = this.selectedNodes.length > 0 ? this.selectedNodes[this.selectedNodes.length - 1] : null;
          }
        } else {
          this.selectedNodes.push(clickedNode);
          this.selectedNode = clickedNode;
        }
      } else {
        // Normal selection
        this.selectedNodes = [clickedNode];
        this.selectedNode = clickedNode;
      }

      this.selectedConnection = null; 
      this.draggedNode = clickedNode;
      this.dragOffset = {
        x: x - clickedNode.x,
        y: y - clickedNode.y
      };
      
      this.emit('nodeSelected', clickedNode);
      this.render();
    } else {
      // Clicked on background
      if (!e.ctrlKey) {
        this.selectedNodes = [];
        this.selectedNode = null;
        this.emit('nodeDeselected');
      }

      // DESELECT CONNECTION IF CLICKED ON BACKGROUND
      if (this.selectedConnection) {
        this.selectedConnection = null;
        this.render();
      }

      // Start panning
      this.isPanning = true;
      this.panStart = { x: e.clientX - this.panX, y: e.clientY - this.panY };
      
      // Only prevent default if not clicking on some UI element that might need it
      if (e.target.id === 'workflowCanvasGrid' || e.target.id === 'workflowCanvasSVG' || e.target.id === 'workflowCanvasContainer') {
          e.preventDefault();
          window.getSelection()?.removeAllRanges();
      }
    }
  },
  
  /**
   * Handle mouse move
   */
  onMouseMove(e) {
    const container = document.getElementById('workflowCanvasContainer');
    const rect = container.getBoundingClientRect();
    const x = (e.clientX - rect.left - this.panX) / this.zoom;
    const y = (e.clientY - rect.top - this.panY) / this.zoom;
    
    // Update cursor
    const node = this.getNodeAt(x, y);
    container.style.cursor = node ? 'move' : (this.isPanning ? 'grabbing' : 'grab');
    
    // Handle node dragging
    if (this.draggedNode) {
      let newX = x - this.dragOffset.x;
      let newY = y - this.dragOffset.y;
      
      // Snap to grid (20px)
      newX = Math.round(newX / this.gridSize) * this.gridSize;
      newY = Math.round(newY / this.gridSize) * this.gridSize;
      
      if (this.draggedNode.x !== newX || this.draggedNode.y !== newY) {
        this.draggedNode.x = newX;
        this.draggedNode.y = newY;
        this.hasDragged = true;
        this.render();
      }
      return;
    }
    
    // Handle connection preview
    if (this.connectionStart) {
      const oppositeType = this.connectionStart.type === 'output' ? 'input' : 'output';
      // Snap to nearest opposite port if close
      const snapPort = this.getGlobalPortAt(x, y);
      if (snapPort && snapPort.type === oppositeType && snapPort.node !== this.connectionStart.node) {
          const portPos = this.getPortPosition(snapPort.node, snapPort.port.id, oppositeType);
          this.connectionPreview = { x: portPos.x, y: portPos.y };
          // Highlight target node
          document.querySelectorAll('.workflow-node').forEach(el => el.classList.remove('port-hover'));
          const el = document.querySelector(`.workflow-node[data-node-id="${snapPort.node.id}"]`);
          if (el) el.classList.add('port-hover');
      } else {
          this.connectionPreview = { x, y };
          document.querySelectorAll('.workflow-node').forEach(el => el.classList.remove('port-hover'));
      }
      this.render();
      return;
    }

    // Handle connection dragging
    if (this.draggedConnection) {
      const dx = x - this.dragStartPos.x;
      const dy = y - this.dragStartPos.y;
      
      if (!this.draggedConnection.pathOffset) {
        this.draggedConnection.pathOffset = { x: 0, y: 0 };
      }
      
      this.draggedConnection.pathOffset.x += dx;
      this.draggedConnection.pathOffset.y += dy;
      
      this.dragStartPos = { x, y };
      this.render();
      return;
    }
    
    // Handle panning
    if (this.isPanning) {
      this.panX = e.clientX - this.panStart.x;
      this.panY = e.clientY - this.panStart.y;
      this.render();
    }
  },
  
  /**
   * Handle mouse up
   */
  onMouseUp(e) {
    document.body.classList.remove('canvas-interacting');
    if (this.draggedNode) {
      if (this.hasDragged) {
        this.saveHistory();
      }
      this.draggedNode = null;
      this.hasDragged = false;
    }
    
    const container = document.getElementById('workflowCanvasContainer');
    const rect = container.getBoundingClientRect();
    const x = (e.clientX - rect.left - this.panX) / this.zoom;
    const y = (e.clientY - rect.top - this.panY) / this.zoom;
    
    // Handle connection completion
    if (this.connectionStart) {
      const target = this.getGlobalPortAt(x, y);
      const oppositeType = this.connectionStart.type === 'output' ? 'input' : 'output';
      
      if (target && target.type === oppositeType && target.node !== this.connectionStart.node) {
          if (this.connectionStart.type === 'output') {
            this.createConnection(this.connectionStart.node, this.connectionStart.port, target.node, target.port);
          } else {
            // Dragged from input to output - swap for correct logic
            this.createConnection(target.node, target.port, this.connectionStart.node, this.connectionStart.port);
          }
      }
      
      this.connectionStart = null;
      this.connectionPreview = null;
      document.querySelectorAll('.workflow-node').forEach(el => el.classList.remove('port-hover'));
      this.render();
      return;
    }
    
    if (this.draggedConnection) {
      this.draggedConnection = null;
      this.saveHistory();
    }

    // Stop panning
    this.isPanning = false;
    
    // Save state
    this.saveState();
  },
  
  /**
   * Handle mouse wheel (zoom)
   */
  onWheel(e) {
    e.preventDefault();
    
    const container = document.getElementById('workflowCanvasContainer');
    const rect = container.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;
    
    // Calculate zoom
    const delta = e.deltaY > 0 ? 0.9 : 1.1;
    const newZoom = Math.max(0.25, Math.min(2, this.zoom * delta));
    
    // Adjust pan to zoom towards mouse position
    this.panX = mouseX - (mouseX - this.panX) * (newZoom / this.zoom);
    this.panY = mouseY - (mouseY - this.panY) * (newZoom / this.zoom);
    
    this.zoom = newZoom;
    this.render();
    this.saveState();
  },
  
  /**
   * Handle keyboard shortcuts
   */
  onKeyDown(e) {
    // Only handle keyboard shortcuts if the workflow-builder page is visible
    const builderPage = document.getElementById('page-workflow-builder');
    if (!builderPage || !builderPage.classList.contains('active')) return;

    // Undo: Ctrl+Z
    if (e.ctrlKey && e.key === 'z') {
      e.preventDefault();
      this.undo();
      return;
    }
    
    // Redo: Ctrl+Y or Ctrl+Shift+Z
    if ((e.ctrlKey && e.key === 'y') || (e.ctrlKey && e.shiftKey && e.key === 'Z')) {
      e.preventDefault();
      this.redo();
      return;
    }

    // Copy: Ctrl+C
    if (e.ctrlKey && e.key === 'c') {
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.contentEditable === 'true') return;
      if (window.getSelection()?.toString()) return; 
      
      const nodesToCopy = this.selectedNodes && this.selectedNodes.length > 0 ? this.selectedNodes : (this.selectedNode ? [this.selectedNode] : []);
      if (nodesToCopy.length > 0) {
        e.preventDefault();
        this.copyNodes(nodesToCopy);
      }
      return;
    }
    
    // Cut: Ctrl+X
    if (e.ctrlKey && e.key === 'x') {
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.contentEditable === 'true') return;
      if (window.getSelection()?.toString()) return;
      
      const nodesToCut = this.selectedNodes && this.selectedNodes.length > 0 ? this.selectedNodes : (this.selectedNode ? [this.selectedNode] : []);
      if (nodesToCut.length > 0) {
        e.preventDefault();
        this.cutNodes(nodesToCut);
      }
      return;
    }
    
    // Paste: Ctrl+V
    if (e.ctrlKey && e.key === 'v') {
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
      if (this.clipboard && this.clipboard.nodes) {
        e.preventDefault();
        this.pasteNodes();
      }
      return;
    }

    // Delete selected node or connection
    if (e.key === 'Delete' || e.key === 'Backspace') {
      // Don't delete if typing in a configuration field
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
      
      if (this.selectedNodes && this.selectedNodes.length > 0) {
        this.selectedNodes.forEach(node => this.deleteNode(node));
        this.selectedNodes = [];
      } else if (this.selectedNode) {
        this.deleteNode(this.selectedNode);
      } else if (this.selectedConnection) {
        this.deleteConnection(this.selectedConnection);
      }
    }
    
    // Deselect with Escape
    if (e.key === 'Escape') {
      this.selectedNode = null;
      this.selectedNodes = [];
      this.selectedConnection = null;
      this.connectionStart = null;
      this.connectionPreview = null;
      this.emit('nodeDeselected');
      this.render();
    }
  },
  
  /**
   * Render delete button for connection
   */
  renderConnectionDeleteButton(start, end, conn) {
    // Calculate mid point of the Bezier line
    const offsetX = (conn.pathOffset?.x || 0) * this.zoom;
    const offsetY = (conn.pathOffset?.y || 0) * this.zoom;
    
    const midX = (start.x + end.x) / 2 + (offsetX * 0.75);
    const midY = (start.y + end.y) / 2 + (offsetY * 0.75);
    
    const foreignObject = document.createElementNS('http://www.w3.org/2000/svg', 'foreignObject');
    foreignObject.setAttribute('x', midX - 15);
    foreignObject.setAttribute('y', midY - 15);
    foreignObject.setAttribute('width', '30');
    foreignObject.setAttribute('height', '30');
    foreignObject.setAttribute('data-conn-id', `${conn.source_node_id}-${conn.target_node_id}`);
    foreignObject.style.pointerEvents = 'auto';
    
    foreignObject.innerHTML = `
      <div class="conn-delete-btn" title="Delete connection" style="background:#ef4444; color:white; width:26px; height:26px; border-radius:50%; display:flex; align-items:center; justify-content:center; cursor:pointer; box-shadow:0 2px 8px rgba(0,0,0,0.3); border:2px solid white; transition: transform 0.1s; z-index: 10;">
        <i class="fas fa-times" style="font-size:12px;"></i>
      </div>
    `;
    
    const btn = foreignObject.querySelector('.conn-delete-btn');
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      this.deleteConnection(conn);
    });

    btn.addEventListener('mouseenter', () => {
      btn.style.transform = 'scale(1.1)';
    });

    btn.addEventListener('mouseleave', (e) => {
      btn.style.transform = 'scale(1)';
      // If we are not selected, remove on leave
      if (this.selectedConnection !== conn) {
        foreignObject.remove();
      }
    });
    
    this.svg.appendChild(foreignObject);
  },





  /**
   * Handle double click
   */
  onDoubleClick(e) {
    const container = document.getElementById('workflowCanvasContainer');
    const rect = container.getBoundingClientRect();
    const x = (e.clientX - rect.left - this.panX) / this.zoom;
    const y = (e.clientY - rect.top - this.panY) / this.zoom;
    
    const node = this.getNodeAt(x, y);
    if (node) {
      this.emit('nodeDoubleClicked', node);
    }
  },
  
  /**
   * Handle context menu
   */
  onContextMenu(e) {
    e.preventDefault();
    
    const container = document.getElementById('workflowCanvasContainer');
    const rect = container.getBoundingClientRect();
    const x = (e.clientX - rect.left - this.panX) / this.zoom;
    const y = (e.clientY - rect.top - this.panY) / this.zoom;
    
    const node = this.getNodeAt(x, y);
    if (node) {
      this.selectedNode = node;
      this.selectedConnection = null;
      this.showContextMenu(e.clientX, e.clientY, 'node', node);
    } else {
      // Check if near a connection (simplistic check)
      // For now, just show canvas menu
      this.showContextMenu(e.clientX, e.clientY, 'canvas');
    }
  },
  
  /**
   * Show context menu
   */
  showContextMenu(x, y, type, target) {
    this.hideContextMenu();
    
    const menu = document.createElement('div');
    menu.className = 'workflow-context-menu';
    menu.style.left = `${x}px`;
    menu.style.top = `${y}px`;
    
    let items = [];
    if (type === 'node') {
      items = [
        { label: 'Edit Configuration', icon: 'fa-edit', action: () => this.emit('nodeDoubleClicked', target) },
        { label: 'Copy Node', icon: 'fa-copy', action: () => this.copyNode(target) },
        { label: 'Cut Node', icon: 'fa-scissors', action: () => this.cutNode(target) },
        { label: 'Duplicate Node', icon: 'fa-clone', action: () => this.duplicateNode(target) },
        { label: 'Reset Status', icon: 'fa-undo', action: () => { target.status = null; this.render(); } },
        { type: 'divider' },
        { label: 'Delete Node', icon: 'fa-trash', color: 'var(--error)', action: () => this.deleteNode(target) }
      ];
    } else {
      items = [
        { label: 'Add Node', icon: 'fa-plus', action: () => this.emit('showNodeLibrary', { x, y }) },
        { label: 'Paste Node', icon: 'fa-paste', disabled: !this.clipboard, action: () => this.pasteNode(x, y) },
        { label: 'Fit to Screen', icon: 'fa-expand', action: () => this.fitToScreen() },
        { label: 'Clear Canvas', icon: 'fa-trash', action: () => this.clear() }
      ];
    }
    
    menu.innerHTML = items.map(item => {
      if (item.type === 'divider') return '<div class="menu-divider"></div>';
      return `
        <div class="menu-item" style="${item.color ? `color: ${item.color};` : ''}">
          <i class="fas ${item.icon}"></i>
          <span>${item.label}</span>
        </div>
      `;
    }).join('');
    
    document.body.appendChild(menu);
    
    // Add click handlers
    const itemEls = menu.querySelectorAll('.menu-item');
    items.filter(i => i.type !== 'divider').forEach((item, index) => {
      if (item.disabled) {
        itemEls[index].style.opacity = '0.5';
        itemEls[index].style.pointerEvents = 'none';
        return;
      }
      itemEls[index].addEventListener('click', () => {
        item.action();
        this.hideContextMenu();
      });
    });
    
    // Close on click elsewhere
    const closeMenu = (e) => {
      if (!menu.contains(e.target)) {
        this.hideContextMenu();
        document.removeEventListener('mousedown', closeMenu);
      }
    };
    document.addEventListener('mousedown', closeMenu);
  },
  
  /**
   * Hide context menu
   */
  hideContextMenu() {
    document.querySelectorAll('.workflow-context-menu').forEach(el => el.remove());
  },

  /**
   * Duplicate node(s)
   */
  duplicateNode(node) {
    const nodesToDuplicate = this.selectedNodes && this.selectedNodes.length > 1 ? this.selectedNodes : [node];
    this.copyNodes(nodesToDuplicate);
    this.pasteNodes(nodesToDuplicate[0].x + 50, nodesToDuplicate[0].y + 50);
  },

  /**
   * Copy node(s) to internal clipboard
   */
  copyNodes(nodes) {
    if (!nodes || nodes.length === 0) return;
    
    // Find internal connections (connections between the nodes being copied)
    const nodeIds = nodes.map(n => n.id);
    const internalConnections = this.connections.filter(c => 
      nodeIds.includes(c.source_node_id) && nodeIds.includes(c.target_node_id)
    );

    this.clipboard = {
      nodes: JSON.parse(JSON.stringify(nodes)),
      connections: JSON.parse(JSON.stringify(internalConnections))
    };

    if (typeof Toast !== 'undefined') {
      Toast.info('Copied', `${nodes.length} node(s) copied to clipboard`);
    }
  },

  copyNode(node) {
    this.copyNodes([node]);
  },

  /**
   * Cut node(s) to internal clipboard
   */
  cutNodes(nodes) {
    if (!nodes || nodes.length === 0) return;
    this.copyNodes(nodes);
    nodes.forEach(node => this.deleteNode(node));
    if (typeof Toast !== 'undefined') {
      Toast.info('Cut', `${nodes.length} node(s) cut to clipboard`);
    }
  },

  cutNode(node) {
    this.cutNodes([node]);
  },

  /**
   * Paste node(s) from clipboard
   */
  pasteNodes(x, y) {
    if (!this.clipboard || !this.clipboard.nodes || this.clipboard.nodes.length === 0) return;
    
    const newNodes = [];
    const idMap = {}; // oldId -> newId

    // Calculate base position offset if x/y provided
    let offsetX = 0;
    let offsetY = 0;
    if (x !== undefined && y !== undefined) {
      offsetX = x - this.clipboard.nodes[0].x;
      offsetY = y - this.clipboard.nodes[0].y;
    } else {
      offsetX = 40;
      offsetY = 40;
    }
    
    // Create new nodes
    this.clipboard.nodes.forEach(oldNode => {
      const newNode = this.addNode({
        ...oldNode,
        id: `node_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
        x: oldNode.x + offsetX,
        y: oldNode.y + offsetY,
        status: null,
        lastOutput: null,
        lastError: null,
        duration_ms: null
      });
      
      idMap[oldNode.id] = newNode.id;
      newNodes.push(newNode);
    });
    
    // Recreate internal connections
    if (this.clipboard.connections) {
      this.clipboard.connections.forEach(oldConn => {
        const newSourceId = idMap[oldConn.source_node_id];
        const newTargetId = idMap[oldConn.target_node_id];
        
        if (newSourceId && newTargetId) {
          const sourceNode = this.nodes.find(n => n.id === newSourceId);
          const targetNode = this.nodes.find(n => n.id === newTargetId);
          
          if (sourceNode && targetNode) {
            this.createConnection(
              sourceNode, 
              sourceNode.outputs.find(p => p.id === oldConn.source_port_id) || {id: oldConn.source_port_id}, 
              targetNode, 
              targetNode.inputs.find(p => p.id === oldConn.target_port_id) || {id: oldConn.target_port_id}
            );
          }
        }
      });
    }
    
    this.selectedNodes = newNodes;
    this.selectedNode = newNodes[newNodes.length - 1];
    this.render();
    
    if (typeof Toast !== 'undefined') {
      Toast.success('Pasted', `${newNodes.length} node(s) pasted`);
    }
  },

  pasteNode(x, y) {
    this.pasteNodes(x, y);
  },

  /**
   * Select a node by ID
   */
  selectNode(nodeId) {
    const node = this.nodes.find(n => n.id === nodeId);
    if (node) {
      this.selectedNode = node;
      this.selectedConnection = null;
      this.emit('nodeSelected', node);
      this.render();
      
      // Pan to node if out of view
      this.panToNode(node);
    }
  },

  /**
   * Pan view to a specific node
   */
  panToNode(node) {
    const container = document.getElementById('workflowCanvasContainer');
    if (!container) return;
    
    const rect = container.getBoundingClientRect();
    const centerX = rect.width / 2;
    const centerY = rect.height / 2;
    
    this.panX = centerX - (node.x + 100) * this.zoom; // Assume node width ~200
    this.panY = centerY - (node.y + 50) * this.zoom; // Assume node height ~100
    
    this.render();
  },
  resize() {
    const container = document.getElementById('workflowCanvasContainer');
    if (!container) return;
    
    const rect = container.getBoundingClientRect();
    this.canvas.width = rect.width;
    this.canvas.height = rect.height;
    
    this.render();
  },
  
  /**
   * Render canvas
   */
  render() {
    if (!this.ctx) return;

    // Clear canvas
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

    // Save context
    this.ctx.save();

    // Apply transform
    this.ctx.translate(this.panX, this.panY);
    this.ctx.scale(this.zoom, this.zoom);

    // Draw grid
    this.drawGrid();

    // Restore context
    this.ctx.restore();

    // Render nodes first so DOM elements exist for connection calculations
    this.renderNodes();

    // Use requestAnimationFrame to render connections AFTER nodes are painted in DOM
    // This ensures offsetWidth/offsetHeight are available for port position calculations
    requestAnimationFrame(() => {
      this.renderConnections();
      this.toggleEmptyState();
    });
  },

  /**
   * Show/hide empty state based on node count
   */
  toggleEmptyState() {
    const container = document.getElementById('workflowCanvasContainer');
    if (!container) return;

    const emptyState = container.querySelector('.canvas-empty-state');
    if (!emptyState) return;

    if (this.nodes && this.nodes.length > 0) {
      emptyState.classList.add('hidden');
    } else {
      emptyState.classList.remove('hidden');
    }
  },
  
  /**
   * Draw grid
   */
  drawGrid() {
    const width = this.canvas.width / this.zoom;
    const height = this.canvas.height / this.zoom;
    const offsetX = -this.panX / this.zoom;
    const offsetY = -this.panY / this.zoom;
    
    this.ctx.fillStyle = this.gridColor;
    
    // Draw dot grid
    const dotSize = 1 / this.zoom;
    const startX = Math.floor(offsetX / this.gridSize) * this.gridSize;
    const startY = Math.floor(offsetY / this.gridSize) * this.gridSize;
    
    for (let x = startX; x < offsetX + width + this.gridSize; x += this.gridSize) {
      for (let y = startY; y < offsetY + height + this.gridSize; y += this.gridSize) {
        this.ctx.beginPath();
        this.ctx.arc(x, y, dotSize, 0, Math.PI * 2);
        this.ctx.fill();
      }
    }
  },
  
  /**
   * Render nodes
   */
  renderNodes() {
    const container = document.getElementById('workflowCanvasContainer');
    if (!container) return;
    
    // Remove existing node elements
    container.querySelectorAll('.workflow-node').forEach(el => el.remove());
    
    // Render each node
    this.nodes.forEach(node => {
      const nodeEl = this.createNodeElement(node);
      container.appendChild(nodeEl);
    });
  },
  
  /**
   * Create node DOM element
   */
  createNodeElement(node) {
    const el = document.createElement('div');
    el.className = 'workflow-node';
    el.dataset.nodeId = node.id;
    el.style.position = 'absolute';
    el.style.left = '0';
    el.style.top = '0';

    if (this.selectedNode === node || (this.selectedNodes && this.selectedNodes.includes(node))) el.classList.add('selected');
    if (node.status) el.classList.add(`status-${node.status}`);

    // Position node
    const x = node.x * this.zoom + this.panX;
    const y = node.y * this.zoom + this.panY;
    el.style.transform = `translate(${x}px, ${y}px) scale(${this.zoom})`;
    el.style.transformOrigin = 'top left';

    // Status badge icon map
    const statusIconMap = {
      success: 'fa-check',
      failed: 'fa-times',
      skipped: 'fa-minus',
      running: 'fa-spinner fa-spin'
    };

    const badgeHtml = node.status && statusIconMap[node.status] ? `
      <div class="node-status-badge badge-${node.status} ${node.status === 'running' ? 'loading' : ''}">
        <i class="fas ${statusIconMap[node.status]}"></i>
      </div>
    ` : '';

    const execTimeHtml = (node.duration_ms !== null && node.duration_ms !== undefined) ? `
      <div class="node-execution-time">${this.formatDuration(node.duration_ms)}</div>
    ` : '';

    const errorMsg = node.lastError ? String(node.lastError).substring(0, 200) : '';
    const errorTooltipHtml = node.lastError ? `
      <div class="node-error-tooltip">${errorMsg}</div>
    ` : '';

    // Node content
    el.innerHTML = `
      <div class="node-header" style="background: ${node.color || '#6366f1'};">
        <i class="${(node.icon || 'fa-cube').includes(' ') ? (node.icon || 'fa-cube') : 'fas ' + (node.icon || 'fa-cube')}"></i>
      </div>
      <div class="node-body">
        <div class="node-label">${node.label || node.type}</div>
        ${execTimeHtml}
      </div>
      ${badgeHtml}
      ${errorTooltipHtml}
      <div class="node-ports">
        ${node.inputs ? node.inputs.map((port, i) => `
          <div class="node-port input" data-port-id="${port.id}" data-port-index="${i}"></div>
        `).join('') : ''}
        ${node.outputs ? node.outputs.map((port, i) => `
          <div class="node-port output" data-port-id="${port.id}" data-port-index="${i}"></div>
        `).join('') : ''}
      </div>
    `;

    return el;
  },
  
  /**
   * Render connections
   */
  renderConnections() {
    if (!this.svg) return;
    
    // Clear existing connections
    this.svg.innerHTML = '';
    
    // Render each connection
    this.connections.forEach(conn => {
      this.renderConnection(conn);
    });
    
    // Render connection preview
    if (this.connectionStart && this.connectionPreview) {
      this.renderConnectionPreview();
    }
  },
  
  /**
   * Render a single connection
   */
  renderConnection(conn) {
    const sourceNode = this.nodes.find(n => n.id === conn.source_node_id);
    const targetNode = this.nodes.find(n => n.id === conn.target_node_id);
    
    if (!sourceNode || !targetNode) return;
    
    // Calculate raw port positions
    const startRaw = this.getPortPosition(sourceNode, conn.source_port_id, 'output');
    const endRaw = this.getPortPosition(targetNode, conn.target_port_id, 'input');
    
    // Transform to screen coordinates
    const start = {
      x: startRaw.x * this.zoom + this.panX,
      y: startRaw.y * this.zoom + this.panY
    };
    const end = {
      x: endRaw.x * this.zoom + this.panX,
      y: endRaw.y * this.zoom + this.panY
    };
    
    const isSelected = this.selectedConnection === conn;
    
    // Create path with both X and Y offsets
    const offsetX = (conn.pathOffset?.x || 0) * this.zoom;
    const offsetY = (conn.pathOffset?.y || 0) * this.zoom;
    const path = this.createBezierPath(start, end, { x: offsetX, y: offsetY });
    
    // Create SVG path element
    const pathEl = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    pathEl.setAttribute('d', path);
    pathEl.setAttribute('stroke', isSelected ? 'var(--accent)' : (conn.color || '#22c55e'));
    pathEl.setAttribute('stroke-width', isSelected ? '3' : '2');
    pathEl.setAttribute('fill', 'none');
    pathEl.setAttribute('class', 'workflow-connection');
    
    if (isSelected) pathEl.classList.add('selected');
    if (conn.status === 'running') pathEl.classList.add('running');
    if (conn.status === 'failed') pathEl.classList.add('failed');
    
    // Invisible hit area for easier clicking
    const hitPath = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    hitPath.setAttribute('d', path);
    hitPath.setAttribute('fill', 'none');
    hitPath.setAttribute('stroke', 'transparent');
    hitPath.setAttribute('stroke-width', '15'); // Slightly larger hit area
    hitPath.style.cursor = 'pointer';
    hitPath.style.pointerEvents = 'auto';
    
    hitPath.addEventListener('mousedown', (e) => {
      e.stopPropagation();
      
      const container = document.getElementById('workflowCanvasContainer');
      const rect = container.getBoundingClientRect();
      const x = (e.clientX - rect.left - this.panX) / this.zoom;
      const y = (e.clientY - rect.top - this.panY) / this.zoom;

      this.selectedConnection = conn;
      this.selectedNode = null;
      this.emit('nodeDeselected');
      
      // Start dragging connection path
      this.draggedConnection = conn;
      this.dragStartPos = { x, y };
      
      this.render();
    });
    
    this.svg.appendChild(pathEl);
    this.svg.appendChild(hitPath);
    
    // Add hover effect to show delete button
    hitPath.addEventListener('mouseenter', () => {
      this.renderConnectionDeleteButton(start, end, conn);
    });
    
    hitPath.addEventListener('mouseleave', (e) => {
      // Only hide if not moving to the delete button itself
      const toEl = e.relatedTarget;
      if (toEl && (toEl.closest('.conn-delete-btn') || toEl.closest('foreignObject'))) return;
      
      const btn = this.svg.querySelector(`foreignObject[data-conn-id="${conn.source_node_id}-${conn.target_node_id}"]`);
      if (btn) btn.remove();
    });

    // Add Delete Button if selected (persistent)
    if (isSelected) {
      this.renderConnectionDeleteButton(start, end, conn);
    }
  },
  
  /**
   * Render connection preview
   */
  renderConnectionPreview() {
    const node = this.connectionStart.node;
    const portRaw = this.getPortPosition(node, this.connectionStart.port.id, this.connectionStart.type);
    
    if (!portRaw) return;
 
    const portPos = {
      x: portRaw.x * this.zoom + this.panX,
      y: portRaw.y * this.zoom + this.panY
    };
    
    const mousePos = {
      x: this.connectionPreview.x * this.zoom + this.panX,
      y: this.connectionPreview.y * this.zoom + this.panY
    };
    
    // Always flow Left -> Right in the Bezier calculation for consistent curves
    const path = this.connectionStart.type === 'output' 
      ? this.createBezierPath(portPos, mousePos)
      : this.createBezierPath(mousePos, portPos);
    
    const pathEl = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    pathEl.setAttribute('d', path);
    pathEl.setAttribute('stroke', '#6366f1');
    pathEl.setAttribute('stroke-width', '2');
    pathEl.setAttribute('stroke-dasharray', '5,5');
    pathEl.setAttribute('fill', 'none');
    pathEl.setAttribute('class', 'workflow-connection-preview');
    
    this.svg.appendChild(pathEl);
  },
  
  /**
   * Create Bezier curve path
   */
  createBezierPath(start, end, pathOffset = { x: 0, y: 0 }) {
    const dx = end.x - start.x;
    const dy = end.y - start.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    const offset = Math.min(dist / 2, 100);
    
    // control points are shifted by pathOffset
    const cp1x = start.x + offset + pathOffset.x;
    const cp1y = start.y + pathOffset.y;
    const cp2x = end.x - offset + pathOffset.x;
    const cp2y = end.y + pathOffset.y;
    
    return `M ${start.x} ${start.y} C ${cp1x} ${cp1y}, ${cp2x} ${cp2y}, ${end.x} ${end.y}`;
  },
  
  /**
   * Create arrow marker
   */
  createArrowMarker(color) {
    const defs = document.createElementNS('http://www.w3.org/2000/svg', 'defs');
    const marker = document.createElementNS('http://www.w3.org/2000/svg', 'marker');
    marker.setAttribute('id', `arrow-${Date.now()}`);
    marker.setAttribute('markerWidth', '10');
    marker.setAttribute('markerHeight', '10');
    marker.setAttribute('refX', '9');
    marker.setAttribute('refY', '3');
    marker.setAttribute('orient', 'auto');
    marker.setAttribute('markerUnits', 'strokeWidth');
    
    const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    path.setAttribute('d', 'M0,0 L0,6 L9,3 z');
    path.setAttribute('fill', color);
    
    marker.appendChild(path);
    defs.appendChild(marker);
    
    return defs;
  },
  
  /**
   * Get port at position (globally across all nodes)
   */
  getGlobalPortAt(x, y) {
    for (const node of this.nodes) {
      const outputPort = this.getPortAt(node, x, y, 'output');
      if (outputPort) return { node, port: outputPort, type: 'output' };
      
      const inputPort = this.getPortAt(node, x, y, 'input');
      if (inputPort) return { node, port: inputPort, type: 'input' };
    }
    return null;
  },
  
  /**
   * Get node at position
   */
  getNodeAt(x, y) {
    for (let i = this.nodes.length - 1; i >= 0; i--) {
      const node = this.nodes[i];
      const width = 200;
      const height = 100;
      
      if (x >= node.x && x <= node.x + width &&
          y >= node.y && y <= node.y + height) {
        return node;
      }
    }
    return null;
  },
  
  /**
   * Get port at position
   */
  getPortAt(node, x, y, type) {
    const ports = type === 'input' ? node.inputs : node.outputs;
    if (!ports) return null;
    
    const portSize = 35; // Significantly larger hit area (radius) for easier connection
    
    // Get actual node element to find dimensions
    const el = document.querySelector(`.workflow-node[data-node-id="${node.id}"]`);
    if (el && el.offsetWidth > 0) {
      node._cachedWidth = el.offsetWidth;
      node._cachedHeight = el.offsetHeight;
    }
    const nodeWidth = node._cachedWidth || 200;
    const nodeHeight = node._cachedHeight || 100;
    
    // Use the same offset as getPortPosition for hit detection
    const portOffset = -2;
    
    for (let i = 0; i < ports.length; i++) {
      const port = ports[i];
      const portX = type === 'input' ? node.x + portOffset : node.x + nodeWidth - portOffset;
      
      // Distribute ports vertically
      const spacing = nodeHeight / (ports.length + 1);
      const portY = node.y + spacing * (i + 1);
      
      if (Math.abs(x - portX) < portSize && Math.abs(y - portY) < portSize) {
        return port;
      }
    }
    
    return null;
  },
  
  /**
   * Get port position
   */
  getPortPosition(node, portId, type) {
    const ports = type === 'input' ? node.inputs : node.outputs;
    if (!ports) return { x: 0, y: 0 };
    
    const portIndex = ports.findIndex(p => p.id === portId);
    if (portIndex === -1) return { x: 0, y: 0 };
    
    const el = document.querySelector(`.workflow-node[data-node-id="${node.id}"]`);
    
    // Use actual dimensions from the DOM if available (fallback to default if element is hidden and offsetWidth is 0)
    // Also cache dimensions to avoid layout thrashing during rapid re-renders (e.g. dragging)
    if (el && el.offsetWidth > 0) {
      node._cachedWidth = el.offsetWidth;
      node._cachedHeight = el.offsetHeight;
    }
    const nodeWidth = node._cachedWidth || 200;
    const nodeHeight = node._cachedHeight || 100;
    
    const spacing = nodeHeight / (ports.length + 1);
    const portY = node.y + spacing * (portIndex + 1);
    
    // Align with the port dots (8px is the offset from CSS)
    const portOffset = -2; // Adjustment to hit the center of the 12px dot
    const portX = type === 'input' ? node.x + portOffset : node.x + nodeWidth - portOffset;
    
    return { x: portX, y: portY };
  },
  
  /**
   * Start connection creation
   */
  startConnection(node, port, type) {
    this.connectionStart = { node, port, type: type || 'output' };
  },
  
  /**
   * Validate connection
   */
  validateConnection(sourceNode, sourcePort, targetNode, targetPort) {
    // Basic validation
    if (!sourceNode || !targetNode || !sourcePort || !targetPort) return false;
    if (sourceNode.id === targetNode.id) return false; // No self-connections
    
    // Check if connection already exists
    const exists = this.connections.some(c => 
      c.source_node_id === sourceNode.id && 
      c.source_port_id === sourcePort.id &&
      c.target_node_id === targetNode.id &&
      c.target_port_id === targetPort.id
    );
    if (exists) return false;
    
    return true;
  },

  /**
   * Create connection
   */
  createConnection(sourceNode, sourcePort, targetNode, targetPort) {
    // Validate connection
    if (!this.validateConnection(sourceNode, sourcePort, targetNode, targetPort)) {
      return;
    }
    
    const conn = {
      id: `conn_${Date.now()}`,
      source_node_id: sourceNode.id,
      source_port_id: sourcePort.id,
      target_node_id: targetNode.id,
      target_port_id: targetPort.id,
      color: '#22c55e'
    };
    
    this.connections.push(conn);
    this.saveHistory();
    this.emit('connectionCreated', conn);
    this.render();
  },
  /**
   * Delete connection
   */
  deleteConnection(conn) {
    if (!conn) return;
    
    // Find index using strict reference or property matching
    const index = this.connections.findIndex(c => {
      // 1. Check direct reference
      if (c === conn) return true;
      
      // 2. Check by ID (only if both have IDs)
      if (c.id && conn.id && c.id === conn.id) return true;
      
      // 3. Check by node/port coordinates (fallback for objects without IDs)
      return c.source_node_id === conn.source_node_id && 
             c.source_port_id === conn.source_port_id &&
             c.target_node_id === conn.target_node_id &&
             c.target_port_id === conn.target_port_id;
    });

    if (index !== -1) {
      this.connections.splice(index, 1);
      if (this.selectedConnection === conn) {
        this.selectedConnection = null;
      }
      this.saveHistory();
      this.emit('connectionDeleted', conn);
      this.render();
    }
  },
  
  /**
   * Get status icon
   */
  getStatusIcon(status) {
    const icons = {
      pending: 'clock',
      running: 'spinner fa-spin',
      success: 'check-circle',
      failed: 'times-circle',
      skipped: 'forward'
    };
    return icons[status] || 'circle';
  },
  
  /**
   * Clear canvas
   */
  clear() {
    this.nodes = [];
    this.connections = [];
    this.selectedNode = null;
    this.selectedNodes = [];
    this.selectedConnection = null;
    
    // Clear DOM immediately
    const container = document.getElementById('workflowCanvasContainer');
    if (container) {
      container.querySelectorAll('.workflow-node').forEach(el => el.remove());
    }
    if (this.svg) {
      this.svg.innerHTML = '';
    }
    
    this.render();
    this.saveState();
  },
  
  /**
   * Process ports data
   */
  processPorts(ports, type) {
    if (!ports || (Array.isArray(ports) && ports.length === 0)) {
      return [{ id: 'main', label: type }];
    }
    
    if (Array.isArray(ports)) {
      return ports.map(p => {
        if (typeof p === 'string') return { id: p, label: p };
        return p;
      });
    }
    
    return [{ id: 'main', label: type }];
  },
  
  /**
   * Add a node to the canvas
   */
  addNode(nodeData) {
    // NEW: Initialize with default config from NodeLibrary
    let initialConfig = nodeData.config || {};
    if (Object.keys(initialConfig).length === 0 && nodeData.properties) {
      nodeData.properties.forEach(prop => {
        if (prop.default !== undefined) {
          initialConfig[prop.name] = prop.default;
        }
      });
    }

    const node = {
      id: nodeData.id || `node_${Date.now()}`,
      type: nodeData.type || nodeData.name,
      label: nodeData.label || nodeData.displayName || nodeData.name || 'New Node',
      icon: nodeData.icon || 'fa-cube',
      color: nodeData.color || '#6366f1',
      x: nodeData.x || 100,
      y: nodeData.y || 100,
      config: initialConfig,
      inputs: this.processPorts(nodeData.inputs, 'Input'),
      outputs: this.processPorts(nodeData.outputs, 'Output'),
      status: null
    };
    
    this.nodes.push(node);
    this.saveHistory();
    this.render();
    
    // Auto-select the new node
    this.selectedNode = node;
    this.emit('nodeAdded', node);
    this.emit('nodeSelected', node);
    
    return node;
  },
  
  /**
   * Delete a node and its connections
   */
  deleteNode(nodeOrId) {
    const nodeId = (nodeOrId && typeof nodeOrId === 'object') ? nodeOrId.id : nodeOrId;
    if (!nodeId) return;
    
    const nodeIndex = this.nodes.findIndex(n => n.id === nodeId);
    if (nodeIndex === -1) return;
    
    // Remove connections associated with this node
    this.connections = this.connections.filter(c => 
      c.source_node_id !== nodeId && c.target_node_id !== nodeId
    );
    
    // Remove the node
    this.nodes.splice(nodeIndex, 1);
    
    if (this.selectedNode && this.selectedNode.id === nodeId) {
      this.selectedNode = null;
      this.emit('nodeDeselected');
    }
    
    this.saveHistory();
    this.render();
    this.emit('nodeDeleted', nodeId);
  },

  /**
   * Load workflow
   */
  loadWorkflow(workflow) {
    let def = workflow.definition;
    
    // Parse definition if it comes from the DB as a stringified JSON string
    if (typeof def === 'string') {
      try {
        def = JSON.parse(def);
      } catch (e) {
        console.error('Failed to parse workflow definition string:', e);
        def = { nodes: [], connections: [] };
      }
    }
    
    this.nodes = (def?.nodes || []).map(node => {
      // Enrich node dengan data terbaru dari NodeLibrary berdasarkan type
      const libraryDef = (typeof NodeLibrary !== 'undefined')
        ? NodeLibrary.nodeTypes.find(n => n.name === node.type)
        : null;
      
      return {
        ...node,
        // Pakai data library sebagai fallback jika node lama tidak punya icon/color
        icon:  node.icon  || libraryDef?.icon  || 'fa-cube',
        color: node.color || libraryDef?.color || '#6366f1',
        label: node.label || libraryDef?.displayName || node.type,
      };
    });
    this.connections = def?.connections || [];
    this.selectedNode = null;
    this.selectedNodes = [];
    this.selectedConnection = null;
    this.saveHistory(); // Save initial state for undo
    this.render();
  },
  
  /**
   * Get workflow definition
   */
  getWorkflowDefinition() {
    return {
      nodes: this.nodes,
      connections: this.connections
    };
  },
  
  /**
   * Save state to localStorage
   */
  saveState() {
    localStorage.setItem('workflow_canvas_zoom', this.zoom);
    localStorage.setItem('workflow_canvas_panX', this.panX);
    localStorage.setItem('workflow_canvas_panY', this.panY);
  },
  
  /**
   * Load state from localStorage
   */
  loadState() {
    this.zoom = parseFloat(localStorage.getItem('workflow_canvas_zoom')) || 1;
    this.panX = parseFloat(localStorage.getItem('workflow_canvas_panX')) || 0;
    this.panY = parseFloat(localStorage.getItem('workflow_canvas_panY')) || 0;
  },
  
  /**
   * Fit all nodes to screen
   */
  fitToScreen() {
    if (this.nodes.length === 0) {
      this.zoom = 1;
      this.panX = 0;
      this.panY = 0;
      this.render();
      return;
    }

    const container = document.getElementById('workflowCanvasContainer');
    const rect = container.getBoundingClientRect();
    
    // Find bounds
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    this.nodes.forEach(n => {
      minX = Math.min(minX, n.x);
      minY = Math.min(minY, n.y);
      maxX = Math.max(maxX, n.x + 200); // 200 is default width
      maxY = Math.max(maxY, n.y + 100); // 100 is default height
    });

    const padding = 40;
    const graphWidth = maxX - minX + padding * 2;
    const graphHeight = maxY - minY + padding * 2;

    this.zoom = Math.min(
      rect.width / graphWidth,
      rect.height / graphHeight,
      1 // Max zoom 100%
    );

    this.panX = (rect.width - (maxX + minX) * this.zoom) / 2;
    this.panY = (rect.height - (maxY + minY) * this.zoom) / 2;

    this.render();
  },

  /**
   * Format duration in ms to human-readable string
   * @param {number} ms - duration in milliseconds
   * @returns {string}
   */
  formatDuration(ms) {
    if (!ms && ms !== 0) return '';
    if (ms < 1000) return `${ms}ms`;
    return `${(ms / 1000).toFixed(1)}s`;
  },

  /**
   * Update a node's status and optional metadata
   * @param {string} nodeId
   * @param {string} status - 'idle'|'running'|'success'|'failed'|'skipped'
   * @param {Object} meta - { duration_ms?: number, output?: any, error?: string }
   */
  updateNodeStatus(nodeId, status, meta = {}) {
    const node = this.nodes.find(n => n.id === nodeId);
    if (!node) return;
    node.status = status;
    if (meta.duration_ms !== undefined) node.duration_ms = meta.duration_ms;
    if (meta.output !== undefined) node.lastOutput = meta.output;
    if (meta.error !== undefined) node.lastError = meta.error;
    this.render();
  },

  /**
   * Reset all node statuses and runtime metadata
   */
  resetNodeStatuses() {
    this.nodes.forEach(node => {
      node.status = null;
      node.duration_ms = null;
      node.lastOutput = null;
      node.lastError = null;
    });
    this.render();
  },

  /**
   * Event emitter
   */
  listeners: {},
  on(event, callback) {
    if (!this.listeners[event]) {
      this.listeners[event] = [];
    }
    this.listeners[event].push(callback);
  },
  emit(event, data) {
    if (this.listeners[event]) {
      this.listeners[event].forEach(callback => callback(data));
    }
  },

  /**
   * Undo/Redo logic
   */
  saveHistory() {
    if (typeof HistoryManager !== 'undefined') {
      HistoryManager.saveState(this.nodes, this.connections);
    }
  },

  undo() {
    if (typeof HistoryManager !== 'undefined') {
      const state = HistoryManager.undo(this.nodes, this.connections);
      if (state) {
        this.nodes = state.nodes;
        this.connections = state.connections;
        this.selectedNode = null;
        this.selectedNodes = [];
        this.selectedConnection = null;
        this.render();
        Toast.info('Undo', 'Last action undone');
      }
    }
  },

  redo() {
    if (typeof HistoryManager !== 'undefined') {
      const state = HistoryManager.redo();
      if (state) {
        this.nodes = state.nodes;
        this.connections = state.connections;
        this.selectedNode = null;
        this.selectedNodes = [];
        this.selectedConnection = null;
        this.render();
        Toast.info('Redo', 'Action redone');
      }
    }
  }
};
