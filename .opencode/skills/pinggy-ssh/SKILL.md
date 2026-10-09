---
name: pinggy-ssh
description: Connect to a Vercel Sandbox over SSH using the free pinggy.io reverse tunnel. Use when the user wants to SSH into a Vercel Sandbox, open a tunnel to a sandbox, run sshd, or connect from their PC without a public IP. Triggers on "ssh sandbox", "pinggy", "tunnel to sandbox", "connect via ssh", "run sshd".
license: MIT
metadata:
  author: directchine83-max
  version: "1.0.0"
---

# pinggy-ssh

Reach a Vercel Sandbox (no public IP) over SSH through the free pinggy.io reverse tunnel.

```
Your PC (PowerShell) ──SSH──> pinggy.io:443 ──tunnel──> Vercel sandbox (localhost:22)
```

The sandbox opens an outbound reverse tunnel to pinggy, which assigns a
`*.pinggy-free.link` host + random port. Connect from your PC to that address.

## Start the tunnel (inside the Vercel Sandbox)

Simplest: run the bundled script.

```bash
.opencode/skills/pinggy-ssh/tunnel.sh
```

It starts `sshd` (if not already listening on `:22`) then opens the tunnel and
prints the assigned host/port. Or manually:

```bash
sudo sshd
ssh -o StrictHostKeyChecking=no -o ServerAliveInterval=30 -p 443 -R0:localhost:22 tcp@a.pinggy.io
```

Pinggy prints something like:

```
tcp://xxxx-xx-xx-xxx-xxx.run.pinggy-free.link:33369
```

Persistent background tunnel:

```bash
nohup ssh -o StrictHostKeyChecking=no -o ServerAliveInterval=30 -p 443 -R0:localhost:22 tcp@a.pinggy.io > /tmp/pinggy.log 2>&1 &
cat /tmp/pinggy.log   # contains the assigned host + port
```

## Connect (from your PC, PowerShell)

```powershell
ssh -p <PORT> vercel-sandbox@<HOST>.run.pinggy-free.link
```

The bundled `connect.ps1` wraps this:

```powershell
.opencode/skills/pinggy-ssh/connect.ps1 -Host <HOST>.run.pinggy-free.link -Port <PORT>
```

With an SSH key:

```powershell
.opencode/skills/pinggy-ssh/connect.ps1 -Host <HOST> -Port <PORT> -KeyFile C:\Users\user\.ssh\id_ed25519
```

## Troubleshooting

| Symptom | Cause | Fix |
|---|---|---|
| `kex_exchange_identification: Connection reset` | `sshd` not running in the sandbox | `sudo sshd`, verify with `ss -tln \| grep :22` |
| `Connection refused` | pinggy tunnel dead or port changed | rerun the tunnel step, use the **new** port |
| `Permission denied (publickey)` | key not in `~/.ssh/authorized_keys` | add the public key to `authorized_keys` (mode `600`) |
| tunnel up but no port | sandbox session expired (45 min Hobby) | restart sshd + tunnel after resume |

## Notes

- The pinggy port **changes on every tunnel** — always reuse the last printed one.
- Sandbox sessions time out (45 min on Hobby): sshd and the tunnel both die — restart both.
- `ServerAliveInterval=30` prevents idle disconnects.

See `README.md` for the full guide.
