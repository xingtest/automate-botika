import logging
import time
import os
import json
from typing import Optional, Tuple, List, Dict, Any
from pathlib import Path
from selenium import webdriver
from selenium.webdriver.chrome.options import Options
from webdriver_manager.chrome import ChromeDriverManager
from selenium.webdriver.chrome.service import Service
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
from selenium.webdriver.common.by import By
from selenium.common.exceptions import TimeoutException, NoSuchElementException, WebDriverException

logger = logging.getLogger(__name__)

def check_session_exists() -> bool:
    """
    Check if Facebook session file exists.
    
    Returns:
        True if session exists, False otherwise
    """
    session_file = Path("session/session-facebook.json")
    return session_file.exists()

def load_session_cookies() -> Optional[List[Dict[str, Any]]]:
    """
    Load Facebook session cookies from file.
    
    Returns:
        List of cookies or None if not found
    """
    session_file = Path("session/session-facebook.json")
    
    if not session_file.exists():
        logger.warning(f"Session file not found: {session_file}")
        return None
    
    try:
        with open(session_file, 'r') as f:
            cookies = json.load(f)
        
        # Validate cookies
        if not cookies or not isinstance(cookies, list):
            logger.warning("Invalid cookie structure")
            return None
        
        # Check for essential Facebook cookies
        cookie_names = [cookie.get('name', '') for cookie in cookies]
        if 'c_user' not in cookie_names or 'xs' not in cookie_names:
            logger.warning("Missing essential Facebook cookies")
            return None
        
        logger.info(f"Session cookies loaded successfully from {session_file}")
        return cookies
        
    except Exception as e:
        logger.error(f"Failed to load session cookies: {e}")
        return None

def initialize_driver() -> webdriver.Chrome:
    """
    Initialize Chrome WebDriver with session cookies.

    Returns:
        Configured Chrome WebDriver instance
    """
    options = Options()
    options.add_argument("--disable-notifications")
    options.add_argument("--disable-extensions")
    options.add_argument("--no-sandbox")
    options.add_argument("--disable-dev-shm-usage")
    options.add_argument("--disable-blink-features=AutomationControlled")
    options.add_experimental_option("excludeSwitches", ["enable-automation"])
    options.add_experimental_option('useAutomationExtension', False)
    # options.add_argument("--headless")

    try:
        driver = webdriver.Chrome(service=Service(ChromeDriverManager().install()), options=options)
        logger.info("WebDriver initialized successfully")

        # Load session cookies
        cookies = load_session_cookies()
        if cookies:
            logger.info("Loading session cookies...")
            driver.get("https://www.facebook.com/")
            time.sleep(2)  # Wait for page load

            for cookie in cookies:
                try:
                    # Remove expiry if present to avoid errors
                    if 'expiry' in cookie:
                        cookie['expiry'] = int(cookie['expiry'])
                    driver.add_cookie(cookie)
                except Exception as e:
                    logger.warning(f"Failed to add cookie {cookie.get('name', 'unknown')}: {e}")

            driver.refresh()
            logger.info("Session cookies loaded successfully")
        else:
            logger.warning("No valid session cookies found")

        return driver

    except WebDriverException as e:
        logger.error(f"Failed to initialize WebDriver: {e}")
        raise

def send_message_to_chatbot(driver: webdriver.Chrome, message: str) -> bool:
    """
    Send a message to the Facebook chatbot with optimized selectors.

    Args:
        driver: Selenium WebDriver instance
        message: Message to send

    Returns:
        True if message sent successfully, False otherwise
    """
    try:
        logger.info(f"Sending message: {message[:50]}...")

        # Find message input box with optimized selectors
        message_box = _find_element_with_retry(driver, [
            "//div[@contenteditable='true'][@role='textbox']",
            "//div[@aria-label='Message']",
            "//div[@contenteditable='true']",
            "//textarea[@aria-label='Message']",
            "//div[@role='combobox' and @contenteditable='true']",
            "//div[contains(@class, '_5rpu') and @role='combobox']",
            "//textarea[@class='uiTextareaAutogrow _552m']"
        ], timeout=10)

        if not message_box:
            logger.error("Could not find message input box")
            return False

        # Clear and type message efficiently
        _clear_and_type(driver, message_box, message)

        # Try to send with multiple methods
        if not _try_send_methods(driver, message_box):
            return False

        logger.info("Message sent successfully")
        return True

    except Exception as e:
        logger.error(f"Error sending message: {e}")
        return False

