# Design Document: Workflow Node Enhancement

## Overview

Fitur **Workflow Node Enhancement** meningkatkan CI Dashboard Workflow Builder di tiga area utama yang saling melengkapi:

1. **Animasi Eksekusi Node** — Feedback visual real-time saat node berjalan, berhasil, atau gagal melalui CSS animation dan status badge.
2. **Implementasi Node yang Benar** — Setiap node executor di backend diimplementasikan dengan logika nyata: integrasi platform test, AI provider, evaluasi kondisi, transformasi data, dan pengiriman notifikasi.
3. **Detail Node yang Lebih Lengkap** — Panel konfigurasi diperkaya dengan tooltip, tab Output preview, status badge, execution time, dan pesan error yang informatif.

Semua perubahan dibatasi pada folder `ci-dashboard/`. Arsitektur mengikuti pola yang sudah ada: frontend berbasis vanilla JS dengan modul terpisah, backend Node.js dengan class-based executors.

---

## Architecture

### Gambaran Sistem

```
┌─────────────────────────────────────────────────────────────────┐
│                        FRONTEND (Browser)                        │
│                                                                   │
│  ┌──────────────────┐    ┌──────────────────┐                   │
│  │  WorkflowCanvas  │◄───│ ExecutionMonitor  │                   │
│  │  (node render,   │    │  (polling 2s,     │                   │
│  │   CSS animation, │    │   status update,  │                   │
│  │   status badge)  │    │   lastOutput)     │                   │
│  └────────┬─────────┘    └────────┬──────────┘                  │
│           │                       │ HTTP polling                  │
│  ┌────────▼─────────┐             │                              │
│  │  NodeConfigPanel │             │                              │
│  │  (tooltip, tab   │             │                              │
│  │   Output, error) │             │                              │
│  └──────────────────┘             │                              │
└───────────────────────────────────┼─────────────────────────────┘
                                    │ REST API
┌───────────────────────────────────▼─────────────────────────────┐
│                        BACKEND (Node.js)                          │
│                                                                   │
│  ┌──────────────────┐    ┌──────────────────┐                   │
│  │  ExecutionEngine │───►│   NodeRegistry   │                   │
│  │  (topological    │    │  (executor map)  │                   │
│  │   sort, status   │    └────────┬─────────┘                   │
│  │   broadcast)     │             │                              │
│  └──────────────────┘    ┌────────▼─────────────────────────┐   │
│                           │         Node Executors            │   │
│                           │  ManualTrigger | RunTest          │   │
│                           │  AIEvaluate    | Condition        │   │
│                           │  Wait          | Transform        │   │
│                           │  GenerateReport| SendNotification │   │
│                           └──────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
```

### Alur Data Eksekusi hingga Animasi

```
User klik "Run Workflow"
        │
        ▼
WorkflowManager.runWorkflow()
        │ POST /api/workflows/:id/execute
        ▼
ExecutionEngine.execute()
        │
        ├─► setNodeStatus(nodeId, 'running')
        │         │
        │         ▼ (via polling response)
        │   ExecutionMonitor.pollStatus()
        │         │ node_results: { nodeId: { status: 'running' } }
        │         ▼
        │   WorkflowCanvas.updateNodeStatus(nodeId, 'running')
        │         │
        │         ▼
        │   nodeEl.classList.add('status-running')  ← CSS animation aktif
        │
        ├─► executor.execute(context, config, node)
        │
        ├─► setNodeStatus(nodeId, 'success')
        │         │
        │         ▼ (via polling response)
        │   ExecutionMonitor.pollStatus()
        │         │ node_results: { nodeId: { status: 'success', duration_ms: 1234, output: {...} } }
        │         ▼
        │   WorkflowCanvas.updateNodeStatus(nodeId, 'success', { duration_ms: 1234, output: {...} })
        │         │
        │         ▼
        │   nodeEl.classList.remove('status-running')
        │   nodeEl.classList.add('status-success')  ← Badge hijau + execution time
        │   node.lastOutput = output
        │
        └─► logNodeExecution(executionId, node, 'success', result, duration)
```

