import requests
import re   
import json
import time
import os

api_key_openruter = os.getenv("API_KEY_OPENROUTER")

def prompt_evaluator():
    PROMPT_TEMPLATE = """
        Kamu adalah evaluator. Berikan skor dari 0 sampai 1 seberapa sesuai jawaban berikut dengan harapan.

        Expected Output:
        {expected_output}

        Actual Output:
        {actual_output}

        Tugas kamu adalah memberikan skor evaluasi antara 0 sampai 1 berdasarkan kesesuaian dan relevansi antara actual output dengan expected output.

        Ikuti aturan berikut secara ketat:
        1. Skor harus berada dalam rentang [0.0, 1.0].
        2. Jika actual output tidak relevan atau sangat berbeda konteks dari expected output, berikan skor 0.0 hingga 0.45 karena perbedaan makna utama.
        3. Jika actual output relevan sebagian tetapi tidak lengkap, berikan skor antara 0.5 hingga 0.95 tergantung seberapa besar bagian informasi penting yang hilang atau kurang akurat.
        4. Jika actual output sangat lengkap, mencakup semua poin penting expected output, berikan skor 1.0 tanpa ragu.
        5. Evaluasi harus berdasarkan kelengkapan makna, akurasi istilah, penyebutan elemen penting (seperti nama produk), serta cakupan isi dari actual output terhadap expected output.
        - Jika actual output menyampaikan semua poin utama expected meskipun dengan gaya atau format berbeda tetap dianggap sesuai dan skor tinggi.
        - Tambahan informasi yang relevan dalam actual output tidak menurunkan skor, tapi informasi tambahan yang mengaburkan atau salah harus menurunkan skor.
        6. Untuk data expected dan actual output yang identik atau sangat mirip, skor evaluasi harus selalu konsisten jika evaluasi diulang.
        7. Penjelasan hasil evaluasi wajib mencantumkan minimal 1 kalimat jelas yang menyebutkan perbedaan atau kesalahan utama secara spesifik (contoh: “Nama produk salah, expected adalah BRINS ASRI tetapi yang disebut BRINS DIRI, sehingga makna utama berubah” atau “Output kurang menyebutkan jenis produk yang diminta” atau “Informasi tambahan tapi relevan tetap dapat diterima”) dan bisa ditambah kalimat kedua untuk memperjelas konteks perbedaan jika diperlukan.

        Format keluaran wajib dan tidak boleh diubah:
        Skor: X.XX  
        Penjelasan: [Penjelasan detail sesuai perbedaan dan kelengkapan informasi].

        Jangan menambahkan apapun di luar format tersebut, hasil harus tegas, konsisten, dan menjelaskan alasan penilaian secara cukup jelas agar mudah dipahami.
        """
    return PROMPT_TEMPLATE


def hit_llm_to_scoring(response_bot, respond_text):

    AI = "OPENROUTER AI"
    prompt = prompt_evaluator().format(
        expected_output=respond_text,
        actual_output=response_bot
    )

    url = "https://openrouter.ai/api/v1/chat/completions"
    headers = {
        "Authorization": "Bearer " + api_key_openruter,
        "Content-Type": "application/json"
    }
    data = {
        "model": "deepseek/deepseek-prover-v2:free",
        "temperature": 0,
        "top_p":0.5,
        "messages": [
            {"role": "system", "content": "Kamu adalah evaluator yang teliti dan konsisten. Tugasmu adalah memberikan skor antara 0.0 hingga 1.0 berdasarkan relevansi dan kelengkapan output terhadap ekspektasi. Format jawabanmu: Skor: X.XX"},
            {"role": "user", "content": prompt}
        ]
    }


    score = 0.0
    explanation = "Terjadi kesalahan saat memproses output."

    try:

        result = requests.post(url, headers=headers, data=json.dumps(data))
        result_json = result.json()
        output = result_json["choices"][0]["message"]["content"]

        match = re.search(r"Skor[:\s]+([0-1](\.\d+)?)", output)
        score = float(match.group(1)) if match else 0.0

        # Ambil penjelasan
        match_exp = re.search(r"Penjelasan[:\s]+(.+)", output)
        explanation = match_exp.group(1).strip() if match_exp else "Tidak ditemukan penjelasan."
    
    except Exception as e:
        output = f"ERROR: {str(e)}"
        score = 0.0

    # print("OPENROUTER AI")
    # print("Score:", score)
    # print("LLM Output:", output)
    # print("Explanation:", explanation)

    return score, output, explanation, AI

