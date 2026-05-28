Initialize the venv inside `geedrive-api/` — that's where your `requirements.txt`, `app/`, and `tests/` all live. The venv belongs next to the code it serves.

```bash
cd geedrive/geedrive-api
uv venv
```

That creates a `.venv/` folder inside `geedrive-api/`. Then activate it and install dependencies:

```bash
# macOS / Linux
source .venv/bin/activate

# Windows (PowerShell)
.venv\Scripts\Activate.ps1
```

```bash
uv pip install -r requirements.txt
```

Your structure will look like this afterwards:

```
geedrive-api/
├── .venv/          ← lives here, never committed
├── app/
├── tests/
├── requirements.txt
└── Dockerfile
```

**Two things to do after:**

Add `.venv/` to your `.gitignore` if you haven't already — it should never be committed:
```
# geedrive/.gitignore
geedrive-api/.venv/
```

And if you ever need to run pytest, do it from inside `geedrive-api/` so Python can find the `app` package:
```bash
cd geedrive/geedrive-api
python -m pytest tests/
```

Running `pytest` from the root `geedrive/` directory would cause import errors because `app/` wouldn't be on the path.