import { beforeEach, describe, expect, test, jest } from '@jest/globals';
import { InternalStateManager } from '../../src/models/internal.state.manager.js';
import { THREAD_COMMAND_UPDATE_STATE } from '../../src/constants.js';

describe('InternalStateManager', () => {
    let manager;
    let mockPostMessage;

    beforeEach(() => {
        manager = new InternalStateManager();
        manager.logger = {
            log: () => {},
        };

        mockPostMessage = jest.fn();
        manager.registerThread('heartbeats', { postMessage: mockPostMessage });
        manager.registerThread('notifications', { postMessage: mockPostMessage });
    });

    test('broadcastUpdateFleet() sends correct message to all threads', () => {
        const fleetChange = { node: 'node1', action: 1 };
        manager.broadcastUpdateFleet(fleetChange);
        expect(mockPostMessage).toHaveBeenCalledTimes(2);
        expect(mockPostMessage).toHaveBeenCalledWith({
            command: 'THREAD_COMMAND_UPDATE_FLEET',
            ...fleetChange,
        });
    });

    test('getUniverse() returns the current universe state', async () => {
        const expectedUniverse = {
            node1: 20040424000,
            node2: 24042004000,
        };
        manager.state.universe = expectedUniverse;

        const universe = await manager.getUniverse();

        expect(universe).toEqual(expectedUniverse);
    });

    describe('getNodeInfo() Tests', () => {
        test('returns data for an existing node', async () => {
            const nodeName = 'node1';
            const nodeData = { pipelines: 'data1' };
            manager.state.hb[nodeName] = { data: nodeData };

            const result = await manager.getNodeInfo(nodeName);

            expect(result).toEqual({ data: nodeData });
        });

        test('returns null for a non-existing node', async () => {
            const nonExistingNode = 'unknownNode';
            const result = await manager.getNodeInfo(nonExistingNode);

            expect(result).toBeNull();
        });
    });

    test('updateNetworkSnapshot() updates the network snapshot for a supervisor and resolves with true', async () => {
        const supervisor = 'supervisor1';
        const networkSnapshot = { node1: 'data1', node2: 'data2' };

        const result = await manager.updateNetworkSnapshot(supervisor, networkSnapshot);

        expect(result).toBe(true);
        expect(manager.state.network[supervisor]).toEqual(networkSnapshot);
    });

    test('getNetworkSupervisors() returns a list of network supervisors', async () => {
        const supervisors = {
            supervisor1: {
                /* network data */
            },
            supervisor2: {
                /* network data */
            },
        };
        manager.state.network = supervisors;

        const result = await manager.getNetworkSupervisors();

        expect(result).toEqual(Object.keys(supervisors));
    });

    describe('getNetworkSnapshot() Tests', () => {
        test('returns the correct network snapshot for an existing supervisor', async () => {
            const supervisor = 'supervisor1';
            const networkSnapshot = { node1: 'data1', node2: 'data2' };
            manager.state.network[supervisor] = networkSnapshot;

            const result = await manager.getNetworkSnapshot(supervisor);

            expect(result).toEqual(networkSnapshot);
        });

        test('returns null for a non-existing supervisor', async () => {
            const nonExistingSupervisor = 'supervisor2';

            const result = await manager.getNetworkSnapshot(nonExistingSupervisor);

            expect(result).toBeNull();
        });
    });

    test('markNodeAsSeen() updates the universe state with the node and timestamp, and resolves with true', async () => {
        const node = 'node1';
        const timestamp = 200404240000;

        const result = await manager.markNodeAsSeen(node, timestamp);

        expect(result).toBe(true);
        expect(manager.state.universe[node]).toEqual(timestamp);
    });

    describe('nodeInfoUpdate() Tests', () => {
        beforeEach(() => {
            console.log = jest.fn();
        });

        test('HEARTBEAT_UPDATE updates the hb state and broadcasts to notifications and payloads threads', async () => {
            const info = {
                EE_PAYLOAD_PATH: ['node1', null, null, null],
                EE_TIMESTAMP: '2004-04-24T15:27:00Z',
                EE_TIMEZONE: 'UTC',
                DATA: { pipelines: 'updatedData' },
            };

            manager.registerThread('notifications', { postMessage: mockPostMessage });
            manager.registerThread('payloads', { postMessage: mockPostMessage });

            manager.nodeInfoUpdate(info);

            expect(manager.state.hb['node1']).toEqual({
                lastUpdate: expect.any(Number),
                nodeTime: { date: '2004-04-24T15:27:00Z', utc: 'UTC' },
                data: { pipelines: 'updatedData' },
            });

            expect(mockPostMessage).toHaveBeenCalledTimes(3);
            expect(mockPostMessage).toHaveBeenCalledWith({
                command: THREAD_COMMAND_UPDATE_STATE,
                node: 'node1',
                state: 'updatedData',
            });
        });
    });

    test('registerThread() method should register a thread', () => {
        const thread = { postMessage: jest.fn() };

        manager.registerThread('heartbeats', thread);

        expect(manager.threads.heartbeats).toContain(thread);
    });
});
