# 🤖 Multi-Platform Chatbot Testing

Aplikasi testing otomatis untuk chatbot multi-platform menggunakan TypeScript + Playwright.

## ✨ Features

- 🎯 **Multi-Platform Support**: Webchat (v2 & v3), Telegram, Instagram, Facebook, DHAI, WhatsApp
- 🤖 **Multi-Provider AI Evaluation**: Evaluasi otomatis didukung oleh Gemini, Groq (Llama), dan Cerebras AI dengan sistem *fallback* otomatis (`AI_PROVIDER=multi`).
- 📊 **Comprehensive Reports**: HTML Dashboard + Excel Report
- 📸 **Screenshot Capture**: Bukti visual setiap test
- ⚡ **Real-time Updates**: Report ter-update secara incremental
- 🎨 **Beautiful UI**: Dashboard interaktif dengan dark mode
- 📈 **CI Dashboard**: Dashboard web terintegrasi dengan database PostgreSQL (Local & Supabase)
- 👻 **Headless Mode**: Menjalankan pengujian tanpa membuka UI browser (`HEADLESS=true`).

## 🚀 Quick Start

**⚠️ PENTING:** Tidak cukup hanya `npm install`!

```bash
# 1. Install dependencies
npm install

# 2. Install browser (WAJIB!)
npx playwright install chromium

# 3. Setup configuration
# Sesuaikan .env berdasarkan template di bawah.

# 4. Buat test data
# Buat file CSV/Excel di: assets/csv/ atau assets/xlsx/
# Contoh: assets/csv/testdata.csv

# 5. Build & Run
npm run build

# Menjalankan test sesuai platform (Baca bagian Commands)
npm run test:webchat
```

## 🎯 Supported Platforms

| Platform | Command | Keterangan Tambahan |
|----------|---------|---------------------|
| 🌐 **Webchat** | `npm run test:webchat` | Web-based chatbot testing (v2) |
| 🌐 **Webchat V3** | `npm run test:webchat-v3` | Web-based chatbot testing (v3) |
| 💬 **Telegram** | `npm run test:telegram` | Butuh generate session via `npm run generate:telegram` |
| 📱 **Instagram** | `npm run test:instagram` | Instagram DM testing |
| 👥 **Facebook** | `npm run test:facebook` | Facebook Messenger testing (via Fanpage ID) |
| 🎤 **DHAI** | `npm run test:dhai` | Digital Human AI testing |
| 📞 **WhatsApp** | `npm run test:whatsapp` | Butuh export cookies ke `session-whatsapp.json` |

> **Catatan Tambahan**: Di `package.json` terdapat perintah `test:dhai-wakeup`, namun fitur tersebut belum sepenuhnya didukung di `src/main.ts` saat ini.

## 🎮 Konfigurasi Lengkap `.env`

File `.env` di proyek ini sangat ekstensif. Berikut adalah semua konfigurasi yang bisa Anda atur:

### 1. Pengaturan Utama
```env
PLATFORM=webchat           # Pilihan: webchat, webchat-v3, telegram, instagram, facebook, dhai, whatsapp
HEADLESS=true              # Set false jika ingin melihat browser berjalan
FILENAME=testdata.csv      # Nama file di assets/csv atau assets/xlsx
TESTER_NAME=Nama Anda
GREETING="hai"             # Sapaan pertama ke bot
GREETING_2="Leo"           # Sapaan kedua (Opsional)
```

### 2. Konfigurasi Spesifik Platform
```env
# Webchat (v2 & v3)
TARGET_URL="https://chat.botika.online/..."
WEBCHAT_V3_TARGET_URL="https://chat.botika.online/v3/..."
WEBCHAT_NAME="Tester Automation"
WEBCHAT_EMAIL="tester@example.com"
WEBCHAT_PHONE="081234567890"

# Facebook
TARGET_FANPAGE_ID="114552848299710"

# Telegram
TARGET_BOT_USERNAME="TestingNewIntegrasiBot"
API_ID="your_api_id"
API_HASH="your_api_hash"

# Instagram
TARGET_USERNAME="username_target"

# WhatsApp
WHATSAPP_TARGET_NUMBER="628xxxxxxxxxx"
WHATSAPP_SESSION_FILE="session/session-whatsapp.json"

# DHAI
DHAI_TARGET_URL="https://client.botika.online/..."
DHAI_WAKEUP_URL="https://client.botika.online/..."
DHAI_WAKE_WORD="halo luna"
```

### 3. Multi-Provider AI Evaluator
Sistem ini menggunakan AI untuk mengevaluasi jawaban bot.
```env
AI_PROVIDER=multi # Pilihan: gemini | groq | cerebras | multi

# Gemini
ENABLE_GEMINI_EVALUATION=true
API_KEY_GEMINI="your_api_key"
GEMINI_MODEL=gemini-3.1-flash-lite-preview

# Groq
ENABLE_GROQ_EVALUATION=true
GROQ_API_KEY="your_groq_key"
GROQ_MODEL=llama-3.1-8b-instant

# Cerebras
ENABLE_CEREBRAS_EVALUATION=true
CEREBRAS_API_KEY="your_cerebras_key"
CEREBRAS_MODEL=llama3.1-8b
```

### 4. CI Dashboard & Database (PostgreSQL / Supabase)
Digunakan untuk integrasi web reporting & riwayat test:
```env
DB_HOST=localhost
DB_PORT=5432
DB_USER=postgres
DB_PASSWORD=admin
DB_NAME=automation_testing
BACKEND_PORT=3001
BACKEND_URL=http://localhost:3001

# Opsi Supabase
# DATABASE_URL="postgresql://..."
# DIRECT_URL="postgresql://..."
```

## 📂 Struktur Folder
Sistem sekarang menggunakan file data (seperti `testdata.csv`) di folder `assets`.
```
src/           # TypeScript source
dist/          # Compiled JavaScript (auto-generated)
assets/        # Test data
  ├── csv/     # Data test format CSV
  └── xlsx/    # Data test format Excel
ci-dashboard/  # Server dan Dashboard CI
report/        # Test results
  ├── html/       # HTML & Excel reports (per test)
  │   └── {TesterName}_{platform}_{date}_{time}-{idTest}/
  │       ├── dashboard.html
  │       ├── report.xlsx
  │       └── screenshots/
session/       # Session files (Telegram/WhatsApp)
```

## 💻 Commands Lengkap

```bash
# Core Commands
npm run build            # Compile TypeScript
npm start                # Run tests sesuai konfigurasi .env

# Platform Specific Testing (Auto build + run + report)
npm run test:webchat
npm run test:webchat-v3
npm run test:telegram
npm run test:facebook
npm run test:whatsapp
npm run test:instagram
npm run test:dhai

# Sessions Generate
npm run generate:telegram # Generate session login untuk Telegram testing

# CI Dashboard & Database
npm run server           # Start CI Dashboard server
npm run server:dev       # Start server in watch mode
npm run db:setup         # Initialize database
npm run db:export        # Export database data
npm run db:import        # Import database data

# Report & Indexing
npm run report           # Generate report dari test terakhir
npm run report:index     # Generate HTML index dari semua report yang ada
```

## 📋 Reports & Scoring
Setiap test akan menghasilkan report secara *real-time*:
- **Format Skor**: 0.000 - 1.000 (Pass Threshold: ≥ 0.7)
- **Auto-Evaluation**: Multi-Provider AI (Gemini/Groq/Cerebras)
- Jika push ke DB berhasil (melalui CI Dashboard), data akan tersimpan di database lokal/Supabase.
