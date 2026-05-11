const { EnhancedEvaluator, EVAL_CONFIG } = require('./enhanced-evaluator');

console.log('='.repeat(80));
console.log('🧪 UNIT TEST: Enhanced Evaluator');
console.log('='.repeat(80));
console.log('');

const evaluator = new EnhancedEvaluator();
const testResults = [];

function test(name, fn) {
    console.log(`📋 Test: ${name}`);
    try {
        fn();
        console.log(`✅ PASS: ${name}`);
        testResults.push({ name, status: 'PASS' });
    } catch (error) {
        console.log(`❌ FAIL: ${name}`);
        console.log(`   Error: ${error.message}`);
        testResults.push({ name, status: 'FAIL', error: error.message });
    }
    console.log('');
}

function assert(condition, message) {
    if (!condition) {
        throw new Error(message);
    }
}

// Test Cases
console.log('📝 Test Case 1: Perfect Response (Sempurna)');
console.log('-'.repeat(80));
test('Sempurna - Jawaban sama persis dengan referensi', () => {
    const result = evaluator.evaluate(
        'Apa ibukota Indonesia?',
        'Ibukota Indonesia adalah Jakarta.',
        'Ibukota Indonesia adalah Jakarta.',
        'Test Sempurna'
    );
    assert(result.totalScore >= 0.9, `Skor terlalu rendah: ${result.totalScore}`);
    assert(result.success === true, 'Seharusnya sukses');
    assert(result.hasHallucination === false, 'Tidak boleh ada halusinasi');
    console.log(`   Skor: ${result.totalScore}`);
    console.log(`   Penjelasan: ${result.explanation}`);
});

console.log('📝 Test Case 2: Good Response (Baik)');
console.log('-'.repeat(80));
test('Baik - Jawaban hampir sama, sedikit berbeda', () => {
    const result = evaluator.evaluate(
        'Apa ibukota Indonesia?',
        'Ibukota Indonesia adalah Jakarta.',
        'Jakarta adalah ibukota negara Indonesia.',
        'Test Baik'
    );
    assert(result.totalScore >= 0.7, `Skor terlalu rendah: ${result.totalScore}`);
    assert(result.success === true, 'Seharusnya sukses');
    console.log(`   Skor: ${result.totalScore}`);
    console.log(`   Penjelasan: ${result.explanation}`);
});

console.log('📝 Test Case 3: Hallucination Detection');
console.log('-'.repeat(80));
test('Deteksi Halusinasi - Jawaban menambah info tidak ada', () => {
    const result = evaluator.evaluate(
        'Apa ibukota Indonesia?',
        'Ibukota Indonesia adalah Jakarta.',
        'Ibukota Indonesia adalah Jakarta, yang terletak di Pulau Jawa dan memiliki populasi 10 juta jiwa.',
        'Test Hallucination'
    );
    assert(result.hasHallucination === true, 'Seharusnya terdeteksi halusinasi');
    assert(result.hallucinations.length > 0, 'Harus memiliki daftar halusinasi');
    console.log(`   Skor: ${result.totalScore}`);
    console.log(`   Halusinasi terdeteksi: ${result.hallucinations.join(', ')}`);
    console.log(`   Penjelasan: ${result.explanation}`);
});

console.log('📝 Test Case 4: Wrong Answer');
console.log('-'.repeat(80));
test('Jawaban Salah - Jawaban berbeda total', () => {
    const result = evaluator.evaluate(
        'Apa ibukota Indonesia?',
        'Ibukota Indonesia adalah Jakarta.',
        'Ibukota Indonesia adalah Bandung.',
        'Test Jawaban Salah'
    );
    assert(result.totalScore < 0.7, `Skor terlalu tinggi: ${result.totalScore}`);
    assert(result.success === false, 'Seharusnya gagal');
    console.log(`   Skor: ${result.totalScore}`);
    console.log(`   Penjelasan: ${result.explanation}`);
});

console.log('📝 Test Case 5: No Response');
console.log('-'.repeat(80));
test('Tidak Ada Respons', () => {
    const result = evaluator.evaluate(
        'Apa ibukota Indonesia?',
        'Ibukota Indonesia adalah Jakarta.',
        '',
        'Test No Response'
    );
    assert(result.totalScore === 0, `Skor harus 0: ${result.totalScore}`);
    assert(result.success === false, 'Seharusnya gagal');
    console.log(`   Skor: ${result.totalScore}`);
    console.log(`   Penjelasan: ${result.explanation}`);
});

