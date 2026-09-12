import { type ReactNode } from "react";
import { ClientSidebar } from "./ClientSidebar";
import { Topbar } from "./Topbar";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { TooltipProvider } from "@/components/ui/tooltip";

export interface ShellUserInfo {
    id: string;
    email: string;
    name: string;
    credits: number;
    role: "buyer" | "creator";
    status: "active" | "pending" | "banned";
    creatorStatus: "none" | "pending" | "approved" | "rejected";
    isAdmin: boolean;
}

/**
 * The authenticated client-portal shell (sidebar + topbar + scrolling main).
 * Extracted from the `_client` route layout so public surfaces that signed-in
 * users navigate to from inside the portal (e.g. `/catalog`) can render in the
 * same chrome instead of swapping to a standalone header — which made the
 * marketplace feel like it left the app when the navbar vanished.
 */
export function ClientShell({ user, children }: { user: ShellUserInfo; children: ReactNode }) {
    return (
        <TooltipProvider>
            <SidebarProvider>
                <ClientSidebar
                    role={user.role}
                    email={user.email}
                    credits={user.credits}
                    isAdmin={user.isAdmin}
                />
                <SidebarInset className="h-svh overflow-hidden">
                    <Topbar />
                    <main className="flex min-h-0 flex-1 flex-col overflow-y-auto p-4 sm:p-6 bg-grid-pattern">
                        {children}
                    </main>
                </SidebarInset>
            </SidebarProvider>
        </TooltipProvider>
    );
}
