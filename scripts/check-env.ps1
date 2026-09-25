# Diagnostic read-only de l'environnement Projet_individuel26
$ErrorActionPreference = "SilentlyContinue"

$checks = @(
  @{ Name = "Git"; Command = "git"; Args = @("--version") },
  @{ Name = "Node.js"; Command = "node"; Args = @("--version") },
  @{ Name = "Corepack"; Command = "corepack"; Args = @("--version") },
  @{ Name = "pnpm"; Command = "pnpm"; Args = @("--version") },
  @{ Name = "Docker CLI"; Command = "docker"; Args = @("--version") },
  @{ Name = "kubectl"; Command = "kubectl"; Args = @("version", "--client") },
  @{ Name = "Minikube"; Command = "minikube"; Args = @("version") },
  @{ Name = "Java"; Command = "java"; Args = @("-version") },
  @{ Name = "JMeter"; Command = "jmeter"; Args = @("-v") }
)

$failed = 0

Write-Host "=== Projet_individuel26 / LOT 0 - Environment check ==="
Write-Host ""

foreach ($check in $checks) {
  $cmd = Get-Command $check.Command -ErrorAction SilentlyContinue
  if (-not $cmd) {
    Write-Host ("[MISSING] {0}" -f $check.Name)
    $failed++
    continue
  }

  $output = & $check.Command @($check.Args) 2>&1 | Select-Object -First 3
  Write-Host ("[OK] {0}" -f $check.Name)
  $output | ForEach-Object { Write-Host ("     " + $_) }
}

Write-Host ""
Write-Host "=== Runtime checks ==="

$docker = Get-Command docker -ErrorAction SilentlyContinue
if ($docker) {
  & docker info *> $null
  if ($LASTEXITCODE -eq 0) {
    Write-Host "[OK] Docker daemon"
  } else {
    Write-Host "[WARN] Docker CLI present but daemon is not responding"
  }
}

$kubectl = Get-Command kubectl -ErrorAction SilentlyContinue
if ($kubectl) {
  $nodes = & kubectl get nodes 2>&1
  if ($LASTEXITCODE -eq 0) {
    Write-Host "[OK] Kubernetes context reachable"
    $nodes | ForEach-Object { Write-Host ("     " + $_) }
  } else {
    Write-Host "[INFO] kubectl installed; no reachable cluster yet"
  }
}

Write-Host ""
if ($failed -eq 0) {
  Write-Host "Tooling check: PASS"
  exit 0
} else {
  Write-Host ("Tooling check: INCOMPLETE - {0} tool(s) missing" -f $failed)
  exit 1
}
