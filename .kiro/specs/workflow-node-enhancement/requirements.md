# Requirements Document

## Introduction

Fitur **Workflow Node Enhancement** adalah serangkaian peningkatan pada CI Dashboard Workflow Builder yang bertujuan membawa pengalaman visual dan fungsional mendekati standar n8n. Terdapat tiga area peningkatan utama:

1. **Animasi Eksekusi Node** — Node yang sedang berjalan menampilkan animasi visual (spinning/loading) secara real-time, sehingga pengguna dapat memantau progres eksekusi workflow tanpa harus membaca log.
2. **Implementasi Node yang Benar** — Setiap node executor di backend diimplementasikan dengan logika nyata (bukan mock data), termasuk integrasi ke platform test, AI provider, evaluasi kondisi, dan pengiriman notifikasi.
3. **Detail Node yang Lebih Lengkap** — Panel konfigurasi node diperkaya dengan tooltip, preview output, status badge, execution time, dan pesan error yang informatif.

Semua perubahan dibatasi pada folder `ci-dashboard/`.

---

## Glossary

- **Workflow_Builder**: Komponen frontend visual di `ci-dashboard/workflow-builder/` untuk membuat dan menjalankan workflow.
- **Workflow_Canvas**: Modul `workflow-canvas.js` yang merender node dan koneksi di atas canvas HTML.
- **Execution_Monitor**: Modul `execution-monitor.js` yang melakukan polling status eksekusi dan memperbarui tampilan node.
- **Node_Config_Panel**: Modul `node-config-panel.js` yang menampilkan panel konfigurasi saat node di-double-click.
- **Execution_Engine**: Service backend `execution-engine.js` yang mengorkestrasikan eksekusi workflow secara topologis.
- **Node_Executor**: Kelas di `ci-dashboard/server/services/nodes/` yang mengeksekusi logika satu jenis node.
- **Node_Status**: Status eksekusi sebuah node: `idle`, `running`, `success`, `failed`, `skipped`.
- **Execution_Context**: Objek `execution-context.js` yang menyimpan state, input/output, dan status setiap node selama eksekusi.
- **Platform_Executor**: Modul di `src/platforms/*.ts` yang menjalankan test pada platform chatbot tertentu (webchat, telegram, dll).
- **AI_Provider**: Layanan AI eksternal (Gemini, Groq, Cerebras, OpenAI) yang digunakan oleh `AIEvaluateNode` untuk mengevaluasi respons.
- **Run_Test_Node**: Node executor `run-test-node.js` yang menjalankan test ke platform chatbot.
- **AI_Evaluate_Node**: Node executor `ai-evaluate-node.js` yang memanggil AI provider untuk evaluasi.
- **Condition_Node**: Node executor `condition-node.js` yang mengevaluasi ekspresi dan merutekan ke output `true` atau `false`.
- **Transform_Node**: Node executor `transform-data-node.js` yang mengeksekusi kode JavaScript untuk transformasi data.
- **Wait_Node**: Node executor `wait-node.js` yang menunda eksekusi selama durasi tertentu.
- **Generate_Report_Node**: Node executor `generate-report-node.js` yang membuat laporan test.
- **Send_Notification_Node**: Node executor `send-notification-node.js` yang mengirim notifikasi.
- **Manual_Trigger_Node**: Node executor `manual-trigger-node.js` yang memulai workflow dengan data awal.
- **Output_Preview**: Tampilan data output sebuah node setelah eksekusi berhasil, ditampilkan di panel konfigurasi.
- **Status_Badge**: Indikator visual pada node di canvas yang menunjukkan Node_Status saat ini.
- **Execution_Time_Display**: Tampilan durasi eksekusi sebuah node dalam milidetik atau detik.

---

## Requirements

### Requirement 1: Animasi Running pada Node Aktif

**User Story:** Sebagai pengguna workflow builder, saya ingin melihat animasi visual pada node yang sedang berjalan, sehingga saya dapat memantau progres eksekusi secara real-time tanpa harus membaca log.

#### Acceptance Criteria

