[CmdletBinding()]
param(
    [Alias('validate')][switch]$ValidateOnly,
    [switch]$DebugBuild,
    [switch]$Beta,
    [switch]$AllowVersionReset,
    [string]$SigningReference,
    [string]$Version,
    [string]$JavaHome,
    [string]$AndroidSdk,
    [string]$GradlePath
)
$ErrorActionPreference = 'Stop'
try {
    & (Join-Path $PSScriptRoot 'Builder/release_builder.ps1') @PSBoundParameters
    exit 0
} catch {
    Write-Host $_.Exception.Message -ForegroundColor Red
    exit 1
}
