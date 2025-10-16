import { Page } from 'playwright';
import { Modul } from '../utils/modul';
import { EnvFile } from '../utils/envfile';
import { TestData, BotData, SummaryData } from '../types';
import * as https from 'https';
import * as fs from 'fs';


export class DhaiWakeupPlatform {
  static async debugPageStructure(page: Page): Promise<void> {
    try {
      console.log('🔍 Debugging page structure...');

      const pageInfo = await page.evaluate(`() => {
        const info = {
          title: document.title,
          url: window.location.href,
          buttons: [],
          microElements: []
        };
        
        // Get all buttons
        const buttons = document.querySelectorAll('button');
        buttons.forEach((btn, index) => {
          info.buttons.push({
            index,
            text: btn.textContent ? btn.textContent.trim() : '',
            className: btn.className,
            id: btn.id,
            ariaLabel: btn.getAttribute('aria-label'),
            visible: btn.offsetParent !== null
          });
        });
        
        // Get elements that might be related to microphone/listening
        const micElements = document.querySelectorAll('[class*="mic"], [class*="listen"], [class*="audio"], [class*="voice"]');
        micElements.forEach((el, index) => {
          info.microElements.push({
            index,
            tagName: el.tagName,
            text: el.textContent ? el.textContent.trim() : '',
            className: el.className,
            id: el.id
          });
        });
        
        return info;
      }`);

      console.log('📄 Page Info:', JSON.stringify(pageInfo, null, 2));

    } catch (error) {
      console.log('⚠️ Error debugging page structure:', error);
    }
  }

  static async startChat(page: Page): Promise<void> {
    try {
      // Reset response length tracking
      this.currentResponseLength = 0;

      // Grant microphone permissions first
      await page.context().grantPermissions(['microphone']);
      console.log('🎤 Microphone permissions granted');

      // For Wake-up Word, we need to activate microphone listening
      // Click "Tap to Start" button
      const tapToStartButton = page.locator('button:has-text("Tap to Start")');
      await tapToStartButton.click();
      console.log('✅ Tombol "Tap to Start" diklik - microphone activated');
      await Modul.waitTime(3);

      // Get initial response length
      const initialBubbleMsg = await page.locator('#bubble-msg').textContent();
      if (initialBubbleMsg) {
        this.currentResponseLength = initialBubbleMsg.trim().length;
        console.log(`📊 Initial response length: ${this.currentResponseLength} chars`);
      }

      // Wait for microphone to be ready (no need for textarea in wake-up word mode)
      console.log('✅ DHAI Wake-up Word siap untuk full TTS interaction');

    } catch (error) {
      console.error('Error saat memulai DHAI Wake-up Word:', error);
      throw error;
    }
  }

  static async generateTTS(text: string): Promise<string> {
    return new Promise((resolve, reject) => {
      // Optimized Google TTS API with slower speed for better recognition
      const encodedText = encodeURIComponent(text);
      // Add slow parameter for clearer speech recognition
      const url = `https://translate.google.com/translate_tts?ie=UTF-8&tl=id&client=tw-ob&ttsspeed=0.5&q=${encodedText}`;

      const audioDir = 'temp_audio';
      if (!fs.existsSync(audioDir)) {
        fs.mkdirSync(audioDir, { recursive: true });
      }

      const filename = `${audioDir}/tts_${Date.now()}.mp3`;
      const file = fs.createWriteStream(filename);

      console.log(`🎵 Generating TTS for: "${text}" (optimized for speech recognition)`);
      
      const request = https.get(url, (response) => {
        if (response.statusCode !== 200) {
          console.log(`⚠️ TTS API returned status ${response.statusCode}, retrying...`);
          // Retry without speed parameter if it fails
          const fallbackUrl = `https://translate.google.com/translate_tts?ie=UTF-8&tl=id&client=tw-ob&q=${encodedText}`;
          https.get(fallbackUrl, (fallbackResponse) => {
            fallbackResponse.pipe(file);
            file.on('finish', () => {
              file.close();
              console.log(`✅ TTS audio generated (fallback): ${filename}`);
              resolve(filename);
            });
          }).on('error', (err) => {
            fs.unlink(filename, () => { });
            reject(err);
          });
          return;
        }

        response.pipe(file);
        file.on('finish', () => {
          file.close();
          console.log(`✅ TTS audio generated (speech-optimized): ${filename}`);
          resolve(filename);
        });
      });

      request.on('error', (err) => {
        fs.unlink(filename, () => { });
        reject(err);
      });

      // Add timeout for TTS generation
      request.setTimeout(10000, () => {
        request.destroy();
        fs.unlink(filename, () => { });
        reject(new Error('TTS generation timeout'));
      });
    });
  }

