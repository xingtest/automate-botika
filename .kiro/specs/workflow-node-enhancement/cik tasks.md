# Implementation Plan: Workflow Node Enhancement

## Overview

Implementasi peningkatan CI Dashboard Workflow Builder dalam tiga area utama: (1) animasi eksekusi node real-time, (2) implementasi nyata setiap node executor di backend, dan (3) panel konfigurasi yang lebih informatif dengan tooltip, tab Output, dan pesan error. Semua perubahan dibatasi pada folder `ci-dashboard/`.

## Tasks

- [x] 1. Tambah CSS animasi dan status badge pada workflow-canvas.css
  - Tambahkan keyframe `node-pulse` dan `spin` untuk animasi `status-running`
  - Tambahkan CSS class `.workflow-node.status-running` dengan border biru dan animasi pulse
  - Tambahkan CSS `.workflow-node.status-running .node-header::after` untuk spinner di header
  - Tambahkan CSS `.node-status-badge` dengan variant `.badge-success`, `.badge-failed`, `.badge-skipped`, `.badge-running`
  - Tambahkan CSS `.node-execution-time` untuk tampilan durasi di bawah label node
  - Tambahkan CSS `.node-error-tooltip` dengan efek hover opacity untuk tooltip error pada badge failed
  - _Requirements: 1.4, 2.1, 2.2, 2.3, 12.1, 12.2_

- [x] 2. Update WorkflowCanvas — method baru dan perubahan createNodeElement
  - [x] 2.1 Tambah method `formatDuration(ms)` di `workflow-canvas.js`
    - Return `"Xms"` jika ms < 1000, return `"X.Xs"` jika >= 1000
    - _Requirements: 2.2_
  - [x] 2.2 Tambah method `updateNodeStatus(nodeId, status, meta = {})` di `workflow-canvas.js`
    - Cari node di `this.nodes` berdasarkan `nodeId`
    - Update `node.status`, `node.duration_ms` (dari `meta.duration_ms`), `node.lastOutput` (dari `meta.output`), `node.lastError` (dari `meta.error`)
    - Panggil `this.render()` setelah update
    - _Requirements: 1.1, 1.2, 1.7, 1.8, 2.5, 11.5, 11.6_
  - [x] 2.3 Tambah method `resetNodeStatuses()` di `workflow-canvas.js`
    - Loop semua node, set `status = null`, `duration_ms = null`, `lastOutput = null`, `lastError = null`
    - Panggil `this.render()` setelah reset
    - _Requirements: 1.6, 2.6_
  - [x] 2.4 Update method `createNodeElement(node)` di `workflow-canvas.js`
    - Tambahkan status badge `<div class="node-status-badge badge-{status}">` dengan ikon FA sesuai status: success=`fa-check`, failed=`fa-times`, skipped=`fa-minus`, running=`fa-spinner fa-spin`
    - Tambahkan execution time `<div class="node-execution-time">` jika `node.duration_ms` ada, gunakan `formatDuration(node.duration_ms)`
    - Tambahkan error tooltip `<div class="node-error-tooltip">` jika `node.lastError` ada, truncate ke 200 karakter
    - _Requirements: 1.4, 2.1, 2.2, 2.3, 12.1, 12.2_

- [x] 3. Update ExecutionMonitor — teruskan duration_ms, output, error ke canvas
  - Ubah method `updateNodeStatuses(nodeResults)` di `execution-monitor.js`
  - Untuk setiap `nodeId` dalam `nodeResults`, panggil `WorkflowCanvas.updateNodeStatus(nodeId, result.status, { duration_ms: result.duration_ms, output: result.output, error: result.error_message })`
  - _Requirements: 1.7, 1.8, 2.5, 11.6_

