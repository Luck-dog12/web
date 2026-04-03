param(
  [ValidateSet('dev', 'prod')]
  [string]$RuntimeMode = 'dev'
)

$ErrorActionPreference = 'Stop'

$root = Split-Path -Parent $PSScriptRoot
$preferredToolRoot = 'D:\版本管理工具'
$fallbackToolRoot = Join-Path $root '.tooling\node'
$toolRoot = if (Test-Path (Join-Path $preferredToolRoot 'node.exe')) {
  $preferredToolRoot
} else {
  $fallbackToolRoot
}

if (-not (Test-Path (Join-Path $toolRoot 'node.exe'))) {
  throw "Node toolchain not found. Checked: $toolRoot"
}

$tmpDirName = if ($RuntimeMode -eq 'prod') { '.tmp-playwright-prod' } else { '.tmp-playwright' }
$tmpDir = Join-Path $root $tmpDirName
New-Item -ItemType Directory -Force -Path $tmpDir | Out-Null

$apiPort = 3401
$webPort = 3400
$fakePaypalPort = 3499
$apiBaseUrl = "http://127.0.0.1:$apiPort"
$webBaseUrl = "http://127.0.0.1:$webPort"
$fakePaypalBaseUrl = "http://127.0.0.1:$fakePaypalPort"

function Start-BackgroundProcess {
  param(
    [string]$Command,
    [hashtable]$Environment,
    [string]$StdoutPath,
    [string]$StderrPath
  )

  $lines = @(
    '$ErrorActionPreference = ''Stop'''
  )

  foreach ($entry in $Environment.GetEnumerator()) {
    $value = [string]$entry.Value
    $escaped = $value.Replace("'", "''")
    $lines += "`$env:$($entry.Key) = '$escaped'"
  }

  $lines += $Command
  $script = $lines -join '; '

  Start-Process `
    -FilePath 'powershell.exe' `
    -ArgumentList @('-NoLogo', '-NoProfile', '-Command', $script) `
    -WorkingDirectory $root `
    -PassThru `
    -RedirectStandardOutput $StdoutPath `
    -RedirectStandardError $StderrPath
}

function Wait-ForUrl {
  param(
    [string]$Url,
    [int]$TimeoutSeconds,
    [string]$Name
  )

  $deadline = (Get-Date).AddSeconds($TimeoutSeconds)
  while ((Get-Date) -lt $deadline) {
    try {
      $response = Invoke-WebRequest -Uri $Url -UseBasicParsing -TimeoutSec 5
      if ($response.StatusCode -ge 200 -and $response.StatusCode -lt 500) {
        return
      }
    } catch {
      Start-Sleep -Milliseconds 750
      continue
    }

    Start-Sleep -Milliseconds 750
  }

  throw "$Name did not become ready at $Url within $TimeoutSeconds seconds."
}

function Get-DotEnvMap {
  param(
    [string]$Path
  )

  $values = @{}
  if (-not (Test-Path $Path)) {
    return $values
  }

  foreach ($line in Get-Content -Path $Path) {
    $trimmed = $line.Trim()
    if (-not $trimmed -or $trimmed.StartsWith('#')) {
      continue
    }

    if ($trimmed.StartsWith('export ')) {
      $trimmed = $trimmed.Substring(7).Trim()
    }

    $parts = $trimmed -split '=', 2
    if ($parts.Count -ne 2) {
      continue
    }

    $key = $parts[0].Trim()
    if (-not $key) {
      continue
    }

    $value = $parts[1]
    if (
      ($value.StartsWith('"') -and $value.EndsWith('"')) -or
      ($value.StartsWith("'") -and $value.EndsWith("'"))
    ) {
      $value = $value.Substring(1, $value.Length - 2)
    }

    $values[$key] = $value
  }

  return $values
}

$commonEnv = @{
  PATH = "$toolRoot;$env:PATH"
  INIT_CWD = $root
  TEMP = $tmpDir
  TMP = $tmpDir
}

$rootDotEnv = Get-DotEnvMap -Path (Join-Path $root '.env')

$apiEnv = @{
  PATH = $commonEnv.PATH
  INIT_CWD = $commonEnv.INIT_CWD
  PORT = "$apiPort"
  WEB_BASE_URL = $webBaseUrl
  WEB_BASE_URLS = "$webBaseUrl,http://localhost:$webPort"
  PAYPAL_BASE_URL = $fakePaypalBaseUrl
  PAYPAL_CLIENT_ID = 'fake-paypal-client-id'
  PAYPAL_CLIENT_SECRET = 'fake-paypal-client-secret'
  PAYPAL_WEBHOOK_ID = 'fake-paypal-webhook-id'
  SESSION_COOKIE_SECURE = 'false'
  TEMP = $commonEnv.TEMP
  TMP = $commonEnv.TMP
}