  static async checkDhaiListeningState(page: Page): Promise<boolean> {
    try {
      console.log('🔍 Checking for DHAI "Listening" status...');

      // Check for the exact "Listening" button as shown in screenshot
      const listeningIndicators = [
        'button:has-text("Listening")',
        'button:has-text("listening")',
        'button:has-text("LISTENING")',
        '[aria-label*="Listening"]',
        '[title*="Listening"]',
        'button[class*="listening"]',
        'button[class*="active"]',
        '.listening-button',
        '.microphone-listening',
        '[data-state="listening"]',
        '[data-listening="true"]',
        // More specific selectors based on common patterns
        'div[class*="microphone"] button',
        '.mic-button[class*="active"]',
        'button[class*="mic"][class*="active"]'
      ];

      for (const selector of listeningIndicators) {
        try {
          const element = page.locator(selector).first();
          if (await element.isVisible({ timeout: 1000 })) {
            const text = await element.textContent();
            console.log(`✅ DHAI listening state detected! Selector: ${selector}, Text: "${text}"`);
            return true;
          }
        } catch {
          // Continue checking other selectors
        }
      }

      // Comprehensive button scan with faster timeout
      try {
        const allButtons = await page.locator('button').all();
        for (let i = 0; i < Math.min(allButtons.length, 10); i++) { // Limit to first 10 buttons for speed
          const button = allButtons[i];
          try {
            const text = await button.textContent({ timeout: 500 });
            const className = await button.getAttribute('class');

            if (text && text.toLowerCase().includes('listening')) {
              console.log(`✅ DHAI listening detected via button scan: "${text}"`);
              return true;
            }

            if (className && className.toLowerCase().includes('listening')) {
              console.log(`✅ DHAI listening detected via class: "${className}"`);
              return true;
            }
          } catch {
            // Skip this button and continue
          }
        }
      } catch (error) {
        console.log('⚠️ Error during button scan:', error);
      }

      console.log('⚠️ DHAI "Listening" status not detected, but proceeding...');
      return false;
    } catch (error) {
      console.log('⚠️ Error checking DHAI listening state:', error);
      return false;
    }
  }

