'use client'

import { useState } from 'react'
import { ArrowUpRight, CircleHelp, Dice5, ExternalLink, Menu, ShieldCheck, Sparkles, Trophy, Wallet, X, Zap } from 'lucide-react'

const navItems = ['Jeux', 'Provably Fair', 'Récompenses']
const recentRolls = [
  { value: 6, status: 'Gagné', amount: '+0.024 ETH', tone: 'win' },
  { value: 2, status: 'Perdu', amount: '-0.010 ETH', tone: 'loss' },
  { value: 5, status: 'Gagné', amount: '+0.018 ETH', tone: 'win' },
]

function DiceFace({ value, rolling }: { value: number; rolling?: boolean }) {
  const dots: Record<number, number[]> = { 1: [4], 2: [0, 8], 3: [0, 4, 8], 4: [0, 2, 6, 8], 5: [0, 2, 4, 6, 8], 6: [0, 2, 3, 5, 6, 8] }
  return (
    <div className={`dice-face ${rolling ? 'dice-rolling' : ''}`} aria-label={`Dé affichant ${value}`}>
      {Array.from({ length: 9 }, (_, index) => <span key={index} className={dots[value].includes(index) ? 'dot' : ''} />)}
    </div>
  )
}

export default function Page() {
  const [connected, setConnected] = useState(false)
  const [rolling, setRolling] = useState(false)
  const [result, setResult] = useState(6)
  const [bet, setBet] = useState('0.01')
  const [menuOpen, setMenuOpen] = useState(false)

  function rollDice() {
    if (rolling) return
    setRolling(true)
    window.setTimeout(() => {
      setResult(Math.floor(Math.random() * 6) + 1)
      setRolling(false)
    }, 700)
  }

  return (
    <main className="min-h-screen overflow-hidden bg-[#07110f] text-[#f4f4ed] selection:bg-[#bbf7d0] selection:text-[#07110f]">
      <div className="noise" aria-hidden="true" />
      <header className="relative z-10 mx-auto flex max-w-[1240px] items-center justify-between px-5 py-5 lg:px-8">
        <a className="flex items-center gap-2.5" href="#top" aria-label="Rollbit accueil">
          <span className="brand-mark"><Dice5 size={20} strokeWidth={2.5} /></span>
          <span className="font-mono text-[15px] font-bold tracking-[0.2em] text-white">ROLL<span className="text-[#b7f34a]">BIT</span></span>
        </a>
        <nav className="hidden items-center gap-9 text-[13px] text-[#aab7ad] md:flex">
          {navItems.map((item, i) => <a key={item} href={`#${i === 0 ? 'game' : 'trust'}`} className="transition-colors hover:text-white">{item}</a>)}
        </nav>
        <div className="flex items-center gap-3">
          <span className="hidden items-center gap-1.5 text-[11px] text-[#84988b] sm:flex"><span className="live-dot" />Réseau actif</span>
          <button className="connect-button" onClick={() => setConnected(!connected)}><Wallet size={15} />{connected ? '0x71...8A2F' : 'Connecter'}</button>
          <button className="menu-button md:hidden" aria-label="Ouvrir le menu" onClick={() => setMenuOpen(!menuOpen)}>{menuOpen ? <X size={18} /> : <Menu size={18} />}</button>
        </div>
        {menuOpen && <div className="absolute left-5 right-5 top-16 flex flex-col gap-4 rounded-2xl border border-[#254035] bg-[#0c1c17] p-5 text-sm md:hidden">{navItems.map(item => <a key={item} href="#game" onClick={() => setMenuOpen(false)}>{item}</a>)}</div>}
      </header>

      <section id="top" className="relative mx-auto grid max-w-[1240px] items-center gap-14 px-5 pb-20 pt-12 lg:grid-cols-[1fr_0.84fr] lg:px-8 lg:pb-28 lg:pt-24">
        <div className="orb orb-one" aria-hidden="true" /><div className="orb orb-two" aria-hidden="true" />
        <div className="relative z-[1]">
          <div className="eyebrow"><Sparkles size={13} /> Le casino on-chain, réinventé</div>
          <h1>Jouez juste.<br /><em>Gagnez vrai.</em></h1>
          <p className="hero-copy">Le casino crypto transparent, rapide et conçu pour les joueurs qui veulent garder le contrôle.</p>
          <div className="flex flex-wrap items-center gap-4">
            <a className="primary-button" href="#game">Lancer les dés <ArrowUpRight size={17} /></a>
            <a className="secondary-link" href="#trust">Découvrir Rollbit <span>↗</span></a>
          </div>
          <div className="hero-stats"><div><strong>100%</strong><span>Provably fair</span></div><div><strong>0.8s</strong><span>Temps de retrait</span></div><div><strong>24/7</strong><span>Support humain</span></div></div>
        </div>
        <div id="game" className="relative z-[1]">
          <div className="game-card">
            <div className="game-head"><div><span className="game-kicker"><span className="live-dot" />EN DIRECT</span><h2>Dice <span>/</span> Classic</h2></div><button className="icon-button" aria-label="Aide"><CircleHelp size={18} /></button></div>
            <div className="roll-stage"><div className="stage-glow" /><DiceFace value={result} rolling={rolling} /><div className="chance-badge"><span>Chance de gagner</span><b>50.00%</b></div></div>
            <div className="game-form"><label>Mise <span>Solde: 0.247 ETH</span></label><div className="bet-input"><input value={bet} onChange={e => setBet(e.target.value)} inputMode="decimal" aria-label="Montant de la mise" /><span>ETH</span><button onClick={() => setBet('0.247')}>MAX</button></div><div className="bet-presets">{['0.01', '0.05', '0.1', '0.25'].map(value => <button key={value} onClick={() => setBet(value)} className={bet === value ? 'active' : ''}>{value}</button>)}</div><button className="roll-button" onClick={rollDice} disabled={rolling}><Dice5 size={18} />{rolling ? 'Lancement...' : 'Lancer le dé'}<span>→</span></button></div>
            <div className="game-foot"><span><ShieldCheck size={14} /> Fairness vérifiée</span><a href="#trust">Comment ça marche <ExternalLink size={12} /></a></div>
          </div>
          <div className="floating-pill"><span className="avatar-stack"><i /><i /><i /></span><span><b>1,284</b> joueurs en ligne</span></div>
        </div>
      </section>

      <section id="trust" className="relative border-y border-[#183126] bg-[#091713]">
        <div className="mx-auto grid max-w-[1240px] gap-px px-5 lg:grid-cols-3 lg:px-8">
          {[{ icon: ShieldCheck, title: 'Provably fair', text: 'Chaque résultat est vérifiable on-chain.' }, { icon: Zap, title: 'Instantané', text: 'Dépôts et retraits sans attente.' }, { icon: Trophy, title: 'Récompenses', text: 'Gagnez plus à chaque session.' }].map(({ icon: Icon, title, text }) => <div key={title} className="trust-item"><Icon size={20} /><div><h3>{title}</h3><p>{text}</p></div></div>)}
        </div>
      </section>

      <section className="mx-auto max-w-[1240px] px-5 py-20 lg:px-8 lg:py-28"><div className="mb-9 flex items-end justify-between"><div><span className="section-label">Dernières parties</span><h2 className="section-title">La chance tourne vite.</h2></div><a className="secondary-link hidden sm:flex" href="#game">Voir l&apos;activité <ArrowUpRight size={15} /></a></div><div className="roll-list">{recentRolls.map((roll, index) => <div className="roll-row" key={index}><div className="mini-die">{roll.value}</div><div className="roll-info"><b>Dice Classic</b><span>Il y a {index + 1} min · Joueur 0x{index === 0 ? '71...8A2F' : index === 1 ? 'A4...19D0' : 'C8...0B44'}</span></div><span className={`roll-status ${roll.tone}`}>{roll.status}</span><strong className={roll.tone}>{roll.amount}</strong></div>)}</div></section>
      <footer className="border-t border-[#183126] px-5 py-8 lg:px-8"><div className="mx-auto flex max-w-[1240px] flex-col justify-between gap-5 text-[11px] text-[#71837a] sm:flex-row"><span>© 2024 Rollbit Protocol. Jouez de façon responsable.</span><div className="flex gap-5"><a href="#trust">Docs</a><a href="#trust">Discord</a><a href="#trust">Conditions</a></div></div></footer>
    </main>
  )
}

export { DiceFace }
