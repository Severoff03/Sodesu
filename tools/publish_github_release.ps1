[CmdletBinding()]
param([switch]$ValidateOnly, [string]$ReleaseDirectory, [string]$Repository='Severoff03/sodesu')
. (Join-Path $PSScriptRoot 'release_common.ps1')
$root = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..'))
if ($Repository -notmatch '^[\w.-]+/[\w.-]+$') { throw 'Invalid GitHub repository.' }
$directory = Get-ReleaseDirectory $root $ReleaseDirectory
$manifestPath = Join-Path $directory 'release.json'
$manifest = [IO.File]::ReadAllText($manifestPath) | ConvertFrom-Json
Assert-VersionName $manifest.version
if ($manifest.repository -ne $Repository) { throw 'Repository differs from the built release.' }
$tag = 'v' + $manifest.version
if ($manifest.earlyAccess) { $tag += '-early-access' }
if ($manifest.PSObject.Properties.Name -contains 'tag') {
    if ($manifest.tag -notmatch '^v\d+\.\d+(\.\d+)?(-beta|-early-access)?$') { throw 'Invalid release tag.' }
    $tag = $manifest.tag
}
$assets = @()
foreach ($asset in $manifest.assets) {
    if ($asset.name -notmatch '^(Sodesu-v[\d.]+(-early-access)?\.apk|UPDATE\.txt)$') { throw 'Unexpected release asset.' }
    $path = Assert-ChildPath $directory (Join-Path $directory $asset.name)
    if ((Get-Item -LiteralPath $path).Length -ne $asset.size -or (Get-FileHash -LiteralPath $path -Algorithm SHA256).Hash -ine $asset.sha256) { throw "Release asset changed: $($asset.name)" }
    $assets += $path
}
Assert-SourceSnapshot $root $manifest.sources
$null = Invoke-Checked gh @('auth','status')
$repoInfo = (Invoke-Checked gh @('repo','view',$Repository,'--json','isPrivate,defaultBranchRef') | Out-String) | ConvertFrom-Json
if ($repoInfo.isPrivate) { throw 'This publisher expects the existing public repository.' }
$branch = (Invoke-Checked git @('-C',$root,'branch','--show-current') | Out-String).Trim()
if ($branch -ne $repoInfo.defaultBranchRef.name) { throw 'Switch to the repository default branch before publishing.' }
$remote = (Invoke-Checked git @('-C',$root,'remote','get-url','origin') | Out-String).Trim()
if ($remote -notin @("https://github.com/$Repository.git", "https://github.com/$Repository", "git@github.com:$Repository.git")) { throw 'Origin points to another repository.' }
if ($ValidateOnly) { Write-Host "Ready to publish $tag ($($assets.Count) assets)."; return }
$lock = Open-ReleaseLock $root
try {
    Assert-SourceSnapshot $root $manifest.sources
    if (-not $manifest.commit) {
        $staged = @(Invoke-Checked git @('-C',$root,'diff','--cached','--name-only'))
        if ($staged.Count) { throw 'The Git index already contains changes. Commit or unstage them before publication.' }
        foreach ($file in $manifest.sources) { $null = Invoke-Checked git @('-C',$root,'add','--',$file.path) }
        $changes = @(Invoke-Checked git @('-C',$root,'diff','--cached','--name-only'))
        if ($changes.Count) { Invoke-Checked git @('-C',$root,'commit','-m',"Release $tag") | Out-Host }
        $manifest.commit = (Invoke-Checked git @('-C',$root,'rev-parse','HEAD') | Out-String).Trim()
        Write-Utf8 $manifestPath ($manifest | ConvertTo-Json -Depth 8)
    }
    $head = (Invoke-Checked git @('-C',$root,'rev-parse','HEAD') | Out-String).Trim()
    if ($head -ne $manifest.commit) { throw 'HEAD differs from the release commit.' }
    Invoke-Checked git @('-C',$root,'push','origin',"HEAD:refs/heads/$branch") | Out-Host
    $releases = (Invoke-Checked gh @('api',"repos/$Repository/releases?per_page=100") | Out-String) | ConvertFrom-Json
    $existing = @($releases | Where-Object tag_name -eq $tag)
    if (-not $existing.Count) {
        $arguments = @('release','create',$tag,'--repo',$Repository,'--target',$manifest.commit,'--title',$tag,'--notes-file',(Join-Path $directory 'UPDATE.txt'),'--draft')
        if ($manifest.earlyAccess) { $arguments += '--prerelease' }
        Invoke-Checked gh $arguments | Out-Host
    }
    $remoteRelease = (Invoke-Checked gh @('release','view',$tag,'--repo',$Repository,'--json','isDraft,targetCommitish,assets,url') | Out-String) | ConvertFrom-Json
    if ($remoteRelease.isDraft) {
        Invoke-Checked gh (@('release','upload',$tag,'--repo',$Repository,'--clobber') + $assets) | Out-Host
        $editArguments = @('release','edit',$tag,'--repo',$Repository,'--draft=false')
        if (-not $manifest.earlyAccess) { $editArguments += '--latest' }
        Invoke-Checked gh $editArguments | Out-Host
    }
    $remoteRelease = (Invoke-Checked gh @('release','view',$tag,'--repo',$Repository,'--json','isDraft,assets,url') | Out-String) | ConvertFrom-Json
    if ($remoteRelease.isDraft) { throw 'Release is still a draft.' }
    foreach ($asset in $manifest.assets) {
        $remoteAsset = @($remoteRelease.assets | Where-Object name -eq $asset.name)
        if ($remoteAsset.Count -ne 1 -or $remoteAsset[0].size -ne $asset.size -or $remoteAsset[0].digest -ine ('sha256:' + $asset.sha256)) { throw "GitHub asset verification failed: $($asset.name)" }
    }
    $manifest.published = $true
    $manifest.releaseUrl = $remoteRelease.url
    Write-Utf8 $manifestPath ($manifest | ConvertTo-Json -Depth 8)
    $notes = Join-Path $root 'UPDATE.txt'
    if ((Test-Path -LiteralPath $notes) -and (Get-FileHash -LiteralPath $notes -Algorithm SHA256).Hash -ieq $manifest.updateSourceSha256) { Write-Utf8 $notes '' }
    Write-Host "Published: $($manifest.releaseUrl)" -ForegroundColor Green
} finally { $lock.Dispose() }
