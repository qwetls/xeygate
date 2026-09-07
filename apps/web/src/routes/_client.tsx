import type { ReactNode } from "react";
import { createFileRoute, Link, Outlet } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { Zap } from "lucide-react";

export const Route = createFileRoute("/_client")({
    component: ClientLayout
});

interface UserInfo {
    id: string;
    email: string;
    name: string;
    credits: number;
    role: "buyer" | "creator";
}

function ClientLayout() {
    const statusQuery = useQuery({
        queryKey: ["user-auth-status"],
        queryFn: () => api.get<UserInfo>("/v1/users/me"),
        retry: false,
        staleTime: 0
    });

    if (statusQuery.isPending) {
        return (
            <main className="flex min-h-svh items-center justify-center bg-background">
                <p className="font-mono text-xs text-muted-foreground">Loading...</p>
            </main>
        );
    }

    if (statusQuery.isError) {
        return <UnauthenticatedRedirect />;
    }

    return (
        <div className="flex min-h-svh bg-background">
            <ClientSidebar user={statusQuery.data} />
            <main className="flex-1 overflow-y-auto p-4 sm:p-6">
                <Outlet />
            </main>
        </div>
    );
}

function UnauthenticatedRedirect() {
    return (
        <main className="flex min-h-svh items-center justify-center bg-background px-4">
            <div className="text-center space-y-4">
                <div className="flex justify-center">
                    <div className="flex size-12 items-center justify-center rounded-xl border border-border/80 bg-secondary/50">
                        <Zap className="size-6" strokeWidth={2} />
                    </div>
                </div>
                <div>
                    <h1 className="text-lg font-bold text-foreground">Welcome to XEYGATE</h1>
                    <p className="mt-1 text-sm text-muted-foreground">Sign in to access your dashboard</p>
                </div>
                <div className="flex gap-2 justify-center">
                    <Link to="/login" className="inline-flex items-center justify-center rounded-md bg-foreground text-background px-4 py-2 text-xs font-medium hover:bg-foreground/90 transition-colors">
                        Sign In
                    </Link>
                    <Link to="/register" className="inline-flex items-center justify-center rounded-md border border-border px-4 py-2 text-xs font-medium hover:bg-secondary transition-colors">
                        Register
                    </Link>
                </div>
            </div>
        </main>
    );
}

function ClientSidebar({ user }: { user: UserInfo }) {
    async function handleLogout() {
        await api.post("/v1/users/logout");
        window.location.href = "/dashboard";
    }

    return (
        <aside className="hidden lg:flex w-56 flex-col border-r border-border/80 bg-sidebar/95 font-mono">
            <div className="flex h-12 items-center gap-2 border-b border-border/80 px-3">
                <div className="relative flex size-7 shrink-0 items-center justify-center rounded-lg border border-border/80 bg-secondary/50 p-1">
                    <Zap className="size-4" strokeWidth={2.5} />
                    <span className="absolute -right-0.5 -top-0.5 size-1.5 rounded-full border border-background bg-emerald-500" />
                </div>
                <div className="flex flex-col min-w-0">
                    <span className="text-[13px] font-bold tracking-tight text-foreground">XEYGATE</span>
                    <span className="text-[8px] font-medium text-muted-foreground/75 tracking-wider uppercase">Client</span>
                </div>
            </div>

            <nav className="flex-1 px-2.5 py-4 space-y-1">
                {[
                    { to: "/dashboard", label: "Dashboard", exact: true },
                    { to: "/dashboard/keys", label: "API Keys", exact: false },
                    { to: "/dashboard/usage", label: "Usage", exact: false },
                    ...(user.role === "creator"
                        ? [{ to: "/dashboard/my-apis", label: "My APIs", exact: false }]
                        : [])
                ].map(({ to, label, exact }) => (
                    <Link
                        key={to}
                        to={to}
                        activeOptions={{ exact }}
                        activeProps={{ className: "bg-secondary text-foreground font-semibold border border-border/80" }}
                        inactiveProps={{ className: "text-muted-foreground hover:bg-secondary/40 hover:text-foreground border border-transparent" }}
                        className="flex items-center gap-2 rounded-md px-2.5 py-2 text-xs transition-all cursor-pointer"
                    >
                        {label}
                    </Link>
                ))}
            </nav>

            <div className="border-t border-border/80 p-2.5 space-y-2">
                <div className="px-2 py-1.5 rounded-md bg-secondary/30 border border-border/50 text-[10px] text-muted-foreground">
                    <div className="font-semibold text-foreground/80 truncate">{user.email}</div>
                    <div className="mt-0.5">Credits: ${user.credits.toFixed(4)}</div>
                </div>
                <button
                    type="button"
                    onClick={handleLogout}
                    className="w-full flex items-center gap-2 rounded-md px-2.5 py-2 text-xs text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition-colors cursor-pointer border border-transparent"
                >
                    Sign Out
                </button>
            </div>
        </aside>
    );
}
