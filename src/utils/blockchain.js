import * as crypto from 'crypto';
import asn1 from 'asn1.js/lib/asn1.js';
import stringify from 'json-stable-stringify';
import { base64ToUrlSafeBase64, urlSafeBase64ToBase64 } from './helper.functions.js';
import { Buffer } from 'node:buffer';
import elliptic from 'elliptic/lib/elliptic.js';
import hkdf from 'futoin-hkdf';

const ec = new elliptic.ec('secp256k1');
const EE_SIGN = 'EE_SIGN';
const EE_SENDER = 'EE_SENDER';
const EE_HASH = 'EE_HASH';
const ADDR_PREFIX = '0xai_';
const ALLOWED_PREFIXES = ['0xai_', 'aixp_'];
const NON_DATA_FIELDS = [EE_SIGN, EE_SENDER, EE_HASH];

const SPKI = asn1.define('SPKI', function () {
    this.seq().obj(
        this.key('algorithm').seq().obj(this.key('id').objid(), this.key('namedCurve').objid()),
        this.key('publicKey').bitstr(),
    );
});

const PKCS8 = asn1.define('PKCS8PrivateKeyInfo', function () {
    this.seq().obj(
        this.key('version').int(),
        this.key('algorithm').seq().obj(this.key('id').objid(), this.key('params').optional().any()),
        this.octstr(this.seq(this.key('flag').int(), this.key('content').octstr())),
    );
});

/**
 * @typedef {Object} ZxAIBlockchainOptions
 * @property {boolean} [debug] - Indicates if debugging is enabled.
 * @property {string} [key] - The key for the blockchain.
 * @property {boolean} [encrypt] - Indicates if encryption is enabled.
 * @property {boolean} [secure] - Indicates if the connection should be secure.
 */

/**
 * @class ZxAIBC
 *
 * This is the NaeuralEdgeProtocol Network Blockchain engine. Its purpose is to offer any integrator common features like
 * signature checking, message validation or key pair generation.
 */
export class ZxAIBC {
    /**
     * The keypair that is in use.
     *
     * @type {{privateKey: crypto.KeyObject, publicKey: crypto.KeyObject}}
     * @private
     */
    keyPair;

    /**
     * A handy cache for the public key.
     *
     * @type {string}
     * @private
     */
    compressedPublicKey = '';

    /**
     * Flag to boot the engine in debug mode. Will output signature verification logs.
     *
     * @type {boolean}
     * @private
     */
    debugMode = false;

    /**
     * NaeuralEdgeProtocol Network Blockchain engine constructor.
     *
     * @param {ZxAIBlockchainOptions} options
     */
    constructor(options) {
        if (options.key) {
            this.keyPair = ZxAIBC.deriveKeyPairFromDERHex(options.key);
        } else {
            this.keyPair = ZxAIBC.generateKeys();
        }

        this.debugMode = options.debug || false;
        this.compressedPublicKey = ZxAIBC.compressPublicKeyObject(this.keyPair.publicKey);

        if (this.debugMode) {
            console.log('NaeuralEdgeProtocol Blockchain address: ' + this.getAddress());
        }
    }

    /**
     * Generates a pair of public-private keys that can be used throughout this module
     * or when interacting with the network.
     *
     * @return {crypto.KeyPairKeyObjectResult} the keypair
     */
    static generateKeys() {
        return crypto.generateKeyPairSync('ec', {
            namedCurve: 'secp256k1',
        });
    }

    static deriveKeyPairFromDERHex(hexString) {
        const privateKeyBuffer = Buffer.from(hexString, 'hex');
        const privateKey = crypto.createPrivateKey({
            key: privateKeyBuffer,
            format: 'der',
            type: 'pkcs8',
        });

        const publicKey = crypto.createPublicKey(privateKey);

        return {
            privateKey,
            publicKey,
        };
    }

    static publicKeyObjectToECKeyPair(publicKey) {
        const key = Buffer.from(publicKey.export({ type: 'spki', format: 'der' }));
        const publicKeyBytes = SPKI.decode(key, 'der').publicKey.data;

        return ec.keyFromPublic(publicKeyBytes, 'hex');
    }

    static privateKeyObjectToECKeyPair(privateKeyObject) {
        const hexPrivKey = Buffer.from(privateKeyObject.export({ type: 'pkcs8', format: 'der' }));
        const definition = PKCS8.decode(hexPrivKey, 'der');
        const privateKeyData = definition.content;

        return ec.keyFromPrivate(privateKeyData, 'hex');
    }

    static addressToECPublicKey(address) {
        const pkB64 = ZxAIBC._removeAddressPrefix(address);

        return ec.keyFromPublic(Buffer.from(urlSafeBase64ToBase64(pkB64), 'base64').toString('hex'), 'hex');
    }

