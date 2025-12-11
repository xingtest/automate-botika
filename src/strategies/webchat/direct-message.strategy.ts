/**
 * Direct Message Strategy
 * Primary strategy for capturing webchat responses
 */

import { Page } from 'playwright';
import { ResponseCaptureStrategy } from '../response-strategy.interface';
import { log } from '../../utils/logger';

export class DirectMessageStrategy implements ResponseCaptureStrategy {
    readonly name = 'DirectMessage';

    async capture(page: Page, question: string): Promise<string[]> {
        const replies: string[] = [];

        try {
            log.debug(`[${this.name}] Starting capture for question`, { question });

            // Wait for messages to stabilize
            await page.waitForTimeout(2000);

            // Get all message wrappers
            const allMessages = await page.locator('.message-content-wrapper').all();
            log.debug(`[${this.name}] Found ${allMessages.length} message wrappers`);

            // Find the index of our question
            let questionIndex = -1;
            for (let i = allMessages.length - 1; i >= 0; i--) {
                try {
                    const contents = await allMessages[i].locator('.content').all();
                    for (const content of contents) {
                        const text = await content.textContent();
                        if (text && text.trim().toLowerCase() === question.trim().toLowerCase()) {
                            questionIndex = i;
                            log.debug(`[${this.name}] Found question at index ${i}`);
                            break;
                        }
                    }
                    if (questionIndex >= 0) break;
                } catch (error) {
                    // Continue searching
                }
            }

            if (questionIndex < 0) {
                log.warn(`[${this.name}] Question not found in message history`);
                return replies;
            }

            // Capture ALL bot responses after our question until we hit another user message
            log.debug(`[${this.name}] Capturing responses from index ${questionIndex + 1} onwards`);

            for (let i = questionIndex + 1; i < allMessages.length; i++) {
                try {
                    const messageWrapper = allMessages[i];

                    // Check if this is a user message - if yes, STOP here
                    const hasUserClass = await messageWrapper.evaluate((el) => {
                        return el.classList.contains('user') ||
                            el.closest('.user') !== null ||
                            el.querySelector('.user') !== null;
                    });

                    if (hasUserClass) {
                        log.debug(`[${this.name}] Stopped at index ${i} - found next user message`);
                        break;
                    }

                    // Get all content parts from this bot message
                    const contentParts = await messageWrapper.locator('.content').all();
                    for (const part of contentParts) {
                        const text = await part.textContent();
                        if (text && text.trim() &&
                            !text.includes('Ketik pesan') &&
                            text.trim().length > 2) {
                            replies.push(text.trim());
                            log.debug(`[${this.name}] Captured bubble ${replies.length}`, {
                                preview: text.substring(0, 60) + '...'
                            });
                        }
                    }
                } catch (error: any) {
                    log.warn(`[${this.name}] Error at index ${i}`, { error: error.message });
                }
            }

            log.capture.strategy(this.name, replies.length > 0, replies.length);
            return replies;

        } catch (error: any) {
            log.error(`[${this.name}] Capture failed`, error);
            return replies;
        }
    }
}
