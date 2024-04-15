import { beforeEach, describe, expect, test, jest } from '@jest/globals';
import {
    REDIS_LOCK_EXPIRATION_TIME,
    REDIS_LOCK_MAX_RETRIES,
    REDIS_LOCK_RETRY_INTERVAL,
    THREAD_COMMAND_UPDATE_FLEET,
    THREAD_COMMAND_UPDATE_STATE,
} from '../../src/constants';

const mockedRedisConnection = {
    publish: jest.fn(),
    subscribe: jest.fn(),
    on: jest.fn(),
    set: jest.fn(),
    get: jest.fn().mockResolvedValue(null),
    del: jest.fn(),
    setnx: jest.fn(),
    expire: jest.fn(),
};

const mockedLogger = {
    error: jest.fn(),
    info: jest.fn(),
    debug: jest.fn(),
};

describe('RedisStateManager Tests', () => {
    let redisStateManager;
    let stateManagerModule;
    const pubSubChannel = 'testChannel';

    beforeEach(async () => {
        jest.resetAllMocks();

        jest.unstable_mockModule('../../src/utils/helper.functions.js', () => ({
            sleep: jest.fn().mockResolvedValue(undefined),
            generateId: jest.fn().mockReturnValue('1234-1234'),
        }));

        jest.unstable_mockModule('../../src/utils/redis.connection.provider.js', () => ({
            getRedisConnection: () => mockedRedisConnection,
        }));

        stateManagerModule = await import('../../src/models/redis.state.manager');

        redisStateManager = new stateManagerModule.RedisStateManager(
            {
                pubSubChannel,
                host: 'host',
                port: 2404,
            },
            mockedLogger,
        );
    });

    test('broadcastUpdateFleet() should publish fleet update correctly', async () => {
        const fleet = ['node1', 'node2'];
        await redisStateManager.broadcastUpdateFleet(fleet);

        expect(mockedRedisConnection.publish).toHaveBeenCalledWith(
            pubSubChannel,
            JSON.stringify({
                command: THREAD_COMMAND_UPDATE_FLEET,
                fleet,
            }),
        );
    });

    describe('getUniverse() Tests', () => {
        test('should return parsed universe object when data is present', async () => {
            const mockUniverseData = { node1: '2022-01-01T00:00:00Z', node2: '2022-01-02T00:00:00Z' };
            mockedRedisConnection.get.mockResolvedValue(JSON.stringify(mockUniverseData));

            const result = await redisStateManager.getUniverse();

            expect(result).toEqual(mockUniverseData);
            expect(mockedRedisConnection.get).toHaveBeenCalledWith(
                stateManagerModule.RedisStateManager.getRedisUniverseKeyAndLock()[0],
            );
        });

        test('should return an empty object when data is not present', async () => {
            mockedRedisConnection.get.mockResolvedValue(null);

            const result = await redisStateManager.getUniverse();

            expect(result).toEqual({});
            expect(mockedRedisConnection.get).toHaveBeenCalledWith(
                stateManagerModule.RedisStateManager.getRedisUniverseKeyAndLock()[0],
            );
        });
    });

    describe('update() Tests', () => {
        beforeEach(() => {
            console.log = jest.fn();
        });

        test('correctly handles a heartbeat update', async () => {
            const path = ['node1', null, null, null];
            const info = {
                EE_PAYLOAD_PATH: path,
                EE_TIMESTAMP: '2004-04-24T15:17:00Z',
                EE_TIMEZONE: 'UTC',
                DATA: { pipelines: ['pipeline1'] },
            };
            const key = stateManagerModule.RedisStateManager.getRedisHeartbeatKey(path[0]);

            await redisStateManager.nodeInfoUpdate(info);

            expect(mockedRedisConnection.set).toHaveBeenCalledWith(key, expect.any(String), 'EX', expect.any(Number));
            expect(mockedRedisConnection.publish).toHaveBeenCalledWith(
                pubSubChannel,
                JSON.stringify({
                    command: THREAD_COMMAND_UPDATE_STATE,
                    node: path[0],
                    state: info.DATA.pipelines,
                }),
            );
        });
    });

    describe('markNodeAsSeen() Tests', () => {
        const node = 'node1';
        const timestamp = Date.now();

        beforeEach(() => {
            console.error = jest.fn();
            redisStateManager._waitForLock = jest.fn();
        });

        test('successfully marks a node as seen, empty universe', async () => {
            redisStateManager._waitForLock.mockResolvedValue(true);
            mockedRedisConnection.get.mockResolvedValue(JSON.stringify({}));
            mockedRedisConnection.setnx.mockResolvedValue(1);
            const [key] = stateManagerModule.RedisStateManager.getRedisUniverseKeyAndLock();

            const result = await redisStateManager.markNodeAsSeen(node, timestamp);

            expect(result).toBe(true);
            expect(redisStateManager._waitForLock).toHaveBeenCalled();
            expect(mockedRedisConnection.get).toHaveBeenCalled();
            expect(mockedRedisConnection.set).toHaveBeenCalledWith(
                expect.stringMatching(key),
                expect.stringMatching(JSON.stringify({ [`${node}`]: timestamp })),
                'EX',
                expect.any(Number),
            );
            expect(mockedRedisConnection.del).toHaveBeenCalled();
        });

        test('successfully marks a node as seen, appends to universe', async () => {
            redisStateManager._waitForLock.mockResolvedValue(true);
            mockedRedisConnection.get.mockResolvedValue(
                JSON.stringify({
                    existing: 200404240000,
                }),
            );
            mockedRedisConnection.set.mockResolvedValue('OK');
            const [key] = stateManagerModule.RedisStateManager.getRedisUniverseKeyAndLock();

            const result = await redisStateManager.markNodeAsSeen(node, timestamp);

            expect(result).toBe(true);
            expect(redisStateManager._waitForLock).toHaveBeenCalled();
            expect(mockedRedisConnection.get).toHaveBeenCalled();
            expect(mockedRedisConnection.set).toHaveBeenCalledWith(
                expect.stringMatching(key),
                expect.stringMatching(JSON.stringify({ existing: 200404240000, [`${node}`]: timestamp })),
                'EX',
                expect.any(Number),
            );
            expect(mockedRedisConnection.del).toHaveBeenCalled();
        });

        test('successfully marks a node as seen, creates empty universe', async () => {
            redisStateManager._waitForLock.mockResolvedValue(true);
            mockedRedisConnection.get.mockResolvedValue(1234);
            mockedRedisConnection.set.mockResolvedValue('OK');
            const [key] = stateManagerModule.RedisStateManager.getRedisUniverseKeyAndLock();

            const result = await redisStateManager.markNodeAsSeen(node, timestamp);

            expect(result).toBe(true);
            expect(redisStateManager._waitForLock).toHaveBeenCalled();
            expect(mockedRedisConnection.get).toHaveBeenCalled();
            expect(mockedRedisConnection.set).toHaveBeenCalledWith(
                expect.stringMatching(key),
                expect.stringMatching(JSON.stringify({ [`${node}`]: timestamp })),
                'EX',
                expect.any(Number),
            );
            expect(mockedRedisConnection.del).toHaveBeenCalled();
        });

        test('fails to mark node as seen if lock acquisition fails', async () => {
            redisStateManager._waitForLock.mockResolvedValue(false);

            const result = await redisStateManager.markNodeAsSeen(node, timestamp);

            expect(result).toBe(false);
            expect(redisStateManager._waitForLock).toHaveBeenCalled();
            expect(mockedRedisConnection.set).not.toHaveBeenCalled();
        });

        test('logs an error and returns false if Redis operation fails', async () => {
            redisStateManager._waitForLock.mockResolvedValue(true);
            mockedRedisConnection.set.mockRejectedValue(new Error('Redis error'));
            const loggerSpy = jest.spyOn(mockedLogger, 'error');

            const result = await redisStateManager.markNodeAsSeen(node, timestamp);

            expect(result).toBe(false);
            expect(loggerSpy).toHaveBeenCalledWith(expect.any(String));
            expect(mockedRedisConnection.del).toHaveBeenCalled();
        });
    });

    describe('getNodeInfo() Tests', () => {
        const node = 'test-node';

        test('should return the cached node info when found', async () => {
            const expectedNodeInfo = { node: 'info' };
            mockedRedisConnection.get.mockResolvedValue(JSON.stringify(expectedNodeInfo));

            const result = await redisStateManager.getNodeInfo(node);

            expect(result).toEqual(expectedNodeInfo);
            expect(mockedRedisConnection.get).toHaveBeenCalledWith(`state:${node}:heartbeat`);
        });

        test('should return null when the cached node info is not found', async () => {
            mockedRedisConnection.get.mockResolvedValue(null);

            const result = await redisStateManager.getNodeInfo(node);

            expect(result).toEqual(null);
            expect(mockedRedisConnection.get).toHaveBeenCalledWith(`state:${node}:heartbeat`);
        });

        test('should return null when the cached node info is not string', async () => {
            mockedRedisConnection.get.mockResolvedValue(2004);

            const result = await redisStateManager.getNodeInfo(node);

            expect(result).toEqual(null);
            expect(mockedRedisConnection.get).toHaveBeenCalledWith(`state:${node}:heartbeat`);
        });
    });

    describe('updateNetworkSnapshot() method', () => {
        let supervisor, key, lock, update;

        beforeEach(() => {
            console.error = jest.fn();

            supervisor = 'supervisor1';
            [key, lock] = stateManagerModule.RedisStateManager.getSupervisorKeyAndLock(supervisor);
            update = { nodes: ['node1', 'node2'] };

            redisStateManager._waitForLock = jest.fn().mockResolvedValue(true);
            redisStateManager.markSupervisor = jest.fn().mockResolvedValue(true);
            mockedRedisConnection.del = jest.fn().mockResolvedValue('OK');
        });

        test('successfully updates the network snapshot and marks supervisor', async () => {
            const result = await redisStateManager.updateNetworkSnapshot(supervisor, update);

            expect(result).toBe(true);
            expect(redisStateManager._waitForLock).toHaveBeenCalledWith(
                lock,
                REDIS_LOCK_RETRY_INTERVAL,
                REDIS_LOCK_MAX_RETRIES,
            );
            expect(mockedRedisConnection.set).toHaveBeenCalledWith(
                key,
                JSON.stringify(update),
                'EX',
                expect.any(Number),
            );
            expect(redisStateManager.markSupervisor).toHaveBeenCalledWith(supervisor);
            expect(mockedRedisConnection.del).toHaveBeenCalled();
        });

        test('fails to update the network snapshot if lock acquisition fails', async () => {
            redisStateManager._waitForLock.mockResolvedValue(false);

            const result = await redisStateManager.updateNetworkSnapshot(supervisor, update);

            expect(result).toBe(false);
            expect(redisStateManager._waitForLock).toHaveBeenCalledWith(
                lock,
                REDIS_LOCK_RETRY_INTERVAL,
                REDIS_LOCK_MAX_RETRIES,
            );
            expect(mockedRedisConnection.set).not.toHaveBeenCalled();
            expect(redisStateManager.markSupervisor).not.toHaveBeenCalled();
            expect(mockedRedisConnection.del).not.toHaveBeenCalled();
        });

        test('handles Redis error during network snapshot update gracefully', async () => {
            mockedRedisConnection.set.mockRejectedValue(new Error('Redis error'));
            const loggerSpy = jest.spyOn(mockedLogger, 'error');

            let errorCaught = false;
            try {
                await redisStateManager.updateNetworkSnapshot(supervisor, update);
            } catch (error) {
                errorCaught = true;
            }

            expect(errorCaught).toBe(false);
            expect(redisStateManager._waitForLock).toHaveBeenCalled();
            expect(mockedRedisConnection.set).toHaveBeenCalled();
            expect(mockedRedisConnection.del).toHaveBeenCalled();
            expect(loggerSpy).toHaveBeenCalledWith(expect.any(String));
        });
    });

    describe('getNetworkSupervisors() Tests', () => {
        test('should return the network snapshot when found', async () => {
            const expectedSupervisorsList = ['node1', 'node2'];
            mockedRedisConnection.get.mockResolvedValue(JSON.stringify(expectedSupervisorsList));

            const result = await redisStateManager.getNetworkSupervisors();

            expect(result).toEqual(expectedSupervisorsList);
            expect(mockedRedisConnection.get).toHaveBeenCalledWith('network:supervisors');
        });

        test('should return empty array when the network snapshot is not found', async () => {
            mockedRedisConnection.get.mockResolvedValue(null);

            const result = await redisStateManager.getNetworkSupervisors();

            expect(result).toEqual([]);
            expect(mockedRedisConnection.get).toHaveBeenCalledWith('network:supervisors');
        });

        test('should return empty array when the network snapshot is not string', async () => {
            mockedRedisConnection.get.mockResolvedValue(2004);

            const result = await redisStateManager.getNetworkSupervisors();

            expect(result).toEqual([]);
            expect(mockedRedisConnection.get).toHaveBeenCalledWith('network:supervisors');
        });
    });

    describe('getNetworkSnapshot() Tests', () => {
        const supervisor = 'supervisor1';

        test('should return the network snapshot when found', async () => {
            const expectedSnapshot = { nodes: ['node1', 'node2'] };
            mockedRedisConnection.get.mockResolvedValue(JSON.stringify(expectedSnapshot));

            const result = await redisStateManager.getNetworkSnapshot(supervisor);

            expect(result).toEqual(expectedSnapshot);
            expect(mockedRedisConnection.get).toHaveBeenCalledWith(`network:snapshot:${supervisor}`);
        });

        test('should return null when the network snapshot is not found', async () => {
            mockedRedisConnection.get.mockResolvedValue(null);

            const result = await redisStateManager.getNetworkSnapshot(supervisor);

            expect(result).toBeNull();
            expect(mockedRedisConnection.get).toHaveBeenCalledWith(`network:snapshot:${supervisor}`);
        });

        test('should return null when the network snapshot is not string', async () => {
            mockedRedisConnection.get.mockResolvedValue(2004);

            const result = await redisStateManager.getNetworkSnapshot(supervisor);

            expect(result).toBeNull();
            expect(mockedRedisConnection.get).toHaveBeenCalledWith(`network:snapshot:${supervisor}`);
        });
    });

    describe('markSupervisor() Tests', () => {
        const supervisor = 'supervisor-node';

        beforeEach(() => {
            console.error = jest.fn();
            redisStateManager._waitForLock = jest.fn().mockResolvedValue(true);
            redisStateManager._acquireLock = jest.fn().mockResolvedValue(true);
            mockedRedisConnection.get = jest.fn();
            mockedRedisConnection.set = jest.fn().mockResolvedValue('OK');
            mockedRedisConnection.del = jest.fn().mockResolvedValue('OK');
        });

        test('successfully marks a new supervisor', async () => {
            mockedRedisConnection.get.mockResolvedValue(JSON.stringify([]));
            const [key, lock] = stateManagerModule.RedisStateManager.getObservedSupervisorsKeyAndLock();

            const result = await redisStateManager.markSupervisor(supervisor);

            expect(result).toBe(true);
            expect(redisStateManager._waitForLock).toHaveBeenCalledWith(
                lock,
                REDIS_LOCK_RETRY_INTERVAL,
                REDIS_LOCK_MAX_RETRIES,
            );
            expect(mockedRedisConnection.set).toHaveBeenCalledWith(
                expect.stringMatching(key),
                expect.stringContaining(supervisor),
                'EX',
                expect.any(Number),
            );
            expect(mockedRedisConnection.del).toHaveBeenCalled();
        });

        test('does not mark an already listed supervisor', async () => {
            mockedRedisConnection.get.mockResolvedValue(JSON.stringify([supervisor]));
            const [key, lock] = stateManagerModule.RedisStateManager.getObservedSupervisorsKeyAndLock();

            const result = await redisStateManager.markSupervisor(supervisor);

            expect(result).toBe(true);
            expect(redisStateManager._waitForLock).toHaveBeenCalledWith(
                lock,
                REDIS_LOCK_RETRY_INTERVAL,
                REDIS_LOCK_MAX_RETRIES,
            );
            expect(mockedRedisConnection.set).not.toHaveBeenCalledWith(
                expect.stringMatching(key),
                expect.stringContaining(supervisor),
                'EX',
                expect.any(Number),
            );
        });

        test('fails to mark supervisor if lock acquisition fails', async () => {
            redisStateManager._waitForLock.mockResolvedValue(false);
            const [, lock] = stateManagerModule.RedisStateManager.getObservedSupervisorsKeyAndLock();

            const result = await redisStateManager.markSupervisor(supervisor);

            expect(result).toBe(false);
            expect(redisStateManager._waitForLock).toHaveBeenCalledWith(
                lock,
                REDIS_LOCK_RETRY_INTERVAL,
                REDIS_LOCK_MAX_RETRIES,
            );
            expect(mockedRedisConnection.set).not.toHaveBeenCalled();
        });

        test('handles Redis error during network snapshot update gracefully', async () => {
            mockedRedisConnection.set.mockRejectedValue(new Error('Redis error'));
            const loggerSpy = jest.spyOn(mockedLogger, 'error');

            let errorCaught = false;
            try {
                await redisStateManager.markSupervisor(supervisor);
            } catch (error) {
                errorCaught = true;
            }

            expect(errorCaught).toBe(false);
            expect(redisStateManager._waitForLock).toHaveBeenCalled();
            expect(mockedRedisConnection.del).toHaveBeenCalled();
            expect(loggerSpy).toHaveBeenCalledWith(expect.any(String));
        });
    });

    describe('aquireLock() Tests', () => {
        test('should successfully acquire a lock and set expiration', async () => {
            mockedRedisConnection.setnx.mockResolvedValue(1);
            mockedRedisConnection.expire.mockResolvedValue(1);

            const lockKey = 'testLock';
            const result = await redisStateManager._acquireLock(lockKey);

            expect(result).toBe(true);
            expect(mockedRedisConnection.setnx).toHaveBeenCalledWith(lockKey, true);
            expect(mockedRedisConnection.expire).toHaveBeenCalledWith(lockKey, REDIS_LOCK_EXPIRATION_TIME);
        });

        test('should fail to acquire a lock if it already exists', async () => {
            mockedRedisConnection.setnx.mockResolvedValue(0);

            const lockKey = 'testLock';
            const result = await redisStateManager._acquireLock(lockKey);

            expect(result).toBe(false);
            expect(mockedRedisConnection.setnx).toHaveBeenCalledWith(lockKey, true);
            expect(mockedRedisConnection.expire).not.toHaveBeenCalled();
        });
    });

    describe('waitForLock() Tests', () => {
        test('should acquire lock immediately', async () => {
            redisStateManager._acquireLock = jest.fn().mockResolvedValue(true);
            const lockKey = 'some-lock-key';

            const result = await redisStateManager._waitForLock(lockKey);

            expect(result).toBe(true);
            expect(redisStateManager._acquireLock).toHaveBeenCalledTimes(1);
        });

        test('should acquire lock after several retries', async () => {
            redisStateManager._acquireLock = jest
                .fn()
                .mockResolvedValueOnce(false)
                .mockResolvedValueOnce(false)
                .mockResolvedValue(true);
            const lockKey = 'some-lock-key';

            const result = await redisStateManager._waitForLock(lockKey);

            expect(result).toBe(true);
            expect(redisStateManager._acquireLock).toHaveBeenCalledTimes(3);
        });

        test('should fail to acquire lock after exceeding max retries', async () => {
            redisStateManager._acquireLock = jest.fn().mockResolvedValue(false);
            const lockKey = 'some-lock-key';

            const result = await redisStateManager._waitForLock(lockKey, 100, 2); // Example with reduced maxRetries for the test

            expect(result).toBe(false);
            expect(redisStateManager._acquireLock).toHaveBeenCalledTimes(2); // Adjust based on max retries in the test call
        });
    });
});