def hit_llm_to_scoring_gemini(response_bot, respond_text):
    api_key_gemini = os.getenv("API_KEY_GEMINI")

    # response_bot = "Jenis asuransi ini memberikan perlindungan finansial terhadap risiko kehidupan dan kematian pemegang polis. Karakteristik utama asuransi jiwa adalah pemberian manfaat berupa uang pertanggungan kepada ahli waris jika pemegang polis berpulang. Apabila pemegang polis masih hidup dalam jangka waktu yang ditentukan, mereka akan mendapatkan manfaat dalam bentuk nilai tunai.Manfaat dan perlindungan yang diberikan asuransi jiwa berupa uang pertanggungan yang bisa digunakan untuk memenuhi kebutuhan sehari-hari.	"
    # respond_text = "Asuransi jiwa adalah jenis asuransi yang memberikan perlindungan finansial terhadap risiko kehidupan dan kematian pemegang polis.Jika pemegang polis berpulang, ahli waris akan menerima uang pertanggungan.Kalau pemegang polis masih hidup dalam jangka waktu yang ditentukan, mereka bisa mendapatkan manfaat dalam bentuk nilai tunai.Jadi, asuransi jiwa membantu memenuhi kebutuhan sehari-hari keluarga yang ditinggalkan. Ada lagi yang ingin Anda tahu?	"

    AI = "GEMINI AI"
    prompt = prompt_evaluator().format(
        expected_output=respond_text,
        actual_output=response_bot
    )
    
    url = "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-lite-preview-06-17:generateContent?key=" + api_key_gemini
    headers = {
        "Content-Type": "application/json"
    }
    data = {
        "contents": [
            {
                "role": "model",
                "parts": [
                    { 
                        "text": "Kamu adalah evaluator. Berikan skor dari 0 sampai 1 seberapa sesuai jawaban berikut dengan harapan"
                    }
                ]
            },
            {
                "role": "user",
                "parts": [
                    { 
                        "text": prompt
                    }
                ]
            }
        ],
        "generationConfig": {
            "stopSequences": [
                "Title"
            ],
        "responseMimeType": "application/json",
        "temperature": 0.0,
        "topP": 0.8,
        "topK": 10
        }
    }

    score = 0.0
    explanation = "Terjadi kesalahan saat memproses output."

    try:
        result = requests.post(url, headers=headers, data=json.dumps(data))
        result_json = result.json()
        output = result_json["candidates"][0]["content"]["parts"][0]["text"]

        # Ambil skor
        match = re.search(r'"Skor"\s*:\s*([0-1](?:\.\d+)?)', output, re.DOTALL | re.IGNORECASE)
        score = float(match.group(1)) if match else 0.0

        # Ambil penjelasan
        match_exp = re.search(r'"Penjelasan":\s*"(.+?)"', output, re.DOTALL | re.IGNORECASE)
        explanation = match_exp.group(1).strip() if match_exp else "Tidak ditemukan penjelasan."

    
    except Exception as e:
        output = f"ERROR: {str(e)}"
        score = 0.0

    # print("\n\n")
    # print("GEMINI AI")
    # print("Output All", result_json)
    # print("Score:", score)
    # print("LLM Output:", output)
    # print("Explanation:", explanation)

    return score, output, explanation, AI

# response_bot = "Jenis asuransi ini memberikan perlindungan finansial terhadap risiko kehidupan dan kematian pemegang polis. Karakteristik utama asuransi jiwa adalah pemberian manfaat berupa uang pertanggungan kepada ahli waris jika pemegang polis berpulang. Apabila pemegang polis masih hidup dalam jangka waktu yang ditentukan, mereka akan mendapatkan manfaat dalam bentuk nilai tunai.Manfaat dan perlindungan yang diberikan asuransi jiwa berupa uang pertanggungan yang bisa digunakan untuk memenuhi kebutuhan sehari-hari.	"
# respond_text = "testinng"
# hit_llm_to_scoring_gemini(response_bot, respond_text)
