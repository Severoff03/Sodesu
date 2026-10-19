Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

function Write-Utf8([string]$Path, [string]$Text) {
    [IO.File]::WriteAllText($Path, $Text, (New-Object Text.UTF8Encoding($false)))
}

function Read-ReleaseVersion([string]$Path) {
    $text = [IO.File]::ReadAllText($Path)
    $names = [regex]::Matches($text, '(?m)^VERSION_NAME=(\d+\.\d+\.\d+)\s*$')
    $codes = [regex]::Matches($text, '(?m)^VERSION_CODE=([1-9]\d*)\s*$')
    if ($names.Count -ne 1 -or $codes.Count -ne 1) { throw 'Invalid version.properties: expected VERSION_NAME=X.Y.Z and VERSION_CODE=N.' }
    $name = $names[0].Groups[1].Value
    Assert-VersionName $name
    $code = [long]$codes[0].Groups[1].Value
    if ($code -gt 2100000000) { throw 'VERSION_CODE exceeds the Android limit.' }
    [pscustomobject]@{ Name = $name; Code = [int]$code }
}

function Assert-VersionName([string]$Name) {
    if ($Name -cnotmatch '^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$') { throw "Invalid semantic version: $Name" }
    $null = [version]$Name
}

function Get-NextVersion($Current, [string]$Requested) {
    if ($Requested) { $next = $Requested } else {
        $v = [version]$Current.Name
        $next = '{0}.{1}.{2}' -f $v.Major, $v.Minor, ($v.Build + 1)
    }
    Assert-VersionName $next
    if ([version]$next -le [version]$Current.Name) { throw 'The release version must be higher than the current version.' }
    if ($Current.Code -ge 2100000000) { throw 'No Android versionCode remains.' }
    [pscustomobject]@{ Name = $next; Code = $Current.Code + 1 }
}

