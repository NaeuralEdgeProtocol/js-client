import { beforeAll, describe, expect, test } from '@jest/globals';
import * as crypto from 'crypto';
import * as zlib from 'node:zlib';
import { Buffer } from 'node:buffer';
import { NaeuralBC } from '../../src/utils/blockchain.js';

/**
 * Wire-format interop suite for the dual-layout command encryption:
 *
 *   legacy  [iv(12)][ciphertext][authTag(16)]           — historical JS peers
 *   flagged [nonce(12)][flag(1)][ciphertext+authTag]    — ratio1 python SDKs
 *                                                          (flag 1 = zlib)
 *
 * The receiving side must accept BOTH regardless of its own encryptFormat;
 * the emitting side must stay byte-identical to v4.1.2 unless explicitly
 * configured 'flagged'. These invariants are the contract that broke the
 * staging BE -> gts-staging command path (see wrapper plan
 * SDK_JS_ENCRYPTION_FORMAT_20260724_PLAN.md).
 */
describe('NaeuralBC dual wire-format encryption', () => {
    let sender;
    let receiver;
    let receiverAddress;
    let senderAddress;
    const message = JSON.stringify({ ACTION: 'UPDATE_CONFIG', PAYLOAD: { NAME: 'CV-1', TYPE: 'VideoStream' } });

    beforeAll(() => {
        // Distinct keypairs for each side; addresses derive from the keys.
        sender = new NaeuralBC({ debug: false });
        receiver = new NaeuralBC({ debug: false });
        receiverAddress = receiver.getAddress();
        senderAddress = sender.getAddress();
    });

    test('default engine emits the legacy layout, byte-identical shape', () => {
        expect(sender.encryptFormat).toEqual('legacy');

        const blob = Buffer.from(sender.encrypt(message, receiverAddress), 'base64');
        // GCM keeps ciphertext length == plaintext length: 12 iv + n + 16 tag.
        expect(blob.length).toEqual(12 + Buffer.byteLength(message, 'utf8') + 16);
    });

    test('legacy round-trip decrypts (attempt-1 hot path)', () => {
        const encrypted = sender.encrypt(message, receiverAddress);
        expect(receiver.decrypt(encrypted, senderAddress)).toEqual(message);
    });

    test('flagged engine emits python-parity layout: flag byte 1, deflated body', () => {
        const flaggedSender = new NaeuralBC({ debug: false, encryptFormat: 'flagged' });
        const blob = Buffer.from(flaggedSender.encrypt(message, receiverAddress), 'base64');

        expect(flaggedSender.encryptFormat).toEqual('flagged');
        expect(blob[12]).toEqual(1);
        // 12 nonce + 1 flag + len(deflate(message)) + 16 tag.
        const deflatedLen = zlib.deflateSync(Buffer.from(message, 'utf8')).length;
        expect(blob.length).toEqual(12 + 1 + deflatedLen + 16);
    });

    test('flagged round-trip decrypts on a default (legacy) receiver', () => {
        const flaggedSender = new NaeuralBC({ debug: false, encryptFormat: 'flagged' });
        const encrypted = flaggedSender.encrypt(message, receiverAddress);
        expect(receiver.decrypt(encrypted, flaggedSender.getAddress())).toEqual(message);
    });

    test('python flag=0 (uncompressed) layout decrypts', () => {
        // Hand-build the ec.py compressed=False variant with the sender key:
        // [nonce][0x00][plain-ct][tag] — proves the flag switch, not just
        // the flag=1 path our own encoder emits.
        const destinationPublicKey = NaeuralBC.addressToPublicKeyObject(receiverAddress);
        const sharedKey = sender._deriveSharedKey(destinationPublicKey);
        const iv = crypto.randomBytes(12);
        const cipher = crypto.createCipheriv('aes-256-gcm', sharedKey, iv);
        let ct = cipher.update(message, 'utf8');
        ct = Buffer.concat([ct, cipher.final()]);
        const blob = Buffer.concat([iv, Buffer.from([0]), ct, cipher.getAuthTag()]).toString('base64');

        expect(receiver.decrypt(blob, senderAddress)).toEqual(message);
    });

    test('tampered ciphertext returns null in both layouts', () => {
        const flaggedSender = new NaeuralBC({ debug: false, encryptFormat: 'flagged' });
        const cases = [
            [sender.encrypt(message, receiverAddress), senderAddress],
            [flaggedSender.encrypt(message, receiverAddress), flaggedSender.getAddress()],
        ];
        for (const [enc, fromAddress] of cases) {
            // Sanity: untampered blob decrypts with its true sender address,
            // so the null below is attributable to the tamper alone.
            expect(receiver.decrypt(enc, fromAddress)).toEqual(message);
            const buf = Buffer.from(enc, 'base64');
            buf[14] = buf[14] ^ 0xff;
            expect(receiver.decrypt(buf.toString('base64'), fromAddress)).toBeNull();
        }
    });

    test('garbage and null inputs return null, never throw', () => {
        expect(receiver.decrypt(null, senderAddress)).toBeNull();
        expect(receiver.decrypt(crypto.randomBytes(64).toString('base64'), senderAddress)).toBeNull();
    });
});
