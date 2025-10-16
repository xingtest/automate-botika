"""
Script untuk generate Instagram Session yang lebih robust.
Versi 2 dengan multiple methods dan error handling yang lebih baik.
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
import getpass

def method_1_browser_session():
    """Method 1: Generate session using browser login (existing method)"""
    print("=" * 60)
    print("METHOD 1: BROWSER SESSION GENERATOR")
    print("=" * 60)
    
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
        
        # Wait for user to login manually
        print("⏳ Menunggu Anda login...")
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
        
        # Create Instagram client
        cl = Client()
        cl.set_user_agent("Instagram 269.0.0.18.75 Android (26/8.0.0; 480dpi; 1080x1920; OnePlus; 6T Dev; devitron; qcom; en_US; 314665256)")
        cl.delay_range = [5, 10]
        
        # Set cookies to client
        cl.set_settings({
            "cookies": {cookie['name']: cookie['value'] for cookie in cookies}
        })
        
        # Try to login using sessionid
        try:
            cl.login_by_sessionid(sessionid)
            print(f"✅ Login berhasil sebagai: {cl.username}")
        except Exception as e:
            print(f"⚠️ Login gagal, tapi session tetap disimpan: {e}")
        
        # Save session
        session_file = Path("session/session-instagram.json")
        session_file.parent.mkdir(exist_ok=True)
        cl.dump_settings(session_file)
        
        print(f"\n✅ Session berhasil disimpan ke: {session_file}")
        
        # Close browser
        driver.quit()
        return True
        
    except Exception as e:
        print(f"\n❌ Error: {e}")
        try:
            driver.quit()
        except:
            pass
        return False

def method_2_username_password():
    """Method 2: Generate session using username and password"""
    print("=" * 60)
    print("METHOD 2: USERNAME/PASSWORD LOGIN")
    print("=" * 60)
    
    try:
        username = input("Masukkan username Instagram: ")
        password = getpass.getpass("Masukkan password Instagram: ")
        
        if not username or not password:
            print("❌ Username dan password harus diisi!")
            return False
        
        print("\n🔄 Mencoba login dengan username/password...")
        
        cl = Client()
        cl.set_user_agent("Instagram 269.0.0.18.75 Android (26/8.0.0; 480dpi; 1080x1920; OnePlus; 6T Dev; devitron; qcom; en_US; 314665256)")
        cl.delay_range = [5, 10]
        
        # Try to login
        cl.login(username, password)
        
        print(f"✅ Login berhasil sebagai: {cl.username}")
        
        # Save session
        session_file = Path("session/session-instagram.json")
        session_file.parent.mkdir(exist_ok=True)
        cl.dump_settings(session_file)
        
        print(f"✅ Session berhasil disimpan ke: {session_file}")
        return True
        
    except Exception as e:
        print(f"❌ Login gagal: {e}")
        return False

def test_session():
    """Test the generated session"""
    print("\n" + "=" * 60)
    print("TESTING SESSION")
    print("=" * 60)
    
    try:
        session_file = Path("session/session-instagram.json")
        if not session_file.exists():
            print("❌ Session file tidak ditemukan!")
            return False
        
        cl = Client()
        cl.load_settings(session_file)
        
        # Test basic functionality
        print("🔄 Testing session...")
        
        # Test 1: Get user info
        try:
            user_info = cl.user_info(cl.user_id)
            print(f"✅ User info: {user_info.username} ({user_info.full_name})")
        except Exception as e:
            print(f"⚠️ User info test failed: {e}")
        
        # Test 2: Get followers count (less sensitive than timeline)
        try:
            user_info = cl.user_info(cl.user_id)
            print(f"✅ Followers: {user_info.follower_count}")
        except Exception as e:
            print(f"⚠️ Followers test failed: {e}")
        
        print("✅ Session test completed!")
        return True
        
    except Exception as e:
        print(f"❌ Session test failed: {e}")
        return False

def main():
    print("INSTAGRAM SESSION GENERATOR V2")
    print("Pilih method untuk generate session:")
    print("1. Browser Login (Manual)")
    print("2. Username/Password Login")
    print("3. Test Existing Session")
    
    choice = input("\nPilih method (1/2/3): ").strip()
    
    if choice == "1":
        success = method_1_browser_session()
    elif choice == "2":
        success = method_2_username_password()
    elif choice == "3":
        success = test_session()
        return
    else:
        print("❌ Pilihan tidak valid!")
        return
    
    if success:
        print("\n🎉 Session berhasil dibuat!")
        test_choice = input("Ingin test session sekarang? (y/n): ").strip().lower()
        if test_choice == 'y':
            test_session()
    else:
        print("\n😞 Gagal membuat session. Coba method lain.")

if __name__ == "__main__":
    main()