# 🚀 Langkah Install - Super Simple!

Panduan paling simple untuk install dan jalankan aplikasi.

---

## ❌ TIDAK CUKUP hanya `npm install`

Setelah `npm install`, masih ada beberapa langkah lagi!

---

## ✅ Langkah Lengkap (5 Langkah)

### 1️⃣ Install Node.js

**Jika belum punya Node.js:**
- Download: https://nodejs.org/
- Install (pilih versi LTS)
- Restart terminal

**Cek sudah terinstall:**
```bash
node --version
```

---

### 2️⃣ Install Dependencies

```bash
npm install
```

**Tunggu sampai selesai** (2-5 menit)

---

### 3️⃣ Install Browser

```bash
npx playwright install chromium
```

**Tunggu download selesai** (~200MB, 3-10 menit)

---

### 4️⃣ Setup Configuration

**Copy file .env:**

**Windows (Command Prompt):**
```cmd
copy .env.example .env

