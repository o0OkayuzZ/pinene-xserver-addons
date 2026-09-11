$ErrorActionPreference='Stop'
$dataDir=Join-Path $env:LOCALAPPDATA 'PINE SERVER\Admin'
$runtime=Get-Content -LiteralPath (Join-Path $dataDir 'runtime.json') -Raw -Encoding UTF8 | ConvertFrom-Json
function Get-ReadySession {
 try {
  $session=Get-Content -LiteralPath (Join-Path $dataDir 'session.json') -Raw -Encoding UTF8 | ConvertFrom-Json
  $uri=[Uri]$session.url
  if($uri.Host -ne '127.0.0.1' -or $uri.Port -ne 18473){return $null}
  $result=Invoke-WebRequest -Uri 'http://127.0.0.1:18473/api/state' -Headers @{Authorization=('Bearer '+$uri.Fragment.Substring(1))} -UseBasicParsing -TimeoutSec 2
  if($result.StatusCode -eq 200){return $session}
 }catch{}
 return $null
}
$session=Get-ReadySession
if(-not $session){
 $args=@(('"'+$runtime.server+'"'))
 Start-Process -FilePath $runtime.node -ArgumentList $args -WorkingDirectory $PSScriptRoot -WindowStyle Hidden -RedirectStandardOutput (Join-Path $dataDir 'server.log') -RedirectStandardError (Join-Path $dataDir 'server-error.log')
 for($attempt=0;$attempt -lt 30;$attempt++){
  Start-Sleep -Milliseconds 300
  $session=Get-ReadySession
  if($session){break}
 }
}
if(-not $session){Add-Type -AssemblyName PresentationFramework;[System.Windows.MessageBox]::Show('管理画面を起動できませんでした。ポート18473とNode.jsを確認してください。','PINE SERVER');exit 1}
Start-Process $session.url
