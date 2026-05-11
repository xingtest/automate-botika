# Panduan Membuat Node Baru

## Checklist Pembuatan Node

Sebelum membuat node baru, pastikan Anda mengikuti langkah-langkah berikut:

### 1. Struktur File Node

Buat file baru di direktori: `ci-dashboard/server/services/nodes/{node-type}-node.js`

**Contoh:** `read-excel-node.js` untuk node dengan type `read-excel`

### 2. Template Dasar Node

```javascript
const BaseNode = require('./base-node');

class NamaNode extends BaseNode {
  constructor() {
    super({
      type: 'nama-node', // PENTING: harus sesuai dengan nama file (tanpa -node.js)
      category: 'action', // action | control | transform
      label: 'Nama Node',
      description: 'Deskripsi singkat node',
      icon: 'fa-icon-name', // Icon dari Font Awesome
      color: '#hex-color',
      inputs: [
        { id: 'main', name: 'Nama Input', dataType: 'object', required: true }
      ],
      outputs: [
        { id: 'main', name: 'Nama Output', dataType: 'object', required: true }
      ],
      config_schema: [
        {
          key: 'parameter1',
          label: 'Parameter 1',
          type: 'text', // text | number | boolean | select | textarea | json
          required: true,
          default: 'nilai default',
          description: 'Deskripsi parameter'
        }
      ]
    });
  }

  async execute(context, config, node) {
    // Implementasi logika node di sini
    this.log('info', 'Menjalankan node...');
    
    try {
      // Dapatkan input dari node sebelumnya
      const inputData = this.getInput(context, 'main');
      
      // Lakukan pemrosesan
      const result = {
        success: true,
        data: inputData
      };
      
      this.log('info', 'Node berhasil dijalankan');
      return result;
      
    } catch (error) {
      this.log('error', `Gagal menjalankan node: ${error.message}`);
      throw error;
    }
  }
}

module.exports = NamaNode;
```

### 3. Verifikasi Otomatis

Sistem sekarang **otomatis mendeteksi node baru** tanpa perlu edit manual!

Yang Anda butuhkan:
- File node di direktori `nodes/` dengan format nama yang benar
- Ekspor class node dengan `module.exports`

### 4. Testing Node Baru

Setelah membuat node:

1. **Restart server** (jika menggunakan --watch, otomatis reload)
2. **Cek log server** untuk melihat apakah node terdaftar:
   ```
   [NodeRegistry] Found X node files
   [NodeRegistry] ✓ Registered node type: nama-node
   ```
3. **Validasi workflow** melalui API:
   ```
   GET /api/workflows/node-registry/status
   ```
4. **Jalankan workflow** yang menggunakan node baru

### 5. Troubleshooting

Jika node tidak terdeteksi:

| Problem | Solusi |
|---------|--------|
| "Node executor not found" | Pastikan nama file sesuai: `{node-type}-node.js` |
| Node tidak muncul di library | Periksa console log server |
| Error saat eksekusi | Pastikan method `execute()` diimplementasikan dengan benar |

### 6. Contoh Node yang Sudah Ada

- `manual-trigger-node.js` - Trigger manual
- `read-excel-node.js` - Baca file Excel/CSV
- `ai-evaluate-node.js` - Evaluasi dengan AI
- `playwright-webchat-node.js` - Test Playwright untuk webchat

### 7. Best Practices

1. **Gunakan logging yang jelas**: `this.log('info', 'Pesan')`, `this.log('error', 'Error')`
2. **Handle error dengan baik**: Gunakan try-catch dan lempar error yang jelas
3. **Documentasikan parameter**: Tambahkan deskripsi yang jelas di `config_schema`
4. **Gunakan tipe data yang sesuai**: Pilih `type` yang tepat untuk setiap parameter
5. **Test secara terpisah**: Test node sebelum mengintegrasikan ke workflow

---

## Catatan Penting

✅ **TIDAK PERLU** mengedit `node-registry.js` secara manual - sistem auto-detect!  
✅ **TIDAK PERLU** menambahkan require manual - sistem otomatis memuat semua file!  
✅ **PASTIKAN** nama file sesuai dengan `type` di schema!
