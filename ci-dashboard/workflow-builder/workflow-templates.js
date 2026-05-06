/**
 * Workflow Templates Component
 * Handles template browsing, selection, and instantiation
 */

const WorkflowTemplates = {
  templates: [],
  
  /**
   * Show templates dialog
   */
  async show() {
    try {
      Toast.info('Templates', 'Loading templates...');
      
      const response = await BackendAPI.get('/workflows/templates');
      // Handle both { data: [] } and direct [] response
      this.templates = response?.data || (Array.isArray(response) ? response : []);
      
      if (this.templates.length === 0) {
        Toast.warning('No Templates', 'No workflow templates found');
      }
      
      this.renderDialog();
    } catch (error) {
      console.error('[WorkflowTemplates] Load error:', error);
      Toast.error('Error', 'Failed to load templates');
    }
  },
  
  /**
   * Render templates dialog
   */
  renderDialog() {
    const dialog = document.createElement('div');
    dialog.className = 'workflow-dialog-overlay';
    dialog.innerHTML = `
      <div class="workflow-dialog workflow-templates-dialog">
        <div class="workflow-dialog-header">
          <h3><i class="fas fa-layer-group"></i> Workflow Templates</h3>
          <button class="btn-close" onclick="this.closest('.workflow-dialog-overlay').remove()">
            <i class="fas fa-times"></i>
          </button>
        </div>
        <div class="workflow-dialog-body">
          <div class="template-categories">
            <button class="category-btn active">All Templates</button>
            <button class="category-btn">Automation</button>
            <button class="category-btn">AI Evaluation</button>
            <button class="category-btn">Reporting</button>
          </div>
          <div class="template-grid" id="templateGrid">
            ${this.templates.length > 0 ? this.templates.map(tpl => `
              <div class="template-card" data-template-id="${tpl.id}">
                <div class="template-thumbnail">
                  ${tpl.thumbnail_path ? `<img src="${tpl.thumbnail_path}" alt="${tpl.name}">` : '<i class="fas fa-project-diagram"></i>'}
                </div>
                <div class="template-info">
                  <h4>${tpl.name}</h4>
                  <p>${tpl.description || 'No description available'}</p>
                  <div class="template-meta">
                    <span><i class="fas fa-cube"></i> ${tpl.node_count || 0} nodes</span>
                  </div>
                </div>
                <div class="template-actions">
                  <button class="btn btn-primary btn-sm btn-block">Use This Template</button>
                </div>
              </div>
            `).join('') : '<div class="text-center text-muted p-10 w-full">No templates available yet</div>'}
          </div>
        </div>
      </div>
    `;
    
    document.body.appendChild(dialog);
    
    // Add click listeners to cards
    dialog.querySelectorAll('.template-card').forEach(card => {
      card.addEventListener('click', () => {
        const id = card.dataset.templateId;
        if (id) this.useTemplate(id);
      });
    });
    
    // Close on overlay click
    dialog.addEventListener('click', (e) => {
      if (e.target === dialog) dialog.remove();
    });
  },
  
  /**
   * Use a template to create a new workflow
   */
  async useTemplate(templateId) {
    if (WorkflowManager.isModified) {
      if (!confirm('You have unsaved changes. Discard and use template?')) return;
    }
    
    try {
      const response = await BackendAPI.get(`/workflows/templates/${templateId}`);
      if (response) {
        const template = response.data || response;
        
        // Create new workflow from template definition
        WorkflowManager.currentWorkflow = {
          id: null,
          name: `${template.name} (from Template)`,
          description: template.description,
          definition: template.definition
        };
        WorkflowManager.isModified = true;
        
        // Load onto canvas
        WorkflowCanvas.loadWorkflow(WorkflowManager.currentWorkflow);
        WorkflowBuilder.updateWorkflowName();
        WorkflowBuilder.updateCanvasInfo();
        WorkflowCanvas.fitToScreen();
        
        // Close dialog
        document.querySelector('.workflow-dialog-overlay')?.remove();
        
        Toast.success('Template Applied', `New workflow created from "${template.name}"`);
      }
    } catch (error) {
      console.error('[WorkflowTemplates] Use error:', error);
      Toast.error('Error', 'Failed to apply template');
    }
  }
};
