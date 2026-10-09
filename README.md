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

## Wallet chiffré (création / import)

Le dapp génère de vrais wallets multi-chaînes (Ethereum, Solana, Bitcoin) et les
stocke **chiffrés au repos** (AES-256-GCM). Inspiré de la gestion de secrets du
bot `tg-crypto-wallet`.

- Génération/import : `POST /api/wallets/create`, `POST /api/wallets/import`
- Révélation (propriétaire + phrase secrète) : `POST /api/wallets/reveal`
- Liste sans secret : `GET /api/wallets/list?ownerId=…`

Modèle de sécurité :

- Clé maître `MASTER_ENCRYPTION_KEY` (32 octets hex) → clé dérivée **par
  propriétaire** via HKDF-SHA256, puis chiffrement AES-256-GCM (IV 12 octets,
  tag 16 octets, préfixe de version).
- Phrase secrète optionnelle : si elle est définie, elle est requise pour
  révéler le wallet (PBKDF2-SHA512, 210 000 itérations + HKDF).
- Les mnémoniques/clés privées ne sont **jamais** renvoyés en clair par la liste,
  jamais journalisés, et le magasin disque (`WALLET_STORE_PATH/wallets.json`,
  mode `0600`) ne contient que le ciphertext.
- Le `ownerId` (aléatoire, conservé côté navigateur) joue le rôle d'identifiant
  de propriétaire — comme le `chatId` du bot.

Génération de la clé maître :

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

Copiez `.env.example` vers `.env.local` puis renseignez les variables :

| Variable                       | Défaut              | Rôle                                                    |
| ------------------------------ | ------------------- | ------------------------------------------------------- |
| `MASTER_ENCRYPTION_KEY`        | —                   | Clé maître hex 64 caractères (AES-256-GCM). **Requis.** |
| `WALLET_KEY_SALT`              | `rollbit-wallet-v1` | Sel HKDF pour la dérivation par propriétaire.           |
| `WALLET_STORE_PATH`            | `./data`            | Dossier du magasin chiffré (`wallets.json`).            |
| `WALLET_PERSIST`               | `true`              | `false` = mémoire uniquement (serverless/éphémère).     |
| `WALLET_REQUIRE_PASSPHRASE`    | `false`             | Exiger une phrase secrète pour créer/révéler.           |
| `WALLET_MIN_PASSPHRASE_LENGTH` | `8`                 | Longueur minimale de la phrase secrète.                 |
| `WALLET_MAX_PER_OWNER`         | `20`                | Nombre max de wallets par propriétaire.                 |
| `ETHEREUM_TREASURY_ADDRESS`    | —                   | Clé **publique** de réception des dépôts ETH.           |
| `BITCOIN_TREASURY_ADDRESS`     | —                   | Clé **publique** de réception des dépôts BTC.           |
| `SOLANA_TREASURY_ADDRESS`      | —                   | Clé **publique** de réception des dépôts SOL.           |
| `HOUSE_EDGE_BPS`               | `200`               | Marge maison en points de base (max 2000).              |
| `SERVICE_FEE_BPS`              | `100`               | Frais de service sur les dépôts, en points de base.     |

### Dépôts & rentabilité

- Les trois adresses **publiques** (`ETH`, `BTC`, `SOL`) sont exposées via
  `GET /api/deposits/treasury` et affichées aux visiteurs dans la fenêtre
  « Dépôt » (copie + lien explorateur). N’y mettez **jamais** de clé privée.
- La marge de la maison est configurable (`GET /api/house`, `HOUSE_EDGE_BPS`).
  Le multiplicateur vaut `payoutFactor / chance`, donc l’espérance de gain du
  casino reste positive (marge appliquée) tout en restant faible pour le
  visiteur (2 % par défaut).

> ⚠️ Sauvegardez `MASTER_ENCRYPTION_KEY` et les phrases de récupération : sans
> elles, les secrets chiffrés sont irrécupérables.
