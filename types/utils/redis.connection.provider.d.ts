export function getRedisConnection(connectionOptions: RedisConnectionOptions): Redis;
export type RedisConnectionOptions = {
    pubSubChannel: string;
    host: string;
    port: number;
    password: string | null;
};
import Redis from 'ioredis';
