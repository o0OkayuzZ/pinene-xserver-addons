# Run after closing Minecraft. Python preserves pack-list arrays and unknown fields.
$ErrorActionPreference = 'Stop'
[Console]::OutputEncoding = [System.Text.UTF8Encoding]::new()
$installer = Join-Path $PSScriptRoot 'install_dev.py'
& python -X utf8 $installer
if ($LASTEXITCODE -ne 0) { throw 'Sans installation failed; see the error above.' }
