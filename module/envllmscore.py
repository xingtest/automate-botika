import time
from module import envhitllm


def llm_score(respond_bot, respond_text):

    start_time= time.time()
    result_skor, output, explanation, AI = envhitllm.hit_llm_to_scoring_gemini(respond_bot, respond_text)
    print(f"Result: {result_skor}")


    end_time = time.time() - start_time
    print(f"Skoring API took {end_time:.2f} seconds")
    return result_skor, output, explanation, AI


