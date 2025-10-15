import json
import time
import threading
import uuid
from concurrent.futures import ThreadPoolExecutor
from queue import Queue
import random
from module import envfolder, envhitllm

# lock = threading.Lock()
# scoring_queue = Queue()

def skoring_api(response_bot, response_text):
    time.sleep(10)  # Simulate API delay

    start_time= time.time()
    result_skor, output, explanation = envhitllm.hit_llm_to_scoring(response_bot, response_text)
    print(f"Result: {result_skor}")


    # time.sleep(20)  # Simulate API delay
    # return round(random.uniform(0, 1), 3)   


    end_time = time.time() - start_time
    print(f"Skoring API took {end_time:.2f} seconds")
    return result_skor, output, explanation

def load_json(report_filename, id_test):
    result_path = envfolder.write_json_data_bot(f"{report_filename}-{id_test}")
    try:
        with open(result_path) as file:
            data_json = json.load(file)
    except FileNotFoundError:
        data_json = {"summary": [], "chart": [], "data": []}

    return data_json
    
def update_skor(sample_text, skor, output, explanation, report_filename, id_test):
    data_json = load_json(report_filename, id_test)
    result_path = envfolder.write_json_data_bot(f"{report_filename}-{id_test}")

    try:
        for item in data_json["data"]:
            if item["sample_text"] == sample_text:
                item["skor"] = skor
                item["output_llm"] = output
                item["explanation"] = explanation
                break

        with open(result_path, "w") as f:
            json.dump(data_json, f, indent=2)

            print(f"✅ Updated score on sample_text: {sample_text} with score: {skor}")

    except Exception as e:
        print(f"❌ Error updating score on sample_text: {sample_text}. Error: {e}")

def scoring_worker(report_filename, id_test, scoring_queue, lock):
    while True:
        item = scoring_queue.get()
        if item is None:
            break

        sample_text = item["sample_text"]
        response_bot = item["response_bot"]
        response_text = item["respond_text"]

        skor, output, explanation = skoring_api(response_bot, response_text)

        with lock:
            update_skor(sample_text, skor, output, explanation, report_filename, id_test)

        scoring_queue.task_done()

def enqueue_unscored_data(report_filename, id_test, scoring_queue):
    data_json = load_json(report_filename, id_test)

    for item in data_json["data"]:
        if "skor" not in item:
            scoring_queue.put(item)


def stop_all_workers(scoring_queue, worker_thread):
    scoring_queue.join()  # Tunggu sampai semua data diproses
    scoring_queue.put(None)  # Kirim sinyal untuk menghentikan worker
    worker_thread.join()

