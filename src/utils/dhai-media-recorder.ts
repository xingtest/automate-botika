import * as fs from 'fs';
import * as path from 'path';
import type { Page } from 'playwright';

interface QaRecordingResult {
  videoPath?: string;
  audioPath?: string;
}

interface RecorderState {
  page: Page;
  testId: string;
  questionKey: string;
  startedAt: number;
  mediaFolder: string;
  maxMs: number;
}

let activeRecorder: RecorderState | null = null;

function ensureDirectory(dirPath: string): void {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
}

function getMediaFolder(testId: string): string {
  const configured = process.env.DHAI_MEDIA_FOLDER;
  if (configured && configured.trim()) {
    return configured;
  }
  return path.join('report', 'html', `qa-media-${testId}`, 'media');
}

function toRelativeMediaPath(filePath: string): string {
  const normalized = filePath.replace(/\\/g, '/');
  const marker = '/media/';
  const markerIndex = normalized.lastIndexOf(marker);
  if (markerIndex >= 0) {
    return normalized.slice(markerIndex + 1);
  }
  return normalized;
}

export async function startQARecording(page: Page, testId: string, questionKey: string): Promise<void> {
  if (activeRecorder) {
    console.warn('⚠️ startQARecording dipanggil saat recorder sebelumnya masih aktif. Recorder lama akan ditutup paksa.');
    await stopQARecording();
  }

  const mediaFolder = getMediaFolder(testId);
  ensureDirectory(mediaFolder);

  const maxSecondsRaw = Number(process.env.DHAI_CAPTURE_MAX_SECONDS || 20);
  const maxSeconds = Number.isFinite(maxSecondsRaw) && maxSecondsRaw > 0 ? Math.floor(maxSecondsRaw) : 20;
  const maxMs = Math.max(1000, maxSeconds * 1000);

  activeRecorder = {
    page,
    testId,
    questionKey,
    startedAt: Date.now(),
    mediaFolder,
    maxMs
  };

  try {
    await page.evaluate(({ maxMs: timeoutMs }) => {
      const g = globalThis as any;
      const doc = g.document;
      const RecorderClass = g.MediaRecorder;

      const cleanup = () => {
        const current = g.__dhaiQaAudioRecorder;
        if (!current?.stream) return;
        for (const track of current.stream.getTracks()) {
          track.stop();
        }
      };

      try {
        if (!doc || !RecorderClass) {
          g.__dhaiQaAudioRecorder = {
            status: 'unavailable',
            chunks: [],
            reason: 'Document atau MediaRecorder tidak tersedia.'
          };
          return;
        }

        const elements = Array.from(doc.querySelectorAll('audio,video'));
        const playable = elements.find((el: any) => typeof el.captureStream === 'function' && !el.paused);

        if (!playable || typeof (playable as any).captureStream !== 'function') {
          g.__dhaiQaAudioRecorder = {
            status: 'unavailable',
            chunks: [],
            reason: 'Tidak ada elemen audio/video aktif yang bisa direkam.'
          };
          return;
        }

        const stream = (playable as any).captureStream();
        const audioTracks = stream.getAudioTracks();
        if (!audioTracks?.length) {
          g.__dhaiQaAudioRecorder = {
            status: 'unavailable',
            chunks: [],
            reason: 'Audio track tidak tersedia dari stream halaman.'
          };
          cleanup();
          return;
        }

        const recorder = new RecorderClass(stream, { mimeType: 'audio/webm' });
        const chunks: any[] = [];

        let stopResolve: () => void = () => undefined;
        const stopPromise = new Promise<void>(resolve => {
          stopResolve = resolve;
        });

        recorder.ondataavailable = (event: any) => {
          if (event?.data?.size > 0) {
            chunks.push(event.data);
          }
        };

        recorder.onerror = () => {
          g.__dhaiQaAudioRecorder = {
            status: 'error',
            chunks,
            recorder,
            stream,
            stopPromise,
            reason: 'MediaRecorder mengalami error.'
          };
          cleanup();
        };

        recorder.onstop = () => {
          const state = g.__dhaiQaAudioRecorder;
          if (state) {
            state.status = state.status === 'error' ? 'error' : 'stopped';
          }
          cleanup();
          stopResolve();
        };

        g.__dhaiQaAudioRecorder = {
          status: 'recording',
          chunks,
          recorder,
          stream,
          stopPromise,
          reason: null
        };

        recorder.start(250);

        setTimeout(() => {
          const state = g.__dhaiQaAudioRecorder;
          if (state?.recorder?.state === 'recording') {
            state.reason = 'Recorder dihentikan oleh guard timeout.';
            state.recorder.stop();
          }
        }, timeoutMs);
      } catch (error) {
        g.__dhaiQaAudioRecorder = {
          status: 'error',
          chunks: [],
          reason: `Gagal memulai recorder: ${String(error)}`
        };
      }
    }, { maxMs });
  } catch (error) {
    console.warn('⚠️ Gagal menginisialisasi audio recorder QA:', error);
  }
}

