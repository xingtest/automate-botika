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
  selectedConnection: null,
  draggedNode: null,
  dragOffset: { x: 0, y: 0 },
  
  // Canvas transform
  zoom: 1,
  panX: 0,
  panY: 0,
  isPanning: false,
  panStart: { x: 0, y: 0 },
  
  // Connection creation
  connectionStart: null,
  connectionPreview: null,
  
  // Grid settings
  gridSize: 20,
  gridColor: 'rgba(100, 116, 139, 0.1)',
  
  /**
   * Initialize the canvas
   */
  init() {
    console.log('[WorkflowCanvas] Initializing...');
    
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
    container.addEventListener('mouseup', (e) => this.onMouseUp(e));
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
  },
  
  /**
   * Handle mouse down
   */
  onMouseDown(e) {
    const container = document.getElementById('workflowCanvasContainer');
    const rect = container.getBoundingClientRect();
    const x = (e.clientX - rect.left - this.panX) / this.zoom;
    const y = (e.clientY - rect.top - this.panY) / this.zoom;
    
    // Check if clicking on a node
    const clickedNode = this.getNodeAt(x, y);
    
    if (clickedNode) {
      // Check for double click
      const now = Date.now();
      if (this.lastClick && now - this.lastClick < 300 && this.lastClickNode === clickedNode) {
        this.emit('nodeDoubleClicked', clickedNode);
        this.lastClick = 0;
        return;
      }
      this.lastClick = now;
      this.lastClickNode = clickedNode;

      // Check if clicking on output port (for connection creation)
      const port = this.getPortAt(clickedNode, x, y, 'output');
      if (port) {
        this.startConnection(clickedNode, port);
        return;
      }
      
      // Start dragging node
      this.selectedNode = clickedNode;
      this.selectedConnection = null; // Deselect connection when node is clicked
      this.draggedNode = clickedNode;
      this.dragOffset = {
        x: x - clickedNode.x,
        y: y - clickedNode.y
      };
      
      // Emit node selected event
      this.emit('nodeSelected', clickedNode);
    } else {
      // Check if clicking a connection (selection logic is already in renderConnection, but we can clear here)
      if (!this.selectedConnection) {
        this.selectedNode = null;
        this.emit('nodeDeselected');
      }
      
      // Start panning
      this.isPanning = true;
      this.panStart = { x: e.clientX - this.panX, y: e.clientY - this.panY };
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
      this.connectionPreview = { x, y };
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
      const targetNode = this.getNodeAt(x, y);
      if (targetNode && targetNode !== this.connectionStart.node) {
        const port = this.getPortAt(targetNode, x, y, 'input');
        if (port) {
          this.createConnection(this.connectionStart.node, this.connectionStart.port, targetNode, port);
        }
      }
      this.connectionStart = null;
      this.connectionPreview = null;
      this.render();
      return;
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

    // Delete selected node or connection
    if (e.key === 'Delete' || e.key === 'Backspace') {
      // Don't delete if typing in a configuration field
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
      
      if (this.selectedNode) {
        this.deleteNode(this.selectedNode);
      } else if (this.selectedConnection) {
        this.deleteConnection(this.selectedConnection);
      }
    }
    
    // Deselect with Escape
    if (e.key === 'Escape') {
      this.selectedNode = null;
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
  renderConnectionDeleteButton(start, end) {
    // Calculate mid point of bezier curve
    const midX = (start.x + end.x) / 2;
    const midY = (start.y + end.y) / 2;
    
    const foreignObject = document.createElementNS('http://www.w3.org/2000/svg', 'foreignObject');
    foreignObject.setAttribute('x', midX - 12);
    foreignObject.setAttribute('y', midY - 12);
    foreignObject.setAttribute('width', '24');
    foreignObject.setAttribute('height', '24');
    foreignObject.style.pointerEvents = 'auto';
    
    foreignObject.innerHTML = `
      <div class="conn-delete-btn" style="background:var(--error); color:white; width:24px; height:24px; border-radius:50%; display:flex; align-items:center; justify-content:center; cursor:pointer; box-shadow:0 2px 5px rgba(0,0,0,0.2); font-size:10px;">
        <i class="fas fa-times"></i>
      </div>
    `;
    
    foreignObject.querySelector('.conn-delete-btn').addEventListener('click', (e) => {
      e.stopPropagation();
      this.deleteConnection(this.selectedConnection);
    });
    
    this.svg.appendChild(foreignObject);
  },

  /**
   * Delete connection
   */
  deleteConnection(conn) {
    if (!conn) return;
    const index = this.connections.indexOf(conn);
    if (index !== -1) {
      this.connections.splice(index, 1);
      this.selectedConnection = null;
      this.saveHistory();
      this.emit('connectionDeleted', conn);
      this.render();
    }
  },

  /**
   * Render delete button for connection
   */
  renderConnectionDeleteButton(start, end, conn) {
    const midX = (start.x + end.x) / 2;
    const midY = (start.y + end.y) / 2;
    
    const foreignObject = document.createElementNS('http://www.w3.org/2000/svg', 'foreignObject');
    foreignObject.setAttribute('x', midX - 12);
    foreignObject.setAttribute('y', midY - 12);
    foreignObject.setAttribute('width', '24');
    foreignObject.setAttribute('height', '24');
    foreignObject.style.pointerEvents = 'auto';
    
    foreignObject.innerHTML = `
      <div class="conn-delete-btn" style="background:#ef4444; color:white; width:24px; height:24px; border-radius:50%; display:flex; align-items:center; justify-content:center; cursor:pointer; box-shadow:0 2px 8px rgba(0,0,0,0.3); border:2px solid white;">
        <i class="fas fa-times" style="font-size:10px;"></i>
      </div>
    `;
    
    foreignObject.querySelector('.conn-delete-btn').addEventListener('click', (e) => {
      e.stopPropagation();
      this.deleteConnection(conn);
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
        { label: 'Duplicate Node', icon: 'fa-copy', action: () => this.duplicateNode(target) },
        { label: 'Reset Status', icon: 'fa-undo', action: () => { target.status = null; this.render(); } },
        { type: 'divider' },
        { label: 'Delete Node', icon: 'fa-trash', color: 'var(--error)', action: () => this.deleteNode(target) }
      ];
    } else {
      items = [
        { label: 'Add Node', icon: 'fa-plus', action: () => this.emit('showNodeLibrary', { x, y }) },
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
   * Duplicate node
   */
  duplicateNode(node) {
    const newNode = this.addNode({
      ...node,
      id: `node_${Date.now()}`,
      x: node.x + 50,
      y: node.y + 50,
      status: null
    });
    this.selectedNode = newNode;
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
    
    // Render connections
    this.renderConnections();
    
    // Render nodes
    this.renderNodes();
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
    
    if (this.selectedNode === node) {
      el.classList.add('selected');
    }
    
    if (node.status) {
      el.classList.add(`status-${node.status}`);
    }
    
    // Position node
    const x = node.x * this.zoom + this.panX;
    const y = node.y * this.zoom + this.panY;
    el.style.transform = `translate(${x}px, ${y}px) scale(${this.zoom})`;
    
    // Node content
    el.innerHTML = `
      <div class="node-header" style="background: ${node.color || '#6366f1'};">
        <i class="fas ${node.icon || 'fa-cube'}"></i>
      </div>
      <div class="node-body">
        <div class="node-label">${node.label || node.type}</div>
        ${node.status ? `<div class="node-status"><i class="fas fa-${this.getStatusIcon(node.status)}"></i></div>` : ''}
      </div>
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
    
    // Create path
    const path = this.createBezierPath(start, end);
    
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
    hitPath.setAttribute('stroke-width', '12');
    hitPath.style.cursor = 'pointer';
    hitPath.style.pointerEvents = 'auto';
    
    hitPath.addEventListener('click', (e) => {
      e.stopPropagation();
      this.selectedConnection = conn;
      this.selectedNode = null;
      this.emit('nodeDeselected');
      this.render();
    });
    
    this.svg.appendChild(pathEl);
    this.svg.appendChild(hitPath);
    
    // Add Delete Button if selected
    if (isSelected) {
      this.renderConnectionDeleteButton(start, end, conn);
    }
  },
  
  /**
   * Render connection preview
   */
  renderConnectionPreview() {
    const sourceNode = this.connectionStart.node;
    const sourcePort = this.getPortPosition(sourceNode, this.connectionStart.port.id, 'output');
    
    if (!sourcePort) return;
    
    const targetPos = {
      x: this.connectionPreview.x * this.zoom + this.panX,
      y: this.connectionPreview.y * this.zoom + this.panY
    };
    
    const path = this.createBezierPath(sourcePort, targetPos);
    
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
  createBezierPath(start, end) {
    const dx = end.x - start.x;
    const dy = end.y - start.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    const offset = Math.min(dist / 2, 100);
    
    return `M ${start.x} ${start.y} C ${start.x + offset} ${start.y}, ${end.x - offset} ${end.y}, ${end.x} ${end.y}`;
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
    
    const portSize = 20; // Larger hit area for easier connection
    const nodeWidth = 200;
    
    // Get actual node element to find height
    const el = document.querySelector(`.workflow-node[data-node-id="${node.id}"]`);
    const nodeHeight = el ? el.offsetHeight / this.zoom : 100;
    
    for (let i = 0; i < ports.length; i++) {
      const port = ports[i];
      const portX = type === 'input' ? node.x : node.x + nodeWidth;
      const portY = node.y + nodeHeight / 2; // Center ports vertically
      
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
    
    const nodeWidth = 200;
    const el = document.querySelector(`.workflow-node[data-node-id="${node.id}"]`);
    const nodeHeight = el ? el.offsetHeight : 100;
    
    // Calculate vertical position based on port index
    const spacing = nodeHeight / (ports.length + 1);
    const portY = (node.y + spacing * (portIndex + 1));
    const portX = type === 'input' ? node.x : node.x + nodeWidth;
    
    return {
      x: portX,
      y: portY
    };
  },
  
  /**
   * Start connection creation
   */
  startConnection(node, port) {
    this.connectionStart = { node, port };
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
    const index = this.connections.findIndex(c => 
      c.source_node_id === conn.source_node_id && 
      c.source_port_id === conn.source_port_id &&
      c.target_node_id === conn.target_node_id &&
      c.target_port_id === conn.target_port_id
    );
    if (index !== -1) {
      this.connections.splice(index, 1);
      if (this.selectedConnection === conn) this.selectedConnection = null;
      this.saveHistory();
      this.emit('connectionDeleted', conn);
      this.render();
    }
  },
  
  /**
   * Validate connection
   */
  validateConnection(sourceNode, sourcePort, targetNode, targetPort) {
    // Check for cycles
    if (this.wouldCreateCycle(sourceNode.id, targetNode.id)) {
      return false;
    }
    
    // Check if target port already has a connection
    const existingConn = this.connections.find(c => 
      c.target_node_id === targetNode.id && c.target_port_id === targetPort.id
    );
    
    if (existingConn) {
      return false;
    }
    
    return true;
  },
  
  /**
   * Check if connection would create a cycle
   */
  wouldCreateCycle(sourceId, targetId) {
    const visited = new Set();
    const stack = [targetId];
    
    while (stack.length > 0) {
      const nodeId = stack.pop();
      
      if (nodeId === sourceId) {
        return true;
      }
      
      if (visited.has(nodeId)) {
        continue;
      }
      
      visited.add(nodeId);
      
      // Find all nodes that this node connects to
      const outgoing = this.connections.filter(c => c.source_node_id === nodeId);
      outgoing.forEach(c => stack.push(c.target_node_id));
    }
    
    return false;
  },
  
  /**
   * Add node to canvas
   */
  addNode(nodeData) {
    // Handle declarative inputs/outputs if they are just strings
    const processPorts = (ports, defaultLabel) => {
      if (!ports) return [{ id: 'input', label: defaultLabel, dataType: 'any' }];
      return ports.map(p => typeof p === 'string' ? { id: p, label: p.charAt(0).toUpperCase() + p.slice(1), dataType: 'any' } : p);
    };

    const node = {
      id: `node_${Date.now()}`,
      type: nodeData.type || nodeData.name,
      label: nodeData.displayName || nodeData.label || nodeData.name,
      icon: nodeData.icon || 'fa-cube',
      color: nodeData.color || '#6366f1',
      x: nodeData.x || 100,
      y: nodeData.y || 100,
      config: nodeData.config || {},
      settings: nodeData.settings || {
        continueOnFail: false,
        retryCount: 0,
        retryDelay: 1000
      },
      inputs: processPorts(nodeData.inputs, 'Input'),
      outputs: processPorts(nodeData.outputs, 'Output'),
      status: null
    };
    
    this.nodes.push(node);
    this.saveHistory();
    this.emit('nodeAdded', node);
    this.render();
    return node;
  },
  
  /**
   * Delete node
   */
  deleteNode(node) {
    const index = this.nodes.findIndex(n => n.id === node.id);
    if (index !== -1) {
      this.nodes.splice(index, 1);
      // Remove associated connections
      this.connections = this.connections.filter(c => 
        c.source_node_id !== node.id && c.target_node_id !== node.id
      );
      if (this.selectedNode === node) this.selectedNode = null;
      this.saveHistory();
      this.emit('nodeDeleted', node);
      this.render();
    }
  },
  
  /**
   * Delete connection
   */
  deleteConnection(conn) {
    const index = this.connections.findIndex(c => 
      c.id === conn.id || (
        c.source_node_id === conn.source_node_id && 
        c.source_port_id === conn.source_port_id &&
        c.target_node_id === conn.target_node_id &&
        c.target_port_id === conn.target_port_id
      )
    );
    if (index !== -1) {
      this.connections.splice(index, 1);
      if (this.selectedConnection === conn) this.selectedConnection = null;
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
   * Load workflow
   */
  loadWorkflow(workflow) {
    this.nodes = workflow.definition?.nodes || [];
    this.connections = workflow.definition?.connections || [];
    this.selectedNode = null;
    this.selectedConnection = null;
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
   * Update a node's status
   */
  updateNodeStatus(nodeId, status) {
    const node = this.nodes.find(n => n.id === nodeId);
    if (node) {
      node.status = status;
      
      // Update incoming connections status for animation
      this.connections.forEach(conn => {
        if (conn.target_node_id === nodeId) {
          conn.status = status;
        }
      });
      
      this.render();
    }
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
        this.selectedConnection = null;
        this.render();
        Toast.info('Redo', 'Action redone');
      }
    }
  }
};
