"""
Scrape Yahoo Finance news headlines for a given ticker.
Outputs JSON array to stdout for consumption by the API.
Usage: python news_scraper.py <TICKER> [max_items]
"""
import json
import sys
import requests
from bs4 import BeautifulSoup
from urllib.parse import urljoin


def scrape_yahoo_news(ticker: str, max_items: int = 20) -> list[dict]:
    url = f"https://finance.yahoo.com/quote/{ticker}"
    headers = {
        "User-Agent": (
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
            "AppleWebKit/537.36 (KHTML, like Gecko) "
            "Chrome/123.0.0.0 Safari/537.36"
        )
    }

    response = requests.get(url, headers=headers, timeout=20)
    response.raise_for_status()

    soup = BeautifulSoup(response.text, "html.parser")
    articles: list[dict] = []
    seen_links: set[str] = set()

    for a_tag in soup.find_all("a", href=True):
        href = a_tag["href"]

        if "/news/" not in href:
            continue

        full_link = urljoin("https://finance.yahoo.com", href)

        if full_link in seen_links:
            continue

        title = a_tag.get_text(" ", strip=True)
        if not title or len(title) < 15:
            continue

        seen_links.add(full_link)

        source = None
        published = None
        parent = a_tag.parent
        if parent:
            small_bits = parent.find_all(["span", "div"])
            extracted_text = " ".join(
                x.get_text(" ", strip=True) for x in small_bits if x.get_text(" ", strip=True)
            )
            if extracted_text:
                meta_parts = extracted_text.split("•")
                if len(meta_parts) >= 2:
                    source = meta_parts[0].strip()
                    published = meta_parts[1].strip()
                else:
                    source = extracted_text[:80] if len(extracted_text) > 80 else extracted_text

        articles.append({
            "ticker": ticker.upper(),
            "title": title,
            "link": full_link,
            "source": source or "Unknown",
            "published": published or "Unknown",
        })

        if len(articles) >= max_items:
            break

    return articles


def main() -> None:
    ticker = (sys.argv[1] or "AAPL").strip().upper()
    max_items = int(sys.argv[2]) if len(sys.argv) > 2 else 20
    try:
        news = scrape_yahoo_news(ticker, max_items=max_items)
        print(json.dumps(news, ensure_ascii=False))
    except Exception as e:
        print(json.dumps({"error": str(e), "items": []}), file=sys.stderr)
        sys.exit(1)


if __name__ == "__main__":
    main()
