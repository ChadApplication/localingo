import httpx
import sqlite3
import os
import uuid
from datetime import datetime
from langdetect import detect, LangDetectException

OLLAMA_URL = os.environ.get("OLLAMA_URL", "http://localhost:11434")

PROVIDERS = {
    "ollama": {
        "label": "Ollama (Local)",
        "requires_key": False,
        "translate_models": [
            "translategemma:latest",
            "translategemma:27b",
            "qwen3.5:latest",
            "qwen3.5:27b",
            "exaone3.5:7.8b-instruct-q8_0",
            "exaone3.5:2.4b",
            "deepseek-v3.2:cloud",
            "gpt-oss:20b",
            "llama3.2:latest",
        ],
        "summarize_models": [
            "qwen3.5:latest",
            "qwen3.5:27b",
            "exaone3.5:7.8b-instruct-q8_0",
            "exaone3.5:2.4b",
            "translategemma:latest",
            "translategemma:27b",
            "deepseek-v3.2:cloud",
            "gpt-oss:20b",
            "llama3.2:latest",
        ],
    },
    "deepl": {
        "label": "DeepL",
        "requires_key": True,
        "translate_models": ["deepl"],
        "summarize_models": [],
    },
    "google": {
        "label": "Google Translate",
        "requires_key": True,
        "translate_models": ["google"],
        "summarize_models": [],
    },
    "openai": {
        "label": "OpenAI",
        "requires_key": True,
        "translate_models": ["gpt-5-mini", "gpt-4.1-mini"],
        "summarize_models": ["gpt-5-mini", "gpt-4.1-mini"],
    },
}

CHUNK_LEVELS = {
    "xsmall": {"label": "XSmall (100)", "chars": 100},
    "small": {"label": "Small (500)", "chars": 500},
    "medium": {"label": "Medium (1,500)", "chars": 1500},
    "large": {"label": "Large (3,000)", "chars": 3000},
    "xlarge": {"label": "XLarge (5,000)", "chars": 5000},
}

DEFAULT_SETTINGS = {
    "provider": "ollama",
    "translate_model": "translategemma:latest",
    "summarize_model": "qwen3.5:latest",
    "api_key": "",
    "ollama_url": "http://localhost:11434",
    "chunk_level": "medium",
}

LANGUAGE_MAP_PRIMARY = {
    "ko": "Korean",
    "en": "English",
    "zh": "Chinese",
    "ja": "Japanese",
    "es": "Spanish",
    "fr": "French",
    "de": "German",
}

LANGUAGE_MAP_EXTENDED = {
    "ar": "Arabic",
    "hi": "Hindi",
    "pt": "Portuguese",
    "ru": "Russian",
    "it": "Italian",
    "nl": "Dutch",
    "pl": "Polish",
    "tr": "Turkish",
    "vi": "Vietnamese",
    "th": "Thai",
    "id": "Indonesian",
    "cs": "Czech",
    "da": "Danish",
    "fi": "Finnish",
    "el": "Greek",
    "he": "Hebrew",
    "hu": "Hungarian",
    "no": "Norwegian",
    "ro": "Romanian",
    "sv": "Swedish",
    "uk": "Ukrainian",
    "bn": "Bengali",
    "my": "Burmese",
    "fil": "Filipino",
    "gu": "Gujarati",
    "kn": "Kannada",
    "km": "Khmer",
    "lo": "Lao",
    "ms": "Malay",
    "ml": "Malayalam",
    "mr": "Marathi",
    "ne": "Nepali",
    "ps": "Pashto",
    "fa": "Persian",
    "pa": "Punjabi",
    "si": "Sinhala",
    "sw": "Swahili",
    "ta": "Tamil",
    "te": "Telugu",
    "ur": "Urdu",
    "is": "Icelandic",
    "af": "Afrikaans",
    "sq": "Albanian",
    "am": "Amharic",
    "hy": "Armenian",
    "az": "Azerbaijani",
    "eu": "Basque",
    "bg": "Bulgarian",
    "ca": "Catalan",
    "hr": "Croatian",
    "et": "Estonian",
    "ka": "Georgian",
}

LANGUAGE_MAP = {**LANGUAGE_MAP_PRIMARY, **LANGUAGE_MAP_EXTENDED}

# Auto model selection
MODEL_MAP = {
    "translate": "translategemma:latest",
    "summarize": "qwen3.5:latest",
}

DB_PATH = os.path.join(os.path.dirname(os.path.dirname(__file__)), "localingo.db")


def get_db() -> sqlite3.Connection:
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn


def init_db() -> None:
    conn = get_db()
    conn.executescript("""
        CREATE TABLE IF NOT EXISTS translations (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            source_text TEXT NOT NULL,
            translated_text TEXT NOT NULL,
            source_lang TEXT NOT NULL,
            target_lang TEXT NOT NULL,
            model TEXT NOT NULL,
            task_type TEXT DEFAULT 'translate',
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        );
        CREATE TABLE IF NOT EXISTS settings (
            key TEXT PRIMARY KEY,
            value TEXT NOT NULL
        );
        CREATE TABLE IF NOT EXISTS sessions (
            id TEXT PRIMARY KEY,
            title TEXT NOT NULL DEFAULT 'Untitled',
            source_lang TEXT DEFAULT 'auto',
            target_lang TEXT DEFAULT 'ko',
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        );
    """)
    # Add session_id column to translations if missing
    cursor = conn.execute("PRAGMA table_info(translations)")
    columns = [row[1] for row in cursor.fetchall()]
    if "session_id" not in columns:
        conn.execute(
            "ALTER TABLE translations ADD COLUMN session_id TEXT DEFAULT NULL"
        )
        conn.commit()
    conn.close()


def get_settings() -> dict:
    """Load settings from DB, filling in defaults for missing keys."""
    conn = get_db()
    rows = conn.execute("SELECT key, value FROM settings").fetchall()
    conn.close()
    saved = {r["key"]: r["value"] for r in rows}
    return {**DEFAULT_SETTINGS, **saved}


def save_setting(key: str, value: str) -> None:
    conn = get_db()
    conn.execute(
        "INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)", (key, value)
    )
    conn.commit()
    conn.close()


async def _get_loaded_models() -> list[str]:
    """Get currently loaded Ollama models."""
    url = _get_ollama_url()
    try:
        async with httpx.AsyncClient(timeout=5) as client:
            resp = await client.get(f"{url}/api/ps")
            if resp.status_code == 200:
                return [m["name"] for m in resp.json().get("models", [])]
    except Exception:
        pass
    return []


async def _unload_model(model: str) -> None:
    """Unload a model from Ollama memory."""
    url = _get_ollama_url()
    try:
        async with httpx.AsyncClient(timeout=10) as client:
            await client.post(
                f"{url}/api/generate",
                json={"model": model, "prompt": "", "keep_alive": "0s", "stream": False},
            )
    except Exception:
        pass


async def _ensure_model(needed_model: str) -> None:
    """Smart model management: unload others, keep needed model."""
    loaded = await _get_loaded_models()

    if needed_model in loaded and len(loaded) == 1:
        return  # Already loaded alone

    # Unload other models to free memory
    for m in loaded:
        if m != needed_model:
            await _unload_model(m)


def save_settings(settings: dict) -> None:
    conn = get_db()
    for k, v in settings.items():
        conn.execute(
            "INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)", (k, str(v))
        )
    conn.commit()
    conn.close()


def _get_ollama_url() -> str:
    """Get the configured Ollama URL from settings."""
    settings = get_settings()
    return settings.get("ollama_url", OLLAMA_URL)


def detect_language(text: str) -> dict:
    """Detect language of text using langdetect."""
    try:
        code = detect(text)
        if code.startswith("zh"):
            code = "zh"
        name = LANGUAGE_MAP.get(code, code)
        return {"status": "success", "lang": code, "name": name, "supported": code in LANGUAGE_MAP}
    except LangDetectException:
        return {"status": "error", "lang": "unknown", "name": "Unknown", "supported": False}


def _get_chunk_size() -> int:
    settings = get_settings()
    level = settings.get("chunk_level", "medium")
    return CHUNK_LEVELS.get(level, CHUNK_LEVELS["medium"])["chars"]


def _split_into_chunks(text: str, max_chars: int | None = None) -> list[str]:
    """Split text into chunks by paragraphs, then sentences if needed."""
    if max_chars is None:
        max_chars = _get_chunk_size()
    if len(text) <= max_chars:
        return [text]

    chunks = []
    # Split by double newline (paragraphs) first
    paragraphs = text.split("\n\n")
    current = ""
    for para in paragraphs:
        if len(current) + len(para) + 2 <= max_chars:
            current = current + "\n\n" + para if current else para
        else:
            if current:
                chunks.append(current)
            # If single paragraph exceeds limit, split by sentences
            if len(para) > max_chars:
                sentences = para.replace("。", "。\n").replace(". ", ".\n").replace("! ", "!\n").replace("? ", "?\n").split("\n")
                sent_chunk = ""
                for sent in sentences:
                    sent = sent.strip()
                    if not sent:
                        continue
                    if len(sent_chunk) + len(sent) + 1 <= max_chars:
                        sent_chunk = sent_chunk + " " + sent if sent_chunk else sent
                    else:
                        if sent_chunk:
                            chunks.append(sent_chunk)
                        sent_chunk = sent
                if sent_chunk:
                    chunks.append(sent_chunk)
                current = ""
            else:
                current = para
    if current:
        chunks.append(current)

    return chunks if chunks else [text]