def _find_element_with_retry(driver: webdriver.Chrome, selectors: list, timeout: int = 5) -> Optional[object]:
    """Find element with multiple selectors and retry logic."""
    from selenium.webdriver.common.by import By
    from selenium.webdriver.support.ui import WebDriverWait
    from selenium.webdriver.support import expected_conditions as EC
    from selenium.common.exceptions import TimeoutException

    for selector in selectors:
        try:
            element = WebDriverWait(driver, timeout).until(
                EC.presence_of_element_located((By.XPATH, selector))
            )
            if element and element.is_displayed() and element.is_enabled():
                return element
        except TimeoutException:
            continue
    return None

def _clear_and_type(driver: webdriver.Chrome, element, text: str) -> None:
    """Clear element and type text efficiently."""
    element.clear()
    element.send_keys(text)
    time.sleep(0.3)  # Reduced wait time

def _try_send_methods(driver: webdriver.Chrome, message_box) -> bool:
    """Try multiple methods to send message."""
    from selenium.webdriver.common.keys import Keys
    from selenium.webdriver.common.by import By
    from selenium.common.exceptions import NoSuchElementException

    # Method 1: Find send button
    send_button_selectors = [
        "//div[@aria-label='Press enter to send']",
        "//button[@type='submit']",
        "//div[contains(@aria-label, 'send')]",
        "//span[text()='Send']/parent::div"
    ]

    for selector in send_button_selectors:
        try:
            send_button = driver.find_element(By.XPATH, selector)
            if send_button and send_button.is_displayed() and send_button.is_enabled():
                driver.execute_script("arguments[0].click();", send_button)
                return True
        except NoSuchElementException:
            continue

    # Method 2: Press Enter key
    try:
        message_box.send_keys(Keys.ENTER)
        return True
    except Exception as e:
        logger.warning(f"Failed to press Enter: {e}")

    return False

def get_chatbot_response(driver: webdriver.Chrome) -> Optional[str]:
    """
    Get the latest response from the chatbot.

    Args:
        driver: Selenium WebDriver instance

    Returns:
        Latest chatbot response text or None if not found
    """
    try:
        logger.info("Getting chatbot response...")

        # Multiple possible selectors for chatbot responses
        response_selectors = [
            "//div[contains(@class, 'msg') and contains(@class, 'from-them')]//span",
            "//div[contains(@class, 'message') and contains(@class, 'incoming')]//span",
            "//div[@dir='auto' and contains(@class, 'html-div')]",
            "//div[@dir='auto']",
            "//div[@role='article']//span[contains(@class, 'message')]",
            "//div[contains(@data-testid, 'message') and contains(@class, 'other')]//span",
            "//div[contains(@class, 'chatMessage')]//span",
            "//div[@data-hover='tooltip']/div/span"
        ]

        # responses = []
        # for selector in response_selectors:
        #     try:
        #         elements = WebDriverWait(driver, 15).until(
        #             EC.presence_of_all_elements_located((By.XPATH, selector))
        #         )
        #         for elem in elements:
        #             text = elem.text.strip()
        #             if text:
        #                 responses.append(text)
        #     except TimeoutException:
        #         continue

    
        # return latest_response.text.strip()


        # if responses:
        #     latest_response = responses[-1]
        #     logger.info(f"Found response: {latest_response[:50]}...")
        #     return latest_response
        # else:
        #     logger.warning("No chatbot response found")
        #     return None
        
        xpath_bot = "//div[contains(@class,'html-div') and contains(@class,'x18lvrbx')]"

        # hitung jumlah bubble bot sebelum kirim pertanyaan
        old_count = len(driver.find_elements(By.XPATH, xpath_bot))

        try:
            # tunggu sampai jumlah bubble bot nambah (ada jawaban baru)
            WebDriverWait(driver, 15).until(
                lambda d: len(d.find_elements(By.XPATH, xpath_bot)) > old_count
            )

            # ambil semua bubble bot setelah old_count
            elems = driver.find_elements(By.XPATH, xpath_bot)
            new_elems = elems[old_count:]  # semua bubble baru

            # gabungkan teks jadi satu string
            responses = [e.text.strip() for e in new_elems if e.text.strip()]
            full_response = " ".join(responses)

            print("Full response:", full_response)  # print sebagian untuk verifikasi
            return full_response if full_response else None

        except TimeoutException:
            return None
    except Exception as e:
        logger.error(f"Error getting chatbot response: {e}")
        return None