    static compressPublicKeyObject(publicKey) {
        const compressedPublicKeyB64 = Buffer.from(
            ZxAIBC.publicKeyObjectToECKeyPair(publicKey).getPublic(true, 'hex'),
            'hex',
        ).toString('base64');

        return base64ToUrlSafeBase64(compressedPublicKeyB64);
    }

    static addressFromPublicKey(publicKey) {
        return ADDR_PREFIX + ZxAIBC.compressPublicKeyObject(publicKey);
    }

    static addressToPublicKeyUncompressed(address) {
        return ZxAIBC.addressToECPublicKey(address).getPublic(false, 'hex');
    }

    static addressToPublicKeyObject(address) {
        const uncompressedPublicKeyHex = this.addressToPublicKeyUncompressed(address);

        // Manually create DER formatted public key
        const publicKeyDerManual = '3056301006072a8648ce3d020106052b8104000a034200' + uncompressedPublicKeyHex;
        return crypto.createPublicKey({
            key: Buffer.from(publicKeyDerManual, 'hex'),
            format: 'der',
            type: 'spki',
        });
    }

    /**
     * Returns the public key as a string.
     *
     * @return {string} the public key in DER format
     */
    getPublicKeyDER() {
        return this.keyPair.publicKey.toString();
    }

    /**
     * Returns the NaeuralEdgeProtocol Network blockchain address.
     *
     * @return {string} the NaeuralEdgeProtocol Network Address
     */
    getAddress() {
        return ADDR_PREFIX + this.compressedPublicKey;
    }

    exportAsPem() {
        return this.keyPair.privateKey.export({ type: 'pkcs8', format: 'pem' });
    }

    /**
     * Returns the signed input object with all the cryptographical metadata appended to it. The format can be either
     * `json` or `object` and it allows the caller to select the format of the returned value.
     *
     * @param {object|string} input the input to be signed
     * @param {string} format selector for the returned value
     * @return {string|any} the signed input
     */
    sign(input, format = 'json') {
        const { binHash } = this._getHash(input);
        const signatureB64 = this._signHash(binHash);

        return this._prepareMessage(input, signatureB64, format);
    }

    /**
     * Verifies the message signature. If the message is incorrectly signed, will return false.
     *
     * @param {string} fullJSONMessage the message to verify
     * @return {boolean} verification result
     */
    verify(fullJSONMessage) {
        let hashResult = false;
        let signatureResult = false;
        let objReceived;

        try {
            objReceived = JSON.parse(fullJSONMessage);
        } catch (e) {
            return false;
        }

        const signatureB64 = objReceived[EE_SIGN];
        const pkB64 = objReceived[EE_SENDER] ? ZxAIBC._removeAddressPrefix(objReceived[EE_SENDER]) : null;
        const receivedHash = objReceived[EE_HASH];
        const objData = Object.fromEntries(
            Object.entries(objReceived).filter(([key]) => !NON_DATA_FIELDS.includes(key)),
        );
        const strData = stringify(objData);
        const hash = crypto.createHash('sha256').update(strData).digest();
        const hashHex = hash.toString('hex');

        if (hashHex !== receivedHash) {
            hashResult = false;
            if (this.debugMode) {
                console.log(
                    'Hashes do not match or public key is missing:\n',
                    '  Computed: ' + hashHex + '\n',
                    '  Received: ' + receivedHash + '\n',
                    '  Public key:' + pkB64 + '\n',
                    '  Data: ' + JSON.stringify(objData) + '\n',
                    "  Stringify: '" + strData + "'",
                );
            }
        } else {
            hashResult = true;
        }

        if (pkB64) {
            const signatureBuffer = Buffer.from(urlSafeBase64ToBase64(signatureB64), 'base64');

            const publicKeyObj = ZxAIBC.addressToPublicKeyObject(pkB64);

            signatureResult = crypto.verify(
                null,
                hash,
                {
                    key: publicKeyObj,
                    padding: crypto.constants.RSA_PKCS1_PSS_PADDING,
                },
                signatureBuffer,
            );

            if (this.debugMode) {
                console.log('Verify local hash: ' + signatureResult);
                const bHash = Buffer.from(receivedHash, 'hex');
                const signatureRecvResult = crypto.verify(
                    null,
                    bHash,
                    {
                        key: publicKeyObj,
                        padding: crypto.constants.RSA_PKCS1_PSS_PADDING,
                    },
                    signatureBuffer,
                );

                if (signatureRecvResult) {
                    console.log(
                        'Signature is valid for received hash & signature meaning that the public key is valid as well as the signature. Most likely someone or something modified the payload',
                    );
                } else {
                    console.log('Verify ONLY on received hash & signature FAILED: ' + signatureRecvResult);
                }
            }
        }

        return hashResult && signatureResult;
    }

