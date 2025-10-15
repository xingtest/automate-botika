from jinja2 import Environment, FileSystemLoader
import json
from colorama import Fore, Style
from module import modul, envfolder
import os
import re
from jinja2 import Environment, FileSystemLoader

def render_report(report_filename, id_test):
    """Fungsi helper untuk merender laporan HTML dari data JSON."""
    report_file_id = f"{report_filename}-{id_test}"
    result_path = envfolder.report_html(report_file_id)
    file_json_report = envfolder.write_json_data_bot(report_file_id)
    
    try:
        with open(file_json_report, 'r') as file:
            data = json.load(file)
            
        # Memastikan data summary selalu dalam bentuk list untuk template
        summary_data = data.get('summary', {})
        if not isinstance(summary_data, list):
            summary_data = [summary_data]
            
        chart_data = data.get('chart', {})
        test_data = data.get('data', [])

        env = Environment(loader=FileSystemLoader(os.path.join(os.path.dirname(__file__), '..')))
        template = env.get_template('report/template/template.html')

        # Ensure image_capture is not None for the template
        for item in test_data:
            if item.get('image_capture') is None:
                item['image_capture'] = '' # Set to empty string or a placeholder if needed

        html_output = template.render(summary=summary_data, chart=chart_data, test_data=test_data)

        with open(result_path, 'w') as output_file:
            output_file.write(html_output)
        
        return True, "HTML report generated successfully."
    except FileNotFoundError as e:
        error_message = f"❌ File JSON tidak ditemukan: {e}"
        print(Fore.RED + error_message + Style.RESET_ALL)
        return False, error_message
    except Exception as e:
        error_message = f"❌ Terjadi kesalahan saat membuat report: {e}"
        print(Fore.RED + error_message + Style.RESET_ALL)
        return False, error_message

def report(report_filename, id_test):
    """Fungsi untuk membuat laporan akhir."""
    title = f"Generating final report.."
    modul.show_loading(title)
    
    success, message = render_report(report_filename, id_test)
    if success:
        print(f"✅ {message}\n")
    
def report_action(report_filename, id_test):
    """Fungsi untuk membuat laporan selama eksekusi (per aksi)."""
    render_report(report_filename, id_test)
    
def take_screenshot(driver, id_test, key, question):
    """Mengambil screenshot dari halaman web."""
    question_cleaned = re.sub(r'[^\w\s-]', '', question).strip()
    safe_filename = (question_cleaned[:50] + '..') if len(question_cleaned) > 50 else question_cleaned
    
    result_path = envfolder.report_screenshoot(id_test)
    result_filename = os.path.join(result_path, f'{safe_filename}.png')
    
    try:
        modul.wait_time(1.5)
        if driver.save_screenshot(result_filename):
            print(f"\n{key} has been captured!")
        else:
            print(Fore.RED + f"{key} failed to capture!" + Style.RESET_ALL)
    except Exception as e:
        print(Fore.RED + f"❌ Error saving capture: {e}" + Style.RESET_ALL)
    
    # Mengembalikan path relatif dari folder report HTML ke screenshot
    # Format: screenshoot/2025-10-06/{id_test}/{filename}.png
    from datetime import datetime
    tanggal_hari_ini = datetime.now().strftime('%Y-%m-%d')
    return f"screenshoot/{tanggal_hari_ini}/{id_test}/{safe_filename}.png"