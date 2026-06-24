# Atualização diária da dashboard (sem navegador)

`update-dashboard.mjs` substitui o antigo robô Playwright. Ele lê as planilhas
`.xlsm`, usa o **mesmo parser do front-end** (`src/parse-workbook.js` — fonte da
verdade única) e sobe o `data.json` direto pro Supabase Storage com a chave
`service_role`. Sem Chrome headless, sem depender da UI.

## Setup (uma vez)

1. **Node 18+** instalado na máquina que roda o job.
2. Na pasta do projeto, instalar dependências (baixa o SheetJS):
   ```
   npm install
   ```
3. Ter a **chave `service_role`** do Supabase (painel: Project Settings → API →
   `service_role`). ⚠️ **Nunca** commitar essa chave nem colocá-la no front-end.

## Rodar

Defina a env var `SUPABASE_SERVICE_ROLE` e rode:

```bash
# Linux/macOS
SUPABASE_SERVICE_ROLE="cole_a_chave_aqui" npm run update

# Windows (PowerShell)
$env:SUPABASE_SERVICE_ROLE="cole_a_chave_aqui"; npm run update
```

Variáveis opcionais:
- `SETORIAL_DIR` — pasta das planilhas (default: `G:\Meu Drive\Arquivos\Setorial - Proteínas`)
- `SUPABASE_URL` — default já aponta pro projeto certo

## Agendamento diário

Troque a chamada do antigo `python atualiza_dashboard.py` por:

```
npm run update
```

(no Agendador de Tarefas do Windows / cron, com a env var `SUPABASE_SERVICE_ROLE`
definida no ambiente do job).

## Notas

- **Mescla segura:** o script busca o `data.json` atual antes e sobrepõe só o que
  conseguiu ler. Se uma planilha estiver faltando, a seção dela é preservada (não
  apaga).
- **Imune a login/bucket privado:** a `service_role` ignora RLS e privacidade, então
  se um dia a leitura da dash for protegida, este upload continua funcionando.
- **Um parser só:** qualquer mudança de mapeamento de coluna vive em
  `src/parse-workbook.js` e vale pros dois (front + script) — sem divergência.
- O antigo `atualiza_dashboard.py` (Playwright) pode ser mantido como fallback até
  este estar validado em produção.
