<#
.SYNOPSIS
    Apply Supabase migrations from supabase/migrations/ to the linked project.

.DESCRIPTION
    Thin wrapper around the Supabase CLI. Requires the Supabase CLI installed
    and the project linked (`supabase link --project-ref <ref>`) beforehand --
    that's a one-time setup step documented in workflows/01-deployment.md, not
    done by this script (linking is destination-specific and shouldn't be
    silently re-run against the wrong project).
#>

$repoRoot = Split-Path -Parent $PSScriptRoot
$migrationsDir = Join-Path $repoRoot "supabase\migrations"

if (-not (Test-Path $migrationsDir)) {
    Write-Warning "supabase/migrations not found at $migrationsDir -- no migrations exist yet (see workflows/03-phase-plan.md, Phase 1)."
    exit 1
}

$supabaseCmd = Get-Command supabase -ErrorAction SilentlyContinue
if (-not $supabaseCmd) {
    Write-Error "Supabase CLI not found on PATH. Install it first: https://supabase.com/docs/guides/cli"
    exit 1
}

Write-Output "Applying Supabase migrations from $migrationsDir ..."
supabase db push

if ($LASTEXITCODE -ne 0) {
    Write-Error "Supabase migration failed (exit code $LASTEXITCODE)."
    exit $LASTEXITCODE
}

Write-Output "Migrations applied."
