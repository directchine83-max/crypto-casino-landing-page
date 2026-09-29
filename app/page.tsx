'use client'

import { useState } from 'react'
import { ArrowUpRight, CircleHelp, Dice5, ExternalLink, Menu, ShieldCheck, Sparkles, Trophy, Wallet, X, Zap } from 'lucide-react'

type Language = 'fr' | 'en'
type Network = 'ethereum' | 'solana' | 'bitcoin'

declare global {
  interface Window {
    ethereum?: { request: (args: { method: string }) => Promise<string[] | string> }
    solana?: { connect: () => Promise<{ publicKey: { toString: () => string } }> }
    unisat?: { requestAccounts: () => Promise<string[]> }
  }
}

const copy = {
  fr: { nav: ['Jeux', 'Provably Fair', 'Récompenses'], connect: 'Connecter', connected: 'Connecté', eyebrow: 'Le casino on-chain, réinventé', hero: 'Jouez juste.', hero2: 'Gagnez vrai.', intro: 'Le casino crypto transparent, rapide et conçu pour les joueurs qui veulent garder le contrôle.', play: 'Lancer les dés', discover: 'Découvrir Rollbit', live: 'Réseau actif', bet: 'Mise', balance: 'Solde', roll: 'Lancer le dé', rolling: 'Lancement...', chance: 'Chance de gagner', fair: 'Fairness vérifiée', how: 'Comment ça marche', latest: 'Dernières parties', title: 'La chance tourne vite.', online: 'joueurs en ligne', responsible: 'Jouez de façon responsable.', walletTitle: 'Choisissez votre réseau', walletHint: 'Connexion non-custodiale via votre wallet navigateur.' },
  en: { nav: ['Games', 'Provably Fair', 'Rewards'], connect: 'Connect', connected: 'Connected', eyebrow: 'The on-chain casino, reimagined', hero: 'Play fair.', hero2: 'Win real.', intro: 'The transparent, fast crypto casino built for players who stay in control.', play: 'Roll the dice', discover: 'Discover Rollbit', live: 'Network live', bet: 'Bet', balance: 'Balance', roll: 'Roll dice', rolling: 'Rolling...', chance: 'Win chance', fair: 'Fairness verified', how: 'How it works', latest: 'Recent rolls', title: 'Luck moves fast.', online: 'players online', responsible: 'Play responsibly.', walletTitle: 'Choose your network', walletHint: 'Non-custodial connection through your browser wallet.' },
}

const networks: { id: Network; label: string; symbol: string }[] = [{ id: 'ethereum', label: 'Ethereum', symbol: 'ETH' }, { id: 'solana', label: 'Solana', symbol: 'SOL' }, { id: 'bitcoin', label: 'Bitcoin', symbol: 'BTC' }]
const recentRolls = [{ value: 6, status: 'Gagné', amount: '+0.024 ETH', tone: 'win' }, { value: 2, status: 'Perdu', amount: '-0.010 ETH', tone: 'loss' }, { value: 5, status: 'Gagné', amount: '+0.018 ETH', tone: 'win' }]

function DiceFace({ value, rolling }: { value: number; rolling?: boolean }) {
  const dots: Record<number, number[]> = { 1: [4], 2: [0, 8], 3: [0, 4, 8], 4: [0, 2, 6, 8], 5: [0, 2, 4, 6, 8], 6: [0, 2, 3, 5, 6, 8] }
  return <div className={`dice-face ${rolling ? 'dice-rolling' : ''}`} aria-label={`Dice showing ${value}`}>{Array.from({ length: 9 }, (_, index) => <span key={index} className={dots[value].includes(index) ? 'dot' : ''} />)}</div>
}

