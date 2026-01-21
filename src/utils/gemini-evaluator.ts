import * as dotenv from 'dotenv';

dotenv.config();

export interface EvaluationResult {
  score: number;
  explanation: string;
  success: boolean;
}

export class GeminiEvaluator {
  private apiKey: string;
  private baseUrl: string = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent';

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
    // Commented out to allow testing with specific API key
    // if (this.apiKey === 'AIzaSyBr00LZZfAvgiBe4DFHGhRtGQIc4NPb4p0') {
    //   console.log('⚠️ Using default/demo API key, skipping Gemini evaluation');
    //   return this.simpleTextEvaluation(expectedAnswer, actualAnswer, 'Demo API key - Gemini evaluation disabled');
    // }

    try {
      console.log('🤖 Calling Gemini API for evaluation...');
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
            maxOutputTokens: 2048,  // Increased from 1000 to prevent truncation
          }
        })
      });

      if (!response.ok) {
        const errorData: any = await response.json();
        console.error('❌ Gemini API Error:', response.status, JSON.stringify(errorData));
        throw new Error(`Gemini API error: ${response.status} ${response.statusText} - ${errorData.error?.message || 'Unknown error'}`);
      }

      const data: any = await response.json();

      if (data.candidates && data.candidates[0] && data.candidates[0].content) {
        const evaluationText = data.candidates[0].content.parts[0].text;
        console.log('✅ Gemini evaluation successful');
        return this.parseEvaluationResult(evaluationText);
      } else {
        throw new Error('Invalid response format from Gemini API');
      }

    } catch (error) {
      console.error('⚠️ Gemini evaluation failed, using fallback:', error instanceof Error ? error.message : error);
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
    return `Anda adalah QA Engineer Senior dan Linguist Specialist. Tugas Anda adalah mengevaluasi kualitas jawaban Chatbot dengan metodologi "Chain of Thought".

KONTEKS PENGUJIAN:
- Topik: ${title}
- Pertanyaan User: "${question}"
- Referensi Kebenaran (Knowledge Base): "${expectedAnswer}"
- Jawaban Chatbot (Yang dievaluasi): "${actualAnswer}"

INSTRUKSI EVALUASI:
Lakukan analisa langkah demi langkah sebelum memberikan skor akhir. WAJIB JELASKAN SEMUA LANGKAH:

LANGKAH 1: ANALISA KEBENARAN FAKTUAL (Bobot Tertinggi)
- Bandingkan fakta di "Jawaban Chatbot" dengan "Referensi Kebenaran".
- Apakah ada angka, nama, atau prosedur yang salah?
- Jika Referensi Kebenaran bilang "A", tapi Chatbot bilang "B", ini FATAL.
- PENTING: Sebutkan secara spesifik fakta mana yang benar/salah!

LANGKAH 2: ANALISA RELEVANSI & KONTEKS
- Apakah Chatbot menjawab pertanyaan user secara langsung?
- Apakah ada informasi berlebih (hallucination) yang tidak diminta dan berpotensi salah?
- PENTING: Sebutkan apakah jawaban sudah menjawab inti pertanyaan!

LANGKAH 3: ANALISA GAYA BAHASA & EMPATI
- Apakah bahasanya natural dan sopan?
- Apakah formatnya mudah dibaca (tidak berantakan)?

ATURAN SCORING:
- 1.00 (Sempurna): Faktual 100% benar, lengkap, relevan, bahasa bagus.
- 0.70 - 0.99 (Pass): Faktual benar, mungkin ada kekurangan minor di gaya bahasa atau kelengkapan detail non-krusial.
- 0.40 - 0.69 (Fail - Minor): Ada info yang kurang tepat tapi tidak fatal, atau bahasa sangat kaku/berulang.
- 0.00 - 0.39 (Fail - Major): Halusinasi (mengarang fakta), salah total, atau tidak nyambung.

FORMAT EXPLANATION YANG DIHARAPKAN:
Gunakan format bullet point dengan detail JELAS per langkah:

• Langkah 1 (Faktual): [Sebutkan fakta apa yang benar/salah/kurang]
• Langkah 2 (Relevansi): [Apakah menjawab pertanyaan atau tidak]
• Langkah 3 (Bahasa): [Komentar tentang gaya bahasa]
• Simpulan: [Kesimpulan final]

OUTPUT FINAL:
Berikan output HANYA dalam format JSON valid tanpa markdown block:
{
  "score": [angka desimal 0.00 - 1.00],
  "explanation": "[Status: ✓/⚠/✗] + Detail analisa menggunakan format bullet point di atas. Maksimal 500 karakter."
}`;
  }

  private parseEvaluationResult(evaluationText: string): EvaluationResult {
    try {
      // Clean the response text
      let cleanText = evaluationText.trim();

      // Remove markdown code blocks if present
      cleanText = cleanText.replace(/```json\n?/g, '').replace(/```\n?/g, '');

      // Extract score using regex (more reliable than parsing full JSON with multiline strings)
      const scoreMatch = cleanText.match(/"score"\s*:\s*([0-9.]+)/);
      let score = scoreMatch ? parseFloat(scoreMatch[1]) : 0.75;

      // Convert if score is in 0-100 range (old format)
      if (score > 1.0) {
        score = score / 100.0;
      }

      // Ensure score is within valid range 0.0-1.0
      score = Math.max(0.0, Math.min(1.0, parseFloat(score.toFixed(3))));

      // Extract explanation - handle multiline strings  
      // Strategy: Match from "explanation": " until the closing "}
      let explanation = '';
      console.log('📝 Parsing Gemini response...');

      // Match everything between "explanation": " and the last "
      const explMatch = cleanText.match(/"explanation"\s*:\s*"([\s\S]*?)"\s*}/);

      if (explMatch) {
        explanation = explMatch[1]
          .replace(/\\n/g, ' ')           // Replace escaped newlines
          .replace(/\n/g, ' ')            // Replace actual newlines
          .replace(/\r/g, '')             // Remove carriage returns
          .replace(/\t/g, ' ')            // Replace tabs
          .replace(/\s+/g, ' ')           // Normalize multiple spaces
          .trim();
      } else {
        // Fallback: try to extract any text after "explanation":
        const fallbackMatch = cleanText.match(/"explanation"\s*:\s*"([^}]+)/s);
        if (fallbackMatch) {
          explanation = fallbackMatch[1]
            .replace(/"/g, '')
            .replace(/\n/g, ' ')
            .replace(/\r/g, '')
            .replace(/\s+/g, ' ')
            .trim()
            .substring(0, 500);
        } else {
          explanation = 'Evaluasi berhasil namun format tidak standar';
        }
      }

      // Limit explanation length
      explanation = explanation.length > 500
        ? explanation.substring(0, 497) + '...'
        : explanation;

      // Add prefix if not already present
      if (!explanation.startsWith('AI:') && !explanation.startsWith('✓') && !explanation.startsWith('✗') && !explanation.startsWith('⚠')) {
        explanation = `AI: ${explanation}`;
      }

      return {
        score,
        explanation,
        success: true
      };

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