async def _translate_single(
    text: str, source_name: str, target_name: str, model: str, ollama_url: str | None = None
) -> str:
    """Translate a single chunk using Ollama."""
    url = ollama_url or _get_ollama_url()
    prompt = (
        f"Translate the following {source_name} text to {target_name}. "
        f"Output ONLY the translation, nothing else:\n\n{text}"
    )
    async with httpx.AsyncClient(timeout=120) as client:
        response = await client.post(
            f"{url}/api/generate",
            json={"model": model, "prompt": prompt, "stream": False},
        )
        result = response.json()
        return result.get("response", "").strip()


async def _translate_non_ollama(
    text: str, source_lang: str, target_lang: str, provider: str
) -> str:
    """Placeholder for non-Ollama providers."""
    return f"Provider '{provider}' not yet implemented. Text: {text[:50]}..."


async def translate_text_stream(
    text: str,
    source_lang: str,
    target_lang: str,
    model: str | None = None,
    session_id: str | None = None,
):
    """Translate with SSE progress streaming for chunked translation."""
    import json as _json

    settings = get_settings()
    provider = settings.get("provider", "ollama")

    if not model:
        model = settings.get("translate_model", MODEL_MAP["translate"])

    if source_lang == "auto":
        detected = detect_language(text)
        source_lang = detected.get("lang", "en")

    source_name = LANGUAGE_MAP.get(source_lang, source_lang)
    target_name = LANGUAGE_MAP.get(target_lang, target_lang)

    # Smart model management
    if provider == "ollama":
        await _ensure_model(model)

    chunks = _split_into_chunks(text)
    total = len(chunks)
    translated_chunks = []

    if provider != "ollama":
        # Non-Ollama providers: single call, no chunking
        yield f"data: {_json.dumps({'type': 'progress', 'current': 0, 'total': 1, 'percent': 0})}\n\n"
        result = await _translate_non_ollama(text, source_lang, target_lang, provider)
        translated_chunks = [result]
        translated = result
    else:
        ollama_url = settings.get("ollama_url", OLLAMA_URL)
        for i, chunk in enumerate(chunks):
            # Stream tokens for this chunk to show real progress
            prompt = (
                f"Translate the following {source_name} text to {target_name}. "
                f"Output ONLY the translation, nothing else:\n\n{chunk}"
            )
            url = ollama_url or _get_ollama_url()
            token_count = 0
            result_tokens = []
            # Estimate expected tokens (~0.7x input chars)
            expected_tokens = max(int(len(chunk) * 0.7), 10)

            async with httpx.AsyncClient(timeout=120) as client:
                async with client.stream(
                    "POST", f"{url}/api/generate",
                    json={"model": model, "prompt": prompt, "stream": True},
                ) as resp:
                    async for line in resp.aiter_lines():
                        if not line:
                            continue
                        try:
                            token_data = _json.loads(line)
                            tok = token_data.get("response", "")
                            if tok:
                                result_tokens.append(tok)
                                token_count += 1
                                # Calculate chunk-level + token-level progress
                                chunk_base = i / total
                                chunk_progress = min(token_count / expected_tokens, 0.99)
                                overall = chunk_base + chunk_progress / total
                                yield f"data: {_json.dumps({'type': 'progress', 'current': i + 1, 'total': total, 'percent': round(overall * 100), 'tokens': token_count})}\n\n"
                            if token_data.get("done"):
                                break
                        except Exception:
                            continue

            translated_chunks.append("".join(result_tokens).strip())
        translated = "\n\n".join(translated_chunks)

    # Save to DB
    conn = get_db()
    conn.execute(
        "INSERT INTO translations "
        "(source_text, translated_text, source_lang, target_lang, model, task_type, session_id) "
        "VALUES (?, ?, ?, ?, ?, ?, ?)",
        (text, translated, source_lang, target_lang, model, "translate", session_id),
    )
    conn.commit()
    if session_id:
        conn.execute("UPDATE sessions SET updated_at = CURRENT_TIMESTAMP WHERE id = ?", (session_id,))
        conn.commit()
    conn.close()

    # Send complete event with full result
    yield f"data: {_json.dumps({'type': 'complete', 'translated': translated, 'source_lang': source_lang, 'target_lang': target_lang, 'model': model, 'chunks': total})}\n\n"


