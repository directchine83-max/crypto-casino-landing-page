export type WalletNetwork = 'ethereum' | 'solana' | 'bitcoin'

export type WalletSecretType = 'mnemonic' | 'privateKey'

export type DerivedWallet = {
  network: WalletNetwork
  address: string
  privateKey: string
  path: string
}

export type Secret = { mnemonic: string | null; privateKey: string }

export type PublicWallet = {
  walletId: string
  network: WalletNetwork
  address: string
  path: string
  label: string
  passphraseRequired: boolean
  createdAt: number
}
