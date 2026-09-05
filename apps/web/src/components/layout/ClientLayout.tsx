import { Outlet } from "@tanstack/react-router";
import { UserAuthGate } from "@/components/auth/UserAuthGate";
import { ClientSidebar } from "@/components/layout/ClientSidebar";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { TooltipProvider } from "@/components/ui/tooltip";

export function ClientLayout() {
    return (
        <TooltipProvider>
            <UserAuthGate>
                <SidebarProvider>
                    <ClientSidebar />
                    <SidebarInset className="h-svh overflow-hidden">
                        <main className="flex min-h-0 flex-1 flex-col overflow-y-auto p-4 sm:p-6 bg-grid-pattern">
                            <Outlet />
                        </main>
                    </SidebarInset>
                </SidebarProvider>
            </UserAuthGate>
        </TooltipProvider>
    );
}
