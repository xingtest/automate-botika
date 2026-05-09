const BaseNode = require('./base-node');
const { pool: db } = require('../../db');
const fs = require('fs');
const path = require('path');

class RunTestNode extends BaseNode {
  constructor() {
    super({
      type: 'run-test',
      category: 'Execution',
      label: 'Run Test',
      description: 'Execute tests on specified platform',
      icon: 'fa-play-circle',
      color: '#8b5cf6',
      inputs: [
        { id: 'main', name: 'Input', dataType: 'any', required: false }
      ],
      outputs: [
        { id: 'main', name: 'Test Result', dataType: 'object', required: true },
        { id: 'error', name: 'Error', dataType: 'object', required: false }
      ],
      config_schema: [
        {
          key: 'platform',
          label: 'Platform',
          type: 'select',
          required: true,
          description: 'Platform chatbot yang akan diuji',
          options: [
            { label: 'WebChat', value: 'webchat' },
            { label: 'Telegram', value: 'telegram' },
            { label: 'Instagram', value: 'instagram' },
            { label: 'Facebook', value: 'facebook' },
            { label: 'DHAI', value: 'dhai' }
          ]
        },
        {
          key: 'test_data_file',
          label: 'Test Data File',
          type: 'file',
          required: false,
          description: 'Nama file CSV/Excel di folder ci-dashboard/assets/ (contoh: xlsx/Testing.xlsx) atau URL lengkap'
        },
        {
          key: 'tester_name',
          label: 'Tester Name',
          type: 'text',
          required: true,
          default: 'Workflow Bot',
          description: 'Nama yang akan digunakan sebagai pengirim pesan'
        },
        {
          key: 'greeting',
          label: 'Greeting Message',
          type: 'text',
          required: false,
          default: 'Haloo'
        },
        {
          key: 'platform_url',
          label: 'Platform URL',
          type: 'text',
          required: true,
          description: 'URL endpoint platform chatbot'
        }
      ]
    });
  }

  async execute(context, config, node) {
    // Validate required config fields
    if (!config.platform) throw new Error('Configuration error: platform is required');
    if (!config.platform_url) throw new Error('Configuration error: platform_url is required');

    // Check for input from previous nodes (e.g. Read Excel Node)
    const input = this.getInput(context, 'main');
    let testDataFile = config.test_data_file;

    if (input) {
      if (input.filePath) {
        testDataFile = input.filePath;
        this.log('info', `Using test data file from input path: ${testDataFile}`);
      } else if (input.file) {
        testDataFile = input.file;
        this.log('info', `Using test data file from input name: ${testDataFile}`);
      } else if (Array.isArray(input) || (input.results && Array.isArray(input.results))) {
        // Direct data input (e.g. from Transform Node)
        const data = Array.isArray(input) ? input : input.results;
        const tempDir = path.join(process.cwd(), 'ci-dashboard', 'assets', 'temp');
        if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir, { recursive: true });
        
        const tempFileName = `transformed_${Date.now()}.xlsx`;
        const tempPath = path.join(tempDir, tempFileName);
        
        const xlsx = require('xlsx');
        const ws = xlsx.utils.json_to_sheet(data);
        const wb = xlsx.utils.book_new();
        xlsx.utils.book_append_sheet(wb, ws, 'Sheet1');
        xlsx.writeFile(wb, tempPath);
        
        testDataFile = tempPath;
        this.log('info', `Created temporary test data file from transformed data: ${tempPath}`);
      }
    }

    if (!testDataFile) throw new Error('Configuration error: test_data_file is required');

    // Resolve test data file path relatif ke ci-dashboard/assets/
    // - Jika URL → download ke ci-dashboard/assets/temp/
    // - Jika relative path → resolve dari ci-dashboard/assets/
    // - Jika absolute path → gunakan langsung
    // - Strip prefix lama seperti "test-data/" jika ada
    const ciDashboardDir = path.join(process.cwd(), 'ci-dashboard');
    let inputFile = testDataFile;

