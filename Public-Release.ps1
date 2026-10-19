[CmdletBinding()]
param(
    [Alias('validate')][switch]$ValidateOnly,
    [string]$ReleaseDirectory,
    [string]$Repository = 'Severoff03/sodesu'
)
$ErrorActionPreference = 'Stop'
try {
    & (Join-Path $PSScriptRoot 'tools/publish_github_release.ps1') @PSBoundParameters
    exit 0
} catch {
    Write-Host $_.Exception.Message -ForegroundColor Red
    exit 1
}