console.log('📝 Test Case 6: Relevance Check');
console.log('-'.repeat(80));
test('Relevansi - Jawaban tidak menjawab pertanyaan', () => {
    const result = evaluator.evaluate(
        'Apa ibukota Indonesia?',
        'Ibukota Indonesia adalah Jakarta.',
        'Indonesia adalah negara di Asia Tenggara.',
        'Test Relevansi'
    );
    assert(result.breakdown.relevance.score < 0.7, `Skor relevansi terlalu tinggi: ${result.breakdown.relevance.score}`);
    console.log(`   Skor Total: ${result.totalScore}`);
    console.log(`   Skor Relevansi: ${result.breakdown.relevance.score}`);
    console.log(`   Penjelasan: ${result.explanation}`);
});

console.log('📝 Test Case 7: Completeness Check');
console.log('-'.repeat(80));
test('Kelengkapan - Jawaban sebagian', () => {
    const result = evaluator.evaluate(
        'Sebutkan 3 warna primer?',
        'Warna primer adalah merah, biru, dan kuning.',
        'Warna primer adalah merah dan biru.',
        'Test Kelengkapan'
    );
    assert(result.breakdown.completeness.score < 0.8, `Skor kelengkapan terlalu tinggi: ${result.breakdown.completeness.score}`);
    console.log(`   Skor Total: ${result.totalScore}`);
    console.log(`   Skor Kelengkapan: ${result.breakdown.completeness.score}`);
    console.log(`   Penjelasan: ${result.explanation}`);
});

console.log('📝 Test Case 8: Factual Accuracy Check');
console.log('-'.repeat(80));
test('Akurasi Faktual - Angka salah', () => {
    const result = evaluator.evaluate(
        'Berapa umur Bumi?',
        'Umur Bumi sekitar 4.5 milyar tahun.',
        'Umur Bumi sekitar 10 milyar tahun.',
        'Test Akurasi Faktual'
    );
    assert(result.breakdown.factualAccuracy.score < 0.6, `Skor akurasi terlalu tinggi: ${result.breakdown.factualAccuracy.score}`);
    console.log(`   Skor Total: ${result.totalScore}`);
    console.log(`   Skor Akurasi Faktual: ${result.breakdown.factualAccuracy.score}`);
    console.log(`   Penjelasan: ${result.explanation}`);
});

console.log('📝 Test Case 9: Custom Threshold');
console.log('-'.repeat(80));
test('Threshold Kustom - Ubah threshold menjadi 0.8', () => {
    const customEvaluator = new EnhancedEvaluator({ 
        thresholds: { ...EVAL_CONFIG.thresholds, good: 0.8 } 
    });
    const result = customEvaluator.evaluate(
        'Apa ibukota Indonesia?',
        'Ibukota Indonesia adalah Jakarta.',
        'Jakarta adalah ibukota Indonesia.',
        'Test Custom Threshold'
    );
    assert(customEvaluator.config.thresholds.good === 0.8, 'Threshold harus 0.8');
    console.log(`   Threshold: ${customEvaluator.config.thresholds.good}`);
    console.log(`   Skor: ${result.totalScore}`);
    console.log(`   Sukses: ${result.success}`);
});

console.log('📝 Test Case 10: Breakdown Analysis');
console.log('-'.repeat(80));
test('Analisis Breakdown - Semua komponen skor harus ada', () => {
    const result = evaluator.evaluate(
        'Test question',
        'Test expected',
        'Test actual',
        'Test Breakdown'
    );
    assert(result.breakdown.factualAccuracy !== undefined, 'Harus ada factualAccuracy');
    assert(result.breakdown.relevance !== undefined, 'Harus ada relevance');
    assert(result.breakdown.completeness !== undefined, 'Harus ada completeness');
    assert(result.breakdown.hallucination !== undefined, 'Harus ada hallucination');
    console.log('   ✓ Semua komponen breakdown ada');
    console.log(`   Factual: ${result.breakdown.factualAccuracy.score}`);
    console.log(`   Relevance: ${result.breakdown.relevance.score}`);
    console.log(`   Completeness: ${result.breakdown.completeness.score}`);
    console.log(`   Hallucination: ${result.breakdown.hallucination.score}`);
});

// Summary
console.log('\n' + '='.repeat(80));
console.log('📊 TEST SUMMARY');
console.log('='.repeat(80));
const passCount = testResults.filter(t => t.status === 'PASS').length;
const failCount = testResults.filter(t => t.status === 'FAIL').length;
console.log(`Total Tests: ${testResults.length}`);
console.log(`✅ PASS: ${passCount}`);
console.log(`❌ FAIL: ${failCount}`);
console.log('');

if (failCount > 0) {
    console.log('❌ Gagal pada test berikut:');
    testResults.filter(t => t.status === 'FAIL').forEach(t => {
        console.log(`   - ${t.name}: ${t.error}`);
    });
    process.exit(1);
} else {
    console.log('🎉 SEMUA TEST BERHASIL!');
    process.exit(0);
}
