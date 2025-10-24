# 📦 Apa yang Perlu Diinstall?

Panduan singkat dan jelas tentang apa saja yang harus diinstall untuk menjalankan aplikasi ini.

---

## ✅ WAJIB INSTALL (Required)

### 1. Node.js (v18 atau lebih baru)

**Apa itu?** Runtime JavaScript untuk menjalankan aplikasi

**Download:** https://nodejs.org/

**Pilih:** Versi "LTS" (Long Term Support)

**Cara Install:**
1. Download installer
2. Jalankan installer
3. Klik Next, Next, Finish
4. Restart terminal/command prompt

**Cek sudah terinstall:**
```bash
node --version
# Harus muncul: v18.x.x atau lebih tinggi

npm --version
# Harus muncul: 9.x.x atau lebih tinggi
```

**Size:** ~100MB

---

### 2. NPM Dependencies (Otomatis)

**Apa itu?** Library dan package yang dibutuhkan aplikasi

**Install dengan:**
```bash
npm install
```

**Tunggu sampai selesai** (2-5 menit, tergantung internet)

**Yang akan terinstall:**
- Playwright (browser automation)
- TypeScript (compiler)
- dotenv (environment variables)
- ejs (template engine)
- telegram (Telegram client)
- uuid (ID generator)
- xlsx (Excel handler)
- Dan lain-lain

**Size:** ~300MB

---

### 3. Chromium Browser

**Apa itu?** Browser untuk menjalankan test automation

**Install dengan:**
```bash
npx playwright install chromium
```

**Tunggu download selesai** (~200MB)

**Size:** ~200MB

---

## 🎯 OPTIONAL (Tidak Wajib)

### 1. Python (v3.8 atau lebih baru)

**Apa itu?** Untuk menjalankan script Python tambahan (jika ada)

**Download:** https://www.python.org/

**Install Python dependencies:**
```bash
pip install -r requirements.txt
```

**Kapan perlu?** Hanya jika menggunakan Python scripts

**Size:** ~100MB

---

### 2. Git

**Apa itu?** Version control untuk clone repository

**Download:** https://git-scm.com/

**Kapan perlu?** Jika mau clone dari Git repository

**Size:** ~50MB

---

### 3. Visual Studio Code

**Apa itu?** Text editor untuk edit code

**Download:** https://code.visualstudio.com/

**Kapan perlu?** Untuk edit file .env dan test data

**Alternatif:** Notepad++, Sublime Text, atau text editor lainnya

**Size:** ~100MB

---

## 📊 Total Disk Space

### Minimal (Hanya yang Wajib)
```
Node.js:        ~100MB
node_modules:   ~300MB
Chromium:       ~200MB
--------------------------
TOTAL:          ~600MB
```

### Full (Dengan Optional)
```
Node.js:        ~100MB
node_modules:   ~300MB
Chromium:       ~200MB
Python:         ~100MB
Git:            ~50MB
VS Code:        ~100MB
--------------------------
TOTAL:          ~850MB
```

---

## 🚀 Urutan Install (Step by Step)

### Step 1: Install Node.js
1. Download dari https://nodejs.org/
2. Install (pilih versi LTS)
3. Restart terminal
4. Cek: `node --version`

### Step 2: Install Dependencies
```bash
# Di folder aplikasi, jalankan:
npm install
```

### Step 3: Install Browser
```bash
npx playwright install chromium
```

### Step 4: Verify
```bash
# Cek semua sudah terinstall:
node --version
npm --version
npx playwright --version
```

---

## ✅ Checklist Install

Centang jika sudah selesai:

- [ ] Node.js v18+ terinstall
- [ ] npm v9+ terinstall
- [ ] `npm install` berhasil (tidak ada error)
- [ ] Chromium browser terinstall
- [ ] Semua verification command berhasil

---

## ❓ FAQ

### Q: Apakah perlu install Python?
**A:** Tidak wajib. Hanya jika ada Python scripts tambahan.

### Q: Apakah perlu install Git?
**A:** Tidak wajib. Hanya jika mau clone dari repository.

### Q: Berapa lama proses install?
**A:** 
- Node.js: 2-5 menit
- npm install: 2-5 menit
- Chromium: 3-10 menit (tergantung internet)
- **Total: 10-20 menit**

### Q: Berapa besar download?
**A:** Total ~600MB untuk yang wajib

### Q: Apakah perlu koneksi internet?
**A:** Ya, untuk download semua dependencies

### Q: Bisa install offline?
**A:** Tidak recommended. Butuh internet untuk download.

---

## 🐛 Troubleshooting

### "node: command not found"
**Solusi:** Install Node.js dari https://nodejs.org/

### "npm install" error
**Solusi:**
```bash
npm cache clean --force
npm install
```

### "playwright install" error
**Solusi:**
```bash
npx playwright install chromium --force
```

### Disk space tidak cukup
**Solusi:** Free up minimal 1GB disk space

---

## 📞 Butuh Bantuan?

Jika masih bingung atau ada error:

1. **Cek dokumentasi lengkap:**
   - `QUICK_START.md` - Tutorial step by step
   - `INSTALLATION.md` - Instalasi detail
   - `DEPENDENCIES.md` - Info dependencies

2. **Cek troubleshooting:**
   - `INSTALLATION.md` bagian Troubleshooting

3. **Verify installation:**
   ```bash
   node --version
   npm --version
   npx playwright --version
   ```

---

## 🎉 Sudah Install Semua?

Jika semua checklist sudah ✅, lanjut ke:

**→ `QUICK_START.md`** untuk tutorial lengkap cara pakai aplikasi!

---

## 📝 Summary

**Yang WAJIB:**
1. ✅ Node.js (v18+)
2. ✅ npm install
3. ✅ Chromium browser

**Yang OPTIONAL:**
- Python (jika ada Python scripts)
- Git (jika clone dari repository)
- VS Code (untuk edit code)

**Total Size:** ~600MB (minimal)

**Total Time:** ~10-20 menit

**Internet:** Required

**Setelah Install:** Lanjut ke `QUICK_START.md`

---

Happy Installing! 🚀
