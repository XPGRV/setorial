Set-Location "C:\Users\gabri\Desktop\dashboard-proteinas"

# Cole aqui a service_role atual do Supabase.
$env:SUPABASE_SERVICE_ROLE="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndteGpkdmV1Y3hib3Vzb3F1d21jIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3Njk0MDAwMywiZXhwIjoyMDkyNTE2MDAzfQ.Tj5NgVh3WYq-rdAt1zkkWpQWwkfbvsnOLddl0CtzHas"

# Encontra a pasta sem depender de acento no texto do script.
$setorialDir = Get-ChildItem "G:\.shortcut-targets-by-id\11q1ngdqbySnDMCQSP4fiwPztT6ju2F4Z\Arquivos" -Directory |
  Where-Object { $_.Name -like "Setorial - Prote*" } |
  Select-Object -First 1

if (-not $setorialDir) {
  throw "Pasta das planilhas nao encontrada no Google Drive."
}

$env:SETORIAL_DIR=$setorialDir.FullName

npm run update
