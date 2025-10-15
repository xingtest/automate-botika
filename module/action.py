# module/action.py
import time
import asyncio
from module import modul, envwebchat, envstatus, envfile, envreport, envfolder, envtelegram, envinstagram, envllmscore, envfacebook, envdhai
from module.modul import log_function_status
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
from typing import Optional


@log_function_status
def actions_webchat(driver, json_data, report_filename, id_test, time_start, today, tester_name, url, title_page, browser_name):
    start = modul.start_time()
    class_name = "message-content-wrapper"
    content = "content"
    title = "当 Membaca pertanyaan dan mengirim ke webchat"
    modul.show_loading(title)
    print("\n")
    count_per_element_title = len(json_data)
    question_count = sum(sum(1 for key in item if key.startswith("pertanyaan")) for item in json_data)
    for element in json_data:
        modul.refresh(driver)
        modul.wait_time(3)
        duration_pertitle = modul.start_time()
        modul.show_loading(element.get("title", "Untitled"))
        print("\n")
        count = 0
        for key, value in element.items():
            if key.startswith("pertanyaan") and value is not None and str(value).strip() != "":
                count += 1
                duration_perquestion = modul.start_time()
                question = str(value) # Ensure question is a string
                envwebchat.send_message(driver, question)
                envwebchat.wait_reply(driver, class_name, content, question)
                if count % 5 == 0:
                    modul.wait_time(2)
                    modul.refresh(driver)
                image_capture = envreport.take_screenshot(driver, id_test, key, question)
                respond_bot = envwebchat.get_reply_chat(driver, class_name, content, question)
                respond_bot = "\n".join(respond_bot).strip()
                respond_bot = envstatus.respond_bot_correction(respond_bot)
                title_loading = f"{key} : {question}"
                modul.show_loading_sampletext(title_loading)
                respond_csv = str(element.get("context", "")).strip()
                respond_csv = envstatus.respond_csv_correction(respond_csv)
                end_duration_persampletext = modul.end_time(duration_perquestion)
                
                # Mengaktifkan evaluasi LLM
                skor, _, explanation, AI = envllmscore.llm_score(respond_bot, respond_csv)
                
                status = envstatus.status(skor)
                data_bot = {
                    "no": element.get("no", ""),
                    "title": element.get("title", ""),
                    "question": question,
                    "response_kb": respond_csv,
                    "response_llm": respond_bot,
                    "status": status,
                    "duration": end_duration_persampletext,
                    "image_capture": image_capture,
                    "skor": skor,
                    "explanation": explanation
                }
                envfile.write_json_data_bot(data_bot, report_filename, id_test)
                pass_count, failed_count = envstatus.calculate(report_filename, id_test)
                data_summary = {
                    "id_test": id_test,
                    "tester_name": tester_name,
                    "ai_evaluation": AI,
                    "url": url,
                    "page_name": title_page,
                    "browser_name": browser_name,
                    "date_test": today,
                    "start_time_test": time_start,
                    "total_title": count_per_element_title,
                    "total_question": question_count,
                    "success": pass_count,
                    "failed": failed_count
                }
                envfile.write_json_data_summary(data_summary, report_filename, id_test)
                envreport.report_action(report_filename, id_test)
        end_duration_pertitle = modul.end_time(duration_pertitle)
        chart = {element.get("title", "Untitled"): end_duration_pertitle}
        envfile.write_json_chart(chart, report_filename, id_test)
        print(f"\n竢ｳ Total durasi Topik '{element.get('title', 'Untitled')}' : {end_duration_pertitle}\n")
    print("識 Topik Terakhir \n")

