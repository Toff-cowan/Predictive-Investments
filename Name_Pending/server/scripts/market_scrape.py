# This is our roject script tha we will use to scrape the top 100 most active stocks from Yahoo so that we can have data for our predictive AI Model
import os
import time
import pandas as pd
import yfinance as yf
import matplotlib.pyplot as plt

# Configuration
TOP_COUNT = 100
CHART_PERIOD = "6mo"      # 1mo, 3mo, 6mo, 1y, 2y, 5y, max
CHART_INTERVAL = "1d"     # 1d, 1wk, 1mo, etc.
OUTPUT_DIR = "yahoo_top_100_output"
CHARTS_DIR = os.path.join(OUTPUT_DIR, "charts")
CSV_FILE = os.path.join(OUTPUT_DIR, "top_100_summary.csv")

os.makedirs(CHARTS_DIR, exist_ok=True)


# Get top 100 most active stocks
def get_top_100_most_active():
    """
    Uses yfinance's predefined screener convenience wrapper.
    This is the simplest way to pull Yahoo's most-active list.
    """
    try:
        data = yf.screen("most_actives", count=TOP_COUNT)
    except Exception as e:
        raise RuntimeError(f"Could not load Yahoo most active list: {e}")

    quotes = data.get("quotes", [])
    symbols = []

    for item in quotes[:TOP_COUNT]:
        symbol = item.get("symbol")
        if symbol:
            symbols.append(symbol)

    return symbols

# Get stock summary
def get_stock_summary(symbol: str):
    """
    Pull quote fields for one stock.
    """
    ticker = yf.Ticker(symbol)

    info = {}
    try:
        info = ticker.info
    except Exception:
        info = {}

    return {
        "symbol": symbol,
        "name": info.get("shortName", ""),
        "current_price": info.get("currentPrice", info.get("regularMarketPrice", None)),
        "day_high": info.get("dayHigh", None),
        "day_low": info.get("dayLow", None),
        "fifty_two_week_high": info.get("fiftyTwoWeekHigh", None),
        "fifty_two_week_low": info.get("fiftyTwoWeekLow", None),
        "volume": info.get("volume", None),
        "average_volume": info.get("averageVolume", None),
        "market_cap": info.get("marketCap", None),
        "exchange": info.get("exchange", ""),
        "currency": info.get("currency", "")
    }

# Get chart data
def get_chart_data(symbol: str, period=CHART_PERIOD, interval=CHART_INTERVAL):
    ticker = yf.Ticker(symbol)
    hist = ticker.history(period=period, interval=interval, auto_adjust=False) # get chart data

    if hist.empty:
        return hist

    hist = hist.reset_index()
    return hist



def save_chart_image(symbol: str, hist: pd.DataFrame): # save chart image
    if hist.empty:
        return

    date_col = "Date" if "Date" in hist.columns else hist.columns[0]

    plt.figure(figsize=(10, 5))
    plt.plot(hist[date_col], hist["Close"])
    plt.title(f"{symbol} Close Price")
    plt.xlabel("Date")
    plt.ylabel("Price")
    plt.xticks(rotation=45)
    plt.tight_layout()
    plt.savefig(os.path.join(CHARTS_DIR, f"{symbol}.png"))
    plt.close()


# Main function
def main():
    print("Loading top 100 most active stocks...")
    symbols = get_top_100_most_active()
    print(f"Found {len(symbols)} symbols")

    summary_rows = []

    for i, symbol in enumerate(symbols, start=1):
        print(f"[{i}/{len(symbols)}] Processing {symbol}")

        try:
            summary = get_stock_summary(symbol)
            summary_rows.append(summary)

            hist = get_chart_data(symbol)
            if not hist.empty:
                hist.to_csv(os.path.join(OUTPUT_DIR, f"{symbol}_history.csv"), index=False)
                save_chart_image(symbol, hist)
            time.sleep(0.5)# reduce API calls

        except Exception as e:
            print(f"Failed for {symbol}: {e}")

    df = pd.DataFrame(summary_rows)
    df.to_csv(CSV_FILE, index=False)

    print(f"\nSaved summary file: {CSV_FILE}")
    print(f"Saved chart CSVs and PNG charts in: {OUTPUT_DIR}")


if __name__ == "__main__":
    main()