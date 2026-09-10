<#
.SYNOPSIS
    Deploy Trigger.dev tasks (trigger/) independently of the Vercel frontend deploy.

.DESCRIPTION
    Wraps `npx trigger.dev deploy`. See workflows/01-deployment.md for when to
    run this (after any change to trigger/, agents/, or prompts/) and
    workflows/00-architecture.md for why the two deploy targets are separate.

    Trigger.dev's deploy indexer has a bug on Windows when the project path
    contains a space: it produces a URL-encoded (%20) path internally and then
    fails to resolve trigger.config.mjs from that literal encoded path. Rather
    than requiring this repo to live at a space-free path, this script copies
    the project to a space-free temp directory and deploys from there. A
    directory junction does NOT work around this (Windows silently resolves it
    back to the real, space-containing path) -- an actual file copy is required.

.PARAMETER Environment
    Trigger.dev environment to deploy to. Defaults to "prod".

.PARAMETER DryRun
    Build and validate the deploy (catches SDK-usage errors in trigger/ code)
    without actually publishing a new version.
#>

param(
    [string]$Environment = "prod",
    [switch]$DryRun
)

$repoRoot = Split-Path -Parent $PSScriptRoot
$triggerDir = Join-Path $repoRoot "trigger"

if (-not (Test-Path $triggerDir)) {
    Write-Warning "trigger/ not found at $triggerDir -- Trigger.dev tasks haven't been scaffolded yet (see workflows/03-phase-plan.md, Phase 4 onward)."
    exit 1
}

# Use the exact CLI version pinned to @trigger.dev/sdk in package.json -- the
# CLI refuses to deploy (in CI) if it doesn't match the installed SDK/build
# package versions, so "@latest" would drift and break deploys over time.
$packageJson = Get-Content (Join-Path $repoRoot "package.json") -Raw | ConvertFrom-Json
$sdkVersion = $packageJson.dependencies.'@trigger.dev/sdk'

# Space-free staging copy -- only needed because the repo currently lives under
# a path with a space in it. If this repo is ever moved to a space-free path,
# this staging step becomes unnecessary but remains harmless.
$stagingDir = Join-Path $env:LOCALAPPDATA "trigger-deploy-staging\ai-lead-generator"

Write-Output "Staging a space-free copy at $stagingDir ..."
New-Item -ItemType Directory -Force -Path $stagingDir | Out-Null

robocopy $repoRoot $stagingDir /MIR /XD node_modules .git .trigger /XF .env .env.local /NFL /NDL /NJH /NJS | Out-Null
if ($LASTEXITCODE -ge 8) {
    Write-Error "robocopy failed while staging the deploy copy (exit code $LASTEXITCODE)."
    exit $LASTEXITCODE
}

Push-Location $stagingDir
try {
    Write-Output "Installing dependencies in staging copy..."
    npm install --no-audit --no-fund
    if ($LASTEXITCODE -ne 0) {
        Write-Error "npm install failed in staging copy (exit code $LASTEXITCODE)."
        exit $LASTEXITCODE
    }

    if ($DryRun) {
        Write-Output "Dry-run deploying Trigger.dev tasks (environment: $Environment, CLI version: $sdkVersion)..."
        npx "trigger.dev@$sdkVersion" deploy --env $Environment --dry-run
    } else {
        Write-Output "Deploying Trigger.dev tasks (environment: $Environment, CLI version: $sdkVersion)..."
        npx "trigger.dev@$sdkVersion" deploy --env $Environment
    }
    if ($LASTEXITCODE -ne 0) {
        Write-Error "Trigger.dev deploy failed (exit code $LASTEXITCODE)."
        exit $LASTEXITCODE
    }
} finally {
    Pop-Location
}

if ($DryRun) {
    Write-Output "Trigger.dev dry-run build complete."
} else {
    Write-Output "Trigger.dev deploy complete."
}
