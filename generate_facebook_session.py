"""
Script untuk generate Facebook Session menggunakan Browser Chrome.
Script ini akan membuka Chrome dan meminta Anda login manual ke Facebook.
Setelah login, session akan disimpan otomatis.
"""

from selenium import webdriver
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
from selenium.webdriver.chrome.service import Service
from selenium.webdriver.chrome.options import Options
from webdriver_manager.chrome import ChromeDriverManager
from pathlib import Path
import time
import json

print("=" * 60)
print("FACEBOOK SESSION GENERATOR (CHROME)")
print("=" * 60)
print("\nScript ini akan membuka Chrome untuk login ke Facebook.")
print("Silakan login secara manual di browser yang terbuka.")
print("Setelah login berhasil, session akan disimpan otomatis.")
print("=" * 60)
print()

input("Tekan ENTER untuk membuka Chrome dan mulai login Facebook...")

try:
    # Setup Chrome options
    chrome_options = Options()
    chrome_options.add_argument("--start-maximized")
    chrome_options.add_argument("--disable-blink-features=AutomationControlled")
    chrome_options.add_experimental_option("excludeSwitches", ["enable-automation"])
    chrome_options.add_experimental_option('useAutomationExtension', False)
    
    # Initialize driver
    print("\n🔄 Membuka Chrome...")
    driver = webdriver.Chrome(service=Service(ChromeDriverManager().install()), options=chrome_options)
    
    # Go to Facebook
    driver.get("https://www.facebook.com/")
    print("✅ Chrome terbuka. Silakan login ke Facebook secara manual.")
    print("   Tunggu hingga Anda berhasil masuk ke halaman utama Facebook.")
    print()
    
    # Wait for user to login manually
    print("⏳ Menunggu Anda login...")
    print("   (Script akan otomatis mendeteksi setelah Anda berhasil login)")
    
    # Wait until user is logged in (check for presence of home page elements)
    WebDriverWait(driver, 300).until(
        EC.presence_of_element_located((By.XPATH, "//a[@aria-label='Home' or @aria-label='Beranda']"))
    )
    
    print("\n✅ Login terdeteksi! Mengambil cookies...")
    time.sleep(3)
    
    # Get cookies from browser
    cookies = driver.get_cookies()
    
    # Save cookies to session file
    session_file = Path("session/session-facebook.json")
    session_file.parent.mkdir(exist_ok=True)
    
    with open(session_file, 'w') as f:
        json.dump(cookies, f, indent=4)
    
    print(f"\n✅ Session berhasil disimpan ke: {session_file}")
    print(f"   Total cookies: {len(cookies)}")
    print("\n📋 Session file sudah siap digunakan untuk testing Facebook!")
    print("\n⚠️  PENTING:")
    print("   - Jangan bagikan session file ini ke siapapun!")
    print("   - Session file memberikan akses penuh ke akun Facebook Anda.")
    print("\n✅ Selesai! Anda sekarang bisa menjalankan test Facebook.")
    
    # Close browser
    print("\n🔄 Menutup browser dalam 5 detik...")
    time.sleep(5)
    driver.quit()
    
except Exception as e:
    print(f"\n❌ Error: {e}")
    print("\nKemungkinan penyebab:")
    print("1. Timeout - Anda tidak login dalam waktu yang ditentukan")
    print("2. Facebook meminta verifikasi tambahan")
    print("3. Cookies tidak dapat diambil")
    print("\nSolusi:")
    print("- Pastikan Anda login dengan benar di browser")
    print("- Tunggu hingga halaman utama Facebook muncul")
    print("- Coba jalankan script lagi")
    
    try:
        driver.quit()
    except:
        pass
