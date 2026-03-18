"use client";

import { ThemeToggle } from "@/components/ThemeToggle";
import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowRight,
  Download,
  MessageSquare,
  Pencil,
  Plus,
  Settings2,
  Trash2,
  X,
  Check,
} from "lucide-react";

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
  message_count: number;
}

interface ProviderInfo {
  label: string;
  requires_key: boolean;
  translate_models: string[];
  summarize_models: string[];
}

interface ProvidersMap {
  [key: string]: ProviderInfo;
}

interface AppSettings {
  provider: string;
  translate_model: string;
  summarize_model: string;
  api_key: string;
  ollama_url: string;
  chunk_level: string;
}

type UILang = "ko" | "en" | "zh";

const UI_LANG_MAP: Record<UILang, string> = { ko: "한국어", en: "EN", zh: "中文" };
const UI_DEFAULT_TARGET: Record<UILang, string> = { ko: "ko", en: "en", zh: "zh" };

const i18n: Record<UILang, Record<string, string>> = {
  ko: {
    quickTranslate: "빠른 번역",
    sessions: "번역 세션",
    newSession: "새 세션",
    noSessions: "세션이 없습니다",
    noSessionsDesc: "새 세션을 만들어 번역을 시작하세요",
    translate: "번역",
    translating: "...",
    messages: "메시지",
    delete: "삭제?",
    copy: "복사",
    summary: "요약",
    clear: "지우기",
    moreLangs: "── 추가 언어 ──",
    autoDetect: "자동 감지",
    summarizing: "요약 중...",
    settings: "설정",
    provider: "제공자",
    translateModel: "번역 모델",
    summarizeModel: "요약 모델",
    apiKey: "API 키",
    ollamaUrl: "Ollama URL",
    save: "저장",
    cancel: "취소",
    translation: "번역",
    summarization: "요약",
    connection: "연결",
  },
  en: {
    quickTranslate: "{t.quickTranslate}",
    sessions: "{t.sessions}",
    newSession: "{t.newSession}",
    noSessions: "{t.noSessions}",
    noSessionsDesc: "Create a new session to start translating",
    translate: "Translate",
    translating: "...",
    messages: "messages",
    delete: "{t.delete}",
    copy: "Copy",
    summary: "Summary",
    clear: "Clear",
    moreLangs: "{t.moreLangs}",
    autoDetect: "{t.autoDetect}",
    summarizing: "{t.summarizing}",
    settings: "Settings",
    provider: "Provider",
    translateModel: "Translate Model",
    summarizeModel: "Summarize Model",
    apiKey: "API Key",
    ollamaUrl: "Ollama URL",
    save: "Save",
    cancel: "Cancel",
    translation: "Translation",
    summarization: "Summarization",
    connection: "Connection",
  },
  zh: {
    quickTranslate: "快速翻译",
    sessions: "翻译会话",
    newSession: "新会话",
    noSessions: "暂无会话",
    noSessionsDesc: "创建新会话开始翻译",
    translate: "翻译",
    translating: "...",
    messages: "条消息",
    delete: "删除？",
    copy: "复制",
    summary: "摘要",
    clear: "清除",
    moreLangs: "── 更多语言 ──",
    autoDetect: "自动检测",
    summarizing: "正在摘要...",
    settings: "设置",
    provider: "提供商",
    translateModel: "翻译模型",
    summarizeModel: "摘要模型",
    apiKey: "API 密钥",
    ollamaUrl: "Ollama URL",
    save: "保存",
    cancel: "取消",
    translation: "翻译",
    summarization: "摘要",
    connection: "连接",
  },
};

