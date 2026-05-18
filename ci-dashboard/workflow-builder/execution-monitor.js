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
    this.updateFullBodyMascot('idle');
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
      statusEl.innerHTML = `${this.getMascotSvg(status)} <span>${status.toUpperCase()}</span>`;
      statusEl.className = `execution-status status-${status}`;
    }
    this.updateFullBodyMascot(status);
  },
  
  /**
   * Update full-body pixel mascot playground
   */
  updateFullBodyMascot(status) {
    const mascotZone = document.getElementById('wfExecutionMascotZone');
    if (!mascotZone) return;
    
    let mascotHtml = '';
    
    if (status === 'running') {
      // Walking / Running Robot
      mascotHtml = `
        <svg viewBox="0 0 32 32" class="full-mascot mascot-walk-anim" shape-rendering="crispEdges">
          <!-- Ears/Antenna -->
          <rect x="14" y="2" width="4" height="4" fill="#5a67d8" stroke="#1a1a2e" stroke-width="1.5" />
          <rect x="15" y="0" width="2" height="2" fill="#e53e3e" />
          <!-- Head/Body -->
          <rect x="8" y="6" width="16" height="14" fill="#5a67d8" stroke="#1a1a2e" stroke-width="1.5" />
          <!-- Eyes -->
          <rect x="11" y="9" width="3" height="3" fill="#ffffff" />
          <rect x="18" y="9" width="3" height="3" fill="#ffffff" />
          <rect x="12" y="10" width="1" height="1" fill="#1a1a2e" />
          <rect x="19" y="10" width="1" height="1" fill="#1a1a2e" />
          <!-- Mouth -->
          <rect x="14" y="14" width="4" height="2" fill="#faf7f4" />
          <!-- Chest Plate -->
          <rect x="10" y="20" width="12" height="8" fill="#e8a317" stroke="#1a1a2e" stroke-width="1.5" />
          <rect x="13" y="22" width="6" height="4" fill="#5a67d8" />
          <!-- Arms -->
          <path d="M5 21h3v4H5zm24 0h-3v4h3z" fill="#5a67d8" stroke="#1a1a2e" stroke-width="1" />
          <!-- Legs -->
          <path d="M10 28h3v4h-3zm9 0h3v4h-3z" fill="#1a1a2e" />
        </svg>
      `;
    } else if (status === 'completed' || status === 'success') {
      // Happy Dancing Robot
      mascotHtml = `
        <svg viewBox="0 0 32 32" class="full-mascot mascot-dance-anim" shape-rendering="crispEdges">
          <!-- Ears/Antenna -->
          <rect x="14" y="2" width="4" height="4" fill="#2cb67d" stroke="#1a1a2e" stroke-width="1.5" />
          <rect x="15" y="0" width="2" height="2" fill="#e8a317" />
          <!-- Head/Body -->
          <rect x="8" y="6" width="16" height="14" fill="#2cb67d" stroke="#1a1a2e" stroke-width="1.5" />
          <!-- Smiling Eyes -->
          <path d="M10 9l2-1 2 1M18 9l2-1 2 1" stroke="#1a1a2e" stroke-width="1.5" fill="none" />
          <!-- Rosy Cheeks -->
          <rect x="9" y="11" width="2" height="1" fill="#e53e3e" />
          <rect x="21" y="11" width="2" height="1" fill="#e53e3e" />
          <!-- Smile -->
          <path d="M12 12h8v2h-8z" fill="#1a1a2e" />
          <!-- Chest Plate -->
          <rect x="10" y="20" width="12" height="8" fill="#e8a317" stroke="#1a1a2e" stroke-width="1.5" />
          <!-- Arms Raised Celebrating -->
          <path d="M4 14h3v6H4zm21 0h3v6h-3z" fill="#2cb67d" stroke="#1a1a2e" stroke-width="1" />
          <!-- Legs -->
          <path d="M10 28h3v4h-3zm9 0h3v4h-3z" fill="#1a1a2e" />
        </svg>
      `;
    } else if (status === 'failed') {
      // Crying / Collapsed Robot
      mascotHtml = `
        <svg viewBox="0 0 32 32" class="full-mascot mascot-cry-anim" shape-rendering="crispEdges">
          <!-- Head slumped -->
          <rect x="8" y="8" width="16" height="14" fill="#e53e3e" stroke="#1a1a2e" stroke-width="1.5" />
          <!-- Sad Dead Eyes (X X) -->
          <path d="M11 11l2 2m0-2l-2 2M19 11l2 2m0-2l-2 2" stroke="#1a1a2e" stroke-width="1.5" />
          <!-- Tears flowing -->
          <rect x="10" y="14" width="2" height="6" fill="#3182ce" />
          <rect x="20" y="14" width="2" height="6" fill="#3182ce" />
          <!-- Sad Mouth -->
          <path d="M14 19h4v-1h-4z" fill="#1a1a2e" />
          <!-- Chest Plate -->
          <rect x="10" y="22" width="12" height="6" fill="#4a4a68" stroke="#1a1a2e" stroke-width="1.5" />
          <!-- Broken Slumped Arms -->
          <path d="M5 23h3v4H5zm24 0h-3v4h3z" fill="#e53e3e" stroke="#1a1a2e" stroke-width="1" />
          <!-- Legs collapsed -->
          <path d="M9 28h5v2H9zm9 0h5v2h-5z" fill="#1a1a2e" />
        </svg>
      `;
    } else {
      // Idle / Sleep Robot (status idle, pending, cancelled)
      mascotHtml = `
        <svg viewBox="0 0 32 32" class="full-mascot mascot-idle-anim" shape-rendering="crispEdges">
          <!-- Head/Body -->
          <rect x="8" y="6" width="16" height="14" fill="#8e8ea0" stroke="#1a1a2e" stroke-width="1.5" />
          <!-- Closed Eyes -->
          <path d="M11 11h3M18 11h3" stroke="#1a1a2e" stroke-width="1.5" />
          <!-- Mouth -->
          <rect x="14" y="14" width="4" height="1" fill="#1a1a2e" />
          <!-- Chest Plate -->
          <rect x="10" y="20" width="12" height="8" fill="#4a4a68" stroke="#1a1a2e" stroke-width="1.5" />
          <!-- Legs standing -->
          <path d="M11 28h2v4h-2zm8 0h2v4h-2z" fill="#1a1a2e" />
          <!-- Floating Zzz -->
          <path d="M24 2h3v1h-2v1h2v1h-3zm2-2h2v1h-2z" fill="#8e8ea0" class="mascot-zzz" />
        </svg>
      `;
    }
    
    mascotZone.innerHTML = mascotHtml;
  },
  
  /**
   * Get SVG Pixel Mascot based on status
   */
  getMascotSvg(status) {
    const mascots = {
      success: `<svg viewBox="0 0 16 16" class="pixel-mascot" shape-rendering="crispEdges"><path d="M6 1h4v1h2v2h2v2h2v4h-2v2h-2v2h-2v1H6v-1H4v-2H2v-2H0V6h2V4h2V2h2V1z" fill="#2cb67d" stroke="#1a1a2e" stroke-width="1"/><rect x="4" y="5" width="2" height="2" fill="#1a1a2e"/><rect x="10" y="5" width="2" height="2" fill="#1a1a2e"/><path d="M5 9h6v1H5z" fill="#1a1a2e"/></svg>`,
      failed: `<svg viewBox="0 0 16 16" class="pixel-mascot" shape-rendering="crispEdges"><path d="M4 1h8v1h2v10h-2v1H2v-1H0V2h2V1z" fill="#e53e3e" stroke="#1a1a2e" stroke-width="1"/><rect x="3" y="4" width="2" height="2" fill="#1a1a2e"/><rect x="11" y="4" width="2" height="2" fill="#1a1a2e"/><rect x="3" y="7" width="1" height="2" fill="#3182ce"/><rect x="12" y="7" width="1" height="2" fill="#3182ce"/><path d="M6 9h4v1H6z" fill="#1a1a2e"/></svg>`,
      running: `<svg viewBox="0 0 16 16" class="pixel-mascot mascot-spin" shape-rendering="crispEdges"><path d="M3 3h10v10H3z" fill="#5a67d8" stroke="#1a1a2e" stroke-width="1"/><path d="M6 0h4v3H6zm0 13h4v3H6zM0 6h3v4H0zm13 0h3v4H13z" fill="#5a67d8"/><rect x="5" y="6" width="2" height="2" fill="#ffffff"/><rect x="9" y="6" width="2" height="2" fill="#ffffff"/><path d="M6 10h4v1H6z" fill="#ffffff"/></svg>`,
      info: `<svg viewBox="0 0 16 16" class="pixel-mascot" shape-rendering="crispEdges"><path d="M4 1h8v1h2v6H12v2h2v4h-2v1H4v-1H2v-4h2V8H2V2h2V1z" fill="#e8a317" stroke="#1a1a2e" stroke-width="1"/><rect x="4" y="4" width="2" height="2" fill="#1a1a2e"/><rect x="10" y="4" width="2" height="2" fill="#1a1a2e"/><rect x="3" y="7" width="1" height="1" fill="#e53e3e"/><rect x="12" y="7" width="1" height="1" fill="#e53e3e"/><path d="M6 8h4v1H6z" fill="#1a1a2e"/></svg>`,
      pending: `<svg viewBox="0 0 16 16" class="pixel-mascot" shape-rendering="crispEdges"><path d="M4 1h8v1h2v6H12v2h2v4h-2v1H4v-1H2v-4h2V8H2V2h2V1z" fill="#8e8ea0" stroke="#1a1a2e" stroke-width="1"/><rect x="4" y="4" width="2" height="2" fill="#1a1a2e"/><rect x="10" y="4" width="2" height="2" fill="#1a1a2e"/><path d="M6 8h4v1H6z" fill="#1a1a2e"/></svg>`
    };
    return mascots[status] || mascots.info;
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
    
    logContainer.innerHTML = logs.map(log => {
      const time = new Date(log.created_at).toLocaleTimeString();
      const nodeId = log.node_id || 'system';
      
      if (log.type === 'technical') {
        const technicalLevel = log.level || 'info';
        return `
          <div class="log-entry log-technical log-${technicalLevel}">
            ${this.getMascotSvg(technicalLevel)}
            <span class="log-time">[${time}]</span>
            <span class="log-node">DEBUG</span>
            <span class="log-message">${BackendAPI.esc(log.message)}</span>
          </div>
        `;
      } else {
        const status = log.status || 'info';
        const msg = log.error_message || (status === 'success' ? 'Executed successfully' : (status === 'running' ? 'Started execution' : status));
        return `
          <div class="log-entry log-${status}">
            ${this.getMascotSvg(status)}
            <span class="log-time">[${time}]</span>
            <span class="log-node">${nodeId}</span>
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

