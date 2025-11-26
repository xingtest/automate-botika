# Script untuk menghapus artifact lama di GitHub Actions
# Jalankan script ini untuk membersihkan storage quota

param(
    [string]$Token = "",
    [string]$Owner = "katanyaaman",
    [string]$Repo = "migrasiplaywright12345",
    [int]$KeepLatest = 2  # Berapa artifact terbaru yang mau disimpan
)

Write-Host "🗑️  Script Penghapusan Artifact GitHub Actions" -ForegroundColor Cyan
Write-Host "================================================" -ForegroundColor Cyan
Write-Host ""

# Cek apakah token sudah diisi
if ([string]::IsNullOrEmpty($Token)) {
    Write-Host "❌ Error: GitHub Token belum diisi!" -ForegroundColor Red
    Write-Host ""
    Write-Host "Cara mendapatkan token:" -ForegroundColor Yellow
    Write-Host "1. Buka: https://github.com/settings/tokens" -ForegroundColor White
    Write-Host "2. Click 'Generate new token' → 'Generate new token (classic)'" -ForegroundColor White
    Write-Host "3. Beri nama: 'Delete Artifacts'" -ForegroundColor White
    Write-Host "4. Centang scope: 'repo' (full control)" -ForegroundColor White
    Write-Host "5. Click 'Generate token'" -ForegroundColor White
    Write-Host "6. Copy token yang muncul" -ForegroundColor White
    Write-Host ""
    Write-Host "Lalu jalankan script dengan:" -ForegroundColor Yellow
    Write-Host "  .\delete-old-artifacts.ps1 -Token 'YOUR_TOKEN_HERE'" -ForegroundColor Green
    Write-Host ""
    exit 1
}

# Setup headers
$headers = @{
    "Authorization" = "Bearer $Token"
    "Accept" = "application/vnd.github+json"
    "X-GitHub-Api-Version" = "2022-11-28"
}

try {
    # Get all artifacts
    Write-Host "📥 Mengambil daftar artifact..." -ForegroundColor Yellow
    $url = "https://api.github.com/repos/$Owner/$Repo/actions/artifacts?per_page=100"
    $response = Invoke-RestMethod -Uri $url -Headers $headers -Method Get
    
    $artifacts = $response.artifacts | Sort-Object -Property created_at -Descending
    $totalArtifacts = $artifacts.Count
    
    Write-Host "✅ Ditemukan $totalArtifacts artifact" -ForegroundColor Green
    Write-Host ""
    
    if ($totalArtifacts -eq 0) {
        Write-Host "ℹ️  Tidak ada artifact yang perlu dihapus" -ForegroundColor Cyan
        exit 0
    }
    
    # Calculate total size
    $totalSizeMB = ($artifacts | Measure-Object -Property size_in_bytes -Sum).Sum / 1MB
    Write-Host "📊 Total ukuran artifact: $([math]::Round($totalSizeMB, 2)) MB" -ForegroundColor Cyan
    Write-Host ""
    
    # Artifacts to delete (skip the latest N)
    $artifactsToDelete = $artifacts | Select-Object -Skip $KeepLatest
    $deleteCount = $artifactsToDelete.Count
    
    if ($deleteCount -eq 0) {
        Write-Host "ℹ️  Semua artifact masih baru, tidak ada yang perlu dihapus" -ForegroundColor Cyan
        exit 0
    }
    
    Write-Host "🗑️  Akan menghapus $deleteCount artifact (menyimpan $KeepLatest terbaru)" -ForegroundColor Yellow
    Write-Host ""
    
    # Confirm
    $confirm = Read-Host "Lanjutkan? (y/n)"
    if ($confirm -ne 'y') {
        Write-Host "❌ Dibatalkan" -ForegroundColor Red
        exit 0
    }
    
    Write-Host ""
    Write-Host "🔄 Menghapus artifact..." -ForegroundColor Yellow
    
    $deletedCount = 0
    $deletedSizeMB = 0
    
    foreach ($artifact in $artifactsToDelete) {
        try {
            $deleteUrl = "https://api.github.com/repos/$Owner/$Repo/actions/artifacts/$($artifact.id)"
            Invoke-RestMethod -Uri $deleteUrl -Headers $headers -Method Delete | Out-Null
            
            $deletedCount++
            $deletedSizeMB += $artifact.size_in_bytes / 1MB
            
            Write-Host "  ✅ Dihapus: $($artifact.name) ($([math]::Round($artifact.size_in_bytes / 1MB, 2)) MB)" -ForegroundColor Green
            
            # Rate limiting - tunggu sebentar antar request
            Start-Sleep -Milliseconds 500
        }
        catch {
            Write-Host "  ❌ Gagal hapus: $($artifact.name) - $($_.Exception.Message)" -ForegroundColor Red
        }
    }
    
    Write-Host ""
    Write-Host "✅ Selesai!" -ForegroundColor Green
    Write-Host "📊 Berhasil menghapus: $deletedCount artifact" -ForegroundColor Cyan
    Write-Host "💾 Storage yang dibebaskan: $([math]::Round($deletedSizeMB, 2)) MB" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "⏰ Tunggu 10-15 menit agar GitHub menghitung ulang storage usage" -ForegroundColor Yellow
    Write-Host "🚀 Setelah itu, Anda bisa jalankan workflow lagi!" -ForegroundColor Green
}
catch {
    Write-Host ""
    Write-Host "❌ Error: $($_.Exception.Message)" -ForegroundColor Red
    Write-Host ""
    
    if ($_.Exception.Message -match "401") {
        Write-Host "Token tidak valid atau sudah expired. Buat token baru!" -ForegroundColor Yellow
    }
}