---

## Components and Interfaces

### Frontend Components

#### 1. WorkflowCanvas — Perubahan

**File:** `ci-dashboard/workflow-builder/workflow-canvas.js`

Tambahan method dan perubahan pada `createNodeElement` dan `renderNodes`:

```javascript
// Method baru
WorkflowCanvas.updateNodeStatus(nodeId, status, meta = {})
WorkflowCanvas.resetNodeStatuses()
WorkflowCanvas.formatDuration(ms)

// Perubahan createNodeElement — tambah status badge dan execution time
createNodeElement(node) {
  // ... existing code ...
  // Tambah: status badge dengan ikon sesuai status
  // Tambah: execution time display jika node.duration_ms ada
  // Tambah: tooltip error jika node.lastError ada
}
```

Interface `updateNodeStatus`:
```javascript
/**
 * @param {string} nodeId
 * @param {string} status - 'idle'|'running'|'success'|'failed'|'skipped'
 * @param {Object} meta - { duration_ms?: number, output?: any, error?: string }
 */
updateNodeStatus(nodeId, status, meta = {})
```

#### 2. ExecutionMonitor — Perubahan

**File:** `ci-dashboard/workflow-builder/execution-monitor.js`

Perubahan pada `updateNodeStatuses` untuk meneruskan `duration_ms`, `output`, dan `error`:

```javascript
updateNodeStatuses(nodeResults) {
  if (!nodeResults) return;
  Object.keys(nodeResults).forEach(nodeId => {
    const result = nodeResults[nodeId];
    WorkflowCanvas.updateNodeStatus(nodeId, result.status, {
      duration_ms: result.duration_ms,
      output: result.output,
      error: result.error_message
    });
  });
}
```

#### 3. NodeConfigPanel — Perubahan

**File:** `ci-dashboard/workflow-builder/node-config-panel.js`

Perubahan utama:
- Tambah tab ketiga "Output" di samping "Parameters" dan "Settings"
- `renderParameters` menambahkan ikon ⓘ dan tooltip untuk field dengan `description`
- `renderParameters` menambahkan `*` merah untuk field dengan `required: true`
- Tambah `renderOutput()` method untuk menampilkan `node.lastOutput` atau `node.lastError`
- Tambah `renderErrorTab()` untuk node dengan status `failed`

```javascript
// Tab structure baru
render() {
  // Tabs: Parameters | Settings | Output
  // Output tab aktif jika node.lastOutput atau node.lastError ada
}

renderOutput() {
  if (this.currentNode.lastError) {
    return this.renderErrorTab();
  }
  if (this.currentNode.lastOutput) {
    return `<pre class="output-preview">${JSON.stringify(this.currentNode.lastOutput, null, 2)}</pre>`;
  }
  return `<p class="text-muted">Belum ada data output. Jalankan workflow untuk melihat output node ini.</p>`;
}

renderTooltipIcon(description) {
  return `<span class="tooltip-icon" data-tooltip="${description}">ⓘ</span>`;
}
```

### Backend Services

#### 4. ExecutionEngine — Perubahan

**File:** `ci-dashboard/server/services/execution-engine.js`

Perubahan pada `logNodeExecution` untuk menyimpan `output_data` dan `duration_ms` dengan benar, serta perubahan pada response API `/executions/:id` untuk menyertakan `duration_ms` dan `output` per node.

Perubahan pada `execute()` untuk meneruskan `duration_ms` ke `context.setNodeOutput`:

```javascript
// Setelah executor.execute() berhasil:
const duration = Date.now() - startTime;
context.setNodeOutput(nodeId, result);
context.setNodeDuration(nodeId, duration);  // method baru
context.setNodeStatus(nodeId, 'success');
await this.logNodeExecution(executionId, node, 'success', result, inputData, null, duration);
```

#### 5. Node Executors — Implementasi Nyata

