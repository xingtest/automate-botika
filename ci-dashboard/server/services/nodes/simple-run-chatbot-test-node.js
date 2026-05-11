const BaseNode = require('./base-node');
const PlaywrightWebchatNode = require('./playwright-webchat-node');
const { getItems, normalizeItem, normalizeText, withResults } = require('./llm-judge-utils');

class SimpleRunChatbotTestNode extends BaseNode {
  constructor() {
    super({
      type: 'simple-run-chatbot-test',
      category: 'simple',
      label: 'Run Chatbot Test',
      description: 'Run live webchat tests or use prepared sample responses, then check capture quality',
      icon: 'fa-robot',
      color: '#2563eb',
      inputs: [{ id: 'main', name: 'Prepared Test Data', dataType: 'object', required: true }],
      outputs: [{ id: 'main', name: 'Chatbot Test Results', dataType: 'object', required: true }],
      config_schema: [
        { key: 'mode', label: 'Mode', type: 'select', required: false, default: 'prepared', options: [
          { label: 'Use Prepared Responses', value: 'prepared' },
          { label: 'Live Webchat', value: 'live_webchat' }
        ] },
        { key: 'platform_url', label: 'Webchat URL', type: 'text', required: false, default: 'https://chat.botika.online/tpUyiey' },
        { key: 'headless', label: 'Headless', type: 'boolean', required: false, default: true },
        { key: 'min_length', label: 'Minimum Response Length', type: 'number', required: false, default: 8 }
      ]
    });
  }

  async execute(context, config, node) {
    const input = this.getInput(context, 'main') || {};
    let output = input;

    if (config.mode === 'live_webchat') {
      const runner = new PlaywrightWebchatNode();
      output = await runner.execute(context, {
        platform_url: config.platform_url,
        headless: config.headless !== false,
        greeting: config.greeting || '',
        tester_name: config.tester_name || 'QA AI Judge',
        tester_email: config.tester_email || 'qa@example.com',
        tester_phone: config.tester_phone || '6281234567890'
      }, node);
    }

    const minLength = Number(config.min_length || 8);
    const results = getItems(output).map((item, index) => {
      const normalized = normalizeItem(item, index);
      const actual = normalizeText(normalized.response_llm || normalized.actual);
      const issues = [];
      if (!actual || /no response captured|error capturing response/i.test(actual)) issues.push('no_response');
      if (actual.length > 0 && actual.length < minLength) issues.push('too_short');
      if (actual && normalized.question && actual.toLowerCase() === normalized.question.toLowerCase()) issues.push('echoed_question');
      return {
        ...normalized,
        response_llm: actual,
        actual,
        capture_quality: {
          valid: issues.length === 0,
          score: issues.length === 0 ? 1 : Math.max(0, 1 - issues.length * 0.25),
          issues
        },
        retry_recovery: {
          retryable: issues.some(issue => ['no_response', 'too_short'].includes(issue)),
          recommended_action: issues.length ? 'retry_capture_then_refresh_session' : 'no_retry_needed'
        }
      };
    });

    return withResults(output, results, {
      run_summary: {
        mode: config.mode || 'prepared',
        total: results.length,
        capture_invalid: results.filter(row => !row.capture_quality.valid).length
      }
    });
  }
}

module.exports = SimpleRunChatbotTestNode;
