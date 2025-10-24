# Contributing Guide

Terima kasih atas minat Anda untuk berkontribusi! 🎉

## 🤝 Cara Berkontribusi

### 1. Report Issues

Jika menemukan bug atau punya saran:
1. Cek apakah issue sudah ada
2. Buat issue baru dengan detail:
   - Deskripsi masalah
   - Steps to reproduce
   - Expected vs Actual behavior
   - Screenshots (jika ada)
   - Environment (OS, Node version, dll)

### 2. Submit Pull Request

1. Fork repository
2. Create branch baru: `git checkout -b feature/nama-fitur`
3. Commit changes: `git commit -m 'Add: fitur baru'`
4. Push ke branch: `git push origin feature/nama-fitur`
5. Submit Pull Request

### 3. Code Style

- Gunakan TypeScript
- Follow existing code style
- Add comments untuk logic yang kompleks
- Update documentation jika perlu

## 📝 Development Setup

```bash
# Clone repository
git clone <repo-url>
cd migrasiplaywright12345

# Install dependencies
npm install
npx playwright install chromium

# Build
npm run build

# Test
npm start
```

## 🧪 Testing

Sebelum submit PR, pastikan:
- [ ] Code berhasil di-build tanpa error
- [ ] Test berjalan dengan baik
- [ ] Tidak ada breaking changes
- [ ] Documentation sudah diupdate

## 📚 Documentation

Jika menambah fitur baru, update:
- README.md
- QUICK_START.md (jika perlu)
- docs/ (jika perlu)

## 💡 Ideas for Contribution

- Add support untuk platform baru
- Improve evaluation algorithm
- Add more test data examples
- Improve documentation
- Fix bugs
- Optimize performance

## 📞 Contact

Jika ada pertanyaan, silakan buat issue atau contact maintainer.

Thank you! 🙏
