# 📦 Artifact Management - Quick Start Guide

## 🎯 Tujuan

Setiap selesai run test, **semua artifacts (reports, screenshots) otomatis tersimpan di database** dan bisa didownload kapan saja dari dashboard **tanpa perlu ke GitHub**.

---

## 🚀 Cara Kerja

### Flow Diagram

```
┌─────────────────────┐
│  Run Test Selesai   │
│  (main.ts)          │
└──────────┬──────────┘
           │
           ▼
┌─────────────────────┐
│ Generate Reports:   │
│ - JSON              │
│ - HTML              │
│ - Screenshots       │
└──────────┬──────────┘
           │
           ▼
┌─────────────────────┐
│ Push to Database    │
│ → Get run_id        │
└──────────┬──────────┘
           │
           ▼
┌─────────────────────┐
│ ArtifactHelper:     │
│ Upload all files    │
│ to DB & disk        │
└──────────┬──────────┘
           │
           ▼
┌─────────────────────┐
│ Dashboard UI        │
│ View & Download     │
│ Artifacts          │
└─────────────────────┘
```

---

## 📊 Database Structure

### Tabel: `artifacts`

```sql
CREATE TABLE artifacts (
  id INT                          -- Unique artifact ID
  run_id INT                      -- Link ke test_runs
  artifact_type VARCHAR(50)       -- json | html | screenshot | etc
  filename VARCHAR(255)           -- Original filename
  file_path VARCHAR(500)          -- Path on disk
  file_size INT                   -- File size in bytes
  mime_type VARCHAR(100)          -- Content type
  description TEXT                -- Optional description
  created_at TIMESTAMP            -- When uploaded
);
```

### Storage Layout

```
artifacts/                          (Physical disk storage)
├── 1_1709120400000_report.json
├── 1_1709120401000_report.html
├── 1_1709120402000_screenshot_001.png
├── 2_1709120500000_report.json
└── ...

automation_testing.artifacts        (Database metadata)
├── id=1, run_id=1, type=json, file_size=15KB
├── id=2, run_id=1, type=html, file_size=2MB
└── ...
```

---

## 🔌 API Endpoints

### List Artifacts for a Run

```http
GET /api/artifacts?run_id=1&artifact_type=json
```

**Response:**
```json
{
  "data": [
    {
      "id": 1,
      "run_id": 1,
      "artifact_type": "json",
      "filename": "testuser_facebook_2025-02-23_10-30-45-summary.json",
      "file_size": 15234,
      "mime_type": "application/json",
      "created_at": "2025-02-23T10:30:45Z"
    }
  ]
}
```

### Get Artifacts for Run

```http
GET /api/artifacts/run/1
```

### Download Artifact

```http
GET /api/artifacts/1/download
```

Returns file dengan proper headers:
- `Content-Type: application/json`
- `Content-Disposition: attachment; filename="..."`

### Upload Artifact

```http
POST /api/artifacts

{
  "run_id": 1,
  "artifact_type": "json",
  "filename": "custom-report.json",
  "file_data": "base64_encoded_content",
  "description": "Custom analysis"
}
```

### Delete Artifact

```http
DELETE /api/artifacts/1
```

---

## 💻 Dashboard Usage

### Step 1: Navigate to DB Results

Click **DB Results** tab di dashboard

![Screenshot would be here]

### Step 2: Click on Test Run

Click baris test run untuk membuka detail modal

```
┌─────────────────────────────────────────┐
│ DB Results Table                        │
├─────────────────────────────────────────┤
│ Test ID | Platform | Tester | Score... │
├─────────────────────────────────────────┤
│ test_facebook_001 | facebook | john ✓  │ ← CLICK
│ test_instagram_002 | instagram | jane   │
└─────────────────────────────────────────┘
```

### Step 3: View Run Details & Artifacts

Modal akan muncul:

```
╔═════════════════════════════════════════╗
║    Test Run Details #1                  ║
╠═════════════════════════════════════════╣
║ Platform: facebook                      ║
║ Tester: john                            ║
║ Test ID: test_facebook_001              ║
║ Score: 90.50                            ║
║ Status: ✅ PASSED                       ║
╠═════════════════════════════════════════╣
║ Artifacts (3)                           ║
╠─────────────────────────────────────────╣
║ JSON                                    ║
║ ┌─────────────────────────────────────┐ ║
║ │ 📄 report.json                      │ ║
║ │ 15 KB • Feb 23, 10:30 AM           │ ║ 
║ │ └─────────────────────────────────┘ ║
║ │ [Download ⬇️]                        │ ║
║ └─────────────────────────────────────┘ ║
║                                         ║
║ HTML                                    ║
║ ┌─────────────────────────────────────┐ ║
║ │ 📄 report.html                      │ ║
║ │ 2.3 MB • Feb 23, 10:31 AM          │ ║
║ │ Test report with detailed charts   │ ║
║ │ └─────────────────────────────────┘ ║
║ │ [Download ⬇️]                        │ ║
║ └─────────────────────────────────────┘ ║
║                                         ║
║ SCREENSHOT                              ║
║ ┌─────────────────────────────────────┐ ║
║ │ 🖼️ screenshot_001.png              │ ║
║ │ 234 KB • Feb 23, 10:30 AM          │ ║
║ │ Test screenshot: screenshot_001.pn │ ║
║ │ └─────────────────────────────────┘ ║
║ │ [Download ⬇️]                        │ ║
║ └─────────────────────────────────────┘ ║
╚═════════════════════════════════════════╝
```