Setiap executor diimplementasikan dengan logika nyata (bukan mock). Detail per node dijelaskan di bagian Data Models.

---

## Data Models

### Node Status di Canvas

Setiap node di `WorkflowCanvas.nodes[]` diperluas dengan properti runtime:

```javascript
{
  id: "node_123",
  type: "run-test",
  label: "Run Test",
  // ... existing fields ...
  status: "success",        // null | 'idle' | 'running' | 'success' | 'failed' | 'skipped'
  duration_ms: 1234,        // durasi eksekusi dalam ms (baru)
  lastOutput: { ... },      // output terakhir dari eksekusi (baru)
  lastError: "Error msg"    // pesan error terakhir (baru)
}
```

### API Response: GET /workflows/executions/:id

Response diperluas untuk menyertakan data per node:

```javascript
{
  execution_id: "exec_abc",
  status: "running",
  node_results: {
    "node_123": {
      status: "success",
      duration_ms: 1234,
      output: { test_id: "...", results: [...] },
      error_message: null
    },
    "node_456": {
      status: "running",
      duration_ms: null,
      output: null,
      error_message: null
    }
  }
}
```

### ManualTriggerNode Output

```javascript
{
  timestamp: "2024-01-01T00:00:00.000Z",
  triggered_by: 42,           // user_id
  trigger_type: "manual",
  trigger_data: { ... }       // parsed dari config.initialData
}
```

### RunTestNode Output

```javascript
{
  test_id: "test_1234567890",
  run_id: 15,
  platform: "webchat",
  status: "completed",
  total_questions: 10,
  success_count: 8,
  failed_count: 2,
  avg_score: 0.85,
  duration: "12.3s",
  results: [
    {
      no: 1,
      title: "Greeting",
      question: "Haloo",
      response: "Halo! Ada yang bisa saya bantu?",
      status: "success",
      duration: "2.1s"
    }
  ]
}
```

### AIEvaluateNode Output

```javascript
{
  run_id: 15,
  evaluations: [
    {
      no: 1,
      question: "Haloo",
      response: "Halo!",
      status: "success",
      ai_score: 0.92,
      ai_explanation: "Respons relevan dan ramah.",
      ai_passed: true,
      ai_provider: "gemini"
    }
  ],
  avg_ai_score: 0.88,
  pass_count: 8,
  fail_count: 2,
  total_evaluated: 10,
  threshold: 0.7,
  provider: "gemini",
  status: "completed"
}
```

### ConditionNode Output

```javascript
{
  expression: "{{ $json.avg_score }} > 0.7",
  result: true,
  routed_to: "true"   // "true" | "false"
}
```

### WaitNode Output

```javascript
{
  waited_seconds: 5,
  actual_duration_ms: 5003,
  input_passthrough: { ... }  // data input yang diteruskan
}
```

### TransformNode Output

Nilai yang dikembalikan oleh kode JavaScript yang dieksekusi.

### GenerateReportNode Output

```javascript
{
  artifact_id: 42,
  filename: "report-2024-01-01.html",
  file_path: "ci-dashboard/artifacts/report-2024-01-01.html",
  file_size: 45678,
  download_url: "/api/artifacts/42/download",
  format: "html"
}
```

### SendNotificationNode Output

```javascript
{
  success: true,
  notifications_sent: 1,
  notifications: [
    {
      id: 99,
      user_id: 42,
      title: "Workflow Selesai",
      type: "success",
      created_at: "2024-01-01T00:00:00.000Z"
    }
  ],
  title: "Workflow Selesai",
  message: "Test berhasil dengan skor 0.88",
  type: "success"
}
```

---

## CSS Design: Animasi Node

### Animasi `status-running`

Node yang sedang berjalan menampilkan dua efek visual:
1. **Pulse border** — border berwarna biru berdetak keluar
2. **Spinner icon** — ikon spinner berputar di dalam node header

