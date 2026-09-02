try {
  $r = Invoke-WebRequest -Uri 'http://localhost:5173/' -UseBasicParsing -TimeoutSec 5
  Write-Output ('STATUS: ' + $r.StatusCode)
} catch {
  Write-Output ('ERR: ' + $_.Exception.Message)
}
