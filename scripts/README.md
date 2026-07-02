# Atualização da dashboard

## Fluxo principal (automático)

A atualização diária roda pelo **GitHub Actions** (`.github/workflows/update-data.yml`):
dias úteis às 8h BRT, o workflow chama `POST /api/update-dashboard?dataset=...` no
Vercel para cada uma das 6 planilhas. O endpoint baixa o `.xlsm` direto da API do
Google Drive, parseia com `src/parse-workbook.js` e sobe o `data-<dataset>.json`
no Supabase Storage. Também dá para disparar manualmente na aba Actions
(`Run workflow`) ou pelo botão "Atualizar" na própria dashboard.

Secrets necessários no GitHub (Settings → Secrets and variables → Actions):

- `DASHBOARD_URL` — URL de produção no Vercel
- `UPDATE_CRON_SECRET` — mesmo valor da env `CRON_SECRET` no Vercel

## Fluxo alternativo (local, legado)

`update-dashboard.mjs` faz o mesmo trabalho lendo as planilhas da pasta
sincronizada do Google Drive na máquina local — útil como fallback se a API do
Drive/Vercel estiver fora. Usa o **mesmo parser do front** (`src/parse-workbook.js`,
fonte da verdade única) e grava um `data-<dataset>.json` por planilha.

```powershell
# Windows (PowerShell) — NUNCA commitar a chave
$env:SUPABASE_SERVICE_ROLE="cole_a_chave_aqui"; npm run update
```

Variáveis opcionais:

- `SETORIAL_DIR` — pasta das planilhas de proteínas
- `DATABASE_DIR` — pasta da base de dados (WEG)
- `SUPABASE_URL` — default já aponta pro projeto certo

## Notas

- **Sem merge, sem corrida:** cada planilha grava só o próprio arquivo
  `data-<dataset>.json`; uma planilha ausente simplesmente mantém o arquivo
  anterior intacto.
- **Um parser só:** qualquer mudança de mapeamento de coluna vive em
  `src/parse-workbook.js` e vale pra tudo (front, API do Vercel e script local).