- [x] 4. Update ExecutionEngine — simpan duration_ms dan output per node, perluas API response
  - [x] 4.1 Tambah method `setNodeDuration(nodeId, duration)` di `execution-context.js`
    - Simpan ke `Map` baru `this.node_durations`
    - Tambah method `getNodeDuration(nodeId)` dan `getAllNodeDurations()`
    - _Requirements: 2.4_
  - [x] 4.2 Update method `execute()` di `execution-engine.js`
    - Setelah `executor.execute()` berhasil, panggil `context.setNodeDuration(nodeId, duration)`
    - _Requirements: 2.4_
  - [x] 4.3 Update method `getExecutionDetails` di `workflow.controller.js`
    - Query tabel `node_executions` untuk mendapatkan `status`, `duration_ms`, `output_data`, `error_message` per node
    - Susun sebagai `node_results: { [nodeId]: { status, duration_ms, output, error_message } }` dalam response JSON
    - _Requirements: 2.4, 2.5, 11.1, 12.4_

- [x] 5. Checkpoint — Verifikasi animasi dan status badge berfungsi
  - Pastikan semua tests pass, tanyakan ke user jika ada pertanyaan.

- [x] 6. Implementasi ManualTriggerNode yang nyata
  - Update `execute()` di `manual-trigger-node.js`
  - Parse `config.initialData`: jika string, coba `JSON.parse()`; jika gagal, log warning dan gunakan `{}`; jika sudah object, gunakan langsung
  - Tambah `config_schema` dengan field `initialData` bertipe `json`, placeholder `{}`, description "Data JSON yang akan diteruskan ke node berikutnya sebagai input awal"
  - Return `{ timestamp, triggered_by: context.user_id, trigger_type: 'manual', trigger_data: triggerData }`
  - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5_

- [x] 7. Implementasi RunTestNode yang nyata
  - [x] 7.1 Update validasi config di `run-test-node.js`
    - Tambah validasi awal: lempar `"Configuration error: platform is required"` jika tidak ada, sama untuk `test_data_file` dan `platform_url`
    - Verifikasi file test data dengan `fs.existsSync()`; lempar `"Test data file not found: {path}"` jika tidak ada
    - _Requirements: 4.4, 4.5, 12.5_
  - [x] 7.2 Integrasikan platform executor via child process di `run-test-node.js`
    - Buat mapping `platformMap` dari `webchat` → `webchat-v3`, dll.
    - Jalankan executor via `child_process.execSync` dengan path ke `dist/platforms/{executor}.js`
    - Parse output JSON dari child process sebagai hasil test
    - Simpan ke DB via `createTestRun()` yang sudah ada, return `{ ...result, run_id: runId }`
    - _Requirements: 4.1, 4.2, 4.3, 4.6, 4.7_

- [x] 8. Implementasi AIEvaluateNode yang nyata
  - [x] 8.1 Tambah validasi API key di `ai-evaluate-node.js`
    - Map provider ke env var: `gemini`→`GEMINI_API_KEY`, `groq`→`GROQ_API_KEY`, `openai`→`OPENAI_API_KEY`, `cerebras`→`CEREBRAS_API_KEY`
    - Lempar `"API key for {provider} is not configured"` jika env var tidak ada
    - _Requirements: 5.5, 5.6, 5.7, 5.8_
  - [x] 8.2 Implementasi `callAIProvider()` di `ai-evaluate-node.js`
    - Untuk `gemini`: gunakan `@google/generative-ai` atau fetch ke Gemini REST API
    - Untuk `groq`/`openai`: gunakan OpenAI-compatible API dengan base URL yang sesuai
    - Prompt: evaluasi `item.question` vs `item.response`, return `{ ai_score, ai_explanation, ai_passed }`
    - Tambah timeout 30 detik dengan `Promise.race()`; lempar error dengan nama provider jika timeout
    - _Requirements: 5.1, 5.2, 5.3, 5.4_
  - [x] 8.3 Update method `execute()` di `ai-evaluate-node.js`
    - Ganti mock evaluations dengan `await Promise.all(results.map(item => this.callAIProvider(...)))`
    - Hitung `avg_ai_score`, `pass_count`, `fail_count` dari hasil nyata
    - _Requirements: 5.2, 5.3_

