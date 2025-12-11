/**
 * Fallback Strategy
 * Used when DirectMessageStrategy fails to capture responses
 */

import { Page } from 'playwright';
import { ResponseCaptureStrategy } from '../response-strategy.interface';
import { log } from '../../utils/logger';

export class FallbackStrategy implements ResponseCaptureStrategy {
    readonly name = 'Fallback';

    async capture(page: Page, question: string): Promise<string[]> {
        const replies: string[] = [];

        try {
            log.debug(`[${this.name}] Starting fallback capture`);

            // Strategy 1: Look for bot messages (not user, not system)
            const botMessages = await page.locator('.message:not(.user):not(.system) .content').all();
            log.debug(`[${this.name}] Found ${botMessages.length} potential bot messages`);

            // Take last 6 messages to avoid capturing old messages
            const recentMessages = botMessages.slice(-6);

            for (const msg of recentMessages) {
                try {
                    const text = await msg.textContent();
                    if (text && text.trim() &&
                        text.trim().toLowerCase() !== question.trim().toLowerCase() &&
                        !text.includes('Ketik pesan') &&
                        text.length > 5) {
                        replies.push(text.trim());
                        log.debug(`[${this.name}] Captured message`, {
                            preview: text.substring(0, 50) + '...'
                        });
                    }
                } catch (error) {
                    // Continue with next message
                }
            }

            // If still no replies, try Strategy 2: Get recent content elements
            if (replies.length === 0) {
                log.debug(`[${this.name}] Trying alternative method`);

                const recentContent = await page.locator('.message-content-wrapper .content').all();
                const lastFew = recentContent.slice(-6);

                for (const msg of lastFew) {
                    try {
                        const text = await msg.textContent();
                        if (text && text.trim() &&
                            text.trim().toLowerCase() !== question.trim().toLowerCase() &&
                            !text.includes('Ketik pesan') &&
                            text.length > 5) {
                            replies.push(text.trim());
                        }
                    } catch (error) {
                        // Continue
                    }
                }
            }

            log.capture.strategy(this.name, replies.length > 0, replies.length);
            return replies;

        } catch (error: any) {
            log.error(`[${this.name}] Fallback capture failed`, error);
            return replies;
        }
    }
}
