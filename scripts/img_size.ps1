Add-Type -AssemblyName System.Drawing
Get-ChildItem -Recurse 'd:\workspace\scourge-game\public\characters\sepulcher' -Include *.png | ForEach-Object {
  $img = [System.Drawing.Image]::FromFile($_.FullName)
  Write-Output ($_.Name + ' => ' + $img.Width + 'x' + $img.Height)
  $img.Dispose()
}
