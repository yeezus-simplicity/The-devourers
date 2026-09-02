Add-Type -AssemblyName System.Drawing
$src = 'd:\workspace\scourge-game\sepulcher_current.png'
$img = [System.Drawing.Image]::FromFile($src)
Write-Output ('Source: ' + $img.Width + 'x' + $img.Height)
$x = [int]450
$y = [int]300
$cw = [int]500
$ch = [int]400
$zoom = [int]2
$rect = New-Object System.Drawing.Rectangle($x, $y, $cw, $ch)
$ow = [int]($cw * $zoom)
$oh = [int]($ch * $zoom)
$bmp = New-Object System.Drawing.Bitmap($ow, $oh)
$g = [System.Drawing.Graphics]::FromImage($bmp)
$g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::NearestNeighbor
$g.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::Half
$dest = New-Object System.Drawing.Rectangle(0, 0, $ow, $oh)
$g.DrawImage($img, $dest, $rect, [System.Drawing.GraphicsUnit]::Pixel)
$g.Dispose()
$out = 'd:\workspace\scourge-game\sepulcher_zoom.png'
$bmp.Save($out, [System.Drawing.Imaging.ImageFormat]::Png)
$bmp.Dispose()
$img.Dispose()
Write-Output ('Saved: ' + $out)
