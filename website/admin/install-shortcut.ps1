param([Parameter(Mandatory=$true)][string]$NodePath)
$ErrorActionPreference='Stop'
$resolvedNode=(Resolve-Path -LiteralPath $NodePath).Path
$dataDir=Join-Path $env:LOCALAPPDATA 'PINE SERVER\Admin'
New-Item -ItemType Directory -Path $dataDir -Force | Out-Null
$runtime=@{node=$resolvedNode;server=(Join-Path $PSScriptRoot 'server.mjs')} | ConvertTo-Json
[IO.File]::WriteAllText((Join-Path $dataDir 'runtime.json'),$runtime,(New-Object Text.UTF8Encoding($false)))
$desktop=[Environment]::GetFolderPath('Desktop')
$linkPath=Join-Path $desktop 'PINE SERVER 管理画面.lnk'
if(Test-Path -LiteralPath $linkPath){throw '同名のショートカットがあります。既存のアイコンを保全するため停止しました。'}
$shell=New-Object -ComObject WScript.Shell
$shortcut=$shell.CreateShortcut($linkPath)
$shortcut.TargetPath=(Join-Path $env:SystemRoot 'System32\WindowsPowerShell\v1.0\powershell.exe')
$shortcut.Arguments='-NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File "'+(Join-Path $PSScriptRoot 'launch.ps1')+'"'
$shortcut.WorkingDirectory=$PSScriptRoot
$shortcut.WindowStyle=7
$shortcut.Description='PINE SERVERの非公開アクセス管理画面'
$shortcut.IconLocation=(Join-Path $env:SystemRoot 'System32\shell32.dll')+',22'
$shortcut.Save()
Write-Output 'PINE SERVER 管理画面のデスクトップショートカットを作成しました。'
