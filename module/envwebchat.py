import datetime
import time
import uuid
from art import *
from selenium import webdriver
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
from selenium.webdriver.common.by import By
from selenium.webdriver.common.keys import Keys
from module import modul
from colorama import Fore, Style
import sys

def wait_time(numbres=1):
    time.sleep(numbres)

def prechat_form(driver, greeting, name, email, phone):
    title = "Checking for available webchat pre-chat form"
    modul.show_loading(title)

    id_input = driver.find_element(By.ID, 'input-message')
    webform = False
    modul.wait_time(3)
    # send value
    try:
        registername  = driver.find_element(By.ID, 'registername')
        registername.send_keys(name)
        print(Fore.GREEN + " * pre-chat form name available")
        webform = True
    except:
        pass
    
    try:
        registeremail = driver.find_element(By.ID, 'registeremail')
        registeremail.send_keys(email)
        print(Fore.GREEN + " * pre-chat form email available")
        webform = True
    except:
        pass
    try:
        registerphone = driver.find_element(By.ID, 'registerphone')
        registerphone.send_keys(phone)
        print(Fore.GREEN + " * pre-chat form phone available")
        webform = True
    except:
        pass
    
    try:
        btn = driver.find_element(By.XPATH, "//button[@type='submit']")
        btn.click()
        modul.wait_time(3)
    except:
        pass
    modul.wait_time(3)
    
    print(Style.RESET_ALL)
    if webform != True:
        print(Fore.RED + "❌ Pre-chat form not available \n" + Style.RESET_ALL)
        id_input.send_keys(greeting, Keys.ENTER)
        time.sleep(5)
    else:
        pass


def wait_reply(driver, class_name="message-content-wrapper", content="content", msgs="hello"):
    send_msgs = msgs
    stoper = True
    start_time = time.time()
    seconds = 120
    driver.implicitly_wait(120)
    while stoper:
        time.sleep(0.5)
        current_time = time.time()
        elapsed_time = current_time - start_time
        # print("Elapsed Time :",round(float(elapsed_time),3))
        try:
            len_last_chat = driver.find_elements(By.CLASS_NAME, class_name)[-1]
            driver.implicitly_wait(120)
            elem_last_chat = len_last_chat.find_element(By.CLASS_NAME ,content)
            elem_text = elem_last_chat.text
            # print("elem_text", elem_text)
            # print("1")
            try:
                if elem_text.lower().strip() == send_msgs.lower().strip():
                    # print("2")
                    pass
                elif elem_text.lower().strip() == "":
                    # print("3")
                    pass
                else:
                    # minute1 = minute.strftime("%M") #06
                    if elem_text.lower().strip() == "menu":
                        # print("menu response")
                        # print("4")
                        stoper = False
                    else:
                        # print("5")
                        time.sleep(0.2)
                        # print("else menu response")
                        stoper = False
            except:
                # print("7")
                pass
        except:
            # print("8")
            pass
        if elapsed_time > seconds:
            # print("9")
            # print("!!*!!")
            stoper = False
    
def send_message(driver, question):
    # mencari text input kemudian mengisi sample text
    try:
        input_message = driver.find_element(By.ID, "input-message")
        input_message.send_keys(question)
    except:
        pass
    # mengirim sample text
    try:
        button_send = driver.find_element(By.ID, "button-send")
        wait_time()
        button_send.click()
    except:
        pass

