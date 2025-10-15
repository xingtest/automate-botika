import difflib
import json
import asyncio
from module.modul import log_function_status
from module import envfolder
import re

@log_function_status
def status(skor):
    if skor >= 0.80:
        status = "pass"
    else: 
        status = "failed"
    return status

@log_function_status
def compare_strings(respond_bot, respond_text):
    differences = list(difflib.ndiff(str(respond_bot), respond_text))
    # Menyusun kembali hasil perbandingan dalam format yang diinginkan
    formatted_diff = ' '.join([f'{diff[2:]}' if diff.startswith(' ') else f'[{diff[2:]}]' if diff.startswith('-') else f'({diff[2:]})' for diff in differences])
    # Menghilangkan entri baru dari hasil pemformatan
    compare_strings = formatted_diff.replace('\n', '')
    return compare_strings

@log_function_status
def probability(respond_bot, respond_text):
    matcher = difflib.SequenceMatcher(None, str(respond_bot), respond_text)
    probability = round(matcher.ratio(), 4)
    return probability

@log_function_status
def calculate(report_filename, id_test):
    report_filename = f"{report_filename}-{id_test}"
    # result = f'assets/json/result/{report_filename}.json'
    
    result_path = envfolder.calculate(report_filename)


    try:
        with open(result_path) as file:
            data = json.load(file)
    except FileNotFoundError:
        data = []

    pass_count = 0
    failed_count = 0
    
    try:
        for obj in data["data"]:
            status = obj["status"]
            if status == "pass":
                pass_count += 1
            elif status == "failed":
                failed_count += 1
    except Exception as e:
        print("An error occurred:", str(e))
        
    return pass_count, failed_count

@log_function_status
def diff_strings(respond_bot, respond_text):
    # Membuat objek Diff
    differ = difflib.Differ()

    # Membuat perbandingan
    diff = list(differ.compare(respond_bot, respond_text))

    # Menyusun teks dengan penambahan kurung
    modified_text = ''
    prev_op = None
    current_word = ''
    has_difference = False

    for line in diff:
        op, word = line[:1], line[2:]

        if op in ('-', '+'):
            current_word += word
            prev_op = op
            has_difference = True
        else:
            if prev_op in ('-', '+'):
                modified_text += f'({current_word})'
                current_word = ''
            modified_text += word
            prev_op = None

    if current_word:
        modified_text += f'({current_word})'

    if has_difference:
        return modified_text
    else:
        return ""
    
@log_function_status
def respond_csv_correction(respond_csv):
    respond_csv = re.sub(r'\(bubble\d*\)', ' ', respond_csv, flags=re.IGNORECASE)
    respond_csv = re.sub(r'\[button\]', ' ', respond_csv, flags=re.IGNORECASE)
    respond_csv = re.sub(r'\(button\)', ' ', respond_csv, flags=re.IGNORECASE)
    respond_csv = re.sub(r'\[List Menu\]', ' ', respond_csv, flags=re.IGNORECASE)
    respond_csv = re.sub(r'\[carousel\]', ' ', respond_csv, flags=re.IGNORECASE)
    respond_csv = re.sub(r'\[carousel button\]', ' ', respond_csv, flags=re.IGNORECASE)
    respond_csv = re.sub(r'\[image\]', ' ', respond_csv, flags=re.IGNORECASE)
    respond_csv = re.sub(r'\n', '', respond_csv, flags=re.IGNORECASE)
    
    return respond_csv

def respond_bot_correction(respond_bot):
    respond_bot = re.sub(r'\(bubble\d*\)', ' ', respond_bot, flags=re.IGNORECASE)
    respond_bot = re.sub(r'\[button\]', ' ', respond_bot, flags=re.IGNORECASE)
    respond_bot = re.sub(r'\(button\)', ' ', respond_bot, flags=re.IGNORECASE)
    respond_bot = re.sub(r'\[List Menu\]', ' ', respond_bot, flags=re.IGNORECASE)
    respond_bot = re.sub(r'\[carousel\]', ' ', respond_bot, flags=re.IGNORECASE)
    respond_bot = re.sub(r'\[carousel button\]', ' ', respond_bot, flags=re.IGNORECASE)
    respond_bot = re.sub(r'\[image\]', ' ', respond_bot, flags=re.IGNORECASE)
    respond_bot = re.sub(r'\n', '', respond_bot, flags=re.IGNORECASE)
    
    return respond_bot   
