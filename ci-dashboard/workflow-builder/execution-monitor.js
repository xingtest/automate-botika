/**
 * Execution Monitor Component
 * Handles real-time monitoring of workflow execution, logs, and status updates
 */

const ExecutionMonitor = {
  currentExecutionId: null,
  pollingInterval: null,
  logsInterval: null,
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
    
    // Start polling — status every 2s, logs every 1s for real-time feel
    this.stopPolling();
    this.pollingInterval = setInterval(() => this.pollStatus(), 2000);
    this.logsInterval = setInterval(() => this.pollLogs(), 1000);
    
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
    if (this.logsInterval) {
      clearInterval(this.logsInterval);
      this.logsInterval = null;
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
          await this.pollLogs();
          
          if (execution.status === 'completed') {
            Toast.success('Workflow Completed', 'The workflow finished successfully');
          } else if (execution.status === 'failed') {
            Toast.error('Workflow Failed', execution.error_message || 'The workflow encountered an error');
          }

          // Update Action Button to Run
          if (typeof WorkflowBuilder !== 'undefined') {
            WorkflowBuilder.updateActionButton(false);
          }
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
      WorkflowCanvas.updateNodeStatus(nodeId, result.status, {
        duration_ms: result.duration_ms,
        output: result.output,
        error: result.error_message
      });
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
    logContainer.innerHTML = logs.map(log => {
      const time = new Date(log.created_at).toLocaleTimeString();
      const nodeId = log.node_id || 'system';
      
      if (log.type === 'technical') {
        return `
          <div class="log-entry log-technical log-${log.level || 'info'}">
            <span class="log-time">[${time}]</span>
            <span class="log-node">[DEBUG]</span>
            <span class="log-message">${BackendAPI.esc(log.message)}</span>
          </div>
        `;
      } else {
        const status = log.status || 'info';
        const msg = log.error_message || (status === 'success' ? 'Executed successfully' : (status === 'running' ? 'Started execution' : status));
        return `
          <div class="log-entry log-${status}">
            <span class="log-time">[${time}]</span>
            <span class="log-node">Node: ${nodeId} (${log.node_type || 'node'})</span>
            <span class="log-message">${BackendAPI.esc(msg)}</span>
            ${log.duration_ms ? `<span class="log-duration">${log.duration_ms}ms</span>` : ''}
          </div>
        `;
      }
    }).join('');
    
    // Auto-scroll to bottom
    logContainer.scrollTop = logContainer.scrollHeight;
  }
};
