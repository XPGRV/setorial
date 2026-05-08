"""
Fetches macroeconomic series and writes public/macro-data.json.
Sources:
  IPCA   - IBGE SIDRA table 1737, variable 2266 (variação mensal %)
  SELIC  - BCB SGS 432  (meta para taxa SELIC)
  IGP-M  - BCB SGS 189  (variação mensal %)
  TJLP   - BCB SGS 4175 (taxa de juros de longo prazo)
  PTAX   - BCB SGS 1    (taxa de câmbio livre - dólar compra, fim de mês)
  CPI-US - BLS CUUR0000SA0 (All items, not seasonally adjusted)
"""

import json
import os
import sys
import urllib.request
import urllib.error
from collections import defaultdict
from datetime import datetime, timezone

OUT_PATH = os.path.join(os.path.dirname(__file__), '..', 'public', 'macro-data.json')


# ── Helpers ──────────────────────────────────────────────────────────────────

def get_json(url, timeout=30):
    req = urllib.request.Request(url, headers={'User-Agent': 'macro-dashboard/1.0'})
    with urllib.request.urlopen(req, timeout=timeout) as r:
        return json.loads(r.read().decode())


def to_monthly_last(bcb_rows):
    """BCB daily series → last value of each month."""
    monthly = {}
    for row in bcb_rows:
        try:
            d, m, y = row['data'].split('/')
            val = float(row['valor'].replace(',', '.'))
            monthly[(int(y), int(m))] = val  # overwrite → keep last entry
        except Exception:
            continue
    return [{'year': y, 'month': m, 'value': v}
            for (y, m), v in sorted(monthly.items())]


def to_monthly_mean(bcb_rows):
    """BCB daily series → arithmetic mean of each month."""
    buckets = defaultdict(list)
    for row in bcb_rows:
        try:
            d, m, y = row['data'].split('/')
            val = float(row['valor'].replace(',', '.'))
            buckets[(int(y), int(m))].append(val)
        except Exception:
            continue
    result = []
    for (y, m) in sorted(buckets):
        vals = buckets[(y, m)]
        result.append({'year': y, 'month': m, 'value': round(sum(vals) / len(vals), 6)})
    return result


def bcb_series(code, start='01/01/2000'):
    url = (f'https://api.bcb.gov.br/dados/serie/bcdata.sgs.{code}/dados'
           f'?formato=json&dataInicial={start}')
    print(f'  BCB SGS {code}...', end=' ', flush=True)
    try:
        data = get_json(url)
        print(f'{len(data)} pontos')
        return data
    except Exception as e:
        print(f'ERRO: {e}')
        return []


# ── IBGE SIDRA IPCA ──────────────────────────────────────────────────────────

def fetch_ipca():
    url = ('https://apisidra.ibge.gov.br/values'
           '/t/1737/n1/all/v/2266/p/all/d/v2266%202')
    print('  IBGE SIDRA IPCA...', end=' ', flush=True)
    try:
        raw = get_json(url)
        rows = []
        for item in raw[1:]:  # first element is header
            period = item.get('D2C', '')  # YYYYMM
            val_str = item.get('V', '')
            if len(period) != 6 or val_str in ('...', '-', ''):
                continue
            try:
                y = int(period[:4])
                m = int(period[4:])
                v = float(val_str.replace(',', '.'))
                rows.append({'year': y, 'month': m, 'value': v})
            except Exception:
                continue
        rows.sort(key=lambda r: (r['year'], r['month']))
        print(f'{len(rows)} pontos')
        return rows
    except Exception as e:
        print(f'ERRO: {e}')
        return []


# ── BLS CPI-US ───────────────────────────────────────────────────────────────

def fetch_cpi_us():
    """Fetch BLS CUUR0000SA0 in 3-year batches (v1 API, no key required)."""
    series_id = 'CUUR0000SA0'
    current_year = datetime.now().year
    start_year = 2005
    all_rows = {}

    print('  BLS CPI-US...', end=' ', flush=True)
    for batch_start in range(start_year, current_year + 1, 3):
        batch_end = min(batch_start + 2, current_year)
        url = (f'https://api.bls.gov/publicAPI/v1/timeseries/data/{series_id}'
               f'?startyear={batch_start}&endyear={batch_end}')
        try:
            resp = get_json(url)
            for s in resp.get('Results', {}).get('series', []):
                for pt in s.get('data', []):
                    period = pt.get('period', '')
                    if not period.startswith('M') or period == 'M13':
                        continue
                    try:
                        y = int(pt['year'])
                        m = int(period[1:])
                        v = float(pt['value'])
                        all_rows[(y, m)] = v
                    except Exception:
                        continue
        except Exception as e:
            print(f'[batch {batch_start}-{batch_end} falhou: {e}]', end=' ')

    rows = [{'year': y, 'month': m, 'value': v}
            for (y, m), v in sorted(all_rows.items())]
    print(f'{len(rows)} pontos')
    return rows


# ── Main ──────────────────────────────────────────────────────────────────────

def main():
    print('Buscando dados macro...')

    ipca_raw  = fetch_ipca()
    selic_raw = bcb_series(432)
    igpm_raw  = bcb_series(189)
    tjlp_raw  = bcb_series(4175)
    ptax_raw  = bcb_series(1)
    cpi_raw   = fetch_cpi_us()

    # SELIC target: daily series, take last value of month (rate in effect at month-end)
    # IGP-M: monthly series already, still run through to_monthly_last to normalize format
    # TJLP: quarterly/daily, take end-of-month
    # PTAX: daily, take end-of-month (fixing)
    result = {
        'updated': datetime.now(timezone.utc).strftime('%Y-%m-%dT%H:%M:%SZ'),
        'series': {
            'ipca':   ipca_raw,
            'selic':  to_monthly_last(selic_raw),
            'igpm':   to_monthly_last(igpm_raw),
            'tjlp':   to_monthly_last(tjlp_raw),
            'ptax':   to_monthly_last(ptax_raw),
            'cpi_us': cpi_raw,
        },
    }

    os.makedirs(os.path.dirname(os.path.abspath(OUT_PATH)), exist_ok=True)
    with open(OUT_PATH, 'w', encoding='utf-8') as f:
        json.dump(result, f, ensure_ascii=False, separators=(',', ':'))

    counts = {k: len(v) for k, v in result['series'].items()}
    print(f'Salvo em {OUT_PATH}')
    print('Pontos por série:', counts)

    if all(c == 0 for c in counts.values()):
        print('AVISO: nenhuma série retornou dados.', file=sys.stderr)
        sys.exit(1)


if __name__ == '__main__':
    main()
