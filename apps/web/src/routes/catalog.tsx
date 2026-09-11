import { createFileRoute, Link, Outlet } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/catalog")({ component: CatalogLayout });

function CatalogLayout() {
    // Same query key as the client layout: navigating from the dashboard hits
    // the cache, so signed-in users see the Dashboard CTA without a flash.
    const { data: user } = useQuery({
        queryKey: ["user-auth-status"],
        queryFn: () => api.get<{ id: string }>("/v1/users/me"),
        retry: false,
        staleTime: 60_000
    });

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
