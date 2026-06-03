import { Modul } from "./modul";
import { EnvFile } from "./envfile";
import { log } from "./logger";
import { EvaluatorFactory, calculateStatus, EVAL_CONFIG } from "./ai-evaluator";
import { TestTracker } from "./test-tracker";
import { TestData, BotData, SummaryData } from "../main";

export interface TestRunnerConfig {
  sendMessage: (question: string) => Promise<void | boolean>;
  getReply: (question: string) => Promise<string>;
  takeScreenshot: (idTest: string, key: string, question: string, screenshotsFolder: string) => Promise<string | null>;
  jsonData: TestData[];
  reportFilename: string;
  idTest: string;
  screenshotsFolder: string;
  testerName: string;
  url: string;
  pageName: string;
  browserName: string;
  today: string;
  timeStart: string;
  platformLabel: string;
  testTracker: TestTracker;
  postSendDelay?: number;
  onBeforeQuestion?: (count: number) => Promise<void>;
}
export async function runTestLoop(config: TestRunnerConfig): Promise<void> {
  const {
    sendMessage, getReply, takeScreenshot,
    jsonData, reportFilename, idTest, screenshotsFolder,
    testerName, url, pageName, browserName, today, timeStart,
    platformLabel, testTracker,
    postSendDelay = 0,
    onBeforeQuestion
  } = config;

  const start = Date.now();
  const countPerElementTitle = jsonData.length;
  const questionCount = jsonData.reduce((sum, item) => {
    return sum + Object.keys(item).filter(key => key.startsWith("pertanyaan")).length;
  }, 0);

  let testAborted = false;
  let globalCount = 0;

  for (const element of jsonData) {
    if (testAborted) break;
    const durationPerTitle = Modul.startTime();
    Modul.showLoading(element.title || "Untitled");

    for (const [key, value] of Object.entries(element)) {
      if (key.startsWith("pertanyaan") && value && (value as string).trim() !== "") {
        globalCount++;

        if (onBeforeQuestion) {
          await onBeforeQuestion(globalCount);
        }

        let questionSuccess = false;
        for (let _retry = 1; _retry <= EVAL_CONFIG.errorHandling.maxQuestionRetries; _retry++) {
          try {
            const durationPerQuestion = Modul.startTime();
            const question = value as string;

            log.info("Mengirim pertanyaan: " + question);
            await sendMessage(question);

            if (postSendDelay > 0) {
              await Modul.waitTime(postSendDelay);
            }

            log.info("Menunggu jawaban bot...");
            let respondBot = await getReply(question);
            if (!respondBot || respondBot.trim() === "") {
              respondBot = "No response captured";
            }

            const imageCapture = await takeScreenshot(idTest, key, question, screenshotsFolder);
            if (imageCapture) {
              log.info("Screenshot tersimpan: " + imageCapture);
            }

            const titleLoading = key + " : " + question;
            Modul.showLoadingSampleText(titleLoading);

            const respondCsv = ((element as any).context || "").trim();
            const endDurationPerSampleText = Modul.endTime(durationPerQuestion);

            log.info("Evaluasi response dengan " + (process.env.AI_PROVIDER || "Gemini") + " AI...");
            const aiEvaluator = EvaluatorFactory.getEvaluator();
            const evaluationResult = await aiEvaluator.evaluateResponse(
              question, respondCsv, respondBot, element.title || "Unknown Topic"
            );

            const skor = evaluationResult.score;
            const explanation = evaluationResult.explanation;
            const AI = evaluationResult.success
              ? evaluationResult.provider + " + " + platformLabel
              : platformLabel + " (" + evaluationResult.provider + " fallback)";

            const status = calculateStatus(skor);

            const dataBotData: BotData = {
              no: (element as any).no || "",
              title: element.title || "",
              question,
              response_kb: respondCsv,
              response_llm: respondBot,
              status,
              duration: endDurationPerSampleText,
              image_capture: imageCapture || null,
              skor,
              explanation
            };

            EnvFile.writeJsonDataBot(dataBotData, reportFilename, idTest);

            testTracker.addResult({
              no: (element as any).no || "",
              title: element.title || "",
              question,
              response_kb: respondCsv,
              response_llm: respondBot,
              score: skor,
              status: status as "pass" | "failed",
              duration: endDurationPerSampleText,
              image_capture: imageCapture || "",
              explanation
            });

            const trackerSummary = testTracker.getSummary();

            const dataSummary: SummaryData = {
              id_test: idTest,
              tester_name: testerName,
              ai_evaluation: AI,
              url,
              page_name: pageName,
              browser_name: browserName,
              date_test: today,
              start_time_test: timeStart,
              total_title: countPerElementTitle,
              total_question: questionCount,
              success: trackerSummary.passed,
              failed: trackerSummary.failed
            };

            EnvFile.writeJsonDataSummary(dataSummary, reportFilename, idTest);

            questionSuccess = true;
            break;
          } catch (error) {
            log.error("Percobaan " + _retry + "/" + EVAL_CONFIG.errorHandling.maxQuestionRetries + " gagal", error);
            if (_retry < EVAL_CONFIG.errorHandling.maxQuestionRetries) {
              await Modul.waitTime(EVAL_CONFIG.errorHandling.retryDelayMs / 1000);
            }
          }
        }

        if (!questionSuccess) {
          log.error("Test dihentikan: pertanyaan gagal setelah " + EVAL_CONFIG.errorHandling.maxQuestionRetries + " percobaan");
          testAborted = true;
          break;
        }
      }
    }

    const endDurationPerTitle = Modul.endTime(durationPerTitle);
    EnvFile.writeJsonChart({ [element.title || "Untitled"]: endDurationPerTitle }, reportFilename, idTest);
    log.info("Total durasi Topik " + (element.title || "Untitled") + " : " + endDurationPerTitle);
  }

  const endTime = new Date().toTimeString().split(" ")[0];
  const totalDuration = Modul.endTime(start);
  EnvFile.writeEndTimeSummary(endTime, totalDuration, reportFilename, idTest);
  log.info("Test completed at: " + endTime);
  log.info("Total test duration: " + totalDuration);
}
