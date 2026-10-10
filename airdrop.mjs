import { Connection, Keypair } from '@solana/web3.js'
const conn = new Connection('https://api.devnet.solana.com', 'confirmed')
const kp = Keypair.generate()
console.log(kp.publicKey.toBase58())
for (let i = 0; i < 12; i++) {
  try {
    const sig = await conn.requestAirdrop(kp.publicKey, 30_000_000)
    await conn.confirmTransaction(sig).catch(() => {})
    const bal = await conn.getBalance(kp.publicKey)
    console.log('OK after', i + 1, 'attempts, balance', bal)
    process.exit(0)
  } catch { await new Promise(r => setTimeout(r, 5000)) }
}
console.log('FAILED all airdrops')
process.exit(1)
