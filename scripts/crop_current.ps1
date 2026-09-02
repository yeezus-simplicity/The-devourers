Add-Type -AssemblyName System.Drawing
$src = 'd:\workspace\scourge-game\sepulcher_current.png'
$img = [System.Drawing.Image]::FromFile($src)
Write-Output ('Source: ' + $img.Width + 'x' + $img.Height)
# Crop the boss area: center-left region where the sepulcher stack is
$x = 200
$y = 100
$cw = 900
$ch = 700
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
