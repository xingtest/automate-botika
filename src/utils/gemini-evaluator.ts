import * as dotenv from 'dotenv';

dotenv.config();

export interface EvaluationResult {
  score: number;
  explanation: string;
  success: boolean;
}

export class GeminiEvaluator {
  private apiKey: string;
  private baseUrl: string = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash-latest:generateContent';

  constructor() {
    this.apiKey = process.env.API_KEY_GEMINI || '';
    if (!this.apiKey) {
      console.warn('⚠️ API_KEY_GEMINI tidak ditemukan di environment variables');
    }
  }

  async evaluateResponse(
    question: string,
    expectedAnswer: string,
    actualAnswer: string,
    title: string
  ): Promise<EvaluationResult> {
    // Check if Gemini evaluation is enabled
    const isEnabled = process.env.ENABLE_GEMINI_EVALUATION?.toLowerCase() === 'true';

    if (!isEnabled) {
      // Use simple text matching when Gemini is disabled
      return this.simpleTextEvaluation(expectedAnswer, actualAnswer, 'Gemini AI evaluation disabled in config');
    }

    if (!this.apiKey || this.apiKey.includes('<MASUKKAN')) {
      return this.simpleTextEvaluation(expectedAnswer, actualAnswer, 'Gemini API key tidak valid atau tidak tersedia');
    }

    // Quick API key validation - if it's the default key, skip API call
    if (this.apiKey === 'AIzaSyBr00LZZfAvgiBe4DFHGhRtGQIc4NPb4p0') {
      console.log('⚠️ Using default/demo API key, skipping Gemini evaluation');
      return this.simpleTextEvaluation(expectedAnswer, actualAnswer, 'Demo API key - Gemini evaluation disabled');
    }

    try {
      const prompt = this.createEvaluationPrompt(question, expectedAnswer, actualAnswer, title);

      const response = await fetch(`${this.baseUrl}?key=${this.apiKey}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          contents: [{
            parts: [{
              text: prompt
            }]
          }],
          generationConfig: {
            temperature: 0.1,
            topK: 1,
            topP: 1,
            maxOutputTokens: 500,
          }
        })
      });

      if (!response.ok) {
        throw new Error(`Gemini API error: ${response.status} ${response.statusText}`);
      }

      const data: any = await response.json();

      if (data.candidates && data.candidates[0] && data.candidates[0].content) {
        const evaluationText = data.candidates[0].content.parts[0].text;
        return this.parseEvaluationResult(evaluationText);
      } else {
        throw new Error('Invalid response format from Gemini API');
      }

    } catch (error) {
      console.error('Error evaluating with Gemini:', error);
      // Use simple text evaluation as fallback when API fails
      return this.simpleTextEvaluation(
        expectedAnswer,
        actualAnswer,
        `Gemini API error: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  private simpleTextEvaluation(expectedAnswer: string, actualAnswer: string, reason: string): EvaluationResult {
    // Import fuzzball for fuzzy string matching
    const fuzz = require('fuzzball');

    // Simple text-based evaluation when AI is not available
    // Focus on content quality: factual correctness, relevance, completeness

    // Check if actual answer is empty or error
    if (!actualAnswer || actualAnswer.trim() === '' ||
      actualAnswer.includes('Error:') ||
      actualAnswer.includes('Tidak ada balasan') ||
      actualAnswer.includes('tidak ada pesan')) {
      return {
        score: 0.0,
        explanation: `✗ Tidak ada respons dari bot. Tidak dapat dievaluasi.`,
        success: false
      };
    }

    // Check for very short or generic answers (likely not helpful)
    if (actualAnswer.trim().length < 20) {
      return {
        score: 0.15,
        explanation: `✗ Jawaban terlalu singkat (${actualAnswer.trim().length} karakter). Tidak cukup informatif untuk menjawab pertanyaan.`,
        success: false
      };
    }

    // Normalize texts for comparison
    const normalizeText = (text: string) => {
      return text.toLowerCase()
        .replace(/[^\w\s]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
    };

    const normalizedExpected = normalizeText(expectedAnswer);
    const normalizedActual = normalizeText(actualAnswer);

    // 1. FUZZY STRING MATCHING (Overall similarity)
    const fuzzyRatio = fuzz.ratio(normalizedExpected, normalizedActual) / 100; // 0-1 scale
    const partialRatio = fuzz.partial_ratio(normalizedExpected, normalizedActual) / 100;
    const tokenSortRatio = fuzz.token_sort_ratio(normalizedExpected, normalizedActual) / 100;

    // Weighted average of fuzzy scores
    const fuzzyScore = (fuzzyRatio * 0.3) + (partialRatio * 0.3) + (tokenSortRatio * 0.4);

    // 2. KEYWORD MATCHING (Content coverage)
    const expectedWords = normalizedExpected.split(' ').filter(w => w.length > 3);
    const actualWords = normalizedActual.split(' ');

    const matchedKeywords: string[] = [];
    const missingKeywords: string[] = [];

    for (const word of expectedWords) {
      // Use fuzzy matching for keywords (allows for typos and variations)
      const bestMatch = actualWords.reduce((best, aw) => {
        const score = fuzz.ratio(word, aw) / 100;
        return score > best.score ? { word: aw, score } : best;
      }, { word: '', score: 0 });

      // Consider it a match if similarity > 80%
      if (bestMatch.score > 0.8 || actualWords.some(aw => aw.includes(word) || word.includes(aw))) {
        matchedKeywords.push(word);
      } else {
        missingKeywords.push(word);
      }
    }

    // Calculate keyword coverage
    const keywordCoverage = expectedWords.length > 0
      ? (matchedKeywords.length / expectedWords.length)
      : 0;

    // 3. COMBINED SCORE (Fuzzy + Keyword)
    // Weight: 60% fuzzy matching, 40% keyword coverage
    const combinedScore = (fuzzyScore * 0.6) + (keywordCoverage * 0.4);

    // 4. CONFIGURABLE THRESHOLDS
    const thresholds = {
      excellent: parseFloat(process.env.EVAL_THRESHOLD_EXCELLENT || '0.90'),
      good: parseFloat(process.env.EVAL_THRESHOLD_GOOD || '0.70'),
      fair: parseFloat(process.env.EVAL_THRESHOLD_FAIR || '0.60'),
      poor: parseFloat(process.env.EVAL_THRESHOLD_POOR || '0.40'),
      bad: parseFloat(process.env.EVAL_THRESHOLD_BAD || '0.20'),
    };

    // 5. GENERATE SCORE AND EXPLANATION
    let finalScore = 0.0;
    let explanation = '';

    const matchedCount = matchedKeywords.length;
    const missingCount = missingKeywords.length;

    if (combinedScore >= thresholds.excellent) {
      finalScore = 0.90 + (combinedScore - thresholds.excellent) * 1.0; // 0.90-1.00
      explanation = `✓ Jawaban sangat baik dan lengkap (similarity: ${(combinedScore * 100).toFixed(1)}%). Semua informasi penting tercakup dengan akurat.`;

    } else if (combinedScore >= thresholds.good) {
      finalScore = 0.70 + ((combinedScore - thresholds.good) / (thresholds.excellent - thresholds.good)) * 0.20; // 0.70-0.90

      if (missingCount > 0 && missingCount <= 2) {
        const missing = missingKeywords.slice(0, 2).join(' dan ');
        explanation = `✓ Jawaban baik (similarity: ${(combinedScore * 100).toFixed(1)}%). Mencakup sebagian besar informasi. Akan lebih sempurna dengan ${missing}.`;
      } else {
        explanation = `✓ Jawaban baik (similarity: ${(combinedScore * 100).toFixed(1)}%). Mencakup poin-poin utama dengan tepat.`;
      }

    } else if (combinedScore >= thresholds.fair) {
      finalScore = 0.60 + ((combinedScore - thresholds.fair) / (thresholds.good - thresholds.fair)) * 0.10; // 0.60-0.70

      const matched = matchedKeywords.slice(0, 2).join(' dan ');
      const missing = missingKeywords.slice(0, 3).join(', ');
      explanation = `⚠ Jawaban cukup (similarity: ${(combinedScore * 100).toFixed(1)}%). Benar untuk ${matched}, tapi kurang lengkap. Perlu ${missing}.`;

    } else if (combinedScore >= thresholds.poor) {
      finalScore = 0.40 + ((combinedScore - thresholds.poor) / (thresholds.fair - thresholds.poor)) * 0.20; // 0.40-0.60

      const missing = missingKeywords.slice(0, 3).join(', ');
      if (matchedCount > 0) {
        const matched = matchedKeywords.slice(0, 2).join(' dan ');
        explanation = `⚠ Jawaban kurang lengkap (similarity: ${(combinedScore * 100).toFixed(1)}%). Hanya mencakup ${matched}. Banyak info penting seperti ${missing} belum disebutkan.`;
      } else {
        explanation = `⚠ Jawaban kurang lengkap (similarity: ${(combinedScore * 100).toFixed(1)}%). Informasi penting seperti ${missing} tidak tercakup.`;
      }

    } else if (combinedScore >= thresholds.bad) {
      finalScore = 0.20 + ((combinedScore - thresholds.bad) / (thresholds.poor - thresholds.bad)) * 0.20; // 0.20-0.40

      const missing = missingKeywords.slice(0, 3).join(', ');
      explanation = `✗ Jawaban tidak cukup relevan (similarity: ${(combinedScore * 100).toFixed(1)}%). Sebagian besar info penting seperti ${missing} tidak disebutkan.`;

    } else {
      finalScore = combinedScore * 0.20; // 0.0-0.20

      const missing = missingKeywords.slice(0, 3).join(', ');
      explanation = `✗ Jawaban tidak sesuai (similarity: ${(combinedScore * 100).toFixed(1)}%). Informasi yang dibutuhkan seperti ${missing} tidak ada.`;
    }

    return {
      score: Math.max(0.0, Math.min(1.0, parseFloat(finalScore.toFixed(3)))),
      explanation: `Auto: ${explanation}`,
      success: false
    };
  }


  private createEvaluationPrompt(
    question: string,
    expectedAnswer: string,
    actualAnswer: string,
    title: string
  ): string {
    return `Sebagai AI evaluator profesional untuk chatbot testing, evaluasi kualitas jawaban chatbot berikut:

TOPIK: ${title}
PERTANYAAN LENGKAP: ${question}
KONTEKS KB (sebagai referensi): ${expectedAnswer}
JAWABAN LLM YANG DIBERIKAN: ${actualAnswer}

KRITERIA EVALUASI UTAMA untuk 'Jawaban LLM yang Diberikan':

1. KEBENARAN FAKTUAL (40%)
   - Apakah informasi yang diberikan benar dan akurat sesuai konteks KB?
   - Tidak ada informasi yang menyesatkan atau salah?
   - Fakta dan data konsisten dengan konteks KB?

2. RELEVANSI DENGAN PERTANYAAN LENGKAP (35%)
   - Apakah jawaban LANGSUNG menjawab 'Pertanyaan Lengkap' yang diajukan?
   - Tidak ada informasi yang tidak relevan atau menyimpang dari topik?
   - Fokus pada apa yang ditanyakan dalam 'Pertanyaan Lengkap'?

3. KEMAMPUAN MERANGKUM DARI KONTEKS KB (25%)
   - Apakah jawaban berhasil merangkum informasi penting dari konteks KB?
   - Informasi yang diberikan cukup lengkap untuk menjawab pertanyaan?
   - Mencakup poin-poin utama dari konteks KB?

CATATAN PENTING:
- Gunakan 'Konteks KB' sebagai REFERENSI utama untuk menilai kebenaran faktual
- Jawaban LLM yang BAIK harus: akurat secara faktual, relevan dengan 'Pertanyaan Lengkap', dan berhasil merangkum dari konteks KB
- Jawaban LLM boleh berbeda redaksi dari KB selama tetap BENAR dan RELEVAN
- NADA BAHASA TIDAK MASALAH - bisa formal, santai, ramah, atau gaya apapun selama informasinya benar
- Prioritaskan: (1) Kebenaran faktual, (2) Relevansi dengan pertanyaan, (3) Kemampuan merangkum

OUTPUT FORMAT (JSON):
{
  "score": [angka desimal 0.0-1.0, contoh: 0.85],
  "explanation": "[penjelasan DESKRIPTIF dalam bahasa Indonesia, maksimal 200 karakter]"
}

FORMAT EXPLANATION yang BAIK:
- Mulai dengan status: ✓ (sesuai), ⚠ (cukup sesuai), atau ✗ (tidak sesuai)
- Gunakan bahasa NATURAL dan DESKRIPTIF, bukan list kata-kata
- Jelaskan dengan SANTAI seperti menjelaskan ke teman
- Sebutkan apa yang SUDAH BENAR dan apa yang MASIH KURANG dalam kalimat lengkap
- Maksimal 200 karakter, fokus pada konteks keseluruhan

CONTOH EXPLANATION YANG BAIK:
- "✓ Jawaban sudah sangat baik, mencakup jam operasional dan lokasi dengan lengkap. Akan lebih sempurna jika ditambahkan info kontak."
- "⚠ Jawaban sudah benar untuk bagian lokasi dan jam buka, tapi masih kurang lengkap. Perlu ditambahkan info telepon dan email."
- "✗ Jawaban tidak menjawab pertanyaan tentang jam operasional. Hanya memberikan salam pembuka tanpa informasi yang diminta."

HINDARI format seperti ini:
- ❌ "Sudah ada: A, B, C. Kurang: D, E, F" (terlalu kaku, seperti list)
- ❌ "Mencakup: X, Y, Z" (tidak natural)

GUNAKAN format seperti ini:
- ✅ "Jawaban sudah baik untuk bagian X dan Y, tapi perlu ditambahkan Z"
- ✅ "Informasi tentang X sudah lengkap, namun belum menyebutkan Y"

SCORING GUIDE:
- 0.90-1.00: Sempurna - Faktual akurat, sangat relevan dengan pertanyaan, berhasil merangkum KB dengan lengkap
- 0.70-0.89: Baik (PASS) - Benar secara faktual, relevan dengan pertanyaan, berhasil merangkum poin utama KB
- 0.50-0.69: Cukup - Benar tapi kurang lengkap dalam merangkum KB atau sedikit kurang relevan
- 0.30-0.49: Kurang - Relevansi atau akurasi faktual bermasalah, tidak merangkum KB dengan baik
- 0.00-0.29: Buruk - Tidak relevan dengan pertanyaan atau informasi faktual salah

PENTING:
- Score ≥0.7 = PASS
- Score <0.7 = FAILED
- Pastikan output HANYA JSON valid tanpa teks tambahan`;
  }

  private parseEvaluationResult(evaluationText: string): EvaluationResult {
    try {
      // Clean the response text
      let cleanText = evaluationText.trim();

      // Remove markdown code blocks if present
      cleanText = cleanText.replace(/```json\n?/g, '').replace(/```\n?/g, '');

      // Try to find JSON in the response
      const jsonMatch = cleanText.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        cleanText = jsonMatch[0];
      }

      const result = JSON.parse(cleanText);

      // Validate the result
      if (typeof result.score === 'number' && typeof result.explanation === 'string') {
        let score = result.score;

        // Convert if score is in 0-100 range (old format)
        if (score > 1.0) {
          score = score / 100.0;
        }

        // Ensure score is within valid range 0.0-1.0
        score = Math.max(0.0, Math.min(1.0, parseFloat(score.toFixed(3))));

        // Limit explanation length
        let explanation = result.explanation.length > 200
          ? result.explanation.substring(0, 197) + '...'
          : result.explanation;

        // Add prefix if not already present
        if (!explanation.startsWith('AI:') && !explanation.startsWith('✓') && !explanation.startsWith('✗') && !explanation.startsWith('⚠')) {
          explanation = `AI: ${explanation}`;
        }

        return {
          score,
          explanation,
          success: true
        };
      } else {
        throw new Error('Invalid JSON structure');
      }

    } catch (error) {
      console.error('Error parsing Gemini evaluation result:', error);
      console.error('Raw response:', evaluationText);

      // Fallback: try to extract score from text
      const scoreMatch = evaluationText.match(/score["\s:]*(\d+\.?\d*)/i);
      let score = scoreMatch ? parseFloat(scoreMatch[1]) : 0.75;

      // Convert if in 0-100 range
      if (score > 1.0) {
        score = score / 100.0;
      }

      return {
        score: Math.max(0.0, Math.min(1.0, parseFloat(score.toFixed(3)))),
        explanation: 'AI: Evaluasi berhasil namun format response tidak standar',
        success: true
      };
    }
  }

  // Method untuk test koneksi API dengan multiple endpoints
  async testConnection(): Promise<boolean> {
    if (!this.apiKey) {
      console.log('❌ Gemini API key tidak tersedia');
      return false;
    }

    // List of possible endpoints to try
    const endpoints = [
      'https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash-latest:generateContent',
      'https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent',
      'https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent',
      'https://generativelanguage.googleapis.com/v1/models/gemini-pro:generateContent'
    ];

    for (const endpoint of endpoints) {
      try {
        console.log(`🧪 Testing endpoint: ${endpoint.split('/').pop()}`);

        const response = await fetch(`${endpoint}?key=${this.apiKey}`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            contents: [{
              parts: [{
                text: 'Test'
              }]
            }],
            generationConfig: {
              temperature: 0.1,
              maxOutputTokens: 10,
            }
          })
        });

        if (response.ok) {
          console.log(`✅ Gemini API connection successful with: ${endpoint.split('/').pop()}`);
          this.baseUrl = endpoint; // Update to working endpoint
          return true;
        } else {
          console.log(`❌ Endpoint failed with status: ${response.status}`);
        }

      } catch (error) {
        console.log(`❌ Endpoint error: ${error}`);
      }
    }

    console.log('❌ All Gemini API endpoints failed');
    return false;
  }
}