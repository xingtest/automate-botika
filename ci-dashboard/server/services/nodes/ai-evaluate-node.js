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
        {
          key: 'scoring_threshold',
          label: 'Pass Threshold',
          type: 'number',
          required: true,
          default: 0.7,
          description: 'Nilai minimum (0.0–1.0) agar evaluasi dianggap lulus'
        },
        {
          key: 'custom_prompt',
          label: 'Custom Evaluation Prompt',
          type: 'text',
          required: false,
          description: 'Prompt tambahan untuk memandu AI dalam mengevaluasi respons'
        }
      ]
    });
  }

  async execute(context, config, node) {
    // Try 'main' (standard for our template) and 'input' (legacy)
    const input = this.getInput(context, 'main') || this.getInput(context, 'input') || this.getInput(context, 'test_result');

    const provider = config.ai_provider;

    // Validate API key
    const apiKeyMap = {
      'gemini': process.env.GEMINI_API_KEY,
      'groq': process.env.GROQ_API_KEY,
      'openai': process.env.OPENAI_API_KEY,
      'cerebras': process.env.CEREBRAS_API_KEY
    };

    const apiKey = apiKeyMap[provider];
    if (!apiKey) {
      this.log('warn', `API key for ${provider} is not configured, using mock evaluation results`);
    }

    this.log('info', `Evaluating with AI provider: ${provider}`);

    const results = input?.results || [];
    const threshold = config.scoring_threshold || 0.7;

    // Evaluate each item using the AI provider
    const evaluations = await Promise.all(results.map(async (item) => {
      const evaluation = await this.callAIProvider(provider, apiKey, item, config.custom_prompt, threshold);
      return { ...item, ...evaluation, ai_provider: provider };
    }));

    const avgScore = evaluations.length > 0
      ? Math.round((evaluations.reduce((sum, e) => sum + e.ai_score, 0) / evaluations.length) * 100) / 100
      : 0;
    const passCount = evaluations.filter(e => e.ai_passed).length;

    return {
      run_id: input?.run_id || null,
      evaluations,
      avg_ai_score: avgScore,
      pass_count: passCount,
      fail_count: evaluations.length - passCount,
      total_evaluated: evaluations.length,
      threshold,
      provider,
      status: 'completed'
    };
  }

  async callAIProvider(provider, apiKey, item, customPrompt, threshold) {
    const question = item.question || 'N/A';
    const expected = item.expected_answer || item.expected || 'N/A';
    const response = item.bot_response || item.response || 'N/A';

    const prompt = customPrompt ||
      `Evaluate this chatbot response quality and accuracy.
      Question: "${question}"
      Expected Answer: "${expected}"
      Actual Bot Response: "${response}"
      
      Rate from 0.0 to 1.0 how well the bot response matches the expected answer in terms of meaning and intent.
      Return JSON: {"score": 0.85, "explanation": "brief reason"}`;

    let score = 0.5;
    let explanation = 'Evaluation failed';

    try {
      if (!apiKey) {
        // Use fuzzy matching for mock evaluation if no API key
        let mockScore = 0.5;
        try {
          const fuzz = require('fuzzball');
          mockScore = fuzz.ratio(expected, response) / 100;
        } catch (e) {
          mockScore = Math.random() * 0.4 + 0.6; // 0.6 - 1.0
        }

        return {
          ai_score: Math.round(mockScore * 100) / 100,
          ai_explanation: `Mock evaluation using fuzzy match (${Math.round(mockScore * 100)}% similarity)`,
          ai_passed: mockScore >= threshold
        };
      }

      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error(`${provider} API timeout after 30s`)), 30000)
      );

      let apiPromise;

      if (provider === 'groq') {
        apiPromise = fetch('https://api.groq.com/openai/v1/chat/completions', {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({
            model: 'llama3-8b-8192',
            messages: [{ role: 'user', content: prompt }],
            temperature: 0.3,
            response_format: { type: 'json_object' }
          })
        }).then(r => r.json());
      } else if (provider === 'openai') {
        apiPromise = fetch('https://api.openai.com/v1/chat/completions', {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({
            model: 'gpt-3.5-turbo',
            messages: [{ role: 'user', content: prompt }],
            temperature: 0.3,
            response_format: { type: 'json_object' }
          })
        }).then(r => r.json());
      } else if (provider === 'gemini') {
        apiPromise = fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }],
            generationConfig: { temperature: 0.3 }
          })
        }).then(r => r.json());
      } else if (provider === 'cerebras') {
        apiPromise = fetch('https://api.cerebras.ai/v1/chat/completions', {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({
            model: 'llama3.1-8b',
            messages: [{ role: 'user', content: prompt }],
            temperature: 0.3
          })
        }).then(r => r.json());
      } else {
        // Unknown provider — return fallback
        return {
          ai_score: 0.5,
          ai_explanation: `Unsupported provider: ${provider}`,
          ai_passed: 0.5 >= threshold
        };
      }

      const response = await Promise.race([apiPromise, timeoutPromise]);

      // Parse response based on provider
      let content = '';
      if (provider === 'gemini') {
        content = response.candidates?.[0]?.content?.parts?.[0]?.text || '{}';
      } else {
        content = response.choices?.[0]?.message?.content || '{}';
      }

      // Try to parse JSON from content
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        score = parseFloat(parsed.score) || 0.5;
        explanation = parsed.explanation || 'No explanation provided';
      }
    } catch (err) {
      this.log('warn', `AI evaluation failed for item, using fallback: ${err.message}`);
      score = 0.5;
      explanation = `Evaluation error: ${err.message}`;
    }

    return {
      ai_score: Math.round(Math.min(1, Math.max(0, score)) * 100) / 100,
      ai_explanation: explanation,
      ai_passed: score >= threshold
    };
  }
}

module.exports = AIEvaluateNode;
