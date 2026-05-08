"""
Fetches macroeconomic series and writes public/macro-data.json.

IPCA        - BCB SGS 433   (variação mensal %, fonte IBGE via BCB)
SELIC       - BCB SGS 432   (meta para taxa Selic — série diária, chunked)
IGP-M       - BCB SGS 189   (variação mensal %, fonte FGV via BCB)
TJLP        - BCB SGS 4175  (taxa % a.m., fim de período)
PTAX        - BCB SGS 1     (R$/USD, fim de período — série diária, chunked)
PTAX diária - BCB SGS 1     (últimos 2 anos, dados diários)
CPI-US      - BLS CUUR0000SA0 (All items, not seasonally adjusted)
"""

import json, os, sys, time, urllib.request
from datetime import datetime, timedelta, timezone

OUT_PATH = os.path.join(os.path.dirname(__file__), '..', 'public', 'macro-data.json')
TIMEOUT  = 60   # por chunk — chunks menores evitam timeout


# ── helpers ──────────────────────────────────────────────────────────────────

def get_json(url):
    req = urllib.request.Request(url, headers={'User-Agent': 'macro-dashboard/1.0'})
    with urllib.request.urlopen(req, timeout=TIMEOUT) as r:
        return json.loads(r.read().decode())


def to_monthly_last(rows):
    """Daily or monthly BCB rows → last value of each calendar month."""
    monthly = {}
    for row in rows:
        try:
            d, m, y = row['data'].split('/')
            valor = row.get('valor', '').strip()
            if not valor or valor in ('null', 'None'):
                continue
            monthly[(int(y), int(m))] = float(valor.replace(',', '.'))
        except Exception:
            continue
    return [{'year': y, 'month': m, 'value': v}
            for (y, m), v in sorted(monthly.items())]


def to_daily(rows):
    """BCB rows → daily values [{year, month, day, value}]."""
    result = []
    for row in rows:
        try:
            d, m, y = row['data'].split('/')
            valor = row.get('valor', '').strip()
            if not valor or valor in ('null', 'None'):
                continue
            result.append({'year': int(y), 'month': int(m), 'day': int(d),
                           'value': float(valor.replace(',', '.'))})
        except Exception:
            continue
    return result


def fetch_bcb(code, label, start='01/01/1990'):
    """Single-request fetch — adequado para séries mensais/esparsas."""
    url = (f'https://api.bcb.gov.br/dados/serie/bcdata.sgs.{code}/dados'
           f'?formato=json&dataInicial={start}')
    print(f'  BCB {code} ({label})...', end=' ', flush=True)
    try:
        data = get_json(url)
        if not isinstance(data, list):
            print('resposta inesperada')
            return []
        print(f'{len(data)} pontos')
        return data
    except Exception as e:
        print(f'ERRO: {e}')
        return []


def fetch_bcb_chunked(code, label, start_year=2000, chunk=5):
    """Chunked fetch para séries diárias grandes (evita timeout)."""
    print(f'  BCB {code} ({label}) chunked...', end=' ', flush=True)
    all_rows = []
    end_year = datetime.now().year
    for y in range(start_year, end_year + 1, chunk):
        y_end = min(y + chunk - 1, end_year)
        url = (f'https://api.bcb.gov.br/dados/serie/bcdata.sgs.{code}/dados'
               f'?formato=json&dataInicial=01/01/{y}&dataFinal=31/12/{y_end}')
        try:
            data = get_json(url)
            if isinstance(data, list):
                all_rows.extend(data)
        except Exception as e:
            print(f'[{y}-{y_end}: {e}]', end=' ')
    print(f'{len(all_rows)} pontos')
    return all_rows


# ── BLS CPI-US ───────────────────────────────────────────────────────────────

def fetch_cpi_us():
    series_id    = 'CUUR0000SA0'
    current_year = datetime.now().year
    all_rows     = {}

    print('  BLS CPI-US...', end=' ', flush=True)
    for start in range(2005, current_year + 1, 3):
        end = min(start + 2, current_year)
        url = (f'https://api.bls.gov/publicAPI/v1/timeseries/data/{series_id}'
               f'?startyear={start}&endyear={end}')
        try:
            resp = get_json(url)
            status = resp.get('status', '')
            if status != 'REQUEST_SUCCEEDED':
                msgs = resp.get('message', [])
                print(f'[{start}-{end}: BLS status={status} {msgs}]', end=' ')
                time.sleep(3)
                continue
            for s in resp.get('Results', {}).get('series', []):
                for pt in s.get('data', []):
                    period = pt.get('period', '')
                    if not period.startswith('M') or period == 'M13':
                        continue
                    all_rows[(int(pt['year']), int(period[1:]))] = float(pt['value'])
        except Exception as e:
            print(f'[{start}-{end}: {e}]', end=' ')
        time.sleep(1)  # evita rate-limit entre chunks

    rows = [{'year': y, 'month': m, 'value': v}
            for (y, m), v in sorted(all_rows.items())]
    print(f'{len(rows)} pontos')
    return rows


# ── main ─────────────────────────────────────────────────────────────────────

def main():
    print('Buscando dados macro...')

    ipca_raw  = fetch_bcb(433,  'IPCA mensal %')                  # mensal — request único
    igpm_raw  = fetch_bcb(189,  'IGP-M mensal %')                  # mensal — request único
    tjlp_raw  = fetch_bcb(4175, 'TJLP')                            # mensal — request único
    selic_raw = fetch_bcb_chunked(432,  'SELIC target', 1994, 5)  # diária — chunked desde 1994
    ptax_raw  = fetch_bcb_chunked(1,    'PTAX R$/USD',  1990, 5)  # diária — chunked desde 1990
    cpi_raw   = fetch_cpi_us()

    cutoff_2y = (datetime.now() - timedelta(days=730)).strftime('%d/%m/%Y')
    ptax_daily_raw = fetch_bcb(1, 'PTAX diária 2a', start=cutoff_2y)  # últimos 2 anos

    result = {
        'updated': datetime.now(timezone.utc).strftime('%Y-%m-%dT%H:%M:%SZ'),
        'series': {
            'ipca':       to_monthly_last(ipca_raw),
            'selic':      to_monthly_last(selic_raw),
            'igpm':       to_monthly_last(igpm_raw),
            'tjlp':       to_monthly_last(tjlp_raw),
            'ptax':       to_monthly_last(ptax_raw),
            'ptax_daily': to_daily(ptax_daily_raw),
            'cpi_us':     cpi_raw,
        },
    }

    counts = {k: len(v) for k, v in result['series'].items()}
    print('Pontos por série:', counts)

    os.makedirs(os.path.dirname(os.path.abspath(OUT_PATH)), exist_ok=True)
    with open(OUT_PATH, 'w', encoding='utf-8') as f:
        json.dump(result, f, ensure_ascii=False, separators=(',', ':'))
    print(f'Salvo → {OUT_PATH}')

    if sum(counts.values()) == 0:
        print('ERRO: nenhuma série retornou dados.', file=sys.stderr)
        sys.exit(1)


if __name__ == '__main__':
    main()
