# API de atualização por planilha

O endpoint `POST /api/update-dashboard?dataset=...` atualiza apenas a planilha do dataset atual.

Datasets aceitos:

- `beef_br` -> `BeefBR.xlsm`
- `beef_us` -> `BeefUS.xlsm`
- `poultry_br` -> `FrangoBR.xlsm`
- `poultry_us` -> `FrangoUS.xlsm`
- `macro` -> `Planilha - Selic.xlsm`

## Variáveis no Vercel

Obrigatórias:

- `SUPABASE_SERVICE_ROLE`
- `GOOGLE_SERVICE_ACCOUNT_EMAIL`
- `GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY`

Escolha uma das duas formas para localizar as planilhas:

### Opção A: pasta compartilhada

- `GOOGLE_DRIVE_FOLDER_ID`

A conta de serviço precisa ter acesso à pasta que contém as cinco planilhas.

### Opção B: IDs individuais

- `GOOGLE_DRIVE_BEEF_BR_FILE_ID`
- `GOOGLE_DRIVE_BEEF_US_FILE_ID`
- `GOOGLE_DRIVE_POULTRY_BR_FILE_ID`
- `GOOGLE_DRIVE_POULTRY_US_FILE_ID`
- `GOOGLE_DRIVE_SELIC_FILE_ID`

Esta opção é mais explícita e evita problemas com atalhos do Google Drive.

## Conta de serviço

1. Crie uma service account no Google Cloud.
2. Gere uma chave JSON.
3. Compartilhe a pasta ou os arquivos do Drive com o e-mail da service account.
4. Copie `client_email` para `GOOGLE_SERVICE_ACCOUNT_EMAIL`.
5. Copie `private_key` para `GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY`.

No Vercel, a private key pode ser colada mantendo os `\n` ou com quebras de linha reais.
