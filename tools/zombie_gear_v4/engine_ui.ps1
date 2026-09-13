param([int[]]$Keys=@(),[switch]$RightClick,[double]$HoldSeconds=0.1,[string]$Output=(Join-Path $env:USERPROFILE 'Downloads/zg-validation/game.png'))
Add-Type -AssemblyName System.Drawing
Add-Type @'
using System; using System.Runtime.InteropServices;
public class ZGInput {
 [DllImport("user32.dll")] public static extern void keybd_event(byte vk,byte scan,uint flags,UIntPtr extra);
 [DllImport("user32.dll")] public static extern void mouse_event(uint flags,uint dx,uint dy,uint data,UIntPtr extra);
 [DllImport("user32.dll")] public static extern IntPtr GetForegroundWindow();
 [DllImport("user32.dll")] public static extern uint MapVirtualKey(uint key,uint mode);
 [StructLayout(LayoutKind.Sequential)] public struct Rect { public int left,top,right,bottom; }
 [DllImport("dwmapi.dll")] public static extern int DwmGetWindowAttribute(IntPtr h,int a,out Rect r,int size);
}
'@
$game=Get-Process Minecraft.Windows
{
 $app=New-Object -ComObject WScript.Shell
 if (!$app.AppActivate($game.Id)) { throw 'Cannot focus Minecraft' }
 Start-Sleep -Milliseconds 250
 if ([ZGInput]::GetForegroundWindow() -ne $game.MainWindowHandle) { throw 'Minecraft lost focus' }
 foreach($key in $Keys) {
  $scan=[byte][ZGInput]::MapVirtualKey($key,0)
  [ZGInput]::keybd_event([byte]$key,$scan,0,[UIntPtr]::Zero)
  Start-Sleep -Milliseconds ([int]($HoldSeconds*1000))
  [ZGInput]::keybd_event([byte]$key,$scan,2,[UIntPtr]::Zero)
  Start-Sleep -Milliseconds 300
 }
 if ($RightClick) {
  [ZGInput]::mouse_event(8,0,0,0,[UIntPtr]::Zero)
  Start-Sleep -Milliseconds ([int]($HoldSeconds*1000))
  [ZGInput]::mouse_event(16,0,0,0,[UIntPtr]::Zero)
 }
 Start-Sleep -Milliseconds 1000
}.Invoke()
$rect=New-Object ZGInput+Rect
[void][ZGInput]::DwmGetWindowAttribute($game.MainWindowHandle,9,[ref]$rect,16)
$bitmap=New-Object System.Drawing.Bitmap(($rect.right-$rect.left),($rect.bottom-$rect.top))
$graphics=[System.Drawing.Graphics]::FromImage($bitmap)
$graphics.CopyFromScreen($rect.left,$rect.top,0,0,$bitmap.Size)
$bitmap.Save($Output)
$graphics.Dispose();$bitmap.Dispose()
