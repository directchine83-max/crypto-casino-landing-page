import { ComputeBudgetProgram, SystemProgram, Transaction, type Message } from '@solana/web3.js'
import { getConnection } from './connection'
import { BASE_SIGNATURE_FEE_LAMPORTS, DEFAULT_COMPUTE_UNITS, getPriorityFeeMicroLamports, getSolanaConfig } from './config'
import { formatSol } from './amounts'
import { isValidSolanaAddress, toPublicKey } from './address'
import { SolanaError } from './errors'

const DUMMY_FEE_PAYER = '11111111111111111111111111111111'

export type FeeEstimate = {
  networkFeeLamports: string
  priorityFeeLamports: string
  totalFeeLamports: string
  totalFeeSol: string
  blockhash: string
  lastValidBlockHeight: number
  cluster: string
  symbol: string
}

export type BuiltTransfer = FeeEstimate & {
  transaction: string
  message: string
  from: string
  to: string
  amountLamports: string
  amountSol: string
  explorerUrl: string
}

function toBase64(bytes: Uint8Array): string {
  return Buffer.from(bytes).toString('base64')
}

function buildTransaction(from: string, to: string, amountLamports: bigint, blockhash: string): Transaction {
  const priority = getPriorityFeeMicroLamports()
  const transaction = new Transaction()
  transaction.feePayer = toPublicKey(from)
  transaction.recentBlockhash = blockhash
  if (priority > 0) {
    transaction.add(ComputeBudgetProgram.setComputeUnitLimit({ units: DEFAULT_COMPUTE_UNITS }))
    transaction.add(ComputeBudgetProgram.setComputeUnitPrice({ microLamports: priority }))
  }
  if (amountLamports > 0n) {
    transaction.add(SystemProgram.transfer({ fromPubkey: toPublicKey(from), toPubkey: toPublicKey(to), lamports: amountLamports }))
  }
  return transaction
}

async function feeForMessage(message: Message): Promise<{ networkFee: bigint; totalFee: bigint }> {
  const config = getSolanaConfig()
  const connection = getConnection()
  const response = await connection.getFeeForMessage(message, config.commitment)
  const totalFee = BigInt(response.value ?? BASE_SIGNATURE_FEE_LAMPORTS)
  const networkFee = BigInt(BASE_SIGNATURE_FEE_LAMPORTS) * BigInt(message.header.numRequiredSignatures)
  return { networkFee, totalFee }
}

function toFeeEstimate(cluster: string, symbol: string, networkFee: bigint, totalFee: bigint, blockhash: string, lastValidBlockHeight: number): FeeEstimate {
  const priorityFee = totalFee > networkFee ? totalFee - networkFee : 0n
  return {
    networkFeeLamports: networkFee.toString(),
    priorityFeeLamports: priorityFee.toString(),
    totalFeeLamports: totalFee.toString(),
    totalFeeSol: formatSol(totalFee),
    blockhash,
    lastValidBlockHeight,
    cluster,
    symbol,
  }
}

export async function estimateFee(input: { from?: string; to?: string; amountLamports?: bigint } = {}): Promise<FeeEstimate> {
  const config = getSolanaConfig()
  const from = input.from && isValidSolanaAddress(input.from) ? input.from.trim() : DUMMY_FEE_PAYER
  const to = (input.to ?? config.treasuryAddress).trim()
  if (!isValidSolanaAddress(to)) throw new SolanaError('Treasury address is not configured (SOLANA_TREASURY_ADDRESS).', 503)

  const connection = getConnection()
  const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash(config.commitment)
  const amount = input.amountLamports && input.amountLamports > 0n ? input.amountLamports : 1n
  const { networkFee, totalFee } = await feeForMessage(buildTransaction(from, to, amount, blockhash).compileMessage())
  return toFeeEstimate(config.cluster, config.symbol, networkFee, totalFee, blockhash, lastValidBlockHeight)
}

export async function buildUnsignedTransfer(input: { from: string; to?: string; amountLamports: bigint }): Promise<BuiltTransfer> {
  const config = getSolanaConfig()
  const from = input.from.trim()
  if (!isValidSolanaAddress(from)) throw new SolanaError('Invalid wallet address.', 400)

  const to = (input.to ?? config.treasuryAddress).trim()
  if (!isValidSolanaAddress(to)) throw new SolanaError('Treasury address is not configured (SOLANA_TREASURY_ADDRESS).', 503)
  if (input.amountLamports <= 0n) throw new SolanaError('Amount must be greater than zero.', 400)

  const connection = getConnection()
  const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash(config.commitment)
  const transaction = buildTransaction(from, to, input.amountLamports, blockhash)
  const { networkFee, totalFee } = await feeForMessage(transaction.compileMessage())
  const serialized = transaction.serialize({ requireAllSignatures: false, verifySignatures: false })

  return {
    ...toFeeEstimate(config.cluster, config.symbol, networkFee, totalFee, blockhash, lastValidBlockHeight),
    transaction: toBase64(serialized),
    message: toBase64(transaction.serializeMessage()),
    from,
    to,
    amountLamports: input.amountLamports.toString(),
    amountSol: formatSol(input.amountLamports),
    explorerUrl: config.explorerTxUrl,
  }
}