    // Normalisasi: strip prefix lama yang tidak valid
    const oldPrefixes = ['test-data/', 'test-data\\', 'assets/xlsx/', 'assets\\xlsx\\', 'assets/csv/', 'assets\\csv\\'];
    for (const prefix of oldPrefixes) {
      if (inputFile.startsWith(prefix)) {
        inputFile = inputFile.slice(prefix.length);
        break;
      }
    }

    let resolvedDataPath;

    if (inputFile.startsWith('http')) {
      // Download ke ci-dashboard/assets/temp/
      const tempDir = path.join(ciDashboardDir, 'assets', 'temp');
      if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir, { recursive: true });
      resolvedDataPath = await this.ensureLocalFile(inputFile);
    } else if (path.isAbsolute(inputFile)) {
      resolvedDataPath = inputFile;
    } else {
      // Relative path: coba di assets/xlsx/ dulu, lalu assets/csv/, lalu assets/ langsung
      const candidates = [
        path.join(ciDashboardDir, 'assets', 'xlsx', inputFile),
        path.join(ciDashboardDir, 'assets', 'csv', inputFile),
        path.join(ciDashboardDir, 'assets', inputFile),
      ];
      resolvedDataPath = candidates.find(p => fs.existsSync(p));
      if (!resolvedDataPath) {
        const errorMsg = `Test data file not found. Dicari di:\n${candidates.join('\n')}`;
        await this.logTechnical(context, 'error', errorMsg);
        throw new Error(`Test data file not found: ${inputFile}. Pastikan file ada di ci-dashboard/assets/xlsx/`);
      }
    }

    // envfile.ts asli: path.join('assets', 'xlsx', filename)
    // Jadi FILENAME harus nama file saja (tanpa subfolder)
    // cwd child process = ci-dashboard/, jadi assets/xlsx/ resolve ke ci-dashboard/assets/xlsx/
    const filenameForEnv = path.basename(resolvedDataPath);

    await this.logTechnical(context, 'info', `Running test on platform: ${config.platform}`);
    await this.logTechnical(context, 'info', `Test data: ${resolvedDataPath}`);

    const testId = `test_${Date.now()}`;

    // Check if main.js exists
    const mainPath = path.join(process.cwd(), 'dist', 'main.js');
    if (!fs.existsSync(mainPath)) {
      const errorMsg = `Main executor not found at ${mainPath}. Please run 'npm run build' first.`;
      await this.logTechnical(context, 'error', errorMsg);
      throw new Error(errorMsg);
    }

    // Run platform executor via spawn (non-blocking)
    // cwd = ci-dashboard/ agar semua path relatif (report/json, assets/xlsx) mengarah ke ci-dashboard/
    const result = await this.runPlatformExecutor(context, mainPath, config, filenameForEnv, ciDashboardDir);

    // Ensure test_id is set
    if (!result.test_id) result.test_id = testId;

    // Save to database
    const runId = await this.createTestRun(context, config, result.test_id);

    await this.logTechnical(context, 'info', `Test completed successfully. Run ID: ${runId}`);
    return { ...result, run_id: runId };
  }

  /**
   * Run platform executor via spawn with timeout handling
   * cwd diset ke ci-dashboard/ agar semua path relatif (report/json, assets/xlsx)
   * otomatis mengarah ke dalam ci-dashboard/ tanpa perlu ubah src/
   */
  async runPlatformExecutor(context, distPath, config, filenameForEnv, ciDashboardDir) {
    const { spawn } = require('child_process');
    const TIMEOUT_MS = 300000; // 5 minutes

    return new Promise((resolve, reject) => {
      // Set environment variables — FILENAME relatif terhadap cwd (ci-dashboard/)
      const env = {
        ...process.env,
        FILENAME: filenameForEnv,                  // relatif dari ci-dashboard/assets/xlsx/
        TESTER_NAME: config.tester_name || 'Workflow Bot',
        GREETING: config.greeting || 'Haloo',
        GREETING_2: config.greeting2 || '',
        TARGET_URL: config.platform_url,           // main.ts reads TARGET_URL for webchat
        PLATFORM: config.platform,
        HEADLESS: 'true'
      };

      // mainPath adalah path absolut ke dist/main.js di root project
      const mainPath = path.join(process.cwd(), 'dist', 'main.js');

      if (!fs.existsSync(mainPath)) {
        reject(new Error(`Main executor not found at ${mainPath}`));
        return;
      }

      const proc = spawn(process.execPath, [mainPath, config.platform], {
        timeout: TIMEOUT_MS,
        encoding: 'utf8',
        env: env,
        // cwd = ci-dashboard/ → report/json dan assets/xlsx resolve ke ci-dashboard/
        cwd: ciDashboardDir
      });

      let stdout = '';
      let stderr = '';
      let timeoutId = null;
      let isTimedOut = false;

      // Set timeout handler
      timeoutId = setTimeout(() => {
        isTimedOut = true;
        proc.kill('SIGTERM');
        
        // Force kill after 5 seconds if still running
        setTimeout(() => {
          if (!proc.killed) {
            proc.kill('SIGKILL');
          }
        }, 5000);
      }, TIMEOUT_MS);

      // Collect stdout — log setiap baris ke DB agar muncul di dashboard
      proc.stdout.on('data', (data) => {
        const lines = data.toString().split('\n').filter(l => l.trim());
        for (const line of lines) {
          // Fire-and-wait: simpan ke DB tapi jangan block
          this.logTechnical(context, 'info', line.trim()).catch((err) => {
            console.error('[RunTestNode] Failed to save log:', err.message);
          });
        }
      });

      // Collect stderr — log sebagai warn
      proc.stderr.on('data', (data) => {
        const lines = data.toString().split('\n').filter(l => l.trim());
        for (const line of lines) {
          stderr += line + '\n';
          this.logTechnical(context, 'warn', line.trim()).catch((err) => {
            console.error('[RunTestNode] Failed to save stderr log:', err.message);
          });
        }
      });

      // Handle process exit
      proc.on('close', async (code) => {
        clearTimeout(timeoutId);

        if (isTimedOut) {
          const errorMsg = `Platform executor timed out after ${TIMEOUT_MS / 1000} seconds`;
          await this.logTechnical(context, 'error', errorMsg);
          reject(new Error(errorMsg));
          return;
        }

        if (code === 0) {
          // The main.js writes results to JSON files, we need to read them
          // For now, return a success result indicating the test ran
          // The actual results are in the report files
          try {
            const result = {
              test_id: `test_${Date.now()}`,
              platform: config.platform,
              status: 'completed',
              message: `Test executed successfully on ${config.platform}`,
              stdout_preview: stdout.substring(stdout.length - 500) // Last 500 chars
            };
            resolve(result);
          } catch (parseErr) {
            const errorMsg = `Test completed but failed to parse results: ${parseErr.message}`;
            await this.logTechnical(context, 'error', errorMsg);
            reject(new Error(errorMsg));
          }
        } else {
          const errorMsg = `Platform executor failed with code ${code}: ${stderr || 'unknown error'}`;
          await this.logTechnical(context, 'error', errorMsg);
          reject(new Error(errorMsg));
        }
      });

      // Handle spawn errors
      proc.on('error', async (err) => {
        clearTimeout(timeoutId);
        const errorMsg = `Failed to spawn platform executor: ${err.message}`;
        await this.logTechnical(context, 'error', errorMsg);
        reject(new Error(errorMsg));
      });
    });
  }

  async createTestRun(context, config, testId) {
    const result = await db.queryOriginal(
      `INSERT INTO test_runs (user_id, test_id, platform, tester_name, filename, url, run_title)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING id`,
      [
        context.user_id,
        testId,
        config.platform,
        config.tester_name,
        config.test_data_file,
        config.platform_url,
        `Workflow Test - ${config.platform}`
      ]
    );

    return result.rows[0].id;
  }
}

module.exports = RunTestNode;
