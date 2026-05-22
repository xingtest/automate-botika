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
  details?: any; // Untuk menyimpan detail reasoning dari AI
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

  // 📝 Template Prompt Tingkat Lanjut (Chain of Thought + Multi-Dimensi)
  prompts: {
    systemRole: 'Anda adalah QA Engineer Senior dan AI Auditor yang ketat. Tugas Anda adalah mengevaluasi kualitas jawaban Chatbot dengan metodologi "Chain of Thought" secara objektif dan teliti.',

    contextTemplate: (title: string, question: string, expectedAnswer: string, actualAnswer: string) => `
KONTEKS PENGUJIAN:
- Topik / Skenario: ${title}
- Pertanyaan User: "${question}"
- Referensi Kebenaran (Knowledge Base): "${expectedAnswer}"
- Jawaban Chatbot (Yang dievaluasi): "${actualAnswer}"`,

    instructions: `
INSTRUKSI EVALUASI:
Lakukan analisa multi-dimensi langkah demi langkah. Analisis harus ketat terhadap 4 kriteria ini:

1. Faktual (Factual Accuracy): Apakah jawaban chatbot akurat dan sepenuhnya selaras dengan referensi? Adakah klaim palsu?
2. Relevansi (Relevance): Apakah jawaban benar-benar menjawab apa yang ditanyakan secara langsung?
3. Kelengkapan (Completeness): Apakah semua bagian esensial dari referensi disampaikan tanpa ada yang tertinggal?
4. Halusinasi (Hallucination): Apakah ada informasi karangan tambahan (fabricated) yang tidak ada di referensi? Jika ada, berikan penalti besar.

PEDOMAN SKOR AKHIR (0.0 - 1.0):
- 1.00: Sempurna, 100% akurat, sangat relevan, lengkap, tidak ada informasi tambahan/halusinasi.
- 0.80 - 0.99: Baik, fakta benar tapi mungkin bahasa kurang rapi atau kurang sedikit detail.
- 0.60 - 0.79: Cukup, menjawab sebagian besar inti tapi ada informasi penting yang terlewat.
- 0.40 - 0.59: Kurang, melenceng sebagian, gagal menjawab inti, atau ada halusinasi minor.
- 0.00 - 0.39: Buruk, halusinasi parah, informasi salah (kontradiktif), atau sama sekali tidak relevan.`,

    outputFormat: `
OUTPUT FINAL (WAJIB MENGEMBALIKAN JSON VALID SAJA, TANPA FORMAT MARKDOWN ATAU TEKS LAIN):
{
  "reasoning": {
    "factual_analysis": "...",
    "relevance_analysis": "...",
    "completeness_analysis": "...",
    "hallucination_check": "..."
  },
  "score": [angka desimal 0.00 - 1.00],
  "explanation": "[Status: ✓/⚠/✗] + Kesimpulan evaluasi maksimal 2 kalimat."
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
  },
  
  // 🛡️ API Resiliency Config
  api: {
    timeoutMs: 35000,     // Maksimal nunggu 35 detik per request
    maxRetries: 2,        // Maksimal coba ulang jika gagal (Rate Limit/Network Error)
    retryDelayMs: 2000    // Delay awal sebelum coba ulang (akan dikali eksponensial)
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
    const expectedWords = normalizedExpected.split(/\s+/).filter((w: string) => w.length > 3);
    const matchedCount = expectedWords.filter((w: string) => normalizedActual.includes(w)).length;
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
    return `${EVAL_CONFIG.prompts.systemRole}\n${EVAL_CONFIG.prompts.contextTemplate(title, question, expectedAnswer, actualAnswer)}\n${EVAL_CONFIG.prompts.instructions}\n${EVAL_CONFIG.prompts.outputFormat}`;
  }

  /**
   * Ekstraktor JSON cerdas untuk menangani respon AI yang terkadang dibungkus markdown
   */
  protected extractJSON(text: string): any {
    try {
      return JSON.parse(text); // Coba parsing langsung dulu
    } catch (e) {
      let cleanText = text.trim();
      // Cari blok JSON dalam markdown ```json ... ```
      const jsonBlockMatch = cleanText.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
      if (jsonBlockMatch && jsonBlockMatch[1]) {
        try {
          return JSON.parse(jsonBlockMatch[1].trim());
        } catch (err) {}
      }
      
      // Jika gagal, cari fallback ke object { ... }
      const objectMatch = cleanText.match(/\{[\s\S]*\}/);
      if (objectMatch) {
        try {
          return JSON.parse(objectMatch[0]);
        } catch (err) {}
      }
      
      throw new Error("Gagal mendeteksi/memparsing JSON dari respon AI.");
    }
  }

  /**
   * Wrapper fetch dengan fitur Timeout dan Exponential Backoff Retry
   */
  protected async fetchWithRetry(url: string, options: any, providerName: string): Promise<Response> {
    let lastError: any;
    const maxAttempts = EVAL_CONFIG.api.maxRetries + 1;

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), EVAL_CONFIG.api.timeoutMs);
      
      try {
        const fetchOptions = { ...options, signal: controller.signal };
        const response = await fetch(url, fetchOptions);
        clearTimeout(timeout);
        
        if (response.ok) {
          return response;
        }
        
        // Cek jika error bersumber dari Rate Limit atau Error Internal Server (Bisa dicoba lagi)
        if (response.status === 429 || response.status >= 500) {
           const errText = await response.text();
           throw new Error(`HTTP ${response.status} - ${errText}`);
        } else {
           // Bad request / Unauthorized (Tidak bisa dicoba lagi)
           return response;
        }
      } catch (error: any) {
        clearTimeout(timeout);
        lastError = error;
        
        const isAbort = error.name === 'AbortError' || error.message.includes('abort');
        const errorMsg = isAbort ? `Timeout setelah ${EVAL_CONFIG.api.timeoutMs}ms` : error.message;
        
        if (attempt < maxAttempts) {
          const delay = EVAL_CONFIG.api.retryDelayMs * Math.pow(2, attempt - 1); // Exponential backoff: 2s, 4s, 8s...
          console.warn(`⏳ [${providerName}] Percobaan ${attempt} gagal: ${errorMsg}. Retrying in ${delay}ms...`);
          await new Promise(res => setTimeout(res, delay));
        } else {
          console.error(`❌ [${providerName}] Semua percobaan gagal (${maxAttempts}x). Error: ${errorMsg}`);
        }
      }
    }
    throw lastError;
  }
}

// ============================================
// 4. GEMINI IMPLEMENTATION
// ============================================
export class GeminiEvaluator extends BaseEvaluator implements AIEvaluator {
  private apiKey: string = process.env.API_KEY_GEMINI || '';
  private model: string = process.env.GEMINI_MODEL || 'gemini-1.5-flash';

  async evaluateResponse(q: string, exp: string, act: string, t: string): Promise<EvaluationResult> {
    if (process.env.ENABLE_GEMINI_EVALUATION !== 'true' || !this.apiKey) {
      return this.simpleTextEvaluation(exp, act, 'Gemini disabled or key missing');
    }

    try {
      const baseUrl = `https://generativelanguage.googleapis.com/v1beta/models/${this.model}:generateContent`;
      const prompt = this.createPrompt(q, exp, act, t);
      
      const resp = await this.fetchWithRetry(`${baseUrl}?key=${this.apiKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { temperature: 0.1 }
        })
      }, 'Gemini');

      if (!resp.ok) {
        const errData: any = await resp.json().catch(() => ({}));
        throw new Error(`Gemini API Error ${resp.status}: ${errData.error?.message || 'Unknown'}`);
      }
      
      const data: any = await resp.json();
      const text = data.candidates[0].content.parts[0].text;
      const result = this.extractJSON(text);
      
      return {
        score: parseFloat(parseFloat(result.score).toFixed(3)),
        explanation: result.explanation,
        success: true,
        provider: `Gemini (${this.model})`,
        details: result.reasoning
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
      return this.simpleTextEvaluation(exp, act, 'Groq disabled or key missing');
    }

    try {
      const prompt = this.createPrompt(q, exp, act, t);
      const resp = await this.fetchWithRetry('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.apiKey}`
        },
        body: JSON.stringify({
          model: this.model,
          messages: [{ role: 'system', content: EVAL_CONFIG.prompts.systemRole }, { role: 'user', content: prompt }],
          response_format: { type: 'json_object' },
          temperature: 0.1
        })
      }, 'Groq');

      if (!resp.ok) {
        const errorText = await resp.text();
        throw new Error(`API Error: ${resp.status} - ${errorText}`);
      }
      
      const data: any = await resp.json();
      const text = data.choices[0].message.content;
      const result = this.extractJSON(text);

      return {
        score: parseFloat(result.score),
        explanation: result.explanation,
        success: true,
        provider: `Groq (${this.model})`,
        details: result.reasoning
      };
    } catch (e: any) {
      console.error(`❌ Groq evaluation failed: ${e.message}`);
      return this.simpleTextEvaluation(exp, act, `Groq Error: ${e.message}`);
    }
  }
}

