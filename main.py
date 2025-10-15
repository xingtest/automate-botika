import os
import glob
import asyncio # Diperlukan untuk menjalankan fungsi async
from dotenv import load_dotenv
from module import modul, envfile, envwebchat, action, envreport, envfolder
# Jangan import envinstagram di sini secara langsung, kita akan import secara kondisional

def cleanup_previous_report(report_filename, id_test):
    """
    Membersihkan file laporan lama sebelum memulai proses baru.
    """
    modul.show_loading("Membersihkan file laporan lama...")
    full_report_name = f"{report_filename}-{id_test}"
    report_file_path = envfolder.write_json_data_bot(full_report_name)

    if os.path.exists(report_file_path):
        try:
            os.remove(report_file_path)
            print(f"Berhasil menghapus file laporan lama: {report_file_path}")
        except OSError as e:
            print(f"Error saat menghapus file {report_file_path}: {e}")
    else:
        print("Tidak ada file laporan lama ditemukan untuk dihapus. Memulai proses baru.")
    print("\n")

def main():
    # Muat variabel dari file .env di awal eksekusi
    load_dotenv()

    modul.initialize("Initialize ...")
    today, time_start = modul.todays()
    start_duration_measurement = modul.start_time()

    id_test = modul.id_test()

    print(f"Test ID : {id_test}\nDay : {today}\nStart Time : {time_start}\n")

    try:
        platform = os.getenv('PLATFORM')
        if platform:
            platform = platform.lower()
        else:
            print("Error: Environment variable 'PLATFORM' tidak diatur. Harap set ke 'webchat', 'telegram', atau 'instagram'.")
            modul.test_done("Test Failed!")
            print("Selesai. Pastikan variabel lingkungan 'PLATFORM' diatur dengan benar. 😥\n")
            return

        filename_with_ext = os.getenv('FILENAME')
        tester_name = os.getenv('TESTER_NAME', 'Nama Penguji Baru')
        greeting = os.getenv('GREETING', 'Halo')
        
        # Format: Tester_name_platform_dd-mm-yyyy_hh-mm-ss
        from datetime import datetime
        date_str = datetime.now().strftime('%d-%m-%Y')
        time_str = datetime.now().strftime('%H-%M-%S')
        tester_name_clean = tester_name.replace(' ', '_')
        report_filename = f"{tester_name_clean}_{platform}_{date_str}_{time_str}"
        
        cleanup_previous_report(report_filename, id_test)
        modul.setup_logging(report_filename, id_test)

        print(f"Platform Pengujian: {platform.capitalize()}")
        print(f"Greeting: {greeting}\n")

        if not filename_with_ext:
            print("Error: Nama file data uji tidak ditemukan. Harap set environment variable 'FILENAME'.")
            modul.test_done("Test Failed!")
            print("Selesai. Pastikan variabel lingkungan 'FILENAME' diatur dengan benar. 😥\n")
            return

        file_name_without_ext, file_extension = os.path.splitext(filename_with_ext)
        print(f"File Uji yang Digunakan: {filename_with_ext}\n")
        print(f"Tester: {tester_name}\n")

        json_data = None
        if file_extension.lower() == '.csv':
            try:
                json_data = envfile.convert_csv_to_json(filename_with_ext, file_name_without_ext)
            except Exception as e:
                print(f"Error saat mengonversi file CSV: {e}")
                modul.test_done("Test Failed!")
                return
        elif file_extension.lower() in ['.xlsx', '.xls']:
            try:
                json_data = envfile.convert_excel_to_json(filename_with_ext, file_name_without_ext)
            except Exception as e:
                print(f"Error saat mengonversi file Excel: {e}")
                modul.test_done("Test Failed!")
                return
        else:
            print(f"Error: Format file {file_extension} tidak didukung. Harap gunakan .csv atau .xlsx.")
            modul.test_done("Test Failed!")
            return

        if not json_data:
            print("Error: Tidak ada data yang dapat dibaca dari file yang disediakan.")
            modul.test_done("Test Failed!")
            return

        if platform == 'webchat':
            url = os.getenv('TARGET_URL')
            if not url:
                print("Error: TARGET_URL tidak diatur untuk platform 'webchat'.")
                modul.test_done("Test Failed!")
                return
            print(f"URL Pengujian: {url}\n")
            driver, title_page, browser_name = modul.read_browser(url, "chrome")
            envwebchat.prechat_form(driver, greeting, "Tester", "tester@example.com", "081234567890")
            action.actions_webchat(driver, json_data, report_filename, id_test, time_start, today, tester_name, url, title_page, browser_name)
            modul.close_browser(driver)

        elif platform == 'telegram':
            target_bot_username = os.getenv('TARGET_BOT_USERNAME')
            if not target_bot_username:
                print("Error: TARGET_BOT_USERNAME tidak diatur untuk platform 'telegram'.")
                modul.test_done("Test Failed!")
                return
            print(f"Target Bot Telegram: {target_bot_username}\n")
            from module import envtelegram
            # Pastikan client envtelegram diinisialisasi sebelum digunakan dalam loop asyncio
            # Asumsi client telah diinisialisasi saat modul dimuat.
            with envtelegram.client:
                 envtelegram.client.loop.run_until_complete(
                     action.actions_telegram(target_bot_username, greeting, json_data, report_filename, id_test, time_start, today, tester_name)
                 )

        elif platform == 'instagram':
            target_username = os.getenv('TARGET_USERNAME')
            if not target_username:
                print("Error: TARGET_USERNAME tidak diatur untuk platform 'instagram'.")
                modul.test_done("Test Failed!")
                return
            print(f"Target User Instagram: @{target_username}\n")
            from module import envinstagram
            # Menjalankan fungsi async dalam event loop baru
            loop = asyncio.new_event_loop()
            asyncio.set_event_loop(loop)
            try:
                loop.run_until_complete(
                    action.actions_instagram(target_username, greeting, json_data, report_filename, id_test, time_start, today, tester_name)
                )
            finally:
                loop.close()

        elif platform == 'facebook':
            target_fanpage_id = os.getenv('TARGET_FANPAGE_ID')
            if not target_fanpage_id:
                print("Error: TARGET_FANPAGE_ID tidak diatur untuk platform 'facebook'.")
                modul.test_done("Test Failed!")
                return
            print(f"Target Fanpage ID: {target_fanpage_id}\n")
            # Menjalankan fungsi async dalam event loop baru
            loop = asyncio.new_event_loop()
            asyncio.set_event_loop(loop)
            try:
                loop.run_until_complete(
                    action.actions_facebook(target_fanpage_id, greeting, json_data, report_filename, id_test, time_start, today, tester_name)
                )
            finally:
                loop.close()

        elif platform == 'dhai':
            url = os.getenv('DHAI_TARGET_URL')
            if not url:
                print("Error: DHAI_TARGET_URL tidak diatur untuk platform 'dhai'.")
                modul.test_done("Test Failed!")
                return
            print(f"URL Pengujian: {url}\n")
            driver, title_page, browser_name = modul.read_browser(url, "chrome")
            # Tidak ada pre-chat form untuk DHAI, langsung ke actions
            action.actions_dhai(driver, json_data, report_filename, id_test, time_start, today, tester_name, url, title_page, browser_name)
            modul.close_browser(driver)

        else:
            print(f"Error: Platform '{platform}' tidak didukung. Harap gunakan 'webchat', 'telegram', 'instagram', 'facebook', atau 'dhai'.")
            modul.test_done("Test Failed!")
            return

    finally:
        end_duration_measurement = modul.end_time(start_duration_measurement)
        today_end, time_end = modul.todays()
        print(f"End Time : {time_end}\nDuration : {end_duration_measurement}\n")

        envfile.write_end_time_summary(time_end, end_duration_measurement, report_filename, id_test)
        envreport.report(report_filename, id_test)
        modul.test_done("Test  Done!")
        print("Terima kasih, semoga harimu menyenangkan! 😎\n")

if __name__ == "__main__":
    main()
