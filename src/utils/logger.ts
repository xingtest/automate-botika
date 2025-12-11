/**
 * Structured Logger using Winston
 * Provides consistent logging across the application
 */

import * as winston from 'winston';
import * as path from 'path';
import * as fs from 'fs';

// Ensure log directory exists
const logDir = 'log';
if (!fs.existsSync(logDir)) {
    fs.mkdirSync(logDir, { recursive: true });
}

// Custom format for console output (human-readable)
const consoleFormat = winston.format.printf(({ level, message, timestamp, ...metadata }: any) => {
    let msg = `${timestamp} [${level.toUpperCase()}]: ${message}`;

    // Add metadata if present
    if (Object.keys(metadata).length > 0) {
        msg += ` ${JSON.stringify(metadata)}`;
    }

    return msg;
});

// Create logger instance
export const logger = winston.createLogger({
    level: process.env.LOG_LEVEL || 'info',
    format: winston.format.combine(
        winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
        winston.format.errors({ stack: true }),
        winston.format.splat(),
        winston.format.json()
    ),
    defaultMeta: { service: 'chatbot-testing' },
    transports: [
        // Error logs
        new winston.transports.File({
            filename: path.join(logDir, 'error.log'),
            level: 'error',
            maxsize: 5242880, // 5MB
            maxFiles: 5,
        }),
        // Combined logs
        new winston.transports.File({
            filename: path.join(logDir, 'combined.log'),
            maxsize: 5242880, // 5MB
            maxFiles: 5,
        }),
    ],
});

// Add console transport for non-production
if (process.env.NODE_ENV !== 'production') {
    logger.add(new winston.transports.Console({
        format: winston.format.combine(
            winston.format.colorize(),
            winston.format.timestamp({ format: 'HH:mm:ss' }),
            consoleFormat
        ),
    }));
}

/**
 * Helper functions for common logging patterns
 */
export const log = {
    /**
     * Debug level - detailed information for debugging
     */
    debug: (message: string, meta?: any) => {
        logger.debug(message, meta);
    },

    /**
     * Info level - general informational messages
     */
    info: (message: string, meta?: any) => {
        logger.info(message, meta);
    },

    /**
     * Warn level - warning messages
     */
    warn: (message: string, meta?: any) => {
        logger.warn(message, meta);
    },

    /**
     * Error level - error messages
     */
    error: (message: string, error?: Error | any, meta?: any) => {
        if (error instanceof Error) {
            logger.error(message, { error: error.message, stack: error.stack, ...meta });
        } else {
            logger.error(message, { error, ...meta });
        }
    },

    /**
     * Test-specific logging
     */
    test: {
        start: (testName: string, meta?: any) => {
            logger.info(`🧪 Starting test: ${testName}`, meta);
        },

        pass: (testName: string, score: number, meta?: any) => {
            logger.info(`✅ Test passed: ${testName}`, { score, ...meta });
        },

        fail: (testName: string, score: number, reason: string, meta?: any) => {
            logger.warn(`❌ Test failed: ${testName}`, { score, reason, ...meta });
        },

        complete: (testName: string, duration: string, meta?: any) => {
            logger.info(`✓ Test completed: ${testName}`, { duration, ...meta });
        },
    },

    /**
     * Platform-specific logging
     */
    platform: {
        init: (platform: string, url?: string) => {
            logger.info(`🚀 Initializing platform: ${platform}`, { url });
        },

        action: (action: string, meta?: any) => {
            logger.debug(`⚡ Platform action: ${action}`, meta);
        },

        error: (platform: string, error: Error | any) => {
            logger.error(`❌ Platform error: ${platform}`, error);
        },
    },

    /**
     * Evaluation-specific logging
     */
    evaluation: {
        start: (question: string) => {
            logger.debug(`🤖 Evaluating response for: ${question}`);
        },

        gemini: (score: number, explanation: string) => {
            logger.info(`🤖 Gemini evaluation complete`, { score, explanation });
        },

        fallback: (score: number, reason: string) => {
            logger.info(`🔄 Fallback evaluation used`, { score, reason });
        },
    },

    /**
     * Response capture logging
     */
    capture: {
        strategy: (strategyName: string, success: boolean, responseCount: number) => {
            if (success) {
                logger.info(`✅ Response captured using ${strategyName}`, { responseCount });
            } else {
                logger.debug(`⚠️ Strategy ${strategyName} failed`, { responseCount });
            }
        },

        noResponse: (question: string) => {
            logger.warn(`⚠️ No response captured for question`, { question });
        },
    },
};

/**
 * Create a child logger with additional context
 */
export function createChildLogger(context: any): winston.Logger {
    return logger.child(context);
}

/**
 * Set log level dynamically
 */
export function setLogLevel(level: string): void {
    logger.level = level;
    console.log(`📝 Log level set to: ${level}`);
}

export default logger;
