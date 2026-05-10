const BaseNode = require('./base-node');
const { EnhancedEvaluator, EVAL_CONFIG } = require('../enhanced-evaluator');

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
        { id: 'main', name: 'Test Result', dataType: 'object', required: true }
      ],
      outputs: [
        { id: 'main', name: 'Evaluation Result', dataType: 'object', required: true }
      ],
      config_schema: [
        {
          key: 'provider',
          label: 'AI Provider',
          type: 'select',
          required: true,
          options: [
            { label: 'Gemini', value: 'gemini' },
            { label: 'Groq', value: 'groq' },
            { label: 'OpenAI', value: 'openai' }
          ],
          default: 'groq'
        },
        {
          key: 'apiKey',
          label: 'API Key',
          type: 'text',
          required: false,
          description: 'API Key untuk provider yang dipilih (Opsional, gunakan jika ingin menimpa .env)'
        },
        {
          key: 'model',
          label: 'AI Model',
          type: 'text',
          required: false,
          description: 'Model AI yang akan digunakan (misal: llama-3.3-70b-versatile). Kosongkan untuk menggunakan default dari .env',
        },
        {
          key: 'systemPrompt',
          label: 'System Prompt',
          type: 'textarea',
          required: false,
          description: 'Instruksi detail untuk AI (Persona, kriteria scoring, dll)',
          default: `Anda adalah Senior QA Automation Judge. Tugas Anda adalah mengevaluasi kualitas jawaban Chatbot dibandingkan dengan jawaban referensi (Expected Answer).

KRITERIA EVALUASI:
1. Akurasi Faktual (0.0 - 0.4): Apakah informasi inti benar sesuai referensi?
2. Kelengkapan (0.0 - 0.3): Apakah semua poin penting dalam referensi disebutkan?
3. Relevansi & Nada (0.0 - 0.3): Apakah jawaban menjawab pertanyaan dengan nada yang tepat?

SCORING:
- Berikan skor total antara 0.00 hingga 1.00.
- Pass Threshold default adalah 0.70.

FORMAT OUTPUT (Wajib JSON):
{
  "score": 0.95,
  "explanation": "[✓] Jawaban sangat akurat dan mencakup semua poin referensi. Nada profesional."
}`
        },
        {
          key: 'temperature',
          label: 'Temperature',
          type: 'number',
          default: 0.3,
          min: 0,
          max: 1
        },
        {
          key: 'scoring_threshold',
          label: 'Pass Threshold',
          type: 'number',
          required: true,
          default: 0.7
        }
      ]
    });
  }

  async execute(context, config, node) {
    const input = this.getInput(context, 'main');
    const provider = config.provider || config.ai_provider;

    const apiKeyMap = {
      'gemini': config.apiKey || process.env.GEMINI_API_KEY || process.env.API_KEY_GEMINI,
      'groq': config.apiKey || process.env.GROQ_API_KEY,
      'openai': config.apiKey || process.env.OPENAI_API_KEY,
      'cerebras': config.apiKey || process.env.CEREBRAS_API_KEY
    };

    const apiKey = apiKeyMap[provider];
    if (!apiKey) {
      this.log('warn', `API key for ${provider} is not configured, using mock evaluation results`);
    }

    this.log('info', `Evaluating with AI provider: ${provider}`);

    const results = input?.results || [];
    const threshold = config.scoring_threshold || 0.7;
    const model = config.model || (provider === 'groq' ? config.model_groq : (provider === 'gemini' ? config.model_gemini : null));

    const evaluations = [];
    for (const item of results) {
      this.logTechnical(context, 'info', `Evaluating item ${evaluations.length + 1}/${results.length}...`);
      const evaluation = await this.callAIProvider(context, provider, apiKey, item, config.systemPrompt || config.custom_prompt, threshold, config.temperature, model);
      evaluations.push({ ...item, ...evaluation, ai_provider: provider });
      
      const delay = provider === 'groq' ? 2000 : 500;
      if (results.length > 1) {
        await new Promise(r => setTimeout(r, delay));
      }
    }

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

  async callAIProvider(context, provider, apiKey, item, customPrompt, threshold, temperature, model) {
    const question = item.question || item.test_case || '';
    const response = item.response_llm || item.actual || '';
    const expected = item.response_kb || item.expected || '';
    const title = item.title || 'General Test';

    this.logTechnical(context, 'info', `Starting evaluation for item: ${title}`);
    this.logTechnical(context, 'debug', `Question: ${question}`);
    this.logTechnical(context, 'debug', `Expected: ${expected}`);
    this.logTechnical(context, 'debug', `Actual: ${response}`);

    const evaluator = new EnhancedEvaluator({ thresholds: { ...EVAL_CONFIG.thresholds, good: threshold } });
    const localEval = evaluator.evaluate(question, expected, response, title);
    
    this.logTechnical(context, 'info', `Local evaluation complete: Score=${localEval.totalScore}, Success=${localEval.success}`);

    let prompt = customPrompt || 'Evaluate the following response based on reference.';
    
    const hasPlaceholders = prompt.includes('{actual}') || prompt.includes('{response}') || prompt.includes('{question}');
    
    prompt = prompt
      .replace('{title}', title)
      .replace('{question}', question)
      .replace('{expected}', expected)
      .replace('{actual}', response);

    if (!hasPlaceholders) {
      prompt += `\n\n--- DATA EVALUASI ---\n`;
      if (title && title !== 'General Test') prompt += `KONTEKS: ${title}\n`;
      prompt += `PERTANYAAN USER: ${question}\n`;
      prompt += `REFERENSI KEBENARAN (EXPECTED): ${expected}\n`;
      prompt += `JAWABAN CHATBOT (ACTUAL): ${response}\n`;
      prompt += `\n--- PETUNJUK KHUSUS ---\n`;
      prompt += `1. Fokus pada akurasi faktual (bobot 40%)\n`;
      prompt += `2. Periksa relevansi dengan pertanyaan (bobot 25%)\n`;
      prompt += `3. Pastikan kelengkapan informasi (bobot 20%)\n`;
      prompt += `4. Deteksi halusinasi (bobot 15%)\n`;
    }
    
    this.logTechnical(context, 'info', `Sending Prompt to ${provider}`);

    const temp = temperature || 0.3;
    let score = localEval.totalScore;
    let explanation = localEval.explanation;
    let aiPassed = localEval.success;

    try {
      if (!apiKey) {
        this.logTechnical(context, 'info', 'API key not configured, using enhanced local evaluator');
        return {
          ai_score: localEval.totalScore,
          ai_explanation: localEval.explanation,
          ai_passed: localEval.success,
          ai_breakdown: localEval.breakdown,
          has_hallucination: localEval.hasHallucination,
          hallucinations: localEval.hallucinations
        };
      }

      let retries = 0;
      const maxRetries = 3;
      const timeoutMs = 45000;

      while (retries <= maxRetries) {
        let apiPromise;
        const groqPrompt = provider === 'groq' 
          ? `${prompt}\n\nIMPORTANT: You MUST return a JSON object with EXACTLY two keys: "score" (number 0-1) and "explanation" (concise string analysis). Do not include the original question or reference in your JSON.`
          : prompt;

        if (provider === 'groq') {
          apiPromise = fetch('https://api.groq.com/openai/v1/chat/completions', {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({
              model: model || process.env.GROQ_MODEL || 'llama-3.1-8b-instant',
              messages: [{ role: 'user', content: groqPrompt }],
              temperature: temp,
              response_format: { type: 'json_object' }
            })
          });
        } else if (provider === 'gemini') {
          const geminiModel = model || process.env.GEMINI_MODEL || 'gemini-1.5-flash';
          apiPromise = fetch(`https://generativelanguage.googleapis.com/v1beta/models/${geminiModel}:generateContent?key=${apiKey}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              contents: [{ parts: [{ text: prompt }] }],
              generationConfig: { temperature: temp, responseMimeType: 'application/json' }
            })
          });
        } else if (provider === 'openai') {
          apiPromise = fetch('https://api.openai.com/v1/chat/completions', {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({
              model: model || 'gpt-4o-mini',
              messages: [{ role: 'user', content: prompt }],
              temperature: temp,
              response_format: { type: 'json_object' }
            })
          });
        } else {
           throw new Error(`Unsupported provider: ${provider}`);
        }

        const timeoutPromise = new Promise((_, reject) => setTimeout(() => reject(new Error('API Timeout')), timeoutMs));
        const res = await Promise.race([apiPromise, timeoutPromise]);

        if (res.status === 429) {
          const retryAfter = parseInt(res.headers.get('retry-after') || '3');
          this.log('warning', `Rate limit hit for ${provider}. Retrying in ${retryAfter}s...`);
          await new Promise(r => setTimeout(r, retryAfter * 1000));
          retries++;
          continue;
        }

        if (!res.ok) {
          const errorBody = await res.text();
          throw new Error(`API returned ${res.status}: ${errorBody.substring(0, 200)}`);
        }

        const data = await res.json();
        let content = '';
        if (provider === 'gemini') {
          content = data.candidates?.[0]?.content?.parts?.[0]?.text || '{}';
        } else {
          content = data.choices?.[0]?.message?.content || '{}';
        }

        const jsonMatch = content.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          try {
            const parsed = JSON.parse(jsonMatch[0]);
            const rawScore = parsed.score !== undefined ? parsed.score : 
                             (parsed.rating !== undefined ? parsed.rating : 
                             (parsed.value !== undefined ? parsed.value : null));
            
            if (rawScore !== null) score = parseFloat(rawScore);
            
            explanation = parsed.explanation || parsed.reason || parsed.analysis || parsed.message;
            if (!explanation) {
              const otherKeys = Object.keys(parsed).filter(k => k !== 'score' && k !== 'rating');
              explanation = otherKeys.length > 0 
                ? otherKeys.map(k => `${k}: ${parsed[k]}`).join(' | ') 
                : 'No explanation provided in JSON';
            }
          } catch (e) {
            explanation = `Invalid JSON from AI: ${content.substring(0, 100)}`;
          }
        } else {
          explanation = `AI response was not JSON: ${content.substring(0, 100)}`;
        }
        break;
      }
    } catch (err) {
      this.log('error', `AI evaluation failed: ${err.message}`);
      explanation = `Evaluation error: ${err.message}`;
    }

    const finalScore = Math.round(Math.min(1, Math.max(0, score)) * 100) / 100;
    
    this.logTechnical(context, 'info', `Final evaluation complete: Score=${finalScore}, Threshold=${threshold}`);
    
    return {
      ai_score: finalScore,
      ai_explanation: explanation,
      ai_passed: finalScore >= threshold,
      ai_breakdown: localEval.breakdown,
      has_hallucination: localEval.hasHallucination,
      hallucinations: localEval.hallucinations
    };
  }
}

module.exports = AIEvaluateNode;
