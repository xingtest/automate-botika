require('dotenv').config();

const apiKey = process.env.API_KEY_GEMINI;
const baseUrl = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent';

const prompt = `Anda adalah QA Engineer Senior dan Linguist Specialist. Tugas Anda adalah mengevaluasi kualitas jawaban Chatbot dengan metodologi "Chain of Thought".

KONTEKS PENGUJIAN:
- Topik: Apa itu asuransi jiwa
- Pertanyaan User: "Apa itu asuransi jiwa"
- Referensi Kebenaran (Knowledge Base): "Jenis asuransi ini memberikan perlindungan finansial terhadap risiko kehidupan dan kematian pemegang polis."
- Jawaban Chatbot (Yang dievaluasi): "Asuransi jiwa adalah jenis asuransi yang memberikan perlindungan finansial terhadap risiko kehidupan dan kematian pemegang polis. Jika pemegang polis berpulang, ahli waris akan menerima uang pertanggungan. Jika pemegang polis masih hidup dalam jangka waktu yang ditentukan, mereka bisa mendapatkan manfaat dalam bentuk nilai tunai. Asuransi jiwa membantu memenuhi kebutuhan sehari-hari bagi keluarga yang ditinggalkan."

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

fetch(`${baseUrl}?key=${apiKey}`, {
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
            maxOutputTokens: 2048,
        }
    })
})
    .then(async response => {
        const data = await response.json();

        if (data.candidates && data.candidates[0] && data.candidates[0].content) {
            const raw = data.candidates[0].content.parts[0].text;
            console.log('=== RAW GEMINI RESPONS E ===');
            console.log(raw);
            console.log('\n=== LENGTH:', raw.length, 'chars ===\n');

            // Test regex extraction
            const cleanText = raw.trim().replace(/```json\n?/g, '').replace(/```\n?/g, '');
            console.log('=== CLEANED TEXT ===');
            console.log(cleanText);

            const explMatch = cleanText.match(/"explanation"\s*:\s*"([\s\S]*?)"\s*}/);
            console.log('\n=== REGEX MATCH RESULT ===');
            if (explMatch) {
                console.log('Match found! Length:', explMatch[1].length);
                console.log('Extracted:', explMatch[1]);
            } else {
                console.log('NO MATCH!');
            }
        }
    })
    .catch(err => console.error('Error:', err));