// ============================================
// 6. CEREBRAS IMPLEMENTATION
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
      const resp = await this.fetchWithRetry('https://api.cerebras.ai/v1/chat/completions', {
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
      }, 'Cerebras');

      if (!resp.ok) {
        const errorText = await resp.text();
        throw new Error(`Cerebras API Error ${resp.status}: ${errorText}`);
      }
      
      const data: any = await resp.json();
      const text = data.choices[0].message.content;
      const result = this.extractJSON(text);

      return {
        score: parseFloat(result.score),
        explanation: result.explanation,
        success: true,
        provider: `Cerebras (${this.model})`,
        details: result.reasoning
      };
    } catch (e: any) {
      console.error(`❌ Cerebras evaluation failed: ${e.message}`);
      return this.simpleTextEvaluation(exp, act, `Cerebras Error: ${e.message}`);
    }
  }
}

// ============================================
// 7. MULTI-PROVIDER IMPLEMENTATION
// ============================================
export class MultiProviderEvaluator implements AIEvaluator {
  private providers = ['gemini', 'groq', 'cerebras'];
  
  constructor(private startIndex: number) {}

  async evaluateResponse(q: string, exp: string, act: string, t: string): Promise<EvaluationResult> {
    let lastResult: EvaluationResult | null = null;

    for (let i = 0; i < this.providers.length; i++) {
      const providerName = this.providers[(this.startIndex + i) % this.providers.length];
      const evaluator = EvaluatorFactory.createSpecificEvaluator(providerName, true);
      
      console.log(`📡 [Attempt ${i + 1}/${this.providers.length}] Mode Multi: Menggunakan ${providerName}`);
      const result = await evaluator.evaluateResponse(q, exp, act, t);
      
      if (result.success) {
        return result;
      }
      
      lastResult = result;
      console.warn(`⚠️ ${providerName} gagal: ${result.explanation.split('[Fallback')[0]}`);
      if (i < this.providers.length - 1) {
        console.log(`🔄 Mencoba provider berikutnya...`);
      }
    }

    console.error(`❌ Semua provider (${this.providers.join(', ')}) gagal mengevaluasi.`);
    return lastResult!;
  }
}