```css
/* workflow-canvas.css — perubahan pada .workflow-node.status-running */
.workflow-node.status-running {
  border-color: var(--accent);
  animation: node-pulse 1.5s ease-in-out infinite;
}

@keyframes node-pulse {
  0%, 100% {
    box-shadow: 0 0 0 0 rgba(99, 102, 241, 0.4);
  }
  50% {
    box-shadow: 0 0 0 8px rgba(99, 102, 241, 0);
  }
}

/* Spinner di dalam node header saat running */
.workflow-node.status-running .node-header::after {
  content: '';
  position: absolute;
  top: 8px;
  right: 8px;
  width: 14px;
  height: 14px;
  border: 2px solid rgba(255,255,255,0.3);
  border-top-color: #fff;
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}
```

### Status Badge

```css
/* Status badge di pojok kanan bawah node */
.node-status-badge {
  position: absolute;
  bottom: -8px;
  right: -8px;
  width: 20px;
  height: 20px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 10px;
  color: #fff;
  border: 2px solid var(--bg-card);
  z-index: 20;
}

.node-status-badge.badge-success { background: var(--success); }
.node-status-badge.badge-failed  { background: var(--error); }
.node-status-badge.badge-skipped { background: var(--text-muted); }
.node-status-badge.badge-running { background: var(--accent); animation: spin 0.8s linear infinite; }
```

### Execution Time Display

```css
/* Execution time di bawah node label */
.node-execution-time {
  font-size: 0.65rem;
  color: var(--text-muted);
  text-align: center;
  margin-top: 2px;
  font-variant-numeric: tabular-nums;
}
```

### Tooltip Error

```css
/* Tooltip pada status badge failed */
.node-error-tooltip {
  position: absolute;
  bottom: calc(100% + 8px);
  right: -8px;
  background: var(--bg-sidebar);
  border: 1px solid var(--error);
  border-radius: var(--r-md);
  padding: var(--sp-2) var(--sp-3);
  font-size: 0.7rem;
  color: var(--error);
  max-width: 220px;
  word-break: break-word;
  white-space: normal;
  z-index: 100;
  box-shadow: var(--shadow-md);
  pointer-events: none;
  opacity: 0;
  transition: opacity 0.15s;
}

.node-status-badge.badge-failed:hover + .node-error-tooltip,
.node-status-badge.badge-failed:hover ~ .node-error-tooltip {
  opacity: 1;
}
```

---

## Backend Node Executor Implementation

### ManualTriggerNode

**File:** `ci-dashboard/server/services/nodes/manual-trigger-node.js`

Implementasi nyata: parse `initialData` dari config, inject ke output.

```javascript
async execute(context, config, node) {
  let triggerData = {};
  if (config.initialData) {
    try {
      triggerData = typeof config.initialData === 'object'
        ? config.initialData
        : JSON.parse(config.initialData);
    } catch (e) {
      this.log('warn', 'initialData is not valid JSON, using {}');
      triggerData = {};
    }
  }
  return {
    timestamp: new Date().toISOString(),
    triggered_by: context.user_id,
    trigger_type: 'manual',
    trigger_data: triggerData
  };
}
```

### RunTestNode

**File:** `ci-dashboard/server/services/nodes/run-test-node.js`

Implementasi nyata: spawn child process untuk menjalankan platform executor TypeScript via `ts-node` atau compiled JS.

```javascript
async execute(context, config, node) {
  // Validasi config
  if (!config.platform) throw new Error('Configuration error: platform is required');
  if (!config.test_data_file) throw new Error('Configuration error: test_data_file is required');
  if (!config.platform_url) throw new Error('Configuration error: platform_url is required');

  // Verifikasi file test data ada
  const fs = require('fs');
  if (!fs.existsSync(config.test_data_file)) {
    throw new Error(`Test data file not found: ${config.test_data_file}`);
  }

  // Map platform ke executor
  const platformMap = {
    'webchat': 'webchat-v3',
    'telegram': 'telegram',
    'facebook': 'facebook',
    'instagram': 'instagram',
    'dhai': 'dhai'
  };
  const executorName = platformMap[config.platform] || config.platform;

  // Jalankan platform executor via child process
  const { execSync } = require('child_process');
  const result = JSON.parse(execSync(
    `node -e "require('./dist/platforms/${executorName}').run(${JSON.stringify(config)})"`,
    { cwd: process.cwd(), timeout: 300000 }
  ));

  // Simpan ke database
  const runId = await this.createTestRun(context, config, result.test_id);

  return { ...result, run_id: runId };
}
```

