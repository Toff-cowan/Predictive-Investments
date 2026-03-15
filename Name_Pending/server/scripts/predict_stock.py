"""
Time-series forecast: train on historical CSV, predict future close prices.
Outputs JSON array to stdout for the API.
Usage: python predict_stock.py <SYMBOL> [forecast_days]
"""
import json
import os
import sys
import pandas as pd
import numpy as np
from sklearn.linear_model import LinearRegression

OUTPUT_DIR = os.path.join(os.path.dirname(__file__), "yahoo_top_100_output")
DEFAULT_FORECAST_DAYS = 10
MAX_FORECAST_DAYS = 90


def load_historical(symbol: str) -> pd.DataFrame:
    path = os.path.join(OUTPUT_DIR, f"{symbol.upper()}_history.csv")
    if not os.path.isfile(path):
        raise FileNotFoundError(f"History not found: {symbol}")
    data = pd.read_csv(path)
    data["Date"] = pd.to_datetime(data["Date"], utc=True)
    data = data[["Date", "Close"]].sort_values("Date").dropna()
    if len(data) < 5:
        raise ValueError("Not enough history to train")
    return data


def _train_predict(data: pd.DataFrame, train_end: int, predict_start: int, predict_end: int) -> np.ndarray:
    """Train on data[:train_end], predict indices [predict_start, predict_end)."""
    data = data.copy()
    data["TimeIndex"] = np.arange(len(data))
    X_train = data.loc[: train_end - 1, ["TimeIndex"]]
    y_train = data.loc[: train_end - 1, "Close"]
    model = LinearRegression()
    model.fit(X_train, y_train)
    pred_index = np.arange(predict_start, predict_end)
    X_pred = pd.DataFrame(pred_index.reshape(-1, 1), columns=["TimeIndex"])
    return model.predict(X_pred)


def backtest_accuracy(data: pd.DataFrame, forecast_days: int) -> dict | None:
    """Backtest: train on past, predict last N days, compare to actual. Returns mae, mape, backtestDays or None."""
    n = len(data)
    backtest_days = min(forecast_days, max(2, n // 4), 30)
    if backtest_days < 2 or n < backtest_days + 5:
        return None
    train_end = n - backtest_days
    pred = _train_predict(data, train_end, train_end, n)
    actual = data["Close"].iloc[train_end:].values
    mae = float(np.mean(np.abs(actual - pred)))
    # MAPE: avoid div by zero
    with np.errstate(divide="ignore", invalid="ignore"):
        pct = np.where(actual != 0, np.abs(actual - pred) / np.abs(actual), 0)
    mape = float(np.mean(pct) * 100)
    return {"mae": round(mae, 4), "mape": round(mape, 2), "backtestDays": backtest_days}


def predict(data: pd.DataFrame, forecast_days: int) -> list[dict]:
    data = data.copy()
    data["TimeIndex"] = np.arange(len(data))
    X = data[["TimeIndex"]]
    y = data["Close"]

    model = LinearRegression()
    model.fit(X, y)

    last_date = data["Date"].iloc[-1]
    future_index = np.arange(len(data), len(data) + forecast_days)
    X_future = pd.DataFrame(future_index.reshape(-1, 1), columns=["TimeIndex"])
    predictions = model.predict(X_future)

    # Generate future business-day dates (simple: add 1 day per step)
    future_dates = pd.date_range(
        start=last_date + pd.Timedelta(days=1),
        periods=forecast_days,
        freq="B",
    )

    out = []
    for i, (dt, close) in enumerate(zip(future_dates, predictions)):
        date_str = dt.strftime("%Y-%m-%d")
        out.append({"date": date_str, "predictedClose": round(float(close), 4)})
    return out


def main() -> None:
    try:
        symbol = (sys.argv[1] or "").strip().upper()
        if not symbol:
            raise ValueError("Symbol required")
        forecast_days = int(sys.argv[2]) if len(sys.argv) > 2 else DEFAULT_FORECAST_DAYS
        forecast_days = max(1, min(MAX_FORECAST_DAYS, forecast_days))

        data = load_historical(symbol)
        result = predict(data, forecast_days)
        accuracy = backtest_accuracy(data, forecast_days)

        # Write predicted CSV to a folder for this symbol: yahoo_top_100_output/{SYMBOL}/predicted.csv
        symbol_dir = os.path.join(OUTPUT_DIR, symbol)
        os.makedirs(symbol_dir, exist_ok=True)
        pred_path = os.path.join(symbol_dir, "predicted.csv")
        pred_df = pd.DataFrame(result)
        pred_df.columns = ["Date", "Predicted_Close"]
        pred_df.to_csv(pred_path, index=False)
        print(f"Predicted CSV written to: {pred_path}", file=sys.stderr)

        out = {"predictions": result, "accuracy": accuracy}
        print(json.dumps(out, separators=(",", ":")))
    except Exception as e:
        print(json.dumps({"error": str(e), "predictions": []}), file=sys.stderr)
        sys.exit(1)


if __name__ == "__main__":
    main()
