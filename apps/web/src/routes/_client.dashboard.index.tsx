import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { api } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Activity, Coins, KeyRound, Copy, Check, BookOpen } from "lucide-react";

export const Route = createFileRoute("/_client/dashboard/")({
    component: ClientDashboard
});

interface UserInfo {
    id: string;
    email: string;
    name: string;
    credits: number;
}

function ClientDashboard() {
    const { data: user } = useQuery({
        queryKey: ["user-auth-status"],
        queryFn: () => api.get<UserInfo>("/v1/users/me")
    });

    const { data: usage } = useQuery({
        queryKey: ["user-usage"],
        queryFn: () => api.get<{ totalRequests: number; totalTokens: number; totalCost: number }>("/v1/users/usage")
    });

    const { data: keysData } = useQuery({
        queryKey: ["user-keys"],
        queryFn: () => api.get<{ keys: Array<{ id: string; name: string; key: string }> }>("/v1/users/keys")
    });

    const gatewayUrl = typeof window !== "undefined" ? `${window.location.origin}/v1` : "http://localhost:4000/v1";

    return (
        <div className="mx-auto flex w-full max-w-5xl flex-col gap-6 font-mono">
            <header className="border-b border-border/80 pb-5">
                <h1 className="text-2xl font-bold tracking-tight text-foreground">
                    Welcome{user?.name ? `, ${user.name}` : ""}
                </h1>
                <p className="mt-1 text-xs text-muted-foreground">
                    Manage your API keys and monitor your usage on the XEYGATE gateway.
                </p>
            </header>

            <section className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
                <article className="rounded-xl border border-border/80 bg-card/60 p-4">
                    <div className="flex items-center justify-between text-muted-foreground">
                        <span className="text-[10px] font-semibold uppercase tracking-[0.14em]">Credits</span>
                        <Coins className="size-4" strokeWidth={1.75} />
                    </div>
                    <div className="mt-2 text-2xl font-bold">${(user?.credits ?? 0).toFixed(4)}</div>
                </article>
                <article className="rounded-xl border border-border/80 bg-card/60 p-4">
                    <div className="flex items-center justify-between text-muted-foreground">
                        <span className="text-[10px] font-semibold uppercase tracking-[0.14em]">API Keys</span>
                        <KeyRound className="size-4" strokeWidth={1.75} />
                    </div>
                    <div className="mt-2 text-2xl font-bold">{keysData?.keys.length ?? 0}</div>
                </article>
                <article className="rounded-xl border border-border/80 bg-card/60 p-4">
                    <div className="flex items-center justify-between text-muted-foreground">
                        <span className="text-[10px] font-semibold uppercase tracking-[0.14em]">Total Requests</span>
                        <Activity className="size-4" strokeWidth={1.75} />
                    </div>
                    <div className="mt-2 text-2xl font-bold">{(usage?.totalRequests ?? 0).toLocaleString()}</div>
                </article>
            </section>

            <Card>
                <CardHeader>
                    <div className="flex items-center gap-2">
                        <BookOpen className="size-4 text-muted-foreground" />
                        <CardTitle className="text-sm">Quick Start</CardTitle>
                    </div>
                </CardHeader>
                <CardContent className="space-y-4">
                    <p className="text-xs text-muted-foreground">
                        Use your API key to make requests. Compatible with OpenAI SDKs and tools.
                    </p>
                    <div className="space-y-3">
                        <h4 className="text-xs font-semibold text-foreground">Gateway Base URL</h4>
                        <CopyableCode text={gatewayUrl} />
                    </div>
                    <div className="space-y-3">
                        <h4 className="text-xs font-semibold text-foreground">cURL</h4>
                        <CopyableCode text={`curl ${gatewayUrl}/chat/completions \\
  -H "Authorization: Bearer YOUR_API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{"model":"gpt-4o-mini","messages":[{"role":"user","content":"Hello!"}]}'`} />
                    </div>
                    <div className="space-y-3">
                        <h4 className="text-xs font-semibold text-foreground">Python</h4>
                        <CopyableCode text={`from openai import OpenAI
client = OpenAI(api_key="YOUR_API_KEY", base_url="${gatewayUrl}")
resp = client.chat.completions.create(
    model="gpt-4o-mini",
    messages=[{"role":"user","content":"Hello!"}]
)
print(resp.choices[0].message.content)`} />
                    </div>
                    <div className="space-y-3">
                        <h4 className="text-xs font-semibold text-foreground">JavaScript</h4>
                        <CopyableCode text={`import OpenAI from "openai";
const client = new OpenAI({ apiKey: "YOUR_API_KEY", baseURL: "${gatewayUrl}" });
const resp = await client.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [{ role: "user", content: "Hello!" }]
});
console.log(resp.choices[0].message.content);`} />
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}

function CopyableCode({ text }: { text: string }) {
    const [copied, setCopied] = useState(false);
    function handleCopy() {
        navigator.clipboard.writeText(text);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    }
    return (
        <div className="relative group">
            <pre className="rounded-lg border border-border/80 bg-secondary/30 p-3 text-[11px] text-foreground/90 overflow-x-auto whitespace-pre-wrap break-all">{text}</pre>
            <button type="button" onClick={handleCopy} className="absolute top-2 right-2 p-1.5 rounded-md border border-border/80 bg-background/80 opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer hover:bg-secondary">
                {copied ? <Check className="size-3 text-emerald-500" /> : <Copy className="size-3 text-muted-foreground" />}
            </button>
        </div>
    );
}
