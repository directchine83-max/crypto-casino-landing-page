import { secp256k1 } from '@noble/curves/secp256k1.js'
import { keccak_256 } from '@noble/hashes/sha3.js'
import { bytesToHex, concatBytes, hexToBytes } from '@noble/hashes/utils.js'
import { jsonRpc } from '../rpc'
import { deriveFromPrivateKey } from '../derive'
import { bytesToBigInt } from './util'
import { rlpEncode, type RlpInput } from './rlp'
import type { SignedTransaction, TransferInput } from './types'

const TX_TYPE = 0x02
const DEFAULT_GAS_LIMIT = 21_000n
const FALLBACK_BASE_FEE = 20_000_000_000n
const FALLBACK_PRIORITY_FEE = 1_000_000_000n

function normalizeAddress(address: string): string {
  const clean = address.trim().toLowerCase()
  if (!/^0x[0-9a-f]{40}$/.test(clean)) throw new Error('Invalid Ethereum address')
  return clean.slice(2)
}

export async function buildEthereumTransfer(input: TransferInput): Promise<SignedTransaction> {
  const { privateKeyHex, to, rpcUrl, timeoutMs } = input
  const valueWei = BigInt(input.amount)
  const privateKey = hexToBytes(privateKeyHex.replace(/^0x/, ''))
  const from = deriveFromPrivateKey(privateKeyHex, 'ethereum').address
  const toHex = normalizeAddress(to)

  const chainIdHex = await jsonRpc<string>(rpcUrl, 'eth_chainId', [], timeoutMs)
  const chainId = BigInt(chainIdHex)
  const nonce = BigInt(await jsonRpc<string>(rpcUrl, 'eth_getTransactionCount', [from, 'pending'], timeoutMs))

  let gasLimit = DEFAULT_GAS_LIMIT
  try {
    gasLimit = BigInt(await jsonRpc<string>(rpcUrl, 'eth_estimateGas', [{ from, to, value: `0x${valueWei.toString(16)}` }], timeoutMs))
  } catch { /* un-funded sender: fall back to a plain transfer cost */ }

  let priorityFee = FALLBACK_PRIORITY_FEE
  try {
    const fetched = BigInt(await jsonRpc<string>(rpcUrl, 'eth_maxPriorityFeePerGas', [], timeoutMs))
    if (fetched > priorityFee) priorityFee = fetched
  } catch { /* not supported by all nodes */ }

  let baseFee = FALLBACK_BASE_FEE
  try {
    const block = await jsonRpc<{ baseFeePerGas?: string } | null>(rpcUrl, 'eth_getBlockByNumber', ['latest', false], timeoutMs)
    if (block?.baseFeePerGas) baseFee = BigInt(block.baseFeePerGas)
  } catch { /* keep fallback */ }

  const maxPriorityFeePerGas = priorityFee
  const maxFeePerGas = baseFee * 2n + maxPriorityFeePerGas
  const accessList: RlpInput[] = []
  const fields: RlpInput[] = [chainId, nonce, maxPriorityFeePerGas, maxFeePerGas, gasLimit, hexToBytes(toHex), valueWei, new Uint8Array(), accessList]

  const unsigned = concatBytes(Uint8Array.of(TX_TYPE), rlpEncode(fields))
  const signingHash = keccak_256(unsigned)
  const recovered = secp256k1.sign(signingHash, privateKey, { format: 'recovered', lowS: true })
  const yParity = BigInt(recovered[0])
  const r = bytesToBigInt(recovered.subarray(1, 33))
  const s = bytesToBigInt(recovered.subarray(33, 65))

  const raw = concatBytes(Uint8Array.of(TX_TYPE), rlpEncode([...fields, yParity, r, s]))
  const hash = `0x${bytesToHex(keccak_256(raw))}`

  return {
    network: 'ethereum',
    from,
    to: `0x${toHex}`,
    amount: valueWei.toString(),
    amountRaw: valueWei.toString(),
    raw: `0x${bytesToHex(raw)}`,
    encoding: 'hex',
    hash,
    explorerUrl: `${input.explorerUrl}${hash}`,
  }
}
