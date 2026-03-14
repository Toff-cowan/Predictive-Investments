"""
Jamaica Stock Exchange (JSE) scraper.
Fetches trade quotes, trade summary, and index information from jamstockex.com.
"""
import pandas as pd
import requests
from bs4 import BeautifulSoup

URLS = {
    "trade_quotes": "https://www.jamstockex.com/trading/trade-quotes/",
    "trade_summary": "https://www.jamstockex.com/trading/trade-summary/",
    "index_information": "https://www.jamstockex.com/trading/indices/index-information/",
}

HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36"
}


def try_read_html(url: str):
    try:
        tables = pd.read_html(url)
        return tables
    except Exception as e:
        print(f"read_html failed for {url}: {e}")
        return []


def try_requests_parse(url: str):
    try:
        resp = requests.get(url, headers=HEADERS, timeout=20)
        resp.raise_for_status()
        soup = BeautifulSoup(resp.text, "html.parser")
        return soup
    except Exception as e:
        print(f"requests parse failed for {url}: {e}")
        return None


def save_tables(name: str, tables):
    for i, table in enumerate(tables, start=1):
        filename = f"{name}_table_{i}.csv"
        table.to_csv(filename, index=False)
        print(f"Saved {filename}")


def main():
    for name, url in URLS.items():
        print(f"\nScraping: {name} -> {url}")

        tables = try_read_html(url)
        if tables:
            print(f"Found {len(tables)} table(s) with pandas.read_html")
            save_tables(name, tables)
        else:
            soup = try_requests_parse(url)
            if soup:
                print(f"Fetched HTML for {name}")
                print(soup.title.text.strip() if soup.title else "No title found")
            else:
                print(f"Could not fetch {name} with simple requests.")


if __name__ == "__main__":
    main()
