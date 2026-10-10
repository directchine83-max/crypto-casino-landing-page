import { Connection } from '@solana/web3.js'
import { getSolanaConfig } from './config'

let cached: { url: string; connection: Connection } | null = null

export function getConnection(): Connection {
  const { rpcUrl, commitment } = getSolanaConfig()
  if (!cached || cached.url !== rpcUrl) {
    cached = { url: rpcUrl, connection: new Connection(rpcUrl, commitment) }
  }
  return cached.connection
}