### AIEvaluateNode

**File:** `ci-dashboard/server/services/nodes/ai-evaluate-node.js`

Implementasi nyata: panggil AI provider API menggunakan credentials dari env vars.

```javascript
async execute(context, config, node) {
  const provider = config.ai_provider;
  const apiKeyMap = {
    'gemini': process.env.GEMINI_API_KEY,
    'groq': process.env.GROQ_API_KEY,
    'openai': process.env.OPENAI_API_KEY,
    'cerebras': process.env.CEREBRAS_API_KEY
  };

  const apiKey = apiKeyMap[provider];
  if (!apiKey) throw new Error(`API key for ${provider} is not configured`);

  const input = this.getInput(context, 'input') || this.getInput(context, 'test_result');
  const results = input?.results || [];
  const threshold = config.scoring_threshold || 0.7;

  // Evaluasi setiap item menggunakan AI provider
  const evaluations = await Promise.all(results.map(async (item) => {
    const score = await this.callAIProvider(provider, apiKey, item, config.custom_prompt, threshold);
    return { ...item, ...score, ai_provider: provider };
  }));

  const avgScore = evaluations.reduce((s, e) => s + e.ai_score, 0) / evaluations.length;
  const passCount = evaluations.filter(e => e.ai_passed).length;

  return {
    run_id: input?.run_id || null,
    evaluations,
    avg_ai_score: Math.round(avgScore * 100) / 100,
    pass_count: passCount,
    fail_count: evaluations.length - passCount,
    total_evaluated: evaluations.length,
    threshold,
    provider,
    status: 'completed'
  };
}
```

### ConditionNode

**File:** `ci-dashboard/server/services/nodes/condition-node.js`

Perubahan: tambah dukungan operator perbandingan eksplisit dan template syntax `{{ $json.field }}`.

```javascript
async execute(context, config, node) {
  const input = this.getInput(context, 'input');

  // Resolve template variables
  const value1 = this.resolveTemplate(config.value1, input);
  const value2 = this.resolveTemplate(config.value2, input);

  // Evaluasi berdasarkan operator
  const result = this.compare(value1, config.comparison, value2);

  return {
    expression: `${config.value1} ${config.comparison} ${config.value2}`,
    result,
    routed_to: result ? 'true' : 'false'
  };
}

resolveTemplate(value, input) {
  if (typeof value !== 'string') return value;
  return value.replace(/\{\{\s*\$json\.([^}]+)\s*\}\}/g, (_, path) => {
    return path.split('.').reduce((obj, key) => obj?.[key], input) ?? value;
  });
}

compare(v1, operator, v2) {
  const n1 = parseFloat(v1), n2 = parseFloat(v2);
  switch (operator) {
    case 'equal': return v1 == v2;
    case 'not_equal': return v1 != v2;
    case 'greater_than': return n1 > n2;
    case 'less_than': return n1 < n2;
    case 'greater_than_or_equal': return n1 >= n2;
    case 'less_than_or_equal': return n1 <= n2;
    case 'contains': return String(v1).includes(String(v2));
    case 'not_contains': return !String(v1).includes(String(v2));
    default: return false;
  }
}
```

### WaitNode

**File:** `ci-dashboard/server/services/nodes/wait-node.js`

Perubahan: tambah validasi batas, pass-through input, dan output `actual_duration_ms`.

