# Run only AFTER closing Minecraft. Installs this independent addon into the
# established development world, leaving every existing pack reference intact.
$ErrorActionPreference = 'Stop'
[Console]::OutputEncoding = [System.Text.UTF8Encoding]::new()
$source = Split-Path -Parent $PSScriptRoot
$base = Join-Path $env:APPDATA 'Minecraft Bedrock\Users\Shared\games\com.mojang'
$world = Join-Path $env:APPDATA 'Minecraft Bedrock\Users\10345784260749742919\games\com.mojang\minecraftWorlds\8v9pvwiD6QQ='
$utf8 = [System.Text.UTF8Encoding]::new($false)
if (Get-Process Minecraft.Windows -ErrorAction SilentlyContinue) {
    throw 'Close Minecraft completely, then run this script again.'
}
if (!(Test-Path -LiteralPath $world)) { throw 'Expected development world was not found.' }
$levelName = (Get-Content -LiteralPath (Join-Path $world 'levelname.txt') -Raw -Encoding UTF8).Trim()
$expectedName = -join [char[]]@(0x958B,0x767A,0x7528,0x30EF,0x30FC,0x30EB,0x30C9)
if ($levelName -ne $expectedName) { throw 'Development world identity did not match. No changes made.' }
$packs = @(
    @{ Kind='behavior'; Source='BP'; Folder='Pinene_Sans_Boss_BP' },
    @{ Kind='resource'; Source='RP'; Folder='Pinene_Sans_Boss_RP' }
)
foreach ($pack in $packs) {
    $pack['Manifest'] = Get-Content -LiteralPath (Join-Path $source ($pack.Source + '\manifest.json')) -Raw -Encoding UTF8 | ConvertFrom-Json
    $pack['Path'] = Join-Path $base ('development_' + $pack.Kind + '_packs\' + $pack.Folder)
    $pack['RefsPath'] = Join-Path $world ('world_' + $pack.Kind + '_packs.json')
    $pack['Refs'] = @(Get-Content -LiteralPath $pack.RefsPath -Raw -Encoding UTF8 | ConvertFrom-Json)
    if (Test-Path -LiteralPath $pack.Path) {
        $old = Get-Content -LiteralPath (Join-Path $pack.Path 'manifest.json') -Raw -Encoding UTF8 | ConvertFrom-Json
        if ($old.header.uuid -ne $pack.Manifest.header.uuid) { throw 'Pack identity conflict. No changes made.' }
    }
}
$backup = Join-Path $base ('debug_backups\sans_install_' + (Get-Date -Format 'yyyyMMdd_HHmmss'))
New-Item -ItemType Directory -Path $backup -Force | Out-Null
foreach ($pack in $packs) {
    Copy-Item -LiteralPath $pack.RefsPath -Destination $backup
    New-Item -ItemType Directory -Path $pack.Path -Force | Out-Null
    Get-ChildItem -LiteralPath (Join-Path $source $pack.Source) | Copy-Item -Destination $pack.Path -Recurse -Force
}
try {
    if (Get-Process Minecraft.Windows -ErrorAction SilentlyContinue) { throw 'Minecraft started during installation.' }
    foreach ($pack in $packs) {
        $uuid = $pack.Manifest.header.uuid
        $refs = @($pack.Refs | Where-Object { $_.pack_id -ne $uuid })
        $refs = @(@{pack_id=$uuid; version=$pack.Manifest.header.version}) + $refs
        $json = ConvertTo-Json -InputObject $refs -Depth 10
        $temporary = $pack.RefsPath + '.sans-tmp'
        [System.IO.File]::WriteAllText($temporary, $json + [Environment]::NewLine, $utf8)
        Move-Item -LiteralPath $temporary -Destination $pack.RefsPath -Force
    }
} catch {
    foreach ($pack in $packs) {
        Copy-Item -LiteralPath (Join-Path $backup (Split-Path -Leaf $pack.RefsPath)) -Destination $pack.RefsPath -Force
    }
    throw
}
Write-Output ('Sans installed into development world. Backup: ' + $backup)
Write-Output 'Summon: /summon pinene_sans:sans ~ ~ ~'
