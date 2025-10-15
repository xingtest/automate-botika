import os
from datetime import datetime

def json_converted(json_file):
    tanggal_hari_ini = datetime.now().strftime('%Y-%m-%d')

    # Membuat path lengkap untuk folder
    folder_path = f'assets/json/converted/{tanggal_hari_ini}'
    result_path = f'{folder_path}/{json_file}.json'

    # Membuat folder jika belum ada
    if not os.path.exists(folder_path):
        os.makedirs(folder_path)
        
    return result_path
    
def read_json(json_file):
    tanggal_hari_ini = datetime.now().strftime('%Y-%m-%d')

    # Membuat path lengkap untuk folder
    folder_path = f'assets/json/converted/{tanggal_hari_ini}'
    result_path = f'{folder_path}/{json_file}.json'

    # Membuat folder jika belum ada
    if not os.path.exists(folder_path):
        os.makedirs(folder_path)
        
    return result_path

def write_json_data_bot(report_filename):
    tanggal_hari_ini = datetime.now().strftime('%Y-%m-%d')

    # Membuat path lengkap untuk folder
    folder_path = f'report/json/{tanggal_hari_ini}'
    result_path = f'{folder_path}/{report_filename}.json'

    # Membuat folder jika belum ada
    if not os.path.exists(folder_path):
        os.makedirs(folder_path)
        
    return result_path

def write_json_data_summary(report_filename):
    tanggal_hari_ini = datetime.now().strftime('%Y-%m-%d')

    # Membuat path lengkap untuk folder
    folder_path = f'report/json/{tanggal_hari_ini}'
    result_path = f'{folder_path}/{report_filename}.json'

    # Membuat folder jika belum ada
    if not os.path.exists(folder_path):
        os.makedirs(folder_path)
        
    return result_path

def write_json_chart(report_filename):
    tanggal_hari_ini = datetime.now().strftime('%Y-%m-%d')

    # Membuat path lengkap untuk folder
    folder_path = f'report/json/{tanggal_hari_ini}'
    result_path = f'{folder_path}/{report_filename}.json'

    # Membuat folder jika belum ada
    if not os.path.exists(folder_path):
        os.makedirs(folder_path)
        
    return result_path

def calculate(report_filename):
    tanggal_hari_ini = datetime.now().strftime('%Y-%m-%d')

    # Membuat path lengkap untuk folder
    folder_path = f'report/json/{tanggal_hari_ini}'
    result_path = f'{folder_path}/{report_filename}.json'

    # Membuat folder jika belum ada
    if not os.path.exists(folder_path):
        os.makedirs(folder_path)
        
    return result_path

def log(report_filename, id_test):
    tanggal_hari_ini = datetime.now().strftime('%Y-%m-%d')

    # Membuat path lengkap untuk folder
    folder_path = f'log/{tanggal_hari_ini}'
    result_path = f'{folder_path}/{report_filename}-{id_test}.log'

    # Membuat folder jika belum ada
    if not os.path.exists(folder_path):
        os.makedirs(folder_path)
        
    return result_path
    
def report_html(report_filename):
    tanggal_hari_ini = datetime.now().strftime('%Y-%m-%d')

    # Membuat path lengkap untuk folder
    folder_path = f'report/html/{tanggal_hari_ini}'
    result_path = f'{folder_path}/{report_filename}.html'

    # Membuat folder jika belum ada
    if not os.path.exists(folder_path):
        os.makedirs(folder_path)
        
    return result_path

def report_screenshoot(id_test):
    tanggal_hari_ini = datetime.now().strftime('%Y-%m-%d')

    # Membuat path lengkap untuk folder
    folder_path = f'report/screenshoot/{tanggal_hari_ini}'
    result_path = f'{folder_path}/{id_test}'
    
    # Membuat folder jika belum ada
    if not os.path.exists(folder_path):
        os.makedirs(folder_path)
        
    if not os.path.exists(result_path):
        os.makedirs(result_path)
    
    return result_path