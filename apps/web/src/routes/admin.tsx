import { createFileRoute, Outlet, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { api, ApiError } from "@/lib/api";
import { AppSidebar, Topbar } from "@/components/layout";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { TooltipProvider } from "@/components/ui/tooltip";
import { useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Zap } from "lucide-react";

export const Route = createFileRoute("/admin")({
    component: AdminLayout
});

interface AdminStatus {
    setupRequired: boolean;
}

interface UserInfo {
    id: string;
    email: string;
    name: string;
    isAdmin: boolean;
    role: "buyer" | "creator";
}

function AdminLayout() {
    const statusQuery = useQuery({
        queryKey: ["admin-setup-required"],
        queryFn: () => api.get<AdminStatus>("/v1/admin/status"),
        retry: false,
        staleTime: 60_000
    });

    const userQuery = useQuery({
        queryKey: ["user-auth-status"],
        queryFn: () => api.get<UserInfo>("/v1/users/me"),
        retry: false,
        staleTime: 0
    });

    // Both still loading.
    if (statusQuery.isPending || userQuery.isPending) {
        return (
            <main className="flex min-h-svh items-center justify-center bg-background px-4">
                <p className="font-mono text-xs text-muted-foreground">Loading XEYGATE...</p>
            </main>
        );
    }

    // Admin-api unreachable.
    if (statusQuery.isError || !statusQuery.data) {
        return (
            <main className="flex min-h-svh items-center justify-center bg-background px-4 py-8">
                <Card className="w-full max-w-md">
                    <CardHeader>
                        <CardTitle>Gateway unavailable</CardTitle>
                        <CardDescription>Could not reach the XEYGATE API.</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <Button type="button" variant="outline" onClick={() => { void statusQuery.refetch(); void userQuery.refetch(); }} className="w-full">
                            Try again
                        </Button>
                    </CardContent>
                </Card>
            </main>
        );
    }

    const setupRequired = statusQuery.data.setupRequired;

    // Not authenticated.
    if (userQuery.isError || !userQuery.data) {
        // No admin exists yet — show first-come-wins bootstrap claim form.
        if (setupRequired) {
            return (
                <AdminBootstrapForm
                    onClaimed={() => {
                        void statusQuery.refetch();
                        void userQuery.refetch();
                    }}
                />
            );
        }
        // Admin exists; user must sign in through the normal login page.
        return <NotAuthenticatedCard />;
    }

    const user = userQuery.data;

    if (!user.isAdmin) {
        return <ForbiddenCard />;
    }

    return (
        <TooltipProvider>
            <SidebarProvider>
                <AppSidebar email={user.email} />
                <SidebarInset className="h-svh overflow-hidden">
                    <Topbar />
                    <main className="flex min-h-0 flex-1 flex-col overflow-y-auto p-4 sm:p-6 bg-grid-pattern">
                        <Outlet />
                    </main>
                </SidebarInset>
            </SidebarProvider>
        </TooltipProvider>
    );
}

function NotAuthenticatedCard() {
    return (
        <main className="flex min-h-svh items-center justify-center bg-background px-4">
            <div className="text-center space-y-4">
                <div className="flex justify-center">
                    <div className="flex size-12 items-center justify-center rounded-xl border border-border/80 bg-secondary/50">
                        <Zap className="size-6" strokeWidth={2} />
                    </div>
                </div>
                <div>
                    <h1 className="text-lg font-bold text-foreground">Admin sign-in required</h1>
                    <p className="mt-1 text-sm text-muted-foreground">Sign in to access the XEYGATE control plane.</p>
                </div>
                <Link
                    to="/login"
                    className="inline-flex items-center justify-center rounded-md bg-foreground text-background px-4 py-2 text-xs font-medium hover:bg-foreground/90 transition-colors"
                >
                    Sign In
                </Link>
            </div>
        </main>
    );
}

function ForbiddenCard() {
    return (
        <main className="flex min-h-svh items-center justify-center bg-background px-4">
            <Card className="w-full max-w-md text-center">
                <CardHeader>
                    <CardTitle>Access denied</CardTitle>
                    <CardDescription>This account does not have admin privileges.</CardDescription>
                </CardHeader>
                <CardContent>
                    <Link
                        to="/dashboard"
                        className="inline-flex items-center justify-center rounded-md bg-foreground text-background px-4 py-2 text-xs font-medium hover:bg-foreground/90 transition-colors"
                    >
                        Go to Client Portal
                    </Link>
                </CardContent>
            </Card>
        </main>
    );
}

function AdminBootstrapForm({ onClaimed }: { onClaimed: () => void }) {
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [name, setName] = useState("");
    const [error, setError] = useState<string | null>(null);
    const [submitting, setSubmitting] = useState(false);

    async function handleSubmit(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();
        setError(null);
        setSubmitting(true);
        try {
            await api.post("/v1/admin/bootstrap", { email, password, name: name || undefined });
            onClaimed();
        } catch (cause) {
            setError(cause instanceof ApiError ? cause.message : "Unable to create admin account");
        } finally {
            setSubmitting(false);
        }
    }

    return (
        <main className="flex min-h-svh items-center justify-center bg-background px-4 py-8">
            <Card className="w-full max-w-md">
                <CardHeader>
                    <p className="font-mono text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">XEYGATE control plane</p>
                    <CardTitle>Create your admin account</CardTitle>
                    <CardDescription>
                        This is the first run. Pick an email and password to secure the gateway.
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <form className="flex flex-col gap-4" onSubmit={handleSubmit}>
                        <label className="flex flex-col gap-1.5 text-xs font-medium">
                            Email
                            <Input type="email" autoComplete="email" autoFocus value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@company.com" required />
                        </label>
                        <label className="flex flex-col gap-1.5 text-xs font-medium">
                            Password
                            <Input type="password" autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Choose a password (min 8 characters)" required minLength={8} />
                        </label>
                        <label className="flex flex-col gap-1.5 text-xs font-medium">
                            Display name
                            <Input autoComplete="name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Administrator" />
                        </label>
                        <p className="rounded-lg border border-amber-500/30 bg-amber-500/5 px-3 py-2 text-[11px] font-normal text-amber-600 dark:text-amber-400">
                            First-come-wins: anyone who opens this page before you finish can claim the instance. Deploy and set your password immediately.
                        </p>
                        {error && (
                            <p className="rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-xs text-destructive">{error}</p>
                        )}
                        <Button type="submit" disabled={submitting} className="mt-1 w-full">
                            {submitting ? "Creating..." : "Create admin account"}
                        </Button>
                    </form>
                </CardContent>
            </Card>
        </main>
    );
}
