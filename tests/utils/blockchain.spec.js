import { beforeAll, describe, expect, test } from '@jest/globals';
import { NaeuralBC } from '../../src/utils/blockchain.js';
import { Buffer} from 'node:buffer';
import * as crypto from 'crypto';


describe('NaeuralEdgeProtocol Blockchain Tests', () => {
    let mockNaeuralEdgeProtocolBCEngine;

    beforeAll(() => {
        mockNaeuralEdgeProtocolBCEngine = new NaeuralBC({
            debug: false,
            key: '308184020100301006072a8648ce3d020106052b8104000a046d306b020101042076afb17cbd2f4d79df89ec51555a1c1caf52137b44b8400e6a37bde4e0940375a14403420004e6d4bb30156faf39bd8f8ace9efb51b86554bb84968c2acc2e12a16a5b635a48974fe2d5790f6e00823461a830a6dbd719b8500df33ddedd93b3467a3511639f',
        });
    });

    test('exportAsPem', () => {
        const pem = mockNaeuralEdgeProtocolBCEngine.exportAsPem();
        const loadedKeyObject = NaeuralBC.loadFromPem(pem);
        const loadedECKeyPair = NaeuralBC.privateKeyObjectToECKeyPair(loadedKeyObject);

        expect(loadedECKeyPair.getPrivate('hex')).toEqual('76afb17cbd2f4d79df89ec51555a1c1caf52137b44b8400e6a37bde4e0940375');
        expect(loadedKeyObject
            .export({ type: 'pkcs8', format: 'der'})
            .toString('hex')
        )
        .toEqual(mockNaeuralEdgeProtocolBCEngine
            .keyPair
            .privateKey
            .export({ type: 'pkcs8', format: 'der'})
            .toString('hex')
        );
    });

    test('sign', () => {
        const message = {
            SERVER: 'gts-test',
            COMMAND: 'UPDATE_CONFIG',
            PAYLOAD: { GIGI: 'BUNA' },
        };

        const result = mockNaeuralEdgeProtocolBCEngine.sign(message);
        let messageToSend = JSON.parse(result);

        expect(messageToSend['EE_SIGN']).not.toBeNull();
        expect(messageToSend['EE_HASH']).toEqual('feca4c4882b2b0cfb872c73bda948b77048ced67b9eeae10c8bdd9028f9d20a1');
        expect(messageToSend['EE_SENDER']).toEqual('0xai_A-bUuzAVb685vY-Kzp77UbhlVLuElowqzC4SoWpbY1pI');

        expect(mockNaeuralEdgeProtocolBCEngine.verify(result)).toBe(true);
    });

    test('verify with good signature, 0xai_ address prefix', () => {
        const receivedMessage = `{
            "SERVER": "gigi",
            "COMMAND": "get",
            "PARAMS": "1",
            "EE_SENDER": "0xai_AsteqC-MZKBK6JCkSxfM-kU46AV0MP6MxiB4K1XAcjzo",
            "EE_SIGN": "MEQCIBML0hRjJtzKJnaZhLwki2awVTNKE_-TanMrapmkpsI2AiADjkUb8TuKCtysAIfBwKwwPzys-48X6zB9HyINJzGzPQ==",
            "EE_HASH": "e00e86d172c160edc66177b0c4cbc464ababc2f1827433789e68322c6eb766ed"
        }`;

        expect(mockNaeuralEdgeProtocolBCEngine.verify(receivedMessage)).toBe(true);
    });

    test('verify with bad signature', () => {
        const receivedMessage =
            '{"SERVER": "gigi", "COMMAND": "get", "PARAMS": "1", "EE_SENDER": "0xai_AsteqC-MZKBK6JCkSxfM-kU46AV0MP6MxiB4K1XAcjzo", "EE_SIGN": "MEQCIBML0hRjJtzKJnaZhLwki2awVTNKE_-TanMrapmkpsI2AiADjkUb8TuKCtysAIfBwKwwPzys-48X6zB9HyINnzGzPQ==", "EE_HASH": "e00e86d172c160edc66177b0c4cbc464ababc2f1827433789e68322c6eb766ed"}';

        expect(mockNaeuralEdgeProtocolBCEngine.verify(receivedMessage)).toBe(false);
    });

    test('verify with bad hash', () => {
        const receivedMessage =
            '{"SERVER": "gigi", "COMMAND": "get", "PARAMS": "1", "EE_SENDER": "0xai_AsteqC-MZKBK6JCkSxfM-kU46AV0MP6MxiB4K1XAcjzo", "EE_SIGN": "MEUCIH9Pm3KyxXSPgsAQ_VmvBP09k69FGJ0U9Ikd1_MgQiasAiEAx_nENZRt2DcPNLj_ReWSFczXIWyYuR9-St3eENVh6TA=", "EE_HASH": "5b5fc7b39c2cd4db70728fae3a665e7a370ceb9ef6a29f511aeb03daf50156fb"}';

        expect(mockNaeuralEdgeProtocolBCEngine.verify(receivedMessage)).toBe(false);
    });

    test('verify with bad address', () => {
        const receivedMessage =
            '{"SERVER": "gigi", "COMMAND": "get", "PARAMS": "1", "EE_SENDER": "0xai_AsteqC-MZkBK6JCkSxfM-kU46AV0MP6MxiB4K1XAcjzo", "EE_SIGN": "MEQCIBML0hRjJtzKJnaZhLwki2awVTNKE_-TanMrapmkpsI2AiADjkUb8TuKCtysAIfBwKwwPzys-48X6zB9HyINJzGzPQ==", "EE_HASH": "e00e86d172c160edc66177b0c4cbc464ababc2f1827433789e68322c6eb766ed"}';

        expect(mockNaeuralEdgeProtocolBCEngine.verify(receivedMessage)).toBe(false);
    });

    test('encrypt', () => {
        const data = '{"value": "Hello World"}';
        const destinationAddress = '0xai_A3vtcVIv_yL7k945IuhNjLUXKj2DPvbapoH4D6ZairfT';

        const encryptedData = mockNaeuralEdgeProtocolBCEngine.encrypt(data, destinationAddress);
        const decryptedData = mockNaeuralEdgeProtocolBCEngine.decrypt(encryptedData, destinationAddress);

        expect(decryptedData).toEqual(data);
    });

    xtest('decrypt', () => {
        // EE_IS_ENCRYPTED instead of EE_ENCRYPTED_DATA
        // EE_ENCRYPTED_DATA instead of ENCRYPTED_DATA
        const encryptedMessage = `{
            "EE_ENCRYPTED_DATA": true, 
            "ENCRYPTED_DATA": "Fyb6xwCJNph6Khv/TYwZhBSIE9UAbUrNnOWTtZ+3h3zCio9mda/UrYVgFNRhanI1qPA+TA==",
            "EE_SIGN": "MEYCIQCdmfGNooo1vdxSgM94Qe5f3FNf0RxHWcQBt_dPqfwvLAIhAISWV5lBZOX2H0C_ue9nMuS0bjDuFZtFRx7duWkXrfl5",
            "EE_SENDER": "0xai_AwwqvbL_Fw3y0MQzllx69JZSLYT3ybF9zanfrmcgAlEp",
            "EE_HASH": "f21dbbfb1630f4c508ca6034c5322dfe093f15f5878767f565be2fa4a016299b"
          }`;

        const verif = mockNaeuralEdgeProtocolBCEngine.verify(encryptedMessage);
        expect(verif).toEqual(true);

        const asObject = JSON.parse(encryptedMessage);
        const data = mockNaeuralEdgeProtocolBCEngine.decrypt(asObject['ENCRYPTED_DATA'], asObject['EE_SENDER']);

        expect(data).toEqual('{"value": "Hello World"}');
    });

    test('Get Random Words', () => {
        const numWords = 10;
        let words = NaeuralBC.generateRandomWords(numWords);

        words = words.filter((item, index) => words.indexOf(item) === index);
        expect(words.length).toEqual(numWords);
    });

    test('Generate From Secret Words', () => {
        // const words = ['Naeural', 'is', 'the', 'best', 'AI', 'and', 'blockchain', 'integration'];
        const words = [
            'stability', 'couple', 'allocation', 'email', 'administrator',
            'birth', 'refugees', 'simulation', 'laden', 'diagram', 'carried',
            'mortgage'
        ];
        const pem = NaeuralBC.convertECKeyPairToPEM(NaeuralBC.generateIdentityFromSecretWords(words));

        const expectedPem = `-----BEGIN PRIVATE KEY-----
MD4CAQAwEAYHKoZIzj0CAQYFK4EEAAoEJzAlAgEBBCDch2VDbeVR6j/4gEtnwPhx
dlX1mKIzZ+Rt94ydCRaVjw==
-----END PRIVATE KEY-----
`;

        expect(pem).toEqual(expectedPem);

        const privateKeyWords = NaeuralBC.loadFromSecretWords(words);
        const privateKeyPem = NaeuralBC.loadFromPem(pem);

        expect(privateKeyPem.export({ type: 'pkcs8', format: 'der' }).toString('base64'))
            .toEqual(privateKeyWords.export({ type: 'pkcs8', format: 'der' }).toString('base64'));
    });
});
