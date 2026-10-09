'use client'

import { useEffect, useMemo, useState } from 'react'
import { ArrowLeft, Check, Copy, Eye, KeyRound, Loader2, ShieldAlert, Wallet, X } from 'lucide-react'
import { getOwnerId } from '@/lib/wallet/owner'
import { WALLET_NETWORKS } from '@/lib/wallet/networks'
import {
  WalletApiError,
  createWallet as apiCreateWallet,
  importWallet as apiImportWallet,
  listWallets as apiListWallets,
  revealWallet as apiRevealWallet,
  type PublicWallet,
  type Secret,
  type WalletNetwork,
  type WalletSecretType,
} from '@/lib/wallet/client'

type Language = 'fr' | 'en'

const networks = WALLET_NETWORKS

const text = {
  fr: {
    title: 'Wallets chiffrés',
    subtitle: 'Générez un nouveau wallet ou importez une phrase de récupération. Les secrets sont chiffrés au repos (AES-256-GCM).',
    create: 'Créer',
    import: 'Importer',
    network: 'Réseau',
    label: 'Nom (optionnel)',
    passphrase: 'Phrase secrète (optionnel)',
    passphraseHint: 'Si définie, elle est requise pour révéler le wallet.',
    importPlaceholder: 'phrase de récupération (12/24 mots) ou clé privée',
    generate: 'Générer le wallet',
    importing: 'Import en cours...',
    generating: 'Génération...',
    backupTitle: 'Sauvegardez ces informations',
    backupHint: 'Affichées une seule fois. Ne les partagez avec personne. Sans elles, le wallet est irrécupérable.',
    phrase: 'Phrase de récupération',
    privateKey: 'Clé privée',
    copy: 'Copier',
    copied: 'Copié',
    address: 'Adresse',
    back: 'Retour',
    done: "J'ai sauvegardé, connecter ce wallet",
    myWallets: 'Mes wallets chiffrés',
    empty: 'Aucun wallet pour le moment.',
    reveal: 'Révéler',
    unlock: 'Déverrouiller',
    passRequired: 'Phrase secrète requise',
    invalidPass: 'Phrase secrète invalide.',
    error: 'Une erreur est survenue.',
    close: 'Fermer',
    notConfigured: 'Service wallet non configuré : définissez MASTER_ENCRYPTION_KEY.',
  },
  en: {
    title: 'Encrypted wallets',
    subtitle: 'Generate a new wallet or import a recovery phrase. Secrets are encrypted at rest (AES-256-GCM).',
    create: 'Create',
    import: 'Import',
    network: 'Network',
    label: 'Name (optional)',
    passphrase: 'Passphrase (optional)',
    passphraseHint: 'If set, it is required to reveal the wallet.',
    importPlaceholder: 'recovery phrase (12/24 words) or private key',
    generate: 'Generate wallet',
    importing: 'Importing...',
    generating: 'Generating...',
    backupTitle: 'Back up this information',
    backupHint: 'Shown only once. Never share it. Without it the wallet is unrecoverable.',
    phrase: 'Recovery phrase',
    privateKey: 'Private key',
    copy: 'Copy',
    copied: 'Copied',
    address: 'Address',
    back: 'Back',
    done: 'I saved it, connect this wallet',
    myWallets: 'My encrypted wallets',
    empty: 'No wallet yet.',
    reveal: 'Reveal',
    unlock: 'Unlock',
    passRequired: 'Passphrase required',
    invalidPass: 'Invalid passphrase.',
    error: 'Something went wrong.',
    close: 'Close',
    notConfigured: 'Wallet service not configured: set MASTER_ENCRYPTION_KEY.',
  },
} as const

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

function shortAddress(address: string): string {
  if (address.length <= 14) return address
  return `${address.slice(0, 6)}…${address.slice(-4)}`
}