$webEnv = @{
  PATH = $commonEnv.PATH
  INIT_CWD = $commonEnv.INIT_CWD
  TEMP = $commonEnv.TEMP
  TMP = $commonEnv.TMP
  NEXT_PUBLIC_APP_API_BASE_URL = $apiBaseUrl
  NEXT_PUBLIC_API_BASE_URL = $apiBaseUrl
  API_URL = $apiBaseUrl
  NEXT_PUBLIC_API_URL = $apiBaseUrl
  NEXT_PUBLIC_PAYPAL_CLIENT_ID = ''
}

if ($RuntimeMode -eq 'prod') {
  $apiEnv.NODE_ENV = 'production'
  $webEnv.NODE_ENV = 'production'
}

foreach ($entry in $rootDotEnv.GetEnumerator()) {
  if (-not $apiEnv.ContainsKey($entry.Key)) {
    $apiEnv[$entry.Key] = [string]$entry.Value
  }
  if (-not $webEnv.ContainsKey($entry.Key)) {
    $webEnv[$entry.Key] = [string]$entry.Value
  }
}

$processes = @()
$scriptExitCode = 0

try {
  $processes += Start-BackgroundProcess `
    -Command "& '$toolRoot\node.exe' '$root\scripts\fake-paypal-server.cjs'" `
    -Environment (@{
      PATH = $commonEnv.PATH
      FAKE_PAYPAL_HOST = '127.0.0.1'
      FAKE_PAYPAL_PORT = "$fakePaypalPort"
    }) `
    -StdoutPath (Join-Path $tmpDir 'fake-paypal.out.log') `
    -StderrPath (Join-Path $tmpDir 'fake-paypal.err.log')

  Wait-ForUrl -Url "$fakePaypalBaseUrl/health" -TimeoutSeconds 30 -Name 'fake PayPal'

  if ($RuntimeMode -eq 'prod') {
    foreach ($entry in $apiEnv.GetEnumerator()) {
      Set-Item -Path "Env:$($entry.Key)" -Value ([string]$entry.Value)
    }
    foreach ($entry in $webEnv.GetEnumerator()) {
      Set-Item -Path "Env:$($entry.Key)" -Value ([string]$entry.Value)
    }

    & "$toolRoot\npm.cmd" run build -w apps/api
    if ($LASTEXITCODE -ne 0) {
      throw "API production build failed with exit code $LASTEXITCODE."
    }

    & "$toolRoot\npm.cmd" run build -w apps/web
    if ($LASTEXITCODE -ne 0) {
      throw "Web production build failed with exit code $LASTEXITCODE."
    }
  }

  $apiCommand = if ($RuntimeMode -eq 'prod') {
    "& '$toolRoot\npm.cmd' run start:prod -w apps/api"
  } else {
    "& '$toolRoot\npm.cmd' run start:dev -w apps/api"
  }

  $processes += Start-BackgroundProcess `
    -Command $apiCommand `
    -Environment $apiEnv `
    -StdoutPath (Join-Path $tmpDir 'api-e2e.out.log') `
    -StderrPath (Join-Path $tmpDir 'api-e2e.err.log')

  Wait-ForUrl -Url "$apiBaseUrl/health" -TimeoutSeconds 90 -Name 'API server'

  $webCommand = if ($RuntimeMode -eq 'prod') {
    "& '$toolRoot\npm.cmd' run start -w apps/web -- --port $webPort"
  } else {
    "& '$toolRoot\npm.cmd' run dev -w apps/web -- --port $webPort"
  }

  $processes += Start-BackgroundProcess `
    -Command $webCommand `
    -Environment $webEnv `
    -StdoutPath (Join-Path $tmpDir 'web-e2e.out.log') `
    -StderrPath (Join-Path $tmpDir 'web-e2e.err.log')

  Wait-ForUrl -Url "$webBaseUrl/login" -TimeoutSeconds 120 -Name 'web server'

  $env:PATH = $commonEnv.PATH
  $env:PLAYWRIGHT_BASE_URL = $webBaseUrl
  $env:API_BASE_URL = $apiBaseUrl
  $env:TEMP = $commonEnv.TEMP
  $env:TMP = $commonEnv.TMP

  & "$toolRoot\npm.cmd" run test:e2e:checkout -w apps/web
  $scriptExitCode = $LASTEXITCODE
  if ($scriptExitCode -ne 0) {
    throw "Playwright checkout E2E failed with exit code $scriptExitCode."
  }
} finally {
  foreach ($process in $processes) {
    if (-not $process) { continue }
    try {
      if (-not $process.HasExited) {
        Stop-Process -Id $process.Id -Force
      }
    } catch {
      Write-Warning "Failed to stop process $($process.Id): $($_.Exception.Message)"
    }
  }
}

exit $scriptExitCode
