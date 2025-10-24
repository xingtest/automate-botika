# 🤖 Multi-Platform Chatbot Testing

Aplikasi testing otomatis untuk chatbot multi-platform menggunakan TypeScript + Playwright.

## ✨ Features

- 🎯 **Multi-Platform Support**: Webchat, Telegram, Instagram, Facebook, DHAI
- 🤖 **AI-Powered Evaluation**: Gemini AI untuk evaluasi otomatis
- 📊 **Comprehensive Reports**: HTML Dashboard + Excel Report
- 📸 **Screenshot Capture**: Bukti visual setiap test
- ⚡ **Real-time Updates**: Report ter-update secara incremental
- 🎨 **Beautiful UI**: Dashboard interaktif dengan dark mode

## 🚀 Quick Start

### Baru Pertama Kali?

**Ikuti tutorial lengkap di** → [`QUICK_START.md`](QUICK_START.md)

Tutorial step-by-step dari download sampai test pertama!

### Sudah Familiar?

**⚠️ PENTING:** Tidak cukup hanya `npm install`!

```bash
# 1. Install dependencies
npm install

# 2. Install browser (WAJIB!)
npx playwright install chromium

# 3. Setup configuration
copy .env.example .env
# Edit .env: set PLATFORM, FILENAME, TARGET_URL

# 4. Buat test data
# Buat file: assets/json/testdata.json

# 5. Build & Run
npm run build
npm start
```

**📖 Lihat:** [`LANGKAH_INSTALL.md`](LANGKAH_INSTALL.md) untuk penjelasan detail

## 📚 Documentation

### Getting Started
- 🚀 **[LANGKAH_INSTALL.md](LANGKAH_INSTALL.md)** - ⭐ Langkah install super simple!
- 📦 **[WHAT_TO_INSTALL.md](WHAT_TO_INSTALL.md)** - Apa yang perlu diinstall?
- 📖 **[QUICK_START.md](QUICK_START.md)** - Tutorial lengkap untuk pemula
- 🔧 **[INSTALLATION.md](INSTALLATION.md)** - Instalasi detail dan troubleshooting
- 📋 **[DEPENDENCIES.md](DEPENDENCIES.md)** - Detail semua dependencies

### Advanced
- 📊 **[docs/EVALUATION_SYSTEM.md](docs/EVALUATION_SYSTEM.md)** - Sistem evaluasi
- 📝 **[docs/EVALUATION_CRITERIA.md](docs/EVALUATION_CRITERIA.md)** - Kriteria evaluasi
- 📑 **[docs/EXCEL_REPORT.md](docs/EXCEL_REPORT.md)** - Format Excel report

## 🎯 Supported Platforms

| Platform | Status | Description |
|----------|--------|-------------|
| 🌐 **Webchat** | ✅ Ready | Web-based chatbot testing |
| 💬 **Telegram** | ✅ Ready | Telegram bot testing |
| 📱 **Instagram** | ✅ Ready | Instagram DM testing |
| 👥 **Facebook** | ✅ Ready | Facebook Messenger testing |
| 🎤 **DHAI** | ✅ Ready | Digital Human AI testing |

## 🎮 Usage

### 1. Setup Platform

Edit `.env`:

```env
# Pilih platform
PLATFORM=webchat

# File test data
FILENAME=testdata.json

# Tester info
TESTER_NAME=Your Name

# Target URL
TARGET_URL=https://your-chatbot-url.com

# Gemini AI (Optional)
ENABLE_GEMINI_EVALUATION=false
API_KEY_GEMINI=your_api_key
```

### 2. Prepare Test Data

Buat file `assets/json/testdata.json`:

```json
[
  {
    "no": "1",
    "title": "Greeting",
    "question": "Halo",
    "response_kb": "Halo! Ada yang bisa saya bantu?"
  }
]
```

### 3. Run Test

```bash
npm start
```

### 4. View Report

Report otomatis terbuka di browser atau buka manual:
```
report/html/{test-folder}/dashboard.html
```

## Structure

```
src/        # TypeScript source
dist/       # Compiled JavaScript (auto-generated)
assets/     # Test data
report/     # Test results
  ├── html/       # HTML & Excel reports (per test)
  │   └── {TesterName}_{platform}_{date}_{time}-{idTest}/
  │       ├── dashboard.html
  │       ├── report.xlsx
  │       └── screenshots/
  ├── json/       # JSON data
  └── screenshoot/ # Temporary screenshots
session/    # Session files
```

## Reports

Setiap test akan menghasilkan 2 jenis report secara real-time:
- **HTML Report**: Dashboard interaktif dengan visualisasi
- **Excel Report**: Spreadsheet dengan 3 sheets (Summary, Test Results, Statistics)

### Scoring System
- **Format**: 0.000 - 1.000 (3 desimal)
- **Pass Threshold**: ≥ 0.75 (Hijau)
- **Fail Threshold**: < 0.75 (Merah)
- **Auto-Evaluation**: Gemini AI atau keyword matching

Report di-generate secara incremental (real-time) dan disimpan dalam satu folder per test.

## Commands

```bash
npm run build    # Compile TypeScript
npm start        # Run tests
npm run report   # Generate report dari test terakhir
```

## License

ISC