export default function Home() {
  const router = useRouter();
  const [uiLang, setUILang] = useState<UILang>("ko");

  useEffect(() => {
    const match = document.cookie.match(/(?:^| )uilang=([^;]+)/);
    if (match && (match[1] === "ko" || match[1] === "en" || match[1] === "zh")) {
      setUILang(match[1] as UILang);
    }
  }, []);
  const t = i18n[uiLang];

  const handleUILangChange = (lang: UILang) => {
    setUILang(lang);
    setInstantTargetLang(UI_DEFAULT_TARGET[lang]);
    document.cookie = `uilang=${lang}; path=/`;
  };

  // Instant translate state
  const [instantInput, setInstantInput] = useState("");
  const [instantResult, setInstantResult] = useState("");
  const [instantSourceLang, setInstantSourceLang] = useState("auto");
  const [instantTargetLang, setInstantTargetLang] = useState("ko");
  const [isInstantTranslating, setIsInstantTranslating] = useState(false);
  const [instantProgress, setInstantProgress] = useState<{ current: number; total: number; percent: number } | null>(null);
  const [isSummarizing, setIsSummarizing] = useState(false);
  const [summaryProgress, setSummaryProgress] = useState(0);
  const [summaryResult, setSummaryResult] = useState("");

  // Sessions state
  const [sessions, setSessions] = useState<Session[]>([]);
  const [languages, setLanguages] = useState<LanguageMap>({});
  const [primaryLangs, setPrimaryLangs] = useState<LanguageMap>({});
  const [extendedLangs, setExtendedLangs] = useState<LanguageMap>({});
  const [ollamaStatus, setOllamaStatus] = useState<"ok" | "error" | "loading">(
    "loading",
  );

  // Editing state
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingTitle, setEditingTitle] = useState("");

  // Deletion confirmation
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // Settings modal state
  const [showSettings, setShowSettings] = useState(false);
  const [settingsProviders, setSettingsProviders] = useState<ProvidersMap>({});
  const [appSettings, setAppSettings] = useState<AppSettings>({
    provider: "ollama",
    translate_model: "translategemma:latest",
    summarize_model: "qwen3.5:latest",
    api_key: "",
    ollama_url: "http://localhost:11434",
  });
  const [draftSettings, setDraftSettings] = useState<AppSettings>({ ...appSettings });
  const [settingsConfigured, setSettingsConfigured] = useState(false);

  useEffect(() => {
    fetch("/api/languages")
      .then((res) => res.json())
      .then((data) => {
        setLanguages(data.languages || {});
        setPrimaryLangs(data.primary || {});
        setExtendedLangs(data.extended || {});
      })
      .catch(() => {});

    fetch("/api/ollama/status")
      .then((res) => res.json())
      .then((data) =>
        setOllamaStatus(data.status === "ok" ? "ok" : "error"),
      )
      .catch(() => setOllamaStatus("error"));

    fetch("/api/settings")
      .then((res) => res.json())
      .then((data) => {
        if (data.providers) setSettingsProviders(data.providers);
        if (data.settings) {
          const s = data.settings as AppSettings;
          setAppSettings(s);
          setDraftSettings(s);
          setSettingsConfigured(s.provider !== "ollama" || s.api_key !== "");
        }
      })
      .catch(() => {});

    loadSessions();
  }, []);

  const loadSessions = () => {
    fetch("/api/sessions")
      .then((res) => res.json())
      .then((data) => setSessions(data.sessions || []))
      .catch(() => {});
  };

  const handleOpenSettings = useCallback(() => {
    setDraftSettings({ ...appSettings });
    setShowSettings(true);
  }, [appSettings]);

  const handleSaveSettings = useCallback(async () => {
    try {
      const res = await fetch("/api/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(draftSettings),
      });
      const data = await res.json();
      if (data.settings) {
        const s = data.settings as AppSettings;
        setAppSettings(s);
        setSettingsConfigured(s.provider !== "ollama" || s.api_key !== "");
      }
    } catch {
      // noop
    }
    setShowSettings(false);
  }, [draftSettings]);

  const handleDraftProviderChange = useCallback(
    (provider: string) => {
      const info = settingsProviders[provider];
      if (!info) return;
      setDraftSettings((prev) => ({
        ...prev,
        provider,
        translate_model: info.translate_models[0] || "",
        summarize_model: info.summarize_models[0] || "",
        api_key: provider === appSettings.provider ? prev.api_key : "",
      }));
    },
    [settingsProviders, appSettings.provider],
  );

  const handleInstantTranslate = useCallback(async () => {
    const text = instantInput.trim();
    if (!text || isInstantTranslating) return;

    setIsInstantTranslating(true);
    setInstantResult("");
    setInstantProgress(null);

    try {
      const bp = process.env.NEXT_PUBLIC_BACKEND_PORT || "8050";
      const res = await fetch(`http://localhost:${bp}/api/translate/stream`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text,
          source_lang: instantSourceLang,
          target_lang: instantTargetLang,
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
                setInstantProgress({ current: evt.current, total: evt.total, percent: evt.percent });
              } else if (evt.type === "complete") {
                setInstantResult(evt.translated || "Translation failed.");
                setInstantProgress(null);
                setIsInstantTranslating(false);
              }
            } catch { /* ignore parse errors */ }
          }
        }
      }
    } catch {
      setInstantResult("Error: Could not connect to translation service.");
    } finally {
      setIsInstantTranslating(false);
      setInstantProgress(null);
    }
  }, [instantInput, isInstantTranslating, instantSourceLang, instantTargetLang]);

  const handleCreateSession = useCallback(async () => {
    try {
      const res = await fetch("/api/sessions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: "{t.newSession}",
          source_lang: "auto",
          target_lang: "ko",
        }),
      });
      const data = await res.json();
      if (data.id) {
        router.push(`/session/${data.id}`);
      }
    } catch {
      // noop
    }
  }, [router]);

  const handleDeleteSession = useCallback(
    async (id: string) => {
      try {
        await fetch(`/api/sessions/${id}`, { method: "DELETE" });
        setSessions((prev) => prev.filter((s) => s.id !== id));
      } catch {
        // noop
      }
      setDeletingId(null);
    },
    [],
  );

  const handleSaveTitle = useCallback(
    async (id: string) => {
      const t = editingTitle.trim();
      if (!t) {
        setEditingId(null);
        return;
      }
      try {
        await fetch(`/api/sessions/${id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ title: t }),
        });
        setSessions((prev) =>
          prev.map((s) => (s.id === id ? { ...s, title: t } : s)),
        );
      } catch {
        // noop
      }
      setEditingId(null);
    },
    [editingTitle],
  );

  const handleExport = useCallback(async (id: string, title: string) => {
    try {
      const res = await fetch(`/api/sessions/${id}/export?format=md`);
      const text = await res.text();
      const blob = new Blob([text], { type: "text/markdown" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${title.replace(/[^a-zA-Z0-9가-힣]/g, "_")}.md`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      // noop
    }
  }, []);

  const formatTime = (dateStr: string) => {
    const d = new Date(dateStr);
    const now = new Date();
    const diff = now.getTime() - d.getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return "Just now";
    if (mins < 60) return `${mins}m ago`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    if (days < 7) return `${days}d ago`;
    return d.toLocaleDateString();
  };

  const statusColor =
    ollamaStatus === "ok"
      ? "bg-green-500"
      : ollamaStatus === "error"
        ? "bg-red-500"
        : "bg-yellow-500 animate-pulse";

  return (
    <div className="min-h-screen flex flex-col bg-white dark:bg-neutral-950">
      {/* Top bar */}
      <header className="border-b border-gray-200 dark:border-neutral-800 px-4 sm:px-6 py-3 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-3">
          <h1 className="text-xl font-bold text-purple-600 dark:text-purple-400">
            Localingo
          </h1>
          <span
            className={`w-2.5 h-2.5 rounded-full ${statusColor}`}
            title={`Ollama: ${ollamaStatus}`}
          />
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center border border-gray-200 dark:border-neutral-700 rounded-lg overflow-hidden text-xs">
            {(Object.entries(UI_LANG_MAP) as [UILang, string][]).map(([code, label]) => (
              <button
                key={code}
                onClick={() => handleUILangChange(code)}
                className={`px-2 py-1 transition-colors ${uiLang === code ? "bg-purple-600 text-white" : "text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-neutral-800"}`}
              >
                {label}
              </button>
            ))}
          </div>
          <button
            onClick={handleOpenSettings}
            className="relative p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-neutral-800 transition-colors text-gray-500 dark:text-gray-400 hover:text-purple-500"
            title={t.settings}
          >
            <Settings2 size={18} />
            {settingsConfigured && (
              <span className="absolute top-0.5 right-0.5 w-2 h-2 rounded-full bg-green-500" />
            )}
          </button>
          <ThemeToggle />
        </div>
      </header>

      <div className="flex-1 overflow-y-auto">
        {/* Instant Translate Section */}
        <section className="border-b border-gray-200 dark:border-neutral-800 px-4 sm:px-6 py-6">
          <div className="max-w-4xl mx-auto">
            <h2 className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-3">
              {t.quickTranslate}
            </h2>
            <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center">
              <select
                value={instantSourceLang}
                onChange={(e) => setInstantSourceLang(e.target.value)}
                className="px-3 py-2 rounded-lg border border-gray-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500 shrink-0"
              >
                <option value="auto">{t.autoDetect}</option>
                {Object.entries(primaryLangs).map(([code, name]) => (
                  <option key={code} value={code}>{name}</option>
                ))}
                <optgroup label="{t.moreLangs}">
                  {Object.entries(extendedLangs).map(([code, name]) => (
                    <option key={code} value={code}>{name}</option>
                  ))}
                </optgroup>
              </select>
              <div className="flex-1 relative">
                <input
                  type="text"
                  value={instantInput}
                  onChange={(e) => setInstantInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      handleInstantTranslate();
                    }
                  }}
                  placeholder={uiLang === "ko" ? "번역할 텍스트를 입력하세요..." : uiLang === "zh" ? "输入要翻译的文本..." : "Type text to translate..."}
                  className="w-full px-4 py-2 rounded-lg border border-gray-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500 placeholder-gray-400 dark:placeholder-gray-600"
                />
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <button
                  onClick={() => {
                    const tmp = instantSourceLang;
                    setInstantSourceLang(instantTargetLang);
                    setInstantTargetLang(tmp === "auto" ? "en" : tmp);
                  }}
                  className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-neutral-800 transition-colors text-gray-400 hover:text-purple-500 hidden sm:block"
                  title="Swap languages"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M8 3L4 7l4 4"/><path d="M4 7h16"/><path d="M16 21l4-4-4-4"/><path d="M20 17H4"/></svg>
                </button>
                <select
                  value={instantTargetLang}
                  onChange={(e) => setInstantTargetLang(e.target.value)}
                  className="px-3 py-2 rounded-lg border border-gray-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
                >
                  {Object.entries(primaryLangs).map(([code, name]) => (
                    <option key={code} value={code}>{name}</option>
                  ))}
                  <optgroup label="{t.moreLangs}">
                    {Object.entries(extendedLangs).map(([code, name]) => (
                      <option key={code} value={code}>{name}</option>
                    ))}
                  </optgroup>
                </select>
                <button
                  onClick={handleInstantTranslate}
                  disabled={!instantInput.trim() || isInstantTranslating}
                  className="px-4 py-2 rounded-lg bg-purple-600 hover:bg-purple-700 disabled:bg-purple-400 disabled:cursor-not-allowed text-white font-medium text-sm transition-colors whitespace-nowrap"
                >
                  {isInstantTranslating ? t.translating : t.translate}
                </button>
              </div>
            </div>
            {isInstantTranslating && (() => {
              const pct = instantProgress?.percent ?? 0;
              const chunks = instantProgress?.total ?? 1;
              const current = instantProgress?.current ?? 0;
              return (
              <div className="mt-3 px-4 py-3 rounded-lg bg-purple-50 dark:bg-purple-900/20 border border-purple-200 dark:border-purple-800">
                <div className="flex items-center justify-between text-sm font-medium mb-2">
                  <span className="text-purple-700 dark:text-purple-300 flex items-center gap-2">
                    <svg className="animate-spin h-4 w-4 text-purple-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"/></svg>
                    {uiLang === "ko" ? `번역 중 ${current} / ${chunks} 청크` : uiLang === "zh" ? `翻译中 ${current} / ${chunks} 块` : `Translating chunk ${current} / ${chunks}`}
                  </span>
                  <span className="text-purple-600 dark:text-purple-400 font-bold">{pct}%</span>
                </div>
                <div className="w-full h-3 bg-purple-100 dark:bg-purple-900/40 rounded-full overflow-hidden">
                  <div className="h-full bg-purple-500 rounded-full transition-all duration-300" style={{ width: `${Math.max(pct, 2)}%` }} />
                </div>
              </div>
              );
            })()}
            {instantResult && (
              <div className="mt-3 px-4 py-3 rounded-lg bg-gray-50 dark:bg-neutral-900 border border-gray-200 dark:border-neutral-800">
                <p className="text-sm sm:text-base text-gray-900 dark:text-gray-100 whitespace-pre-wrap">
                  {instantResult}
                </p>
                <div className="flex items-center justify-between mt-2 pt-2 border-t border-gray-200 dark:border-neutral-700">
                  <div className="flex items-center gap-3">
                  <button
                    onClick={() => { navigator.clipboard.writeText(instantResult); }}
                    className="text-xs text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 flex items-center gap-1"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="14" height="14" x="8" y="8" rx="2" ry="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/></svg>
                    {t.copy}
                  </button>
                  <button
                    onClick={async () => {
                      setIsSummarizing(true);
                      setSummaryResult("");
                      setSummaryProgress(0);
                      try {
                        const bps = process.env.NEXT_PUBLIC_BACKEND_PORT || "8050";
                        const res = await fetch(`http://localhost:${bps}/api/summarize/stream`, {
                          method: "POST",
                          headers: { "Content-Type": "application/json" },
                          body: JSON.stringify({ text: instantResult, language: instantTargetLang }),
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
                                  setSummaryResult(evt.summary || "Summary failed.");
                                  setSummaryProgress(100);
                                  setIsSummarizing(false);
                                }
                              } catch {}
                            }
                          }
                        }
                      } catch { setSummaryResult("Error: Could not summarize."); }
                      setIsSummarizing(false);
                    }}
                    disabled={isSummarizing || !!summaryResult}
                    className="text-xs text-purple-400 hover:text-purple-600 dark:hover:text-purple-300 flex items-center gap-1 disabled:opacity-50"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>
                    {t.summary}
                  </button>
                  </div>
                  <button
                    onClick={() => { setInstantResult(""); setInstantInput(""); setSummaryResult(""); setSummaryProgress(0); }}
                    className="text-xs text-red-400 hover:text-red-600 dark:hover:text-red-300 flex items-center gap-1"
                  >
                    <Trash2 size={12} />
                    {t.clear}
                  </button>
                </div>
              </div>
            )}
            {/* Summary progress bar */}
            {isSummarizing && (
              <div className="mt-3 px-4 py-3 rounded-lg bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800">
                <div className="flex items-center justify-between text-sm font-medium mb-2">
                  <span className="text-amber-700 dark:text-amber-300 flex items-center gap-2">
                    <svg className="animate-spin h-4 w-4 text-amber-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"/></svg>
                    {t.summarizing}
                  </span>
                  <span className="text-amber-600 dark:text-amber-400 font-bold">{summaryProgress}%</span>
                </div>
                <div className="w-full h-3 bg-amber-100 dark:bg-amber-900/40 rounded-full overflow-hidden">
                  <div className="h-full bg-amber-500 rounded-full transition-all duration-300" style={{ width: `${Math.max(summaryProgress, 2)}%` }} />
                </div>
              </div>
            )}
            {/* Summary result card */}
            {summaryResult && (
              <div className="mt-3 px-4 py-3 rounded-lg bg-purple-50 dark:bg-purple-900/20 border border-purple-200 dark:border-purple-800">
                <div className="flex items-center gap-2 mb-2">
                  <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-purple-500"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>
                  <span className="text-xs font-semibold text-purple-600 dark:text-purple-400">Summary</span>
                </div>
                <p className="text-sm sm:text-base text-gray-900 dark:text-gray-100 whitespace-pre-wrap">
                  {summaryResult}
                </p>
                <div className="flex items-center justify-between mt-2 pt-2 border-t border-purple-200 dark:border-purple-700">
                  <button
                    onClick={() => { navigator.clipboard.writeText(summaryResult); }}
                    className="text-xs text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 flex items-center gap-1"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="14" height="14" x="8" y="8" rx="2" ry="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/></svg>
                    {t.copy}
                  </button>
                  <button
                    onClick={() => setSummaryResult("")}
                    className="text-xs text-red-400 hover:text-red-600 flex items-center gap-1"
                  >
                    <Trash2 size={12} />
                    {t.clear}
                  </button>
                </div>
              </div>
            )}
          </div>
        </section>

        {/* Sessions Section */}
        <section className="px-4 sm:px-6 py-6">
          <div className="max-w-4xl mx-auto">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                {t.sessions}
              </h2>
              <button
                onClick={handleCreateSession}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-purple-600 hover:bg-purple-700 text-white text-sm font-medium transition-colors"
              >
                <Plus size={16} />
                {t.newSession}
              </button>
            </div>

            {sessions.length === 0 ? (
              <div className="text-center py-16 text-gray-400 dark:text-gray-600">
                <MessageSquare
                  size={48}
                  className="mx-auto mb-4 opacity-50"
                />
                <p className="text-lg font-medium">{t.noSessions}</p>
                <p className="text-sm mt-1">
                  {t.noSessionsDesc}
                </p>
              </div>
            ) : (
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {sessions.map((s) => (
                  <div
                    key={s.id}
                    className="group relative border border-gray-200 dark:border-neutral-800 rounded-xl p-4 hover:shadow-md hover:border-purple-300 dark:hover:border-purple-700 transition-all cursor-pointer bg-white dark:bg-neutral-900"
                    onClick={() => {
                      if (editingId !== s.id && deletingId !== s.id) {
                        router.push(`/session/${s.id}`);
                      }
                    }}
                  >
                    {/* Title */}
                    <div className="flex items-start justify-between gap-2 mb-2">
                      {editingId === s.id ? (
                        <div
                          className="flex items-center gap-1 flex-1"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <input
                            autoFocus
                            value={editingTitle}
                            onChange={(e) => setEditingTitle(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === "Enter") handleSaveTitle(s.id);
                              if (e.key === "Escape") setEditingId(null);
                            }}
                            onBlur={() => handleSaveTitle(s.id)}
                            className="flex-1 text-sm font-semibold bg-transparent border-b border-purple-500 outline-none text-gray-900 dark:text-gray-100 px-0.5"
                          />
                        </div>
                      ) : (
                        <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100 truncate">
                          {s.title}
                        </h3>
                      )}
                    </div>

                    {/* Meta */}
                    <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400 mb-3">
                      <span className="px-1.5 py-0.5 rounded bg-gray-100 dark:bg-neutral-800 font-mono">
                        {s.source_lang === "auto"
                          ? "Auto"
                          : languages[s.source_lang] || s.source_lang}
                      </span>
                      <ArrowRight size={12} />
                      <span className="px-1.5 py-0.5 rounded bg-gray-100 dark:bg-neutral-800 font-mono">
                        {languages[s.target_lang] || s.target_lang}
                      </span>
                    </div>

                    <div className="flex items-center justify-between text-xs text-gray-400 dark:text-gray-500">
                      <span>{s.message_count} {t.messages}</span>
                      <span>{formatTime(s.updated_at)}</span>
                    </div>

                    {/* Hover actions */}
                    {deletingId === s.id ? (
                      <div
                        className="absolute top-2 right-2 flex items-center gap-1 bg-red-50 dark:bg-red-900/30 rounded-lg px-2 py-1"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <span className="text-xs text-red-600 dark:text-red-400 mr-1">
                          {t.delete}
                        </span>
                        <button
                          onClick={() => handleDeleteSession(s.id)}
                          className="p-0.5 rounded hover:bg-red-100 dark:hover:bg-red-900/50 text-red-600 dark:text-red-400"
                          title="Confirm delete"
                        >
                          <Check size={14} />
                        </button>
                        <button
                          onClick={() => setDeletingId(null)}
                          className="p-0.5 rounded hover:bg-gray-200 dark:hover:bg-neutral-700 text-gray-500"
                          title="Cancel"
                        >
                          <X size={14} />
                        </button>
                      </div>
                    ) : (
                      <div
                        className="absolute top-2 right-2 flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <button
                          onClick={() => {
                            setEditingId(s.id);
                            setEditingTitle(s.title);
                          }}
                          className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-neutral-800 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
                          title="Edit title"
                        >
                          <Pencil size={14} />
                        </button>
                        <button
                          onClick={() => handleExport(s.id, s.title)}
                          className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-neutral-800 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
                          title="Export session"
                        >
                          <Download size={14} />
                        </button>
                        <button
                          onClick={() => setDeletingId(s.id)}
                          className="p-1.5 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/30 text-gray-400 hover:text-red-500 dark:hover:text-red-400 transition-colors"
                          title="Delete session"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>
      </div>

      {/* Footer */}
      <footer className="border-t border-gray-200 dark:border-neutral-800 px-6 py-2 text-center text-xs text-gray-400 dark:text-gray-600 shrink-0">
        &copy; chadchae
      </footer>

      {/* Settings Modal */}
      {showSettings && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={() => setShowSettings(false)}>
          <div
            className="bg-white dark:bg-neutral-900 rounded-2xl shadow-xl border border-gray-200 dark:border-neutral-700 w-full max-w-md mx-4"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-neutral-700">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">{t.settings}</h2>
              <button
                onClick={() => setShowSettings(false)}
                className="p-1 rounded-lg hover:bg-gray-100 dark:hover:bg-neutral-800 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
              >
                <X size={18} />
              </button>
            </div>

            {/* Body */}
            <div className="px-6 py-5 space-y-5">
              {/* Provider */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                  {t.provider}
                </label>
                <select
                  value={draftSettings.provider}
                  onChange={(e) => handleDraftProviderChange(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-neutral-600 bg-white dark:bg-neutral-800 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
                >
                  {Object.entries(settingsProviders).map(([key, info]) => (
                    <option key={key} value={key}>{info.label}</option>
                  ))}
                </select>
              </div>

              {/* Translation Model */}
              {(settingsProviders[draftSettings.provider]?.translate_models.length ?? 0) > 0 && (
                <div>
                  <div className="flex items-center gap-2 mb-1.5">
                    <div className="h-px flex-1 bg-gray-200 dark:bg-neutral-700" />
                    <span className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">{t.translation}</span>
                    <div className="h-px flex-1 bg-gray-200 dark:bg-neutral-700" />
                  </div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                    {t.translateModel}
                  </label>
                  <select
                    value={draftSettings.translate_model}
                    onChange={(e) => setDraftSettings((prev) => ({ ...prev, translate_model: e.target.value }))}
                    className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-neutral-600 bg-white dark:bg-neutral-800 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
                  >
                    {settingsProviders[draftSettings.provider]?.translate_models.map((m) => (
                      <option key={m} value={m}>{m}</option>
                    ))}
                  </select>
                </div>
              )}

              {/* Summarization Model */}
              {(settingsProviders[draftSettings.provider]?.summarize_models.length ?? 0) > 0 && (
                <div>
                  <div className="flex items-center gap-2 mb-1.5">
                    <div className="h-px flex-1 bg-gray-200 dark:bg-neutral-700" />
                    <span className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">{t.summarization}</span>
                    <div className="h-px flex-1 bg-gray-200 dark:bg-neutral-700" />
                  </div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                    {t.summarizeModel}
                  </label>
                  <select
                    value={draftSettings.summarize_model}
                    onChange={(e) => setDraftSettings((prev) => ({ ...prev, summarize_model: e.target.value }))}
                    className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-neutral-600 bg-white dark:bg-neutral-800 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
                  >
                    {settingsProviders[draftSettings.provider]?.summarize_models.map((m) => (
                      <option key={m} value={m}>{m}</option>
                    ))}
                  </select>
                </div>
              )}

              {/* Connection section */}
              <div>
                <div className="flex items-center gap-2 mb-1.5">
                  <div className="h-px flex-1 bg-gray-200 dark:bg-neutral-700" />
                  <span className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">{t.connection}</span>
                  <div className="h-px flex-1 bg-gray-200 dark:bg-neutral-700" />
                </div>

                {/* Ollama URL (only for ollama) */}
                {draftSettings.provider === "ollama" && (
                  <div className="mb-3">
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                      {t.ollamaUrl}
                    </label>
                    <input
                      type="text"
                      value={draftSettings.ollama_url}
                      onChange={(e) => setDraftSettings((prev) => ({ ...prev, ollama_url: e.target.value }))}
                      className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-neutral-600 bg-white dark:bg-neutral-800 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500 font-mono"
                      placeholder="http://localhost:11434"
                    />
                  </div>
                )}

                {/* API Key (only when provider requires it) */}
                {settingsProviders[draftSettings.provider]?.requires_key && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                      {t.apiKey}
                    </label>
                    <input
                      type="password"
                      value={draftSettings.api_key}
                      onChange={(e) => setDraftSettings((prev) => ({ ...prev, api_key: e.target.value }))}
                      className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-neutral-600 bg-white dark:bg-neutral-800 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500 font-mono"
                      placeholder="sk-..."
                    />
                  </div>
                )}
              </div>

                {/* Chunk Size */}
                <div className="mt-4 pt-4 border-t border-gray-200 dark:border-neutral-700">
                  <label className="block text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2">
                    {uiLang === "ko" ? "청킹 크기" : uiLang === "zh" ? "分块大小" : "Chunk Size"}
                  </label>
                  <select
                    value={draftSettings.chunk_level || "medium"}
                    onChange={(e) => setDraftSettings((prev) => ({ ...prev, chunk_level: e.target.value }))}
                    className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-neutral-600 bg-white dark:bg-neutral-800 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
                  >
                    <option value="xsmall">{uiLang === "ko" ? "아주 작음 (100자) — 세밀한 진행률" : uiLang === "zh" ? "极小 (100字)" : "XSmall (100) — Fine-grained progress"}</option>
                    <option value="small">{uiLang === "ko" ? "작음 (500자) — 빠른 응답, 많은 호출" : uiLang === "zh" ? "小 (500字)" : "Small (500) — Fast response, more calls"}</option>
                    <option value="medium">{uiLang === "ko" ? "보통 (1,500자) — 균형 (기본값)" : uiLang === "zh" ? "中 (1,500字) — 默认" : "Medium (1,500) — Balanced (default)"}</option>
                    <option value="large">{uiLang === "ko" ? "크게 (3,000자) — 적은 호출, 느린 응답" : uiLang === "zh" ? "大 (3,000字)" : "Large (3,000) — Fewer calls, slower"}</option>
                    <option value="xlarge">{uiLang === "ko" ? "매우 크게 (5,000자) — 최소 호출" : uiLang === "zh" ? "超大 (5,000字)" : "XLarge (5,000) — Minimum calls"}</option>
                  </select>
                  <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
                    {uiLang === "ko" ? "긴 텍스트를 나누는 단위. 작을수록 진행률이 세밀하지만 호출 횟수 증가." : uiLang === "zh" ? "长文本分割单位。越小进度越细，但调用次数增加。" : "Unit for splitting long text. Smaller = finer progress but more API calls."}
                  </p>
                </div>

            </div>

            {/* Footer */}
            <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-gray-200 dark:border-neutral-700">
              <button
                onClick={() => setShowSettings(false)}
                className="px-4 py-2 rounded-lg border border-gray-300 dark:border-neutral-600 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-neutral-800 transition-colors"
              >
                {t.cancel}
              </button>
              <button
                onClick={handleSaveSettings}
                className="px-4 py-2 rounded-lg bg-purple-600 hover:bg-purple-700 text-white text-sm font-medium transition-colors"
              >
                {t.save}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
