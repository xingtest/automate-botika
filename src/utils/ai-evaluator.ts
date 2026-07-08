import * as dotenv from 'dotenv';
import { log } from './logger';

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
    good: 0.80,       // Baik (Pass)
    fair: 0.50,       // Cukup
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

LANGKAH 0 - CEK KECOCOKAN (WAJIB DILAKUKAN PERTAMA KALI):
Bandingkan teks "Jawaban Chatbot" dengan "Referensi Kebenaran" secara seksama.
- Jika kedua teks IDENTIK atau HAMPIR IDENTIK (hanya beda spasi, kapitalisasi, tanda baca minor), maka WAJIB berikan skor 1.00 dan langsung ke OUTPUT FINAL. JANGAN analisis lebih lanjut.
- Jika teks memiliki substansi yang sama meskipun susunan kalimat sedikit berbeda, berikan skor minimal 0.90.

LANGKAH 1 - ANALISIS MULTI-DIMENSI (Hanya jika jawaban BERBEDA secara substansi):
Lakukan analisa langkah demi langkah. Analisis harus ketat terhadap 4 kriteria ini:

1. Faktual (Factual Accuracy): Apakah jawaban chatbot akurat dan sepenuhnya selaras dengan referensi? Adakah klaim palsu?
2. Relevansi (Relevance): Apakah jawaban benar-benar menjawab apa yang ditanyakan secara langsung?
3. Kelengkapan (Completeness): Apakah semua bagian esensial dari referensi disampaikan tanpa ada yang tertinggal?
4. Halusinasi (Hallucination): Apakah ada informasi karangan tambahan (fabricated) yang tidak ada di referensi? Jika ada, berikan penalti besar.

PEDOMAN SKOR AKHIR (0.0 - 1.0):
- 1.00: Sempurna. Jawaban identik/hampir identik dengan referensi, ATAU 100% akurat, sangat relevan, lengkap, tidak ada informasi tambahan/halusinasi.
- 0.80 - 0.99: Baik, fakta benar tapi mungkin bahasa kurang rapi atau kurang sedikit detail.
- 0.60 - 0.79: Cukup, menjawab sebagian besar inti tapi ada informasi penting yang terlewat.
- 0.40 - 0.59: Kurang, melenceng sebagian, gagal menjawab inti, atau ada halusinasi minor.
- 0.00 - 0.39: Buruk, halusinasi parah, informasi salah (kontradiktif), atau sama sekali tidak relevan.

