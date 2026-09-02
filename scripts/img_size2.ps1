Add-Type -AssemblyName System.Drawing
$files = @(
  'c:\Users\28188\.trae-cn\attachments\6a853f9e33842c03da342417\1f09de0b-7a55-4770-b623-fbbad3a5f32f_bd7503d4-14dc-4bc3-920f-789a9cc48412_SepulcherBodyEnergyBall.png',
  'c:\Users\28188\.trae-cn\attachments\6a853f9e33842c03da342417\2b6a6c83-a707-45e5-b4ee-97e68e38fe83_be177825-258a-452b-aff1-ed12dcb067e0_SepulcherArm.png',
  'c:\Users\28188\.trae-cn\attachments\6a853f9e33842c03da342417\dae3b61f-9f2e-4c69-96ee-084a481de9f7_96a994e7-ea54-476a-a938-34944322c579_SepulcherForearm.png',
  'c:\Users\28188\.trae-cn\attachments\6a853f9e33842c03da342417\f3b68afe-d416-49e4-8e65-be46d0690c0e_9d7b0abb-ce6a-4139-aadb-9890b74e0867_SepulcherHand.png',
  'c:\Users\28188\.trae-cn\attachments\6a853f9e33842c03da342417\540db23e-c1ca-4570-80d9-68b2ef66ae85_abab42af-8fad-4858-b534-bbf90af10dad_Sepulcher_Body.png',
  'c:\Users\28188\.trae-cn\attachments\6a853f9e33842c03da342417\88af75aa-1723-48bb-a9c2-80a0e7fb7768_8b321491-e5e2-4578-9a15-b65f81daab7f_Sepulcher_Head.png',
  'c:\Users\28188\.trae-cn\attachments\6a853f9e33842c03da342417\eb72b691-9ff2-4dd8-90b0-9ff67bbb2864_a5476753-9baa-4748-8d77-6b0d37c65d76_Sepulcher_Tail.png'
)
foreach ($f in $files) {
  if (Test-Path $f) {
    $img = [System.Drawing.Image]::FromFile($f)
    Write-Output ((Split-Path $f -Leaf) + ' => ' + $img.Width + 'x' + $img.Height)
    $img.Dispose()
  } else {
    Write-Output ('MISSING: ' + $f)
  }
}
