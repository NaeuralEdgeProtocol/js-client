import { beforeEach, describe, expect, test, jest } from '@jest/globals';
import {
    ALL_EDGE_NODES,
    INTERNAL_STATE_MANAGER,
    NODE_OFFLINE_CUTOFF_TIME,
    REDIS_STATE_MANAGER,
} from '../../src/constants';
import { State } from '../../src/models/state.js';

describe('State class tests', () => {
    let mockManager;
    let state;

    beforeEach(() => {
        mockManager = {
            on: jest.fn(),
            name: 'mock-manager',
            getUniverse: jest.fn(),
            nodeInfoUpdate: jest.fn(),
            getNodeInfo: jest.fn(),
            markNodeAsSeen: jest.fn(),
            broadcastUpdateFleet: jest.fn(),
            updateNetworkSnapshot: jest.fn(),
            getNetworkSnapshot: jest.fn(),
            getNetworkSupervisors: jest.fn(),
            registerThread: jest.fn(),
        };

        state = new State(INTERNAL_STATE_MANAGER, mockManager, { fleet: ['0xai_node1', '0xai_node2'] });
    });

    test('constructor() correctly assigned values', () => {
        expect(state.manager.name).toEqual('mock-manager');
        expect(state.fleet).toEqual(['0xai_node1', '0xai_node2']);
        expect(state.type).toEqual(INTERNAL_STATE_MANAGER);
    });

    test('update() delegates update operation to the state manager', async () => {
        const mockUpdateInfo = { type: 'node', info: { id: 'node1', online: true } };
        mockManager.nodeInfoUpdate.mockResolvedValue(true);

        const result = await state.nodeInfoUpdate(mockUpdateInfo.info);

        expect(mockManager.nodeInfoUpdate).toHaveBeenCalledWith(mockUpdateInfo.info);
        expect(result).toBe(true);
    });

    test('getNodeInfo() retrieves node info from the state manager', async () => {
        const node = '0xai_node1';
        const expectedNodeInfo = { id: node, online: true, lastSeen: new Date() };
        mockManager.getNodeInfo.mockResolvedValue(expectedNodeInfo);

        const nodeInfo = await state.getNodeInfo(node);

        expect(mockManager.getNodeInfo).toHaveBeenCalledWith(node);
        expect(nodeInfo).toEqual(expectedNodeInfo);
    });

    describe('getRunningPipelineConfig() Tests', () => {
        test('retrieves running pipeline config', async () => {
            const node = '0xai_node1';
            const pipelineId = 'pipeline1';
            const expectedConfig = { id: pipelineId, setting: 'value' };
            const mockNodeInfo = {
                data: {
                    pipelines: {
                        [pipelineId]: {
                            config: expectedConfig,
                        },
                    },
                },
            };
            mockManager.getNodeInfo.mockResolvedValue(mockNodeInfo);

            const config = await state.getRunningPipelineConfig(node, pipelineId);

            expect(mockManager.getNodeInfo).toHaveBeenCalledWith(node);
            expect(config).toEqual(expectedConfig);
        });

        test('returns null if pipeline data is missing from the node info', async () => {
            const node = '0xai_node1';
            const pipelineId = 'pipeline1';
            mockManager.getNodeInfo.mockResolvedValue({ data: {} }); // No pipeline data

            const config = await state.getRunningPipelineConfig(node, pipelineId);

            expect(mockManager.getNodeInfo).toHaveBeenCalledWith(node);
            expect(config).toBeNull();
        });

        test('returns null if specified pipeline ID does not exist', async () => {
            const node = '0xai_node1';
            const pipelineId = 'nonexistentPipeline';
            const mockNodeInfo = {
                data: {
                    pipelines: {
                        pipeline1: {
                            config: {},
                        },
                    },
                },
            };
            mockManager.getNodeInfo.mockResolvedValue(mockNodeInfo);

            const config = await state.getRunningPipelineConfig(node, pipelineId);

            expect(mockManager.getNodeInfo).toHaveBeenCalledWith(node);
            expect(config).toBeNull();
        });
    });

    describe('getRunningInstanceConfig() Tests', () => {
        test('retrieves running instance config', async () => {
            const node = '0xai_node1';
            const pipelineId = 'pipeline1';
            const instanceId = 'instance1';
            const expectedConfig = { id: instanceId, setting: 'value' };
            const mockNodeInfo = {
                data: {
                    pipelines: {
                        [pipelineId]: {
                            plugins: {
                                signature1: {
                                    [instanceId]: {
                                        config: expectedConfig,
                                    },
                                },
                            },
                        },
                    },
                },
            };
            mockManager.getNodeInfo.mockResolvedValue(mockNodeInfo);

            const config = await state.getRunningInstanceConfig(node, pipelineId, instanceId);

            expect(mockManager.getNodeInfo).toHaveBeenCalledWith(node);
            expect(config).toEqual(expectedConfig);
        });

        test('returns null if instance data is missing from the pipeline', async () => {
            const node = '0xai_node1';
            const pipelineId = 'pipeline1';
            const instanceId = 'instance1';
            const mockNodeInfo = {
                data: {
                    pipelines: {
                        [pipelineId]: {
                            plugins: {}, // No instance data
                        },
                    },
                },
            };
            mockManager.getNodeInfo.mockResolvedValue(mockNodeInfo);

            const config = await state.getRunningInstanceConfig(node, pipelineId, instanceId);

            expect(mockManager.getNodeInfo).toHaveBeenCalledWith(node);
            expect(config).toBeNull();
        });

        test('returns null if specified instance ID does not exist within the pipeline', async () => {
            const node = '0xai_node1';
            const pipelineId = 'pipeline1';
            const instanceId = 'nonexistentInstance';
            const mockNodeInfo = {
                data: {
                    pipelines: {
                        [pipelineId]: {
                            plugins: {
                                signature1: {},
                            },
                        },
                    },
                },
            };
            mockManager.getNodeInfo.mockResolvedValue(mockNodeInfo);

            const config = await state.getRunningInstanceConfig(node, pipelineId, instanceId);

            expect(mockManager.getNodeInfo).toHaveBeenCalledWith(node);
            expect(config).toBeNull();
        });

        test('returns null when the specified pipeline ID does not exist in the node info', async () => {
            const node = '0xai_node1';
            const pipelineId = 'nonexistentPipeline';
            const instanceId = 'instance1';
            const mockNodeInfo = {
                data: {
                    pipelines: {
                        pipeline1: {
                            plugins: {
                                signature1: {
                                    [instanceId]: {
                                        config: {},
                                    },
                                },
                            },
                        },
                    },
                },
            };
            mockManager.getNodeInfo.mockResolvedValue(mockNodeInfo);

            const config = await state.getRunningInstanceConfig(node, pipelineId, instanceId);

            expect(mockManager.getNodeInfo).toHaveBeenCalledWith(node);
            expect(config).toBeNull();
        });
    });

    test('markNodeAsSeen() marks a node as seen using the state manager', async () => {
        const node = '0xai_node1';
        const timestamp = Date.now();
        mockManager.markNodeAsSeen.mockResolvedValue(true);

        const result = await state.markAsSeen(node, timestamp);

        expect(mockManager.markNodeAsSeen).toHaveBeenCalledWith(node, timestamp);
        expect(result).toBe(true);
    });

    test('broadcastUpdateFleet() updates fleet and broadcasts the update using the state manager', () => {
        const fleetChange = { node: '0xai_node3', action: 1 };
        mockManager.broadcastUpdateFleet.mockImplementation(() => {});

        state.broadcastUpdateFleet(fleetChange);

        expect(state.fleet).toEqual([ '0xai_node1', '0xai_node2', '0xai_node3' ]);
        expect(mockManager.broadcastUpdateFleet).toHaveBeenCalledWith(fleetChange);
    });

    describe('getFleet() Tests', () => {
        test('should correctly process and return fleet status', async () => {
            mockManager.getUniverse.mockResolvedValue({
                node1: Date.now(),
                node2: Date.now() - 100000, // offline node
            });

            const expectedFleetStatus = await state.getFleet();
            expect(mockManager.getUniverse).toHaveBeenCalled();

            expectedFleetStatus.forEach((status) => {
                const node = status.name;
                if (node === 'node1') {
                    expect(status.status.online).toBeTruthy();
                } else if (node === 'node2') {
                    expect(status.status.online).toBeFalsy();
                }
            });
        });

        test('returns blank status for all nodes not within fleet', async () => {
            const now = Date.now();
            const mockUniverse = {
                '0xai_node3': now - 500,
                '0xai_node4': now - (NODE_OFFLINE_CUTOFF_TIME * 1000 + 1),
            };
            mockManager.getUniverse.mockResolvedValue(mockUniverse);

            const state = new State(INTERNAL_STATE_MANAGER, mockManager, { fleet: ['0xai_node3', '0xai_node4', '0xai_nodeX'] });

            const fleetStatus = await state.getFleet();

            expect(fleetStatus).toEqual([
                { address: '0xai_node3', node: null, status: { online: true, lastSeen: new Date(mockUniverse['0xai_node3']) } },
                { address: '0xai_node4', node: null, status: { online: false, lastSeen: new Date(mockUniverse['0xai_node4']) } },
                { address: '0xai_nodeX', node: null, status: { online: false, lastSeen: null } },
            ]);
        });

        test('returns status for all nodes when listening for all nodes', async () => {
            const now = Date.now();
            const mockUniverse = {
                node5: now - 500,
                node6: now - (NODE_OFFLINE_CUTOFF_TIME * 1000 + 1),
            };
            mockManager.getUniverse.mockResolvedValue(mockUniverse);

            const state = new State(INTERNAL_STATE_MANAGER, mockManager, { fleet: [ALL_EDGE_NODES] });

            const fleetStatus = await state.getFleet();

            expect(fleetStatus).toEqual([
                { address: 'node5', node: null, status: { online: true, lastSeen: new Date(mockUniverse['node5']) } },
                { address: 'node6', node: null, status: { online: false, lastSeen: new Date(mockUniverse['node6']) } },
            ]);
        });
    });

    describe('storeNetworkInfo() Tests', () => {
        test('stores network information using the state manager', async () => {
            const mockData = {
                CURRENT_NETWORK: {
                    node1: { online: true },
                    node2: { online: false },
                },
                EE_ID: 'network1',
                EE_SENDER: '0xai_network_super',
                TIMESTAMP_EXECUTION: '2023-01-01T00:00:00Z',
            };
            const expectedUpdate = {
                name: mockData.EE_ID,
                address: '0xai_network_super',
                status: mockData.CURRENT_NETWORK,
                timestamp: mockData.TIMESTAMP_EXECUTION,
            };

            mockManager.updateNetworkSnapshot.mockResolvedValue(true);

            const result = await state.storeNetworkInfo(mockData);

            expect(mockManager.updateNetworkSnapshot).toHaveBeenCalledWith(mockData.EE_SENDER, expectedUpdate);
            expect(result).toBe(true);
        });

        test('does not store network information if CURRENT_NETWORK is empty or not present', async () => {
            const mockDataWithEmptyNetwork = {
                CURRENT_NETWORK: {},
                EE_ID: 'network1',
                TIMESTAMP_EXECUTION: '2023-01-01T00:00:00Z',
            };
            const mockDataWithoutNetwork = {
                EE_ID: 'network1',
                TIMESTAMP_EXECUTION: '2023-01-01T00:00:00Z',
            };

            await state.storeNetworkInfo(mockDataWithEmptyNetwork);
            expect(mockManager.updateNetworkSnapshot).not.toHaveBeenCalled();

            mockManager.updateNetworkSnapshot.mockClear();
            await state.storeNetworkInfo(mockDataWithoutNetwork);
            expect(mockManager.updateNetworkSnapshot).not.toHaveBeenCalled();
        });
    });

    describe('getNetworkStatus() Tests', () => {
        test('fetches and returns network status for a specific supervisor', async () => {
            const supervisorId = 'supervisor1';
            const mockNetworkStatus = {
                name: supervisorId,
                status: { node1: { online: true } },
                timestamp: new Date().toISOString(),
            };
            mockManager.getNetworkSnapshot.mockResolvedValue(mockNetworkStatus);

            const networkStatus = await state.getNetworkStatus(supervisorId);

            expect(mockManager.getNetworkSnapshot).toHaveBeenCalledWith(supervisorId);
            expect(networkStatus).toEqual(mockNetworkStatus);
        });

        test('returns null when there are no supervisors', async () => {
            mockManager.getNetworkSupervisors.mockResolvedValue([]);

            const networkStatus = await state.getNetworkStatus();

            expect(networkStatus).toBeNull();
        });

        test('aggregates network statuses and returns the one with most entries', async () => {
            const supervisorNames = ['supervisor1', 'supervisor2'];
            const now = new Date();
            const mockNetworkStatuses = [
                { name: 'supervisor1', status: [1, 2], timestamp: new Date(now.getTime() - 10000).toISOString() },
                { name: 'supervisor2', status: [1, 2, 3], timestamp: now.toISOString() },
            ];
            mockManager.getNetworkSupervisors.mockResolvedValue(supervisorNames);
            mockManager.getNetworkSnapshot.mockImplementation((supervisorId) =>
                Promise.resolve(mockNetworkStatuses.find((status) => status.name === supervisorId)),
            );

            const networkStatus = await state.getNetworkStatus();

            expect(networkStatus).toEqual(mockNetworkStatuses[1]);
        });

        test('aggregates network statuses and returns the one with most entries, that is not older than 30s', async () => {
            const supervisorNames = ['supervisor1', 'supervisor2', 'supervisor3'];
            const now = new Date();
            const mockNetworkStatuses = [
                { name: 'supervisor1', status: [1, 2, 3, 4], timestamp: new Date(now.getTime() - 35000).toISOString() },
                { name: 'supervisor2', status: [1, 2], timestamp: now.toISOString() },
                { name: 'supervisor3', status: [1, 2, 3], timestamp: now.toISOString() },
            ];
            mockManager.getNetworkSupervisors.mockResolvedValue(supervisorNames);
            mockManager.getNetworkSnapshot.mockImplementation((supervisorId) =>
                Promise.resolve(mockNetworkStatuses.find((status) => status.name === supervisorId)),
            );

            const networkStatus = await state.getNetworkStatus();

            expect(networkStatus).toEqual(mockNetworkStatuses[2]);
        });

        test('aggregates network statuses and returns the most recent, if all info is older than 30s', async () => {
            const supervisorNames = ['supervisor1', 'supervisor2', 'supervisor3'];
            const now = new Date();
            const mockNetworkStatuses = [
                { name: 'supervisor1', status: [1, 2, 3, 4], timestamp: new Date(now.getTime() - 35000).toISOString() },
                { name: 'supervisor2', status: [1, 2], timestamp: new Date(now.getTime() - 31000).toISOString() },
                { name: 'supervisor3', status: [1, 2, 3], timestamp: new Date(now.getTime() - 33000).toISOString() },
            ];
            mockManager.getNetworkSupervisors.mockResolvedValue(supervisorNames);
            mockManager.getNetworkSnapshot.mockImplementation((supervisorId) =>
                Promise.resolve(mockNetworkStatuses.find((status) => status.name === supervisorId)),
            );

            const networkStatus = await state.getNetworkStatus();

            expect(networkStatus).toEqual(mockNetworkStatuses[1]);
        });
    });

    describe('registerThread() Tests', () => {
        test('registers a thread when using INTERNAL_STATE_MANAGER', () => {
            const threadType = 'worker';
            const threadDetails = { id: 'thread1', purpose: 'processing' };

            const state = new State(INTERNAL_STATE_MANAGER, mockManager, { fleet: [] });

            state.registerThread(threadType, threadDetails);

            expect(mockManager.registerThread).toHaveBeenCalledWith(threadType, threadDetails);
        });

        test('does not register a thread when not using INTERNAL_STATE_MANAGER', () => {
            const threadType = 'worker';
            const threadDetails = { id: 'thread2', purpose: 'analysis' };

            const state = new State(REDIS_STATE_MANAGER, mockManager, { fleet: [] });

            state.registerThread(threadType, threadDetails);

            expect(mockManager.registerThread).not.toHaveBeenCalled();
        });
    });
});
