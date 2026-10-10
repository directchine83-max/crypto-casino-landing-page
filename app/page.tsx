'use client'

import Link from 'next/link'
import { useEffect, useMemo, useRef, useState } from 'react'
import { ArrowUpRight, Check, CheckCircle2, CircleHelp, Copy, Dice5, ExternalLink, Menu, ShieldCheck, Sparkles, Trophy, Wallet, X, XCircle, Zap } from 'lucide-react'
import { deriveRoll, randomClientSeed, sha256Hex } from '@/lib/fair-client'
import { formatSol, parseUnits } from '@/lib/solana/amounts'
import { SOLANA_DECIMALS } from '@/lib/solana/config'
import {
  SolanaApiError,
  buildTransfer,
  fetchBalance,
  fetchFees,
  fetchInfo,
  sendSignedTransaction as relaySignedTransaction,
  verifySignature,
  type SolanaFeeEstimate,
  type SolanaInfo,
  type SolanaSendResult,
} from '@/lib/solana/client'
import MonetagOverlay from '@/components/monetag-overlay'
import { isAdsEnabled } from '@/lib/monetag'

type Language = 'fr' | 'en'
type BetMode = 'number' | 'under' | 'over'
type TxPhase = 'idle' | 'building' | 'signing' | 'sending' | 'done' | 'error'
type VerifyStatus = 'idle' | 'signing' | 'verified' | 'error'

type PhantomProvider = {
  isPhantom?: boolean
  publicKey?: { toString(): string } | null
  connect: (options?: { onlyIfTrusted?: boolean }) => Promise<{ publicKey: { toString(): string } }>
  disconnect?: () => Promise<void>
  signMessage: (message: Uint8Array, display?: 'utf8' | 'hex') => Promise<{ signature: Uint8Array }>
  signTransaction: (transaction: unknown) => Promise<{ serialize: (config?: object) => Uint8Array }>
  on?: (event: string, handler: (...args: unknown[]) => void) => void
  removeListener?: (event: string, handler: (...args: unknown[]) => void) => void
}

declare global {
  interface Window {
    solana?: PhantomProvider
  }
}

const copy = {
  fr: {
    nav: ['Jeux', 'Provably Fair', 'Récompenses'], connect: 'Connecter', connected: 'Connecté',
    eyebrow: 'Le casino on-chain, réinventé', hero: 'Jouez juste.', hero2: 'Gagnez vrai.',
    intro: 'Le casino Solana transparent, rapide et conçu pour les joueurs qui gardent le contrôle de leur wallet.',
    play: 'Lancer les dés', discover: 'Découvrir Live Roll', live: 'Réseau Solana',
    bet: 'Mise', balance: 'Solde on-chain', roll: 'Lancer le dé', rolling: 'Lancement...',
    chance: 'Chance de gagner', number: 'Nombre exact', under: 'Moins de', over: 'Plus de',
    fair: 'Fairness vérifiée', how: 'Comment ça marche', latest: 'Dernières parties', title: 'La chance tourne vite.',
    online: 'joueurs en ligne', responsible: 'Jouez de façon responsable.',
    walletTitle: 'Connecter un wallet Solana', walletHint: 'Connexion non-custodiale via Phantom. Votre clé privée ne quitte jamais votre navigateur.',
    phantom: 'Phantom', phantomMissing: 'Phantom n’est pas détecté dans ce navigateur.', installPhantom: 'Installer Phantom',
    fee: 'Frais réseau estimés', feeLoading: 'estimation...', total: 'Total (mise + frais)',
    rollConnect: 'Connecter le wallet pour miser', treasuryMissing: 'Trésorerie Solana non configurée : les mises on-chain sont désactivées.',
    insufficient: 'Solde insuffisant pour couvrir la mise et les frais réseau.', invalidBet: 'Mise invalide : choisissez un montant supérieur à 0.',
    txBuilding: 'Construction de la transaction...', txSigning: 'Signature en attente dans Phantom...', txSending: 'Envoi au réseau...', txSent: 'Transaction confirmée', txError: 'Transaction annulée ou échouée',
    verifyWallet: 'Vérifier le wallet', verifying: 'Vérification...', walletVerified: 'Wallet vérifié', verifyError: 'Vérification annulée',
    payoutNote: 'Gain réglé sur votre wallet par la maison après vérification.',
    helpTitle: 'Comment jouer', helpText: 'Connectez Phantom, choisissez une mise et lancez le dé. Chaque mise est un transfert Solana signé par vous.',
    helpFair: 'Les résultats sont générés de façon transparente et vérifiable.', helpWallet: 'Vous signez chaque transaction : la maison ne détient jamais vos clés.',
    helpClose: 'Fermer', close: 'Fermer', network: 'Réseau', treasury: 'Trésorerie',
    treasuryNotSet: 'non configurée', notConnected: 'Wallet non connecté', disconnect: 'Déconnecter',
    loadingBalance: 'chargement...', lastTx: 'Dernière transaction',
  },
  en: {
    nav: ['Games', 'Provably Fair', 'Rewards'], connect: 'Connect', connected: 'Connected',
    eyebrow: 'The on-chain casino, reimagined', hero: 'Play fair.', hero2: 'Win real.',
    intro: 'The transparent, fast Solana casino built for players who stay in control of their wallet.',
    play: 'Roll the dice', discover: 'Discover Live Roll', live: 'Solana network',
    bet: 'Bet', balance: 'On-chain balance', roll: 'Roll dice', rolling: 'Rolling...',
    chance: 'Win chance', number: 'Number', under: 'Under', over: 'Over',
    fair: 'Fairness verified', how: 'How it works', latest: 'Recent rolls', title: 'Luck moves fast.',
    online: 'players online', responsible: 'Play responsibly.',
    walletTitle: 'Connect a Solana wallet', walletHint: 'Non-custodial connection through Phantom. Your private key never leaves your browser.',
    phantom: 'Phantom', phantomMissing: 'Phantom is not detected in this browser.', installPhantom: 'Install Phantom',
    fee: 'Estimated network fee', feeLoading: 'estimating...', total: 'Total (bet + fee)',
    rollConnect: 'Connect wallet to bet', treasuryMissing: 'Solana treasury not configured: on-chain bets are disabled.',
    insufficient: 'Insufficient balance to cover the bet and network fee.', invalidBet: 'Invalid bet: choose an amount above 0.',
    txBuilding: 'Building transaction...', txSigning: 'Waiting for signature in Phantom...', txSending: 'Sending to the network...', txSent: 'Transaction confirmed', txError: 'Transaction cancelled or failed',
    verifyWallet: 'Verify wallet', verifying: 'Verifying...', walletVerified: 'Wallet verified', verifyError: 'Verification cancelled',
    payoutNote: 'Winnings are settled to your wallet by the house after verification.',
    helpTitle: 'How to play', helpText: 'Connect Phantom, choose a bet and roll the dice. Every bet is a Solana transfer signed by you.',
    helpFair: 'Results are generated transparently and can be independently verified.', helpWallet: 'You sign every transaction: the house never holds your keys.',
    helpClose: 'Close', close: 'Close', network: 'Network', treasury: 'Treasury',
    treasuryNotSet: 'not configured', notConnected: 'Wallet not connected', disconnect: 'Disconnect',
    loadingBalance: 'loading...', lastTx: 'Last transaction',
  },
} as const

