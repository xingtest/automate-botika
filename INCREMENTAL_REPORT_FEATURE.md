# Incremental HTML Report Generation

## Problem
Sebelumnya, jika test gagal atau berhenti di tengah jalan, report HTML tidak akan di-generate sama sekali. Data yang sudah berhasil di-test akan hilang.

## Solution
Report HTML sekarang di-generate secara **incremental** setiap kali ada data baru (setiap pertanyaan selesai).

## How It Works

### 1. Auto-Generate After Each Question
Setiap kali `writeJsonDataBot()` dipanggil (setelah setiap pertanyaan selesai), sistem akan:
- Menyimpan data ke JSON
- **Langsung generate HTML report** dengan data yang sudah ada
- Copy screenshot ke folder report

### 2. Report Structure
```
report/
├── html/
│   └── {reportFilename}-{idTest}/
│       ├── dashboard.html          ← HTML report
│       ├── screenshot1.png         ← Screenshots (copied)
│       └── screenshot2.png
├── json/
│   ├── {reportFilename}-{idTest}.json
│   ├── {reportFilename}-{idTest}-summary.json
│   └── {reportFilename}-{idTest}-chart.json
└── screenshoot/
    ├── screenshot1.png             ← Original screenshots
    └── screenshot2.png
```

### 3. Silent Mode
`generateHtmlReportIncremental()` berjalan dalam **silent mode**:
- Tidak ada console log yang mengganggu output test
- Jika gagal, tidak akan break test flow
- Retry otomatis di update berikutnya

### 4. Temporary Summary
Jika summary belum ada (test masih berjalan), sistem akan create temporary summary:
```typescript
{
  tester_name: 'In Progress...',
  end_time_test: 'In Progress...',
  duration: 'In Progress...',
  success: <count dari data yang sudah ada>,
  failed: <count dari data yang sudah ada>
}
```

### 5. Final Report
Di akhir test (finally block), sistem akan generate final report dengan:
- Summary lengkap
- Chart data
- Duration final
- Console log konfirmasi

## Benefits

✅ **Data tidak hilang** - Meskipun test gagal/berhenti, report tetap ada
✅ **Real-time monitoring** - Bisa lihat progress test dengan refresh HTML
✅ **No performance impact** - Generation cepat dan tidak mengganggu test
✅ **Automatic cleanup** - Screenshot otomatis di-copy ke folder report

## Usage

Tidak ada perubahan di cara penggunaan. Sistem bekerja otomatis:

```bash
npm start
```

Report akan tersedia di:
```
report/html/{tester_name}_{platform}_{date}_{time}-{testId}/dashboard.html
```

## Technical Details

### Functions
- `generateHtmlReportIncremental()` - Silent, dipanggil setiap data write
- `generateHtmlReport()` - Verbose, dipanggil di finally block
- `processTemplate()` - Template processing dengan relative path untuk screenshot

### Error Handling
- Silent fail di incremental generation
- Tidak break test flow jika HTML generation gagal
- Retry otomatis di update berikutnya
