# Multi-Platform Chatbot Testing

TypeScript + Playwright automation untuk testing chatbot.

## Platforms

- ✅ Webchat
- ✅ Telegram
- ✅ Facebook
- ✅ Instagram
- ✅ DHAI
- ✅ DHAI Wake-up Word (dengan TTS)

## Quick Start

```bash
# Install
npm install
npx playwright install chromium

# Configure
copy .env.example .env
# Edit .env

# Run
npm run build
npm start
```

## Testing

Edit `.env` untuk pilih platform:

```env
PLATFORM=webchat     # atau: telegram, facebook, instagram, dhai, dhai-wakeup
FILENAME=testdhai.json
TESTER_NAME=Your Name
TARGET_URL=https://your-url.com

# Untuk DHAI Wake-up Word
DHAI_WAKEUP_URL=https://your-dhai-url.com
DHAI_WAKE_WORD=halo luna
```

Lalu jalankan:
```bash
npm start
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
