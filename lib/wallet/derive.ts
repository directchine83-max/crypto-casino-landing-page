import { HDKey } from '@scure/bip32'
import { generateMnemonic, mnemonicToSeedSync, validateMnemonic } from '@scure/bip39'
import { wordlist } from '@scure/bip39/wordlists/english.js'
import { secp256k1 } from '@noble/curves/secp256k1.js'
import { ed25519 } from '@noble/curves/ed25519.js'
import { sha256, sha512 } from '@noble/hashes/sha2.js'
import { keccak_256 } from '@noble/hashes/sha3.js'
import { ripemd160 } from '@noble/hashes/legacy.js'
import { hmac } from '@noble/hashes/hmac.js'
import { bytesToHex, concatBytes, hexToBytes, utf8ToBytes } from '@noble/hashes/utils.js'
import { base58, bech32 } from '@scure/base'
import type { DerivedWallet, WalletNetwork } from './types'

export type { DerivedWallet, WalletNetwork } from './types'

export const DERIVATION_PATHS: Record<WalletNetwork, string> = {
  ethereum: "m/44'/60'/0'/0/0",
  bitcoin: "m/84'/0'/0'/0/0",
  solana: "m/44'/501'/0'/0'",
}

export const SUPPORTED_NETWORKS: WalletNetwork[] = ['ethereum', 'solana', 'bitcoin']

function checksumAddress(lowercase: string): string {
  const hash = bytesToHex(keccak_256(utf8ToBytes(lowercase)))
  let output = ''
  for (let index = 0; index < lowercase.length; index += 1) {
    output += Number.parseInt(hash[index], 16) >= 8 ? lowercase[index].toUpperCase() : lowercase[index]
  }
  return `0x${output}`
}

function ethereumAddress(privateKey: Uint8Array): string {
  const publicKey = secp256k1.getPublicKey(privateKey, false)
  const hash = keccak_256(publicKey.slice(1))
  return checksumAddress(bytesToHex(hash.slice(-20)))
}

function hash160(bytes: Uint8Array): Uint8Array {
  return ripemd160(sha256(bytes))
}

function bitcoinAddress(publicKey: Uint8Array): string {
  const program = hash160(publicKey)
  return bech32.encode('bc', [0, ...bech32.toWords(program)])
}

function u32be(value: number): Uint8Array {
  const bytes = new Uint8Array(4)
  new DataView(bytes.buffer).setUint32(0, value >>> 0, false)
  return bytes
}

function slip10Ed25519(seed: Uint8Array, path: number[]): Uint8Array {
  let digest = hmac(sha512, utf8ToBytes('ed25519 seed'), seed)
  let key = digest.slice(0, 32)
  let chainCode = digest.slice(32)
  for (const index of path) {
    digest = hmac(sha512, chainCode, concatBytes(new Uint8Array([0]), key, u32be(index + 0x80000000)))
    key = digest.slice(0, 32)
    chainCode = digest.slice(32)
  }
  return key
}

export function deriveFromSeed(seed: Uint8Array, network: WalletNetwork): DerivedWallet {
  if (network === 'solana') {
    const secretKey = slip10Ed25519(seed, [44, 501, 0, 0])
    return { network, address: base58.encode(ed25519.getPublicKey(secretKey)), privateKey: bytesToHex(secretKey), path: DERIVATION_PATHS.solana }
  }

  const node = HDKey.fromMasterSeed(seed).derive(DERIVATION_PATHS[network])
  if (!node.privateKey || !node.publicKey) throw new Error('Key derivation failed')
  if (network === 'ethereum') {
    return { network, address: ethereumAddress(node.privateKey), privateKey: bytesToHex(node.privateKey), path: DERIVATION_PATHS.ethereum }
  }
  return { network, address: bitcoinAddress(node.publicKey), privateKey: bytesToHex(node.privateKey), path: DERIVATION_PATHS.bitcoin }
}

export function deriveFromMnemonic(mnemonic: string, network: WalletNetwork): DerivedWallet {
  return deriveFromSeed(mnemonicToSeedSync(mnemonic.trim()), network)
}

export function deriveFromPrivateKey(privateKeyHex: string, network: WalletNetwork): DerivedWallet {
  const privateKey = hexToBytes(privateKeyHex.replace(/^0x/, '').trim())
  if (privateKey.length !== 32) throw new Error('Private key must be 32 bytes')
  if (network === 'solana') {
    return { network, address: base58.encode(ed25519.getPublicKey(privateKey)), privateKey: bytesToHex(privateKey), path: 'imported' }
  }
  if (network === 'ethereum') {
    return { network, address: ethereumAddress(privateKey), privateKey: `0x${bytesToHex(privateKey)}`, path: 'imported' }
  }
  return { network, address: bitcoinAddress(secp256k1.getPublicKey(privateKey, true)), privateKey: bytesToHex(privateKey), path: 'imported' }
}

export function createMnemonic(strength: 128 | 160 | 192 | 224 | 256 = 128): string {
  return generateMnemonic(wordlist, strength)
}

export function isValidMnemonic(mnemonic: string): boolean {
  return validateMnemonic(mnemonic.trim(), wordlist)
}

export function isSupportedNetwork(network: string): network is WalletNetwork {
  return (SUPPORTED_NETWORKS as string[]).includes(network)
}
