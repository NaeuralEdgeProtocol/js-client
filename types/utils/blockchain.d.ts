/// <reference types="node" />
/// <reference types="node" />
/**
 * @typedef {Object} NaeuralBlockchainOptions
 * @property {boolean} [debug] - Indicates if debugging is enabled.
 * @property {string} [key] - The key for the blockchain.
 * @property {boolean} [encrypt] - Indicates if encryption is enabled.
 * @property {'legacy'|'flagged'} [encryptFormat] - Outgoing command-encryption wire layout: 'legacy' (default, historical [iv][ct][tag]) or 'flagged' (ratio1-python-parity [nonce][flag][zlib-ct+tag]); incoming decryption always tolerates both.
 * @property {boolean} [secure] - Indicates if the connection should be secure.
 */
/**
 * @class NaeuralBC
 *
 * This is the NaeuralEdgeProtocol Network Blockchain engine. Its purpose is to offer any integrator common features like
 * signature checking, message validation or key pair generation.
 */
export class NaeuralBC {
    /**
     * Generates a pair of public-private keys that can be used throughout this module
     * or when interacting with the network.
     *
     * @return {crypto.KeyPairKeyObjectResult} the keypair
     */
    static generateKeys(): crypto.KeyPairKeyObjectResult;
    static deriveKeyPairFromDERHex(hexString: any): {
        privateKey: crypto.KeyObject;
        publicKey: crypto.KeyObject;
    };
    static publicKeyObjectToECKeyPair(publicKey: any): any;
    static privateKeyObjectToECKeyPair(privateKeyObject: any): any;
    static addressToECPublicKey(address: any): any;
    static compressPublicKeyObject(publicKey: any): string;
    static addressFromPublicKey(publicKey: any): string;
    static addressToPublicKeyUncompressed(address: any): any;
    static addressToPublicKeyObject(address: any): crypto.KeyObject;
    static generateRandomWords(numWords?: number): string[];
    static generateIdentityFromSecretWords(words: any): any;
    static convertEllipticPrivateKeyToPKCS8DER(privateKeyHex: any): any;
    static convertECKeyPairToPEM(keyPair: any): string;
    static loadFromSecretWords(words: any): crypto.KeyObject;
    static loadFromPem(pem: any): crypto.KeyObject;
    /**
     * Strict (fatal) UTF-8 decode; `null` for invalid byte sequences.
     *
     * The permissive `Buffer.toString('utf8')` would silently substitute
     * U+FFFD for invalid sequences and "successfully" decode zlib-framed
     * bytes whose unauthenticated compression flag was tampered — python
     * peers reject the same bytes via strict `.decode()`, and this keeps
     * both SDKs' failure behavior identical.
     *
     * @param {Buffer} buf authenticated plaintext bytes
     * @return {string|null} decoded string, or null when not valid UTF-8
     * @private
     */
    private static _strictUtf8;
    /**
     * Attempts one AES-256-GCM decryption; `null` on authentication failure.
     *
     * Kept as a tiny static helper because decrypt() must run the same
     * primitive against two candidate parses of the envelope.
     *
     * @param {Buffer} sharedKey derived AES key
     * @param {Buffer} nonce 12-byte IV/nonce
     * @param {Buffer} ciphertext ciphertext without the auth tag
     * @param {Buffer} authTag 16-byte GCM tag
     * @return {Buffer|null} decrypted bytes, or null when auth fails
     * @private
     */
    private static _tryGcmDecrypt;
    /**
     * Removes the prefix from the address.
     *
     * @param {string} address
     * @return {string}
     * @private
     */
    private static _removeAddressPrefix;
    static _pathToKey(path: any): any;
    static _extractNumberLexemesByPath(fullJSONMessage: any): Map<any, any>;
    static _extractNumberLexemesByPathFallback(fullJSONMessage: any): Map<any, any>;
    static _stableStringifyWithNumberLexemes(value: any, numberLexemes: any, path?: any[]): any;
    /**
     * NaeuralEdgeProtocol Network Blockchain engine constructor.
     *
     * @param {NaeuralBlockchainOptions} options
     */
    constructor(options: NaeuralBlockchainOptions);
    /**
     * The keypair that is in use.
     *
     * @type {{privateKey: crypto.KeyObject, publicKey: crypto.KeyObject}}
     * @private
     */
    private keyPair;
    /**
     * A handy cache for the public key.
     *
     * @type {string}
     * @private
     */
    private compressedPublicKey;
    /**
     * Flag to boot the engine in debug mode. Will output signature verification logs.
     *
     * @type {boolean}
     * @private
     */
    private debugMode;
    /**
     * Outgoing command-encryption layout.
     *
     * 'legacy'  -> [iv(12)][ciphertext][authTag(16)] — the historical
     *              @hyfy/jsclient layout, byte-identical to v4.1.2.
     *              Only pre-2025 python-SDK nodes still require it.
     * 'flagged' -> [nonce(12)][flag(1)][ciphertext+authTag] with flag=1
     *              and zlib-deflated plaintext — parity with current
     *              ratio1 python SDKs (ec.py _encrypt, compressed=True,
     *              embed_compressed=True), whose decrypt() accepts ONLY
     *              this layout (no legacy fallback as of SDK 3.5.x).
     *
     * Default stays 'legacy' so un-migrated fleets are unaffected; each
     * environment flips via its BE config once its node fleet runs
     * flag-capable SDKs. Incoming decrypt() is ALWAYS tolerant of both.
     *
     * @type {'legacy'|'flagged'}
     * @private
     */
    private encryptFormat;
    loadIdentity(identityPrivateKey: any): boolean;
    /**
     * Returns the public key as a string.
     *
     * @return {string} the public key in DER format
     */
    getPublicKeyDER(): string;
    /**
     * Returns the NaeuralEdgeProtocol Network blockchain address.
     *
     * @return {string} the NaeuralEdgeProtocol Network Address
     */
    getAddress(): string;
    exportAsPem(): string | Buffer;
    /**
     * Returns the signed input object with all the cryptographical metadata appended to it. The format can be either
     * `json` or `object` and it allows the caller to select the format of the returned value.
     *
     * @param {object|string} input the input to be signed
     * @param {string} format selector for the returned value
     * @return {string|any} the signed input
     */
    sign(input: object | string, format?: string): string | any;
    /**
     * Verifies the message signature. If the message is incorrectly signed, will return false.
     *
     * @param {string} fullJSONMessage the message to verify
     * @return {boolean} verification result
     */
    verify(fullJSONMessage: string): boolean;
    /**
     * Encrypts a message for a destination node using ECDH(secp256k1) +
     * HKDF-derived AES-256-GCM.
     *
     * The wire layout depends on the engine's `encryptFormat` option (see the
     * constructor doc): 'legacy' emits `[iv][ct][tag]` (v4.1.2-identical);
     * 'flagged' emits the python-SDK-parity `[nonce][flag=1][zlib-ct+tag]`
     * layout that current ratio1 nodes require.
     *
     * @param {string} message plaintext (typically JSON) to encrypt
     * @param {string} destinationAddress node address the message is for
     * @return {string} base64 encoded encrypted envelope
     */
    encrypt(message: string, destinationAddress: string): string;
    /**
     * Decrypts an incoming envelope, tolerating BOTH known wire layouts:
     *
     * 1. legacy  `[iv(12)][ciphertext][authTag(16)]` — historical JS peers;
     * 2. flagged `[nonce(12)][flag(1)][ciphertext+authTag]` — current ratio1
     *    python SDKs (flag 0 = plain utf8, flag 1 = zlib-deflated plaintext).
     *
     * Layout detection relies on the AES-GCM auth tag: only the correct
     * parse authenticates (a cross-layout false positive has probability
     * 2^-128). The legacy parse is attempted first to keep the historical
     * hot path unchanged; on auth failure the flagged parse runs.
     *
     * Every decoded plaintext goes through STRICT (fatal) UTF-8 decoding,
     * mirroring python's `.decode()`: the 1-byte compression flag sits
     * OUTSIDE the GCM-authenticated data in the reference format, so a
     * tampered flag (1 -> 0) leaves the tag valid while the plaintext bytes
     * are still zlib-framed — permissive decoding would return authenticated
     * mojibake, strict decoding rejects it to `null` exactly like the
     * python SDK does.
     *
     * Returns `null` for any undecryptable, tampered, malformed, or
     * non-UTF-8 envelope. Note: an invalid `sourceAddress` still throws
     * (unchanged pre-existing behavior of the address parser).
     *
     * @param {string} encryptedDataB64 base64 encoded encrypted envelope
     * @param {string} sourceAddress sender node address (for ECDH)
     * @return {string|null} decrypted plaintext, or null when undecryptable
     */
    decrypt(encryptedDataB64: string, sourceAddress: string): string | null;
    /**
     * @return {crypto.KeyObject}
     * @private
     */
    private _getPrivateKey;
    /**
     * Returns the hash for a provided input. Inputs can be either a string or an object. Any other datatype will
     * throw an error.
     *
     * @param input
     * @return {{strHash: string, binHash: *}}
     * @private
     */
    private _getHash;
    /**
     * Generates the signature for the provided hash.
     *
     * @param {Buffer} binHash the hash to sign
     * @return {string} the signature for the provided hash
     * @private
     */
    private _signHash;
    /**
     * Generates and applies all the signatures and hashes to the input object. The format can be either
     * `json` or `object` and it allows the caller to select the format of the returned value.
     *
     * @param input
     * @param {string} signatureB64 the signature
     * @param {string} format the format to return
     * @return {object|string} the original object with signature properties appended
     * @private
     */
    private _prepareMessage;
    /**
     *
     * @param peerPublicKey
     * @return {*}
     * @private
     */
    private _deriveSharedKey;
}
export type NaeuralBlockchainOptions = {
    /**
     * - Indicates if debugging is enabled.
     */
    debug?: boolean;
    /**
     * - The key for the blockchain.
     */
    key?: string;
    /**
     * - Indicates if encryption is enabled.
     */
    encrypt?: boolean;
    /**
     * - Outgoing command-encryption wire layout: 'legacy' (default, historical [iv][ct][tag]) or 'flagged' (ratio1-python-parity [nonce][flag][zlib-ct+tag]); incoming decryption always tolerates both.
     */
    encryptFormat?: 'legacy' | 'flagged';
    /**
     * - Indicates if the connection should be secure.
     */
    secure?: boolean;
};
import { Buffer } from 'node:buffer';
import * as crypto from 'crypto';
