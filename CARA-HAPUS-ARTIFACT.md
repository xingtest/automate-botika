# 🗑️ Panduan Menghapus Artifact Lama

## Pilihan 1: Menggunakan Script Otomatis (Paling Mudah)

### Langkah 1: Buat GitHub Token

1. Buka: https://github.com/settings/tokens
2. Klik **"Generate new token"** → **"Generate new token (classic)"**
3. Isi form:
   - **Note**: `Delete Artifacts`
   - **Expiration**: 7 days
   - **Scope**: Centang ✅ **`repo`** (Full control of private repositories)
4. Klik **"Generate token"** di bawah
5. **COPY token** yang muncul (hanya muncul sekali!)

### Langkah 2: Jalankan Script

Buka PowerShell di folder ini, lalu jalankan:

```powershell
.\delete-old-artifacts.ps1 -Token "YOUR_TOKEN_HERE"
```

Ganti `YOUR_TOKEN_HERE` dengan token yang Anda copy tadi.

**Contoh:**
```powershell
.\delete-old-artifacts.ps1 -Token "ghp_xxxxxxxxxxxxxxxxxxxx"
```

### Langkah 3: Tunggu Selesai

Script akan:
- ✅ Menampilkan semua artifact
- ✅ Menghitung total ukuran
- ✅ Menghapus artifact lama (menyimpan 2 terbaru)
- ✅ Menampilkan berapa MB yang dibebaskan

### Langkah 4: Tunggu 10-15 Menit

GitHub perlu waktu untuk menghitung ulang storage usage.

### Langkah 5: Jalankan Workflow Lagi

Setelah 10-15 menit, workflow akan bisa upload artifact tanpa error!

---

## Pilihan 2: Hapus Manual via Web (Lebih Lambat)

1. Buka: https://github.com/katanyaaman/migrasiplaywright12345/actions
2. Klik pada workflow run yang sudah selesai
3. Scroll ke bawah ke bagian **"Artifacts"**
4. Klik ikon **🗑️** (tempat sampah) di sebelah artifact
5. Konfirmasi delete
6. Ulangi untuk 5-10 workflow run lama

---

## ❓ FAQ

**Q: Berapa artifact yang harus dihapus?**  
A: Minimal 5-10 artifact lama untuk mengosongkan storage.

**Q: Apakah artifact yang dihapus bisa dikembalikan?**  
A: Tidak, artifact yang dihapus hilang permanen.

**Q: Berapa lama GitHub menghitung ulang storage?**  
A: Biasanya 10-15 menit, maksimal 6-12 jam.

**Q: Apakah script aman?**  
A: Ya, script hanya menghapus artifact, tidak mengubah code atau setting lain.

---

## 🎯 Setelah Artifact Dihapus

1. ✅ Storage quota akan kosong
2. ✅ Workflow bisa upload artifact lagi
3. ✅ Report bisa didownload
4. ✅ Masalah selesai!

Artifact baru akan otomatis terhapus setelah 3 hari, jadi tidak akan penuh lagi.
