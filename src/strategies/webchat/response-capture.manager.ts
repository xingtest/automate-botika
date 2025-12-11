/**
 * Response Capture Manager
 * Manages multiple capture strategies and executes them in order
 */

import { Page } from 'playwright';
import { ResponseCaptureStrategy, ResponseCaptureResult } from '../response-strategy.interface';
import { DirectMessageStrategy } from './direct-message.strategy';
import { FallbackStrategy } from './fallback.strategy';
import { log } from '../../utils/logger';

export class WebchatResponseCapture {
    private strategies: ResponseCaptureStrategy[];

    constructor() {
        // Initialize strategies in order of preference
        this.strategies = [
            new DirectMessageStrategy(),
            new FallbackStrategy(),
        ];
    }

    /**
     * Capture responses using available strategies
     * Tries each strategy in order until one succeeds
     */
    async capture(page: Page, question: string): Promise<ResponseCaptureResult> {
        log.debug('Starting response capture', { question });

        for (const strategy of this.strategies) {
            try {
                log.debug(`Trying strategy: ${strategy.name}`);

                const responses = await strategy.capture(page, question);

                if (responses.length > 0) {
                    // Remove duplicates and filter out the question itself
                    const uniqueResponses = [...new Set(responses)].filter(
                        r => r.toLowerCase() !== question.trim().toLowerCase()
                    );

                    if (uniqueResponses.length > 0) {
                        log.info(`✅ Successfully captured ${uniqueResponses.length} responses using ${strategy.name}`);

                        return {
                            responses: uniqueResponses,
                            strategyUsed: strategy.name,
                            success: true
                        };
                    }
                }

                log.debug(`Strategy ${strategy.name} returned no valid responses`);

            } catch (error: any) {
                log.warn(`Strategy ${strategy.name} failed`, { error: error.message });
            }
        }

        // All strategies failed
        log.capture.noResponse(question);

        return {
            responses: [],
            strategyUsed: 'none',
            success: false
        };
    }

    /**
     * Add a custom strategy
     */
    addStrategy(strategy: ResponseCaptureStrategy): void {
        this.strategies.push(strategy);
        log.debug(`Added custom strategy: ${strategy.name}`);
    }

    /**
     * Get list of available strategies
     */
    getStrategies(): string[] {
        return this.strategies.map(s => s.name);
    }
}
