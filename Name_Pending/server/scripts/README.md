# JSE (Jamaica Stock Exchange) scraper

Scrapes trade quotes, trade summary, and index information from [jamstockex.com](https://www.jamstockex.com).

## Setup

From the repo root or `server/`:

```bash
pip install -r server/scripts/requirements.txt
```

Or from `server/`:

```bash
pip install -r scripts/requirements.txt
```

## Run

From `server/`:

```bash
npm run scrape:jse
```

Or directly:

```bash
python scripts/scrape_jamstockex.py
```

On Windows, use `py scripts/scrape_jamstockex.py` if `python` is not in PATH.

CSV files are written in the current working directory (`trade_quotes_table_1.csv`, etc.).