### Step 4: Download Artifact

Klik tombol **Download** di artifact yang diinginkan

```
┌─────────────────────────────────────┐
│ 📄 report.json                      │
│ 15 KB • Feb 23, 10:30 AM           │
│ └─────────────────────────────────┘ │
│ [Download ⬇️] ← CLICK              │
└─────────────────────────────────────┘
```

File otomatis didownload ke **Downloads** folder.

---

## 🎯 Artifact Types

| Icon | Type | Description | Size | Use |
|------|------|-------------|------|-----|
| 📄 | **json** | Test summary data | 50-200 KB | Analysis, automation |
| 📄 | **html** | Full report with charts | 500 KB - 2 MB | Sharing, documentation |
| 🖼️ | **screenshot** | Test execution proof | 100-500 KB each | Bug reporting |
| 📊 | **excel** | Excel report | 1-5 MB | Formal reporting |
| 📑 | **pdf** | PDF export | varies | Distribution |
| 📦 | **zip** | Compressed archive | varies | Batch download |

---

## 🔧 Configuration

### Environment Variables

Add to `.env`:

```env
# Backend URL (default: http://localhost:3001)
BACKEND_URL=http://localhost:3001

# Optional - Retention policy
ARTIFACT_MAX_SIZE=104857600     # Max 100 MB per artifact
ARTIFACT_RETENTION_DAYS=90      # Keep 90 days
```

### Database

Automatic - schema sudah include di `schema.sql`:
- Table: `automation_testing.artifacts`
- Automatically created on first run

---

## 📝 Examples

### JavaScript - Load Artifacts

```javascript
// Get artifacts for test run
const artifacts = await ArtifactManager.loadArtifacts(1);

// Filter by type
const jsonReports = artifacts.filter(a => a.artifact_type === 'json');

// Check sizes
artifacts.forEach(a => {
  console.log(`${a.filename}: ${ArtifactManager.formatFileSize(a.file_size)}`);
});
```

### cURL - Download Artifact

```bash
# List artifacts
curl "http://localhost:3001/api/artifacts?run_id=1"

# Download specific artifact
curl "http://localhost:3001/api/artifacts/1/download" > report.json

# View JSON artifact
curl "http://localhost:3001/api/artifacts/1/view"
```

### SQL - Database Queries

```sql
-- Get all artifacts for a run
SELECT * FROM artifacts WHERE run_id = 1;

-- Count by type
SELECT artifact_type, COUNT(*) as cnt 
FROM artifacts 
GROUP BY artifact_type;

-- Total storage used
SELECT 
  ROUND(SUM(file_size) / 1024 / 1024, 2) as total_mb 
FROM artifacts;

-- Old artifacts for cleanup
SELECT * FROM artifacts 
WHERE created_at < DATE_SUB(NOW(), INTERVAL 90 DAY);
```

---

## ⚠️ Troubleshooting

### Problem: Artifacts tidak muncul

**Check 1:** Backend running?
```bash
curl http://localhost:3001/api/health
```

**Check 2:** Database connected?
```bash
curl "http://localhost:3001/api/artifacts?run_id=1"
```

**Check 3:** Artifacts folder exists?
```bash
ls -la artifacts/
```

### Problem: Download tidak jalan

**Solution 1:** Check artifact ID:
```sql
SELECT * FROM artifacts WHERE id = 1;
```

**Solution 2:** Check file exists:
```bash
ls -la artifacts/1_*
```

### Problem: Storage penuh

**Check storage:**
```bash
du -sh artifacts/
df -h
```

**Cleanup old:**
```sql
DELETE FROM artifacts 
WHERE created_at < DATE_SUB(NOW(), INTERVAL 90 DAY);
```

---

## 📊 Storage Management

### Monitor Usage

```sql
SELECT 
  ROUND(SUM(file_size) / 1024 / 1024, 2) as total_mb,
  COUNT(*) as total_files,
  artifact_type
FROM artifacts
GROUP BY artifact_type;
```

### Cleanup Policy

**Per 30 days:**
```sql
DELETE FROM artifacts 
WHERE created_at < DATE_SUB(NOW(), INTERVAL 30 DAY);
```

**Per 90 days:**
```sql
DELETE FROM artifacts 
WHERE created_at < DATE_SUB(NOW(), INTERVAL 90 DAY);
```

**Archive old to backup:**
```bash
# Backup artifacts older than 30 days
tar -czf backup-artifacts-old.tar.gz artifacts/
# Then cleanup
```

---

## ✅ Checklist

- [x] Database table created (`artifacts`)
- [x] API endpoints implemented
- [x] Auto-upload on test complete
- [x] Dashboard UI updated
- [x] Download functionality working
- [x] Artifact storage folder ready
- [x] Documentation complete

---

## 🎉 You're All Set!

Sekarang setiap test yang selesai:

1. ✅ Artifacts otomatis di-upload
2. ✅ Tersimpan di database
3. ✅ Bisa diakses dari dashboard
4. ✅ Bisa didownload kapan saja
5. ✅ **Tidak perlu ke GitHub lagi!**

---

**Last Updated:** February 23, 2026  
**Status:** ✅ Production Ready
