import * as dotenv from 'dotenv';

dotenv.config();

// ============================================
// 1. INTERFACES
// ============================================
export interface EvaluationResult {
  score: number;
  explanation: string;
  success: boolean;
  provider: string;
}

export interface AIEvaluator {
  evaluateResponse(
    question: string,
    expectedAnswer: string,
    actualAnswer: string,
    title: string
  ): Promise<EvaluationResult>;
}

// ============================================
// 2. CENTRAL CONFIGURATION (Edit prompts here)
// ============================================
export const EVAL_CONFIG = {
  // 🎯 Threshold Skor Evaluasi (0.0 - 1.0)
  thresholds: {
    excellent: 0.90,  // Sempurna
    good: 0.70,       // Baik (Pass)
    fair: 0.60,       // Cukup
    poor: 0.40,       // Kurang
    bad: 0.20         // Buruk
  },

  // 📝 Template Prompt untuk AI (Digunakan oleh Gemini & Groq)
  prompts: {
    systemRole: 'Anda adalah QA Engineer Senior dan Linguist Specialist. Tugas Anda adalah mengevaluasi kualitas jawaban Chatbot dengan metodologi "Chain of Thought".',

    contextTemplate: (title: string, question: string, expectedAnswer: string, actualAnswer: string) => `
KONTEKS PENGUJIAN:
- Topik: ${title}
- Pertanyaan User: "${question}"
- Referensi Kebenaran (Knowledge Base): "${expectedAnswer}"
- Jawaban Chatbot (Yang dievaluasi): "${actualAnswer}"`,

    instructions: `
INSTRUKSI EVALUASI:
Lakukan analisa langkah demi langkah sebelum memberikan skor akhir. WAJIB JELASKAN SEMUA LANGKAH:

• LANGKAH 1: ANALISA KEBENARAN FAKTUAL. Bandingkan fakta di jawaban chatbot dengan referensi.
• LANGKAH 2: ANALISA RELEVANSI. Apakah langsung menjawab pertanyaan user?
• LANGKAH 3: CEK HALUSINASI. Apakah ada info mengarang?

ATURAN SCORING:
- 1.00: Sempurna
- 0.70 - 0.99: Pass (kebenaran faktual benar)
- 0.00 - 0.69: Fail`,

    outputFormat: `
OUTPUT FINAL (WAJIB JSON VALID):
{
  "score": [angka desimal 0.00 - 1.00],
  "explanation": "[Status: ✓/⚠/✗] + Detail analisa singkat."
}`
  },

  // ⚖️ Bobot Scoring Fallback (total harus = 1.0)
  scoreWeights: {
    fuzzyMatch: 0.6,      // Bobot fuzzy matching (kemiripan teks)
    keywordCoverage: 0.4  // Bobot keyword coverage (kehadiran kata kunci)
  },

  messages: {
    noResponse: '✗ Tidak ada respons dari bot.',
    apiKeyMissing: '⚠️ API Key AI belum dikonfigurasi',
    evaluationSuccess: '✅ AI evaluation successful',
    evaluationFailed: '⚠️ AI evaluation failed, menggunakan fallback:',
  }
};

