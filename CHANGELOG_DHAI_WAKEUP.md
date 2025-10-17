# Changelog - DHAI Wake Up Word Response Extraction

## Perubahan yang Dilakukan

### ✅ Modifikasi Response Extraction
**Tujuan**: Hanya mengambil response bubble DHAI yang baru setelah pertanyaan terkirim, bukan seluruh bubble content.

### 📝 Detail Perubahan

#### 1. **Method `getReply()` - Diperbaiki**
- ✅ Tracking `previousLength` sebelum menunggu response baru
- ✅ Update `currentResponseLength` setelah mendapat response baru
- ✅ Logging yang lebih jelas untuk debugging

#### 2. **Method `waitForValidResponse()` - Ditingkatkan**
- ✅ Tracking perubahan length dengan lebih akurat
- ✅ Menunggu response stabil (tidak bertambah lagi) sebelum extract
- ✅ Memanggil method baru `extractNewResponse()` untuk extract hanya response baru

#### 3. **Method `extractNewResponse()` - BARU**
```typescript
static extractNewResponse(fullBubbleContent: string, previousLength: number): string
```

**Fungsi**:
- Mengambil hanya konten baru setelah `previousLength`
- Filter timestamp (format `HH:MM`)
- Filter line yang terlalu pendek (< 3 karakter)
- Return hanya response text yang valid

**Cara Kerja**:
1. Ambil substring dari `previousLength` sampai akhir
2. Split menjadi lines
3. Filter timestamp dan line pendek
4. Return line pertama yang valid sebagai response

### 🔄 Flow Baru

```
1. Pertanyaan 1 dikirim via TTS
   ├─ previousLength = 0
   ├─ Response: "Halo, apa kabar?"
   └─ currentResponseLength = 100 (update)

2. Pertanyaan 2 dikirim via TTS  
   ├─ previousLength = 100 (dari pertanyaan 1)
   ├─ Bubble sekarang: "Halo, apa kabar?\n14:30\nSaya baik, terima kasih"
   ├─ Extract HANYA: "Saya baik, terima kasih" ✅
   └─ currentResponseLength = 150 (update)

3. Pertanyaan 3 dikirim via TTS
   ├─ previousLength = 150 (dari pertanyaan 2)
   └─ Extract HANYA response baru ✅
```

### ✨ Keuntungan

1. **Akurat**: Hanya mengambil response untuk pertanyaan yang baru dikirim
2. **Bersih**: Tidak ada timestamp atau response lama yang ikut
3. **Reliable**: Menunggu response stabil sebelum extract
4. **Traceable**: Logging yang jelas untuk debugging

### 📊 Sebelum vs Sesudah

#### ❌ Sebelum
```
Response untuk pertanyaan 2:
"Halo, apa kabar?
14:30
Saya baik, terima kasih
14:31"
```

#### ✅ Sesudah
```
Response untuk pertanyaan 2:
"Saya baik, terima kasih"
```

### 🎯 Yang Tidak Berubah

- ✅ Wake word masih dikirim untuk setiap pertanyaan
- ✅ TTS flow tetap sama
- ✅ Screenshot dan reporting tetap sama
- ✅ Tracking response length untuk session

---

**Tanggal**: 17 Oktober 2025
**File Modified**: `src/platforms/dhai-wakeup.ts`