export default function WalletCreateModal({ language, onClose, onUse }: { language: Language; onClose: () => void; onUse: (wallet: { network: WalletNetwork; address: string }) => void }) {
  const t = text[language]
  const ownerId = useMemo(() => getOwnerId(), [])
  const [mode, setMode] = useState<'create' | 'import'>('create')
  const [network, setNetwork] = useState<WalletNetwork>('ethereum')
  const [label, setLabel] = useState('')
  const [passphrase, setPassphrase] = useState('')
  const [secretType, setSecretType] = useState<WalletSecretType>('mnemonic')
  const [secretInput, setSecretInput] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [configured, setConfigured] = useState(true)
  const [wallets, setWallets] = useState<PublicWallet[]>([])
  const [result, setResult] = useState<{ wallet: PublicWallet; secret: Secret } | null>(null)
  const [revealed, setRevealed] = useState<{ wallet: PublicWallet; secret: Secret } | null>(null)
  const [revealTarget, setRevealTarget] = useState<PublicWallet | null>(null)
  const [revealPassphrase, setRevealPassphrase] = useState('')
  const [copiedKey, setCopiedKey] = useState('')

  async function loadWallets() {
    try {
      const data = await apiListWallets(ownerId)
      setWallets(data.wallets)
      setConfigured(data.configured)
    } catch { /* list is best-effort */ }
  }

  useEffect(() => { void loadWallets() }, [])

  async function submit() {
    setBusy(true)
    setError('')
    try {
      const common = { network, ownerId, passphrase: passphrase || undefined, label: label || undefined }
      const data = mode === 'create'
        ? await apiCreateWallet(common)
        : await apiImportWallet({ ...common, secret: secretInput, type: secretType })
      setResult({ wallet: data.wallet, secret: data.secret })
      setSecretInput('')
      setPassphrase('')
      setLabel('')
      await loadWallets()
    } catch (caught) {
      if (caught instanceof WalletApiError && caught.status === 503) setConfigured(false)
      setError(caught instanceof WalletApiError ? caught.message : t.error)
    } finally {
      setBusy(false)
    }
  }

  async function doReveal(target: PublicWallet, passphraseValue = revealPassphrase) {
    setError('')
    if (target.passphraseRequired && !passphraseValue) {
      setError(t.passRequired)
      return
    }
    setBusy(true)
    try {
      const data = await apiRevealWallet({ walletId: target.walletId, ownerId, passphrase: passphraseValue || undefined })
      setRevealed({ wallet: data.wallet, secret: data.secret })
      setRevealTarget(null)
      setRevealPassphrase('')
    } catch (caught) {
      setError(caught instanceof WalletApiError && caught.status === 401 ? t.invalidPass : caught instanceof WalletApiError ? caught.message : t.error)
    } finally {
      setBusy(false)
    }
  }

  function handleRevealClick(wallet: PublicWallet) {
    setError('')
    if (wallet.passphraseRequired) {
      setRevealTarget(wallet)
      setRevealPassphrase('')
      return
    }
    void doReveal(wallet, '')
  }

  async function handleCopy(key: string, value: string) {
    if (await copyText(value)) {
      setCopiedKey(key)
      window.setTimeout(() => setCopiedKey(current => (current === key ? '' : current)), 1500)
    }
  }

  function reset() {
    setResult(null)
    setRevealed(null)
    setError('')
  }

  const activeSecret = result?.secret ?? revealed?.secret ?? null
  const activeWallet = result?.wallet ?? revealed?.wallet ?? null

  return <div className="wallet-modal-backdrop" role="presentation" onClick={onClose}>
    <section className="wallet-modal wallet-create-modal" role="dialog" aria-modal="true" aria-labelledby="wc-title" onClick={e => e.stopPropagation()}>
      <button className="wallet-close" onClick={onClose} aria-label={t.close} autoFocus><X size={18} /></button>

      {!configured && <p className="wallet-config-warning"><ShieldAlert size={15} /> {t.notConfigured}</p>}

      {activeWallet && activeSecret ? <>
        <span className="eyebrow"><ShieldAlert size={13} /> {t.backupTitle}</span>
        <h2 id="wc-title">{shortAddress(activeWallet.address)}</h2>
        <p>{t.backupHint}</p>
        <div className="secret-block">
          <div className="secret-head"><span>{activeSecret.mnemonic ? t.phrase : t.privateKey}</span>
            <button type="button" onClick={() => handleCopy('main', activeSecret.mnemonic ?? activeSecret.privateKey)}>{copiedKey === 'main' ? <Check size={13} /> : <Copy size={13} />}{copiedKey === 'main' ? t.copied : t.copy}</button>
          </div>
          {activeSecret.mnemonic
            ? <div className="mnemonic-grid">{activeSecret.mnemonic.split(' ').map((word, index) => <span key={`${word}-${index}`}><i>{index + 1}</i>{word}</span>)}</div>
            : <code className="secret-code">{activeSecret.privateKey}</code>}
        </div>
        <div className="secret-block">
          <div className="secret-head"><span>{t.address}</span><button type="button" onClick={() => handleCopy('address', activeWallet.address)}>{copiedKey === 'address' ? <Check size={13} /> : <Copy size={13} />}{copiedKey === 'address' ? t.copied : t.copy}</button></div>
          <code className="secret-code">{activeWallet.address}</code>
        </div>
        {activeSecret.mnemonic && <details className="secret-details"><summary>{t.privateKey}</summary><code className="secret-code">{activeSecret.privateKey}</code><button type="button" onClick={() => handleCopy('pk', activeSecret.privateKey)}>{copiedKey === 'pk' ? <Check size={13} /> : <Copy size={13} />}{copiedKey === 'pk' ? t.copied : t.copy}</button></details>}
        <div className="wallet-create-actions">
          <button type="button" className="sign-button" onClick={reset}><ArrowLeft size={14} /> {t.back}</button>
          <button type="button" className="roll-button" onClick={() => { onUse({ network: activeWallet.network, address: activeWallet.address }); onClose() }}>{t.done}</button>
        </div>
      </> : <>
        <span className="eyebrow"><KeyRound size={13} /> {t.title}</span>
        <h2 id="wc-title">{t.title}</h2>
        <p>{t.subtitle}</p>

        <div className="bet-presets wallet-mode-tabs">
          <button className={mode === 'create' ? 'active' : ''} onClick={() => { setMode('create'); setError('') }}>{t.create}</button>
          <button className={mode === 'import' ? 'active' : ''} onClick={() => { setMode('import'); setError('') }}>{t.import}</button>
        </div>

        <label className="wc-label">{t.network}</label>
        <div className="network-select">
          {networks.map(item => <button key={item.id} type="button" className={network === item.id ? 'active' : ''} onClick={() => setNetwork(item.id)}><span className={`network-icon ${item.id}`}>{item.symbol[0]}</span>{item.symbol}</button>)}
        </div>

        {mode === 'import' && <>
          <div className="bet-presets wallet-mode-tabs">
            <button className={secretType === 'mnemonic' ? 'active' : ''} onClick={() => setSecretType('mnemonic')}>{t.phrase}</button>
            <button className={secretType === 'privateKey' ? 'active' : ''} onClick={() => setSecretType('privateKey')}>{t.privateKey}</button>
          </div>
          <textarea className="wc-input wc-textarea" value={secretInput} onChange={e => setSecretInput(e.target.value)} placeholder={t.importPlaceholder} rows={3} spellCheck={false} />
        </>}

        <label className="wc-label">{t.label}</label>
        <input className="wc-input" value={label} onChange={e => setLabel(e.target.value)} maxLength={40} placeholder={mode === 'create' ? 'Main wallet' : 'Imported wallet'} />

        <label className="wc-label">{t.passphrase}</label>
        <input className="wc-input" type="password" value={passphrase} onChange={e => setPassphrase(e.target.value)} placeholder="••••••••" autoComplete="new-password" />
        <p className="wc-hint">{t.passphraseHint}</p>

        {error && <p className="bet-error">{error}</p>}

        <button type="button" className="roll-button" onClick={submit} disabled={busy || !configured || (mode === 'import' && !secretInput.trim())}>
          {busy ? <Loader2 size={16} className="spin" /> : <Wallet size={16} />}
          {busy ? (mode === 'create' ? t.generating : t.importing) : (mode === 'create' ? t.generate : t.import)}
        </button>

        <div className="wc-list">
          <span className="wc-list-title">{t.myWallets}</span>
          {wallets.length === 0 && <p className="wc-hint">{t.empty}</p>}
          {wallets.map(wallet => <div key={wallet.walletId} className="wc-list-item">
            <span className={`network-icon ${wallet.network}`}>{networks.find(item => item.id === wallet.network)?.symbol[0]}</span>
            <div className="wc-list-info"><b>{wallet.label || shortAddress(wallet.address)}</b><span>{shortAddress(wallet.address)}</span></div>
            {revealTarget?.walletId === wallet.walletId
              ? <div className="wc-reveal"><input className="wc-input wc-input-sm" type="password" value={revealPassphrase} onChange={e => setRevealPassphrase(e.target.value)} placeholder="••••" autoFocus onKeyDown={e => { if (e.key === 'Enter') void doReveal(wallet) }} /><button type="button" className="wc-mini-button" onClick={() => doReveal(wallet)} disabled={busy}>{t.unlock}</button></div>
              : <button type="button" className="wc-mini-button" onClick={() => handleRevealClick(wallet)} disabled={busy}><Eye size={13} /> {t.reveal}</button>}
          </div>)}
        </div>
      </>}
    </section>
  </div>
}