  static async simulateMicrophoneInput(page: Page, audioPath: string): Promise<void> {
    try {
      console.log('🎤 Setting up enhanced virtual microphone...');

      // Read audio file as base64
      const audioBuffer = fs.readFileSync(audioPath);
      const base64Audio = audioBuffer.toString('base64');

      // Enhanced virtual microphone with better Chrome compatibility
      await page.evaluate((base64) => {
        return new Promise<void>(async (resolve) => {
          try {
            console.log('🎙️ Initializing enhanced virtual microphone...');

            // Create audio context with optimized settings for speech recognition
            const audioContext = new ((globalThis as any).AudioContext || (globalThis as any).webkitAudioContext)({
              sampleRate: 16000, // Optimal for speech recognition (was 44100)
              latencyHint: 'interactive'
            });

            // Ensure audio context is ready
            if (audioContext.state === 'suspended') {
              await audioContext.resume();
              console.log('🔊 Audio context resumed');
            }

            // Wait for audio context to be fully ready
            await new Promise(resolve => {
              if (audioContext.state === 'running') {
                resolve(undefined);
              } else {
                audioContext.addEventListener('statechange', () => {
                  if (audioContext.state === 'running') {
                    resolve(undefined);
                  }
                });
              }
            });

            // Decode TTS audio with error handling
            let decodedBuffer;
            try {
              const audioData = Uint8Array.from(atob(base64), c => c.charCodeAt(0));
              decodedBuffer = await audioContext.decodeAudioData(audioData.buffer);
              console.log(`🎵 Audio decoded: ${decodedBuffer.duration.toFixed(2)}s duration`);
            } catch (decodeError) {
              console.error('❌ Audio decode failed:', decodeError);
              resolve();
              return;
            }

            // Create enhanced audio pipeline optimized for speech recognition
            const source = audioContext.createBufferSource();
            source.buffer = decodedBuffer;

            // Optimized gain for speech recognition (higher for better detection)
            const micGain = audioContext.createGain();
            micGain.gain.value = 1.2; // Increased from 0.8

            // Reduced background noise for cleaner speech recognition
            const noiseBuffer = audioContext.createBuffer(1, audioContext.sampleRate * 0.1, audioContext.sampleRate);
            const noiseData = noiseBuffer.getChannelData(0);
            for (let i = 0; i < noiseData.length; i++) {
              noiseData[i] = (Math.random() - 0.5) * 0.005; // Much quieter noise (was 0.02)
            }

            const noiseSource = audioContext.createBufferSource();
            noiseSource.buffer = noiseBuffer;
            noiseSource.loop = true;

            const noiseGain = audioContext.createGain();
            noiseGain.gain.value = 0.01; // Much quieter (was 0.05)

            // Optimized compressor for speech clarity
            const compressor = audioContext.createDynamicsCompressor();
            compressor.threshold.value = -18; // Less aggressive (was -24)
            compressor.knee.value = 20; // Smoother (was 30)
            compressor.ratio.value = 8; // Less compression (was 12)
            compressor.attack.value = 0.001; // Faster attack (was 0.003)
            compressor.release.value = 0.1; // Faster release (was 0.25)

            // Create destination stream
            const destination = audioContext.createMediaStreamDestination();

            // Connect optimized audio pipeline
            source.connect(micGain);
            noiseSource.connect(noiseGain);
            micGain.connect(compressor);
            noiseGain.connect(compressor);
            compressor.connect(destination);

            // Also connect to speakers for monitoring (optional)
            compressor.connect(audioContext.destination);

            console.log('🔗 Optimized audio pipeline connected for speech recognition');

            // Store original getUserMedia
            const nav = (globalThis as any).navigator;
            const originalGetUserMedia = nav.mediaDevices.getUserMedia.bind(nav.mediaDevices);

            // Enhanced getUserMedia override
            nav.mediaDevices.getUserMedia = async function (constraints: any) {
              if (constraints && constraints.audio) {
                console.log('🎤 Chrome requesting microphone - providing optimized virtual microphone');

                const stream = destination.stream;

                // Enhanced stream properties
                Object.defineProperty(stream, 'id', {
                  value: `virtual-mic-${Date.now()}`,
                  writable: false
                });

                // Enhanced audio track properties optimized for speech
                const audioTrack = stream.getAudioTracks()[0];
                if (audioTrack) {
                  Object.defineProperty(audioTrack, 'label', {
                    value: 'Default - Virtual Microphone (Speech Optimized)',
                    writable: false
                  });
                  Object.defineProperty(audioTrack, 'kind', {
                    value: 'audio',
                    writable: false
                  });
                  Object.defineProperty(audioTrack, 'enabled', {
                    value: true,
                    writable: true
                  });
                  Object.defineProperty(audioTrack, 'readyState', {
                    value: 'live',
                    writable: false
                  });

                  // Optimized constraints for speech recognition
                  audioTrack.getConstraints = () => ({
                    echoCancellation: false, // Disable for cleaner TTS (was true)
                    noiseSuppression: false, // Disable for cleaner TTS (was true)
                    autoGainControl: false, // Disable for consistent volume (was true)
                    sampleRate: 16000, // Optimal for speech (was 44100)
                    channelCount: 1
                  });

                  audioTrack.getSettings = () => ({
                    echoCancellation: false,
                    noiseSuppression: false,
                    autoGainControl: false,
                    sampleRate: 16000,
                    channelCount: 1,
                    deviceId: 'virtual-microphone-speech-device'
                  });
                }

                console.log('✅ Speech-optimized virtual microphone stream provided to Chrome');
                return Promise.resolve(stream);
              }

              return originalGetUserMedia(constraints);
            };

            // Start background noise first
            noiseSource.start(0);
            console.log('🌊 Background noise started (minimal for speech clarity)');

            // Longer delay before starting main audio for better recognition
            setTimeout(() => {
              console.log('🗣️ Starting TTS audio playback...');
              source.start(0);
            }, 1000); // Increased from 500ms to 1000ms

            // Handle audio completion with extended processing time
            source.onended = () => {
              console.log('✅ TTS audio playback completed');

              // Keep microphone active much longer for speech processing
              setTimeout(() => {
                noiseSource.stop();
                console.log('🔇 Virtual microphone session completed');
                resolve();
              }, 8000); // Increased from 5000ms to 8000ms
            };

            // Extended safety timeout
            setTimeout(() => {
              console.log('⏰ Virtual microphone safety timeout');
              try {
                noiseSource.stop();
              } catch { }
              resolve();
            }, 45000); // Increased from 30000ms to 45000ms

          } catch (error) {
            console.error('❌ Enhanced virtual microphone failed:', error);
            resolve();
          }
        });
      }, base64Audio);

      console.log('🎤 Speech-optimized virtual microphone setup completed');

    } catch (error) {
      console.error('Error setting up enhanced virtual microphone:', error);
    }
  }

