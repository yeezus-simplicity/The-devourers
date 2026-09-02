Add-Type -AssemblyName System.Drawing
$src = 'd:\workspace\scourge-game\sepulcher_stable.png'
$img = [System.Drawing.Image]::FromFile($src)
Write-Output ('Source: ' + $img.Width + 'x' + $img.Height)
# Crop center region (boss area) - assume boss near center
$cw = [Math]::Min(700, $img.Width)
$ch = [Math]::Min(700, $img.Height)
$x = [Math]::Max(0, [int](($img.Width - $cw) / 2))
$y = [Math]::Max(0, [int](($img.Height - $ch) / 2))
$rect = New-Object System.Drawing.Rectangle($x, $y, $cw, $ch)
$bmp = New-Object System.Drawing.Bitmap($cw, $ch)
$g = [System.Drawing.Graphics]::FromImage($bmp)
$g.DrawImage($img, 0, 0, $rect, [System.Drawing.GraphicsUnit]::Pixel)
$g.Dispose()
$out = 'd:\workspace\scourge-game\sepulcher_crop.png'
$bmp.Save($out, [System.Drawing.Imaging.ImageFormat]::Png)
$bmp.Dispose()
$img.Dispose()
Write-Output ('Saved: ' + $out)
