import { createFileRoute, Link, Outlet } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { ClientShell, type ShellUserInfo } from "@/components/layout";

export const Route = createFileRoute("/catalog")({
    component: CatalogLayout,
    staticData: { title: "Marketplace" }
});

function CatalogLayout() {
    // Same query key as the client layout: navigating from the dashboard hits
    // the cache, so the shell swap is instant.
    const { data: user, isPending } = useQuery({
        queryKey: ["user-auth-status"],
        queryFn: () => api.get<ShellUserInfo>("/v1/users/me"),
        retry: false,
        staleTime: 60_000
    });

    // Signed-in users keep the portal chrome (sidebar + topbar) around the
    // marketplace — without this the navbar vanishes and /catalog reads as a
    // page outside the app. Banned accounts render the public catalog instead
    // (the portal would bounce them anyway). While the session check is in
    // flight a neutral loader prevents a public-chrome flash before embed.
    if (isPending) {
        return (
            <main className="flex min-h-svh items-center justify-center bg-background">
                <p className="font-mono text-xs text-muted-foreground">Loading...</p>
            </main>
        );
    }
    if (user && user.status !== "banned") {
        return (
            <ClientShell user={user}>
                <div className="mx-auto w-full max-w-5xl flex-1 py-2">
                    <Outlet />
                </div>
            </ClientShell>
        );
    }

    return (
        <div className="min-h-screen bg-background text-foreground font-mono">
            <header className="sticky top-0 z-40 border-b border-border/80 bg-background/90 backdrop-blur-md">
                <div className="mx-auto flex h-14 max-w-5xl items-center justify-between px-4">
                    <Link to="/" className="flex items-center gap-2">
                        <span className="text-sm font-bold tracking-tight">XEYGATE</span>
                        <span className="rounded-xs border border-border/70 bg-secondary/70 px-1 py-0.5 text-[8px] font-semibold text-muted-foreground/80 uppercase leading-none">Marketplace</span>
                    </Link>
                    <div className="flex items-center gap-2">
                        {user ? (
                            <Button size="sm" render={<Link to="/dashboard" />} className="text-xs cursor-pointer">Dashboard</Button>
                        ) : (
                            <>
                                <Button variant="ghost" size="sm" render={<Link to="/login" />} className="text-xs cursor-pointer">Sign in</Button>
                                <Button size="sm" render={<Link to="/register" />} className="text-xs cursor-pointer">Get started</Button>
                            </>
                        )}
                    </div>
                </div>
            </header>

            <main className="mx-auto max-w-5xl px-4 py-10">
                <Outlet />
            </main>
        </div>
    );
}
