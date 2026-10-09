#!/usr/bin/env bash
# Démarre sshd + ouvre le tunnel pinggy vers localhost:22
# Usage: ./tunnel.sh  (dans le sandbox Vercel)
set -e

echo "1/2 Démarrage de sshd..."
if ss -tln | grep -q ':22 '; then
  echo "  sshd déjà à l'écoute sur :22"
else
  sudo sshd
  sleep 1
  ss -tln | grep -q ':22 ' && echo "  sshd démarré ✓" || { echo "  ÉCHEC: sshd pas à l'écoute"; exit 1; }
fi

echo "2/2 Ouverture du tunnel pinggy (Ctrl+C pour stopper)..."
echo "  L'hôte + port assignés s'affichent ci-dessous."
echo "  Connexion depuis ton PC:"
echo "    ssh -p <PORT> vercel-sandbox@<HOST>"
echo "---"

exec ssh -o StrictHostKeyChecking=no \
         -o ServerAliveInterval=30 \
         -o ExitOnForwardFailure=yes \
         -p 443 -R0:localhost:22 tcp@a.pinggy.io
