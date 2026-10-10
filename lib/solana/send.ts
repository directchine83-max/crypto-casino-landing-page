import { getConnection } from './connection'
import { getSolanaConfig } from './config'
import { SolanaError } from './errors'

export type SendResult = {
  signature: string
  explorerUrl: string
  confirmed: boolean
  cluster: string
}

async function confirmWithTimeout(hash: string, blockhash: string, lastValidBlockHeight: number, timeoutMs: number): Promise<boolean> {
  const connection = getConnection()
  const config = getSolanaConfig()
  const confirmation = connection
    .confirmTransaction({ signature: hash, blockhash, lastValidBlockHeight }, config.commitment)
    .then(result => !result.value.err)
    .catch(() => false)
  const timeout = new Promise<boolean>(resolve => setTimeout(() => resolve(false), timeoutMs))
  return Promise.race([confirmation, timeout])
}

export async function sendSignedTransaction(base64: string): Promise<SendResult> {
  const config = getSolanaConfig()
  if (!config.sendEnabled) throw new SolanaError('On-chain sending is disabled (SOLANA_SEND_ENABLED=false).', 503)

  const bytes = Buffer.from(base64 ?? '', 'base64')
  if (bytes.length === 0) throw new SolanaError('Missing signed transaction.', 400)

  const connection = getConnection()
  let signature: string
  try {
    signature = await connection.sendRawTransaction(bytes, {
      skipPreflight: false,
      maxRetries: 3,
      preflightCommitment: config.commitment,
    })
  } catch (error) {
    throw new SolanaError(error instanceof Error ? error.message : 'Broadcast failed.', 502)
  }

  const latest = await connection.getLatestBlockhash(config.commitment).catch(() => null)
  const confirmed = latest
    ? await confirmWithTimeout(signature, latest.blockhash, latest.lastValidBlockHeight, 30_000)
    : false

  return {
    signature,
    explorerUrl: `${config.explorerTxUrl}${signature}${config.explorerQuery}`,
    confirmed,
    cluster: config.cluster,
  }
}
