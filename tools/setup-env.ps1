<#
.SYNOPSIS
    Scaffold .env.local from .env.example and check required vars are set.

.DESCRIPTION
    Run from the repo root once Phase 1 has created .env.example. Copies
    .env.example to .env.local if it doesn't exist yet, then reports which
    required keys (per workflows/05-env-vars.md) are still blank.
#>

$repoRoot = Split-Path -Parent $PSScriptRoot
$examplePath = Join-Path $repoRoot ".env.example"
$localPath = Join-Path $repoRoot ".env.local"

if (-not (Test-Path $examplePath)) {
    Write-Warning ".env.example not found at $examplePath -- this repo hasn't reached Phase 1 yet (see workflows/03-phase-plan.md)."
    exit 1
}

if (-not (Test-Path $localPath)) {
    Copy-Item -Path $examplePath -Destination $localPath
    Write-Output "Created .env.local from .env.example."
} else {
    Write-Output ".env.local already exists -- leaving it as-is."
}

# Minimum viable set to run the app against a real Supabase project.
# See workflows/05-env-vars.md for the full table and which deploy target each belongs to.
$requiredForLocalDev = @(
    "NEXT_PUBLIC_SUPABASE_URL",
    "NEXT_PUBLIC_SUPABASE_ANON_KEY",
    "SUPABASE_SERVICE_ROLE_KEY"
)

$envLines = Get-Content $localPath
$missing = @()

foreach ($key in $requiredForLocalDev) {
    $line = $envLines | Where-Object { $_ -match "^\s*$key\s*=" }
    if (-not $line -or ($line -match "^\s*$key\s*=\s*$")) {
        $missing += $key
    }
}

if ($missing.Count -gt 0) {
    Write-Warning "Missing/blank required vars in .env.local:"
    $missing | ForEach-Object { Write-Warning "  - $_" }
    Write-Output "`nAll other vars (AI provider keys, SEARCH_API_KEY, SOURCING_API_KEY, RESEND_API_KEY) can stay blank while MOCK_AI/MOCK_SEARCH/MOCK_SOURCING/MOCK_EMAIL=true."
} else {
    Write-Output "All required local-dev vars are set."
}
