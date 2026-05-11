/**
 * Workflow Manager Component
 * Handles CRUD operations, state management, and persistence for workflows
 */

const WorkflowManager = {
  currentWorkflow: null,
  isModified: false,
  
  /**
   * Create a new empty workflow
   */
  newWorkflow() {
    this.currentWorkflow = {
      id: null,
      name: 'Untitled Workflow',
      description: '',
      definition: {
        nodes: [],
        connections: []
      }
    };
    this.isModified = false;
    return this.currentWorkflow;
  },
  
  /**
   * Save current workflow to backend
   */
  async saveWorkflow(isAutoSave = false) {
    if (!this.currentWorkflow) return null;
    
    try {
      const definition = WorkflowCanvas.getWorkflowDefinition();
      
      // Prepare data
      const workflowData = {
        name: this.currentWorkflow.name,
        description: this.currentWorkflow.description || '',
        definition: definition,
        canvas_state: {
          zoom: WorkflowCanvas.zoom,
          panX: WorkflowCanvas.panX,
          panY: WorkflowCanvas.panY
        }
      };
      
      let response;
      if (this.currentWorkflow.id) {
        response = await BackendAPI.put(`/workflows/${this.currentWorkflow.id}`, workflowData);
      } else {
        response = await BackendAPI.post('/workflows', workflowData);
      }
      
      // BackendAPI returns JSON directly, not wrapped in .data
      // On error it returns { success: false, error: msg }
      if (!response || response.success === false) {
        throw new Error(response?.error || 'Failed to save workflow');
      }
      
      // Merge server response (id, version, etc.) into currentWorkflow
      this.currentWorkflow.id = response.id || this.currentWorkflow.id;
      this.currentWorkflow.version = response.version || this.currentWorkflow.version;
      this.currentWorkflow.name = response.name || this.currentWorkflow.name;
      this.isModified = false;
      
      // Save ID to local storage so it persists on reload
      if (this.currentWorkflow.id) {
        localStorage.setItem('last_workflow_id', this.currentWorkflow.id);
      }
      
      return this.currentWorkflow;
    } catch (error) {
      console.error('[WorkflowManager] Save error:', error);
      throw error;
    }
  },
  
  /**
   * Load workflow by ID
   */
  async loadWorkflow(id) {
    try {
      const response = await BackendAPI.get(`/workflows/${id}`);
      
      if (!response || response.success === false) {
        throw new Error(response?.error || 'Workflow not found');
      }
      
      this.currentWorkflow = response;
      this.isModified = false;
      localStorage.setItem('last_workflow_id', id);
      return this.currentWorkflow;
    } catch (error) {
      console.error('[WorkflowManager] Load error:', error);
      throw error;
    }
  },
  
  /**
   * Delete workflow
   */
  async deleteWorkflow(id) {
    try {
      await BackendAPI.del(`/workflows/${id}`);
      if (this.currentWorkflow?.id === id) {
        this.newWorkflow();
      }
      return true;
    } catch (error) {
      console.error('[WorkflowManager] Delete error:', error);
      throw error;
    }
  },
  
  /**
   * Duplicate workflow
   */
  async duplicateWorkflow(id) {
    try {
      const response = await BackendAPI.post(`/workflows/${id}/duplicate`);
      return response?.data;
    } catch (error) {
      console.error('[WorkflowManager] Duplicate error:', error);
      throw error;
    }
  },
  
  /**
   * Export workflow as JSON file
   */
  exportToFile() {
    if (!this.currentWorkflow) return;
    
    const definition = WorkflowCanvas.getWorkflowDefinition();
    const data = {
      name: this.currentWorkflow.name,
      description: this.currentWorkflow.description,
      definition: definition,
      exported_at: new Date().toISOString()
    };
    
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${this.currentWorkflow.name.replace(/\s+/g, '-').toLowerCase()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  },
  
  /**
   * Import workflow from JSON file
   */
  async importFromFile(file) {
    try {
      const text = await file.text();
      const data = JSON.parse(text);
      
      this.currentWorkflow = {
        id: null,
        name: data.name || 'Imported Workflow',
        description: data.description || '',
        definition: data.definition
      };
      this.isModified = true;
      return this.currentWorkflow;
    } catch (error) {
      console.error('[WorkflowManager] Import error:', error);
      throw error;
    }
  },
  
  /**
   * Mark current workflow as modified
   */
  markAsModified() {
    this.isModified = true;
  }
};
