const BaseNode = require('./base-node');
const { pool: db } = require('../../db');

class RunTestNode extends BaseNode {
  constructor() {
    super({
      type: 'run-test',
      category: 'action',
      label: 'Run Test',
      description: 'Execute tests on specified platform',
      icon: 'fa-play-circle',
      color: '#8b5cf6',
      inputs: [
        { id: 'trigger', name: 'Trigger', dataType: 'any', required: false }
      ],
      outputs: [
        { id: 'result', name: 'Test Result', dataType: 'object', required: true },
        { id: 'error', name: 'Error', dataType: 'object', required: false }
      ],
      config_schema: [
        { 
          key: 'platform', 
          label: 'Platform', 
          type: 'select', 
          required: true,
          options: [
            { label: 'WebChat', value: 'webchat' },
            { label: 'Telegram', value: 'telegram' },
            { label: 'Instagram', value: 'instagram' },
            { label: 'Facebook', value: 'facebook' },
            { label: 'DHAI', value: 'dhai' }
          ]
        },
        { key: 'test_data_file', label: 'Test Data File', type: 'file', required: true },
        { key: 'tester_name', label: 'Tester Name', type: 'text', required: true, default: 'Workflow Bot' },
        { key: 'greeting', label: 'Greeting Message', type: 'text', required: false, default: 'Haloo' },
        { key: 'platform_url', label: 'Platform URL', type: 'text', required: true }
      ]
    });
  }
  
  async execute(context, config, node) {
    try {
      // This is a placeholder implementation
      // In production, this would integrate with the actual platform executors from src/platforms/*.ts
      
      this.log('info', `Running test on platform: ${config.platform}`);
      
      // Simulate test execution
      const testId = `test_${Date.now()}`;
      const runId = await this.createTestRun(context, config, testId);
      
      // Return test results with mock data
      const mockResults = [
        { no: 1, title: 'Greeting', question: 'Haloo', response: 'Halo! Ada yang bisa saya bantu?', status: 'success', duration: '2.1s' },
        { no: 2, title: 'FAQ Produk', question: 'Apa saja produk kalian?', response: 'Kami menyediakan berbagai produk digital...', status: 'success', duration: '3.4s' },
        { no: 3, title: 'Harga', question: 'Berapa harganya?', response: 'Harga mulai dari Rp 50.000...', status: 'success', duration: '2.8s' }
      ];
      
      return {
        test_id: testId,
        run_id: runId,
        platform: config.platform,
        status: 'completed',
        total_questions: mockResults.length,
        success_count: mockResults.filter(r => r.status === 'success').length,
        failed_count: mockResults.filter(r => r.status === 'failed').length,
        avg_score: 0.85,
        duration: '8.3s',
        results: mockResults,
        message: `Test completed on ${config.platform}`
      };
      
    } catch (error) {
      this.log('error', 'Test execution failed', { error: error.message });
      throw error;
    }
  }
  
  async createTestRun(context, config, testId) {
    const result = await db.queryOriginal(
      `INSERT INTO test_runs (user_id, test_id, platform, tester_name, filename, url, run_title)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING id`,
      [
        context.user_id,
        testId,
        config.platform,
        config.tester_name,
        config.test_data_file,
        config.platform_url,
        `Workflow Test - ${config.platform}`
      ]
    );
    
    return result.rows[0].id;
  }
}

module.exports = RunTestNode;