@log_function_status
async def actions_telegram(target_bot_username, greeting, json_data, report_filename, id_test, time_start, today, tester_name):
    modul.show_loading(f"Mengirim sapaan awal ke {target_bot_username}...")
    await envtelegram.send_message_to_bot(target_bot_username, greeting)
    await asyncio.sleep(5)
    print("\n")
    title = f"当 Membaca pertanyaan dan mengirim ke {target_bot_username}"
    modul.show_loading(title)
    print("\n")
    count_per_element_title = len(json_data)
    question_count = sum(sum(1 for key in item if key.startswith("pertanyaan")) for item in json_data)
    for element in json_data:
        duration_pertitle = modul.start_time()
        modul.show_loading(element.get("title", "Untitled"))
        print("\n")
        for key, value in element.items():
            if key.startswith("pertanyaan") and value is not None and str(value).strip() != "":
                duration_perquestion = modul.start_time()
                question = str(value) # Ensure question is a string
                await envtelegram.send_message_to_bot(target_bot_username, question)
                await asyncio.sleep(15)
                respond_bot = await envtelegram.get_latest_message_from_bot(target_bot_username)
                if not respond_bot:
                    respond_bot = "Error: Tidak ada balasan dari bot setelah menunggu."
                title_loading = f"{key} : {question}"
                modul.show_loading_sampletext(title_loading)
                respond_csv = str(element.get("context", "")).strip()
                respond_csv = envstatus.respond_csv_correction(respond_csv)
                end_duration_persampletext = modul.end_time(duration_perquestion)
                
                # Mengaktifkan evaluasi LLM
                skor, _, explanation, AI = envllmscore.llm_score(respond_bot, respond_csv)
                
                status = envstatus.status(skor)
                image_capture = None
                data_bot = {
                    "no": element.get("no", ""),
                    "title": element.get("title", ""),
                    "question": question,
                    "response_kb": respond_csv,
                    "response_llm": respond_bot,
                    "status": status,
                    "duration": end_duration_persampletext,
                    "image_capture": image_capture,
                    "skor": skor,
                    "explanation": explanation
                }
                envfile.write_json_data_bot(data_bot, report_filename, id_test)
                pass_count, failed_count = envstatus.calculate(report_filename, id_test)
                data_summary = {
                    "id_test": id_test,
                    "tester_name": tester_name,
                    "ai_evaluation": AI,
                    "url": f"Telegram Bot ({target_bot_username})",
                    "page_name": "Telegram Test",
                    "browser_name": "Telethon",
                    "date_test": today,
                    "start_time_test": time_start,
                    "total_title": count_per_element_title,
                    "total_question": question_count,
                    "success": pass_count,
                    "failed": failed_count
                }
                envfile.write_json_data_summary(data_summary, report_filename, id_test)
                envreport.report_action(report_filename, id_test)
        end_duration_pertitle = modul.end_time(duration_pertitle)
        chart = {element.get("title", "Untitled"): end_duration_pertitle}
        envfile.write_json_chart(chart, report_filename, id_test)
        print(f"\n竢ｳ Total durasi Topik '{element.get('title', 'Untitled')}' : {end_duration_pertitle}\n")
    print("識 Topik Terakhir \n")
    # modul.close_browser(driver)

@log_function_status
async def actions_instagram(target_username, greeting, json_data, report_filename, id_test, time_start, today, tester_name):
    modul.show_loading(f"Initializing Instagram API and session...")
    envinstagram.initialize_instagram_api()

    modul.show_loading(f"Mengirim sapaan awal ke {target_username}...")
    # Kirim sapaan dan dapatkan timestamp setelah pesan terkirim
    greeting_timestamp = envinstagram.send_message(target_username, greeting)
    if greeting_timestamp:
        # Tunggu sebentar untuk memastikan bot sempat merespons sapaan (jika ada)
        await asyncio.sleep(10)
    print("\n")

    title = f"当 Membaca pertanyaan dan mengirim ke {target_username}"
    modul.show_loading(title)
    print("\n")

    count_per_element_title = len(json_data)
    question_count = sum(sum(1 for key in item if key.startswith("pertanyaan")) for item in json_data)

    for element in json_data:
        duration_pertitle = modul.start_time()
        modul.show_loading(element.get("title", "Untitled"))
        print("\n")

        for key, value in element.items():
            if key.startswith("pertanyaan") and value is not None and str(value).strip() != "":
                duration_perquestion = modul.start_time()
                question = str(value)

                # Kirim pertanyaan dan dapatkan timestamp setelah pesan terkirim
                sent_timestamp = envinstagram.send_message(target_username, question)
                
                respond_bot = ""
                if sent_timestamp:
                    # Cari pesan balasan yang datang SETELAH timestamp pesan kita
                    respond_bot = envinstagram.get_latest_message(target_username, sent_timestamp)
                
                if not respond_bot:
                    respond_bot = "Error: Tidak ada balasan dari bot setelah menunggu."

                title_loading = f"{key} : {question}"
                modul.show_loading_sampletext(title_loading)

                respond_csv = str(element.get("context", "")).strip()
                respond_csv = envstatus.respond_csv_correction(respond_csv)
                end_duration_persampletext = modul.end_time(duration_perquestion)

                # Activate LLM evaluation
                skor, _, explanation, AI = envllmscore.llm_score(respond_bot, respond_csv)

                status = envstatus.status(skor)
                image_capture = None

                data_bot = {
                    "no": element.get("no", ""),
                    "title": element.get("title", ""),
                    "question": question,
                    "response_kb": respond_csv,
                    "response_llm": respond_bot,
                    "status": status,
                    "duration": end_duration_persampletext,
                    "image_capture": image_capture,
                    "skor": skor,
                    "explanation": explanation
                }
                envfile.write_json_data_bot(data_bot, report_filename, id_test)

                pass_count, failed_count = envstatus.calculate(report_filename, id_test)
                data_summary = {
                    "id_test": id_test,
                    "tester_name": tester_name,
                    "ai_evaluation": AI,
                    "url": f"Instagram DM (@{target_username})",
                    "page_name": "Instagram Test",
                    "browser_name": "Instagrapi",
                    "date_test": today,
                    "start_time_test": time_start,
                    "total_title": count_per_element_title,
                    "total_question": question_count,
                    "success": pass_count,
                    "failed": failed_count
                }
                envfile.write_json_data_summary(data_summary, report_filename, id_test)
                envreport.report_action(report_filename, id_test)

        end_duration_pertitle = modul.end_time(duration_pertitle)
        chart = {element.get("title", "Untitled"): end_duration_pertitle}
        envfile.write_json_chart(chart, report_filename, id_test)
        print(f"\n竢ｳ Total durasi Topik '{element.get('title', 'Untitled')}' : {end_duration_pertitle}\n")

    print("識 Topik Terakhir \n")

