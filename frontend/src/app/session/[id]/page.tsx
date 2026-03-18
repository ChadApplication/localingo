"use client";

import { ThemeToggle } from "@/components/ThemeToggle";
import { useEffect, useRef, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  ArrowLeft,
  Check,
  Copy,
  FileText,
  Pencil,
  RotateCcw,
  Trash2,
} from "lucide-react";

interface Message {
  id: string;
  role: "user" | "bot";
  text: string;
  lang: string;
  timestamp: number;
  dbId?: number;
}

interface LanguageMap {
  [key: string]: string;
}

interface Session {
  id: string;
  title: string;
  source_lang: string;
  target_lang: string;
  created_at: string;
  updated_at: string;
}

export default function SessionPage() {
  const params = useParams();
  const router = useRouter();
  const sessionId = params.id as string;

  const [session, setSession] = useState<Session | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputText, setInputText] = useState("");
  const [sourceLang, setSourceLang] = useState("auto");
  const [targetLang, setTargetLang] = useState("ko");
  const [isTranslating, setIsTranslating] = useState(false);
  const [translateProgress, setTranslateProgress] = useState<{ current: number; total: number; percent: number } | null>(null);
  const [ollamaStatus, setOllamaStatus] = useState<"ok" | "error" | "loading">(
    "loading",
  );
  const [languages, setLanguages] = useState<LanguageMap>({});
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [summarizingId, setSummarizingId] = useState<string | null>(null);
  const [editingTitle, setEditingTitle] = useState(false);
  const [titleDraft, setTitleDraft] = useState("");

  const chatEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const titleInputRef = useRef<HTMLInputElement>(null);

  // Fetch session, languages, ollama status, and messages on mount
  useEffect(() => {
    fetch("/api/languages")
      .then((res) => res.json())
      .then((data) => setLanguages(data.languages || {}))
      .catch(() => {});

    fetch("/api/ollama/status")
      .then((res) => res.json())
      .then((data) =>
        setOllamaStatus(data.status === "ok" ? "ok" : "error"),
      )
      .catch(() => setOllamaStatus("error"));

    fetch(`/api/sessions/${sessionId}`)
      .then((res) => res.json())
      .then((data) => {
        if (data.status === "error") {
          router.push("/");
          return;
        }
        setSession(data);
        setSourceLang(data.source_lang || "auto");
        setTargetLang(data.target_lang || "ko");
        setTitleDraft(data.title);
      })
      .catch(() => router.push("/"));

    fetch(`/api/sessions/${sessionId}/messages`)
      .then((res) => res.json())
      .then((data) => {
        const msgs: Message[] = [];
        for (const row of data.messages || []) {
          msgs.push({
            id: crypto.randomUUID(),
            role: "user",
            text: row.source_text,
            lang: row.source_lang,
            timestamp: new Date(row.created_at).getTime(),
            dbId: row.id,
          });
          msgs.push({
            id: crypto.randomUUID(),
            role: "bot",
            text: row.translated_text,
            lang: row.target_lang,
            timestamp: new Date(row.created_at).getTime(),
            dbId: row.id,
          });
        }
        setMessages(msgs);
      })
      .catch(() => {});
  }, [sessionId, router]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    if (editingTitle && titleInputRef.current) {
      titleInputRef.current.focus();
      titleInputRef.current.select();
    }
  }, [editingTitle]);

  const saveTitle = useCallback(() => {
    const t = titleDraft.trim();
    if (!t || !session) {
      setEditingTitle(false);
      return;
    }
    fetch(`/api/sessions/${sessionId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: t }),
    })
      .then((res) => res.json())
      .then((data) => {
        if (data.title) setSession((s) => (s ? { ...s, title: data.title } : s));
      })
      .catch(() => {});
    setEditingTitle(false);
  }, [titleDraft, session, sessionId]);

  const swapLanguages = useCallback(() => {
    setSourceLang(targetLang);
    setTargetLang(sourceLang);
  }, [sourceLang, targetLang]);

  const handleTranslate = useCallback(async () => {
    const text = inputText.trim();
    if (!text || isTranslating) return;

    const userMsg: Message = {
      id: crypto.randomUUID(),
      role: "user",
      text,
      lang: sourceLang,
      timestamp: Date.now(),
    };

    setMessages((prev) => [...prev, userMsg]);
    setInputText("");
    setIsTranslating(true);

    const botId = crypto.randomUUID();
    setMessages((prev) => [
      ...prev,
      { id: botId, role: "bot", text: "", lang: targetLang, timestamp: Date.now() },
    ]);

    setTranslateProgress(null);
    try {
      const bp = process.env.NEXT_PUBLIC_BACKEND_PORT || "8050";
      const res = await fetch(`http://localhost:${bp}/api/translate/stream`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text,
          source_lang: sourceLang,
          target_lang: targetLang,
          session_id: sessionId,
        }),
      });
      const reader = res.body?.getReader();
      const decoder = new TextDecoder();
      if (!reader) throw new Error("No reader");
      let buffer = "";
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";
        for (const line of lines) {
          if (line.startsWith("data: ")) {
            try {
              const evt = JSON.parse(line.slice(6));
              if (evt.type === "progress") {
                setTranslateProgress({ current: evt.current, total: evt.total, percent: evt.percent });
              } else if (evt.type === "complete") {
                setMessages((prev) =>
                  prev.map((m) =>
                    m.id === botId ? { ...m, text: evt.translated || "Translation failed." } : m,
                  ),
                );
                setTranslateProgress(null);
                setIsTranslating(false);
              }
            } catch {}
          }
        }
      }
    } catch {
      setMessages((prev) =>
        prev.map((m) =>
          m.id === botId
            ? { ...m, text: "Error: Could not connect to translation service." }
            : m,
        ),
      );
    } finally {
      setIsTranslating(false);
      setTranslateProgress(null);
    }
  }, [inputText, isTranslating, sourceLang, targetLang, sessionId]);

  const handleUndo = useCallback(() => {
    if (messages.length < 2) return;
    const lastBot = messages[messages.length - 1];
    const lastUser = messages[messages.length - 2];
    // Delete from DB if it has a dbId
    if (lastBot.dbId) {
      fetch(`/api/history/${lastBot.dbId}`, { method: "DELETE" }).catch(() => {});
    } else if (lastUser.dbId) {
      fetch(`/api/history/${lastUser.dbId}`, { method: "DELETE" }).catch(() => {});
    }
    setMessages((prev) => prev.slice(0, -2));
  }, [messages]);

  const handleClearAll = useCallback(async () => {
    if (!confirm("Clear all messages in this session?")) return;
    // Delete all translations for this session
    for (const msg of messages) {
      if (msg.dbId) {
        fetch(`/api/history/${msg.dbId}`, { method: "DELETE" }).catch(() => {});
      }
    }
    setMessages([]);
  }, [messages]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
        e.preventDefault();
        handleTranslate();
      }
    },
    [handleTranslate],
  );

  const copyToClipboard = useCallback((text: string, id: string) => {
    navigator.clipboard.writeText(text).then(() => {
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 1500);
    });
  }, []);

  const [summaryProgress, setSummaryProgress] = useState(0);

  const handleSummarize = useCallback(
    async (text: string, msgId: string) => {
      setSummarizingId(msgId);
      setSummaryProgress(0);
      const summaryId = crypto.randomUUID();
      setMessages((prev) => [
        ...prev,
        {
          id: summaryId,
          role: "bot" as const,
          text: "",
          lang: targetLang,
          timestamp: Date.now(),
        },
      ]);
      try {
        const bp = process.env.NEXT_PUBLIC_BACKEND_PORT || "8050";
        const res = await fetch(`http://localhost:${bp}/api/summarize/stream`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ text, language: targetLang }),
        });
        const reader = res.body?.getReader();
        const decoder = new TextDecoder();
        if (!reader) throw new Error("No reader");
        let buffer = "";
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n");
          buffer = lines.pop() || "";
          for (const line of lines) {
            if (line.startsWith("data: ")) {
              try {
                const evt = JSON.parse(line.slice(6));
                if (evt.type === "progress") {
                  setSummaryProgress(evt.percent);
                } else if (evt.type === "complete") {
                  setMessages((prev) =>
                    prev.map((m) =>
                      m.id === summaryId
                        ? { ...m, text: `[Summary]\n${evt.summary || "Summary failed."}` }
                        : m,
                    ),
                  );
                }
              } catch {}
            }
          }
        }
      } catch {
        setMessages((prev) =>
          prev.map((m) =>
            m.id === summaryId
              ? { ...m, text: "[Summary] Error: Could not summarize." }
              : m,
          ),
        );
      } finally {
        setSummarizingId(null);
        setSummaryProgress(0);
      }
    },
    [targetLang],
  );

  const statusColor =
    ollamaStatus === "ok"
      ? "bg-green-500"
      : ollamaStatus === "error"
        ? "bg-red-500"
        : "bg-yellow-500 animate-pulse";

  return (
    <div className="min-h-screen flex flex-col bg-white dark:bg-neutral-950">
      {/* Header */}
      <header className="border-b border-gray-200 dark:border-neutral-800 px-4 sm:px-6 py-3 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-3">
          <button
            onClick={() => router.push("/")}
            className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-neutral-800 transition-colors text-gray-500 dark:text-gray-400"
            title="Back to dashboard"
          >
            <ArrowLeft size={20} />
          </button>
          <span
            className={`w-2.5 h-2.5 rounded-full ${statusColor}`}
            title={`Ollama: ${ollamaStatus}`}
          />
          {editingTitle ? (
            <input
              ref={titleInputRef}
              value={titleDraft}
              onChange={(e) => setTitleDraft(e.target.value)}
              onBlur={saveTitle}
              onKeyDown={(e) => {
                if (e.key === "Enter") saveTitle();
                if (e.key === "Escape") setEditingTitle(false);
              }}
              className="text-lg font-bold text-purple-600 dark:text-purple-400 bg-transparent border-b-2 border-purple-500 outline-none px-1"
            />
          ) : (
            <button
              onClick={() => {
                setTitleDraft(session?.title || "");
                setEditingTitle(true);
              }}
              className="flex items-center gap-1.5 group"
            >
              <h1 className="text-lg font-bold text-purple-600 dark:text-purple-400">
                {session?.title || "Loading..."}
              </h1>
              <Pencil
                size={14}
                className="text-gray-400 opacity-0 group-hover:opacity-100 transition-opacity"
              />
            </button>
          )}
        </div>
        <ThemeToggle />
      </header>

      {/* Chat area */}
      <div className="flex-1 flex flex-col min-h-0">
        <div className="flex-1 overflow-y-auto px-4 sm:px-6 py-4 space-y-8">
          {messages.length === 0 && (
            <div className="flex-1 flex items-center justify-center h-full">
              <div className="text-center text-gray-400 dark:text-gray-600">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="48"
                  height="48"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="mx-auto mb-4 opacity-50"
                >
                  <path d="m5 8 6 6" />
                  <path d="m4 14 6-6 2-3" />
                  <path d="M2 5h12" />
                  <path d="M7 2h1" />
                  <path d="m22 22-5-10-5 10" />
                  <path d="M14 18h6" />
                </svg>
                <p className="text-lg font-medium">Start translating</p>
                <p className="text-sm mt-1">
                  Type text below and press Cmd+Enter
                </p>
              </div>
            </div>
          )}

          {messages.map((msg) => (
            <div
              key={msg.id}
              className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
            >
              <div
                className={`group relative max-w-[80%] sm:max-w-[70%] px-4 py-3 rounded-2xl ${
                  msg.role === "user"
                    ? "bg-purple-600 text-white rounded-br-md"
                    : "bg-gray-100 dark:bg-neutral-800 text-gray-900 dark:text-gray-100 rounded-bl-md"
                }`}
              >
                {msg.role === "bot" && msg.text === "" ? (
                  <div className="flex items-center gap-1.5">
                    <span className="w-2 h-2 bg-gray-400 dark:bg-gray-500 rounded-full animate-bounce [animation-delay:-0.3s]" />
                    <span className="w-2 h-2 bg-gray-400 dark:bg-gray-500 rounded-full animate-bounce [animation-delay:-0.15s]" />
                    <span className="w-2 h-2 bg-gray-400 dark:bg-gray-500 rounded-full animate-bounce" />
                  </div>
                ) : (
                  <>
                    <p className="whitespace-pre-wrap break-words text-sm sm:text-base leading-relaxed">
                      {msg.text}
                    </p>
                    <div
                      className={`absolute -bottom-6 ${msg.role === "user" ? "right-0" : "left-0"} opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-3`}
                    >
                      <button
                        onClick={() => copyToClipboard(msg.text, msg.id)}
                        className="text-xs text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 flex items-center gap-1"
                      >
                        {copiedId === msg.id ? (
                          <>
                            <Check size={12} />
                            Copied!
                          </>
                        ) : (
                          <>
                            <Copy size={12} />
                            Copy
                          </>
                        )}
                      </button>
                      {msg.role === "bot" &&
                        !msg.text.startsWith("[Summary]") && (
                          <button
                            onClick={() => handleSummarize(msg.text, msg.id)}
                            disabled={summarizingId === msg.id}
                            className="text-xs text-purple-400 hover:text-purple-600 dark:hover:text-purple-300 flex items-center gap-1 disabled:opacity-50"
                          >
                            {summarizingId === msg.id ? (
                              "Summarizing..."
                            ) : (
                              <>
                                <FileText size={12} />
                                Summary
                              </>
                            )}
                          </button>
                        )}
                      {msg.role === "bot" &&
                        msg.text.startsWith("[Summary]") && (
                          <button
                            onClick={() => setMessages((prev) => prev.filter((m) => m.id !== msg.id))}
                            className="text-xs text-red-400 hover:text-red-600 dark:hover:text-red-300 flex items-center gap-1"
                          >
                            <Trash2 size={12} />
                            Clear
                          </button>
                        )}
                    </div>
                  </>
                )}
              </div>
            </div>
          ))}
          <div ref={chatEndRef} />
        </div>

        {/* Language selectors */}
        <div className="px-4 sm:px-6 py-2 flex items-center justify-center gap-3 shrink-0">
          <select
            value={sourceLang}
            onChange={(e) => setSourceLang(e.target.value)}
            className="px-3 py-1.5 rounded-lg border border-gray-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
          >
            <option value="auto">Auto Detect</option>
            {Object.entries(languages).map(([code, name]) => (
              <option key={code} value={code}>
                {name}
              </option>
            ))}
          </select>
          <button
            onClick={swapLanguages}
            className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-neutral-800 transition-colors text-gray-500 dark:text-gray-400"
            title="Swap languages"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M8 3L4 7l4 4" />
              <path d="M4 7h16" />
              <path d="M16 21l4-4-4-4" />
              <path d="M20 17H4" />
            </svg>
          </button>
          <select
            value={targetLang}
            onChange={(e) => setTargetLang(e.target.value)}
            className="px-3 py-1.5 rounded-lg border border-gray-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
          >
            {Object.entries(languages).map(([code, name]) => (
              <option key={code} value={code}>
                {name}
              </option>
            ))}
          </select>
        </div>

        {/* Progress bars — stacked, each shows when active */}
        {(isTranslating || summarizingId) && (
          <div className="px-4 sm:px-6 py-2 shrink-0 space-y-2">
            {/* Translation progress */}
            {isTranslating && (
              <div className="px-4 py-2.5 rounded-lg bg-purple-50 dark:bg-purple-900/20 border border-purple-200 dark:border-purple-800">
                <div className="flex items-center justify-between text-sm font-medium mb-1.5">
                  <span className="text-purple-700 dark:text-purple-300 flex items-center gap-2">
                    <svg className="animate-spin h-3.5 w-3.5 text-purple-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"/></svg>
                    {translateProgress ? `Translating ${translateProgress.current}/${translateProgress.total}` : "Translating..."}
                  </span>
                  <span className="text-purple-600 dark:text-purple-400 font-bold text-xs">{translateProgress ? `${translateProgress.percent}%` : ""}</span>
                </div>
                <div className="w-full h-2 bg-purple-100 dark:bg-purple-900/40 rounded-full overflow-hidden">
                  <div className="h-full bg-purple-500 rounded-full transition-all duration-300" style={{ width: `${Math.max(translateProgress?.percent ?? 0, 2)}%` }} />
                </div>
              </div>
            )}
            {/* Summarization progress */}
            {summarizingId && (
              <div className="px-4 py-2.5 rounded-lg bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800">
                <div className="flex items-center justify-between text-sm font-medium mb-1.5">
                  <span className="text-amber-700 dark:text-amber-300 flex items-center gap-2">
                    <svg className="animate-spin h-3.5 w-3.5 text-amber-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"/></svg>
                    Summarizing...
                  </span>
                  <span className="text-amber-600 dark:text-amber-400 font-bold text-xs">{summaryProgress}%</span>
                </div>
                <div className="w-full h-2 bg-amber-100 dark:bg-amber-900/40 rounded-full overflow-hidden">
                  <div className="h-full bg-amber-500 rounded-full transition-all duration-300" style={{ width: `${Math.max(summaryProgress, 2)}%` }} />
                </div>
              </div>
            )}
          </div>
        )}

        {/* Input area */}
        <div className="border-t border-gray-200 dark:border-neutral-800 px-4 sm:px-6 py-3 shrink-0">
          <div className="flex gap-3 items-end max-w-4xl mx-auto">
            <div className="flex-1 relative">
              <textarea
                ref={textareaRef}
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Enter text to translate..."
                rows={3}
                className="w-full px-4 py-3 rounded-xl border border-gray-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 text-sm sm:text-base resize-none focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent placeholder-gray-400 dark:placeholder-gray-600"
              />
              <span className="absolute bottom-1.5 right-3 text-xs text-gray-400 dark:text-gray-600">
                {inputText.length}
              </span>
            </div>
            <button
              onClick={handleUndo}
              disabled={messages.length < 2 || isTranslating}
              className="px-3 py-3 rounded-xl border border-gray-300 dark:border-neutral-700 hover:bg-gray-100 dark:hover:bg-neutral-800 disabled:opacity-30 disabled:cursor-not-allowed text-gray-500 dark:text-gray-400 text-sm transition-colors shrink-0"
              title="Undo last translation"
            >
              <RotateCcw size={20} />
            </button>
            <button
              onClick={handleClearAll}
              disabled={messages.length === 0 || isTranslating}
              className="px-3 py-3 rounded-xl border border-red-200 dark:border-red-900 hover:bg-red-50 dark:hover:bg-red-900/30 disabled:opacity-30 disabled:cursor-not-allowed text-red-400 dark:text-red-500 text-sm transition-colors shrink-0"
              title="Clear all messages"
            >
              <Trash2 size={20} />
            </button>
            <button
              onClick={handleTranslate}
              disabled={!inputText.trim() || isTranslating}
              className="px-5 py-3 rounded-xl bg-purple-600 hover:bg-purple-700 disabled:bg-purple-400 disabled:cursor-not-allowed text-white font-medium text-sm transition-colors shrink-0"
            >
              {isTranslating ? (
                <svg
                  className="animate-spin h-5 w-5"
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  viewBox="0 0 24 24"
                >
                  <circle
                    className="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="4"
                  />
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                  />
                </svg>
              ) : (
                "Translate"
              )}
            </button>
          </div>
          <div className="flex items-center justify-between mt-1.5">
            <button
              onClick={() => router.push("/")}
              className="text-xs text-gray-400 hover:text-purple-500 transition-colors flex items-center gap-1"
            >
              <ArrowLeft size={12} />
              Back
            </button>
            <span className="text-xs text-gray-400 dark:text-gray-600">Cmd+Enter to translate</span>
          </div>
        </div>
      </div>
    </div>
  );
}