1. WHEN eksekusi workflow dimulai dan sebuah node berstatus `running`, THE Workflow_Canvas SHALL menampilkan animasi spinning/pulsing pada node tersebut dalam waktu kurang dari 500ms setelah status berubah.
2. WHEN status node berubah dari `running` ke `success` atau `failed`, THE Workflow_Canvas SHALL menghentikan animasi running dan menampilkan Status_Badge yang sesuai.
3. WHEN beberapa node berjalan secara berurutan, THE Workflow_Canvas SHALL menampilkan animasi hanya pada node yang sedang aktif berstatus `running` pada satu waktu.
4. THE Workflow_Canvas SHALL menampilkan animasi running menggunakan CSS class `status-running` yang diterapkan pada elemen DOM node.
5. WHEN node berstatus `skipped`, THE Workflow_Canvas SHALL menampilkan Status_Badge `skipped` tanpa animasi running.
6. WHEN eksekusi workflow selesai (status `completed` atau `failed`), THE Workflow_Canvas SHALL memastikan tidak ada node yang masih menampilkan animasi running.
7. THE Execution_Monitor SHALL memperbarui status node di canvas setiap kali polling status eksekusi mengembalikan perubahan Node_Status.
8. WHEN Execution_Monitor menerima data `node_results` dari API, THE Execution_Monitor SHALL memanggil `WorkflowCanvas.updateNodeStatus(nodeId, status)` untuk setiap node yang statusnya berubah.

---

### Requirement 2: Status Badge dan Execution Time pada Node

**User Story:** Sebagai pengguna workflow builder, saya ingin melihat status dan waktu eksekusi langsung pada setiap node di canvas, sehingga saya dapat dengan cepat mengidentifikasi node mana yang berhasil, gagal, atau dilewati.

#### Acceptance Criteria

1. THE Workflow_Canvas SHALL menampilkan Status_Badge pada setiap node yang telah dieksekusi dengan ikon yang berbeda untuk setiap Node_Status: `success` (✓ hijau), `failed` (✗ merah), `skipped` (— abu-abu), `running` (spinner biru).
2. WHEN node berhasil dieksekusi, THE Workflow_Canvas SHALL menampilkan Execution_Time_Display pada node tersebut dalam format `Xs` (detik) atau `Xms` (milidetik).
3. WHEN node gagal dieksekusi, THE Workflow_Canvas SHALL menampilkan Status_Badge `failed` dengan warna merah pada node tersebut.
4. THE Execution_Engine SHALL menyimpan `duration_ms` untuk setiap node ke tabel `node_executions` setelah eksekusi selesai.
5. WHEN Execution_Monitor menerima data node results yang mengandung `duration_ms`, THE Execution_Monitor SHALL meneruskan nilai tersebut ke Workflow_Canvas untuk ditampilkan sebagai Execution_Time_Display.
6. WHEN pengguna mereset workflow (clear canvas atau run ulang), THE Workflow_Canvas SHALL menghapus semua Status_Badge dan Execution_Time_Display dari semua node.

---

### Requirement 3: Manual Trigger Node — Data Awal yang Dapat Dikonfigurasi

**User Story:** Sebagai pengguna workflow builder, saya ingin Manual Trigger Node dapat menyuntikkan data awal yang saya tentukan ke dalam workflow, sehingga saya dapat menguji workflow dengan berbagai skenario input.

#### Acceptance Criteria

1. WHEN Manual Trigger Node dieksekusi, THE Manual_Trigger_Node SHALL menghasilkan output yang berisi `timestamp`, `triggered_by` (user ID), `trigger_type: "manual"`, dan `trigger_data` dari konfigurasi node.
2. WHERE konfigurasi `initialData` diisi dengan JSON yang valid, THE Manual_Trigger_Node SHALL mem-parse JSON tersebut dan menyertakannya sebagai `trigger_data` dalam output.
3. IF konfigurasi `initialData` berisi JSON yang tidak valid, THEN THE Manual_Trigger_Node SHALL menggunakan objek kosong `{}` sebagai `trigger_data` dan mencatat peringatan ke log eksekusi.
4. THE Node_Config_Panel SHALL menampilkan field `initialData` bertipe JSON editor dengan placeholder `{}` dan tooltip "Data JSON yang akan diteruskan ke node berikutnya sebagai input awal".
5. WHEN Manual Trigger Node berhasil dieksekusi, THE Execution_Engine SHALL meneruskan output node ini sebagai input ke semua node downstream yang terhubung.

---

### Requirement 4: Run Test Node — Eksekusi Test Nyata ke Platform

**User Story:** Sebagai pengguna workflow builder, saya ingin Run Test Node benar-benar menjalankan test ke platform chatbot yang dipilih, sehingga hasil test yang ditampilkan adalah data nyata bukan mock.