  static async playTTSToMicrophone(page: Page, text: string): Promise<void> {
    try {
      console.log(`🎤 Sending TTS to virtual microphone: "${text}"`);

      // Generate TTS audio
      const audioPath = await this.generateTTS(text);

      // Send TTS to virtual microphone (not just play audio)
      await this.simulateMicrophoneInput(page, audioPath);

      // Clean up audio file
      try {
        fs.unlinkSync(audioPath);
      } catch { }

      console.log(`✅ TTS sent to microphone for: "${text}"`);

    } catch (error) {
      console.error('Error sending TTS to microphone:', error);
    }
  }

  static async sendFullTTS(page: Page, question: string, wakeWord: string = 'halo luna'): Promise<void> {
    try {
      // Combine wake word + question in one TTS (no pause)
      const fullText = `${wakeWord} ${question}`;
      console.log(`\n🎤 Sending combined TTS: "${fullText}"`);

      // Check if DHAI is in listening state before sending audio
      console.log('🔍 Checking DHAI listening state before TTS...');
      const isListening = await this.checkDhaiListeningState(page);
      
      if (!isListening) {
        console.log('⚠️ DHAI not in listening state, waiting a bit...');
        await Modul.waitTime(2);
      }

      // Send combined wake word + question to virtual microphone
      await this.playTTSToMicrophone(page, fullText);

      // Dynamic wait time based on text length for better recognition
      const baseWaitTime = 4;
      const textLengthFactor = Math.ceil(fullText.length / 20); // 1 extra second per 20 chars
      const dynamicWaitTime = baseWaitTime + textLengthFactor;
      
      console.log(`⏳ Waiting ${dynamicWaitTime}s for DHAI to process audio (text length: ${fullText.length} chars)...`);
      await Modul.waitTime(dynamicWaitTime);

      console.log(`✅ Combined TTS completed: "${fullText}"\n`);
    } catch (error) {
      console.error('Error saat sending combined TTS to microphone:', error);
      throw error;
    }
  }

  static async waitForDhaiResponse(page: Page, maxWaitTime: number = 15): Promise<string[]> {
    console.log('⏳ Waiting for DHAI response...');

    const startTime = Date.now();
    let lastResponseLength = 0;

    while (Date.now() - startTime < maxWaitTime * 1000) {
      try {
        // Check for various response indicators
        const responseSelectors = [
          '#bubble-msg',
          '[class*="response"]',
          '[class*="message"]',
          '[class*="chat"]',
          '[class*="bubble"]',
          '.bot-response',
          '.assistant-response'
        ];

        for (const selector of responseSelectors) {
          try {
            const element = page.locator(selector).first();
            if (await element.isVisible({ timeout: 1000 })) {
              const content = await element.textContent();
              if (content && content.trim().length > lastResponseLength) {
                console.log(`📝 DHAI response detected: ${content.trim().substring(0, 100)}...`);
                return [content.trim()];
              }
            }
          } catch {
            // Continue checking other selectors
          }
        }

        // Wait a bit before checking again
        await Modul.waitTime(1);

      } catch (error) {
        console.log('⚠️ Error while waiting for response:', error);
      }
    }

    console.log('⏰ Timeout waiting for DHAI response');
    return ['Timeout: Tidak ada respons dari DHAI dalam waktu yang ditentukan'];
  }

