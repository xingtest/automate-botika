# Artifact Management System

## Overview

Sistem artifact management memungkinkan Anda untuk:
- ✅ **Automatic Storage**: Setiap test selesai, semua artifacts (reports, screenshots) tersimpan di database
- ✅ **Central Access**: Akses semua artifacts dari dashboard tanpa perlu ke GitHub
- ✅ **Easy Download**: Download artifacts kapan saja dalam satu klik
- ✅ **Organized Storage**: Artifacts di-organize berdasarkan run_id dan artifact type

## Architecture

### Database Schema

**Tabel `artifacts`** - Menyimpan metadata dan file artifacts:
```sql
CREATE TABLE artifacts (
  id INT AUTO_INCREMENT PRIMARY KEY,
  run_id INT NOT NULL,
  artifact_type VARCHAR(50) NOT NULL,  -- json, html, excel, screenshot, etc
  filename VARCHAR(255) NOT NULL,
  file_path VARCHAR(500) NOT NULL,
  file_size INT DEFAULT 0,
  mime_type VARCHAR(100) DEFAULT 'application/octet-stream',
  description TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (run_id) REFERENCES test_runs(id) ON DELETE CASCADE
);
```

### Storage Location

File artifacts disimpan di:
```
<project-root>/artifacts/
├── 1_1709120400000_testuser_facebook_2025-02-23_10-30-45-summary.json
├── 1_1709120401000_testuser_facebook_2025-02-23_10-30-45-report.html
├── 1_1709120402000_screenshot_001.png
└── ...
```

File naming format: `{run_id}_{timestamp}_{filename}`

## API Endpoints

### 1. List Artifacts

**GET** `/api/artifacts?run_id=1&artifact_type=json`

```bash
curl http://localhost:3001/api/artifacts?run_id=1
```

**Response:**
```json
{
  "data": [
    {
      "id": 1,
      "run_id": 1,
      "artifact_type": "json",
      "filename": "test_facebook_001-summary.json",
      "file_path": "1_1709120400000_summary.json",
      "file_size": 15234,
      "mime_type": "application/json",
      "description": "Test summary report in JSON format",
      "created_at": "2025-02-23T10:30:45.000Z"
    }
  ]
}
```

### 2. Upload Artifact

**POST** `/api/artifacts`

```bash
curl -X POST http://localhost:3001/api/artifacts \
  -H "Content-Type: application/json" \
  -d '{
    "run_id": 1,
    "artifact_type": "json",
    "filename": "report.json",
    "file_data": "base64_encoded_content",
    "description": "Test summary report"
  }'
```

**Response:**
```json
{
  "id": 1,
  "run_id": 1,
  "artifact_type": "json",
  "filename": "report.json",
  "file_size": 15234,
  "mime_type": "application/json"
}
```

### 3. Download Artifact

**GET** `/api/artifacts/{id}/download`

```bash
curl http://localhost:3001/api/artifacts/1/download > report.json
```

Returns file dengan proper `Content-Type` dan `Content-Disposition` headers.

### 4. View Artifact (untuk HTML/JSON)

**GET** `/api/artifacts/{id}/view`

```bash
curl http://localhost:3001/api/artifacts/1/view
```

For JSON/HTML artifacts, returns content langsung untuk viewing di browser.

### 5. Delete Artifact

**DELETE** `/api/artifacts/{id}`

```bash
curl -X DELETE http://localhost:3001/api/artifacts/1
```

## Integration dengan Test Execution

Setelah test selesai, artifacts automatically di-upload:

### 1. Test Execution Flow

```
main.ts
  ├─ Run tests (webchat, telegram, instagram, etc)
  ├─ Save results to JSON
  ├─ Push to database → get run_id
  └─ Call ArtifactHelper.uploadTestArtifacts(run_id)
      ├─ Upload JSON report
      ├─ Upload HTML report
      └─ Upload screenshots
```

### 2. Artifact Types

Supported artifact types:
- **json** - Test summary report (JSON)
- **html** - Detailed HTML report with charts
- **screenshot** - Test execution screenshots
- **excel** - Excel report (jika di-generate)
- **pdf** - PDF report (jika di-generate)
- **zip** - Compressed artifacts

## Dashboard UI

### View Artifacts