```javascript
async execute(context, config, node) {
  const input = this.getInput(context, 'input');
  let duration = config.duration_seconds ?? 5;

  if (duration > 3600) throw new Error('Wait duration cannot exceed 3600 seconds');
  if (duration < 0) {
    this.log('warn', 'duration_seconds < 0, using 0');
    duration = 0;
  }

  const startTime = Date.now();
  await new Promise(resolve => setTimeout(resolve, duration * 1000));

  return {
    waited_seconds: duration,
    actual_duration_ms: Date.now() - startTime,
    input_passthrough: input
  };
}
```

### TransformDataNode

**File:** `ci-dashboard/server/services/nodes/transform-data-node.js`

Perubahan: implementasi sandbox dengan `vm` module, timeout 10 detik, helper functions.

```javascript
const vm = require('vm');

async execute(context, config, node) {
  const input = this.getInput(context, 'input');
  const items = Array.isArray(input) ? input : [input];

  const sandbox = {
    items,
    context: { execution_id: context.execution_id, user_id: context.user_id },
    JSON, Math, Date, Array, Object, String, Number, console: { log: () => {} }
  };

  const script = new vm.Script(`(function() { ${config.jsCode} })()`);
  const vmContext = vm.createContext(sandbox);

  try {
    const result = await Promise.race([
      Promise.resolve(script.runInContext(vmContext)),
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Transform code execution timeout (10s)')), 10000)
      )
    ]);
    return result;
  } catch (err) {
    if (err.message.includes('timeout')) throw err;
    throw new Error(`Transform code execution failed: ${err.message}`);
  }
}
```

### GenerateReportNode

**File:** `ci-dashboard/server/services/nodes/generate-report-node.js`

Perubahan: implementasi nyata menggunakan template EJS dan excel generator.

```javascript
async execute(context, config, node) {
  const input = this.getInput(context, 'test_result') || this.getInput(context, 'input');

  if (!input || (!input.run_id && !input.results)) {
    throw new Error('Invalid input: test results are required to generate a report');
  }

  const format = config.report_format || 'html';
  const baseName = config.output_filename || `report-${Date.now()}`;
  const filename = `${baseName}.${format}`;
  const outputDir = path.join(__dirname, '../../../../artifacts');
  const filePath = path.join(outputDir, filename);

  fs.mkdirSync(outputDir, { recursive: true });

  if (format === 'html') {
    const template = fs.readFileSync(path.join(__dirname, '../../../../../template/template.ejs'), 'utf8');
    const html = ejs.render(template, { data: input });
    fs.writeFileSync(filePath, html);
  } else if (format === 'excel') {
    // Gunakan excel-report-generator
    await generateExcelReport(input, filePath);
  } else if (format === 'json') {
    fs.writeFileSync(filePath, JSON.stringify(input, null, 2));
  }

  const fileSize = fs.statSync(filePath).size;
  const artifactId = await this.saveArtifact(input.run_id, format, filename, filePath, fileSize);

  return { artifact_id: artifactId, filename, file_path: filePath, file_size: fileSize,
           download_url: `/api/artifacts/${artifactId}/download`, format };
}
```

### SendNotificationNode

**File:** `ci-dashboard/server/services/nodes/send-notification-node.js`

Perubahan: tambah dukungan channel `telegram` dan `email` di samping `dashboard`.

```javascript
async execute(context, config, node) {
  const input = this.getInput(context, 'input') || {};
  const processedTitle = this.substituteVariables(config.title, input, context);
  const processedMessage = this.substituteVariables(config.message, input, context);

  const channel = config.channel || 'dashboard';
  let result;

  switch (channel) {
    case 'dashboard':
      result = await this.sendDashboardNotification(context, config, processedTitle, processedMessage);
      break;
    case 'telegram':
      result = await this.sendTelegramNotification(config, processedTitle, processedMessage);
      break;
    case 'email':
      result = await this.sendEmailNotification(config, processedTitle, processedMessage);
      break;
    default:
      throw new Error(`Unsupported notification channel: ${channel}`);
  }

  return result;
}
```

---

