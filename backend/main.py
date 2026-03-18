from fastapi import FastAPI
from fastapi.responses import StreamingResponse
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Optional, List

from services.translate_service import (
    translate_text,
    translate_text_stream,
    summarize_text,
    summarize_text_stream,
    check_ollama,
    detect_language,
    get_history,
    delete_history,
    get_history_count,
    init_db,
    LANGUAGE_MAP,
    LANGUAGE_MAP_PRIMARY,
    LANGUAGE_MAP_EXTENDED,
    PROVIDERS,
    CHUNK_LEVELS,
    get_settings,
    save_settings,
    create_session,
    get_sessions,
    get_session,
    update_session,
    delete_session,
    get_session_messages,
    export_session,
    export_session_md,
)

app = FastAPI(title="Localingo", version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
def startup() -> None:
    init_db()


class TranslateRequest(BaseModel):
    text: str
    source_lang: str = "en"
    target_lang: str = "ko"
    model: Optional[str] = None
    session_id: Optional[str] = None


class CreateSessionRequest(BaseModel):
    title: str = "Untitled"
    source_lang: str = "auto"
    target_lang: str = "ko"


class UpdateSessionRequest(BaseModel):
    title: str


class SummarizeRequest(BaseModel):
    text: str
    language: str = "ko"
    model: Optional[str] = None


class SummarizeHistoryRequest(BaseModel):
    ids: List[int]
    language: str = "ko"


@app.get("/api/health")
def health() -> dict:
    return {"status": "ok", "app": "Localingo"}


@app.get("/api/languages")
def languages() -> dict:
    return {"languages": LANGUAGE_MAP, "primary": LANGUAGE_MAP_PRIMARY, "extended": LANGUAGE_MAP_EXTENDED}


@app.get("/api/ollama/status")
async def ollama_status() -> dict:
    return await check_ollama()


@app.get("/api/providers")
def providers() -> dict:
    return {"providers": PROVIDERS}


@app.get("/api/settings")
def settings_get() -> dict:
    return {"settings": get_settings(), "providers": PROVIDERS, "chunk_levels": CHUNK_LEVELS}


class SaveSettingsRequest(BaseModel):
    provider: Optional[str] = None
    translate_model: Optional[str] = None
    summarize_model: Optional[str] = None
    api_key: Optional[str] = None
    ollama_url: Optional[str] = None
    chunk_level: Optional[str] = None


@app.put("/api/settings")
def settings_put(req: SaveSettingsRequest) -> dict:
    data = {k: v for k, v in req.model_dump().items() if v is not None}
    save_settings(data)
    return {"status": "ok", "settings": get_settings()}


@app.post("/api/detect")
def detect_lang(req: TranslateRequest) -> dict:
    return detect_language(req.text)


@app.post("/api/translate")
async def translate(req: TranslateRequest) -> dict:
    return await translate_text(
        req.text, req.source_lang, req.target_lang, req.model, req.session_id
    )


@app.post("/api/translate/stream")
async def translate_stream(req: TranslateRequest):
    """SSE streaming translation with chunk progress."""
    return StreamingResponse(
        translate_text_stream(req.text, req.source_lang, req.target_lang, req.model, req.session_id),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "Connection": "keep-alive"},
    )


@app.post("/api/summarize")
async def summarize(req: SummarizeRequest) -> dict:
    return await summarize_text(req.text, req.language, req.model)


@app.post("/api/summarize/stream")
async def summarize_stream(req: SummarizeRequest):
    """SSE streaming summarization with token progress."""
    return StreamingResponse(
        summarize_text_stream(req.text, req.language, req.model),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "Connection": "keep-alive"},
    )


@app.get("/api/history")
def history(limit: int = 50, offset: int = 0) -> dict:
    return {"history": get_history(limit, offset), "total": get_history_count()}


@app.delete("/api/history/{id}")
def history_delete(id: int) -> dict:
    delete_history(id)
    return {"status": "ok"}


@app.post("/api/history/summarize")
async def history_summarize(req: SummarizeHistoryRequest) -> dict:
    items = get_history(limit=1000)
    selected = [i for i in items if i["id"] in req.ids]
    if not selected:
        return {"status": "error", "message": "No items selected"}
    combined = "\n\n".join(
        [f"[{i['source_lang']}->{i['target_lang']}] {i['translated_text']}" for i in selected]
    )
    return await summarize_text(combined, req.language)


# --- Session endpoints ---


@app.post("/api/sessions")
def session_create(req: CreateSessionRequest) -> dict:
    return create_session(req.title, req.source_lang, req.target_lang)


@app.get("/api/sessions")
def session_list() -> dict:
    return {"sessions": get_sessions()}


@app.get("/api/sessions/{session_id}")
def session_detail(session_id: str) -> dict:
    s = get_session(session_id)
    if not s:
        return {"status": "error", "message": "Session not found"}
    return s


@app.put("/api/sessions/{session_id}")
def session_update(session_id: str, req: UpdateSessionRequest) -> dict:
    s = update_session(session_id, req.title)
    if not s:
        return {"status": "error", "message": "Session not found"}
    return s


@app.delete("/api/sessions/{session_id}")
def session_delete(session_id: str) -> dict:
    delete_session(session_id)
    return {"status": "ok"}


@app.get("/api/sessions/{session_id}/messages")
def session_messages(session_id: str) -> dict:
    return {"messages": get_session_messages(session_id)}


@app.get("/api/sessions/{session_id}/export")
def session_export(session_id: str, format: str = "json"):
    if format == "md":
        md = export_session_md(session_id)
        if not md:
            return {"status": "error", "message": "Session not found"}
        from fastapi.responses import PlainTextResponse
        return PlainTextResponse(content=md, media_type="text/markdown")
    data = export_session(session_id)
    if not data:
        return {"status": "error", "message": "Session not found"}
    return data