- [x] 9. Implementasi ConditionNode yang nyata
  - Update `execute()` di `condition-node.js`
  - Tambah method `resolveTemplate(value, input)`: replace `{{ $json.field }}` dengan nilai dari `input` menggunakan dot-notation path
  - Tambah method `compare(v1, operator, v2)` dengan semua 8 operator: `equal`, `not_equal`, `greater_than`, `less_than`, `greater_than_or_equal`, `less_than_or_equal`, `contains`, `not_contains`
  - Update `config_schema` dengan tiga field: `value1` (description: "Nilai atau ekspresi yang akan dibandingkan"), `comparison` (select operator), `value2` (description: "Nilai pembanding")
  - Wrap evaluasi dalam try-catch; jika error, route ke `false` dan log error
  - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.5, 6.6, 6.8_

- [x] 10. Implementasi WaitNode yang nyata
  - Update `execute()` di `wait-node.js`
  - Tambah validasi: jika `duration_seconds > 3600`, lempar `"Wait duration cannot exceed 3600 seconds"`
  - Jika `duration_seconds < 0`, log warning dan set ke 0
  - Ambil input dengan `this.getInput(context, 'input')` dan sertakan sebagai `input_passthrough` dalam output
  - Update `config_schema` field `duration_seconds` dengan description "Durasi penundaan dalam detik (0–3600)"
  - _Requirements: 7.1, 7.2, 7.3, 7.4, 7.5, 7.6_

- [x] 11. Implementasi TransformDataNode dengan vm sandbox
  - Ganti implementasi `execute()` di `transform-data-node.js` dengan vm sandbox
  - Require `vm` module; buat `sandbox` dengan `items`, `context`, dan helper: `JSON`, `Math`, `Date`, `Array`, `Object`, `String`, `Number`, `console: { log: () => {} }`
  - Buat `vm.Script` dari `config.jsCode` dan jalankan di `vm.createContext(sandbox)`
  - Tambah timeout 10 detik via `Promise.race()`; lempar `"Transform code execution timeout (10s)"` jika melebihi
  - Wrap dalam try-catch; lempar `"Transform code execution failed: {error.message}"` untuk error lain
  - Update `config_schema`: ganti field `expression` dengan `jsCode` bertipe `textarea`, description "Kode JavaScript untuk transformasi data. Gunakan variabel `items` untuk mengakses data input"
  - _Requirements: 8.1, 8.2, 8.3, 8.4, 8.5, 8.6_

- [x] 12. Implementasi GenerateReportNode yang nyata
  - [x] 12.1 Update validasi input di `generate-report-node.js`
    - Cek `input.run_id` atau `input.results`; lempar `"Invalid input: test results are required to generate a report"` jika tidak ada
    - _Requirements: 9.6_
  - [x] 12.2 Implementasi pembuatan file laporan di `generate-report-node.js`
    - Require `fs`, `path`, `ejs`
    - Buat direktori `ci-dashboard/artifacts/` jika belum ada dengan `fs.mkdirSync(outputDir, { recursive: true })`
    - Format `html`: render template `template/template.ejs` dengan `ejs.render()`, tulis ke file
    - Format `excel`: panggil `src/utils/excel-report-generator.ts` (via compiled JS di `dist/`)
    - Format `json`: tulis `JSON.stringify(input, null, 2)` ke file
    - Simpan metadata ke tabel `artifacts` via DB query, return `{ artifact_id, filename, file_path, file_size, download_url, format }`
    - _Requirements: 9.1, 9.2, 9.3, 9.4, 9.5_

