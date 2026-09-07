import { useMemo, useState, type FormEvent } from "react";
import { useQuery } from "@tanstack/react-query";
import {
    KeyRound,
    Loader2,
    RefreshCw,
    Send,
    Terminal,
    User,
    Bot,
    TriangleAlert,
    Copy,
    Check
} from "lucide-react";
import type { ChatCompletionResponse, ModelObject } from "@srouter/types";
import { api, getGatewayBaseUrl } from "@/lib/api";

interface UserApiKey {
    id: string;
    name: string;
    key: string;
    enabled: boolean;
}

interface ChatMessage {
    role: "user" | "assistant";
    content: string;
}

interface ErrorBody {
    error?: { message?: string } | string;
}

function usePlaygroundKey() {
    const keysQuery = useQuery({
        queryKey: ["user-keys"],
        queryFn: () => api.get<{ keys: UserApiKey[] }>("/v1/users/keys"),
        staleTime: 30_000
    });
    const keys = keysQuery.data?.keys ?? [];
    const firstEnabled = keys.find((k) => k.enabled);
    return { keys, firstEnabled, ...keysQuery };
}

function ModelPicker({
    baseUrl,
    apiKey,
    value,
    onChange,
    onError
}: {
    baseUrl: string;
    apiKey: string;
    value: string;
    onChange: (m: string) => void;
    onError: (msg: string) => void;
}) {
    const [open, setOpen] = useState(false);
    const [search, setSearch] = useState("");
    const [list, setList] = useState<ModelObject[]>([]);
    const [loading, setLoading] = useState(false);

    async function load() {
        if (list.length > 0) {
            setOpen((o) => !o);
            setSearch("");
            return;
        }
        setLoading(true);
        setOpen(true);
        try {
            const res = await fetch(`${baseUrl}/v1/models`, {
                headers: {
                    Authorization: `Bearer ${apiKey}`,
                    Accept: "application/json"
                }
            });
            if (!res.ok) {
                let message = `Failed to load models (HTTP ${res.status})`;
                try {
                    const body = (await res.json()) as ErrorBody;
                    message =
                        typeof body.error === "string"
                            ? body.error
                            : (body.error?.message ?? message);
                } catch {
                    // ignore body parse errors
                }
                throw new Error(message);
            }
            const data = (await res.json()) as { object: string; data: ModelObject[] };
            setList(data.data ?? []);
            if (!value && data.data[0]) onChange(data.data[0].id);
        } catch (err) {
            onError(err instanceof Error ? err.message : "Failed to load models.");
        } finally {
            setLoading(false);
        }
    }

    const filtered = useMemo(() => {
        const q = search.trim().toLowerCase();
        return q ? list.filter((m) => m.id.toLowerCase().includes(q)) : list;
    }, [list, search]);

    return (
        <div className="space-y-1.5">
            <span className="font-medium text-[var(--ink)] block text-xs">Model *</span>
            <div className="relative">
                <button
                    type="button"
                    onClick={() => void load()}
                    className="w-full rounded-[8px] border border-[var(--line)] bg-[var(--field)] px-3 py-2 text-left text-xs text-[var(--ink)] focus:outline-none focus:ring-1 focus:ring-[var(--ink)] cursor-pointer inline-flex items-center justify-between gap-2"
                >
                    <span className="truncate">
                        {loading ? "Loading models…" : value || "Select a model…"}
                    </span>
                    {loading ? (
                        <Loader2 className="size-3.5 shrink-0 animate-spin text-[var(--ink-3)]" />
                    ) : (
                        <span className="text-[var(--ink-3)] text-[10px] shrink-0">
                            {list.length > 0 ? `${list.length} available` : ""}
                        </span>
                    )}
                </button>
                {open && (
                    <div className="absolute z-30 mt-1 w-full rounded-[8px] border border-[var(--line)] bg-[var(--surface)] p-1 shadow-xl">
                        <div className="relative p-1">
                            <input
                                type="text"
                                value={search}
                                onChange={(e) => setSearch(e.target.value)}
                                placeholder="Filter models…"
                                autoFocus
                                className="w-full rounded-[6px] border border-[var(--line)] bg-[var(--field)] px-2.5 py-1.5 text-[11px] text-[var(--ink)] placeholder:text-[var(--ink-3)] focus:outline-none focus:ring-1 focus:ring-[var(--ink)]"
                            />
                        </div>
                        <div className="max-h-48 overflow-y-auto">
                            {filtered.length === 0 ? (
                                <p className="py-3 text-center text-[11px] text-[var(--ink-3)]">
                                    {list.length === 0
                                        ? "No models returned by this key."
                                        : "No models matched your filter."}
                                </p>
                            ) : (
                                filtered.map((m) => (
                                    <button
                                        key={m.id}
                                        type="button"
                                        onClick={() => {
                                            onChange(m.id);
                                            setOpen(false);
                                            setSearch("");
                                        }}
                                        className={`flex w-full items-center justify-between gap-2 rounded-[6px] px-2.5 py-1.5 text-left text-[11px] transition-colors cursor-pointer ${
                                            value === m.id
                                                ? "bg-orange-500/10 text-orange-500 font-semibold"
                                                : "text-[var(--ink)] hover:bg-[var(--field)]"
                                        }`}
                                    >
                                        <code className="truncate">{m.id}</code>
                                        <span className="shrink-0 text-[10px] text-[var(--ink-3)]">
                                            {m.owned_by}
                                        </span>
                                    </button>
                                ))
                            )}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}

export function PlaygroundPanel() {
    const { keys, firstEnabled, isPending: keysPending } = usePlaygroundKey();
    const [selectedKeyId, setSelectedKeyId] = useState<string>("");
    const [keyOpen, setKeyOpen] = useState(false);
    const selectedKey = keys.find((k) => k.id === selectedKeyId) ?? firstEnabled ?? keys[0];

    const [model, setModel] = useState("");
    const [prompt, setPrompt] = useState("");
    const [messages, setMessages] = useState<ChatMessage[]>([]);
    const [sending, setSending] = useState(false);
    const [error, setError] = useState("");
    const [copied, setCopied] = useState(false);

    const gatewayBase = getGatewayBaseUrl();
    const apiKey = selectedKey?.key ?? "";

    function handleKeyChange(id: string) {
        setSelectedKeyId(id);
        setModel("");
        setError("");
    }

    async function handleSubmit(e: FormEvent) {
        e.preventDefault();
        const trimmed = prompt.trim();
        if (!trimmed || !apiKey || sending) return;

        setError("");
        setPrompt("");
        const nextMessages: ChatMessage[] = [...messages, { role: "user", content: trimmed }];
        setMessages(nextMessages);
        setSending(true);

        try {
            const res = await fetch(`${gatewayBase}/v1/chat/completions`, {
                method: "POST",
                headers: {
                    Authorization: `Bearer ${apiKey}`,
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({
                    model,
                    messages: nextMessages.map((m) => ({ role: m.role, content: m.content })),
                    stream: false
                })
            });
            if (!res.ok) {
                let message = `Request failed (HTTP ${res.status})`;
                try {
                    const body = (await res.json()) as ErrorBody;
                    message =
                        typeof body.error === "string"
                            ? body.error
                            : (body.error?.message ?? message);
                } catch {
                    // ignore body parse errors
                }
                throw new Error(message);
            }
            const data = (await res.json()) as ChatCompletionResponse;
            const content = data.choices?.[0]?.message?.content;
            const answer =
                typeof content === "string"
                    ? content
                    : content
                      ? JSON.stringify(content, null, 2)
                      : "(empty response)";
            setMessages([...nextMessages, { role: "assistant", content: answer }]);
        } catch (err) {
            setError(err instanceof Error ? err.message : "Request failed.");
            // Roll back the optimistic user bubble so it can be resent.
            setMessages(nextMessages.slice(0, -1));
            setPrompt(trimmed);
        } finally {
            setSending(false);
        }
    }

    function handleCopy() {
        if (!selectedKey) return;
        navigator.clipboard.writeText(selectedKey.key);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    }

    const inputCls =
        "w-full rounded-[8px] border border-[var(--line)] bg-[var(--field)] px-3 py-2 text-xs text-[var(--ink)] placeholder:text-[var(--ink-3)] focus:outline-none focus:ring-1 focus:ring-[var(--ink)]";
    const labelCls = "font-medium text-[var(--ink)] block text-xs";

    return (
        <div className="mx-auto flex w-full max-w-5xl flex-col gap-5 font-mono">
            <header className="border-b border-border/80 pb-5">
                <h1 className="text-2xl font-bold tracking-tight">Playground</h1>
                <p className="mt-1 text-xs text-muted-foreground">
                    Chat against any model routed by XEYGATE using one of your API keys. Requests
                    bill against the selected key.
                </p>
            </header>

            {/* Controls */}
            <div className="grid gap-4 lg:grid-cols-[1fr_1fr_auto] rounded-xl border border-[var(--line)] bg-[var(--surface)] p-4 shadow-sm">
                {/* API key selector */}
                <div className="space-y-1.5">
                    <label className={labelCls}>API key *</label>
                    {keysPending ? (
                        <p className="text-xs text-[var(--ink-3)]">Loading keys…</p>
                    ) : keys.length === 0 ? (
                        <a
                            href="/dashboard/keys"
                            className="inline-flex items-center gap-1.5 rounded-[8px] border border-orange-500/40 bg-orange-500/10 px-3 py-2 text-xs font-semibold text-orange-500 hover:bg-orange-500/20 transition-colors"
                        >
                            <KeyRound className="size-3.5" />
                            Create an API key first
                        </a>
                    ) : (
                        <div className="relative">
                            <button
                                type="button"
                                onClick={() => setKeyOpen((o) => !o)}
                                className={`${inputCls} text-left cursor-pointer inline-flex items-center justify-between gap-2`}
                            >
                                <span className="truncate">
                                    {selectedKey?.name ?? "Select a key…"}
                                </span>
                                <span className="text-[var(--ink-3)] text-[10px] shrink-0">
                                    {selectedKey?.key.slice(0, 7)}…
                                </span>
                            </button>
                            {keyOpen && (
                                <div className="absolute z-30 mt-1 w-full rounded-[8px] border border-[var(--line)] bg-[var(--surface)] p-1 shadow-xl">
                                    {keys.map((k) => (
                                        <button
                                            key={k.id}
                                            type="button"
                                            onClick={() => {
                                                handleKeyChange(k.id);
                                                setKeyOpen(false);
                                            }}
                                            className={`flex w-full items-center justify-between gap-2 rounded-[6px] px-2.5 py-1.5 text-left text-xs transition-colors cursor-pointer ${
                                                selectedKey?.id === k.id
                                                    ? "bg-orange-500/10 text-orange-500 font-semibold"
                                                    : "text-[var(--ink)] hover:bg-[var(--field)]"
                                            }`}
                                        >
                                            <span className="truncate">{k.name}</span>
                                            <span
                                                className={`shrink-0 rounded-full px-1.5 py-0.5 text-[9px] font-semibold ${
                                                    k.enabled
                                                        ? "bg-emerald-500/10 text-emerald-500"
                                                        : "bg-rose-500/10 text-rose-500"
                                                }`}
                                            >
                                                {k.enabled ? "Active" : "Disabled"}
                                            </span>
                                        </button>
                                    ))}
                                </div>
                            )}
                        </div>
                    )}
                    {selectedKey && (
                        <p className="flex items-center gap-1.5 text-[10px] text-[var(--ink-3)]">
                            <code className="truncate">{selectedKey.key}</code>
                            <button
                                type="button"
                                onClick={handleCopy}
                                className="shrink-0 text-[var(--ink-3)] hover:text-[var(--ink)] cursor-pointer"
                                title="Copy key"
                            >
                                {copied ? (
                                    <Check className="size-3 text-emerald-500" />
                                ) : (
                                    <Copy className="size-3" />
                                )}
                            </button>
                        </p>
                    )}
                </div>

                {/* Model picker */}
                {selectedKey && apiKey ? (
                    <ModelPicker
                        baseUrl={gatewayBase}
                        apiKey={apiKey}
                        value={model}
                        onChange={(m) => setModel(m)}
                        onError={(msg) => setError(msg)}
                    />
                ) : (
                    <div className="space-y-1.5">
                        <span className={labelCls}>Model *</span>
                        <p className="text-xs text-[var(--ink-3)] pt-1.5">
                            Select an API key to load available models.
                        </p>
                    </div>
                )}

                {/* Usage hint / status */}
                <div className="flex items-end">
                    <a
                        href="/dashboard/usage"
                        className="inline-flex items-center gap-1.5 rounded-[6px] border border-[var(--line)] px-3 py-2 text-[11px] font-medium text-[var(--ink-3)] hover:text-[var(--ink)] hover:bg-[var(--field)] transition-colors"
                    >
                        View usage
                    </a>
                </div>
            </div>

            {error && (
                <div className="flex items-start gap-2 rounded-[8px] border border-rose-500/40 bg-rose-500/10 p-2.5 text-xs text-rose-500">
                    <TriangleAlert className="size-3.5 shrink-0 mt-0.5" />
                    <span>{error}</span>
                </div>
            )}

            {/* Chat pane */}
            <div className="flex flex-col overflow-hidden rounded-xl border border-[var(--line)] bg-[var(--surface)] shadow-sm">
                <div className="flex items-center justify-between border-b border-[var(--line)] px-4 py-2.5">
                    <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-[var(--ink)]">
                        <Terminal className="size-3.5 text-orange-500" />
                        {model ? (
                            <code className="text-[var(--ink)]">{model}</code>
                        ) : (
                            <span className="text-[var(--ink-3)]">chat.completions</span>
                        )}
                    </span>
                    {messages.length > 0 && (
                        <button
                            type="button"
                            onClick={() => setMessages([])}
                            className="inline-flex items-center gap-1 rounded-[6px] px-2 py-1 text-[10px] font-medium text-[var(--ink-3)] hover:text-[var(--ink)] hover:bg-[var(--field)] transition-colors cursor-pointer"
                        >
                            <RefreshCw className="size-3" />
                            Clear
                        </button>
                    )}
                </div>

                <div className="flex min-h-64 flex-col gap-3 overflow-y-auto bg-[var(--field)]/30 p-4">
                    {messages.length === 0 ? (
                        <div className="flex flex-1 flex-col items-center justify-center gap-2 py-10 text-center">
                            <div className="flex size-10 items-center justify-center rounded-xl border border-[var(--line)] bg-[var(--surface)]">
                                <Terminal className="size-4 text-[var(--ink-3)]" />
                            </div>
                            <p className="text-xs font-medium text-[var(--ink-3)]">
                                Send a prompt to start chatting
                            </p>
                            <p className="text-[10px] text-[var(--ink-3)] max-w-xs">
                                Non-streaming request to{" "}
                                <code className="text-[var(--ink)]">POST {gatewayBase}/v1/chat/completions</code>{" "}
                                with your key as Bearer token.
                            </p>
                        </div>
                    ) : (
                        messages.map((m, i) => (
                            <div
                                key={i}
                                className={`flex w-full gap-2.5 ${
                                    m.role === "user" ? "justify-end" : "justify-start"
                                }`}
                            >
                                {m.role === "assistant" && (
                                    <div className="flex size-6 shrink-0 items-center justify-center rounded-md border border-[var(--line)] bg-[var(--surface)]">
                                        <Bot className="size-3 text-orange-500" />
                                    </div>
                                )}
                                <div
                                    className={`max-w-[85%] whitespace-pre-wrap rounded-[10px] px-3 py-2 text-xs leading-relaxed ${
                                        m.role === "user"
                                            ? "bg-orange-500 text-white"
                                            : "border border-[var(--line)] bg-[var(--surface)] text-[var(--ink)]"
                                    }`}
                                >
                                    {m.content}
                                </div>
                                {m.role === "user" && (
                                    <div className="flex size-6 shrink-0 items-center justify-center rounded-md border border-orange-500/30 bg-orange-500/10">
                                        <User className="size-3 text-orange-500" />
                                    </div>
                                )}
                            </div>
                        ))
                    )}
                    {sending && (
                        <div className="flex w-full justify-start gap-2.5">
                            <div className="flex size-6 shrink-0 items-center justify-center rounded-md border border-[var(--line)] bg-[var(--surface)]">
                                <Bot className="size-3 text-orange-500" />
                            </div>
                            <div className="inline-flex items-center gap-2 rounded-[10px] border border-[var(--line)] bg-[var(--surface)] px-3 py-2 text-xs text-[var(--ink-3)]">
                                <Loader2 className="size-3 animate-spin" />
                                Thinking…
                            </div>
                        </div>
                    )}
                </div>

                {/* Composer */}
                <form onSubmit={(e) => void handleSubmit(e)} className="border-t border-[var(--line)] p-3">
                    <div className="flex items-end gap-2">
                        <textarea
                            value={prompt}
                            onChange={(e) => setPrompt(e.target.value)}
                            onKeyDown={(e) => {
                                if (e.key === "Enter" && !e.shiftKey) {
                                    e.preventDefault();
                                    (e.currentTarget.form as HTMLFormElement | null)?.requestSubmit();
                                }
                            }}
                            placeholder={
                                apiKey && model
                                    ? "Type a message… (Enter to send, Shift+Enter for newline)"
                                    : "Pick an API key and a model first…"
                            }
                            rows={2}
                            disabled={sending || !apiKey || !model}
                            className="flex-1 resize-none rounded-[8px] border border-[var(--line)] bg-[var(--field)] px-3 py-2 text-xs text-[var(--ink)] placeholder:text-[var(--ink-3)] focus:outline-none focus:ring-1 focus:ring-[var(--ink)] disabled:opacity-50"
                        />
                        <button
                            type="submit"
                            disabled={sending || !apiKey || !model || !prompt.trim()}
                            className="inline-flex items-center gap-1.5 rounded-[8px] bg-orange-500 hover:bg-orange-600 px-3.5 py-2 text-xs font-bold text-white disabled:opacity-40 disabled:cursor-not-allowed transition-colors cursor-pointer shrink-0"
                        >
                            {sending ? (
                                <Loader2 className="size-3.5 animate-spin" />
                            ) : (
                                <Send className="size-3.5" />
                            )}
                            <span className="hidden sm:inline">Send</span>
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
