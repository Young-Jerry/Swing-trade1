from __future__ import annotations

import time
from typing import Any

from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from nepse import Client

app = FastAPI(title="NEPSE Live API", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

CACHE_TTL_SECONDS = 5
_CACHE: dict[str, tuple[float, dict[str, Any]]] = {}


@app.get("/health")
async def health() -> dict[str, str]:
    return {"status": "ok"}


@app.get("/stock")
async def get_stock(symbol: str = Query(..., min_length=1)) -> dict[str, Any]:
    normalized = symbol.strip().upper()
    now = time.time()

    cached = _CACHE.get(normalized)
    if cached and now - cached[0] < CACHE_TTL_SECONDS:
      return cached[1]

    client = Client()
    try:
        data = await client.security_client.get_company(symbol=normalized)
    except Exception as exc:
        raise HTTPException(status_code=404, detail=f"Unable to fetch symbol '{normalized}'.") from exc
    finally:
        await client.close()

    if not data:
        raise HTTPException(status_code=404, detail=f"Symbol '{normalized}' not found.")

    response = {
        "symbol": normalized,
        "ltp": to_number(data.get("ltp") or data.get("lastTradedPrice")),
        "high": to_number(data.get("high") or data.get("highPrice")),
        "low": to_number(data.get("low") or data.get("lowPrice")),
        "open": to_number(data.get("open") or data.get("openPrice")),
        "close": to_number(data.get("close") or data.get("closePrice")),
        "volume": int(to_number(data.get("volume") or data.get("totalTradedQuantity")) or 0),
    }

    if response["ltp"] is None:
        raise HTTPException(status_code=404, detail=f"Symbol '{normalized}' returned no market data.")

    _CACHE[normalized] = (now, response)
    return response


def to_number(value: Any) -> float | None:
    try:
        if value is None:
            return None
        return float(value)
    except (TypeError, ValueError):
        return None