- [x] 13. Implementasi SendNotificationNode multi-channel
  - [x] 13.1 Tambah method `sendTelegramNotification()` di `send-notification-node.js`
    - Gunakan `TELEGRAM_BOT_TOKEN` dari env var
    - Kirim ke `config.recipient` (Chat ID) via Telegram Bot API `sendMessage`
    - Jika gagal, log error dan return `{ success: false, error_message: ... }`
    - _Requirements: 10.2_
  - [x] 13.2 Tambah method `sendEmailNotification()` di `send-notification-node.js`
    - Gunakan `nodemailer` dengan konfigurasi SMTP dari env vars (`SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`)
    - Kirim ke `config.recipient` (alamat email)
    - Jika gagal, log error dan return `{ success: false, error_message: ... }`
    - _Requirements: 10.3_
  - [x] 13.3 Update method `execute()` di `send-notification-node.js`
    - Tambah field `channel` ke `config_schema` dengan description "Channel pengiriman notifikasi"
    - Tambah field `recipient` dengan description "Alamat email, Chat ID Telegram, atau username dashboard"
    - Update field `message` dengan description "Isi pesan. Gunakan {{variable}} untuk menyisipkan data dinamis"
    - Routing berdasarkan `config.channel`: `dashboard` (sudah ada), `telegram`, `email`
    - Lempar error untuk channel yang tidak dikenal
    - _Requirements: 10.1, 10.4, 10.5, 10.6, 10.7_

- [x] 14. Checkpoint — Verifikasi semua node executor berfungsi
  - Pastikan semua tests pass, tanyakan ke user jika ada pertanyaan.

- [x] 15. Update NodeConfigPanel — tooltip, required marker, dan tab Output
  - [x] 15.1 Tambah CSS untuk tooltip dan tab Output di `node-config-panel.css`
    - Tambah style `.tooltip-icon` dengan posisi relative dan cursor help
    - Tambah style `.tooltip-icon::after` untuk tooltip popup (absolute, z-index tinggi, max-width 250px)
    - Tambah style `.required-marker` dengan warna merah
    - Tambah style `.output-preview` sebagai `<pre>` dengan syntax-like styling (background gelap, font mono, overflow auto)
    - Tambah style `.error-tab-content` dengan border merah dan background error-light
    - _Requirements: 13.1, 13.2, 13.3, 11.2, 12.3_
  - [x] 15.2 Tambah method `renderTooltipIcon(description)` di `node-config-panel.js`
    - Return `<span class="tooltip-icon" data-tooltip="{description}">ⓘ</span>`
    - _Requirements: 13.1, 13.2_
  - [x] 15.3 Update method `renderParameters()` di `node-config-panel.js`
    - Untuk setiap field dengan `description`, tambahkan `renderTooltipIcon(prop.description)` di sebelah label
    - Untuk field dengan `required: true`, tambahkan `<span class="required-marker">*</span>` di sebelah label
    - Untuk field dengan `placeholder`, teruskan ke atribut `placeholder` pada input element
    - _Requirements: 13.1, 13.2, 13.3, 13.4_
  - [x] 15.4 Tambah method `renderOutput()` di `node-config-panel.js`
    - Jika `this.currentNode.lastError` ada, return `renderErrorTab()`
    - Jika `this.currentNode.lastOutput` ada, return `<pre class="output-preview">${JSON.stringify(lastOutput, null, 2)}</pre>`
    - Jika tidak ada keduanya, return pesan "Belum ada data output. Jalankan workflow untuk melihat output node ini."
    - _Requirements: 11.1, 11.2, 11.3_
  - [x] 15.5 Tambah method `renderErrorTab()` di `node-config-panel.js`
    - Tampilkan `this.currentNode.lastError` dalam `<div class="error-tab-content">`
    - Tampilkan nama node dan pesan error lengkap
    - _Requirements: 11.4, 12.3_
  - [x] 15.6 Update method `render()` di `node-config-panel.js` — tambah tab Output
    - Tambah tab ketiga "Output" di samping "Parameters" dan "Settings"
    - Routing `this.activeTab === 'output'` ke `renderOutput()`
    - _Requirements: 11.1, 13.6_

- [x] 16. Final checkpoint — Verifikasi integrasi end-to-end
  - Pastikan semua tests pass, tanyakan ke user jika ada pertanyaan.

## Notes

- Tasks bertanda `*` adalah opsional dan dapat dilewati untuk MVP yang lebih cepat
- Setiap task mereferensikan requirement spesifik untuk traceability
- Checkpoint memastikan validasi inkremental sebelum melanjutkan ke area berikutnya
- Urutan task dirancang agar setiap langkah dapat dieksekusi secara mandiri tanpa kode yang menggantung
- Semua perubahan dibatasi pada folder `ci-dashboard/`
