import { createFileRoute, Link, Outlet } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { Zap } from "lucide-react";
import { ClientShell, type ShellUserInfo } from "@/components/layout";

export const Route = createFileRoute("/_client")({
    component: ClientLayout
});

function ClientLayout() {
    const statusQuery = useQuery({
        queryKey: ["user-auth-status"],
        queryFn: () => api.get<ShellUserInfo>("/v1/users/me"),
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

    if (statusQuery.isError || !statusQuery.data) {
        return <UnauthenticatedRedirect />;
    }

    const user = statusQuery.data;

    if (user.status === "banned") {
        return <BannedRedirect />;
    }

    return (
        <ClientShell user={user}>
            <Outlet />
        </ClientShell>
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

function BannedRedirect() {
    return (
        <main className="flex min-h-svh items-center justify-center bg-background px-4">
            <div className="text-center space-y-4">
                <div className="flex justify-center">
                    <div className="flex size-12 items-center justify-center rounded-xl border border-destructive/30 bg-destructive/10">
                        <Zap className="size-6 text-destructive" strokeWidth={2} />
                    </div>
                </div>
                <div>
                    <h1 className="text-lg font-bold text-foreground">Account suspended</h1>
                    <p className="mt-1 text-sm text-muted-foreground">
                        This account has been banned. Contact support if you believe this is a mistake.
                    </p>
                </div>
            </div>
        </main>
    );
}
