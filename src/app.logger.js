import { levelNames, logLevels } from './constants.js';

/**
 * @class Logger
 *
 * This is a minimalistic implementation of a logger to be used if no other logger is provided.
 */
export class Logger {
    /**
     * Flag for identifying this logger throughout the SDK.
     *
     * @type {string}
     */
    type = 'internal';

    /**
     * The Logger constructor.
     *
     * Accepts the log level to output.
     *
     * @param {string} level
     */
    constructor(level = 'info') {
        this.currentLevel = logLevels[level];
    }

    /**
     * Shorthand method for printing a normal level log entry.
     *
     * @param {string} message
     * @param {Object} [context] Optional parameter, can be used for printing stack traces.
     */
    log(message, context) {
        this._print('info', message, context);
    }

    /**
     * Shorthand method for printing a debug level log entry.
     *
     * @param {string} message
     * @param {Object} [context] Optional parameter, can be used for printing stack traces.
     */
    debug(message, context) {
        this._print('debug', message, context);
    }

    /**
     * Shorthand method for printing a critical error level log entry.
     *
     * @param {string} message
     * @param {Object} [stackTrace] Optional parameter, can be used for printing stack traces.
     */
    error(message, stackTrace) {
        this._print('error', message, stackTrace);
    }

    /**
     * Shorthand method for printing an error or warning level log entry.
     *
     * @param {string} message
     * @param {Object} [context] Optional parameter, can be used for printing stack traces.
     */
    warn(message, context) {
        this._print('warn', message, context);
    }

    /**
     * Allows to set for a specific log level.
     *
     * @param {string} level
     */
    setLevel(level) {
        if (logLevels[level] !== undefined) {
            this.currentLevel = logLevels[level];
        } else {
            throw new Error(`Invalid log level: ${level}`);
        }
    }

    /**
     * Returns the currently configured logging level.
     *
     * @return {string}
     */
    getLevel() {
        return Object.keys(logLevels).find((key) => logLevels[key] === this.currentLevel);
    }

    /**
     * Internal method that formats and outputs the logged message.
     *
     * @param {string|number} level
     * @param {string} message
     * @param {Object} stackTrace
     * @private
     */
    _print(level, message, stackTrace) {
        let messageLevel = level;
        let levelName;
        if (typeof level === 'string') {
            messageLevel = logLevels[level];
            levelName = level;
        } else {
            levelName = levelNames[level];
        }

        if (messageLevel <= this.currentLevel) {
            const timestamp = new Date().toISOString();
            const logMessage = `[${timestamp}] [${levelName.toUpperCase()}] - ${message}`;
            console.log(logMessage);

            if (stackTrace) {
                console.log(stackTrace);
            }
        }
    }
}
