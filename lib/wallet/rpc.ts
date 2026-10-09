export async function jsonRpc<T>(url: string, method: string, params: unknown[] = [], timeoutMs = 15_000): Promise<T> {
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ jsonrpc: '2.0', id: Date.now(), method, params }),
    signal: AbortSignal.timeout(timeoutMs),
  })
  if (!response.ok) throw new Error(`RPC request failed (HTTP ${response.status})`)
  const data = (await response.json()) as { result?: T; error?: { message?: string } }
  if (data.error) throw new Error(data.error.message ?? 'RPC error')
  return data.result as T
}

export async function restGet<T>(url: string, timeoutMs = 15_000): Promise<T> {
  const response = await fetch(url, { signal: AbortSignal.timeout(timeoutMs) })
  if (!response.ok) throw new Error(`HTTP ${response.status} for ${url}`)
  return (await response.json()) as T
}

export async function restText(url: string, timeoutMs = 15_000): Promise<string> {
  const response = await fetch(url, { signal: AbortSignal.timeout(timeoutMs) })
  if (!response.ok) throw new Error(`HTTP ${response.status} for ${url}`)
  return response.text()
}
