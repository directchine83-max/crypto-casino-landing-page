# crypto-casino-landing-page

This is a [Next.js](https://nextjs.org) project bootstrapped with [v0](https://v0.app).

## Built with v0

This repository is linked to a [v0](https://v0.app) project. You can continue developing by visiting the link below -- start new chats to make changes, and v0 will push commits directly to this repo. Every merge to `main` will automatically deploy.

[Continue working on v0 →](https://v0.app/chat/projects/prj_xTI4RLvTljSNstzizuahbdotwUMP)

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

## Learn More

To learn more, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.
- [v0 Documentation](https://v0.app/docs) - learn about v0 and how to use it.

## Wallet Solana non-custodial (signature côté joueur)

La dapp ne crée **aucun wallet** et ne stocke **aucune clé privée**. Le joueur
connecte son propre wallet navigateur (**Phantom**) ; la maison ne détient jamais
les clés. Inspiré de la gestion de wallet Solana (wallet adapter / `@solana/web3.js`).

Fonctions exposées :

- `GET /api/solana/balance?address=…` → solde on-chain (lamports + SOL) via RPC.
- `GET /api/solana/fees?address=…&amount=…` → estimation des frais réseau
  **à l'avance** (`getFeeForMessage` + frais de priorité optionnels).
- `POST /api/solana/transaction` → construit une transaction de transfert SOL
  **non signée** (base64) vers la trésorerie.
- `POST /api/solana/send` → relaie une transaction **déjà signée par le joueur**
  vers le réseau Solana.
- `POST /api/solana/verify` → vérifie une signature Ed25519 (preuve de
  propriété du wallet).
- `GET /api/solana/info` → configuration (cluster, trésorerie, activation).

Flux de mise :

1. Le serveur construit la transaction (montant + frais estimés).
2. Le joueur signe avec **Phantom** (côté navigateur uniquement).
3. Le navigateur renvoie la transaction signée à `/api/solana/send`.
4. Le serveur diffuse la transaction et confirme ; le résultat provably fair est
   résolu, puis le solde on-chain est rafraîchi.

Variables d'environnement :

| Variable                              | Défaut                             | Rôle                                              |
| ------------------------------------- | ---------------------------------- | ------------------------------------------------- |
| `SOLANA_RPC_URL`                      | `https://api.mainnet-beta.solana.com` | Endpoint RPC (solde, frais, diffusion).        |
| `SOLANA_NETWORK`                      | déduit de l'URL                    | `mainnet-beta` / `devnet` / `testnet` / `localnet`. |
| `SOLANA_TREASURY_ADDRESS`             | —                                  | Clé **publique** de réception des mises. Requis.  |
| `SOLANA_PRIORITY_FEE_MICROLAMPORTS`   | `0`                                | Frais de priorité (0 = aucun).                    |
| `SOLANA_SEND_ENABLED`                 | `true`                             | `false` = lecture seule (pas de diffusion).       |
| `SOLANA_RPC_TIMEOUT_MS`               | `20000`                            | Délai RPC.                                        |
| `HOUSE_EDGE_BPS`                      | `200`                              | Marge maison en points de base (max 2000).        |

> ⚠️ Ne mettez **jamais** de clé privée côté serveur : toutes les transactions
> sont signées par le wallet du joueur.

> ℹ️ D'autres variables (Monetag, Telegram, redirection de bots) sont documentées
> dans `.env.example`.

