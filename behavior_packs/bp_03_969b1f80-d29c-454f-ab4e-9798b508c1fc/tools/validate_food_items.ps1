param(
  [string]$ItemsDir = ""
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

if ([string]::IsNullOrWhiteSpace($ItemsDir)) {
  $ItemsDir = Join-Path (Split-Path -Parent $PSScriptRoot) "items"
}

if (-not (Test-Path -LiteralPath $ItemsDir)) {
  throw "Items directory not found: $ItemsDir"
}

$files = Get-ChildItem -Path $ItemsDir -Filter "*.item.json" -File
if ($files.Count -eq 0) {
  Write-Host "No item files found in $ItemsDir"
  exit 0
}

$hadErrors = $false

function Write-Issue {
  param(
    [string]$Level,
    [string]$File,
    [string]$Message
  )

  if ($Level -eq "ERROR") {
    $script:hadErrors = $true
  }

  Write-Host "[$Level] $File - $Message"
}

foreach ($file in $files) {
  $raw = Get-Content -LiteralPath $file.FullName -Raw -Encoding UTF8

  try {
    $json = $raw | ConvertFrom-Json
  }
  catch {
    Write-Issue -Level "ERROR" -File $file.Name -Message "Invalid JSON: $($_.Exception.Message)"
    continue
  }

  if (-not $json."minecraft:item") {
    Write-Issue -Level "ERROR" -File $file.Name -Message "Missing minecraft:item root"
    continue
  }

  $components = $json."minecraft:item".components
  if (-not $components) {
    Write-Issue -Level "ERROR" -File $file.Name -Message "Missing components"
    continue
  }

  $hasUseModifiers = $components.PSObject.Properties.Name -contains "minecraft:use_modifiers"
  $useAnimation = if ($components.PSObject.Properties.Name -contains "minecraft:use_animation") { $components."minecraft:use_animation" } else { $null }
  $useDuration = if ($components.PSObject.Properties.Name -contains "minecraft:use_duration") { $components."minecraft:use_duration" } else { $null }

  if ($useAnimation -ne "eat") {
    Write-Issue -Level "ERROR" -File $file.Name -Message "minecraft:use_animation must be 'eat'"
  }

  if ($useDuration -ne 1.6) {
    Write-Issue -Level "ERROR" -File $file.Name -Message "minecraft:use_duration must be 1.6 (about vanilla eating speed)"
  }

  if ($hasUseModifiers) {
    Write-Issue -Level "WARN" -File $file.Name -Message "minecraft:use_modifiers is present; this pack currently ships without eating slowdown because Bedrock did not apply it reliably"
  }

  $food = $components."minecraft:food"
  if (-not $food) {
    continue
  }

  if ($food.nutrition -lt 1) {
    Write-Issue -Level "ERROR" -File $file.Name -Message "nutrition must be >= 1"
  }

  if (-not ($food.PSObject.Properties.Name -contains "saturation_modifier")) {
    Write-Issue -Level "ERROR" -File $file.Name -Message "Missing saturation_modifier"
  }

  if ($food.saturation_modifier -is [string]) {
    Write-Issue -Level "WARN" -File $file.Name -Message "saturation_modifier is string; numeric value is recommended in this pack"
  }

  if ($food.PSObject.Properties.Name -contains "effects") {
    Write-Issue -Level "WARN" -File $file.Name -Message "minecraft:food.effects is present; this pack uses script-driven effects for reliability"
    $index = 0
    foreach ($effect in $food.effects) {
      $index += 1
      if (-not $effect.name) {
        Write-Issue -Level "ERROR" -File $file.Name -Message "effects[$index] missing name"
      }
      if (-not ($effect.PSObject.Properties.Name -contains "chance")) {
        Write-Issue -Level "ERROR" -File $file.Name -Message "effects[$index] missing chance"
      }
      if (-not ($effect.PSObject.Properties.Name -contains "duration")) {
        Write-Issue -Level "ERROR" -File $file.Name -Message "effects[$index] missing duration"
      }
      if (-not ($effect.PSObject.Properties.Name -contains "amplifier")) {
        Write-Issue -Level "ERROR" -File $file.Name -Message "effects[$index] missing amplifier"
      }
    }
  }
}

if ($hadErrors) {
  Write-Host ""
  Write-Host "Validation failed. Fix the errors above."
  exit 1
}

Write-Host ""
Write-Host "Validation passed: all food items use stable settings (1.6s consume + script-driven post-eat effects policy)."