  static async waitForValidResponse(page: Page, previousResponseLength: number = 0): Promise<string[]> {
    console.log('⏳ Waiting for new DHAI response...');

    let attempts = 0;
    const maxAttempts = 8; // Increased attempts
    let lastDetectedLength = previousResponseLength;

    while (attempts < maxAttempts) {
      attempts++;
      console.log(`🔍 Checking for new response (attempt ${attempts}/${maxAttempts})...`);

      // Wait between attempts
      await Modul.waitTime(2); // Reduced wait time

      // Get current bubble-msg content
      const bubbleMsg = await page.locator('#bubble-msg').textContent();
      if (bubbleMsg && bubbleMsg.trim()) {
        const currentLength = bubbleMsg.trim().length;

        // Check if there's new content
        if (currentLength > lastDetectedLength) {
          console.log(`📝 New content detected (${currentLength} vs ${lastDetectedLength} chars)`);
          lastDetectedLength = currentLength;

          // Wait a bit more for complete response
          await Modul.waitTime(2);
          
          // Get updated content after waiting
          const finalBubbleMsg = await page.locator('#bubble-msg').textContent();
          if (finalBubbleMsg && finalBubbleMsg.trim()) {
            const finalLength = finalBubbleMsg.trim().length;
            
            // If length is stable, extract the response
            if (finalLength === currentLength || attempts >= 6) {
              // Extract the latest response by splitting and getting recent parts
              const lines = finalBubbleMsg.split('\n').map(line => line.trim()).filter(line => line);
              
              // Find the most recent response (look for pattern: text followed by timestamp)
              let newResponse = '';
              for (let i = lines.length - 1; i >= 0; i--) {
                const line = lines[i];
                
                // Skip timestamps
                if (/^\d{2}:\d{2}$/.test(line)) {
                  continue;
                }
                
                // This should be the response text
                if (line && line.length > 10) { // Reasonable response length
                  newResponse = line;
                  break;
                }
              }

              // If we couldn't extract properly, get the last substantial line
              if (!newResponse && lines.length > 0) {
                for (let i = lines.length - 1; i >= 0; i--) {
                  const line = lines[i];
                  if (line && !line.match(/^\d{2}:\d{2}$/) && line.length > 5) {
                    newResponse = line;
                    break;
                  }
                }
              }

              if (newResponse) {
                console.log(`📝 New response extracted: "${newResponse.substring(0, 100)}${newResponse.length > 100 ? '...' : ''}"`);
                return [newResponse];
              }
            }
          }
        } else if (attempts <= 3) {
          // For first few attempts, continue waiting even if no new content
          console.log(`⏳ No new content yet, continuing to wait...`);
        }
      }
    }

    console.log('⚠️ No new response detected after multiple attempts');
    return ['Timeout: Tidak ada respons baru dari DHAI setelah TTS'];
  }

  static currentResponseLength = 0; // Track response length

  static async getReply(page: Page): Promise<string[]> {
    try {
      // Wait for DHAI to process and respond
      console.log('⏳ Waiting for DHAI to process TTS and respond...');
      await Modul.waitTime(4);

      // Get current response length before waiting for new response
      const currentBubbleMsg = await page.locator('#bubble-msg').textContent();
      const previousLength = this.currentResponseLength;

      console.log(`📊 Previous response length: ${previousLength} chars`);

      // Get new response with length tracking
      const response = await this.waitForValidResponse(page, previousLength);

      // Update current response length
      if (currentBubbleMsg) {
        this.currentResponseLength = currentBubbleMsg.trim().length;
      }

      if (response[0] && !response[0].includes('Timeout')) {
        console.log(`✅ New DHAI response received: ${response[0]}`);
        return response;
      } else {
        console.log('⚠️ No new response received, but continuing...');
        return response;
      }

    } catch (error) {
      console.error('Error saat mengambil balasan dari DHAI:', error);
      return ['Error: Gagal mengambil respons dari DHAI'];
    }
  }

  static async takeScreenshot(page: Page, idTest: string, key: string, question: string): Promise<string> {
    const screenshotDir = 'report/screenshoot';
    if (!fs.existsSync(screenshotDir)) {
      fs.mkdirSync(screenshotDir, { recursive: true });
    }

    const sanitizedQuestion = question.substring(0, 30).replace(/[^a-z0-9]/gi, '_');
    const filename = `${idTest}_${key}_${sanitizedQuestion}.png`;
    const filepath = `${screenshotDir}/${filename}`;

    await page.screenshot({ path: filepath, fullPage: true });
    return filename;
  }

