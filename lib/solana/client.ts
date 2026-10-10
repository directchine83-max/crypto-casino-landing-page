export type SolanaBalance = {
  address: string
  lamports: string
  sol: string
  symbol: string
  cluster: string
}

export type SolanaFeeEstimate = {
  networkFeeLamports: string
  priorityFeeLamports: string
  totalFeeLamports: string
  totalFeeSol: string
  blockhash: string
  lastValidBlockHeight: number
  cluster: string
  symbol: string
}

export type SolanaBuiltTransfer = SolanaFeeEstimate & {
  transaction: string
  message: string
  from: string
  to: string
  amountLamports: string
  amountSol: string
  explorerUrl: string
}

export type SolanaSendResult = {
  signature: string
  explorerUrl: string
  confirmed: boolean
  cluster: string
}

export type SolanaInfo = {
  configured: boolean
  sendEnabled: boolean
  treasuryAddress: string
  cluster: string
  symbol: string
  explorerAddressUrl: string
  decimals: number
}

export class SolanaApiError extends Error {
  status: number
  constructor(message: string, status: number) {
    super(message)
    this.name = 'SolanaApiError'
    this.status = status
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`/api/solana${path}`, init)
  const data = (await response.json().catch(() => ({}))) as { error?: string }
  if (!response.ok) throw new SolanaApiError(data.error ?? 'Solana request failed.', response.status)
  return data as T
}

const jsonInit = (body: unknown): RequestInit => ({
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(body),
})

export function fetchBalance(address: string): Promise<SolanaBalance> {
  return request<SolanaBalance>(`/balance?address=${encodeURIComponent(address)}`)
}

export function fetchFees(input: { from?: string; amountLamports?: string } = {}): Promise<SolanaFeeEstimate> {
  const params = new URLSearchParams()
  if (input.from) params.set('address', input.from)
  if (input.amountLamports) params.set('amount', input.amountLamports)
  const query = params.toString()
  return request<SolanaFeeEstimate>(`/fees${query ? `?${query}` : ''}`)
}

export function fetchInfo(): Promise<SolanaInfo> {
  return request<SolanaInfo>('/info')
}

export function buildTransfer(input: { from: string; amount: string }): Promise<SolanaBuiltTransfer> {
  return request<SolanaBuiltTransfer>('/transaction', jsonInit(input))
}

export function sendSignedTransaction(input: { transaction: string; address?: string; amount?: string }): Promise<SolanaSendResult> {
  return request<SolanaSendResult>('/send', jsonInit(input))
}

export function verifySignature(input: { address: string; message: string; signature: string }): Promise<{ verified: boolean }> {
  return request<{ verified: boolean }>('/verify', jsonInit(input))
}
