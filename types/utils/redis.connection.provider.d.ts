export function getRedisConnection(options: any, logger: any, alias: any): Redis;
export type RedisConnectionOptions = {
    pubSubChannel: string;
    host: string;
    port: number;
    password: string | null;
};
import Redis from 'ioredis';
