import Redis from 'ioredis';

/**
 * @typedef {{pubSubChannel: string, host: string, port: number, password: string|null}} RedisConnectionOptions
 */

/**
 * Helper function for providing Redis connection.
 *
 * @param {RedisConnectionOptions} connectionOptions
 * @return {Redis}
 */
export const getRedisConnection = (options, logger, alias) => {
    const redis = new Redis({
        host: options.host || 'localhost',
        port: options.port || 6379,
        password: options.password || null,
        retryStrategy: (times) => {
            return Math.min(times * 50, 2000);
        }
    });

    const connectionName = alias || 'Redis connection';

    // Attach event handlers here so they're consistent across all Redis instances
    redis.on('error', (err) => {
        logger?.error(`${connectionName} error:`, err);
    });

    redis.on('wait', () => {
        logger?.warn(`${connectionName} waiting`);
    });

    redis.on('reconnecting', () => {
        logger?.warn(`${connectionName} attempting to reconnect...`);
    });

    redis.on('connecting', () => {
        logger?.log(`${connectionName} establishing connection...`);
    });

    redis.on('connect', () => {
        logger?.log(`${connectionName} connected`);
    });

    redis.on('ready', () => {
        logger?.log(`${connectionName} ready`);
    });

    redis.on('close', () => {
        logger?.warn(`${connectionName} closed`);
    });

    redis.on('end', () => {
        logger?.warn(`${connectionName} ended`);
    });

    return redis;
};
