import csv
import json
import pandas as pd
from colorama import Fore, Style
from module import modul, envfolder
import os

@modul.log_function_status
def convert_csv_to_json(csv_filename_with_ext, json_file_without_ext):
    """
    Mengonversi file CSV menjadi JSON.
    """
    csv_path = f'assets/csv/{csv_filename_with_ext}'
    result_path = envfolder.json_converted(json_file_without_ext)
    
    title = f"Converting csv to json from {csv_path}"
    modul.show_loading(title)
    try:
        csv_data = []
        with open(csv_path, 'r', encoding='utf-8') as file:
            csv_reader = csv.DictReader(file)
            for row in csv_reader:
                lowercased_row = {key.lower(): value for key, value in row.items()}
                csv_data.append(lowercased_row)
        with open(result_path, 'w', encoding='utf-8') as file:
            json.dump(csv_data, file, indent=4)
            print("File CSV berhasil diubah menjadi JSON.........\n")
        return csv_data
    except FileNotFoundError as e:
        print(Fore.RED + "File CSV tidak ditemukan di path:", str(e) + Style.RESET_ALL)
        raise
    except Exception as e:
        print(Fore.RED + "Terjadi kesalahan saat mengonversi file CSV menjadi JSON:", str(e) + Style.RESET_ALL)
        raise

@modul.log_function_status
def convert_excel_to_json(excel_filename_with_ext, json_file_without_ext):
    """
    Mengonversi file Excel menjadi JSON.
    """
    excel_path = f'assets/xlsx/{excel_filename_with_ext}'
    result_path = envfolder.json_converted(json_file_without_ext)

    title = f"Converting excel to json from {excel_path}"
    modul.show_loading(title)
    try:
        df = pd.read_excel(excel_path)
        # Mengganti nama kolom menjadi huruf kecil
        df.columns = map(str.lower, df.columns)
        excel_data = df.to_dict(orient='records')
        
        with open(result_path, 'w', encoding='utf-8') as file:
            json.dump(excel_data, file, indent=4)
            print("File Excel berhasil diubah menjadi JSON.........\n")
        return excel_data
    except FileNotFoundError as e:
        print(Fore.RED + "File Excel tidak ditemukan di path:", str(e) + Style.RESET_ALL)
        raise
    except Exception as e:
        print(Fore.RED + "Terjadi kesalahan saat mengonversi file Excel menjadi JSON:", str(e) + Style.RESET_ALL)
        raise

@modul.log_function_status
def read_json(jsonFile):
    result_path = envfolder.read_json(jsonFile)
    title = f"Reading file json from {result_path}"
    modul.show_loading(title)
    try:
        with open(result_path, 'r', encoding='utf-8') as file:
            json_data = json.load(file)
            print("File JSON berhasil terbaca.........\n")
        return json_data
    except FileNotFoundError as e:
        print(Fore.RED + "File JSON tidak ditemukan:", str(e) + Style.RESET_ALL)
        raise
    except Exception as e:
        print(Fore.RED + "Terjadi kesalahan saat membaca file JSON:", str(e) + Style.RESET_ALL)
        raise

@modul.log_function_status
def write_json_data_bot(data_bot, report_filename, id_test):
    """
    Menulis atau memperbarui data bot ke dalam file JSON.
    """
    full_report_name = f"{report_filename}-{id_test}"
    result_path = envfolder.write_json_data_bot(full_report_name)

    try:
        try:
            with open(result_path, 'r', encoding='utf-8') as file:
                data = json.load(file)
        except (FileNotFoundError, json.JSONDecodeError):
            data = {"summary": [], "chart": [], "data": []}

        data["data"].append(data_bot)

        with open(result_path, 'w', encoding='utf-8') as file:
            json.dump(data, file, indent=4)
            
    except Exception as e:
        print(f"Error writing to JSON file: {e}")

@modul.log_function_status
def write_json_data_summary(data_summary, report_filename, id_test):
    """
    Menulis atau memperbarui data summary ke dalam file JSON.
    """
    full_report_name = f"{report_filename}-{id_test}"
    result_path = envfolder.write_json_data_summary(full_report_name)
    
    try:
        try:
            with open(result_path, 'r') as f:
                data = json.load(f)
        except (FileNotFoundError, json.JSONDecodeError):
            data = {"summary": [], "chart": [], "data": []}

        data['summary'] = [data_summary]

        with open(result_path, 'w') as f:
            json.dump(data, f, indent=4)
            
    except Exception as e:
        print(f"Error writing summary to JSON file: {e}")

@modul.log_function_status
def write_json_chart(chart_data, report_filename, id_test):
    """
    Menambahkan data chart ke dalam file JSON.
    """
    full_report_name = f"{report_filename}-{id_test}"
    result_path = envfolder.write_json_chart(full_report_name)
    
    try:
        try:
            with open(result_path, 'r') as f:
                data = json.load(f)
        except (FileNotFoundError, json.JSONDecodeError):
            data = {"summary": [], "chart": [], "data": []}

        data['chart'].append(chart_data)

        with open(result_path, 'w') as f:
            json.dump(data, f, indent=4)

    except Exception as e:
        print(f"Error writing chart data to JSON file: {e}")


@modul.log_function_status
def write_end_time_summary(end_time, duration, report_filename, id_test):
    """
    Memperbarui summary dengan end_time dan duration.
    """
    full_report_name = f"{report_filename}-{id_test}"
    result_path = envfolder.write_json_data_summary(full_report_name)

    try:
        with open(result_path, 'r') as f:
            data = json.load(f)

        if data['summary']:
            data['summary'][0]['end_time_test'] = end_time
            data['summary'][0]['duration'] = duration

        with open(result_path, 'w') as f:
            json.dump(data, f, indent=4)

    except (FileNotFoundError, json.JSONDecodeError) as e:
        print(f"File not found or empty, cannot write end time: {e}")
    except Exception as e:
        print(f"Error writing end time to summary: {e}")