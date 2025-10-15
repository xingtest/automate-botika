"""
Script untuk generate Instagram Session menggunakan Browser Chrome.
Script ini akan membuka Chrome dan meminta Anda login manual ke Instagram.
Setelah login, session akan disimpan otomatis.
"""

from selenium import webdriver
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
from selenium.webdriver.chrome.service import Service
from selenium.webdriver.chrome.options import Options
from webdriver_manager.chrome import ChromeDriverManager
from instagrapi import Client
from pathlib import Path
import time
import json

print("=" * 60)
print("INSTAGRAM SESSION GENERATOR (CHROME)")
print("=" * 60)
print("\nScript ini akan membuka Chrome untuk login ke Instagram.")
print("Silakan login secara manual di browser yang terbuka.")
print("Setelah login berhasil, session akan disimpan otomatis.")
print("=" * 60)
print()

input("Tekan ENTER untuk membuka Chrome dan mulai login Instagram...")

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
    
    # Go to Instagram
    driver.get("https://www.instagram.com/")
    print("✅ Chrome terbuka. Silakan login ke Instagram secara manual.")
    print("   Tunggu hingga Anda berhasil masuk ke halaman utama Instagram.")
    print()
    
    # Wait for user to login manually
    print("⏳ Menunggu Anda login...")
    print("   (Script akan otomatis mendeteksi setelah Anda berhasil login)")
    
    # Wait until user is logged in (check for presence of home page elements)
    WebDriverWait(driver, 300).until(
        EC.presence_of_element_located((By.XPATH, "//a[@href='/']"))
    )
    
    print("\n✅ Login terdeteksi! Mengambil cookies...")
    time.sleep(3)
    
    # Get cookies from browser
    cookies = driver.get_cookies()
    
    # Extract sessionid from cookies
    sessionid = None
    for cookie in cookies:
        if cookie['name'] == 'sessionid':
            sessionid = cookie['value']
            break
    
    if not sessionid:
        raise Exception("Session ID tidak ditemukan dalam cookies!")
    
    print(f"✅ Session ID ditemukan: {sessionid[:20]}...")
    
    # Create Instagram client and login with sessionid
    print("\n🔄 Membuat session file...")
    cl = Client()
    cl.set_user_agent("Instagram 219.0.0.12.117 Android")
    
    # Set cookies to client
    cl.set_settings({
        "cookies": {cookie['name']: cookie['value'] for cookie in cookies}
    })
    
    # Login using sessionid
    cl.login_by_sessionid(sessionid)
    
    # Save session
    session_file = Path("session/session-instagram.json")
    session_file.parent.mkdir(exist_ok=True)
    cl.dump_settings(session_file)
    
    print(f"\n✅ Session berhasil disimpan ke: {session_file}")
    print(f"   Username: {cl.username}")
    print(f"   User ID: {cl.user_id}")
    print("\n📋 Session file sudah siap digunakan untuk testing Instagram!")
    print("\n⚠️  PENTING:")
    print("   - Jangan bagikan session file ini ke siapapun!")
    print("   - Session file memberikan akses penuh ke akun Instagram Anda.")
    print("\n✅ Selesai! Anda sekarang bisa menjalankan test Instagram.")
    
    # Close browser
    print("\n🔄 Menutup browser dalam 5 detik...")
    time.sleep(5)
    driver.quit()
    
except Exception as e:
    print(f"\n❌ Error: {e}")
    print("\nKemungkinan penyebab:")
    print("1. Timeout - Anda tidak login dalam waktu yang ditentukan")
    print("2. Instagram meminta verifikasi tambahan")
    print("3. Cookies tidak dapat diambil")
    print("\nSolusi:")
    print("- Pastikan Anda login dengan benar di browser")
    print("- Tunggu hingga halaman utama Instagram muncul")
    print("- Coba jalankan script lagi")
    
    try:
        driver.quit()
    except:
        pass
