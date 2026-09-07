param(
  [Parameter(Mandatory = $true)]
  [string]$IdentifierSuffix,

  [string]$Namespace = "resetapple",
  [string]$Icon,
  [string]$DisplayNameJa = "",
  [string]$DisplayNameEn = "",

  [ValidateRange(1, 200)]
  [int]$Nutrition = 18,

  [ValidateRange(0.0, 3.0)]
  [double]$SaturationModifier = 1.2,

  [ValidateSet("none", "blue_diamond", "enchanted_blue_diamond")]
  [string]$EffectsPreset = "none",

  [string]$OutputDir = ""
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

function Write-Utf8NoBom {
  param(
    [Parameter(Mandatory = $true)][string]$Path,
    [Parameter(Mandatory = $true)][string]$Text
  )

  $utf8NoBom = New-Object System.Text.UTF8Encoding($false)
  [System.IO.File]::WriteAllText($Path, $Text, $utf8NoBom)
}

if ([string]::IsNullOrWhiteSpace($Icon)) {
  $Icon = $IdentifierSuffix
}

if ([string]::IsNullOrWhiteSpace($OutputDir)) {
  $OutputDir = Join-Path (Split-Path -Parent $PSScriptRoot) "items"
}

if (-not (Test-Path -LiteralPath $OutputDir)) {
  New-Item -ItemType Directory -Path $OutputDir | Out-Null
}

$effects = @()
switch ($EffectsPreset) {
  "blue_diamond" {
    $effects = @(
      @{ name = "regeneration"; chance = 1.0; duration = 600; amplifier = 1 },
      @{ name = "water_breathing"; chance = 1.0; duration = 14400; amplifier = 0 },
      @{ name = "night_vision"; chance = 1.0; duration = 14400; amplifier = 0 },
      @{ name = "speed"; chance = 1.0; duration = 7200; amplifier = 1 }
    )
  }
  "enchanted_blue_diamond" {
    $effects = @(
      @{ name = "regeneration"; chance = 1.0; duration = 1800; amplifier = 2 },
      @{ name = "absorption"; chance = 1.0; duration = 36000; amplifier = 3 },
      @{ name = "resistance"; chance = 1.0; duration = 24000; amplifier = 1 },
      @{ name = "conduit_power"; chance = 1.0; duration = 36000; amplifier = 0 },
      @{ name = "water_breathing"; chance = 1.0; duration = 36000; amplifier = 0 },
      @{ name = "night_vision"; chance = 1.0; duration = 36000; amplifier = 0 },
      @{ name = "speed"; chance = 1.0; duration = 24000; amplifier = 1 }
    )
  }
}

$food = [ordered]@{
  nutrition = $Nutrition
  saturation_modifier = $SaturationModifier
  can_always_eat = $true
}

$itemJson = [ordered]@{
  format_version = "1.20.30"
  "minecraft:item" = [ordered]@{
    description = [ordered]@{
      identifier = ('{0}:{1}' -f $Namespace, $IdentifierSuffix)
      category = "items"
    }
    components = [ordered]@{
      "minecraft:display_name" = [ordered]@{
        value = if ([string]::IsNullOrWhiteSpace($DisplayNameJa)) { $IdentifierSuffix } else { $DisplayNameJa }
      }
      "minecraft:icon" = $Icon
      "minecraft:max_stack_size" = 64
      # Known-good combination for food consumption + effect application.
      "minecraft:use_animation" = "eat"
      "minecraft:use_duration" = 1.6
      "minecraft:food" = $food
    }
  }
}

$fileName = "$IdentifierSuffix.item.json"
$outPath = Join-Path $OutputDir $fileName
$jsonText = $itemJson | ConvertTo-Json -Depth 12
Write-Utf8NoBom -Path $outPath -Text ($jsonText + [Environment]::NewLine)

Write-Host "Created: $outPath"
Write-Host ""
Write-Host "Add these language keys manually if needed:"
Write-Host ('item.{0}:{1}.name={2}' -f $Namespace, $IdentifierSuffix, $DisplayNameEn)
Write-Host ('item.{0}.{1}.name={2}' -f $Namespace, $IdentifierSuffix, $DisplayNameEn)
Write-Host ('item.{0}:{1}.name={2}' -f $Namespace, $IdentifierSuffix, $DisplayNameJa)
Write-Host ('item.{0}.{1}.name={2}' -f $Namespace, $IdentifierSuffix, $DisplayNameJa)

if ($effects.Count -gt 0) {
  Write-Host ""
  Write-Host "This pack uses script-driven food effects. Add the following entry to scripts/main.js FOOD_EFFECTS_BY_ITEM:"
  $effectJson = $effects | ConvertTo-Json -Depth 10 -Compress
  Write-Host ('"{0}:{1}": {2}' -f $Namespace, $IdentifierSuffix, $effectJson)
}