1. Go to **DB Results** tab
2. Click pada test run yang ingin dilihat
3. Modal akan muncul dengan **Artifacts** section
4. Lihat semua artifacts organized by type

### Download Artifacts

Di dalam modal run details:
1. Cari artifact yang ingin di-download
2. Klik tombol **Download** (icon panah)
3. File akan otomatis di-download

## Usage Examples

### TypeScript - Upload Artifacts

```typescript
import { ArtifactHelper } from './utils/artifact-helper';

// Upload single artifact
await ArtifactHelper.uploadArtifact(
  'http://localhost:3001',
  1,                    // run_id
  'json',               // artifact_type
  'report.json',        // filename
  './report/report.json'
);

// Upload all test artifacts
await ArtifactHelper.uploadTestArtifacts(
  'http://localhost:3001',
  1,                    // run_id
  'testuser_facebook_2025-02-23_10-30-45',  // reportFilename
  'test_abc123'         // idTest
);
```

### JavaScript - Download Artifacts

```javascript
// Load artifacts for a test run
const artifacts = await ArtifactManager.loadArtifacts(1);

// Download specific artifact
await ArtifactManager.downloadArtifact(1, 'report.json');
```

## Database Queries

### Get all artifacts for a run

```sql
SELECT * FROM artifacts WHERE run_id = 1;
```

### Get artifacts by type

```sql
SELECT * FROM artifacts WHERE run_id = 1 AND artifact_type = 'screenshot';
```

### Calculate total storage used

```sql
SELECT 
  artifact_type,
  COUNT(*) as count,
  SUM(file_size) as total_size,
  ROUND(SUM(file_size) / 1024 / 1024, 2) as size_mb
FROM artifacts
GROUP BY artifact_type;
```

### Delete old artifacts

```sql
DELETE FROM artifacts 
WHERE created_at < DATE_SUB(NOW(), INTERVAL 30 DAY);
```

## Best Practices

### 1. Storage Management

Monitor storage usage:
```sql
SELECT 
  ROUND(SUM(file_size) / 1024 / 1024, 2) as total_size_mb 
FROM artifacts;
```

Cleanup old artifacts secara periodic:
```sql
DELETE FROM artifacts 
WHERE created_at < DATE_SUB(NOW(), INTERVAL 90 DAY);
```

### 2. File Organization

- JSON reports untuk analysis dan automation
- HTML reports untuk sharing dan documentation
- Screenshots untuk bug reporting dan verification
- Keep Excel/PDF untuk formal reports

### 3. Bandwidth Optimization

Untuk large files, consider:
- Compress artifacts sebelum upload
- Upload only necessary artifacts (skip raw screenshots jika ada video)
- Implement incremental backup strategy

## Troubleshooting

### Artifacts tidak muncul di dashboard

1. Check backend connection:
   ```bash
   curl http://localhost:3001/api/health
   ```

2. Verify database connection:
   ```bash
   curl http://localhost:3001/api/artifacts?run_id=1
   ```

3. Check artifact file exists:
   ```bash
   ls -la artifacts/
   ```

### Download tidak working

1. Verify artifact ID exists:
   ```sql
   SELECT * FROM artifacts WHERE id = 1;
   ```

2. Check file_path exists:
   ```bash
   ls -la artifacts/1_*
   ```

3. Check MIME type correct:
   ```bash
   file artifacts/1_*
   ```

### Storage full

Monitor disk space:
```bash
df -h
du -sh artifacts/
```

Cleanup strategy:
1. Archive old artifacts
2. Delete artifacts older than 90 days
3. Implement retention policy

## Environment Variables

Add ke `.env`:

```env
# Artifact Storage
ARTIFACT_MAX_SIZE=104857600  # 100MB limit per artifact
ARTIFACT_RETENTION_DAYS=90   # Keep artifacts for 90 days
```

## Performance Metrics

Typical artifact sizes:
- JSON Report: 50-200 KB
- HTML Report: 500 KB - 2 MB (with charts)
- Screenshots (per image): 100-500 KB
- Total per test run: 1-5 MB (depending on test complexity)

## Future Enhancements

- [ ] S3/Cloud storage integration
- [ ] Artifact compression (ZIP)
- [ ] Batch download multiple artifacts
- [ ] Artifact versioning/history
- [ ] Email artifact delivery
- [ ] API key for external access
- [ ] Artifact search/filtering
- [ ] Storage usage analytics
