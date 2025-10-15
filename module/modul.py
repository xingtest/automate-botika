import datetime
import time
import uuid
from art import *
from selenium import webdriver
from selenium.webdriver.support import expected_conditions as EC
from selenium.webdriver.common.by import By
from selenium.webdriver.common.keys import Keys
from module import envwebchat, envfolder
from colorama import Fore, Style
import sys
import logging
import datetime

# Driver
from webdriver_manager.chrome import ChromeDriverManager
from webdriver_manager.microsoft import EdgeChromiumDriverManager
from webdriver_manager.firefox import GeckoDriverManager
from selenium.webdriver.chrome.service import Service as ChromeService
from selenium.webdriver.edge.service import Service as EdgeService
from selenium.webdriver.firefox.service import Service as FirefoxService
from selenium.webdriver.chrome.options import Options as ChromeOptions
from selenium.webdriver.edge.options import Options as EdgeOptions
from selenium.webdriver.firefox.options import Options as FirefoxOptions




def show_loading(title):
    animation = "|/-\\"
    for i in range(15):
        time.sleep(0.1)  # Jeda antara setiap titik
        sys.stdout.write(Fore.BLUE + "\r" + title + animation[i % len(animation)])
        sys.stdout.flush()
    # Setelah animasi selesai, ganti karakter animasi menjadi centang
    sys.stdout.write(Fore.BLUE + "\r" + title + " ✔")
    sys.stdout.flush()
    print(Style.RESET_ALL)  # Ganti warna konsol ke default setelah loading selesai

def show_loading_sampletext(title):
    animation = "|/-\\"
    for i in range(10):
        time.sleep(0.1)  # Jeda antara setiap titik
        sys.stdout.write(Fore.WHITE + "\r" + title + animation[i % len(animation)])
        sys.stdout.flush()
    # Setelah animasi selesai, ganti karakter animasi menjadi centang
    sys.stdout.write(Fore.WHITE + "\r" + title + " ✔")
    sys.stdout.flush()
    print(Style.RESET_ALL)

def initialize(text):
    print(Fore.RED + text2art(text))
    print(Style.RESET_ALL)
    
def test_done(text):
    print(Fore.GREEN + text2art(text))
    print(Style.RESET_ALL)

def todays():
    today_dates = datetime.datetime.now()
    today_date = today_dates.strftime("%A, %d %B %Y")
    time_date = today_dates.strftime("%H:%M:%S")
    return today_date, time_date

def start_time():
    start = time.time()
    return start

def end_time(start):
    end_time = time.time() - start
    duration = time.strftime("%H:%M:%S", time.gmtime(end_time))
    return duration

def id_test():
    unique_id = str(uuid.uuid4())
    # Mengambil 8 karakter pertama dari ID unik
    short_id = unique_id[:8]
    test_id = f"{short_id}"
    return test_id

def tester(name):
    return name

def wait_time(numbres=1):
    time.sleep(numbres)



def read_browser(url, browser):
    browser = browser.upper()
    title = f"Choose {browser} as a main browser and open the Webchat URL"
    show_loading(title)
    
    browser = browser.lower()
    if browser == "chrome":
        chrome_options = ChromeOptions()
        # chrome_options.add_argument('--headless')  # Commented out to show Chrome
        chrome_options.add_argument('--no-sandbox')
        chrome_options.add_argument('--disable-dev-shm-usage')
        chrome_options.add_argument("--window-size=1920,1080")
        chrome_options.add_argument("--start-maximized")  # Start maximized
        
        driver = webdriver.Chrome(service=ChromeService(ChromeDriverManager().install()), options=chrome_options)
        driver.maximize_window()

        browser_name = "Google Chrome"
        
    elif browser == "edge":
        edge_options = EdgeOptions()
        edge_options.add_argument('--headless')
        edge_options.add_argument('--no-sandbox')
        edge_options.add_argument('--disable-dev-shm-usage')
        edge_options.add_argument("--window-size=1920,1080")

        driver = webdriver.Edge(service=EdgeService(EdgeChromiumDriverManager().install()), options=edge_options)
        driver.maximize_window()
        browser_name = "Microsoft Edge"
        
    elif browser == "firefox":
        firefox_options = FirefoxOptions()
        firefox_options.add_argument('--headless')
        firefox_options.add_argument('--no-sandbox')
        firefox_options.add_argument('--disable-dev-shm-usage')
        firefox_options.add_argument("--window-size=1920,1080")

        driver =  webdriver.Firefox(service=FirefoxService(GeckoDriverManager().install()), options=firefox_options)
        driver.maximize_window()
        browser_name = "Firefox"
        
    else:
        print("Browser not found!")
        
    driver.get(url)
    title_page = "{}".format(driver.title)
    return driver, title_page, browser_name

def refresh(driver):
    driver.refresh()

def close_browser(driver):
    title = "🟡 Closing environment"
    show_loading(title)
    driver.delete_all_cookies()
    title = "🔴 Deleting cookies"
    show_loading(title)
    title = "🟠 Close browser"
    show_loading(title)
    print("\n")
    driver.quit()

def setup_logging(report_filename, id_test):
    result_path = envfolder.log(report_filename, id_test)

    logging.basicConfig(filename=result_path, level=logging.DEBUG,
        format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')

def log_function_status(func):
    def wrapper(*args, **kwargs):
        try:
            result = func(*args, **kwargs)
            logging.info(f'Function {func.__name__} executed successfully')
            return result
        except Exception as e:
            logging.error(f'Function {func.__name__} encountered an error: {str(e)}')
            raise
    return wrapper