/**
 * @class Logger
 *
 * This is a minimalistic implementation of a logger to be used if no other logger is provided.
 */
export class Logger {
    /**
     * The Logger constructor.
     *
     * Accepts the log level to output.
     *
     * @param {string} level
     */
    constructor(level?: string);
    /**
     * Flag for identifying this logger throughout the SDK.
     *
     * @type {string}
     */
    type: string;
    currentLevel: any;
    /**
     * Shorthand method for printing a normal level log entry.
     *
     * @param {string} message
     * @param {Object} [context] Optional parameter, can be used for printing stack traces.
     */
    log(message: string, context?: any): void;
    /**
     * Shorthand method for printing a debug level log entry.
     *
     * @param {string} message
     * @param {Object} [context] Optional parameter, can be used for printing stack traces.
     */
    debug(message: string, context?: any): void;
    /**
     * Shorthand method for printing a critical error level log entry.
     *
     * @param {string} message
     * @param {Object} [stackTrace] Optional parameter, can be used for printing stack traces.
     */
    error(message: string, stackTrace?: any): void;
    /**
     * Shorthand method for printing an error or warning level log entry.
     *
     * @param {string} message
     * @param {Object} [context] Optional parameter, can be used for printing stack traces.
     */
    warn(message: string, context?: any): void;
    /**
     * Allows to set for a specific log level.
     *
     * @param {string} level
     */
    setLevel(level: string): void;
    /**
     * Returns the currently configured logging level.
     *
     * @return {string}
     */
    getLevel(): string;
}
