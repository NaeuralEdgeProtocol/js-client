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
export const getRedisConnection = (connectionOptions) => {
    const connection = {
        host: connectionOptions.host,
        port: connectionOptions.port,
    };

    if (connectionOptions.password) {
        connection.password = connectionOptions.password;
    }

    return new Redis(connection);
};