    encrypt(message, destinationAddress) {
        const destinationPublicKey = ZxAIBC.addressToPublicKeyObject(destinationAddress);
        const sharedKey = this._deriveSharedKey(destinationPublicKey);

        const iv = crypto.randomBytes(12);
        const cipher = crypto.createCipheriv('aes-256-gcm', sharedKey, iv);
        let encrypted = cipher.update(message, 'utf8');
        encrypted = Buffer.concat([encrypted, cipher.final()]);

        const encryptedData = Buffer.concat([iv, encrypted, cipher.getAuthTag()]);

        return encryptedData.toString('base64');
    }

    decrypt(encryptedDataB64, sourceAddress) {
        if (encryptedDataB64 === null) {
            return null;
        }

        const sourcePublicKey = ZxAIBC.addressToPublicKeyObject(sourceAddress);
        const encryptedData = Buffer.from(encryptedDataB64, 'base64');

        // Extract nonce and ciphertext
        const nonce = encryptedData.slice(0, 12);
        const ciphertext = encryptedData.slice(12, encryptedData.length - 16);
        const authTag = encryptedData.slice(encryptedData.length - 16);

        // Derive shared key
        const sharedKey = this._deriveSharedKey(sourcePublicKey);

        // AES-GCM Decryption
        const decipher = crypto.createDecipheriv('aes-256-gcm', sharedKey, nonce);
        decipher.setAuthTag(authTag);
        let decrypted = decipher.update(ciphertext);

        try {
            decrypted = Buffer.concat([decrypted, decipher.final()]);

            return decrypted.toString('utf8');
        } catch (e) {
            return null;
        }
    }

    /**
     * Removes the prefix from the address.
     *
     * @param {string} address
     * @return {string}
     * @private
     */
    static _removeAddressPrefix(address) {
        let pkB64 = address;
        ALLOWED_PREFIXES.forEach((prefix) => {
            pkB64 = pkB64.replace(prefix, '');
        });

        return pkB64;
    }

    /**
     * @return {crypto.KeyObject}
     * @private
     */
    _getPrivateKey() {
        return this.keyPair.privateKey;
    }

    /**
     * Returns the hash for a provided input. Inputs can be either a string or an object. Any other datatype will
     * throw an error.
     *
     * @param input
     * @return {{strHash: string, binHash: *}}
     * @private
     */
    _getHash(input) {
        let inputString;

        if (typeof input === 'object') {
            inputString = stringify(input);
        } else if (typeof input === 'string') {
            inputString = input;
        } else {
            throw new Error('Unsupported input type. Input must be a string or object.');
        }

        // Hash the input string
        const strDigest = crypto.createHash('sha256').update(inputString).digest('hex');
        const binDigest = Buffer.from(strDigest, 'hex');

        return {
            strHash: strDigest,
            binHash: binDigest,
        };
    }

    /**
     * Generates the signature for the provided hash.
     *
     * @param {Buffer} binHash the hash to sign
     * @return {string} the signature for the provided hash
     * @private
     */
    _signHash(binHash) {
        const signature = crypto.sign(null, binHash, {
            key: this._getPrivateKey(),
            format: 'der',
            type: 'pkcs8',
        });

        return base64ToUrlSafeBase64(signature.toString('base64'));
    }

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
    _prepareMessage(input, signatureB64, format) {
        const message = Object.assign({}, input, {
            [EE_SIGN]: signatureB64,
            [EE_SENDER]: this.getAddress(),
            [EE_HASH]: this._getHash(input).strHash,
        });

        if (format === 'json') {
            return JSON.stringify(message);
        } else if (format === 'object') {
            return message;
        } else {
            throw new Error('Unsupported format. Format must be either "object" or "json".');
        }
    }

    /**
     *
     * @param peerPublicKey
     * @return {*}
     * @private
     */
    _deriveSharedKey(peerPublicKey) {
        const ecdh = crypto.createECDH('secp256k1');
        const privateKeyHex = ZxAIBC.privateKeyObjectToECKeyPair(this.keyPair.privateKey).getPrivate().toString(16);
        ecdh.setPrivateKey(Buffer.from(privateKeyHex, 'hex'));

        const publicKeyHex = ZxAIBC.publicKeyObjectToECKeyPair(peerPublicKey).getPublic('hex');
        const sharedSecret = ecdh.computeSecret(Buffer.from(publicKeyHex, 'hex'));

        const key = hkdf(sharedSecret, 32, {
            info: '0xai handshake data',
            salt: Buffer.alloc(0),
            hash: 'SHA-256',
        });

        return Buffer.from(key);
    }
}