const navHrefs = ['/games', '/provably-fair', '/rewards']
const presets = ['0.01', '0.05', '0.1', '0.25']
const DEFAULT_PAYOUT_FACTOR = 0.98

type Roll = { value: number; status: 'Gagné' | 'Perdu'; amount: string; tone: 'win' | 'loss'; player: string; createdAt: number }
type FairProof = { serverSeed: string; serverSeedHash: string; clientSeed: string; nonce: number; value: number; valid: boolean }

function getProvider(): PhantomProvider | undefined {
  if (typeof window === 'undefined') return undefined
  return window.solana
}

function base64ToBytes(value: string): Uint8Array {
  const binary = atob(value)
  const bytes = new Uint8Array(binary.length)
  for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index)
  return bytes
}

function bytesToBase64(bytes: Uint8Array): string {
  let binary = ''
  for (let index = 0; index < bytes.length; index += 1) binary += String.fromCharCode(bytes[index])
  return btoa(binary)
}

async function copyText(value: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(value)
    return true
  } catch {
    try {
      const area = document.createElement('textarea')
      area.value = value
      document.body.appendChild(area)
      area.select()
      document.execCommand('copy')
      document.body.removeChild(area)
      return true
    } catch {
      return false
    }
  }
}

function formatRelative(ts: number, language: Language): string {
  const seconds = Math.max(0, Math.round((Date.now() - ts) / 1000))
  if (seconds < 60) return language === 'fr' ? `il y a ${seconds}s` : `${seconds}s ago`
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return language === 'fr' ? `il y a ${minutes} min` : `${minutes} min ago`
  const hours = Math.floor(minutes / 60)
  return language === 'fr' ? `il y a ${hours} h` : `${hours} h ago`
}

function shorten(value: string, head = 10, tail = 6): string {
  if (value.length <= head + tail + 1) return value
  return `${value.slice(0, head)}…${value.slice(-tail)}`
}

