import time
from selenium.webdriver.common.by import By
from selenium.webdriver.common.keys import Keys
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC

def start_chat(driver):
    """
    Memulai obrolan dengan mengikuti alur lengkap: Tap to Start -> Klik tombol kedua.
    """
    try:
        # 1. Klik tombol "Tap to Start"
        tap_to_start_button = WebDriverWait(driver, 30).until(
            EC.element_to_be_clickable((By.XPATH, "//button[contains(., 'Tap to Start')]"))
        )
        tap_to_start_button.click()
        print("Tombol 'Tap to Start' diklik.")
        time.sleep(2) # Beri jeda agar antarmuka berikutnya muncul

        # 2. Klik tombol interaksi kedua menggunakan JavaScript untuk menghindari intersepsi
        interaction_button = WebDriverWait(driver, 20).until(
            EC.presence_of_element_located((By.XPATH, "(//button)[3]"))
        )
        driver.execute_script("arguments[0].click();", interaction_button)
        print("Tombol interaksi kedua diklik via JavaScript.")

        # 3. Tunggu hingga textarea muncul
        WebDriverWait(driver, 30).until(
            EC.presence_of_element_located((By.TAG_NAME, "textarea"))
        )
        print("Antarmuka obrolan DHAI (Luna) siap.")
    except Exception as e:
        print(f"Error saat memulai obrolan DHAI (Luna): {e}")
        raise

def send_message(driver, message):
    """
    Mengirim pesan dengan mengetik di textarea dan menekan Enter.
    """
    try:
        textarea = WebDriverWait(driver, 20).until(
            EC.element_to_be_clickable((By.TAG_NAME, "textarea"))
        )
        textarea.click()
        textarea.clear()
        textarea.send_keys(message)
        time.sleep(1)  # Beri jeda sejenak
        textarea.send_keys(Keys.ENTER)
        print(f"Pesan terkirim: {message}")
    except Exception as e:
        print(f"Error saat mengirim pesan di DHAI: {e}")
        raise

def get_reply(driver):
    """
    Mengambil balasan terbaru dari bot dengan mencari elemen chat message terakhir.
    """
    try:
        # Tunggu sebentar untuk memastikan respons bot sudah muncul
        time.sleep(3)
        
        # Coba cari semua elemen pesan dalam chat
        try:
            # Cari semua div yang berisi pesan chat
            chat_messages = driver.find_elements(By.XPATH, "//div[contains(@class, 'message') or contains(@class, 'chat') or contains(@class, 'bubble')]")
            
            if not chat_messages:
                # Fallback: gunakan ID bubble-msg
                reply_element = WebDriverWait(driver, 10).until(
                    EC.presence_of_element_located((By.ID, "bubble-msg"))
                )
                full_text = reply_element.text
                
                # Ambil bagian terakhir setelah timestamp terakhir
                import re
                lines = full_text.split('\n')
                
                # Cari baris terakhir yang bukan timestamp dan bukan kosong
                for i in range(len(lines) - 1, -1, -1):
                    line = lines[i].strip()
                    if line and not re.match(r'^\d{2}:\d{2}$', line):
                        print(f"Balasan diterima: {line}")
                        return [line]
                
                # Jika tidak ditemukan, kembalikan teks penuh
                print(f"Balasan diterima: {full_text}")
                return [full_text]
            else:
                # Ambil pesan terakhir
                last_message = chat_messages[-1].text.strip()
                print(f"Balasan diterima: {last_message}")
                return [last_message]
                
        except Exception as inner_e:
            print(f"Error parsing chat messages: {inner_e}")
            # Fallback terakhir
            reply_element = WebDriverWait(driver, 10).until(
                EC.presence_of_element_located((By.ID, "bubble-msg"))
            )
            full_text = reply_element.text
            print(f"Balasan diterima (fallback): {full_text}")
            return [full_text]

    except Exception as e:
        print(f"Error saat mengambil balasan dari DHAI: {e}")
        return []