// ============================================
// 8. FACTORY
// ============================================
export class EvaluatorFactory {
  private static rotationIndex = 0;

  static getEvaluator(): AIEvaluator {
    const provider = (process.env.AI_PROVIDER || 'gemini').toLowerCase();
    
    if (provider === 'multi') {
      const currentIndex = this.rotationIndex;
      this.rotationIndex++;
      return new MultiProviderEvaluator(currentIndex);
    }
    
    console.log(`📡 Using AI Provider: ${provider}`);
    return this.createSpecificEvaluator(provider);
  }

  static createSpecificEvaluator(provider: string, silent: boolean = false): AIEvaluator {
    if (provider === 'groq') {
      if (!silent) console.log(`🚀 Initializing Groq evaluator with model: ${process.env.GROQ_MODEL || 'llama-3.3-70b-versatile'}`);
      return new GroqEvaluator();
    } else if (provider === 'cerebras') {
      if (!silent) console.log(`🚀 Initializing Cerebras evaluator with model: ${process.env.CEREBRAS_MODEL || 'llama-3.3-70b'}`);
      return new CerebrasEvaluator();
    } else {
      if (!silent) console.log(`🚀 Initializing Gemini evaluator with model: ${process.env.GEMINI_MODEL || 'gemini-1.5-flash'}`);
      return new GeminiEvaluator();
    }
  }
}
