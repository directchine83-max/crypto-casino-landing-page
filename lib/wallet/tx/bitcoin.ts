import { secp256k1 } from '@noble/curves/secp256k1.js'
import { sha256 } from '@noble/hashes/sha2.js'
import { ripemd160 } from '@noble/hashes/legacy.js'
import { bech32 } from '@scure/base'
import { concatBytes, hexToBytes } from '@noble/hashes/utils.js'
import { restGet } from '../rpc'
import { deriveFromPrivateKey } from '../derive'
import { doubleSha256, u32le, u64le, varint } from './util'
import type { SignedTransaction, TransferInput } from './types'

const DUST_LIMIT = 546
const SEQUENCE = 0xfffffffd
const SIGHASH_ALL = 1

type Utxo = { txid: string; vout: number; value: number; status?: { confirmed?: boolean } }

function reverseBytes(bytes: Uint8Array): Uint8Array {
  return Uint8Array.from(bytes).reverse()
}

function hash160(bytes: Uint8Array): Uint8Array {
  return ripemd160(sha256(bytes))
}

function decodeP2wpkh(address: string): Uint8Array {
  let decoded: { prefix: string; words: number[] }
  try {
    decoded = bech32.decode(address.trim() as `${string}1${string}`, 90)
  } catch {
    throw new Error('Invalid Bitcoin address')
  }
  const program = Uint8Array.from(bech32.fromWords(decoded.words))
  if (program.length !== 21 || program[0] !== 0) throw new Error('Only P2WPKH (bc1q…) addresses are supported')
  return program.subarray(1)
}

function p2wpkhScript(program: Uint8Array): Uint8Array {
  return concatBytes(Uint8Array.of(0x00, 0x14), program)
}

export async function buildBitcoinTransfer(input: TransferInput & { feeRate?: number }): Promise<SignedTransaction> {
  const { privateKeyHex, feeRate: fixedFeeRate, timeoutMs } = input
  const to = input.to.trim()
  const amount = BigInt(input.amount)
  const privateKey = hexToBytes(privateKeyHex.replace(/^0x/, ''))
  const from = deriveFromPrivateKey(privateKeyHex, 'bitcoin').address
  const publicKey = secp256k1.getPublicKey(privateKey, true)
  const pubkeyHash = hash160(publicKey)
  const scriptCode = concatBytes(Uint8Array.of(0x19, 0x76, 0xa9, 0x14), pubkeyHash, Uint8Array.of(0x88, 0xac))
  const toProgram = decodeP2wpkh(to)

  const utxos = (await restGet<Utxo[]>(`${input.rpcUrl}/address/${from}/utxo`, timeoutMs)).filter(utxo => utxo.value > 0)
  if (utxos.length === 0) throw new Error('No spendable balance on this deposit address')

  let feeRate = fixedFeeRate
  if (!feeRate) {
    try {
      const fees = await restGet<{ halfHourFee?: number; hourFee?: number; economyFee?: number }>(`${input.rpcUrl}/v1/fees/recommended`, timeoutMs)
      feeRate = fees.halfHourFee ?? fees.hourFee ?? fees.economyFee ?? 5
    } catch {
      feeRate = 5
    }
  }

  const ordered = [...utxos].sort((a, b) => Number(b.status?.confirmed ?? false) - Number(a.status?.confirmed ?? false) || b.value - a.value)
  const selected: Utxo[] = []
  let total = 0n
  let fee = 0n
  for (const utxo of ordered) {
    selected.push(utxo)
    total += BigInt(utxo.value)
    const vsize = 11 + selected.length * 68 + 2 * 31
    fee = BigInt(Math.ceil(vsize * feeRate))
    if (total >= amount + fee) break
  }

  const change = total - amount - fee
  if (total < amount + fee) throw new Error('Insufficient funds to cover amount and network fee')
  const hasChange = change >= BigInt(DUST_LIMIT)

  const outputs = [{ value: amount, script: p2wpkhScript(toProgram) }]
  if (hasChange) outputs.push({ value: change, script: p2wpkhScript(pubkeyHash) })

  const hashPrevouts = doubleSha256(concatBytes(...selected.map(utxo => concatBytes(reverseBytes(hexToBytes(utxo.txid)), u32le(utxo.vout)))))
  const hashSequence = doubleSha256(concatBytes(...selected.map(() => u32le(SEQUENCE))))
  const hashOutputs = doubleSha256(concatBytes(...outputs.map(output => concatBytes(u64le(output.value), varint(output.script.length), output.script))))

  const unsigned = concatBytes(
    u32le(2),
    varint(selected.length),
    ...selected.map(utxo => concatBytes(reverseBytes(hexToBytes(utxo.txid)), u32le(utxo.vout), varint(0), u32le(SEQUENCE))),
    varint(outputs.length),
    ...outputs.map(output => concatBytes(u64le(output.value), varint(output.script.length), output.script)),
    u32le(0),
  )

  const witnesses = selected.map(utxo => {
    const preimage = concatBytes(
      u32le(2),
      hashPrevouts,
      hashSequence,
      reverseBytes(hexToBytes(utxo.txid)),
      u32le(utxo.vout),
      scriptCode,
      u64le(BigInt(utxo.value)),
      u32le(SEQUENCE),
      hashOutputs,
      u32le(0),
      u32le(SIGHASH_ALL),
    )
    const digest = doubleSha256(preimage)
    const der = secp256k1.sign(digest, privateKey, { format: 'der', lowS: true })
    return concatBytes(varint(2), varint(der.length + 1), der, Uint8Array.of(SIGHASH_ALL), varint(publicKey.length), publicKey)
  })

  const signed = concatBytes(
    u32le(2),
    Uint8Array.of(0x00, 0x01),
    varint(selected.length),
    ...selected.map(utxo => concatBytes(reverseBytes(hexToBytes(utxo.txid)), u32le(utxo.vout), varint(0), u32le(SEQUENCE))),
    varint(outputs.length),
    ...outputs.map(output => concatBytes(u64le(output.value), varint(output.script.length), output.script)),
    ...witnesses,
    u32le(0),
  )

  const hash = reverseBytes(doubleSha256(unsigned)).reduce((hex, byte) => hex + byte.toString(16).padStart(2, '0'), '')

  return {
    network: 'bitcoin',
    from,
    to,
    amount: amount.toString(),
    amountRaw: amount.toString(),
    raw: signed.reduce((hex, byte) => hex + byte.toString(16).padStart(2, '0'), ''),
    encoding: 'hex',
    hash,
    explorerUrl: `${input.explorerUrl}${hash}`,
  }
}
