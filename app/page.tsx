'use client'

import Link from 'next/link'
import { useEffect, useRef, useState } from 'react'
import { ArrowDownToLine, ArrowUpRight, Check, CheckCircle2, CircleHelp, Copy, Dice5, ExternalLink, KeyRound, Menu, ShieldCheck, Sparkles, Trophy, Wallet, X, XCircle, Zap } from 'lucide-react'
import { deriveRoll, randomClientSeed, sha256Hex } from '@/lib/fair-client'
import { NETWORK_SYMBOL as networkSymbol, WALLET_NETWORKS as networks } from '@/lib/wallet/networks'
import type { WalletNetwork as Network } from '@/lib/wallet/types'
import WalletCreateModal from '@/components/wallet-create-modal'
import MonetagOverlay from '@/components/monetag-overlay'
import { isAdsEnabled } from '@/lib/monetag'

type Language = 'fr' | 'en'
type BetMode = 'number' | 'under' | 'over'

declare global {
  interface Window {
    ethereum?: { request: (args: { method: string; params?: unknown[] }) => Promise<string[] | string> }
    solana?: { connect: () => Promise<{ publicKey: { toString: () => string } }>; signMessage?: (message: Uint8Array, display?: 'utf8' | 'hex') => Promise<{ signature: Uint8Array | string }> }
    unisat?: { requestAccounts: () => Promise<string[]>; signMessage?: (message: string, type?: 'ecdsa' | 'bip322-simple') => Promise<string> }
  }
}

const copy = {
  fr: { nav: ['Jeux', 'Provably Fair', 'Récompenses'], connect: 'Connecter', connected: 'Connecté', eyebrow: 'Le casino on-chain, réinventé', hero: 'Jouez juste.', hero2: 'Gagnez vrai.', intro: 'Le casino crypto transparent, rapide et conçu pour les joueurs qui veulent garder le contrôle.', play: 'Lancer les dés', discover: 'Découvrir Rollbit', live: 'Réseau actif', bet: 'Mise', balance: 'Solde', roll: 'Lancer le dé', rolling: 'Lancement...', chance: 'Chance de gagner', number: 'Nombre exact', under: 'Moins de', over: 'Plus de', fair: 'Fairness vérifiée', how: 'Comment ça marche', latest: 'Dernières parties', title: 'La chance tourne vite.', online: 'joueurs en ligne', responsible: 'Jouez de façon responsable.', walletTitle: 'Choisissez votre réseau', walletHint: 'Connexion non-custodiale via votre wallet navigateur.', sign: 'Signer pour vérifier', signing: 'Signature en attente...', signed: 'Signature du wallet vérifiée', signError: 'Signature annulée', helpTitle: 'Comment jouer', helpText: 'Choisissez une mise, lancez le dé et vérifiez chaque résultat grâce à notre système provably fair.', helpFair: 'Les résultats sont générés de façon transparente et vérifiable.', helpWallet: 'Votre wallet reste sous votre contrôle : Rollbit ne demande jamais votre phrase secrète.', helpClose: 'Fermer', deposit: 'Dépôt', depositTitle: 'Déposer des fonds', depositHint: 'Envoyez vos fonds à l’adresse correspondant à votre réseau. Votre solde est crédité après confirmation.', depositEmpty: 'Adresses de réception non configurées.', depositNote: 'Vérifiez toujours le réseau avant d’envoyer. N’envoyez jamais d’actifs d’une chaîne vers une autre.', copy: 'Copier', copied: 'Copié', depositClose: 'Fermer' },
  en: { nav: ['Games', 'Provably Fair', 'Rewards'], connect: 'Connect', connected: 'Connected', eyebrow: 'The on-chain casino, reimagined', hero: 'Play fair.', hero2: 'Win real.', intro: 'The transparent, fast crypto casino built for players who stay in control.', play: 'Roll the dice', discover: 'Discover Rollbit', live: 'Network live', bet: 'Bet', balance: 'Balance', roll: 'Roll dice', rolling: 'Rolling...', chance: 'Win chance', number: 'Number', under: 'Under', over: 'Over', fair: 'Fairness verified', how: 'How it works', latest: 'Recent rolls', title: 'Luck moves fast.', online: 'players online', responsible: 'Play responsibly.', walletTitle: 'Choose your network', walletHint: 'Non-custodial connection through your browser wallet.', sign: 'Sign to verify ownership', signing: 'Waiting for signature...', signed: 'Wallet signature verified', signError: 'Signature cancelled', helpTitle: 'How to play', helpText: 'Choose a bet, roll the dice, and verify every result through our provably fair system.', helpFair: 'Results are generated transparently and can be independently verified.', helpWallet: 'Your wallet stays in your control: Rollbit never asks for your secret phrase.', helpClose: 'Close', deposit: 'Deposit', depositTitle: 'Deposit funds', depositHint: 'Send funds to the address for your network. Your balance is credited after confirmation.', depositEmpty: 'Receiving addresses are not configured.', depositNote: 'Always double-check the network before sending. Never send assets from one chain to another.', copy: 'Copy', copied: 'Copied', depositClose: 'Close' },
}