async def translate_text(
    text: str,
    source_lang: str,
    target_lang: str,
    model: str | None = None,
    session_id: str | None = None,
) -> dict:
    settings = get_settings()
    provider = settings.get("provider", "ollama")

    if not model:
        model = settings.get("translate_model", MODEL_MAP["translate"])

    # Auto-detect source language
    if source_lang == "auto":
        detected = detect_language(text)
        source_lang = detected.get("lang", "en")

    # Smart model management
    if provider == "ollama":
        await _ensure_model(model)

    if provider != "ollama":
        translated = await _translate_non_ollama(text, source_lang, target_lang, provider)
    else:
        source_name = LANGUAGE_MAP.get(source_lang, source_lang)
        target_name = LANGUAGE_MAP.get(target_lang, target_lang)
        ollama_url = settings.get("ollama_url", OLLAMA_URL)

        chunks = _split_into_chunks(text)
        translated_chunks = []
        for chunk in chunks:
            result = await _translate_single(chunk, source_name, target_name, model, ollama_url)
            translated_chunks.append(result)
        translated = "\n\n".join(translated_chunks)

    # Save to history
    conn = get_db()
    conn.execute(
        "INSERT INTO translations "
        "(source_text, translated_text, source_lang, target_lang, model, task_type, session_id) "
        "VALUES (?, ?, ?, ?, ?, ?, ?)",
        (text, translated, source_lang, target_lang, model, "translate", session_id),
    )
    conn.commit()
    # Update session updated_at if linked
    if session_id:
        conn.execute(
            "UPDATE sessions SET updated_at = CURRENT_TIMESTAMP WHERE id = ?",
            (session_id,),
        )
        conn.commit()
    conn.close()

    return {
        "status": "success",
        "original": text,
        "translated": translated,
        "source_lang": source_lang,
        "target_lang": target_lang,
        "model": model,
    }


async def summarize_text(
    text: str,
    language: str = "ko",
    model: str | None = None,
) -> dict:
    settings = get_settings()
    provider = settings.get("provider", "ollama")

    if not model:
        model = settings.get("summarize_model", MODEL_MAP["summarize"])

    if provider != "ollama":
        provider_info = PROVIDERS.get(provider, {})
        if not provider_info.get("summarize_models"):
            return {
                "status": "error",
                "summary": f"Provider '{provider}' does not support summarization.",
                "model": model,
            }
        return {
            "status": "error",
            "summary": f"Provider '{provider}' not yet implemented.",
            "model": model,
        }

    # Smart model management
    await _ensure_model(model)

    ollama_url = settings.get("ollama_url", OLLAMA_URL)
    lang_name = LANGUAGE_MAP.get(language, language)
    prompt = f"Summarize the following text in {lang_name}. Be concise:\n\n{text}"

    async with httpx.AsyncClient(timeout=120) as client:
        response = await client.post(
            f"{ollama_url}/api/generate",
            json={"model": model, "prompt": prompt, "stream": False},
        )
        result = response.json()
        summary = result.get("response", "").strip()

    return {"status": "success", "summary": summary, "model": model}


async def summarize_text_stream(
    text: str,
    language: str = "ko",
    model: str | None = None,
):
    """Summarize with SSE token-level progress streaming."""
    import json as _json

    settings = get_settings()
    provider = settings.get("provider", "ollama")

    if not model:
        model = settings.get("summarize_model", MODEL_MAP["summarize"])

    if provider != "ollama":
        yield f"data: {_json.dumps({'type': 'complete', 'summary': f'Provider {provider} not yet implemented.', 'model': model})}\n\n"
        return

    # Smart model management
    await _ensure_model(model)

    ollama_url = settings.get("ollama_url", OLLAMA_URL)
    lang_name = LANGUAGE_MAP.get(language, language)
    prompt = f"Summarize the following text in {lang_name}. Be concise:\n\n{text}"

    token_count = 0
    result_tokens = []
    expected_tokens = max(int(len(text) * 0.3), 20)

    async with httpx.AsyncClient(timeout=120) as client:
        async with client.stream(
            "POST", f"{ollama_url}/api/generate",
            json={"model": model, "prompt": prompt, "stream": True},
        ) as resp:
            async for line in resp.aiter_lines():
                if not line:
                    continue
                try:
                    token_data = _json.loads(line)
                    tok = token_data.get("response", "")
                    if tok:
                        result_tokens.append(tok)
                        token_count += 1
                        pct = min(round(token_count / expected_tokens * 100), 99)
                        yield f"data: {_json.dumps({'type': 'progress', 'percent': pct, 'tokens': token_count})}\n\n"
                    if token_data.get("done"):
                        break
                except Exception:
                    continue

    summary = "".join(result_tokens).strip()
    yield f"data: {_json.dumps({'type': 'complete', 'summary': summary, 'model': model})}\n\n"