// ============================================
// 3. COMMON UTILITIES
// ============================================
export class BaseEvaluator {
  protected simpleTextEvaluation(expectedAnswer: string, actualAnswer: string, reason: string): EvaluationResult {
    const fuzz = require('fuzzball');
    
    if (!actualAnswer || actualAnswer.trim() === '' || actualAnswer.includes('Error:')) {
      return { score: 0.0, explanation: EVAL_CONFIG.messages.noResponse, success: false, provider: 'Simple Matching' };
    }

    // 1. FUZZY MATCHING (Overall similarity)
    const normalizedExpected = expectedAnswer.toLowerCase().trim();
    const normalizedActual = actualAnswer.toLowerCase().trim();
    const fuzzyScore = fuzz.token_sort_ratio(normalizedExpected, normalizedActual) / 100;

    // 2. KEYWORD COVERAGE (Simple check)
    const expectedWords = normalizedExpected.split(/\s+/).filter(w => w.length > 3);
    const matchedCount = expectedWords.filter(w => normalizedActual.includes(w)).length;
    const keywordScore = expectedWords.length > 0 ? (matchedCount / expectedWords.length) : fuzzyScore;

    // 3. COMBINED SCORE
    const finalScore = (fuzzyScore * EVAL_CONFIG.scoreWeights.fuzzyMatch) + (keywordScore * EVAL_CONFIG.scoreWeights.keywordCoverage);

    let statusStr = finalScore >= EVAL_CONFIG.thresholds.good ? '✓' : '✗';
    let explanation = `${statusStr} Kemiripan: ${(finalScore * 100).toFixed(0)}%. (Matched: ${matchedCount}/${expectedWords.length} kata kunci)`;
    
    return {
      score: parseFloat(finalScore.toFixed(3)),
      explanation: `Auto: ${explanation} [Fallback: ${reason}]`,
      success: false,
      provider: 'Simple Matching'
    };
  }

  protected createPrompt(question: string, expectedAnswer: string, actualAnswer: string, title: string): string {
    return `${EVAL_CONFIG.prompts.systemRole}
${EVAL_CONFIG.prompts.contextTemplate(title, question, expectedAnswer, actualAnswer)}
${EVAL_CONFIG.prompts.instructions}
${EVAL_CONFIG.prompts.outputFormat}`;
  }
}

// ============================================
// 4. GEMINI IMPLEMENTATION
// ============================================
export class GeminiEvaluator extends BaseEvaluator implements AIEvaluator {
  private apiKey: string = process.env.API_KEY_GEMINI || '';
  private model: string = process.env.GEMINI_MODEL || 'gemini-1.5-flash-latest';

  async evaluateResponse(q: string, exp: string, act: string, t: string): Promise<EvaluationResult> {
    if (process.env.ENABLE_GEMINI_EVALUATION !== 'true' || !this.apiKey) {
      return this.simpleTextEvaluation(exp, act, 'Gemini disabled or key missing');
    }

    try {
      const baseUrl = `https://generativelanguage.googleapis.com/v1beta/models/${this.model}:generateContent`;
      const prompt = this.createPrompt(q, exp, act, t);
      
      const resp = await fetch(`${baseUrl}?key=${this.apiKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { temperature: 0.1 }
        })
      });

      if (!resp.ok) {
        const errData: any = await resp.json().catch(() => ({}));
        throw new Error(`Gemini API Error ${resp.status}: ${errData.error?.message || 'Unknown'}`);
      }
      
      const data: any = await resp.json();
      const text = data.candidates[0].content.parts[0].text;
      
      // Clean and parse JSON - handle potential conversational text around JSON
      let cleanText = text.trim();
      const jsonMatch = cleanText.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        cleanText = jsonMatch[0];
      }
      
      const result = JSON.parse(cleanText);
      
      return {
        score: parseFloat(parseFloat(result.score).toFixed(3)),
        explanation: result.explanation,
        success: true,
        provider: `Gemini (${this.model})`
      };
    } catch (e: any) {
      console.error('⚠️ Gemini API error:', e.message);
      return this.simpleTextEvaluation(exp, act, `Gemini Error: ${e.message}`);
    }
  }
}

// ============================================
// 5. GROQ IMPLEMENTATION
// ============================================
export class GroqEvaluator extends BaseEvaluator implements AIEvaluator {
  private apiKey: string = process.env.GROQ_API_KEY || '';
  private model: string = process.env.GROQ_MODEL || 'llama-3.3-70b-versatile';

  async evaluateResponse(q: string, exp: string, act: string, t: string): Promise<EvaluationResult> {
    if (process.env.ENABLE_GROQ_EVALUATION !== 'true' || !this.apiKey) {
      console.log(`⚠️ Groq evaluation disabled or API key missing. ENABLE_GROQ_EVALUATION: ${process.env.ENABLE_GROQ_EVALUATION}, API Key exists: ${!!this.apiKey}`);
      return this.simpleTextEvaluation(exp, act, 'Groq disabled or key missing');
    }

    try {
      console.log(`🚀 Using Groq model: ${this.model}`);
      const prompt = this.createPrompt(q, exp, act, t);
      const resp = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.apiKey}`
        },
        body: JSON.stringify({
          model: this.model,
          messages: [{ role: 'system', content: EVAL_CONFIG.prompts.systemRole }, { role: 'user', content: prompt }],
          response_format: { type: 'json_object' }
        })
      });

