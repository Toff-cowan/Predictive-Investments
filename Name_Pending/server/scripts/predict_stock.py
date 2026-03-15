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
DEFAULT_BOUND_PCT = 2.5  # default ±% for upper/lower bound when MAPE not available


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


def _date_str(dt) -> str:
    """Return YYYY-MM-DD from a pandas/numpy datetime."""
    try:
        ts = pd.Timestamp(dt)
        return ts.strftime("%Y-%m-%d")
    except Exception:
        s = str(dt)
        return s.split(" ")[0].split("T")[0] if s else ""


def backtest_accuracy(data: pd.DataFrame, forecast_days: int) -> tuple[dict | None, list[dict]]:
    """Backtest: train on past, predict last N days, compare to actual.
    Returns (accuracy_dict with mae, mape, backtestDays or None, comparison rows [{date, predictedClose, actualClose}])."""
    n = len(data)
    # Need at least 2 days to compare and enough rows: train on n-backtest_days, predict last backtest_days.
    backtest_days = min(forecast_days, max(2, n // 4), 30)
    comparison: list[dict] = []
    # Require at least 3 training rows (so n >= backtest_days + 3). Previously +5 was too strict for small history.
    if backtest_days < 2 or n < backtest_days + 3:
        # Try minimal 2-day backtest when we have at least 5 rows (3 train + 2 predict)
        if n >= 5:
            backtest_days = 2
            train_end = n - backtest_days
            pred = _train_predict(data, train_end, train_end, n)
            actual = data["Close"].iloc[train_end:].values
            dates = data["Date"].iloc[train_end:]
            for i, (dt, p, a) in enumerate(zip(dates, pred, actual)):
                comparison.append({
                    "date": _date_str(dt),
                    "predictedClose": round(float(p), 4),
                    "actualClose": round(float(a), 4),
                })
            mae = float(np.mean(np.abs(actual - pred)))
            with np.errstate(divide="ignore", invalid="ignore"):
                pct = np.where(actual != 0, np.abs(actual - pred) / np.abs(actual), 0)
            mape = float(np.mean(pct) * 100)
            acc = {"mae": round(mae, 4), "mape": round(mape, 2), "backtestDays": backtest_days}
            return acc, comparison
        return None, comparison
    train_end = n - backtest_days
    pred = _train_predict(data, train_end, train_end, n)
    actual = data["Close"].iloc[train_end:].values
    dates = data["Date"].iloc[train_end:]
    for i, (dt, p, a) in enumerate(zip(dates, pred, actual)):
        comparison.append({
            "date": _date_str(dt),
            "predictedClose": round(float(p), 4),
            "actualClose": round(float(a), 4),
        })
    mae = float(np.mean(np.abs(actual - pred)))
    with np.errstate(divide="ignore", invalid="ignore"):
        pct = np.where(actual != 0, np.abs(actual - pred) / np.abs(actual), 0)
    mape = float(np.mean(pct) * 100)
    acc = {"mae": round(mae, 4), "mape": round(mape, 2), "backtestDays": backtest_days}
    return acc, comparison


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


def add_bounds(rows: list[dict], bound_pct: float) -> list[dict]:
    """Add upperBound and lowerBound to each row. bound_pct is e.g. 2.5 for ±2.5%."""
    band = bound_pct / 100.0
    result = []
    for r in rows:
        pred = float(r["predictedClose"])
        result.append({
            **r,
            "upperBound": round(pred * (1 + band), 4),
            "lowerBound": round(pred * (1 - band), 4),
        })
    return result


def main() -> None:
    try:
        symbol = (sys.argv[1] or "").strip().upper()
        if not symbol:
            raise ValueError("Symbol required")
        forecast_days = int(sys.argv[2]) if len(sys.argv) > 2 else DEFAULT_FORECAST_DAYS
        forecast_days = max(1, min(MAX_FORECAST_DAYS, forecast_days))

        data = load_historical(symbol)
        result = predict(data, forecast_days)
        accuracy, comparison = backtest_accuracy(data, forecast_days)

        if comparison and len(comparison) >= 2:
            pred_vals = np.array([r["predictedClose"] for r in comparison])
            actual_vals = np.array([r["actualClose"] for r in comparison])
            mean_error = float(np.mean(actual_vals - pred_vals))
            for r in result:
                r["predictedClose"] = round(float(r["predictedClose"]) + mean_error, 4)
            if accuracy:
                print(
                    f"Learning: applied backtest bias correction (mean error {mean_error:.4f}) to predictions",
                    file=sys.stderr,
                )

        bound_pct = float(accuracy["mape"]) if accuracy else DEFAULT_BOUND_PCT
        result_with_bounds = add_bounds(result, bound_pct)

        symbol_dir = os.path.join(OUTPUT_DIR, symbol)
        os.makedirs(symbol_dir, exist_ok=True)

        # Write predicted CSV with upper/lower bounds: yahoo_top_100_output/{SYMBOL}/predicted.csv
        pred_path = os.path.join(symbol_dir, "predicted.csv")
        pred_df = pd.DataFrame(result_with_bounds)
        pred_df = pred_df[["date", "predictedClose", "upperBound", "lowerBound"]]
        pred_df.columns = ["Date", "Predicted_Close", "Upper_Bound", "Lower_Bound"]
        pred_df.to_csv(pred_path, index=False)
        print(f"Predicted CSV written to: {pred_path}", file=sys.stderr)

        # Write comparison CSV (backtest points) with bounds so comparison test can run
        if comparison:
            comp_with_bounds = add_bounds(
                [{"date": r["date"], "predictedClose": r["predictedClose"]} for r in comparison],
                bound_pct,
            )
            for i, r in enumerate(comp_with_bounds):
                r["actualClose"] = comparison[i]["actualClose"]
            comp_path = os.path.join(symbol_dir, "comparison.csv")
            comp_df = pd.DataFrame(comp_with_bounds)
            comp_df = comp_df[["date", "predictedClose", "actualClose", "upperBound", "lowerBound"]]
            comp_df.columns = ["Date", "Predicted_Close", "Actual_Close", "Upper_Bound", "Lower_Bound"]
            comp_df.to_csv(comp_path, index=False)
            print(f"Comparison CSV written to: {comp_path}", file=sys.stderr)

        out = {"predictions": result, "accuracy": accuracy, "comparison": comparison}
        json_str = json.dumps(out, separators=(",", ":"))
        print(json_str, flush=True)
    except Exception as e:
        print(json.dumps({"error": str(e), "predictions": []}), file=sys.stderr)
        sys.exit(1)


if __name__ == "__main__":
    main()