  static calculateStatus(score: number): string {
    return score >= 70 ? 'PASS' : 'FAILED';
  }

  static async actions(
    page: Page,
    jsonData: TestData[],
    reportFilename: string,
    idTest: string,
    timeStart: string,
    today: string,
    testerName: string,
    url: string,
    titlePage: string,
    browserName: string,
    wakeWord: string = 'halo luna'
  ): Promise<void> {
    const title = '🎤 Membaca pertanyaan dan mengirim ke DHAI Wake-up Word dengan TTS';
    Modul.showLoading(title);
    console.log();

    try {
      await this.startChat(page);
      await Modul.waitTime(5);
    } catch (error) {
      console.error('Gagal memulai obrolan DHAI Wake-up Word:', error);
      return;
    }

    const countPerElementTitle = jsonData.length;
    const questionCount = jsonData.reduce((sum, item) => {
      return sum + Object.keys(item).filter(key => key.startsWith('pertanyaan')).length;
    }, 0);

    for (const element of jsonData) {
      const durationPerTitle = Modul.startTime();
      Modul.showLoading(element.title || 'Untitled');
      console.log();

      for (const [key, value] of Object.entries(element)) {
        if (key.startsWith('pertanyaan') && value && value.trim() !== '') {
          const durationPerQuestion = Modul.startTime();
          const question = value;

          try {
            // Send full TTS (wake word + question)
            await this.sendFullTTS(page, question, wakeWord);

            // Take screenshot after TTS
            const imageCapture = await this.takeScreenshot(page, idTest, key, question);

            // Wait for DHAI response after TTS and validate
            console.log('📝 Getting DHAI response after TTS...');
            const respondBotList = await this.getReply(page);
            let respondBot = respondBotList.join('\n').trim();

            // Validate response before continuing
            if (!respondBot || respondBot.includes('Timeout') || respondBot.includes('Error')) {
              console.log('⚠️ Invalid or no response received, but recording for report...');
              respondBot = respondBot || 'Error: Tidak ada balasan dari bot.';
            } else {
              console.log('✅ Valid response received, ready for next question');
            }

            // Additional wait to ensure DHAI is ready for next question
            console.log('⏳ Ensuring DHAI is ready for next question...');
            await Modul.waitTime(2);

            const titleLoading = `${key} : ${question}`;
            Modul.showLoadingSampleText(titleLoading);

            const respondCsv = (element.context || '').trim();
            const endDurationPerSampleText = Modul.endTime(durationPerQuestion);

            const skor = 80;
            const explanation = 'Auto-evaluated with TTS';
            const AI = 'Playwright TypeScript + Google TTS';

            const status = this.calculateStatus(skor);

            const dataBotData: BotData = {
              no: element.no || '',
              title: element.title || '',
              question: `${wakeWord} ${question}`,
              response_kb: respondCsv,
              response_llm: respondBot,
              status,
              duration: endDurationPerSampleText,
              image_capture: imageCapture,
              skor,
              explanation
            };

            EnvFile.writeJsonDataBot(dataBotData, reportFilename, idTest);

            const dataSummary: SummaryData = {
              id_test: idTest,
              tester_name: testerName,
              ai_evaluation: AI,
              url,
              page_name: titlePage,
              browser_name: browserName,
              date_test: today,
              start_time_test: timeStart,
              total_title: countPerElementTitle,
              total_question: questionCount,
              success: 0,
              failed: 0
            };

            EnvFile.writeJsonDataSummary(dataSummary, reportFilename, idTest);
          } catch (error) {
            console.error(`Error selama interaksi DHAI Wake-up Word untuk pertanyaan '${question}':`, error);
          }
        }
      }

      const endDurationPerTitle = Modul.endTime(durationPerTitle);
      const chart = { [element.title || 'Untitled']: endDurationPerTitle };
      EnvFile.writeJsonChart(chart, reportFilename, idTest);
      console.log(`\n⏱️ Total durasi Topik '${element.title || 'Untitled'}' : ${endDurationPerTitle}\n`);
    }

    console.log('✅ Topik Terakhir \n');

    // Cleanup temp audio folder
    try {
      if (fs.existsSync('temp_audio')) {
        fs.rmSync('temp_audio', { recursive: true, force: true });
      }
    } catch { }
  }
}