      if (!resp.ok) {
        const errorText = await resp.text();
        console.error(`❌ Groq API Error ${resp.status}: ${errorText}`);
        throw new Error(`API Error: ${resp.status} - ${errorText}`);
      }
      
      const data: any = await resp.json();
      const result = JSON.parse(data.choices[0].message.content);

      console.log(`✅ Groq evaluation successful with model: ${this.model}`);
      return {
        score: parseFloat(result.score),
        explanation: result.explanation,
        success: true,
        provider: `Groq (${this.model})`
      };
    } catch (e: any) {
      console.error(`❌ Groq evaluation failed: ${e.message}`);
      return this.simpleTextEvaluation(exp, act, `Groq Error: ${e.message}`);
    }
  }
}

// ============================================
// 6. CEREBRAS IMPLEMENTATION (OpenAI-compatible)
// ============================================
export class CerebrasEvaluator extends BaseEvaluator implements AIEvaluator {
  private apiKey: string = process.env.CEREBRAS_API_KEY || '';
  private model: string = process.env.CEREBRAS_MODEL || 'llama-3.3-70b';

  async evaluateResponse(q: string, exp: string, act: string, t: string): Promise<EvaluationResult> {
    if (process.env.ENABLE_CEREBRAS_EVALUATION !== 'true' || !this.apiKey) {
      return this.simpleTextEvaluation(exp, act, 'Cerebras disabled or key missing');
    }

    try {
      const prompt = this.createPrompt(q, exp, act, t);
      const resp = await fetch('https://api.cerebras.ai/v1/chat/completions', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.apiKey}`
        },
        body: JSON.stringify({
          model: this.model,
          messages: [
            { role: 'system', content: EVAL_CONFIG.prompts.systemRole }, 
            { role: 'user', content: prompt }
          ],
          temperature: 0.1,
          response_format: { type: 'json_object' }
        })
      });

      if (!resp.ok) {
        const errorText = await resp.text();
        throw new Error(`Cerebras API Error ${resp.status}: ${errorText}`);
      }
      
      const data: any = await resp.json();
      const result = JSON.parse(data.choices[0].message.content);

      return {
        score: parseFloat(result.score),
        explanation: result.explanation,
        success: true,
        provider: `Cerebras (${this.model})`
      };
    } catch (e: any) {
      console.error(`❌ Cerebras evaluation failed: ${e.message}`);
      return this.simpleTextEvaluation(exp, act, `Cerebras Error: ${e.message}`);
    }
  }
}

// ============================================
// 7. FACTORY
// ============================================
export class EvaluatorFactory {
  static getEvaluator(): AIEvaluator {
    const provider = (process.env.AI_PROVIDER || 'gemini').toLowerCase();
    console.log(`📡 AI_PROVIDER environment variable: "${process.env.AI_PROVIDER}"`);
    console.log(`📡 Using AI Provider: ${provider}`);
    
    if (provider === 'groq') {
      console.log(`🚀 Initializing Groq evaluator with model: ${process.env.GROQ_MODEL || 'llama-3.3-70b-versatile'}`);
      return new GroqEvaluator();
    } else if (provider === 'cerebras') {
      console.log(`🚀 Initializing Cerebras evaluator with model: ${process.env.CEREBRAS_MODEL || 'llama-3.3-70b'}`);
      return new CerebrasEvaluator();
    } else {
      console.log(`🚀 Initializing Gemini evaluator with model: ${process.env.GEMINI_MODEL || 'gemini-1.5-flash-latest'}`);
      return new GeminiEvaluator();
    }
  }
}