async def check_ollama() -> dict:
    ollama_url = _get_ollama_url()
    try:
        async with httpx.AsyncClient(timeout=5) as client:
            resp = await client.get(f"{ollama_url}/api/tags")
            if resp.status_code == 200:
                models = [m["name"] for m in resp.json().get("models", [])]
                return {"status": "ok", "models": models}
    except Exception:
        pass
    return {"status": "error", "message": "Ollama not running"}


def get_history(limit: int = 50, offset: int = 0) -> list:
    conn = get_db()
    rows = conn.execute(
        "SELECT * FROM translations ORDER BY created_at DESC LIMIT ? OFFSET ?",
        (limit, offset),
    ).fetchall()
    conn.close()
    return [dict(r) for r in rows]


def delete_history(id: int) -> None:
    conn = get_db()
    conn.execute("DELETE FROM translations WHERE id = ?", (id,))
    conn.commit()
    conn.close()


def get_history_count() -> int:
    conn = get_db()
    count = conn.execute("SELECT COUNT(*) FROM translations").fetchone()[0]
    conn.close()
    return count


# --- Session management ---


def create_session(
    title: str = "Untitled",
    source_lang: str = "auto",
    target_lang: str = "ko",
) -> dict:
    session_id = uuid.uuid4().hex[:12]
    conn = get_db()
    conn.execute(
        "INSERT INTO sessions (id, title, source_lang, target_lang) VALUES (?, ?, ?, ?)",
        (session_id, title, source_lang, target_lang),
    )
    conn.commit()
    row = conn.execute("SELECT * FROM sessions WHERE id = ?", (session_id,)).fetchone()
    conn.close()
    return dict(row)


def get_sessions() -> list:
    conn = get_db()
    rows = conn.execute(
        "SELECT s.*, "
        "(SELECT COUNT(*) FROM translations t WHERE t.session_id = s.id) AS message_count "
        "FROM sessions s ORDER BY s.updated_at DESC"
    ).fetchall()
    conn.close()
    return [dict(r) for r in rows]


def get_session(session_id: str) -> dict | None:
    conn = get_db()
    row = conn.execute("SELECT * FROM sessions WHERE id = ?", (session_id,)).fetchone()
    conn.close()
    return dict(row) if row else None


def update_session(session_id: str, title: str) -> dict | None:
    conn = get_db()
    conn.execute(
        "UPDATE sessions SET title = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?",
        (title, session_id),
    )
    conn.commit()
    row = conn.execute("SELECT * FROM sessions WHERE id = ?", (session_id,)).fetchone()
    conn.close()
    return dict(row) if row else None


def delete_session(session_id: str) -> None:
    conn = get_db()
    conn.execute("DELETE FROM translations WHERE session_id = ?", (session_id,))
    conn.execute("DELETE FROM sessions WHERE id = ?", (session_id,))
    conn.commit()
    conn.close()


def get_session_messages(session_id: str) -> list:
    conn = get_db()
    rows = conn.execute(
        "SELECT * FROM translations WHERE session_id = ? ORDER BY created_at ASC",
        (session_id,),
    ).fetchall()
    conn.close()
    return [dict(r) for r in rows]


def export_session(session_id: str) -> dict | None:
    session = get_session(session_id)
    if not session:
        return None
    messages = get_session_messages(session_id)
    return {"session": session, "messages": messages}


def export_session_md(session_id: str) -> str | None:
    """Export session as Markdown text."""
    session = get_session(session_id)
    if not session:
        return None
    messages = get_session_messages(session_id)

    src = LANGUAGE_MAP.get(session["source_lang"], session["source_lang"])
    tgt = LANGUAGE_MAP.get(session["target_lang"], session["target_lang"])

    md = f"# {session['title']}\n\n"
    md += f"> {src} → {tgt} | Created: {session['created_at']}\n\n---\n\n"

    for msg in messages:
        sl = LANGUAGE_MAP.get(msg["source_lang"], msg["source_lang"])
        tl = LANGUAGE_MAP.get(msg["target_lang"], msg["target_lang"])
        md += f"### [{sl} → {tl}]\n\n"
        md += f"**Original:**\n\n{msg['source_text']}\n\n"
        md += f"**Translation:**\n\n{msg['translated_text']}\n\n"
        md += f"---\n\n"

    return md
