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
    // Simple text-based evaluation when AI is not available
    
    // Check if actual answer is empty or error
    if (!actualAnswer || actualAnswer.trim() === '' || 
        actualAnswer.includes('Error:') || 
        actualAnswer.includes('Tidak ada balasan') ||
        actualAnswer.includes('tidak ada pesan')) {
      return {
        score: 0,
        explanation: `No response from bot (${reason})`,
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

    // Extract keywords from expected answer (words longer than 3 characters)
    const expectedWords = normalizedExpected.split(' ').filter(w => w.length > 3);
    const actualWords = normalizedActual.split(' ');

    // Count matching keywords
    let matchCount = 0;
    for (const word of expectedWords) {
      if (actualWords.some(aw => aw.includes(word) || word.includes(aw))) {
        matchCount++;
      }
    }

    // Calculate similarity percentage
    const similarity = expectedWords.length > 0 
      ? (matchCount / expectedWords.length) * 100 
      : 0;

    // Determine score based on similarity
    let score = 0;
    let explanation = '';

    if (similarity >= 70) {
      score = Math.round(70 + (similarity - 70) * 0.5); // 70-85 range
      explanation = `High similarity (${Math.round(similarity)}% keywords match) - ${reason}`;
    } else if (similarity >= 40) {
      score = Math.round(50 + (similarity - 40)); // 50-70 range
      explanation = `Moderate similarity (${Math.round(similarity)}% keywords match) - ${reason}`;
    } else if (similarity >= 20) {
      score = Math.round(30 + similarity); // 30-50 range
      explanation = `Low similarity (${Math.round(similarity)}% keywords match) - ${reason}`;
    } else {
      score = Math.round(similarity * 1.5); // 0-30 range
      explanation = `Very low similarity (${Math.round(similarity)}% keywords match) - ${reason}`;
    }

    return {
      score: Math.max(0, Math.min(100, score)),
      explanation: `Auto-evaluated: ${explanation}`,
      success: false
    };
  }

  private createEvaluationPrompt(
    question: string,
    expectedAnswer: string,
    actualAnswer: string,
    title: string
  ): string {
    return `Sebagai AI evaluator untuk chatbot testing, evaluasi kualitas jawaban chatbot berikut:

TOPIK: ${title}
PERTANYAAN: ${question}

JAWABAN YANG DIHARAPKAN:
${expectedAnswer}

JAWABAN AKTUAL DARI BOT:
${actualAnswer}

Tugas Anda:
1. Bandingkan jawaban aktual dengan jawaban yang diharapkan
2. Evaluasi berdasarkan kriteria:
   - Akurasi informasi (40%)
   - Relevansi dengan pertanyaan (30%)
   - Kelengkapan jawaban (20%)
   - Kejelasan dan struktur (10%)

3. Berikan output dalam format JSON yang tepat:
{
  "score": [angka 0-100],
  "explanation": "[penjelasan detail dalam bahasa Indonesia mengapa mendapat score tersebut, maksimal 200 karakter]"
}

Pastikan output hanya berupa JSON yang valid tanpa teks tambahan.`;
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
        // Ensure score is within valid range
        const score = Math.max(0, Math.min(100, Math.round(result.score)));
        
        // Limit explanation length
        const explanation = result.explanation.length > 200 
          ? result.explanation.substring(0, 197) + '...'
          : result.explanation;

        return {
          score,
          explanation: `AI-evaluated: ${explanation}`,
          success: true
        };
      } else {
        throw new Error('Invalid JSON structure');
      }

    } catch (error) {
      console.error('Error parsing Gemini evaluation result:', error);
      console.error('Raw response:', evaluationText);
      
      // Fallback: try to extract score from text
      const scoreMatch = evaluationText.match(/score["\s:]*(\d+)/i);
      const score = scoreMatch ? parseInt(scoreMatch[1]) : 75;
      
      return {
        score: Math.max(0, Math.min(100, score)),
        explanation: 'AI-evaluated: Evaluasi berhasil namun format response tidak standar',
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