def get_reply_chat(driver, class_name="message-content-wrapper", content="content", messages="hai", message_content="message-content"):
    message = messages
    reply = []
    try:
        len_last_second = driver.find_elements(By.CLASS_NAME, class_name)[-2]
        elem_last_second = len_last_second.find_element(By.CLASS_NAME, content)
        elem_second_text = elem_last_second.text
        # jika elemen kedua terakhir sama dengan text yang dikirim
        if elem_second_text.lower().strip() == message.lower().strip():
            # jika balasan chat hanya ada satu pesan
            try:
                first_text = driver.find_elements(By.CLASS_NAME, class_name)[-1]
                elem_first_text = first_text.find_elements(By.CLASS_NAME, message_content)
                len_msg_content = len(elem_first_text)
                print("Jumlah bubble:", len_msg_content, "bubble")
                # reply = []
                for i, val in enumerate(elem_first_text):
                    time.sleep(0.3)
                    # driver.implicitly_wait(30)
                    text_list = val.text
                    reply.append(text_list)
                    # log
                    # print("text_data {} :".format(i), text_list)
                # log
                # print(reply)
                # get_reply = "\n".join(reply)
                # print("Balasan Chat hanya satu:\n---\n",
                #       get_reply.strip(), "\n---")
                # print("+Balasan Chat 1 pesan+")
            except IndexError:
                print("excep handling response.py file")
                pass
        else:
            pass
    except:
        pass
    # jika balasan chat ada 2 response
    try:
        len_last_third = driver.find_elements(By.CLASS_NAME, class_name)[-3]
        elem_last_third = len_last_third.find_element(By.CLASS_NAME, content)
        elem_last_third = elem_last_third.text
        # jika elemen ketiga terakhir sama dengan text yang dikirim
        if elem_last_third.lower().strip() == message.lower().strip():
            try:
                # reply = []
                loop = -2  # -2,-1 < 0
                while loop < 0:
                    try:
                        time.sleep(2)
                        first_text = driver.find_elements(By.CLASS_NAME, class_name)[loop]
                        elem_first_text = first_text.find_elements(By.CLASS_NAME, message_content)
                        # log
                        len_msg_content = len(elem_first_text)
                        print("Jumlah bubble:", len_msg_content, "bubble")
                        for i, val in enumerate(elem_first_text):
                            time.sleep(0.5)
                            text_list = val.text
                            reply.append(text_list)
                            # log
                            # print("text_data {} :".format(i), text_list)
                        loop += 1
                        # jika 0 < 0 = Flase [stop]
                    except:
                        pass
                # log
                # print(reply)
                # get_reply = "\n".join(reply)
                # print("Balasan Chat Ada 2:\n---\n",
                #       get_reply.strip(), "\n---")
                # print("+Balasan Chat 2 pesan+")
            except:
                pass
        else:
            pass
    except:
        pass
    # jika balasan chat ada 3 response
    try:
        len_last_third = driver.find_elements(By.CLASS_NAME, class_name)[-4]
        elem_last_third = len_last_third.find_element(By.CLASS_NAME, content)
        elem_last_third = elem_last_third.text
        # jika elemen keempat terakhir sama dengan text yang dikirim
        if elem_last_third.lower().strip() == message.lower().strip():
            try:
                # reply = []
                loop = -3  # -2,-1 < 0
                while loop < 0:
                    try:
                        time.sleep(2)
                        first_text = driver.find_elements(By.CLASS_NAME, class_name)[loop]
                        elem_first_text = first_text.find_elements(By.CLASS_NAME, message_content)
                        # log
                        len_msg_content = len(elem_first_text)
                        print("Jumlah bubble:", len_msg_content, "bubble")
                        for i, val in enumerate(elem_first_text):
                            time.sleep(0.5)
                            text_list = val.text
                            reply.append(text_list)
                            # log
                            # print("text_data {} :".format(i), text_list)
                        loop += 1
                        # jika 0 < 0 = Flase [stop]
                    except:
                        pass
                # log
                # print(reply)
                # get_reply = "\n".join(reply)
                # print("Balasan Chat Ada 3:\n---\n",
                #       get_reply.strip(), "\n---")
                # print("+Balasan Chat 3 pesan+")
            except:
                pass
        else:
            pass
    except:
        pass
    # jika balasan chat ada 4 response
    try:
        len_last_third = driver.find_elements(By.CLASS_NAME, class_name)[-5]
        elem_last_third = len_last_third.find_element(By.CLASS_NAME, content)
        elem_last_third = elem_last_third.text
        # jika elemen keempat terakhir sama dengan text yang dikirim
        if elem_last_third.lower().strip() == message.lower().strip():
            try:
                # reply = []
                loop = -4  # -2,-1 < 0
                while loop < 0:
                    try:
                        time.sleep(2)
                        first_text = driver.find_elements(By.CLASS_NAME, class_name)[loop]
                        elem_first_text = first_text.find_elements(By.CLASS_NAME, message_content)
                        # log
                        len_msg_content = len(elem_first_text)
                        print("Jumlah bubble:", len_msg_content, "bubble")
                        for i, val in enumerate(elem_first_text):
                            time.sleep(0.5)
                            text_list = val.text
                            reply.append(text_list)
                            # log
                            # print("text_data {} :".format(i), text_list)
                        loop += 1
                        # jika 0 < 0 = Flase [stop]
                    except:
                        pass
                # log
                # print(reply)
                # get_reply = "\n".join(reply)
                # print("Balasan Chat Ada 4:\n---\n",
                #       get_reply.strip(), "\n---")
                # print("+Balasan Chat 4 pesan+")
            except:
                pass
        else:
            pass
    except:
        pass
    # jika balasan chat ada 5 response
    try:
        len_last_third = driver.find_elements(By.CLASS_NAME, class_name)[-6]
        elem_last_third = len_last_third.find_element(By.CLASS_NAME, content)
        elem_last_third = elem_last_third.text
        # jika elemen keempat terakhir sama dengan text yang dikirim
        if elem_last_third.lower().strip() == message.lower().strip():
            try:
                # reply = []
                loop = -5  # -2,-1 < 0
                while loop < 0:
                    try:
                        time.sleep(2)
                        first_text = driver.find_elements(By.CLASS_NAME, class_name)[loop]
                        elem_first_text = first_text.find_elements(By.CLASS_NAME, message_content)
                        # log
                        len_msg_content = len(elem_first_text)
                        print("Jumlah bubble:", len_msg_content, "bubble")
                        for i, val in enumerate(elem_first_text):
                            time.sleep(0.5)
                            text_list = val.text
                            reply.append(text_list)
                            # log
                            # print("text_data {} :".format(i), text_list)
                        loop += 1
                        # jika 0 < 0 = Flase [stop]
                    except:
                        pass
                # log
                # print(reply)
                # get_reply = "\n".join(reply)
                # print("Balasan Chat Ada 5:\n---\n",
                #       get_reply.strip(), "\n---")
                # print("+Balasan Chat 5 pesan+")
            except:
                pass
        else:
            pass
    except:
        pass
    # log
    # print(reply)
    get_reply = "\n".join(reply)
    # print("+"*14,">Balasan Chat<","+"*14)
    # print(get_reply.strip())
    # print("+"*14,">Balasan Chat<","+"*14)
    # print("$__2 Ambil Text Balasan Chat__$")
    # print()

    return reply





    # try:
    #     respondin = driver.find_elements(By.CLASS_NAME, "message-in")[-1]
    #     respond_bot = respondin.find_element(By.CLASS_NAME, "content").text
    
    # except:
    #     pass
    
    # try:
    #     respondin = driver.find_elements(By.CSS_SELECTOR, ".message-in")[-2]
    #     respond_bot = respondin.find_element(By.CLASS_NAME, "content").text
    # except:
    #     pass

    # try:
    #     respondin = driver.find_elements(By.CSS_SELECTOR, ".message-in")[-3]
    #     respond_bot = respondin.find_element(By.CLASS_NAME, "content").text
    # except:
    #     pass

    # try:
    #     respondin = driver.find_elements(By.CSS_SELECTOR, ".message-in")[-4]
    #     respond_bot = respondin.find_element(By.CLASS_NAME, "content").text
    # except:
    #     pass

    # try:
    #     respondin = driver.find_elements(By.CSS_SELECTOR, ".message-in")[-5]
    #     respond_bot = respondin.find_element(By.CLASS_NAME, "content").text
    # except:
    #     pass

    # try:
    #     respondin = driver.find_elements(By.CSS_SELECTOR, ".message-in")[-6]
    #     respond_bot = respondin.find_element(By.CLASS_NAME, "content").text
    # except:
    #     pass

    # return respond_bot