PERINGATAN KERAS: Memberikan skor rendah untuk jawaban yang IDENTIK dengan referensi adalah KESALAHAN FATAL. Selalu bandingkan teks secara literal terlebih dahulu.`,

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
  },

  // Error Handling Config (per pertanyaan)
  errorHandling: {
    maxQuestionRetries: 3,   // Maksimal coba ulang per pertanyaan sebelum stop test
    retryDelayMs: 3000       // Delay antar retry pertanyaan
  }
};

// ============================================
// 2b. SHARED SCORING FUNCTION
// ============================================
/**
 * Hitung status pass/failed berdasarkan threshold evaluasi.
 * Dipakai bersama oleh semua platform.
 */
export function calculateStatus(score: number): string {
  return score >= EVAL_CONFIG.thresholds.good ? "pass" : "failed";
}


// ============================================
// 3. COMMON UTILITIES
// ============================================
export class BaseEvaluator {
  /**
   * Normalisasi teks untuk perbandingan: lowercase, trim, collapse whitespace,
   * hapus tanda baca non-esensial, dan collapse spasi ganda.
   */
  protected normalizeForComparison(text: string): string {
    return text
      .toLowerCase()
      .trim()
      .replace(/[\r\n]+/g, ' ')        // Newlines → spasi
      .replace(/\s+/g, ' ')             // Collapse multi-spasi
      .replace(/[^\w\s]/g, '')          // Hapus tanda baca
      .trim();
  }

  /**
   * Deteksi jawaban yang identik atau hampir identik.
   * Return EvaluationResult jika exact/near-match, null jika tidak.
   */
  protected checkExactMatch(expectedAnswer: string, actualAnswer: string): EvaluationResult | null {
    if (!actualAnswer || actualAnswer.trim() === '' || actualAnswer.includes('Error:')) {
      return null;
    }

    const normExpected = this.normalizeForComparison(expectedAnswer);
    const normActual = this.normalizeForComparison(actualAnswer);

    // Exact match setelah normalisasi
    if (normExpected === normActual) {
      return {
        score: 1.0,
        explanation: '[Status: ✓] Jawaban chatbot identik dengan referensi Knowledge Base. Skor sempurna.',
        success: true,
        provider: 'Exact Match',
        details: {
          factual_analysis: 'Jawaban 100% identik dengan referensi setelah normalisasi teks.',
          relevance_analysis: 'Jawaban sepenuhnya relevan karena identik dengan referensi.',
          completeness_analysis: 'Jawaban lengkap, tidak ada bagian yang tertinggal.',
          hallucination_check: 'Tidak ada halusinasi, jawaban identik dengan referensi.'
        }
      };
    }

    // Near-match menggunakan fuzzy ratio
    const fuzz = require('fuzzball');
    const fuzzyRatio = fuzz.token_sort_ratio(normExpected, normActual);
    
    if (fuzzyRatio >= 95) {
      return {
        score: 1.0,
        explanation: `[Status: ✓] Jawaban chatbot hampir identik dengan referensi (kemiripan ${fuzzyRatio}%). Skor sempurna.`,
        success: true,
        provider: 'Near-Exact Match',
        details: {
          factual_analysis: `Jawaban memiliki kemiripan ${fuzzyRatio}% dengan referensi setelah normalisasi.`,
          relevance_analysis: 'Jawaban sepenuhnya relevan karena hampir identik dengan referensi.',
          completeness_analysis: 'Jawaban lengkap, perbedaan hanya pada format/tanda baca minor.',
          hallucination_check: 'Tidak ada halusinasi terdeteksi.'
        }
      };
    }

    return null; // Bukan exact/near match, lanjut ke evaluasi AI
  }

  protected simpleTextEvaluation(expectedAnswer: string, actualAnswer: string, reason: string): EvaluationResult {
    const fuzz = require('fuzzball');
    
    if (!actualAnswer || actualAnswer.trim() === '' || actualAnswer.includes('Error:')) {
      return { score: 0.0, explanation: EVAL_CONFIG.messages.noResponse, success: false, provider: 'Simple Matching' };
    }

    // Cek exact match terlebih dahulu
    const exactMatch = this.checkExactMatch(expectedAnswer, actualAnswer);
    if (exactMatch) {
      return { ...exactMatch, provider: 'Simple Matching (Exact)' };
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
          let delay = EVAL_CONFIG.api.retryDelayMs * Math.pow(2, attempt - 1); // Exponential backoff: 2s, 4s, 8s...
          
          // Parse dynamic retry-after from error message if available (e.g. "try again in 8.74s")
          const rateLimitMatch = error.message.match(/try again in (\d+\.?\d*)s/i);
          if (rateLimitMatch && rateLimitMatch[1]) {
            const waitSeconds = parseFloat(rateLimitMatch[1]);
            delay = Math.ceil(waitSeconds * 1000) + 1500; // wait duration + 1.5s buffer
            log.info(`⏳ [${providerName}] Rate limit detected. Parsed dynamic wait delay: ${delay}ms`);
          }
          
          log.warn(`⏳ [${providerName}] Percobaan ${attempt} gagal: ${errorMsg}. Retrying in ${delay}ms...`);
          await new Promise(res => setTimeout(res, delay));
        } else {
          log.error(`❌ [${providerName}] Semua percobaan gagal (${maxAttempts}x). Error: ${errorMsg}`);
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
    // 🛡️ Early return: jawaban identik/hampir identik → skor sempurna tanpa panggil AI
    const exactMatch = this.checkExactMatch(exp, act);
    if (exactMatch) {
      log.info('✅ [Gemini] Exact/near-match terdeteksi, skip AI evaluation.');
      return exactMatch;
    }

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
      log.error('⚠️ Gemini API error:', e.message);
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
    // 🛡️ Early return: jawaban identik/hampir identik → skor sempurna tanpa panggil AI
    const exactMatch = this.checkExactMatch(exp, act);
    if (exactMatch) {
      log.info('✅ [Groq] Exact/near-match terdeteksi, skip AI evaluation.');
      return exactMatch;
    }

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
      log.error(`❌ Groq evaluation failed: ${e.message}`);
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
    // 🛡️ Early return: jawaban identik/hampir identik → skor sempurna tanpa panggil AI
    const exactMatch = this.checkExactMatch(exp, act);
    if (exactMatch) {
      log.info('✅ [Cerebras] Exact/near-match terdeteksi, skip AI evaluation.');
      return exactMatch;
    }

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
      log.error(`❌ Cerebras evaluation failed: ${e.message}`);
      return this.simpleTextEvaluation(exp, act, `Cerebras Error: ${e.message}`);
    }
  }
}

// ============================================
// 6b. OPENAI IMPLEMENTATION
// ============================================
export class OpenAIEvaluator extends BaseEvaluator implements AIEvaluator {
  private apiKey: string = process.env.OPENAI_API_KEY || '';
  private model: string = process.env.OPENAI_MODEL || 'gpt-4o-mini';

  async evaluateResponse(q: string, exp: string, act: string, t: string): Promise<EvaluationResult> {
    // 🛡️ Early return: jawaban identik/hampir identik → skor sempurna tanpa panggil AI
    const exactMatch = this.checkExactMatch(exp, act);
    if (exactMatch) {
      log.info('✅ [OpenAI] Exact/near-match terdeteksi, skip AI evaluation.');
      return exactMatch;
    }

    if (process.env.ENABLE_OPENAI_EVALUATION !== 'true' || !this.apiKey) {
      return this.simpleTextEvaluation(exp, act, 'OpenAI disabled or key missing');
    }

    try {
      const prompt = this.createPrompt(q, exp, act, t);
      const resp = await this.fetchWithRetry('https://api.openai.com/v1/chat/completions', {
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
      }, 'OpenAI');

      if (!resp.ok) {
        const errorText = await resp.text();
        throw new Error(`OpenAI API Error ${resp.status}: ${errorText}`);
      }
      
      const data: any = await resp.json();
      const text = data.choices[0].message.content;
      const result = this.extractJSON(text);

      return {
        score: parseFloat(result.score),
        explanation: result.explanation,
        success: true,
        provider: `OpenAI (${this.model})`,
        details: result.reasoning
      };
    } catch (e: any) {
      log.error(`❌ OpenAI evaluation failed: ${e.message}`);
      return this.simpleTextEvaluation(exp, act, `OpenAI Error: ${e.message}`);
    }
  }
}

// ============================================
// 7. MULTI-PROVIDER IMPLEMENTATION
// ============================================
export class MultiProviderEvaluator implements AIEvaluator {
  private providers = ['gemini', 'groq', 'cerebras', 'openai'];
  
  constructor(private startIndex: number) {}

  async evaluateResponse(q: string, exp: string, act: string, t: string): Promise<EvaluationResult> {
    let lastResult: EvaluationResult | null = null;

    for (let i = 0; i < this.providers.length; i++) {
      const providerName = this.providers[(this.startIndex + i) % this.providers.length];
      const evaluator = EvaluatorFactory.createSpecificEvaluator(providerName, true);
      
      log.info(`📡 [Attempt ${i + 1}/${this.providers.length}] Mode Multi: Menggunakan ${providerName}`);
      const result = await evaluator.evaluateResponse(q, exp, act, t);
      
      if (result.success) {
        return result;
      }
      
      lastResult = result;
      log.warn(`⚠️ ${providerName} gagal: ${result.explanation.split('[Fallback')[0]}`);
      if (i < this.providers.length - 1) {
        log.info(`🔄 Mencoba provider berikutnya...`);
      }
    }

    log.error(`❌ Semua provider (${this.providers.join(', ')}) gagal mengevaluasi.`);
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
    
    log.info(`📡 Using AI Provider: ${provider}`);
    return this.createSpecificEvaluator(provider);
  }

  static createSpecificEvaluator(provider: string, silent: boolean = false): AIEvaluator {
    if (provider === 'groq') {
      if (!silent) log.info(`🚀 Initializing Groq evaluator with model: ${process.env.GROQ_MODEL || 'llama-3.3-70b-versatile'}`);
      return new GroqEvaluator();
    } else if (provider === 'cerebras') {
      if (!silent) log.info(`🚀 Initializing Cerebras evaluator with model: ${process.env.CEREBRAS_MODEL || 'llama-3.3-70b'}`);
      return new CerebrasEvaluator();
    } else if (provider === 'openai') {
      if (!silent) log.info(`🚀 Initializing OpenAI evaluator with model: ${process.env.OPENAI_MODEL || 'gpt-4o-mini'}`);
      return new OpenAIEvaluator();
    } else {
      if (!silent) log.info(`🚀 Initializing Gemini evaluator with model: ${process.env.GEMINI_MODEL || 'gemini-1.5-flash'}`);
      return new GeminiEvaluator();
    }
  }
}
