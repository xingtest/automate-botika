const fuzz = require('fuzzball');

const EVAL_CONFIG = {
  thresholds: {
    excellent: 0.90,
    good: 0.70,
    fair: 0.60,
    poor: 0.40,
    bad: 0.20
  },
  scoreWeights: {
    factualAccuracy: 0.40,
    relevance: 0.25,
    completeness: 0.20,
    hallucinationPenalty: 0.15
  },
  tolerance: {
    minorDeviation: 0.85,
    acceptableDeviation: 0.70
  }
};

class EnhancedEvaluator {
  constructor(config = {}) {
    this.config = { ...EVAL_CONFIG, ...config };
  }

  log(level, message, data = null) {
    const timestamp = new Date().toISOString();
    const logData = data ? ` | Data: ${JSON.stringify(data)}` : '';
    console.log(`[${timestamp}] [${level.toUpperCase()}] ${message}${logData}`);
  }

  normalizeText(text) {
    if (!text) return '';
    return text.toLowerCase()
      .replace(/[^\w\s]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  extractKeywords(text, minLength = 3) {
    const words = this.normalizeText(text).split(/\s+/);
    const stopwords = [
      // Indonesian
      'dan', 'atau', 'yang', 'dengan', 'untuk', 'dari', 'pada', 'di', 'ke', 'ini', 'itu', 'apa', 'bagaimana', 'mengapa',
      'adalah', 'yaitu', 'yakni', 'merupakan', 'dalam', 'serta', 'sebagai', 'oleh', 'bagi', 'akan', 'telah', 'sudah',
      'dapat', 'bisa', 'boleh', 'harus', 'saya', 'kami', 'anda', 'mereka', 'dia', 'ia', 'kita', 'halo', 'hi', 'selamat',
      'pagi', 'siang', 'sore', 'malam', 'terima', 'kasih', 'sama', 'kembali', 'mohon', 'maaf', 'tolong', 'silakan',
      'baik', 'oke', 'ok', 'ya', 'tidak', 'bukan', 'mungkin', 'saja', 'hanya', 'juga', 'pun', 'ada', 'adalah',
      // English
      'the', 'and', 'or', 'is', 'are', 'was', 'were', 'for', 'to', 'from', 'in', 'on', 'at', 'this', 'that', 'with',
      'by', 'as', 'be', 'been', 'being', 'have', 'has', 'had', 'do', 'does', 'did', 'but', 'if', 'then', 'else',
      'which', 'who', 'whom', 'whose', 'what', 'where', 'when', 'how', 'why', 'can', 'could', 'should', 'would',
      'must', 'may', 'might', 'shall', 'will'
    ];
    return words.filter(word => word.length >= minLength && !stopwords.includes(word));
  }

  evaluateFactualAccuracy(expected, actual) {
    this.log('info', 'Evaluating Factual Accuracy...');
    
    const normalizedExpected = this.normalizeText(expected);
    const normalizedActual = this.normalizeText(actual);
    
    if (!normalizedExpected || !normalizedActual) {
      return { score: 0, explanation: 'Data tidak lengkap untuk evaluasi' };
    }

    const expectedKeywords = this.extractKeywords(expected);
    const actualKeywords = this.extractKeywords(actual);
    
    let matchedCount = 0;
    const matchedKeywords = [];
    const missingKeywords = [];
    
    expectedKeywords.forEach(keyword => {
      const found = actualKeywords.some(ak => fuzz.ratio(keyword, ak) >= 85);
      if (found) {
        matchedCount++;
        matchedKeywords.push(keyword);
      } else {
        missingKeywords.push(keyword);
      }
    });

    const keywordScore = expectedKeywords.length > 0 ? matchedCount / expectedKeywords.length : 0;
    const textSimilarity = fuzz.token_set_ratio(normalizedExpected, normalizedActual) / 100;
    
    const finalScore = (keywordScore * 0.6) + (textSimilarity * 0.4);

    this.log('info', 'Factual Accuracy complete', {
      expectedKeywords: expectedKeywords.length,
      matchedCount,
      keywordScore: keywordScore.toFixed(2),
      textSimilarity: textSimilarity.toFixed(2),
      finalScore: finalScore.toFixed(2)
    });

    return {
      score: parseFloat(finalScore.toFixed(3)),
      explanation: `Akurasi fakta: ${(finalScore * 100).toFixed(0)}%. Kata kunci cocok: ${matchedCount}/${expectedKeywords.length}`,
      matchedKeywords,
      missingKeywords
    };
  }

  evaluateRelevance(question, actual) {
    this.log('info', 'Evaluating Relevance...');
    
    const normalizedQuestion = this.normalizeText(question);
    const normalizedActual = this.normalizeText(actual);
    
    if (!normalizedQuestion || !normalizedActual) {
      return { score: 0, explanation: 'Data tidak lengkap untuk evaluasi relevansi' };
    }

    const questionKeywords = this.extractKeywords(question);
    const actualKeywords = this.extractKeywords(actual);
    
    let relevantCount = 0;
    questionKeywords.forEach(keyword => {
      const found = actualKeywords.some(ak => fuzz.partial_ratio(keyword, ak) >= 70);
      if (found) relevantCount++;
    });

    const relevanceScore = questionKeywords.length > 0 ? relevantCount / questionKeywords.length : 0;
    const directnessScore = normalizedActual.length > 5 ? Math.min(1, normalizedActual.length / 500) : 0;
    
    const finalScore = (relevanceScore * 0.8) + (directnessScore * 0.2);

    this.log('info', 'Relevance evaluation complete', {
      questionKeywords: questionKeywords.length,
      relevantCount,
      relevanceScore: relevanceScore.toFixed(2),
      finalScore: finalScore.toFixed(2)
    });

    return {
      score: parseFloat(finalScore.toFixed(3)),
      explanation: `Relevansi: ${(finalScore * 100).toFixed(0)}%. Jawaban ${finalScore >= 0.6 ? 'sesuai' : 'kurang sesuai'} dengan pertanyaan.`
    };
  }

  evaluateCompleteness(expected, actual) {
    this.log('info', 'Evaluating Completeness...');
    
    const normalizedExpected = this.normalizeText(expected);
    const normalizedActual = this.normalizeText(actual);
    
    if (!normalizedExpected) {
      return { score: 1, explanation: 'Tidak ada referensi untuk evaluasi kelengkapan' };
    }

    const expectedSentences = normalizedExpected.split(/[.!?]+/).filter(s => s.trim().length > 5);
    const actualSentences = normalizedActual.split(/[.!?]+/).filter(s => s.trim().length > 5);
    
    let coveredSentences = 0;
    expectedSentences.forEach(expSentence => {
      const expKeywords = this.extractKeywords(expSentence);
      if (expKeywords.length > 0) {
        const matched = expKeywords.some(ek => 
          actualSentences.some(actSent => fuzz.partial_ratio(ek, actSent) >= 80)
        );
        if (matched) coveredSentences++;
      }
    });

    const completenessScore = expectedSentences.length > 0 ? coveredSentences / expectedSentences.length : 1;

    this.log('info', 'Completeness evaluation complete', {
      expectedSentences: expectedSentences.length,
      coveredSentences,
      completenessScore: completenessScore.toFixed(2)
    });

    return {
      score: parseFloat(completenessScore.toFixed(3)),
      explanation: `Kelengkapan: ${(completenessScore * 100).toFixed(0)}%. ${coveredSentences}/${expectedSentences.length} poin referensi tercakup.`
    };
  }

  detectHallucination(expected, actual) {
    this.log('info', 'Detecting Hallucinations...');
    
    const normalizedExpected = this.normalizeText(expected);
    const normalizedActual = this.normalizeText(actual);
    
    if (!normalizedActual) {
      return { score: 0, explanation: 'Tidak ada respons untuk diperiksa', hallucinations: [] };
    }

    const actualKeywords = this.extractKeywords(actual);
    const expectedKeywords = this.extractKeywords(expected);
    
    // Check for numbers - they are critical for hallucinations
    const extractNumbers = (t) => (t.match(/\d+/g) || []);
    const expectedNumbers = extractNumbers(expected);
    const actualNumbers = extractNumbers(actual);
    
    const hallucinations = [];
    const criticalHallucinations = [];

    // 1. Check Keywords
    actualKeywords.forEach(ak => {
      const found = expectedKeywords.some(ek => fuzz.ratio(ak, ek) >= 80);
      if (!found) {
        // If it's a very short word or common word, maybe not a hallucination
        // But our extractKeywords already filters many.
        hallucinations.push(ak);
      }
    });

    // 2. Check Numbers (Critical)
    actualNumbers.forEach(num => {
      if (!expectedNumbers.includes(num)) {
        criticalHallucinations.push(`Angka "${num}" tidak ada di referensi`);
      }
    });

    const totalKeywords = actualKeywords.length;
    const hallucinationRatio = totalKeywords > 0 ? hallucinations.length / totalKeywords : 0;
    
    // Penalize more heavily if critical hallucinations found
    let penaltyScore = Math.max(0, 1 - (hallucinationRatio * 1.5));
    if (criticalHallucinations.length > 0) {
      penaltyScore *= 0.5; // Cut score in half if numbers are wrong
    }

    this.log('info', 'Hallucination detection complete', {
      actualKeywords: totalKeywords,
      hallucinationCount: hallucinations.length,
      criticalCount: criticalHallucinations.length,
      penaltyScore: penaltyScore.toFixed(2)
    });

    let explanation = '✓ Tidak terdeteksi halusinasi.';
    if (criticalHallucinations.length > 0 || hallucinations.length > 0) {
      explanation = `⚠️ Potensi halusinasi: ${[...criticalHallucinations, ...hallucinations.slice(0, 3)].join(', ')}`;
    }

    return {
      score: parseFloat(penaltyScore.toFixed(3)),
      explanation: explanation,
      hallucinations: [...criticalHallucinations, ...hallucinations],
      hasHallucination: criticalHallucinations.length > 0 || hallucinationRatio > 0.3
    };
  }

  evaluate(question, expected, actual, title = 'Evaluation') {
    this.log('info', 'Starting enhanced evaluation', { title, hasQuestion: !!question, hasExpected: !!expected, hasActual: !!actual });

    if (!actual || actual.trim() === '' || actual.includes('Error:')) {
      this.log('warn', 'No valid actual response');
      return {
        totalScore: 0,
        success: false,
        explanation: '✗ Tidak ada respons yang valid dari bot.',
        breakdown: {},
        hallucinations: []
      };
    }

    const factualResult = this.evaluateFactualAccuracy(expected, actual);
    const relevanceResult = this.evaluateRelevance(question, actual);
    const completenessResult = this.evaluateCompleteness(expected, actual);
    const hallucinationResult = this.detectHallucination(expected, actual);

    const totalScore = (
      (factualResult.score * this.config.scoreWeights.factualAccuracy) +
      (relevanceResult.score * this.config.scoreWeights.relevance) +
      (completenessResult.score * this.config.scoreWeights.completeness) +
      (hallucinationResult.score * this.config.scoreWeights.hallucinationPenalty)
    );

    const success = totalScore >= this.config.thresholds.good;

    const explanationParts = [
      factualResult.explanation,
      relevanceResult.explanation,
      completenessResult.explanation,
      hallucinationResult.explanation
    ];

    const finalExplanation = `${success ? '✓' : '✗'} ${explanationParts.filter(e => e).join(' | ')}`;

    this.log('info', 'Evaluation complete', {
      totalScore: totalScore.toFixed(3),
      success,
      weights: this.config.scoreWeights,
      thresholds: { good: this.config.thresholds.good }
    });

    return {
      totalScore: parseFloat(totalScore.toFixed(3)),
      success,
      explanation: finalExplanation,
      breakdown: {
        factualAccuracy: factualResult,
        relevance: relevanceResult,
        completeness: completenessResult,
        hallucination: hallucinationResult
      },
      hallucinations: hallucinationResult.hallucinations,
      hasHallucination: hallucinationResult.hasHallucination
    };
  }
}

module.exports = { EnhancedEvaluator, EVAL_CONFIG };
