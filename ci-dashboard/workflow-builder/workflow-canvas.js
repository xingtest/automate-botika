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
      // Check if clicking on output port (for connection creation)
      const port = this.getPortAt(clickedNode, x, y, 'output');
      if (port) {
        this.startConnection(clickedNode, port);
        return;
      }
      
      // Start dragging node
      this.selectedNode = clickedNode;
      this.draggedNode = clickedNode;
      this.dragOffset = {
        x: x - clickedNode.x,
        y: y - clickedNode.y
      };
      
      // Emit node selected event
      this.emit('nodeSelected', clickedNode);
    } else {
      // Start panning
      this.isPanning = true;
      this.panStart = { x: e.clientX - this.panX, y: e.clientY - this.panY };
      this.selectedNode = null;
      this.emit('nodeDeselected');
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
      this.draggedNode.x = x - this.dragOffset.x;
      this.draggedNode.y = y - this.dragOffset.y;
      this.render();
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
    
    // Stop dragging/panning
    this.draggedNode = null;
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
    // Delete selected node
    if (e.key === 'Delete' && this.selectedNode) {
      this.deleteNode(this.selectedNode);
    }
    
    // Deselect with Escape
    if (e.key === 'Escape') {
      this.selectedNode = null;
      this.connectionStart = null;
      this.connectionPreview = null;
      this.emit('nodeDeselected');
      this.render();
    }
  },
  
  /**
   * Resize canvas
   */
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
    
    this.ctx.strokeStyle = this.gridColor;
    this.ctx.lineWidth = 1 / this.zoom;
    
    // Vertical lines
    for (let x = (offsetX % this.gridSize); x < width; x += this.gridSize) {
      this.ctx.beginPath();
      this.ctx.moveTo(x, 0);
      this.ctx.lineTo(x, height);
      this.ctx.stroke();
    }
    
    // Horizontal lines
    for (let y = (offsetY % this.gridSize); y < height; y += this.gridSize) {
      this.ctx.beginPath();
      this.ctx.moveTo(0, y);
      this.ctx.lineTo(width, y);
      this.ctx.stroke();
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
    
    // Calculate port positions
    const sourcePort = this.getPortPosition(sourceNode, conn.source_port_id, 'output');
    const targetPort = this.getPortPosition(targetNode, conn.target_port_id, 'input');
    
    if (!sourcePort || !targetPort) return;
    
    // Create path
    const path = this.createBezierPath(sourcePort, targetPort);
    
    // Create SVG path element
    const pathEl = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    pathEl.setAttribute('d', path);
    pathEl.setAttribute('stroke', conn.color || '#22c55e');
    pathEl.setAttribute('stroke-width', '2');
    pathEl.setAttribute('fill', 'none');
    pathEl.setAttribute('class', 'workflow-connection');
    pathEl.dataset.connectionId = conn.id;
    
    if (this.selectedConnection === conn) {
      pathEl.classList.add('selected');
    }
    
    // Add click handler
    pathEl.style.pointerEvents = 'stroke';
    pathEl.style.cursor = 'pointer';
    pathEl.addEventListener('click', () => {
      this.selectedConnection = conn;
      this.render();
    });
    
    this.svg.appendChild(pathEl);
    
    // Add arrow marker
    const marker = this.createArrowMarker(conn.color || '#22c55e');
    this.svg.appendChild(marker);
    pathEl.setAttribute('marker-end', `url(#arrow-${conn.id})`);
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
    
    const portSize = 12;
    const nodeWidth = 200;
    const nodeHeight = 100;
    
    for (let i = 0; i < ports.length; i++) {
      const port = ports[i];
      const portX = type === 'input' ? node.x : node.x + nodeWidth;
      const portY = node.y + nodeHeight / 2;
      
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
    if (!ports) return null;
    
    const portIndex = ports.findIndex(p => p.id === portId);
    if (portIndex === -1) return null;
    
    const nodeWidth = 200;
    const nodeHeight = 100;
    
    return {
      x: (type === 'input' ? node.x : node.x + nodeWidth) * this.zoom + this.panX,
      y: (node.y + nodeHeight / 2) * this.zoom + this.panY
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
      Toast.error('Invalid Connection', 'Cannot create this connection');
      return;
    }
    
    const connection = {
      id: `conn_${Date.now()}`,
      source_node_id: sourceNode.id,
      source_port_id: sourcePort.id,
      target_node_id: targetNode.id,
      target_port_id: targetPort.id,
      color: '#22c55e'
    };
    
    this.connections.push(connection);
    this.emit('connectionCreated', connection);
    this.render();
    this.saveState();
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
    const node = {
      id: `node_${Date.now()}`,
      type: nodeData.type,
      label: nodeData.name || nodeData.type,
      icon: nodeData.icon || 'fa-cube',
      color: nodeData.color || '#6366f1',
      x: nodeData.x || 100,
      y: nodeData.y || 100,
      config: nodeData.config || {},
      inputs: nodeData.inputs || [{ id: 'input', label: 'Input', dataType: 'any' }],
      outputs: nodeData.outputs || [{ id: 'output', label: 'Output', dataType: 'any' }],
      status: null
    };
    
    this.nodes.push(node);
    this.emit('nodeAdded', node);
    this.render();
    this.saveState();
    
    return node;
  },
  
  /**
   * Delete node
   */
  deleteNode(node) {
    // Remove node
    const index = this.nodes.indexOf(node);
    if (index > -1) {
      this.nodes.splice(index, 1);
    }
    
    // Remove connected connections
    this.connections = this.connections.filter(c => 
      c.source_node_id !== node.id && c.target_node_id !== node.id
    );
    
    this.selectedNode = null;
    this.emit('nodeDeleted', node);
    this.render();
    this.saveState();
  },
  
  /**
   * Delete connection
   */
  deleteConnection(connection) {
    const index = this.connections.indexOf(connection);
    if (index > -1) {
      this.connections.splice(index, 1);
    }
    
    this.selectedConnection = null;
    this.emit('connectionDeleted', connection);
    this.render();
    this.saveState();
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
  }
};
