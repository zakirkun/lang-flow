## Backend Quickstart

- Copy `.env.example` to `.env` and set `OPENAI_API_KEY`.
- Create venv, install, run:
  ```powershell
  python -m venv .venv
  .\.venv\Scripts\Activate.ps1
  pip install -r requirements.txt
  uvicorn app.main:app --reload --port 8000
  ```
- API docs at: http://localhost:8000/docs 