#### Acceptance Criteria

1. WHEN Run Test Node dieksekusi dengan konfigurasi `platform` yang valid, THE Run_Test_Node SHALL memanggil Platform_Executor yang sesuai (`src/platforms/{platform}.ts`) untuk menjalankan test.
2. WHEN Run Test Node dieksekusi, THE Run_Test_Node SHALL membaca file test data dari path yang dikonfigurasi di `test_data_file` dan meneruskannya ke Platform_Executor.
3. WHEN eksekusi test selesai, THE Run_Test_Node SHALL mengembalikan output yang berisi: `test_id`, `run_id`, `platform`, `status`, `total_questions`, `success_count`, `failed_count`, `avg_score`, `duration`, dan array `results` berisi detail setiap pertanyaan.
4. IF Platform_Executor gagal terhubung ke platform URL yang dikonfigurasi, THEN THE Run_Test_Node SHALL melempar error dengan pesan yang menyebutkan platform dan URL yang gagal.
5. IF file test data tidak ditemukan di path yang dikonfigurasi, THEN THE Run_Test_Node SHALL melempar error dengan pesan "Test data file not found: {path}".
6. THE Run_Test_Node SHALL menyimpan hasil test ke tabel `test_runs` di database sebelum mengembalikan output.
7. WHERE konfigurasi `platform` bernilai `webchat`, THE Run_Test_Node SHALL menggunakan executor `src/platforms/webchat-v3.ts`.
8. THE Node_Config_Panel SHALL menampilkan field konfigurasi Run Test Node dengan tooltip untuk setiap field: `platform` ("Platform chatbot yang akan diuji"), `test_data_file` ("Path ke file CSV/Excel berisi pertanyaan test"), `tester_name` ("Nama yang akan digunakan sebagai pengirim pesan"), `platform_url` ("URL endpoint platform chatbot").

---

### Requirement 5: AI Evaluate Node — Evaluasi Nyata via AI Provider

**User Story:** Sebagai pengguna workflow builder, saya ingin AI Evaluate Node benar-benar memanggil AI provider yang dipilih untuk mengevaluasi respons chatbot, sehingga skor evaluasi yang dihasilkan adalah penilaian AI yang sesungguhnya.

#### Acceptance Criteria

1. WHEN AI Evaluate Node dieksekusi dengan `ai_provider` yang valid, THE AI_Evaluate_Node SHALL memanggil API AI_Provider yang sesuai menggunakan kredensial dari environment variables.
2. WHEN AI Evaluate Node menerima input `results` dari Run Test Node, THE AI_Evaluate_Node SHALL mengevaluasi setiap item dalam array `results` menggunakan AI_Provider yang dikonfigurasi.
3. WHEN evaluasi AI selesai untuk setiap item, THE AI_Evaluate_Node SHALL mengembalikan output yang berisi: `evaluations` (array dengan `ai_score`, `ai_explanation`, `ai_passed` per item), `avg_ai_score`, `pass_count`, `fail_count`, `total_evaluated`, `threshold`, dan `provider`.
4. IF API AI_Provider mengembalikan error atau timeout setelah 30 detik, THEN THE AI_Evaluate_Node SHALL melempar error dengan pesan yang menyebutkan provider dan detail error.
5. WHERE `ai_provider` bernilai `gemini`, THE AI_Evaluate_Node SHALL menggunakan environment variable `GEMINI_API_KEY` untuk autentikasi.
6. WHERE `ai_provider` bernilai `groq`, THE AI_Evaluate_Node SHALL menggunakan environment variable `GROQ_API_KEY` untuk autentikasi.
7. WHERE `ai_provider` bernilai `openai`, THE AI_Evaluate_Node SHALL menggunakan environment variable `OPENAI_API_KEY` untuk autentikasi.
8. IF environment variable untuk AI_Provider yang dipilih tidak tersedia, THEN THE AI_Evaluate_Node SHALL melempar error dengan pesan "API key for {provider} is not configured".
9. THE Node_Config_Panel SHALL menampilkan field `scoring_threshold` dengan tooltip "Nilai minimum (0.0–1.0) agar evaluasi dianggap lulus" dan field `custom_prompt` dengan tooltip "Prompt tambahan untuk memandu AI dalam mengevaluasi respons".

---

### Requirement 6: Condition Node — Evaluasi Kondisi dan Routing yang Benar