export default function Page() {
  const [language, setLanguage] = useState<Language>('fr')
  const [walletOpen, setWalletOpen] = useState(false)
  const [wallet, setWallet] = useState<{ network: Network; address: string } | null>(null)
  const [rolling, setRolling] = useState(false)
  const [result, setResult] = useState(6)
  const [bet, setBet] = useState('0.01')
  const [menuOpen, setMenuOpen] = useState(false)
  const t = copy[language]

  async function connectWallet(network: Network) {
    try {
      let address = ''
      if (network === 'ethereum' && window.ethereum) address = String((await window.ethereum.request({ method: 'eth_requestAccounts' }) as string[])[0])
      if (network === 'solana' && window.solana) address = (await window.solana.connect()).publicKey.toString()
      if (network === 'bitcoin' && window.unisat) address = (await window.unisat.requestAccounts())[0]
      if (!address) { window.alert(language === 'fr' ? 'Installez un wallet compatible pour continuer.' : 'Install a compatible wallet to continue.'); return }
      await fetch('/api/wallets', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ network, address }) })
      setWallet({ network, address }); setWalletOpen(false)
    } catch { window.alert(language === 'fr' ? 'Connexion annulée.' : 'Connection cancelled.') }
  }

  function rollDice() { if (rolling) return; setRolling(true); window.setTimeout(() => { setResult(Math.floor(Math.random() * 6) + 1); setRolling(false) }, 700) }
  const shortAddress = wallet ? `${wallet.address.slice(0, 5)}...${wallet.address.slice(-4)}` : t.connect

  return <main className="min-h-screen overflow-hidden bg-[#07110f] text-[#f4f4ed] selection:bg-[#bbf7d0] selection:text-[#07110f]"><div className="noise" aria-hidden="true" />
    <header className="relative z-10 mx-auto flex max-w-[1240px] items-center justify-between px-5 py-5 lg:px-8"><a className="flex items-center gap-2.5" href="#top"><span className="brand-mark"><Dice5 size={20} /></span><span className="font-mono text-[15px] font-bold tracking-[0.2em] text-white">ROLL<span className="text-[#b7f34a]">BIT</span></span></a><nav className="hidden items-center gap-9 text-[13px] text-[#aab7ad] md:flex">{t.nav.map((item, i) => <a key={item} href={`#${i === 0 ? 'game' : 'trust'}`}>{item}</a>)}</nav><div className="flex items-center gap-3"><span className="hidden items-center gap-1.5 text-[11px] text-[#84988b] sm:flex"><span className="live-dot" />{t.live}</span><button className="language-button" onClick={() => setLanguage(language === 'fr' ? 'en' : 'fr')} aria-label="Switch language">{language.toUpperCase()}</button><button className="connect-button" onClick={() => setWalletOpen(true)}><Wallet size={15} />{shortAddress}</button><button className="menu-button md:hidden" aria-label="Menu" onClick={() => setMenuOpen(!menuOpen)}>{menuOpen ? <X size={18} /> : <Menu size={18} />}</button></div>{menuOpen && <div className="absolute left-5 right-5 top-16 flex flex-col gap-4 rounded-2xl border border-[#254035] bg-[#0c1c17] p-5 text-sm md:hidden">{t.nav.map(item => <a key={item} href="#game" onClick={() => setMenuOpen(false)}>{item}</a>)}</div>}</header>
    {walletOpen && <div className="wallet-modal-backdrop" role="presentation" onClick={() => setWalletOpen(false)}><section className="wallet-modal" role="dialog" aria-modal="true" aria-labelledby="wallet-title" onClick={e => e.stopPropagation()}><button className="wallet-close" onClick={() => setWalletOpen(false)} aria-label="Close"><X size={18} /></button><span className="eyebrow"><Wallet size={13} /> Wallet</span><h2 id="wallet-title">{t.walletTitle}</h2><p>{t.walletHint}</p><div className="wallet-options">{networks.map(network => <button key={network.id} onClick={() => connectWallet(network.id)}><span className={`network-icon ${network.id}`}>{network.symbol[0]}</span><span>{network.label}</span><ArrowUpRight size={15} /></button>)}</div></section></div>}
    <section id="top" className="relative mx-auto grid max-w-[1240px] items-center gap-14 px-5 pb-20 pt-12 lg:grid-cols-[1fr_0.84fr] lg:px-8 lg:pb-28 lg:pt-24"><div className="orb orb-one" /><div className="orb orb-two" /><div className="relative z-[1]"><div className="eyebrow"><Sparkles size={13} /> {t.eyebrow}</div><h1>{t.hero}<br /><em>{t.hero2}</em></h1><p className="hero-copy">{t.intro}</p><div className="flex flex-wrap items-center gap-4"><a className="primary-button" href="#game">{t.play} <ArrowUpRight size={17} /></a><a className="secondary-link" href="#trust">{t.discover} <span>↗</span></a></div><div className="hero-stats"><div><strong>100%</strong><span>Provably fair</span></div><div><strong>0.8s</strong><span>Withdrawal time</span></div><div><strong>24/7</strong><span>Human support</span></div></div></div>
      <div id="game" className="relative z-[1]"><div className="game-card"><div className="game-head"><div><span className="game-kicker"><span className="live-dot" />LIVE</span><h2>Dice <span>/</span> Classic</h2></div><button className="icon-button" aria-label="Help"><CircleHelp size={18} /></button></div><div className="roll-stage"><div className="stage-glow" /><DiceFace value={result} rolling={rolling} /><div className="chance-badge"><span>{t.chance}</span><b>50.00%</b></div></div><div className="game-form"><label>{t.bet} <span>{t.balance}: 0.247 ETH</span></label><div className="bet-input"><input value={bet} onChange={e => setBet(e.target.value)} inputMode="decimal" aria-label="Bet amount" /><span>ETH</span><button onClick={() => setBet('0.247')}>MAX</button></div><div className="bet-presets">{['0.01', '0.05', '0.1', '0.25'].map(value => <button key={value} onClick={() => setBet(value)} className={bet === value ? 'active' : ''}>{value}</button>)}</div><button className="roll-button" onClick={rollDice} disabled={rolling}><Dice5 size={18} />{rolling ? t.rolling : t.roll}<span>→</span></button></div><div className="game-foot"><span><ShieldCheck size={14} /> {t.fair}</span><a href="#trust">{t.how} <ExternalLink size={12} /></a></div></div><div className="floating-pill"><span className="avatar-stack"><i /><i /><i /></span><span><b>1,284</b> {t.online}</span></div></div></section>
    <section id="trust" className="relative border-y border-[#183126] bg-[#091713]"><div className="mx-auto grid max-w-[1240px] gap-px px-5 lg:grid-cols-3 lg:px-8">{[{ icon: ShieldCheck, title: 'Provably fair', text: 'Every result is verifiable on-chain.' }, { icon: Zap, title: 'Instant', text: 'Deposits and withdrawals without waiting.' }, { icon: Trophy, title: 'Rewards', text: 'Earn more with every session.' }].map(({ icon: Icon, title, text }) => <div key={title} className="trust-item"><Icon size={20} /><div><h3>{title}</h3><p>{text}</p></div></div>)}</div></section>
    <section className="mx-auto max-w-[1240px] px-5 py-20 lg:px-8 lg:py-28"><div className="mb-9 flex items-end justify-between"><div><span className="section-label">{t.latest}</span><h2 className="section-title">{t.title}</h2></div></div><div className="roll-list">{recentRolls.map((roll, index) => <div className="roll-row" key={index}><div className="mini-die">{roll.value}</div><div className="roll-info"><b>Dice Classic</b><span>{index + 1} min ago · Player 0x{index === 0 ? '71...8A2F' : index === 1 ? 'A4...19D0' : 'C8...0B44'}</span></div><span className={`roll-status ${roll.tone}`}>{language === 'fr' ? roll.status : roll.tone === 'win' ? 'Won' : 'Lost'}</span><strong className={roll.tone}>{roll.amount}</strong></div>)}</div></section><footer className="border-t border-[#183126] px-5 py-8 lg:px-8"><div className="mx-auto flex max-w-[1240px] justify-between gap-5 text-[11px] text-[#71837a]"><span>© 2024 Rollbit Protocol. {t.responsible}</span><div className="flex gap-5"><a href="#trust">Docs</a><a href="#trust">Discord</a><a href="#trust">Terms</a></div></div></footer></main>
}

export { DiceFace }
