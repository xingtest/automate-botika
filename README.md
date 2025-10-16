# Multi-Platform Chatbot Testing

TypeScript + Playwright automation untuk testing chatbot.

## Platforms

- ✅ Webchat
- ✅ Telegram
- ✅ Facebook
- ✅ Instagram
- ✅ DHAI

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
PLATFORM=webchat     # atau: telegram, facebook, instagram, dhai
FILENAME=testdhai.json
TESTER_NAME=Your Name
TARGET_URL=https://your-url.com
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
