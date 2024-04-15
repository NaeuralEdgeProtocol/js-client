/// <reference types="node" />
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
    /**
     * NaeuralEdgeProtocol Network Blockchain engine constructor.
     *
     * @param {ZxAIBlockchainOptions} options
     */
    constructor(options: ZxAIBlockchainOptions);
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
    encrypt(message: any, destinationAddress: any): string;
    decrypt(encryptedDataB64: any, sourceAddress: any): string;
}
export type ZxAIBlockchainOptions = {
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
     * - Indicates if the connection should be secure.
     */
    secure?: boolean;
};
import { Buffer } from 'node:buffer';
import * as crypto from 'crypto';