**User Story:** Sebagai pengguna workflow builder, saya ingin Condition Node benar-benar mengevaluasi ekspresi kondisi dan merutekan eksekusi ke output `true` atau `false` yang tepat, sehingga workflow dapat bercabang berdasarkan data nyata.

#### Acceptance Criteria

1. WHEN Condition Node dieksekusi, THE Condition_Node SHALL mengevaluasi ekspresi yang dikonfigurasi menggunakan data dari input node dan output node-node sebelumnya.
2. WHEN hasil evaluasi ekspresi bernilai truthy, THE Condition_Node SHALL meneruskan data input ke output port `true` dan tidak mengeksekusi node yang terhubung ke output port `false`.
3. WHEN hasil evaluasi ekspresi bernilai falsy, THE Condition_Node SHALL meneruskan data input ke output port `false` dan tidak mengeksekusi node yang terhubung ke output port `true`.
4. THE Condition_Node SHALL mendukung ekspresi perbandingan: `equal`, `not_equal`, `greater_than`, `less_than`, `greater_than_or_equal`, `less_than_or_equal`, `contains`, `not_contains`.
5. THE Condition_Node SHALL mendukung referensi nilai dinamis menggunakan sintaks `{{ $json.field }}` untuk mengakses field dari data input.
6. IF ekspresi kondisi mengandung sintaks yang tidak valid atau menyebabkan runtime error, THEN THE Condition_Node SHALL merutekan ke output `false` dan mencatat error ke log eksekusi.
7. THE Execution_Engine SHALL menghormati routing Condition_Node dengan hanya mengeksekusi node downstream yang terhubung ke output port yang dipilih (`true` atau `false`).
8. THE Node_Config_Panel SHALL menampilkan Condition Node dengan tiga field: `value1` (nilai pertama dengan tooltip "Nilai atau ekspresi yang akan dibandingkan"), `comparison` (operator perbandingan), dan `value2` (nilai kedua dengan tooltip "Nilai pembanding").

---

### Requirement 7: Wait Node — Penundaan Eksekusi yang Akurat

**User Story:** Sebagai pengguna workflow builder, saya ingin Wait Node benar-benar menunda eksekusi workflow selama durasi yang saya tentukan, sehingga saya dapat mengontrol timing antar node.

#### Acceptance Criteria

1. WHEN Wait Node dieksekusi dengan konfigurasi `duration_seconds` yang valid, THE Wait_Node SHALL menunda eksekusi selama tepat `duration_seconds` detik sebelum melanjutkan ke node berikutnya.
2. THE Wait_Node SHALL meneruskan data input yang diterima ke output tanpa modifikasi setelah penundaan selesai.
3. THE Wait_Node SHALL mengembalikan output yang berisi `waited_seconds` (durasi yang dikonfigurasi) dan `actual_duration_ms` (durasi aktual dalam milidetik).
4. IF konfigurasi `duration_seconds` bernilai kurang dari 0, THEN THE Wait_Node SHALL menggunakan nilai 0 (tidak ada penundaan) dan mencatat peringatan ke log eksekusi.
5. IF konfigurasi `duration_seconds` bernilai lebih dari 3600 (1 jam), THEN THE Wait_Node SHALL melempar error dengan pesan "Wait duration cannot exceed 3600 seconds".
6. THE Node_Config_Panel SHALL menampilkan field `duration_seconds` dengan tooltip "Durasi penundaan dalam detik (0–3600)" dan validasi input numerik.

---

### Requirement 8: Transform Node — Eksekusi JavaScript Code yang Aman

**User Story:** Sebagai pengguna workflow builder, saya ingin Transform Node benar-benar mengeksekusi kode JavaScript yang saya tulis untuk memanipulasi data, sehingga saya dapat melakukan transformasi data yang kompleks dalam workflow.

#### Acceptance Criteria