@log_function_status
async def actions_facebook(target_fanpage_id, greeting, json_data, report_filename, id_test, time_start, today, tester_name):
    from session_manager import get_latest_session, validate_session_cookies, create_session_folder
    import os

    logger = envfacebook.logger

    def setup_test_environment() -> tuple[str, str]:
        """Set up the test environment and handle login."""
        logger.info("Setting up test environment...")

        try:
            # Check for existing valid session
            latest_session = get_latest_session()
            if latest_session:
                session_id, session_folder = latest_session
                cookie_file = os.path.join(session_folder, 'cookies.json')
                if validate_session_cookies(cookie_file):
                    logger.info(f"Using existing valid session: {session_id} in {session_folder}")
                    return session_folder, session_id

            # If no valid session, perform manual login
            session_folder, session_id = envfacebook.perform_manual_login()
            logger.info(f"New session established: {session_id} in {session_folder}")
            return session_folder, session_id
        except Exception as e:
            logger.error(f"Failed to establish session: {e}")
            raise

    logger.info("Starting Facebook chatbot automation testing...")

    # Initialize variables
    session_folder: Optional[str] = None
    session_id: Optional[str] = None
    driver = None

    try:
        # 1. Set up session and login
        session_folder, session_id = setup_test_environment()

        # 2. Initialize driver and navigate to chatbot
        logger.info("Initializing WebDriver...")
        driver = envfacebook.initialize_driver(session_folder)

        chatbot_url = f"https://www.facebook.com/messages/t/{target_fanpage_id}"
        logger.info(f"Navigating to chatbot: {chatbot_url}")
        driver.get(chatbot_url)

        # Wait for page to load and verify URL
        WebDriverWait(driver, 20).until(EC.url_contains(f"facebook.com/messages/t/{target_fanpage_id}"))
        logger.info("Successfully navigated to chatbot page.")
        time.sleep(3)

        # 3. Run test cases
        title = "当 Membaca pertanyaan dan mengirim ke Facebook"
        modul.show_loading(title)
        print("\n")
        count_per_element_title = len(json_data)
        question_count = sum(sum(1 for key in item if key.startswith("pertanyaan")) for item in json_data)
        for element in json_data:
            duration_pertitle = modul.start_time()
            modul.show_loading(element.get("title", "Untitled"))
            print("\n")
            for key, value in element.items():
                if key.startswith("pertanyaan") and value is not None and str(value).strip() != "":
                    duration_perquestion = modul.start_time()
                    question = str(value) # Ensure question is a string

                    if envfacebook.send_message_to_chatbot(driver, question):
                        time.sleep(2)
                        respond_bot = envfacebook.get_chatbot_response(driver)
                    else:
                        respond_bot = "Error: Gagal mengirim pesan ke chatbot."

                    image_capture = envreport.take_screenshot(driver, id_test, key, question)

                    title_loading = f"{key} : {question}"
                    modul.show_loading_sampletext(title_loading)
                    respond_csv = str(element.get("context", "")).strip()
                    respond_csv = envstatus.respond_csv_correction(respond_csv)
                    end_duration_persampletext = modul.end_time(duration_perquestion)

                    # Mengaktifkan evaluasi LLM
                    skor, _, explanation, AI = envllmscore.llm_score(respond_bot, respond_csv)

                    status = envstatus.status(skor)
                    data_bot = {
                        "no": element.get("no", ""),
                        "title": element.get("title", ""),
                        "question": question,
                        "response_kb": respond_csv,
                        "response_llm": respond_bot,
                        "status": status,
                        "duration": end_duration_persampletext,
                        "image_capture": image_capture,
                        "skor": skor,
                        "explanation": explanation
                    }
                    envfile.write_json_data_bot(data_bot, report_filename, id_test)
                    pass_count, failed_count = envstatus.calculate(report_filename, id_test)
                    data_summary = {
                        "id_test": id_test,
                        "tester_name": tester_name,
                        "ai_evaluation": AI,
                        "url": chatbot_url,
                        "page_name": "Facebook Test",
                        "browser_name": "Selenium",
                        "date_test": today,
                        "start_time_test": time_start,
                        "total_title": count_per_element_title,
                        "total_question": question_count,
                        "success": pass_count,
                        "failed": failed_count
                    }
                    envfile.write_json_data_summary(data_summary, report_filename, id_test)
                    envreport.report_action(report_filename, id_test)
            end_duration_pertitle = modul.end_time(duration_pertitle)
            chart = {element.get("title", "Untitled"): end_duration_pertitle}
            envfile.write_json_chart(chart, report_filename, id_test)
            print(f"\n竢ｳ Total durasi Topik '{element.get('title', 'Untitled')}' : {end_duration_pertitle}\n")
        print("識 Topik Terakhir \n")

    finally:
        # Cleanup
        if driver:
            try:
                driver.quit()
                logger.info("WebDriver closed successfully")
            except Exception as e:
                logger.warning(f"Error closing WebDriver: {e}")

        logger.info("Facebook chatbot automation testing finished.")

