import { createFileRoute, Link, Outlet } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { Zap } from "lucide-react";
import { ClientSidebar, Topbar } from "@/components/layout";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { TooltipProvider } from "@/components/ui/tooltip";

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

    if (statusQuery.isError || !statusQuery.data) {
        return <UnauthenticatedRedirect />;
    }

    const user = statusQuery.data;

    return (
        <TooltipProvider>
            <SidebarProvider>
                <ClientSidebar role={user.role} email={user.email} credits={user.credits} />
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
