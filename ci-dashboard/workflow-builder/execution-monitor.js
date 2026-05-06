/**
 * Execution Monitor Component
 * Handles real-time monitoring of workflow execution, logs, and status updates
 */

const ExecutionMonitor = {
  currentExecutionId: null,
  pollingInterval: null,
  isMonitoring: false,
  logs: [],
  
  /**
   * Initialize execution monitor
   */
  init() {
    console.log('[ExecutionMonitor] Initializing...');
  },
  
  /**
   * Start monitoring a workflow execution
   */
  startMonitoring(executionId) {
    this.currentExecutionId = executionId;
    this.isMonitoring = true;
    this.logs = [];
    
    // Clear logs UI
    const logContainer = document.getElementById('wfExecutionLogs');
    if (logContainer) logContainer.innerHTML = '';
    
    // Update status UI
    this.updateStatusUI('running');
    
    // Start polling
    this.stopPolling();
    this.pollingInterval = setInterval(() => this.pollStatus(), 2000);
    
    // Initial poll
    this.pollStatus();
    this.pollLogs();
  },
  
  /**
   * Stop monitoring
   */
  stopMonitoring() {
    this.isMonitoring = false;
    this.stopPolling();
    this.currentExecutionId = null;
  },
  
  /**
   * Stop polling
   */
  stopPolling() {
    if (this.pollingInterval) {
      clearInterval(this.pollingInterval);
      this.pollingInterval = null;
    }
  },
  
  /**
   * Poll execution status
   */
  async pollStatus() {
    if (!this.currentExecutionId) return;
    
    try {
      const response = await BackendAPI.get(`/workflows/executions/${this.currentExecutionId}`);
      if (response) {
        const execution = response.data || response;
        
        // Update status UI
        this.updateStatusUI(execution.status);
        
        // Update node statuses on canvas
        this.updateNodeStatuses(execution.node_results);
        
        // Check if finished
        if (['completed', 'failed', 'cancelled'].includes(execution.status)) {
          this.stopPolling();
          this.isMonitoring = false;
          
          // Final log poll
          this.pollLogs();
          
          if (execution.status === 'completed') {
            Toast.success('Workflow Completed', 'The workflow finished successfully');
          } else if (execution.status === 'failed') {
            Toast.error('Workflow Failed', execution.error_message || 'The workflow encountered an error');
          }

          // Disable stop button
          const stopBtn = document.getElementById('wfStopBtn');
          if (stopBtn) stopBtn.disabled = true;
        }
      }
    } catch (error) {
      console.error('[ExecutionMonitor] Status poll error:', error);
    }
  },
  
  /**
   * Poll execution logs
   */
  async pollLogs() {
    if (!this.currentExecutionId) return;
    
    try {
      const response = await BackendAPI.get(`/workflows/executions/${this.currentExecutionId}/logs`);
      if (response) {
        const newLogs = response.data || response;
        this.renderLogs(newLogs);
      }
    } catch (error) {
      console.error('[ExecutionMonitor] Logs poll error:', error);
    }
  },
  
  /**
   * Update status UI
   */
  updateStatusUI(status) {
    const statusEl = document.getElementById('wfExecutionStatus');
    if (statusEl) {
      statusEl.textContent = status.charAt(0).toUpperCase() + status.slice(1);
      statusEl.className = `execution-status status-${status}`;
    }
  },
  
  /**
   * Update node statuses on canvas
   */
  updateNodeStatuses(nodeResults) {
    if (!nodeResults) return;
    
    Object.keys(nodeResults).forEach(nodeId => {
      const result = nodeResults[nodeId];
      WorkflowCanvas.updateNodeStatus(nodeId, result.status || 'success');
    });
  },
  
  /**
   * Render logs to the panel
   */
  renderLogs(logs) {
    const logContainer = document.getElementById('wfExecutionLogs');
    if (!logContainer) return;
    
    // Simple diff to avoid re-rendering everything if possible
    // But for now, just clear and re-render the list
    logContainer.innerHTML = logs.map(log => `
      <div class="log-entry log-${log.status}">
        <span class="log-time">[${new Date(log.created_at).toLocaleTimeString()}]</span>
        <span class="log-node">Node: ${log.node_id} (${log.node_type})</span>
        <span class="log-message">${log.error_message || 'Executed successfully'}</span>
        ${log.duration_ms ? `<span class="log-duration">${log.duration_ms}ms</span>` : ''}
      </div>
    `).join('');
    
    // Auto-scroll to bottom
    logContainer.scrollTop = logContainer.scrollHeight;
  }
};