1. WHEN Transform Node dieksekusi dengan konfigurasi `jsCode` yang valid, THE Transform_Node SHALL mengeksekusi kode JavaScript tersebut dalam sandbox yang terisolasi dengan akses ke variabel `items` (array data input) dan `context` (metadata eksekusi).
2. WHEN kode JavaScript mengembalikan nilai, THE Transform_Node SHALL menggunakan nilai tersebut sebagai output node.
3. IF kode JavaScript melempar exception, THEN THE Transform_Node SHALL menangkap exception tersebut dan melempar error dengan pesan "Transform code execution failed: {error message}".
4. THE Transform_Node SHALL menyediakan helper functions dalam sandbox: `JSON.parse`, `JSON.stringify`, `Math`, `Date`, `Array`, `Object`, `String`, `Number`.
5. THE Transform_Node SHALL membatasi waktu eksekusi kode JavaScript maksimal 10 detik; IF melebihi batas waktu, THEN THE Transform_Node SHALL melempar error dengan pesan "Transform code execution timeout (10s)".
6. THE Node_Config_Panel SHALL menampilkan field `jsCode` sebagai code editor dengan syntax highlighting JavaScript, tooltip "Kode JavaScript untuk transformasi data. Gunakan variabel `items` untuk mengakses data input", dan contoh kode default.

---

### Requirement 9: Generate Report Node — Pembuatan Laporan Nyata

**User Story:** Sebagai pengguna workflow builder, saya ingin Generate Report Node benar-benar membuat file laporan dari hasil test, sehingga laporan yang dihasilkan dapat diunduh dan digunakan.

#### Acceptance Criteria

1. WHEN Generate Report Node dieksekusi dengan input dari Run Test Node atau AI Evaluate Node, THE Generate_Report_Node SHALL membuat file laporan dalam format yang dikonfigurasi (`html`, `excel`, atau `json`).
2. WHERE format laporan adalah `html`, THE Generate_Report_Node SHALL menggunakan template dari `template/template.ejs` untuk menghasilkan file HTML.
3. WHERE format laporan adalah `excel`, THE Generate_Report_Node SHALL menggunakan `src/utils/excel-report-generator.ts` untuk menghasilkan file Excel.
4. WHEN file laporan berhasil dibuat, THE Generate_Report_Node SHALL menyimpan file ke direktori `ci-dashboard/artifacts/` dan mencatat metadata ke tabel `artifacts` di database.
5. WHEN Generate Report Node berhasil, THE Generate_Report_Node SHALL mengembalikan output yang berisi: `artifact_id`, `filename`, `file_path`, `file_size` (dalam bytes), `download_url`, dan `format`.
6. IF input tidak mengandung data test yang valid (tidak ada `run_id` atau `results`), THEN THE Generate_Report_Node SHALL melempar error dengan pesan "Invalid input: test results are required to generate a report".
7. THE Node_Config_Panel SHALL menampilkan field `report_format` dengan tooltip "Format file laporan yang akan dibuat" dan field `output_filename` dengan tooltip "Nama file laporan tanpa ekstensi".

---

### Requirement 10: Send Notification Node — Pengiriman Notifikasi yang Berfungsi

**User Story:** Sebagai pengguna workflow builder, saya ingin Send Notification Node benar-benar mengirim notifikasi ke channel yang dipilih, sehingga tim dapat menerima pemberitahuan otomatis setelah workflow selesai.

#### Acceptance Criteria

1. WHEN Send Notification Node dieksekusi dengan channel `dashboard`, THE Send_Notification_Node SHALL membuat entri notifikasi di tabel `notifications` database yang dapat dilihat oleh penerima di dashboard.
2. WHEN Send Notification Node dieksekusi dengan channel `telegram`, THE Send_Notification_Node SHALL mengirim pesan ke Telegram Chat ID yang dikonfigurasi menggunakan Telegram Bot API.
3. WHEN Send Notification Node dieksekusi dengan channel `email`, THE Send_Notification_Node SHALL mengirim email ke alamat yang dikonfigurasi menggunakan SMTP yang tersedia.
4. THE Send_Notification_Node SHALL mendukung template variable dalam field `message` menggunakan sintaks `{{variable}}` yang digantikan dengan nilai dari data input node.
5. WHEN notifikasi berhasil dikirim, THE Send_Notification_Node SHALL mengembalikan output yang berisi `success: true`, `notifications_sent` (jumlah notifikasi terkirim), dan detail notifikasi.
6. IF pengiriman notifikasi gagal (koneksi error, invalid credentials), THEN THE Send_Notification_Node SHALL mencatat error ke log eksekusi dan mengembalikan output dengan `success: false` dan `error_message` yang deskriptif.
7. THE Node_Config_Panel SHALL menampilkan field `channel` dengan tooltip "Channel pengiriman notifikasi", field `recipient` dengan tooltip "Alamat email, Chat ID Telegram, atau username dashboard", dan field `message` dengan tooltip "Isi pesan. Gunakan {{variable}} untuk menyisipkan data dinamis".

---

