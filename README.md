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
session/    # Session files
```

## Commands

```bash
npm run build    # Compile TypeScript
npm start        # Run tests
```

## License

ISC