function Assert-ChildPath([string]$Parent, [string]$Path) {
    $base = [IO.Path]::GetFullPath($Parent).TrimEnd('\', '/')
    $full = [IO.Path]::GetFullPath($Path)
    if (-not $full.StartsWith($base + [IO.Path]::DirectorySeparatorChar, [StringComparison]::OrdinalIgnoreCase)) {
        throw "Path is outside the expected directory: $full"
    }
    # Reject junctions/symlinks in every existing component, including the parent.
    $item = $full
    while ($item) {
        if (Test-Path -LiteralPath $item) {
            if ((Get-Item -LiteralPath $item -Force).Attributes -band [IO.FileAttributes]::ReparsePoint) { throw "Linked paths are not allowed: $item" }
        }
        $next = Split-Path -Parent $item
        if ($next -eq $item) { break }
        $item = $next
    }
    $full
}

function Remove-SafeTree([string]$Parent, [string]$Path) {
    $full = Assert-ChildPath $Parent $Path
    if (Test-Path -LiteralPath $full) { Remove-Item -LiteralPath $full -Recurse -Force }
}

function Invoke-Checked([string]$Command, [string[]]$Arguments) {
    $old = $ErrorActionPreference
    try {
        $ErrorActionPreference = 'Continue'
        $output = @(& $Command @Arguments 2>&1 | ForEach-Object { "$_" })
        $code = $LASTEXITCODE
    } finally { $ErrorActionPreference = $old }
    if ($code -ne 0) { throw "Command failed ($code): $Command`n$($output -join "`n")" }
    $output
}

function Get-SourceFiles([string]$Root) {
    # Deliberate allowlist: no broad `git add .`, no local tools, keys or releases.
    $fixed = @('.gitattributes', '.gitignore', 'LICENSE', 'NOTICE.md', 'PATCHNOTES.md', 'README.md',
        'RELEASING.md', 'version.properties', 'Build-Releases.ps1', 'Public-Release.ps1',
        'android/build.gradle', 'android/settings.gradle', 'android/gradle.properties',
        'android/app/build.gradle', 'android/app/proguard-rules.pro',
        'android/gradle/wrapper/gradle-wrapper.properties', 'android/gradle/wrapper/gradle-wrapper.jar',
        'android/gradlew', 'android/gradlew.bat',
        'tools/build_pitch_data.py', 'tools/generate_icons.py', 'tools/release_common.ps1',
        'tools/publish_github_release.ps1', 'tools/test_release_tools.ps1',
        'docs/baner1.jpg', 'docs/screenshots/home.jpg', 'docs/screenshots/kanji.jpg',
        'docs/screenshots/dict.jpg', 'docs/screenshots/quiz.jpg')
    $files = New-Object 'System.Collections.Generic.List[string]'
    foreach ($path in $fixed) { if (Test-Path -LiteralPath (Join-Path $Root $path) -PathType Leaf) { $files.Add($path) } }
    foreach ($folder in @('www', 'android/app/src/main', 'libraries')) {
        $base = Join-Path $Root $folder
        $null = Assert-ChildPath $Root $base
        foreach ($file in Get-ChildItem -LiteralPath $base -File -Recurse) {
            $null = Assert-ChildPath $Root $file.FullName
            $relative = $file.FullName.Substring($Root.TrimEnd('\', '/').Length + 1).Replace('\', '/')
            if ($relative -match '[\r\n]' -or $file.Name -match '(?i)(^\.env|key\.properties|credentials|secrets?)' -or
                $file.Extension -notin @('.html', '.css', '.js', '.json', '.csv', '.md', '.txt', '.java', '.kt', '.xml',
                    '.png', '.jpg', '.jpeg', '.webp', '.gif', '.svg', '.ico', '.wav', '.mp3', '.ogg', '.woff', '.woff2', '.ttf')) {
                throw "File is not approved for publication: $relative"
            }
            $files.Add($relative)
        }
    }
    foreach ($path in ($files | Sort-Object -Unique)) {
        $full = Assert-ChildPath $Root (Join-Path $Root $path)
        [pscustomobject]@{ path = $path; sha256 = (Get-FileHash -LiteralPath $full -Algorithm SHA256).Hash.ToLowerInvariant() }
    }
}

function Assert-SourceSnapshot([string]$Root, $Expected) {
    $actual = @(Get-SourceFiles $Root)
    $a = @($actual | ForEach-Object { $_.path + ':' + $_.sha256 })
    $b = @($Expected | ForEach-Object { $_.path + ':' + $_.sha256 })
    if (@(Compare-Object $a $b).Count) { throw 'Sources changed after the build. Build a new release before publishing.' }
}

function Open-ReleaseLock([string]$Root) {
    $folder = Join-Path $Root 'Builder'
    $null = Assert-ChildPath $Root $folder
    $null = New-Item -ItemType Directory -Path $folder -Force
    try { [IO.File]::Open((Join-Path $folder 'build.lock'), [IO.FileMode]::OpenOrCreate, [IO.FileAccess]::ReadWrite, [IO.FileShare]::None) }
    catch { throw 'Another build or publication is running (Builder/build.lock).' }
}

function Get-ReleaseDirectory([string]$Root, [string]$Requested) {
    $base = Join-Path $Root 'releases'
    if ($Requested) {
        if (-not [IO.Path]::IsPathRooted($Requested)) { $Requested = Join-Path $Root $Requested }
        $full = Assert-ChildPath $base $Requested
    } else {
        if (-not (Test-Path -LiteralPath $base)) { throw 'No local release. Run Build Release first.' }
        $dirs = @(Get-ChildItem -LiteralPath $base -Directory | Where-Object { $_.Name -match '^v\d+\.\d+\.\d+$' } |
            Sort-Object { [version]$_.Name.Substring(1) } -Descending)
        if (-not $dirs.Count) { throw 'No local release. Run Build Release first.' }
        $full = Assert-ChildPath $base $dirs[0].FullName
    }
    if (-not (Test-Path -LiteralPath (Join-Path $full 'release.json'))) { throw "Missing release.json: $full" }
    $full
}
