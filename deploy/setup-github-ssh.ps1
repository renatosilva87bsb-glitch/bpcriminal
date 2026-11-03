$ErrorActionPreference = "Stop"
$sshDir = Join-Path $HOME ".ssh"
$keyPath = Join-Path $sshDir "bp-advocacia-github-ed25519"
New-Item -ItemType Directory -Force -Path $sshDir | Out-Null
if (-not (Test-Path $keyPath)) {
  ssh-keygen -t ed25519 -C "deploy-bandeiraepaulo-adv-br" -f $keyPath
} else {
  Write-Host "Chave existente preservada: $keyPath"
}
Write-Host "`nChave PUBLICA para cadastrar em GitHub > Settings > SSH and GPG keys:"
Get-Content "$keyPath.pub"
Write-Host "`nTeste depois do cadastro: ssh -T git@github.com"
Write-Host "ATENCAO: nunca compartilhe nem envie a chave privada."