### Requirement 11: Output Preview di Panel Konfigurasi

**User Story:** Sebagai pengguna workflow builder, saya ingin melihat preview data output sebuah node setelah eksekusi, sehingga saya dapat memverifikasi data yang diteruskan ke node berikutnya.

#### Acceptance Criteria

1. WHEN pengguna membuka panel konfigurasi node yang telah berhasil dieksekusi, THE Node_Config_Panel SHALL menampilkan tab "Output" yang berisi Output_Preview dari eksekusi terakhir node tersebut.
2. THE Node_Config_Panel SHALL menampilkan Output_Preview dalam format JSON yang diformat (pretty-printed) dengan syntax highlighting.
3. WHEN node belum pernah dieksekusi atau berstatus `idle`, THE Node_Config_Panel SHALL menampilkan pesan "Belum ada data output. Jalankan workflow untuk melihat output node ini." pada tab Output.
4. WHEN node berstatus `failed`, THE Node_Config_Panel SHALL menampilkan tab "Error" yang berisi pesan error lengkap dan stack trace (jika tersedia) dari eksekusi terakhir.
5. THE Node_Config_Panel SHALL menyimpan data output dan error dari eksekusi terakhir pada objek node di Workflow_Canvas sehingga dapat ditampilkan saat panel dibuka.
6. THE Execution_Monitor SHALL memperbarui properti `lastOutput` dan `lastError` pada objek node di Workflow_Canvas setiap kali menerima data hasil eksekusi dari polling API.

---

### Requirement 12: Pesan Error yang Informatif pada Node Gagal

**User Story:** Sebagai pengguna workflow builder, saya ingin melihat pesan error yang jelas dan informatif ketika sebuah node gagal, sehingga saya dapat dengan cepat mengidentifikasi dan memperbaiki masalah.

#### Acceptance Criteria

1. WHEN node gagal dieksekusi, THE Workflow_Canvas SHALL menampilkan tooltip error pada node tersebut yang muncul saat pengguna mengarahkan kursor ke Status_Badge `failed`.
2. THE tooltip error SHALL menampilkan pesan error utama dalam bahasa yang mudah dipahami, maksimal 200 karakter.
3. WHEN pengguna membuka panel konfigurasi node yang berstatus `failed`, THE Node_Config_Panel SHALL menampilkan tab "Error" dengan pesan error lengkap, nama node yang gagal, dan saran perbaikan jika tersedia.
4. THE Execution_Engine SHALL menyimpan `error_message` yang deskriptif ke tabel `node_executions` untuk setiap node yang gagal, termasuk jenis error dan konteks yang relevan.
5. IF node gagal karena konfigurasi yang tidak lengkap (field required kosong), THEN THE Node_Executor SHALL melempar error dengan pesan "Configuration error: {field_name} is required" sebelum memulai eksekusi.
6. THE Node_Config_Panel SHALL menampilkan indikator visual (border merah) pada field konfigurasi yang menyebabkan error konfigurasi.

---

### Requirement 13: Panel Konfigurasi dengan Tooltip pada Setiap Field

**User Story:** Sebagai pengguna workflow builder, saya ingin setiap field konfigurasi node memiliki tooltip yang menjelaskan fungsinya, sehingga saya dapat mengisi konfigurasi dengan benar tanpa harus membaca dokumentasi eksternal.

#### Acceptance Criteria

1. THE Node_Config_Panel SHALL menampilkan ikon informasi (ⓘ) di sebelah setiap label field konfigurasi yang memiliki properti `description` dalam definisi node.
2. WHEN pengguna mengarahkan kursor ke ikon informasi, THE Node_Config_Panel SHALL menampilkan tooltip yang berisi teks dari properti `description` field tersebut.
3. THE Node_Config_Panel SHALL menampilkan tanda `*` (asterisk) merah di sebelah label field yang bersifat `required: true`.
4. THE Node_Config_Panel SHALL menampilkan placeholder text pada setiap input field yang memiliki properti `placeholder` dalam definisi node.
5. WHEN field bertipe `options` (dropdown), THE Node_Config_Panel SHALL menampilkan deskripsi singkat di bawah dropdown yang menjelaskan opsi yang sedang dipilih, jika tersedia dalam definisi opsi.
6. THE Node_Config_Panel SHALL menampilkan tab ketiga "Output" di samping tab "Parameters" dan "Settings" untuk menampilkan Output_Preview setelah eksekusi.