export async function stopQARecording(): Promise<QaRecordingResult> {
  if (!activeRecorder) {
    return {};
  }

  const recorder = activeRecorder;
  activeRecorder = null;

  const startedAt = recorder.startedAt;
  const stoppedAt = Date.now();

  const videoSegmentFilename = `${recorder.testId}_${recorder.questionKey}_${startedAt}_segment.json`;
  const videoSegmentPath = path.join(recorder.mediaFolder, videoSegmentFilename);

  try {
    const rawVideoPath = await recorder.page.video()?.path().catch(() => undefined);
    fs.writeFileSync(videoSegmentPath, JSON.stringify({
      sourceVideoPath: rawVideoPath || null,
      questionKey: recorder.questionKey,
      startedAt,
      stoppedAt,
      durationMs: Math.max(0, stoppedAt - startedAt),
      note: 'Segment per pertanyaan disimpan sebagai metadata timestamp dari context recordVideo.'
    }, null, 2));
  } catch (error) {
    console.warn('⚠️ Gagal menyimpan metadata segment video QA:', error);
  }

  let audioPath: string | undefined;

  try {
    const evaluationTimeoutMs = Math.max(1500, recorder.maxMs + 1500);
    const capturePromise = recorder.page.evaluate(async () => {
      const g = globalThis as any;
      const state = g.__dhaiQaAudioRecorder;
      const ReaderClass = g.FileReader;
      const BlobClass = g.Blob;

      if (!state) {
        return { status: 'unavailable', audioDataUrl: null, reason: 'Recorder state tidak ditemukan.' };
      }

      if (state.status === 'recording' && state.recorder?.state === 'recording') {
        state.recorder.stop();
      }

      if (state.stopPromise) {
        await state.stopPromise;
      }

      if (state.status === 'unavailable' || !state.chunks?.length) {
        return { status: state.status, audioDataUrl: null, reason: state.reason || 'Audio stream tidak tersedia.' };
      }

      if (state.status === 'error' || !ReaderClass || !BlobClass) {
        return { status: 'error', audioDataUrl: null, reason: state.reason || 'Recorder error.' };
      }

      const blob = new BlobClass(state.chunks, { type: 'audio/webm' });
      const dataUrl = await new Promise<string>((resolve, reject) => {
        const reader = new ReaderClass();
        reader.onloadend = () => resolve(String(reader.result || ''));
        reader.onerror = reject;
        reader.readAsDataURL(blob);
      });

      return { status: 'stopped', audioDataUrl: dataUrl, reason: state.reason || null };
    });

    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => reject(new Error('Timeout saat menunggu stopQARecording di browser context.')), evaluationTimeoutMs);
    });

    const audioResult = await Promise.race([capturePromise, timeoutPromise]) as { status: string; audioDataUrl: string | null; reason?: string | null };

    if (audioResult.audioDataUrl && audioResult.audioDataUrl.includes(',')) {
      const base64Data = audioResult.audioDataUrl.split(',')[1];
      const filename = `${recorder.testId}_${recorder.questionKey}_${stoppedAt}.webm`;
      const absolutePath = path.join(recorder.mediaFolder, filename);
      fs.writeFileSync(absolutePath, Buffer.from(base64Data, 'base64'));
      audioPath = toRelativeMediaPath(absolutePath);
    } else {
      console.warn(`⚠️ Audio QA unavailable (${recorder.questionKey}): ${audioResult.reason || 'tidak ada data audio'}`);
    }
  } catch (error) {
    console.warn(`⚠️ stopQARecording gagal pada pertanyaan ${recorder.questionKey}:`, error);
  }

  return {
    videoPath: fs.existsSync(videoSegmentPath) ? toRelativeMediaPath(videoSegmentPath) : undefined,
    audioPath
  };
}
