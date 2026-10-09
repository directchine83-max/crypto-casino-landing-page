import { ed25519 } from '@noble/curves/ed25519.js'
import { base58 } from '@scure/base'
import { concatBytes, hexToBytes } from '@noble/hashes/utils.js'
import { jsonRpc } from '../rpc'
import { deriveFromPrivateKey } from '../derive'
import { shortVec, u32le, u64le } from './util'
import type { SignedTransaction, TransferInput } from './types'

const SYSTEM_PROGRAM = new Uint8Array(32)
const TRANSFER_INSTRUCTION = 2

function decodeAddress(address: string): Uint8Array {
  let decoded: Uint8Array
  try {
    decoded = base58.decode(address.trim())
  } catch {
    throw new Error('Invalid Solana address')
  }
  if (decoded.length !== 32) throw new Error('Invalid Solana address')
  return decoded
}

export async function buildSolanaTransfer(input: TransferInput): Promise<SignedTransaction> {
  const { privateKeyHex, to, rpcUrl, timeoutMs } = input
  const lamports = BigInt(input.amount)
  const secretKey = hexToBytes(privateKeyHex.replace(/^0x/, ''))
  const from = deriveFromPrivateKey(privateKeyHex, 'solana').address
  const fromPublicKey = decodeAddress(from)
  const toPublicKey = decodeAddress(to)

  const blockhashResponse = await jsonRpc<{ value: { blockhash: string } }>(rpcUrl, 'getLatestBlockhash', [{ commitment: 'finalized' }], timeoutMs)
  const recentBlockhash = decodeAddress(blockhashResponse.value.blockhash)

  const instructionData = concatBytes(u32le(TRANSFER_INSTRUCTION), u64le(lamports))
  const message = concatBytes(
    Uint8Array.of(1, 0, 1),
    shortVec(3),
    fromPublicKey,
    toPublicKey,
    SYSTEM_PROGRAM,
    recentBlockhash,
    shortVec(1),
    Uint8Array.of(2),
    shortVec(2),
    Uint8Array.of(0, 1),
    shortVec(instructionData.length),
    instructionData,
  )

  const signature = ed25519.sign(message, secretKey)
  const transaction = concatBytes(shortVec(1), signature, message)
  const hash = base58.encode(signature)

  return {
    network: 'solana',
    from,
    to,
    amount: lamports.toString(),
    amountRaw: lamports.toString(),
    raw: Buffer.from(transaction).toString('base64'),
    encoding: 'base64',
    hash,
    explorerUrl: `${input.explorerUrl}${hash}`,
  }
}
