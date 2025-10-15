"""
Script untuk generate Telegram Session String menggunakan Telethon.
Jalankan script ini untuk mendapatkan session string yang akan digunakan di .env
"""

from telethon.sync import TelegramClient
from telethon.sessions import StringSession
import os
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

# Ambil API credentials dari .env
API_ID = os.getenv("API_ID", "29690079")
API_HASH = os.getenv("API_HASH", "695b27c3cb9721cf522d99b871de5912")

print("=" * 60)
print("TELEGRAM SESSION STRING GENERATOR")
print("=" * 60)
print(f"\nAPI ID: {API_ID}")
print(f"API HASH: {API_HASH[:10]}...")
print("\nPastikan Anda memiliki akses ke akun Telegram Anda.")
print("Anda akan diminta memasukkan:")
print("1. Nomor telepon (format internasional, contoh: +6281234567890)")
print("2. Kode verifikasi yang dikirim ke Telegram Anda")
print("3. Password 2FA (jika diaktifkan)")
print("=" * 60)
print()

try:
    # Membuat client dengan StringSession kosong
    with TelegramClient(StringSession(), API_ID, API_HASH) as client:
        print("\n✅ Berhasil terhubung ke Telegram!")
        session_string = client.session.save()
        
        # Save to .env file automatically
        print("\n🔄 Menyimpan session string ke file .env...")
        try:
            with open('.env', 'r', encoding='utf-8') as f:
                env_content = f.read()
            
            # Replace TELEGRAM_SESSION value
            import re
            new_content = re.sub(
                r'TELEGRAM_SESSION="[^"]*"',
                f'TELEGRAM_SESSION="{session_string}"',
                env_content
            )
            
            with open('.env', 'w', encoding='utf-8') as f:
                f.write(new_content)
            
            print("✅ Session string berhasil disimpan ke .env")
        except Exception as e:
            print(f"⚠️  Gagal menyimpan otomatis: {e}")
            print("\nSession String Anda:")
            print("-" * 60)
            print(session_string)
            print("-" * 60)
            print("\n📋 Salin session string di atas dan paste ke file .env")
            print("   pada baris: TELEGRAM_SESSION=\"<paste_disini>\"")
        
        print("\n⚠️  PENTING: Jangan bagikan session string ini ke siapapun!")
        print("   Session string ini memberikan akses penuh ke akun Telegram Anda.")
        print("\n✅ Selesai! Anda sekarang bisa menjalankan test Telegram.")
        
except Exception as e:
    print(f"\n❌ Error: {e}")
    print("\nPastikan:")
    print("1. API_ID dan API_HASH sudah benar")
    print("2. Nomor telepon dalam format internasional (+62...)")
    print("3. Kode verifikasi yang Anda masukkan benar")
