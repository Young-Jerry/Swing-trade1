# Swing-trade1

## Frontend
Static HTML/CSS/JS portfolio app (GitHub Pages ready).

## Backend (NEPSE live data)
A FastAPI backend is available in `backend/`.

### Run locally
```bash
cd backend
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
uvicorn main:app --reload --port 8000
```

### API
- `GET /stock?symbol=UPPER`
- `GET /health`

Example response:
```json
{
  "symbol": "UPPER",
  "ltp": 1234,
  "high": 1250,
  "low": 1200,
  "open": 1210,
  "close": 1225,
  "volume": 50000
}
```

Frontend uses this API for Trades and Long Term pages only, polling every 10 seconds.