function DiceFace({ value, rolling }: { value: number; rolling?: boolean }) {
  const dots: Record<number, number[]> = { 1: [4], 2: [0, 8], 3: [0, 4, 8], 4: [0, 2, 6, 8], 5: [0, 2, 4, 6, 8], 6: [0, 2, 3, 5, 6, 8] }
  return <div className={`dice-face ${rolling ? 'dice-rolling' : ''}`} aria-label={`Dice showing ${value}`}>{Array.from({ length: 9 }, (_, index) => <span key={index} className={dots[value].includes(index) ? 'dot' : ''} />)}</div>
}

export default function Page() {
  const [language, setLanguage] = useState<Language>('fr')
  const [walletOpen, setWalletOpen] = useState(false)
  const [wallet, setWallet] = useState<{ address: string } | null>(null)
  const [hasProvider, setHasProvider] = useState(true)
  const [info, setInfo] = useState<SolanaInfo | null>(null)
  const [balanceLamports, setBalanceLamports] = useState<bigint | null>(null)
  const [fees, setFees] = useState<SolanaFeeEstimate | null>(null)
  const [txPhase, setTxPhase] = useState<TxPhase>('idle')
  const [lastTx, setLastTx] = useState<SolanaSendResult | null>(null)
  const [verifyStatus, setVerifyStatus] = useState<VerifyStatus>('idle')
  const [error, setError] = useState('')
  const [rolling, setRolling] = useState(false)
  const [result, setResult] = useState(6)
  const [lastOutcome, setLastOutcome] = useState<'win' | 'loss' | null>(null)
  const [rolls, setRolls] = useState<Roll[]>([])
  const [bet, setBet] = useState('0.01')
  const [menuOpen, setMenuOpen] = useState(false)
  const [helpOpen, setHelpOpen] = useState(false)
  const [betMode, setBetMode] = useState<BetMode>('number')
  const [targetNumber, setTargetNumber] = useState(6)
  const [now, setNow] = useState(0)
  const [hydrated, setHydrated] = useState(false)
  const [clientSeed, setClientSeed] = useState('')
  const [seedId, setSeedId] = useState('')
  const [serverSeedHash, setServerSeedHash] = useState('')
  const [nonce, setNonce] = useState(0)
  const [lastRoll, setLastRoll] = useState<{ nonce: number; value: number } | null>(null)
  const [fairProof, setFairProof] = useState<FairProof | null>(null)
  const [proofOpen, setProofOpen] = useState(false)
  const [copiedKey, setCopiedKey] = useState('')
  const [payoutFactor, setPayoutFactor] = useState(DEFAULT_PAYOUT_FACTOR)
  const [adOpen, setAdOpen] = useState(false)
  const adShownSession = useRef(false)

  const t = copy[language]
  const symbol = 'SOL'
  const bettingEnabled = Boolean(info?.configured && info?.sendEnabled)
  const winningOutcomes = betMode === 'number' ? 1 : betMode === 'under' ? targetNumber - 1 : 6 - targetNumber
  const winChance = Math.max(0, winningOutcomes / 6)
  const multiplier = winChance > 0 ? Math.floor((payoutFactor / winChance) * 100) / 100 : 0
  const betRules = { label: betMode === 'number' ? `${t.number} ${targetNumber}` : `${betMode === 'under' ? t.under : t.over} ${targetNumber}`, chance: `${(winChance * 100).toFixed(2)}%`, multiplier: `x${multiplier.toFixed(2)}` }
  const stake = Number.parseFloat(bet)
  const stakeLamports = (() => { try { return parseUnits(bet, SOLANA_DECIMALS) } catch { return 0n } })()
  const totalLamports = stakeLamports + BigInt(fees?.totalFeeLamports ?? '0')
  const balanceSol = balanceLamports === null ? null : formatSol(balanceLamports)
  const stakeValid = Number.isFinite(stake) && stake > 0 && (balanceLamports === null || totalLamports <= balanceLamports)
  const shortAddress = wallet ? `${wallet.address.slice(0, 5)}...${wallet.address.slice(-4)}` : t.connect
  const balanceLabel = useMemo(() => (balanceSol === null ? '—' : `${balanceSol} ${symbol}`), [balanceSol])

  useEffect(() => {
    const storedLanguage = localStorage.getItem('rollbit.lang')
    if (storedLanguage === 'fr' || storedLanguage === 'en') setLanguage(storedLanguage)
    setHydrated(true)
    setClientSeed(randomClientSeed())
  }, [])

  useEffect(() => {
    if (hydrated) {
      localStorage.setItem('rollbit.lang', language)
      document.documentElement.lang = language
    }
  }, [language, hydrated])

  useEffect(() => {
    setNow(Date.now())
    const timer = window.setInterval(() => setNow(Date.now()), 30_000)
    return () => window.clearInterval(timer)
  }, [])

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key !== 'Escape') return
      setWalletOpen(false)
      setHelpOpen(false)
      setMenuOpen(false)
      setProofOpen(false)
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [])

  useEffect(() => {
    void requestCommit()
    void fetchInfo().then(setInfo).catch(() => undefined)
    setHasProvider(Boolean(getProvider()))
  }, [])

  useEffect(() => {
    fetch('/api/games').then(response => response.json()).then(data => {
      if (Array.isArray(data.games) && data.games.length) setRolls(data.games)
    }).catch(() => undefined)
  }, [])

  useEffect(() => {
    fetch('/api/house').then(response => response.json()).then(data => {
      if (typeof data.payoutFactor === 'number' && data.payoutFactor > 0) setPayoutFactor(data.payoutFactor)
    }).catch(() => undefined)
  }, [])

  useEffect(() => {
    const provider = getProvider()
    if (!provider?.connect) return
    provider.connect({ onlyIfTrusted: true }).then(({ publicKey }) => {
      const address = publicKey.toString()
      setWallet({ address })
      void refreshBalance(address)
      void refreshFees(address)
    }).catch(() => undefined)

    const onAccountChanged = (...args: unknown[]) => {
      const next = args[0] as { toString(): string } | null
      if (next && typeof next.toString === 'function') {
        const address = next.toString()
        setWallet({ address })
        setVerifyStatus('idle')
        void refreshBalance(address)
      } else {
        setWallet(null)
        setBalanceLamports(null)
      }
    }
    provider.on?.('accountChanged', onAccountChanged)
    return () => provider.removeListener?.('accountChanged', onAccountChanged)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    if (!wallet) return
    const timer = window.setTimeout(() => { void refreshFees(wallet.address, bet) }, 400)
    return () => window.clearTimeout(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bet, wallet])

  useEffect(() => {
    if (!wallet) return
    const timer = window.setInterval(() => { void refreshBalance(wallet.address) }, 30_000)
    return () => window.clearInterval(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [wallet])

  async function refreshBalance(address?: string) {
    const target = address ?? wallet?.address
    if (!target) return
    try {
      const data = await fetchBalance(target)
      setBalanceLamports(BigInt(data.lamports))
    } catch { /* keep previous value */ }
  }

  async function refreshFees(address?: string, amount = bet) {
    try {
      let amountLamports: string | undefined
      try { amountLamports = parseUnits(amount, SOLANA_DECIMALS).toString() } catch { amountLamports = undefined }
      setFees(await fetchFees({ from: address, amountLamports }))
    } catch { /* keep previous value */ }
  }

  async function connectWallet() {
    const provider = getProvider()
    setHasProvider(Boolean(provider))
    if (!provider) return
    try {
      const { publicKey } = await provider.connect()
      const address = publicKey.toString()
      setWallet({ address })
      setWalletOpen(false)
      setError('')
      void refreshBalance(address)
      void refreshFees(address)
    } catch { setError(language === 'fr' ? 'Connexion annulée.' : 'Connection cancelled.') }
  }

  async function disconnectWallet() {
    const provider = getProvider()
    try { await provider?.disconnect?.() } catch { /* ignore */ }
    setWallet(null)
    setBalanceLamports(null)
    setFees(null)
    setVerifyStatus('idle')
    setTxPhase('idle')
    setLastTx(null)
    setWalletOpen(false)
  }

  async function requestCommit() {
    try {
      const response = await fetch('/api/fair', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'commit' }) })
      const data = await response.json()
      if (data.seedId && data.serverSeedHash) {
        setSeedId(data.seedId)
        setServerSeedHash(data.serverSeedHash)
        setNonce(0)
      }
    } catch { /* offline: fall back to client randomness */ }
  }

  async function verifyWallet() {
    if (!wallet) return
    const provider = getProvider()
    if (!provider?.signMessage) { setVerifyStatus('error'); return }
    setVerifyStatus('signing')
    try {
      const message = `Live Roll · Vérification du wallet · ${wallet.address}`
      const { signature } = await provider.signMessage(new TextEncoder().encode(message), 'utf8')
      const { verified } = await verifySignature({ address: wallet.address, message, signature: bytesToBase64(signature) })
      setVerifyStatus(verified ? 'verified' : 'error')
    } catch { setVerifyStatus('error') }
  }

  async function resolveRoll(stakeValue: number) {
    const mode = betMode
    const target = targetNumber
    const currentMultiplier = multiplier
    const usedNonce = nonce

    let value: number | null = null
    if (seedId && clientSeed) {
      try {
        const response = await fetch('/api/fair', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'roll', seedId, clientSeed, nonce: usedNonce }) })
        const data = await response.json()
        if (typeof data.value === 'number') value = data.value
      } catch { /* fall back below */ }
    }
    if (value === null) value = Math.floor(Math.random() * 6) + 1
    const rolledValue = value
    setNonce(usedNonce + 1)

    await new Promise(resolve => window.setTimeout(resolve, 700))
    const won = mode === 'number' ? rolledValue === target : mode === 'under' ? rolledValue < target : rolledValue > target
    const payout = won ? stakeValue * (currentMultiplier - 1) : -stakeValue
    const player = wallet ? `${wallet.address.slice(0, 5)}...${wallet.address.slice(-4)}` : (language === 'fr' ? 'Joueur invité' : 'Guest player')
    const nextRoll: Roll = { value: rolledValue, status: won ? 'Gagné' : 'Perdu', amount: `${payout >= 0 ? '+' : ''}${payout.toFixed(4)} ${symbol}`, tone: won ? 'win' : 'loss', player, createdAt: Date.now() }
    setResult(rolledValue)
    setLastOutcome(won ? 'win' : 'loss')
    setLastRoll({ nonce: usedNonce, value: rolledValue })
    setRolls(current => [nextRoll, ...current].slice(0, 12))
    void fetch('/api/games', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(nextRoll) }).catch(() => undefined)
  }

  async function rollDice() {
    if (rolling) return
    if (!wallet) { setWalletOpen(true); return }
    if (!bettingEnabled) { setError(t.treasuryMissing); return }

    const stakeValue = stake
    if (!Number.isFinite(stakeValue) || stakeValue <= 0) { setError(t.invalidBet); return }
    if (balanceLamports !== null && totalLamports > balanceLamports) { setError(t.insufficient); return }

    if (!adShownSession.current && isAdsEnabled()) {
      adShownSession.current = true
      setAdOpen(true)
    }

    setRolling(true)
    setError('')
    setLastTx(null)
    setTxPhase('building')
    try {
      const built = await buildTransfer({ from: wallet.address, amount: bet })
      setFees(built)
      setTxPhase('signing')

      const provider = getProvider()
      if (!provider) throw new Error(t.phantomMissing)
      const { Transaction } = await import('@solana/web3.js')
      const transaction = Transaction.from(base64ToBytes(built.transaction))
      const signed = await provider.signTransaction(transaction)
      const signedBase64 = bytesToBase64(signed.serialize())

      setTxPhase('sending')
      const sent = await relaySignedTransaction({ transaction: signedBase64, address: wallet.address, amount: built.amountSol })
      setLastTx(sent)
      setTxPhase('done')

      await resolveRoll(stakeValue)
      void refreshBalance()
      void refreshFees(wallet.address, bet)
    } catch (caught) {
      const message = caught instanceof SolanaApiError ? caught.message : caught instanceof Error && caught.message ? caught.message : t.txError
      setError(message)
      setTxPhase('error')
    } finally {
      setRolling(false)
    }
  }

  async function revealLastRoll() {
    if (!seedId || !lastRoll || !clientSeed) return
    try {
      const revealResponse = await fetch('/api/fair', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'reveal', seedId }) })
      const reveal = await revealResponse.json()
      if (!reveal.serverSeed) return
      const [hashOk, derived] = await Promise.all([sha256Hex(reveal.serverSeed), deriveRoll(reveal.serverSeed, clientSeed, lastRoll.nonce)])
      const hashMatches = reveal.serverSeedHash === undefined || hashOk === reveal.serverSeedHash
      setFairProof({ serverSeed: reveal.serverSeed, serverSeedHash: reveal.serverSeedHash ?? hashOk, clientSeed, nonce: lastRoll.nonce, value: lastRoll.value, valid: hashMatches && derived === lastRoll.value })
      setProofOpen(true)
      await requestCommit()
    } catch { /* ignore */ }
  }

  async function handleCopy(key: string, value: string) {
    if (!value) return
    if (await copyText(value)) {
      setCopiedKey(key)
      window.setTimeout(() => setCopiedKey(current => (current === key ? '' : current)), 1500)
    }
  }

  const txMessage = txPhase === 'building' ? t.txBuilding : txPhase === 'signing' ? t.txSigning : txPhase === 'sending' ? t.txSending : txPhase === 'done' ? t.txSent : txPhase === 'error' ? t.txError : ''

  return <main className="min-h-screen overflow-hidden bg-[#07110f] text-[#f4f4ed] selection:bg-[#bbf7d0] selection:text-[#07110f]"><div className="noise" aria-hidden="true" />
    <header className="relative z-10 mx-auto flex max-w-[1240px] items-center justify-between px-5 py-5 lg:px-8">
      <Link className="flex items-center gap-2.5" href="/"><span className="brand-mark"><Dice5 size={20} /></span><span className="font-mono text-[15px] font-bold tracking-[0.2em] text-white">LIVE<span className="text-[#b7f34a]">ROLL</span></span></Link>
      <nav className="hidden items-center gap-9 text-[13px] text-[#aab7ad] md:flex">{t.nav.map((item, i) => <Link key={item} href={navHrefs[i]}>{item}</Link>)}</nav>
      <div className="flex items-center gap-3">
        <span className="hidden items-center gap-1.5 text-[11px] text-[#84988b] sm:flex"><span className="live-dot" />{t.live}</span>
        <button className="language-button" onClick={() => setLanguage(language === 'fr' ? 'en' : 'fr')} aria-label="Switch language">{language.toUpperCase()}</button>
        <button className="connect-button" onClick={() => (wallet ? setWalletOpen(true) : connectWallet())}><Wallet size={15} />{shortAddress}</button>
        <button className="menu-button md:hidden" aria-label={menuOpen ? (language === 'fr' ? 'Fermer le menu' : 'Close menu') : (language === 'fr' ? 'Ouvrir le menu' : 'Open menu')} aria-expanded={menuOpen} onClick={() => setMenuOpen(open => !open)}>{menuOpen ? <X size={18} /> : <Menu size={18} />}</button>
      </div>
      {menuOpen && <div className="menu-panel" role="menu">{t.nav.map((item, i) => <Link key={item} role="menuitem" href={navHrefs[i]} onClick={() => setMenuOpen(false)}>{item}</Link>)}</div>}
    </header>

    {helpOpen && <div className="wallet-modal-backdrop" role="presentation" onClick={() => setHelpOpen(false)}><section className="wallet-modal help-modal" role="dialog" aria-modal="true" aria-labelledby="help-title" onClick={e => e.stopPropagation()}><button className="wallet-close" onClick={() => setHelpOpen(false)} aria-label={t.helpClose} autoFocus><X size={18} /></button><span className="eyebrow"><CircleHelp size={13} /> {t.helpTitle}</span><h2 id="help-title">{t.helpText}</h2><div className="help-points"><p><ShieldCheck size={16} /> {t.helpFair}</p><p><Wallet size={16} /> {t.helpWallet}</p><p><Zap size={16} /> {t.payoutNote}</p></div></section></div>}

    {walletOpen && <div className="wallet-modal-backdrop" role="presentation" onClick={() => setWalletOpen(false)}><section className="wallet-modal" role="dialog" aria-modal="true" aria-labelledby="wallet-title" onClick={e => e.stopPropagation()}><button className="wallet-close" onClick={() => setWalletOpen(false)} aria-label={t.close} autoFocus><X size={18} /></button><span className="eyebrow"><Wallet size={13} /> {t.walletTitle}</span><h2 id="wallet-title">{wallet ? shorten(wallet.address, 8, 6) : t.walletTitle}</h2><p>{t.walletHint}</p>
      {wallet ? <div className="wallet-connected">
        <div className="wallet-connected-row"><span>{t.balance}</span><b>{balanceLabel}</b></div>
        <div className="wallet-connected-row"><span>{t.network}</span><b>Solana · {info?.cluster ?? 'mainnet-beta'}</b></div>
        <button type="button" className="wc-mini-button" onClick={() => handleCopy('address', wallet.address)}>{copiedKey === 'address' ? <Check size={13} /> : <Copy size={13} />}{shorten(wallet.address, 8, 6)}</button>
        <button type="button" className="sign-button" onClick={disconnectWallet}>{t.disconnect}</button>
      </div> : <div className="wallet-options"><button onClick={connectWallet}><span className="network-icon solana">S</span><span>{t.phantom}</span><ArrowUpRight size={15} /></button></div>}
      {!hasProvider && <p className="wc-hint">{t.phantomMissing} <a href="https://phantom.app/" target="_blank" rel="noreferrer">{t.installPhantom} ↗</a></p>}
      {info && !info.configured && <p className="wc-hint">{t.treasuryMissing}</p>}
    </section></div>}

    {proofOpen && fairProof && <div className="wallet-modal-backdrop" role="presentation" onClick={() => setProofOpen(false)}><section className="wallet-modal help-modal" role="dialog" aria-modal="true" aria-labelledby="proof-title" onClick={e => e.stopPropagation()}><button className="wallet-close" onClick={() => setProofOpen(false)} aria-label="Close" autoFocus><X size={18} /></button><span className="eyebrow">{fairProof.valid ? <CheckCircle2 size={13} /> : <XCircle size={13} />} {language === 'fr' ? 'Preuve provably fair' : 'Provably fair proof'}</span><h2 id="proof-title">{fairProof.valid ? (language === 'fr' ? 'Preuve valide — résultat vérifié' : 'Valid proof — result verified') : (language === 'fr' ? 'Preuve non vérifiée' : 'Proof not verified')}</h2><ul className="proof-list"><li><span>Server seed</span><code>{fairProof.serverSeed}</code></li><li><span>SHA-256 (server seed)</span><code>{fairProof.serverSeedHash}</code></li><li><span>Client seed</span><code>{fairProof.clientSeed}</code></li><li><span>Nonce</span><code>{fairProof.nonce}</code></li><li><span>{language === 'fr' ? 'Résultat' : 'Result'}</span><code>{fairProof.value}</code></li></ul></section></div>}

    <MonetagOverlay
      show={adOpen}
      autoClose={15}
      hint={remaining => (language === 'fr' ? `Publicité — fermeture automatique dans ${remaining} s` : `Advertisement — closes automatically in ${remaining}s`)}
      onClose={() => setAdOpen(false)}
      onShown={() => void fetch('/api/ads/shown', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ source: 'push' }) }).catch(() => undefined)}
    />

    <section id="top" className="relative mx-auto grid max-w-[1240px] items-center gap-14 px-5 pb-20 pt-12 lg:grid-cols-[1fr_0.84fr] lg:px-8 lg:pb-28 lg:pt-24">
      <div className="orb orb-one" /><div className="orb orb-two" />
      <div className="relative z-[1]">
        <div className="eyebrow"><Sparkles size={13} /> {t.eyebrow}</div>
        <h1>{t.hero}<br /><em>{t.hero2}</em></h1>
        <p className="hero-copy">{t.intro}</p>
        <div className="flex flex-wrap items-center gap-4">
          <a className="primary-button" href="#game">{t.play} <ArrowUpRight size={17} /></a>
          <a className="secondary-link" href="#trust">{t.discover} <span>↗</span></a>
        </div>
        <div className="hero-stats">
          <div><strong>100%</strong><span>Provably fair</span></div>
          <div><strong>Solana</strong><span>On-chain bets</span></div>
          <div><strong>24/7</strong><span>Human support</span></div>
        </div>
      </div>

      <div id="game" className="relative z-[1]">
        <div className="game-card">
          <div className="game-head">
            <div><span className="game-kicker"><span className="live-dot" />LIVE</span><h2>Dice <span>/</span> Classic</h2></div>
            <button className="icon-button" aria-label={t.helpTitle} onClick={() => setHelpOpen(true)}><CircleHelp size={18} /></button>
          </div>

          <div className={`roll-stage ${lastOutcome ? `outcome-${lastOutcome}` : ''}`}>
            <div className="stage-glow" />
            <DiceFace value={result} rolling={rolling} />
            <div className="outcome-message" aria-live="polite" aria-atomic="true">
              {rolling ? <span className="outcome-rolling">{t.rolling}</span> : lastOutcome ? <><strong>{lastOutcome === 'win' ? 'WIN' : 'LOSE'}</strong><span>{lastOutcome === 'win' ? (language === 'fr' ? 'Bien joué' : 'Nice roll') : (language === 'fr' ? 'La prochaine sera la bonne' : 'Better luck next roll')}</span></> : null}
            </div>
            <div className="chance-badge"><span>{t.chance}</span><b>{betRules.chance} · {betRules.multiplier}</b></div>
          </div>

          <div className="game-form">
            <label>{language === 'fr' ? 'Type de pari' : 'Bet type'}</label>
            <div className="bet-presets">
              <button className={betMode === 'number' ? 'active' : ''} onClick={() => setBetMode('number')}>{t.number}</button>
              <button className={betMode === 'under' ? 'active' : ''} onClick={() => { setBetMode('under'); if (targetNumber < 2) setTargetNumber(2) }}>{t.under}</button>
              <button className={betMode === 'over' ? 'active' : ''} onClick={() => { setBetMode('over'); if (targetNumber > 5) setTargetNumber(5) }}>{t.over}</button>
            </div>
            <div className="bet-presets" aria-label={t.number}>
              {[1, 2, 3, 4, 5, 6].map(value => {
                const valid = betMode === 'number' || (betMode === 'under' ? value >= 2 : value <= 5)
                return <button key={value} disabled={!valid} className={targetNumber === value ? 'active' : ''} onClick={() => valid && setTargetNumber(value)}>{value}</button>
              })}
            </div>
            <p className="bet-rule">{betRules.label} · {betRules.chance} · {betRules.multiplier}</p>

            <label>{t.bet} <span>{t.balance}: {balanceLabel}</span></label>
            <div className="bet-input">
              <input value={bet} onChange={e => setBet(e.target.value)} inputMode="decimal" aria-label="Bet amount" aria-invalid={!stakeValid} />
              <span>{symbol}</span>
              <button onClick={() => balanceSol && setBet(balanceSol)} disabled={!balanceSol}>MAX</button>
            </div>
            <div className="bet-presets">
              {presets.map(value => <button key={value} onClick={() => setBet(value)} className={bet === value ? 'active' : ''}>{value}</button>)}
            </div>

            <div className="fee-panel">
              <div className="fee-row"><span>{t.fee}</span><b>{fees ? `${fees.totalFeeSol} ${symbol}` : t.feeLoading}</b></div>
              <div className="fee-row"><span>{t.total}</span><b>{formatSol(totalLamports)} {symbol}</b></div>
            </div>

            {!stakeValid && stake > 0 && <p className="bet-error">{balanceLamports !== null && totalLamports > balanceLamports ? t.insufficient : t.invalidBet}</p>}
            {error && <p className="bet-error">{error}</p>}

            <button className="roll-button" onClick={rollDice} disabled={rolling || !stakeValid || (wallet ? !bettingEnabled : false)}><Dice5 size={18} />{rolling ? t.rolling : !wallet ? t.rollConnect : t.roll}<span>→</span></button>

            {txMessage && <p className={`tx-status ${txPhase}`}>{txPhase === 'done' ? <CheckCircle2 size={14} /> : txPhase === 'error' ? <XCircle size={14} /> : null} {txMessage}{lastTx ? <a href={lastTx.explorerUrl} target="_blank" rel="noreferrer"> {t.lastTx} <ExternalLink size={11} /></a> : null}</p>}

            {wallet && <button className="sign-button" onClick={verifyWallet} disabled={verifyStatus === 'signing'}>{verifyStatus === 'verified' ? <Check size={14} /> : null}{verifyStatus === 'verified' ? t.walletVerified : verifyStatus === 'signing' ? t.verifying : verifyStatus === 'error' ? t.verifyError : t.verifyWallet}</button>}

            <div className="fair-panel">
              <div className="fair-head"><ShieldCheck size={14} /><span>Provably fair</span><button type="button" className="fair-link" onClick={revealLastRoll} disabled={!seedId || !lastRoll}>{language === 'fr' ? 'Vérifier le dernier lancer' : 'Verify last roll'}</button></div>
              <div className="fair-grid">
                <div><span>Server seed (hash)</span><code title={serverSeedHash}>{serverSeedHash ? shorten(serverSeedHash) : '…'}</code></div>
                <div><span>Client seed</span><code title={clientSeed}>{clientSeed ? shorten(clientSeed) : '…'}</code></div>
                <div><span>Nonce</span><code>{nonce}</code></div>
              </div>
            </div>
          </div>

          <div className="game-foot"><span><ShieldCheck size={14} /> {t.fair}</span><a href="#trust">{t.how} <ExternalLink size={12} /></a></div>
        </div>
        <div className="floating-pill"><span className="avatar-stack"><i /><i /><i /></span><span><b>1,284</b> {t.online}</span></div>
      </div>
    </section>

    <section id="trust" className="relative border-y border-[#183126] bg-[#091713]">
      <div className="mx-auto grid max-w-[1240px] gap-px px-5 lg:grid-cols-3 lg:px-8">
        {[{ icon: ShieldCheck, title: 'Provably fair', text: 'Every result is verifiable on-chain.' }, { icon: Zap, title: 'Non-custodial', text: 'You sign every Solana transaction.' }, { icon: Trophy, title: 'Rewards', text: 'Earn more with every session.' }].map(({ icon: Icon, title, text }) => <div key={title} className="trust-item"><Icon size={20} /><div><h3>{title}</h3><p>{text}</p></div></div>)}
      </div>
    </section>

    <section className="mx-auto max-w-[1240px] px-5 py-20 lg:px-8 lg:py-28">
      <div className="mb-9 flex items-end justify-between"><div><span className="section-label">{t.latest}</span><h2 className="section-title">{t.title}</h2></div></div>
      <div className="roll-list">
        {rolls.length === 0 && <p className="roll-empty">{language === 'fr' ? 'Chargement des dernières parties…' : 'Loading recent rolls…'}</p>}
        {rolls.map((roll, index) => <div className="roll-row" key={`${roll.createdAt}-${index}`}><div className="mini-die">{roll.value}</div><div className="roll-info"><b>Dice Classic</b><span>{now ? formatRelative(roll.createdAt, language) : '—'} · {roll.player}</span></div><span className={`roll-status ${roll.tone}`}>{language === 'fr' ? roll.status : roll.tone === 'win' ? 'Won' : 'Lost'}</span><strong className={roll.tone}>{roll.amount}</strong></div>)}
      </div>
    </section>

    <footer className="border-t border-[#183126] px-5 py-8 lg:px-8"><div className="mx-auto flex max-w-[1240px] justify-between gap-5 text-[11px] text-[#71837a]"><span>© 2026 Live Roll Protocol. {t.responsible}</span><div className="flex gap-5"><Link href="/docs">Docs</Link><Link href="/discord">Discord</Link><Link href="/terms">Terms</Link></div></div></footer>
  </main>
}

export { DiceFace }
