# pinggy-ssh

Connexion SSH à un **Vercel Sandbox** via le tunnel gratuit de [pinggy.io](https://pinggy.io) — sans IP publique, sans config réseau.

```
Ton PC (PowerShell) ──SSH──> pinggy.io:443 ──tunnel──> sandbox Vercel (localhost:22)
```

## Principe

Le sandbox Vercel n'expose aucune IP publique. On ouvre donc un **tunnel sortant** (reverse tunnel) depuis le sandbox vers pinggy, qui lui attribue une adresse `*.pinggy-free.link` + port aléatoire vers laquelle tu te connectes depuis ton PC.

## Côté sandbox (déjà fait ici)

### 1. Démarrer sshd (si pas encore lancé)

```bash
sudo sshd
```

> Si tu obtiens `kex_exchange_identification: Connection reset` → sshd n'est pas à l'écoute sur le port 22, pinggy refuse la connexion. Vérifier avec `ss -tln | grep :22`.

### 2. Ouvrir le tunnel pinggy

```bash
ssh -o StrictHostKeyChecking=no -o ServerAliveInterval=30 -p 443 -R0:localhost:22 tcp@a.pinggy.io
```

Pinggy affiche une URL/tcp comme :

```
tcp://xxxx-xx-xx-xxx-xxx.run.pinggy-free.link:33369
```

### 3. (Optionnel) Tunnel persistant en arrière-plan

```bash
nohup ssh -o StrictHostKeyChecking=no -o ServerAliveInterval=30 -p 443 -R0:localhost:22 tcp@a.pinggy.io > /tmp/pinggy.log 2>&1 &
cat /tmp/pinggy.log   # contient l'hôte + le port assignés
```

## Côté PC (PowerShell)

```powershell
ssh -p <PORT> vercel-sandbox@<HOST>.run.pinggy-free.link
```

Exemple :

```powershell
ssh -p 33369 vercel-sandbox@fgkpi-18-223-98-240.run.pinggy-free.link
```

Si tu as une clé SSH, précise-la :

```powershell
ssh -i C:\Users\user\.ssh\id_ed25519 -p <PORT> vercel-sandbox@<HOST>.run.pinggy-free.link
```

## Dépannage

| Symptôme | Cause | Fix |
|---|---|---|
| `kex_exchange_identification: Connection reset` | `sshd` pas lancé dans le sandbox | `sudo sshd` |
| `Connection refused` | tunnel pinggy mort ou port changé | relancer l'étape 2, réutiliser le **nouveau** port |
| `Permission denied (publickey)` | ta clé n'est pas dans `~/.ssh/authorized_keys` | copier la clé publique dans `authorized_keys` (mode `600`) |
| tunnel OK mais plus de port | session sandbox expirée (45 min Hobby) | relancer sshd + tunnel après resume |

## Notes

- Le port affiché par pinggy **change à chaque tunnel** : toujours reprendre celui du dernier lancement.
- La session sandbox a un timeout (45 min sur Hobby) : à la fin, sshd **et** le tunnel meurent — relancer les deux.
- `ServerAliveInterval=30` évite la coupure du tunnel par inactivité.
