const BaseNode = require('./base-node');
const { getItems, normalizeItem, withResults } = require('./llm-judge-utils');

class RetryRecoveryNode extends BaseNode {
  constructor() {
    super({
      type: 'retry-recovery',
      category: 'quality',
      label: 'Retry Recovery Planner',
      description: 'Mark retryable failures and recommend recovery actions for automation issues',
      icon: 'fa-rotate-right',
      color: '#0369a1',
      inputs: [{ id: 'main', name: 'Checked Results', dataType: 'object', required: true }],
      outputs: [{ id: 'main', name: 'Retry Plan', dataType: 'object', required: true }],
      config_schema: [
        { key: 'max_retries', label: 'Max Retries', type: 'number', required: false, default: 2 }
      ]
    });
  }

  async execute(context, config) {
    const input = this.getInput(context, 'main') || {};
    const maxRetries = Number(config.max_retries ?? 2);
    const results = getItems(input).map((item, index) => {
      const normalized = normalizeItem(item, index);
      const captureIssues = normalized.capture_quality?.issues || [];
      const retryable = captureIssues.some(issue => ['no_response', 'still_loading', 'too_short'].includes(issue));
      return {
        ...normalized,
        retry_recovery: {
          retryable,
          max_retries: maxRetries,
          recommended_action: retryable ? 'retry_capture_then_refresh_session' : 'no_retry_needed'
        }
      };
    });
    return withResults(input, results, {
      retry_summary: {
        retryable: results.filter(item => item.retry_recovery.retryable).length,
        max_retries: maxRetries
      }
    });
  }
}

module.exports = RetryRecoveryNode;