const navHrefs = ['/games', '/provably-fair', '/rewards']
const presets = ['0.01', '0.05', '0.1', '0.25']
const STARTING_BALANCE = 0.247

type Roll = { value: number; status: 'Gagné' | 'Perdu'; amount: string; tone: 'win' | 'loss'; player: string; createdAt: number }
type FairProof = { serverSeed: string; serverSeedHash: string; clientSeed: string; nonce: number; value: number; valid: boolean }
type Treasury = { network: Network; symbol: string; address: string; explorerUrl: string; configured: boolean }

const DEFAULT_PAYOUT_FACTOR = 0.98

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
  const [wallet, setWallet] = useState<{ network: Network; address: string } | null>(null)
  const [signatureStatus, setSignatureStatus] = useState<'idle' | 'signing' | 'signed' | 'error'>('idle')
  const [rolling, setRolling] = useState(false)
  const [result, setResult] = useState(6)
  const [lastOutcome, setLastOutcome] = useState<'win' | 'loss' | null>(null)
  const [rolls, setRolls] = useState<Roll[]>([])
  const [balance, setBalance] = useState(STARTING_BALANCE)
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
  const [createOpen, setCreateOpen] = useState(false)
  const [depositOpen, setDepositOpen] = useState(false)
  const [treasury, setTreasury] = useState<Treasury[]>([])
  const [treasuryLoaded, setTreasuryLoaded] = useState(false)
  const [copiedKey, setCopiedKey] = useState('')
  const [payoutFactor, setPayoutFactor] = useState(DEFAULT_PAYOUT_FACTOR)
  const [adOpen, setAdOpen] = useState(false)
  const adShownSession = useRef(false)

  const t = copy[language]
  const symbol = wallet ? networkSymbol[wallet.network] : 'ETH'
  const winningOutcomes = betMode === 'number' ? 1 : betMode === 'under' ? targetNumber - 1 : 6 - targetNumber
  const winChance = Math.max(0, winningOutcomes / 6)
  const multiplier = winChance > 0 ? Math.floor((payoutFactor / winChance) * 100) / 100 : 0
  const betRules = { label: betMode === 'number' ? `${t.number} ${targetNumber}` : `${betMode === 'under' ? t.under : t.over} ${targetNumber}`, chance: `${(winChance * 100).toFixed(2)}%`, multiplier: `x${multiplier.toFixed(2)}` }
  const stake = Number.parseFloat(bet)
  const stakeValid = Number.isFinite(stake) && stake > 0 && stake <= balance

  useEffect(() => {
    const storedBalanceRaw = localStorage.getItem('rollbit.balance')
    const storedBalance = storedBalanceRaw === null ? Number.NaN : Number(storedBalanceRaw)
    if (Number.isFinite(storedBalance) && storedBalance >= 0) setBalance(storedBalance)
    const storedLanguage = localStorage.getItem('rollbit.lang')
    if (storedLanguage === 'fr' || storedLanguage === 'en') setLanguage(storedLanguage)
    setHydrated(true)
    setClientSeed(randomClientSeed())
  }, [])

  useEffect(() => {
    if (hydrated) localStorage.setItem('rollbit.balance', String(balance))
  }, [balance, hydrated])

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
      setCreateOpen(false)
      setDepositOpen(false)
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [])

  useEffect(() => {
    void requestCommit()
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

  async function openDeposit() {
    setDepositOpen(true)
    if (treasuryLoaded) return
    try {
      const response = await fetch('/api/deposits/treasury')
      const data = await response.json()
      if (Array.isArray(data.addresses)) setTreasury(data.addresses)
    } catch { /* keep empty state */ } finally {
      setTreasuryLoaded(true)
    }
  }

  async function handleCopy(key: string, value: string) {
    if (!value) return
    if (await copyText(value)) {
      setCopiedKey(key)
      window.setTimeout(() => setCopiedKey(current => (current === key ? '' : current)), 1500)
    }
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

  async function connectWallet(network: Network) {
    try {
      let address = ''
      if (network === 'ethereum' && window.ethereum) address = String((await window.ethereum.request({ method: 'eth_requestAccounts' }) as string[])[0])
      if (network === 'solana' && window.solana) address = (await window.solana.connect()).publicKey.toString()
      if (network === 'bitcoin' && window.unisat) address = (await window.unisat.requestAccounts())[0]
      if (!address) { window.alert(language === 'fr' ? 'Installez un wallet compatible pour continuer.' : 'Install a compatible wallet to continue.'); return }
      await fetch('/api/wallets', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ network, address }) })
      setWallet({ network, address }); setSignatureStatus('idle'); setWalletOpen(false)
    } catch { window.alert(language === 'fr' ? 'Connexion annulée.' : 'Connection cancelled.') }
  }

  async function signWallet() {
    if (!wallet) return
    setSignatureStatus('signing')
    const message = `Rollbit self-custody verification · ${wallet.address}`
    try {
      let signature = ''
      if (wallet.network === 'ethereum' && window.ethereum) signature = String(await window.ethereum.request({ method: 'personal_sign', params: [message, wallet.address] }))
      if (wallet.network === 'solana' && window.solana?.signMessage) signature = String((await window.solana.signMessage(new TextEncoder().encode(message), 'utf8')).signature)
      if (wallet.network === 'bitcoin' && window.unisat?.signMessage) signature = await window.unisat.signMessage(message, 'bip322-simple')
      if (!signature) throw new Error('Signing is not supported by this wallet')
      const response = await fetch('/api/wallets/verify', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ network: wallet.network, address: wallet.address, message, signature }) })
      if (!response.ok) throw new Error('Signature rejected')
      setSignatureStatus('signed')
    } catch { setSignatureStatus('error') }
  }

  async function rollDice() {
    if (rolling || !stakeValid) return
    if (!adShownSession.current && isAdsEnabled()) {
      adShownSession.current = true
      setAdOpen(true)
    }
    const mode = betMode
    const target = targetNumber
    const currentMultiplier = multiplier
    const currentStake = stake
    const usedNonce = nonce
    setRolling(true)

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

    window.setTimeout(() => {
      const won = mode === 'number' ? rolledValue === target : mode === 'under' ? rolledValue < target : rolledValue > target
      const payout = won ? currentStake * (currentMultiplier - 1) : -currentStake
      const player = wallet ? `${wallet.address.slice(0, 5)}...${wallet.address.slice(-4)}` : (language === 'fr' ? 'Joueur invité' : 'Guest player')
      const nextRoll: Roll = { value: rolledValue, status: won ? 'Gagné' : 'Perdu', amount: `${payout >= 0 ? '+' : ''}${payout.toFixed(4)} ${symbol}`, tone: won ? 'win' : 'loss', player, createdAt: Date.now() }
      setResult(rolledValue)
      setLastOutcome(won ? 'win' : 'loss')
      setLastRoll({ nonce: usedNonce, value: rolledValue })
      setBalance(current => Math.max(0, current + payout))
      setRolls(current => [nextRoll, ...current].slice(0, 12))
      void fetch('/api/games', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(nextRoll) }).catch(() => undefined)
      setRolling(false)
    }, 700)
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

  const shortAddress = wallet ? `${wallet.address.slice(0, 5)}...${wallet.address.slice(-4)}` : t.connect

  return <main className="min-h-screen overflow-hidden bg-[#07110f] text-[#f4f4ed] selection:bg-[#bbf7d0] selection:text-[#07110f]"><div className="noise" aria-hidden="true" />
    <header className="relative z-10 mx-auto flex max-w-[1240px] items-center justify-between px-5 py-5 lg:px-8">
      <Link className="flex items-center gap-2.5" href="/"><span className="brand-mark"><Dice5 size={20} /></span><span className="font-mono text-[15px] font-bold tracking-[0.2em] text-white">ROLL<span className="text-[#b7f34a]">BIT</span></span></Link>
      <nav className="hidden items-center gap-9 text-[13px] text-[#aab7ad] md:flex">{t.nav.map((item, i) => <Link key={item} href={navHrefs[i]}>{item}</Link>)}</nav>
      <div className="flex items-center gap-3">
        <span className="hidden items-center gap-1.5 text-[11px] text-[#84988b] sm:flex"><span className="live-dot" />{t.live}</span>
        <button className="language-button" onClick={() => setLanguage(language === 'fr' ? 'en' : 'fr')} aria-label="Switch language">{language.toUpperCase()}</button>
        <button className="deposit-button" onClick={openDeposit}><ArrowDownToLine size={15} />{t.deposit}</button>
        <button className="connect-button" onClick={() => setWalletOpen(true)}><Wallet size={15} />{shortAddress}</button>
        <button className="menu-button md:hidden" aria-label={menuOpen ? (language === 'fr' ? 'Fermer le menu' : 'Close menu') : (language === 'fr' ? 'Ouvrir le menu' : 'Open menu')} aria-expanded={menuOpen} onClick={() => setMenuOpen(open => !open)}>{menuOpen ? <X size={18} /> : <Menu size={18} />}</button>
      </div>
      {menuOpen && <div className="menu-panel" role="menu">{t.nav.map((item, i) => <Link key={item} role="menuitem" href={navHrefs[i]} onClick={() => setMenuOpen(false)}>{item}</Link>)}</div>}
    </header>

    {helpOpen && <div className="wallet-modal-backdrop" role="presentation" onClick={() => setHelpOpen(false)}><section className="wallet-modal help-modal" role="dialog" aria-modal="true" aria-labelledby="help-title" onClick={e => e.stopPropagation()}><button className="wallet-close" onClick={() => setHelpOpen(false)} aria-label={t.helpClose} autoFocus><X size={18} /></button><span className="eyebrow"><CircleHelp size={13} /> {t.helpTitle}</span><h2 id="help-title">{t.helpText}</h2><div className="help-points"><p><ShieldCheck size={16} /> {t.helpFair}</p><p><Wallet size={16} /> {t.helpWallet}</p></div></section></div>}

    {walletOpen && <div className="wallet-modal-backdrop" role="presentation" onClick={() => setWalletOpen(false)}><section className="wallet-modal" role="dialog" aria-modal="true" aria-labelledby="wallet-title" onClick={e => e.stopPropagation()}><button className="wallet-close" onClick={() => setWalletOpen(false)} aria-label="Close" autoFocus><X size={18} /></button><span className="eyebrow"><Wallet size={13} /> Wallet</span><h2 id="wallet-title">{t.walletTitle}</h2><p>{t.walletHint}</p><div className="wallet-options">{networks.map(network => <button key={network.id} onClick={() => connectWallet(network.id)}><span className={`network-icon ${network.id}`}>{network.symbol[0]}</span><span>{network.label}</span><ArrowUpRight size={15} /></button>)}</div><div className="wallet-divider"><span>{language === 'fr' ? 'ou' : 'or'}</span></div><button className="wallet-create-button" onClick={() => { setWalletOpen(false); setCreateOpen(true) }}><KeyRound size={16} />{language === 'fr' ? 'Créer / importer un wallet chiffré' : 'Create / import an encrypted wallet'}</button></section></div>}

    {depositOpen && <div className="wallet-modal-backdrop" role="presentation" onClick={() => setDepositOpen(false)}><section className="wallet-modal" role="dialog" aria-modal="true" aria-labelledby="deposit-title" onClick={e => e.stopPropagation()}><button className="wallet-close" onClick={() => setDepositOpen(false)} aria-label={t.depositClose} autoFocus><X size={18} /></button><span className="eyebrow"><ArrowDownToLine size={13} /> {t.deposit}</span><h2 id="deposit-title">{t.depositTitle}</h2><p>{t.depositHint}</p><div className="deposit-options">{treasury.map(entry => <div key={entry.network} className="deposit-row"><span className={`network-icon ${entry.network}`}>{entry.symbol[0]}</span><div className="deposit-info"><b>{entry.symbol}</b><code title={entry.address}>{entry.configured ? entry.address : '—'}</code></div>{entry.configured && <div className="deposit-actions"><button type="button" className="wc-mini-button" onClick={() => handleCopy(entry.network, entry.address)}>{copiedKey === entry.network ? <Check size={13} /> : <Copy size={13} />}{copiedKey === entry.network ? t.copied : t.copy}</button><a className="wc-mini-button" href={entry.explorerUrl} target="_blank" rel="noreferrer" aria-label="Explorer"><ExternalLink size={13} /></a></div>}</div>)}{treasuryLoaded && !treasury.some(entry => entry.configured) && <p className="wc-hint">{t.depositEmpty}</p>}</div><p className="deposit-note">{t.depositNote}</p></section></div>}

    {proofOpen && fairProof && <div className="wallet-modal-backdrop" role="presentation" onClick={() => setProofOpen(false)}><section className="wallet-modal help-modal" role="dialog" aria-modal="true" aria-labelledby="proof-title" onClick={e => e.stopPropagation()}><button className="wallet-close" onClick={() => setProofOpen(false)} aria-label="Close" autoFocus><X size={18} /></button><span className="eyebrow">{fairProof.valid ? <CheckCircle2 size={13} /> : <XCircle size={13} />} {language === 'fr' ? 'Preuve provably fair' : 'Provably fair proof'}</span><h2 id="proof-title">{fairProof.valid ? (language === 'fr' ? 'Preuve valide — résultat vérifié' : 'Valid proof — result verified') : (language === 'fr' ? 'Preuve non vérifiée' : 'Proof not verified')}</h2><ul className="proof-list"><li><span>Server seed</span><code>{fairProof.serverSeed}</code></li><li><span>SHA-256 (server seed)</span><code>{fairProof.serverSeedHash}</code></li><li><span>Client seed</span><code>{fairProof.clientSeed}</code></li><li><span>Nonce</span><code>{fairProof.nonce}</code></li><li><span>{language === 'fr' ? 'Résultat' : 'Result'}</span><code>{fairProof.value}</code></li></ul></section></div>}

    {createOpen && <WalletCreateModal language={language} onClose={() => setCreateOpen(false)} onUse={created => { setWallet({ network: created.network, address: created.address }); setSignatureStatus('idle'); setCreateOpen(false) }} />}

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
          <div><strong>0.8s</strong><span>Withdrawal time</span></div>
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

            <label>{t.bet} <span>{t.balance}: {balance.toFixed(3)} {symbol}</span></label>
            <div className="bet-input">
              <input value={bet} onChange={e => setBet(e.target.value)} inputMode="decimal" aria-label="Bet amount" aria-invalid={!stakeValid} />
              <span>{symbol}</span>
              <button onClick={() => setBet(balance.toFixed(3))}>MAX</button>
            </div>
            <div className="bet-presets">
              {presets.map(value => <button key={value} onClick={() => setBet(value)} disabled={Number(value) > balance} className={bet === value ? 'active' : ''}>{value}</button>)}
            </div>
            {!stakeValid && <p className="bet-error">{language === 'fr' ? 'Mise invalide : choisissez un montant supérieur à 0 et inférieur ou égal à votre solde.' : 'Invalid bet: choose an amount above 0 and no more than your balance.'}</p>}

            <button className="roll-button" onClick={rollDice} disabled={rolling || !stakeValid}><Dice5 size={18} />{rolling ? t.rolling : t.roll}<span>→</span></button>
            {wallet && <button className="sign-button" onClick={signWallet} disabled={signatureStatus === 'signing'}>{signatureStatus === 'signed' ? t.signed : signatureStatus === 'error' ? t.signError : signatureStatus === 'signing' ? t.signing : t.sign}</button>}

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
        {[{ icon: ShieldCheck, title: 'Provably fair', text: 'Every result is verifiable on-chain.' }, { icon: Zap, title: 'Instant', text: 'Deposits and withdrawals without waiting.' }, { icon: Trophy, title: 'Rewards', text: 'Earn more with every session.' }].map(({ icon: Icon, title, text }) => <div key={title} className="trust-item"><Icon size={20} /><div><h3>{title}</h3><p>{text}</p></div></div>)}
      </div>
    </section>

    <section className="mx-auto max-w-[1240px] px-5 py-20 lg:px-8 lg:py-28">
      <div className="mb-9 flex items-end justify-between"><div><span className="section-label">{t.latest}</span><h2 className="section-title">{t.title}</h2></div></div>
      <div className="roll-list">
        {rolls.length === 0 && <p className="roll-empty">{language === 'fr' ? 'Chargement des dernières parties…' : 'Loading recent rolls…'}</p>}
        {rolls.map((roll, index) => <div className="roll-row" key={`${roll.createdAt}-${index}`}><div className="mini-die">{roll.value}</div><div className="roll-info"><b>Dice Classic</b><span>{now ? formatRelative(roll.createdAt, language) : '—'} · {roll.player}</span></div><span className={`roll-status ${roll.tone}`}>{language === 'fr' ? roll.status : roll.tone === 'win' ? 'Won' : 'Lost'}</span><strong className={roll.tone}>{roll.amount}</strong></div>)}
      </div>
    </section>

    <footer className="border-t border-[#183126] px-5 py-8 lg:px-8"><div className="mx-auto flex max-w-[1240px] justify-between gap-5 text-[11px] text-[#71837a]"><span>© 2026 Rollbit Protocol. {t.responsible}</span><div className="flex gap-5"><Link href="/docs">Docs</Link><Link href="/discord">Discord</Link><Link href="/terms">Terms</Link></div></div></footer>
  </main>
}

export { DiceFace }
