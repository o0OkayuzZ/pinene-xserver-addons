param(
  [string]$WorldItemsDir = ""
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$sourceItemsDir = Join-Path (Split-Path -Parent $PSScriptRoot) "items"

if (-not (Test-Path -LiteralPath $sourceItemsDir)) {
  throw "Source items directory not found: $sourceItemsDir"
}

if ([string]::IsNullOrWhiteSpace($WorldItemsDir)) {
  $candidateItemsDirs = @()

  $roamingUsersRoot = Join-Path $env:APPDATA "Minecraft Bedrock\Users"
  if (Test-Path -LiteralPath $roamingUsersRoot) {
    $userDirs = Get-ChildItem -Path $roamingUsersRoot -Directory -ErrorAction SilentlyContinue
    foreach ($userDir in $userDirs) {
      $worldsRoot = Join-Path $userDir.FullName "games\com.mojang\minecraftWorlds"
      if (-not (Test-Path -LiteralPath $worldsRoot)) { continue }

      $worldDirs = Get-ChildItem -Path $worldsRoot -Directory -ErrorAction SilentlyContinue
      foreach ($worldDir in $worldDirs) {
        $itemsPath = Join-Path $worldDir.FullName "behavior_packs\BlueAppleResetV1\items"
        if (Test-Path -LiteralPath $itemsPath) {
          $candidateItemsDirs += $itemsPath
        }
      }
    }
  }

  $uwpWorldsRoot = Join-Path $env:LOCALAPPDATA "Packages\Microsoft.MinecraftUWP_8wekyb3d8bbwe\LocalState\games\com.mojang\minecraftWorlds"
  if (Test-Path -LiteralPath $uwpWorldsRoot) {
    $worldDirs = Get-ChildItem -Path $uwpWorldsRoot -Directory -ErrorAction SilentlyContinue
    foreach ($worldDir in $worldDirs) {
      $itemsPath = Join-Path $worldDir.FullName "behavior_packs\BlueAppleResetV1\items"
      if (Test-Path -LiteralPath $itemsPath) {
        $candidateItemsDirs += $itemsPath
      }
    }
  }

  $candidateItemsDirs = @($candidateItemsDirs | Select-Object -Unique)

  if ($candidateItemsDirs.Count -eq 0) {
    throw "Could not auto-detect world-local BlueAppleResetV1 items path. Pass -WorldItemsDir explicitly."
  }

  if ($candidateItemsDirs.Count -gt 1) {
    Write-Host "Multiple candidate worlds found:" 
    $candidateItemsDirs | ForEach-Object { Write-Host " - $_" }
    throw "Please re-run with -WorldItemsDir and choose one target."
  }

  $WorldItemsDir = $candidateItemsDirs[0]
}

if (-not (Test-Path -LiteralPath $WorldItemsDir)) {
  New-Item -ItemType Directory -Path $WorldItemsDir -Force | Out-Null
}

Copy-Item -Path (Join-Path $sourceItemsDir "*.item.json") -Destination $WorldItemsDir -Force
Write-Host "Synced item JSON files to world-local pack: $WorldItemsDir"