@log_function_status
def actions_dhai(driver, json_data, report_filename, id_test, time_start, today, tester_name, url, title_page, browser_name):
    """Fungsi untuk menjalankan skenario pengujian pada platform DHAI."""
    start = modul.start_time()
    title = "当 Membaca pertanyaan dan mengirim ke DHAI"
    modul.show_loading(title)
    print("\n")

    # Memulai obrolan sekali di awal
    try:
        envdhai.start_chat(driver)
        modul.wait_time(5) # Beri waktu agar chat siap
    except Exception as e:
        print(f"Gagal memulai obrolan DHAI: {e}")
        # Jika gagal memulai, mungkin tidak perlu melanjutkan
        return

    count_per_element_title = len(json_data)
    question_count = sum(sum(1 for key in item if key.startswith("pertanyaan")) for item in json_data)

    for element in json_data:
        duration_pertitle = modul.start_time()
        modul.show_loading(element.get("title", "Untitled"))
        print("\n")

        for key, value in element.items():
            if key.startswith("pertanyaan") and value is not None and str(value).strip() != "":
                duration_perquestion = modul.start_time()
                question = str(value)

                try:
                    envdhai.send_message(driver, question)
                    modul.wait_time(5) # Tunggu balasan

                    image_capture = envreport.take_screenshot(driver, id_test, key, question)
                    respond_bot_list = envdhai.get_reply(driver)
                    respond_bot = "\n".join(respond_bot_list).strip()

                    if not respond_bot:
                        respond_bot = "Error: Tidak ada balasan dari bot."

                except Exception as e:
                    print(f"Error selama interaksi DHAI untuk pertanyaan '{question}': {e}")
                    respond_bot = f"Error: {e}"
                    image_capture = envreport.take_screenshot(driver, id_test, key, f"error_{question}")

                respond_bot = envstatus.respond_bot_correction(respond_bot)
                title_loading = f"{key} : {question}"
                modul.show_loading_sampletext(title_loading)

                respond_csv = str(element.get("context", "")).strip()
                respond_csv = envstatus.respond_csv_correction(respond_csv)
                end_duration_persampletext = modul.end_time(duration_perquestion)

                # Evaluasi LLM
                skor, _, explanation, AI = envllmscore.llm_score(respond_bot, respond_csv)
                status = envstatus.status(skor)

                data_bot = {
                    "no": element.get("no", ""),
                    "title": element.get("title", ""),
                    "question": question,
                    "response_kb": respond_csv,
                    "response_llm": respond_bot,
                    "status": status,
                    "duration": end_duration_persampletext,
                    "image_capture": image_capture,
                    "skor": skor,
                    "explanation": explanation
                }
                envfile.write_json_data_bot(data_bot, report_filename, id_test)

                pass_count, failed_count = envstatus.calculate(report_filename, id_test)
                data_summary = {
                    "id_test": id_test,
                    "tester_name": tester_name,
                    "ai_evaluation": AI,
                    "url": url,
                    "page_name": title_page,
                    "browser_name": browser_name,
                    "date_test": today,
                    "start_time_test": time_start,
                    "total_title": count_per_element_title,
                    "total_question": question_count,
                    "success": pass_count,
                    "failed": failed_count
                }
                envfile.write_json_data_summary(data_summary, report_filename, id_test)
                envreport.report_action(report_filename, id_test)

        end_duration_pertitle = modul.end_time(duration_pertitle)
        chart = {element.get("title", "Untitled"): end_duration_pertitle}
        envfile.write_json_chart(chart, report_filename, id_test)
        print(f"\n竢ｳ Total durasi Topik '{element.get('title', 'Untitled')}' : {end_duration_pertitle}\n")

    print("識 Topik Terakhir \n")