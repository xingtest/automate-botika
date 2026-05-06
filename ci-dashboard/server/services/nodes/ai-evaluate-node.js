const BaseNode = require('./base-node');

class AIEvaluateNode extends BaseNode {
  constructor() {
    super({
      type: 'ai-evaluate',
      category: 'action',
      label: 'AI Evaluate',
      description: 'Evaluate responses using AI',
      icon: 'fa-brain',
      color: '#8b5cf6',
      inputs: [
        { id: 'test_result', name: 'Test Result', dataType: 'object', required: true }
      ],
      outputs: [
        { id: 'evaluation', name: 'Evaluation Result', dataType: 'object', required: true }
      ],
      config_schema: [
        { 
          key: 'ai_provider', 
          label: 'AI Provider', 
          type: 'select', 
          required: true,
          options: [
            { label: 'Gemini', value: 'gemini' },
            { label: 'Groq', value: 'groq' },
            { label: 'Cerebras', value: 'cerebras' },
            { label: 'OpenAI', value: 'openai' },
            { label: 'Custom', value: 'custom' }
          ]
        },
        { key: 'scoring_threshold', label: 'Pass Threshold', type: 'number', required: true, default: 0.7 },
        { key: 'custom_prompt', label: 'Custom Evaluation Prompt', type: 'text', required: false }
      ]
    });
  }
  
  async execute(context, config, node) {
    const input = this.getInput(context, 'test_result');
    
    if (!input) {
      throw new Error('No test result input provided');
    }
    
    // This is a placeholder implementation
    // In production, this would integrate with src/utils/ai-evaluator.ts
    
    this.log('info', `Evaluating with AI provider: ${config.ai_provider}`);
    
    const evaluations = [];
    const results = input.results || [];
    
    for (const result of results) {
      evaluations.push({
        ...result,
        ai_score: 0.85, // Placeholder score
        ai_explanation: 'Placeholder evaluation - integrate with actual AI evaluator',
        ai_passed: 0.85 >= config.scoring_threshold,
        ai_provider: config.ai_provider
      });
    }
    
    const avgScore = evaluations.length > 0 
      ? evaluations.reduce((sum, e) => sum + e.ai_score, 0) / evaluations.length 
      : 0;
    const passCount = evaluations.filter(e => e.ai_passed).length;
    
    return {
      run_id: input.run_id,
      evaluations: evaluations,
      avg_ai_score: avgScore,
      pass_count: passCount,
      fail_count: evaluations.length - passCount,
      threshold: config.scoring_threshold,
      provider: config.ai_provider
    };
  }
}

module.exports = AIEvaluateNode;
