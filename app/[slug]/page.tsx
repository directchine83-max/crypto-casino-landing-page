import Link from 'next/link'
import { ArrowLeft, ArrowUpRight, CheckCircle2, Dice5, ShieldCheck, Trophy, Wallet, Zap } from 'lucide-react'

const pages = {
  games: {
    eyebrow: 'Games',
    title: 'Simple games. Transparent odds.',
    text: 'Roll, verify, and play from one non-custodial interface. Every game is designed around clear rules and verifiable outcomes.',
    icon: Dice5,
    points: ['Dice Classic with instant results', 'Transparent odds before every roll', 'Play with ETH, SOL, or BTC wallets'],
  },
  'provably-fair': {
    eyebrow: 'Provably Fair',
    title: 'Trust every roll.',
    text: 'Rollbit combines a committed server seed, your client seed, and a nonce to generate outcomes you can independently verify.',
    icon: ShieldCheck,
    points: ['Server seeds are committed before play', 'Client seeds keep randomness in your hands', 'Results can be checked after every session'],
  },
  rewards: {
    eyebrow: 'Rewards',
    title: 'More play. More perks.',
    text: 'Your activity unlocks rewards without giving up custody of your assets. Keep your wallet connected and track your progress in one place.',
    icon: Trophy,
    points: ['Session-based rewards', 'Transparent reward criteria', 'Multi-network wallet support'],
  },
  docs: {
    eyebrow: 'Documentation',
    title: 'Everything in the open.',
    text: 'Learn how wallet connections, signatures, fairness proofs, and game outcomes work before you play.',
    icon: Zap,
    points: ['Wallet connection guide', 'Fairness verification reference', 'Network support and safety notes'],
  },
  discord: {
    eyebrow: 'Community',
    title: 'Join the conversation.',
    text: 'Meet other players, follow product updates, and get help from the Rollbit community.',
    icon: Wallet,
    points: ['Product announcements', 'Community support', 'Responsible play resources'],
  },
  terms: {
    eyebrow: 'Terms',
    title: 'Play with clarity.',
    text: 'Please review the terms, eligibility requirements, and responsible gaming guidance before using Rollbit.',
    icon: CheckCircle2,
    points: ['18+ only where legally permitted', 'Never wager more than you can afford to lose', 'Self-custody means you control your funds'],
  },
} as const

export default async function InfoPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const page = pages[slug as keyof typeof pages] ?? pages.games
  const Icon = page.icon

  return (
    <main className="min-h-screen bg-[#07110f] px-5 py-6 text-[#f4f4ed] lg:px-8">
      <div className="mx-auto flex max-w-[1080px] flex-col gap-16">
        <header className="flex items-center justify-between">
          <Link className="flex items-center gap-2.5" href="/"><span className="brand-mark"><Dice5 size={20} /></span><span className="font-mono text-[15px] font-bold tracking-[0.2em] text-white">ROLL<span className="text-[#b7f34a]">BIT</span></span></Link>
          <Link className="secondary-link" href="/"><ArrowLeft size={15} /> Back home</Link>
        </header>
        <section className="max-w-3xl pb-12 pt-12">
          <div className="eyebrow"><Icon size={13} /> {page.eyebrow}</div>
          <h1>{page.title}</h1>
          <p className="hero-copy max-w-2xl">{page.text}</p>
          <div className="mt-10 grid gap-3 sm:grid-cols-3">
            {page.points.map((point) => <div key={point} className="trust-item flex-col items-start gap-4 rounded-2xl border border-[#183126] bg-[#091713] p-5"><CheckCircle2 size={18} className="text-[#b7f34a]" /><span>{point}</span></div>)}
          </div>
          <Link className="primary-button mt-10 inline-flex" href="/?game=dice#game">Play Dice <ArrowUpRight size={17} /></Link>
        </section>
      </div>
    </main>
  )
}

export function generateStaticParams() { return Object.keys(pages).map((slug) => ({ slug })) }

export const dynamicParams = false
export const metadata = { title: 'Rollbit — Explore' }
