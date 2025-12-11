/**
 * Response Capture Strategy Interface
 * Defines the contract for different response capture strategies
 */

import { Page } from 'playwright';

export interface ResponseCaptureStrategy {
    /**
     * Name of the strategy (for logging)
     */
    readonly name: string;

    /**
     * Capture bot responses from the page
     * @param page - Playwright page instance
     * @param question - The question that was asked
     * @returns Array of response strings
     */
    capture(page: Page, question: string): Promise<string[]>;
}

export interface ResponseCaptureResult {
    responses: string[];
    strategyUsed: string;
    success: boolean;
}
