# Connexion rapide au sandbox Vercel via pinggy (Windows PowerShell)
# Usage: .\connect.ps1 -Host fgkpi-18-223-98-240.run.pinggy-free.link -Port 33369
param(
    [Parameter(Mandatory=$true)][string]$Host,
    [Parameter(Mandatory=$true)][int]$Port,
    [string]$User = "vercel-sandbox",
    [string]$KeyFile = "$env:USERPROFILE\.ssh\id_ed25519"
)

if (Test-Path $KeyFile) {
    ssh -i $KeyFile -o StrictHostKeyChecking=no -p $Port "$User@$Host"
} else {
    ssh -o StrictHostKeyChecking=no -p $Port "$User@$Host"
}
