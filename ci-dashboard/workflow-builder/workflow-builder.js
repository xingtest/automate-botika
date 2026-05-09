/**
 * Workflow Builder Main Controller
 * Integrates all workflow builder components
 */

const WorkflowBuilder = {
  autoSaveInterval: null,
  initialized: false,
  
  /**
   * Initialize workflow builder
   */
  async init() {
    if (this.initialized) {
      console.log('[WorkflowBuilder] Already initialized, skipping...');
      return;
    }
    
    console.log('[WorkflowBuilder] Initializing...');
    this.initialized = true;
    
    // Initialize components
    await this.initializeComponents();
    
    // Setup toolbar events
    this.setupToolbarEvents();
    
    // Setup keyboard shortcuts
    this.setupKeyboardShortcuts();
    
    // Setup auto-save
    this.setupAutoSave();
    
    // Load last workflow or create new
    await this.loadLastWorkflow();
    
    console.log('[WorkflowBuilder] Initialized successfully');
  },
  
  /**
   * Initialize all components
   */
  async initializeComponents() {
    // Initialize canvas
    WorkflowCanvas.init();
    
    // Initialize node library
    await NodeLibrary.init();
    
    // Initialize node config panel
    NodeConfigPanel.init();
    
    // Initialize execution monitor
    if (typeof ExecutionMonitor !== 'undefined') {
      ExecutionMonitor.init();
    }
    
    // Setup canvas event listeners
    WorkflowCanvas.on('nodeSelected', (node) => {
      this.onNodeSelected(node);
    });
    
    WorkflowCanvas.on('nodeDeselected', () => {
      this.onNodeDeselected();
    });
    
    WorkflowCanvas.on('nodeAdded', (node) => {
      this.markAsModified();
      this.updateCanvasInfo();
    });
    
    WorkflowCanvas.on('nodeDeleted', (node) => {
      this.markAsModified();
      this.updateCanvasInfo();
    });
    
    WorkflowCanvas.on('connectionCreated', (conn) => {
      this.markAsModified();
      this.updateCanvasInfo();
    });
    
    WorkflowCanvas.on('connectionDeleted', (conn) => {
      this.markAsModified();
      this.updateCanvasInfo();
    });
  },
  
  /**
   * Setup toolbar events
   */
  setupToolbarEvents() {
    // New workflow
    document.getElementById('wfNewBtn')?.addEventListener('click', () => {
      this.newWorkflow();
    });
    
    // Save workflow
    document.getElementById('wfSaveBtn')?.addEventListener('click', () => {
      this.saveWorkflow();
    });
    
    // Load workflow
    document.getElementById('wfLoadBtn')?.addEventListener('click', () => {
      this.showLoadDialog();
    });
    
    // Run/Stop Action Button
    document.getElementById('wfActionBtn')?.addEventListener('click', () => {
      if (this.isExecuting()) {
        this.stopWorkflow();
      } else {
        this.runWorkflow();
      }
    });
    
    // Debug mode
    document.getElementById('wfDebugBtn')?.addEventListener('click', () => {
      this.toggleDebugMode();
    });
    
    // Templates
    document.getElementById('wfTemplatesBtn')?.addEventListener('click', () => {
      this.showTemplatesDialog();
    });
    
    // Validate
    document.getElementById('wfValidateBtn')?.addEventListener('click', () => {
      this.validateWorkflow();
    });

    // Toggle Logs
    document.getElementById('wfLogsBtn')?.addEventListener('click', () => {
      this.toggleExecutionPanel();
    });
    
    // Export
    document.getElementById('wfExportBtn')?.addEventListener('click', () => {
      this.exportWorkflow();
    });
    
    // Import
    document.getElementById('wfImportBtn')?.addEventListener('click', () => {
      this.importWorkflow();
    });
    
    // Share
    document.getElementById('wfShareBtn')?.addEventListener('click', () => {
      this.shareWorkflow();
    });
    
    // Zoom controls
    document.getElementById('wfZoomIn')?.addEventListener('click', () => {
      WorkflowCanvas.zoom = Math.min(2, WorkflowCanvas.zoom * 1.1);
      WorkflowCanvas.render();
      this.updateZoomLevel();
    });
    
    document.getElementById('wfZoomOut')?.addEventListener('click', () => {
      WorkflowCanvas.zoom = Math.max(0.25, WorkflowCanvas.zoom * 0.9);
      WorkflowCanvas.render();
      this.updateZoomLevel();
    });
    
    document.getElementById('wfZoomFit')?.addEventListener('click', () => {
      this.fitToScreen();
    });
  },
  
  /**
   * Setup keyboard shortcuts
   */
  setupKeyboardShortcuts() {
    document.addEventListener('keydown', (e) => {
      // Check if workflow builder is active
      if (!document.getElementById('page-workflow-builder')?.classList.contains('active')) return;

      // Ctrl+S: Save
      if (e.ctrlKey && e.key === 's') {
        e.preventDefault();
        this.saveWorkflow();
      }
      
      // Ctrl+R: Run
      if (e.ctrlKey && e.key === 'r') {
        e.preventDefault();
        this.runWorkflow();
      }
      
      // Ctrl+N: New
      if (e.ctrlKey && e.key === 'n') {
        e.preventDefault();
        this.newWorkflow();
      }
      
      // Ctrl+O: Open
      if (e.ctrlKey && e.key === 'o') {
        e.preventDefault();
        this.showLoadDialog();
      }
    });
  },
  
  /**
   * Setup auto-save
   */
  setupAutoSave() {
    this.autoSaveInterval = setInterval(() => {
      if (WorkflowManager.isModified && WorkflowManager.currentWorkflow) {
        console.log('[WorkflowBuilder] Auto-saving...');
        this.saveWorkflow(true);
      }
    }, 30000); // Every 30 seconds
  },
  
  /**
   * New workflow
   */
  async newWorkflow() {
    if (WorkflowManager.isModified) {
      const confirmed = confirm('You have unsaved changes. Create new workflow?');
      if (!confirmed) return;
    }
    
    WorkflowManager.newWorkflow();
    WorkflowCanvas.clear();
    this.updateWorkflowName();
    this.updateCanvasInfo();
    
    Toast.success('New Workflow', 'Created new workflow');
  },
  
  /**
   * Save workflow
   */
  async saveWorkflow(isAutoSave = false) {
    try {
      // If no workflow ID, prompt for name
      if (!WorkflowManager.currentWorkflow?.id && !isAutoSave) {
        const name = prompt('Enter workflow name:', WorkflowManager.currentWorkflow?.name || 'Untitled Workflow');
        if (!name) return;
        
        WorkflowManager.currentWorkflow.name = name;
      }
      
      const workflow = await WorkflowManager.saveWorkflow(isAutoSave);
      
      if (workflow) {
        this.updateWorkflowName();
        if (!isAutoSave) {
          Toast.success('Saved', `Workflow "${workflow.name}" saved successfully`);
        }
      }
    } catch (error) {
      console.error('[WorkflowBuilder] Error saving workflow:', error);
      if (!isAutoSave) {
        Toast.error('Save Failed', error.message || 'Failed to save workflow');
      }
    }
  },
  
  /**
   * Show load dialog
   */
  async showLoadDialog() {
    try {
      // Fetch workflows from backend
      const response = await BackendAPI.get('/workflows');
      const workflows = Array.isArray(response) ? response : (response?.data || []);
      
      if (workflows.length === 0) {
        Toast.warning('No Workflows', 'No saved workflows found');
      }
      
      // Create dialog
      const dialog = document.createElement('div');
      dialog.className = 'workflow-dialog-overlay';
      dialog.innerHTML = `
        <div class="workflow-dialog">
          <div class="workflow-dialog-header">
            <h3><i class="fas fa-folder-open"></i> Load Workflow</h3>
            <button class="btn-close" onclick="this.closest('.workflow-dialog-overlay').remove()">
              <i class="fas fa-times"></i>
            </button>
          </div>
          <div class="workflow-dialog-body">
            <div class="workflow-list">
              ${workflows.length > 0 ? workflows.map(wf => `
                <div class="workflow-card" data-workflow-id="${wf.id}">
                  <div class="workflow-card-header">
                    <h4>${wf.name}</h4>
                    <span class="workflow-card-date">${new Date(wf.updated_at).toLocaleDateString()}</span>
                  </div>
                  <p class="workflow-card-description">${wf.description || 'No description'}</p>
                  <div class="workflow-card-meta">
                    <span><i class="fas fa-cube"></i> ${wf.node_count || 0} nodes</span>
                    <span><i class="fas fa-calendar"></i> ${new Date(wf.created_at).toLocaleDateString()}</span>
                  </div>
                  <div class="workflow-card-actions">
                    <button class="btn btn-primary btn-sm" onclick="WorkflowBuilder.loadWorkflowById(${wf.id})">
                      <i class="fas fa-folder-open"></i> Load
                    </button>
                    <button class="btn btn-secondary btn-sm" onclick="WorkflowBuilder.duplicateWorkflow(${wf.id})">
                      <i class="fas fa-copy"></i> Duplicate
                    </button>
                    <button class="btn btn-danger btn-sm" onclick="WorkflowBuilder.deleteWorkflowById(${wf.id})">
                      <i class="fas fa-trash"></i> Delete
                    </button>
                  </div>
                </div>
              `).join('') : '<div class="text-center text-muted p-6">No saved workflows found</div>'}
            </div>
          </div>
        </div>
      `;
      
      document.body.appendChild(dialog);
      
      // Close on overlay click
      dialog.addEventListener('click', (e) => {
        if (e.target === dialog) dialog.remove();
      });
    } catch (error) {
      console.error('[WorkflowBuilder] Error loading workflows:', error);
      Toast.error('Load Failed', 'Failed to load workflows');
    }
  },
  
  /**
   * Load workflow by ID
   */
  async loadWorkflowById(id) {
    try {
      const workflow = await WorkflowManager.loadWorkflow(id);
      if (workflow) {
        WorkflowCanvas.loadWorkflow(workflow);
        this.updateWorkflowName();
        this.updateCanvasInfo();
        this.updateZoomLevel();
        
        // Close dialog
        document.querySelector('.workflow-dialog-overlay')?.remove();
        
        Toast.success('Loaded', `Workflow "${workflow.name}" loaded successfully`);
      }
    } catch (error) {
      console.error('[WorkflowBuilder] Error loading workflow:', error);
      Toast.error('Load Failed', 'Failed to load workflow');
    }
  },
  
  /**
   * Delete workflow by ID
   */
  async deleteWorkflowById(id) {
    if (!confirm('Are you sure you want to delete this workflow?')) return;
    
    try {
      await WorkflowManager.deleteWorkflow(id);
      Toast.success('Deleted', 'Workflow deleted successfully');
      
      // If we deleted current workflow, it already called newWorkflow()
      this.updateWorkflowName();
      this.updateCanvasInfo();
      
      // Refresh dialog if it exists
      const dialog = document.querySelector('.workflow-dialog-overlay');
      if (dialog) {
        dialog.remove();
        this.showLoadDialog();
      }
    } catch (error) {
      console.error('[WorkflowBuilder] Error deleting workflow:', error);
      Toast.error('Delete Failed', 'Failed to delete workflow');
    }
  },
  
  /**
   * Duplicate workflow
   */
  async duplicateWorkflow(id) {
    try {
      const newWf = await WorkflowManager.duplicateWorkflow(id);
      if (newWf) {
        Toast.success('Duplicated', 'Workflow duplicated successfully');
        
        // Close dialog and reload dialog
        document.querySelector('.workflow-dialog-overlay')?.remove();
        this.showLoadDialog();
      }
    } catch (error) {
      console.error('[WorkflowBuilder] Error duplicating workflow:', error);
      Toast.error('Duplicate Failed', 'Failed to duplicate workflow');
    }
  },
  
  /**
   * Run workflow
   */
  async runWorkflow() {
    try {
      // Reset statuses first
      if (typeof WorkflowCanvas !== 'undefined') {
        WorkflowCanvas.resetNodeStatuses();
      }

      // Validate first
      const validation = await this.validateWorkflow(true);
      if (!validation.valid) {
        Toast.error('Validation Failed', 'Please fix validation errors before running');
        return;
      }
      
      // Save workflow if modified or if it's a new unsaved workflow (e.g. from template)
      if (WorkflowManager.isModified || !WorkflowManager.currentWorkflow?.id) {
        await this.saveWorkflow();
      }
      
      if (!WorkflowManager.currentWorkflow?.id) {
        // User probably cancelled the save prompt
        return;
      }
      
      // Set trigger node to running status immediately for visual feedback
      const nodes = WorkflowCanvas.nodes || [];
      const triggerNode = nodes.find(n => n.type === 'manual-trigger' || n.category === 'trigger');
      if (triggerNode) {
        WorkflowCanvas.updateNodeStatus(triggerNode.id, 'running');
      }

      // Execute workflow
      const response = await BackendAPI.post(`/workflows/${WorkflowManager.currentWorkflow.id}/execute`, {});
      
      if (response && !response.error && response.execution_id) {
        Toast.success('Executing', 'Workflow execution started');
        
        // Show execution panel
        this.showExecutionPanel();
        
        // Start monitoring execution
        if (typeof ExecutionMonitor !== 'undefined') {
          ExecutionMonitor.startMonitoring(response.execution_id);
        } else {
          this.monitorExecution(response.execution_id);
        }

        // Update Action Button to Stop
        this.updateActionButton(true);
      } else {
        throw new Error(response?.error || 'Failed to start execution');
      }
    } catch (error) {
      console.error('[WorkflowBuilder] Error running workflow:', error);
      Toast.error('Execution Failed', error.message || 'Failed to execute workflow');
    }
  },
  
  /**
   * Stop workflow execution
   */
  async stopWorkflow() {
    try {
      const executionId = typeof ExecutionMonitor !== 'undefined' ? ExecutionMonitor.currentExecutionId : this.lastExecutionId;
      if (!executionId) return;

      Toast.info('Stopping', 'Sending cancellation request...');
      
      const response = await BackendAPI.post(`/workflows/executions/${executionId}/cancel`, {});
      
      if (response) {
        Toast.success('Stopped', 'Workflow execution cancelled');
        if (typeof ExecutionMonitor !== 'undefined') {
          ExecutionMonitor.stopMonitoring();
        }
        
        // Update Action Button to Run
        this.updateActionButton(false);
      }
    } catch (error) {
      console.error('[WorkflowBuilder] Error stopping workflow:', error);
      Toast.error('Stop Failed', 'Failed to cancel execution');
    }
  },

  /**
   * Check if workflow is currently executing
   */
  isExecuting() {
    if (typeof ExecutionMonitor !== 'undefined') {
      return ExecutionMonitor.isMonitoring;
    }
    return false;
  },

  /**
   * Update the combined Run/Stop button UI
   */
  updateActionButton(isExecuting) {
    const btn = document.getElementById('wfActionBtn');
    if (!btn) return;

    if (isExecuting) {
      btn.innerHTML = '<i class="fas fa-stop"></i> Stop';
      btn.className = 'btn btn-danger btn-sm';
      btn.title = 'Stop Execution';
    } else {
      btn.innerHTML = '<i class="fas fa-play"></i> Run';
      btn.className = 'btn btn-success btn-sm';
      btn.title = 'Run Workflow (Ctrl+R)';
    }
  },
  
  /**
   * Validate workflow
   */
  async validateWorkflow(silent = false) {
    try {
      const definition = WorkflowCanvas.getWorkflowDefinition();
      const validation = await WorkflowValidator.validate(definition);
      
      if (validation.valid) {
        if (!silent) Toast.success('Valid', 'Workflow is valid');
      } else {
        if (!silent) {
          const errorCount = validation.errors.length;
          const warningCount = validation.warnings?.length || 0;
          Toast.warning('Validation Issues', `${errorCount} errors, ${warningCount} warnings`);
        }
      }
      
      return validation;
    } catch (error) {
      console.error('[WorkflowBuilder] Error validating workflow:', error);
      if (!silent) Toast.error('Validation Failed', 'Failed to validate workflow');
      return { valid: false, errors: [] };
    }
  },
  
  /**
   * Export workflow
   */
  exportWorkflow() {
    WorkflowManager.exportToFile();
    Toast.success('Exported', 'Workflow exported successfully');
  },
  
  /**
   * Import workflow
   */
  importWorkflow() {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    
    input.onchange = async (e) => {
      const file = e.target.files[0];
      if (!file) return;
      
      try {
        const workflow = await WorkflowManager.importFromFile(file);
        if (workflow) {
          WorkflowCanvas.loadWorkflow(workflow);
          this.updateWorkflowName();
          this.updateCanvasInfo();
          Toast.success('Imported', 'Workflow imported successfully');
        }
      } catch (error) {
        console.error('[WorkflowBuilder] Error importing workflow:', error);
        Toast.error('Import Failed', 'Failed to import workflow');
      }
    };
    
    input.click();
  },
  
  /**
   * Share workflow
   */
  async shareWorkflow() {
    if (!WorkflowManager.currentWorkflow?.id) {
      Toast.warning('Not Saved', 'Please save the workflow before sharing');
      return;
    }

    try {
      const response = await BackendAPI.post(`/workflows/${WorkflowManager.currentWorkflow.id}/share`, { is_public: true });
      if (response && response.share_link) {
        const link = response.share_link;
        navigator.clipboard.writeText(link).then(() => {
          Toast.success('Shared', 'Public share link copied to clipboard');
        });
      }
    } catch (error) {
      console.error('[WorkflowBuilder] Share error:', error);
      Toast.error('Share Failed', 'Failed to generate share link');
    }
  },
  
  /**
   * Show templates dialog
   */
  async showTemplatesDialog() {
    if (typeof WorkflowTemplates !== 'undefined') {
      WorkflowTemplates.show();
    } else {
      Toast.info('Templates', 'Templates feature coming soon');
    }
  },
  
  /**
   * Toggle debug mode
   */
  toggleDebugMode() {
    this.isDebugMode = !this.isDebugMode;
    const btn = document.getElementById('wfDebugBtn');
    if (btn) {
      btn.classList.toggle('active', this.isDebugMode);
      btn.style.color = this.isDebugMode ? 'var(--warning)' : '';
    }
    
    WorkflowCanvas.debug = this.isDebugMode;
    WorkflowCanvas.render();
    
    Toast.info('Debug Mode', `Debug mode ${this.isDebugMode ? 'enabled' : 'disabled'}`);
  },
  
  /**
   * Monitor execution (legacy fallback)
   */
  async monitorExecution(executionId) {
    this.lastExecutionId = executionId;
    console.log('[WorkflowBuilder] Monitoring execution:', executionId);
  },
  
  /**
   * Toggle execution panel visibility
   */
  toggleExecutionPanel(show) {
    const panel = document.getElementById('wfExecutionPanel');
    if (!panel) return;

    const isHidden = panel.classList.contains('hidden');
    const shouldShow = show !== undefined ? show : isHidden;

    if (shouldShow) {
      panel.classList.remove('hidden');
      document.getElementById('wfLogsBtn')?.classList.add('active');
    } else {
      panel.classList.add('hidden');
      document.getElementById('wfLogsBtn')?.classList.remove('active');
    }
  },

  /**
   * Show execution panel (legacy method name)
   */
  showExecutionPanel() {
    this.toggleExecutionPanel(true);
  },
  
  /**
   * Node selected handler
   */
  onNodeSelected(node) {
    console.log('[WorkflowBuilder] Node selected:', node.id);
  },
  
  /**
   * Node deselected handler
   */
  onNodeDeselected() {
    console.log('[WorkflowBuilder] Node deselected');
  },
  
  /**
   * Mark as modified
   */
  markAsModified() {
    WorkflowManager.markAsModified();
    this.updateWorkflowName();
  },
  
  /**
   * Update workflow name display
   */
  updateWorkflowName() {
    const nameEl = document.getElementById('wfCurrentName');
    if (nameEl && WorkflowManager.currentWorkflow) {
      nameEl.textContent = WorkflowManager.currentWorkflow.name + (WorkflowManager.isModified ? ' *' : '');
    }
  },
  
  /**
   * Update zoom level display
   */
  updateZoomLevel() {
    const zoomEl = document.getElementById('wfZoomLevel');
    if (zoomEl) {
      zoomEl.textContent = `${Math.round(WorkflowCanvas.zoom * 100)}%`;
    }
  },
  
  /**
   * Update canvas info display
   */
  updateCanvasInfo() {
    const nodeCountEl = document.getElementById('canvasNodeCount');
    const connCountEl = document.getElementById('canvasConnectionCount');
    
    if (nodeCountEl) {
      nodeCountEl.textContent = WorkflowCanvas.nodes.length;
    }
    
    if (connCountEl) {
      connCountEl.textContent = WorkflowCanvas.connections.length;
    }
  },
  
  /**
   * Fit to screen
   */
  fitToScreen() {
    WorkflowCanvas.fitToScreen();
    this.updateZoomLevel();
  },
  
  /**
   * Load last workflow
   */
  async loadLastWorkflow() {
    const lastWorkflowId = localStorage.getItem('last_workflow_id');
    
    if (lastWorkflowId) {
      try {
        await this.loadWorkflowById(parseInt(lastWorkflowId));
      } catch (error) {
        console.error('[WorkflowBuilder] Error loading last workflow:', error);
        this.newWorkflow();
      }
    } else {
      this.newWorkflow();
    }
  },
  
  /**
   * Cleanup
   */
  cleanup() {
    if (this.autoSaveInterval) {
      clearInterval(this.autoSaveInterval);
    }
  }
};

// Initialize when page loads workflow builder
if (document.getElementById('page-workflow-builder')) {
  // Wait for Router to navigate to workflow-builder page
  const originalShow = Router.show;
  Router.show = function(page) {
    originalShow.call(this, page);
    
    if (page === 'workflow-builder') {
      // Initialize workflow builder if not already done
      if (!WorkflowBuilder.initialized) {
        setTimeout(() => {
          WorkflowBuilder.init();
        }, 100);
      }
    }
  };
}
