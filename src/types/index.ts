export interface TestData {
  no: string;
  title: string;
  [key: string]: string;
}

export interface BotData {
  no: string;
  title: string;
  question: string;
  response_kb: string;
  response_llm: string;
  status: string;
  duration: string;
  image_capture: string | null;
  skor: number;
  explanation: string;
}

export interface SummaryData {
  id_test: string;
  tester_name: string;
  ai_evaluation: string;
  url: string;
  page_name: string;
  browser_name: string;
  date_test: string;
  start_time_test: string;
  end_time_test?: string;
  duration?: string;
  total_title: number;
  total_question: number;
  success: number;
  failed: number;
}

export interface PlatformConfig {
  platform: string;
  filename: string;
  testerName: string;
  greeting: string;
  targetUrl?: string;
  targetBotUsername?: string;
  targetUsername?: string;
  targetFanpageId?: string;
  dhaiTargetUrl?: string;
}
