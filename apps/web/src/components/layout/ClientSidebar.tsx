import { Link } from "@tanstack/react-router";
import {
    BarChart2,
    CreditCard,
    KeyRound,
    LayoutDashboard,
    LogOut,
    Zap
} from "lucide-react";
import {
    Sidebar,
    SidebarContent,
    SidebarFooter,
    SidebarGroup,
    SidebarGroupContent,
    SidebarHeader,
    SidebarMenu,
    SidebarMenuButton,
    SidebarMenuItem,
    SidebarRail
} from "@/components/ui/sidebar";
import { api } from "@/lib/api";

const navItems = [
    { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
    { to: "/dashboard/keys", label: "API Keys", icon: KeyRound },
    { to: "/dashboard/usage", label: "Usage", icon: BarChart2 }
] as const;

export function ClientSidebar() {
    async function handleLogout() {
        await api.post("/v1/users/logout");
        window.location.href = "/dashboard";
    }

    return (
        <Sidebar collapsible="icon" className="border-r border-border/80 bg-sidebar/95 font-mono">
            <SidebarHeader className="h-12 min-h-12 shrink-0 justify-center border-b border-border/80 px-3">
                <SidebarMenu className="items-center">
                    <SidebarMenuItem className="w-full">
                        <SidebarMenuButton
                            size="lg"
                            render={<Link to="/dashboard" aria-label="XEYGATE client portal" />}
                            className="group h-10 w-full rounded-lg px-2 text-foreground transition-all duration-150 hover:bg-secondary/60 group-data-[collapsible=icon]:mx-auto group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:px-0! cursor-pointer"
                        >
                            <div className="relative flex size-7.5 shrink-0 items-center justify-center rounded-lg border border-border/80 bg-linear-to-b from-secondary/90 via-secondary/50 to-background p-1 text-foreground shadow-2xs">
                                <Zap className="size-4" strokeWidth={2.5} />
                                <span className="absolute -right-0.5 -top-0.5 size-1.5 rounded-full border border-background bg-emerald-500 shadow-[0_0_6px_rgba(16,185,129,0.5)]" />
                            </div>
                            <div className="flex flex-col min-w-0 group-data-[collapsible=icon]:hidden text-left pl-1">
                                <span className="text-[13px] font-bold tracking-tight text-foreground leading-tight">
                                    XEYGATE
                                </span>
                                <span className="text-[9px] font-mono font-medium text-muted-foreground/75 tracking-[0.14em] uppercase mt-0.5">
                                    Client Portal
                                </span>
                            </div>
                        </SidebarMenuButton>
                    </SidebarMenuItem>
                </SidebarMenu>
            </SidebarHeader>

            <SidebarContent className="px-2.5 py-4">
                <nav aria-label="Client navigation" className="space-y-2">
                    <SidebarGroup className="p-0">
                        <SidebarGroupContent>
                            <SidebarMenu className="gap-1">
                                {navItems.map(({ to, label, icon: Icon }) => (
                                    <SidebarMenuItem key={to}>
                                        <SidebarMenuButton
                                            render={
                                                <Link
                                                    to={to}
                                                    activeOptions={{ exact: to === "/dashboard" }}
                                                    activeProps={{
                                                        className: "bg-secondary text-foreground font-semibold border border-border/80 shadow-2xs",
                                                        "aria-current": "page"
                                                    }}
                                                    inactiveProps={{
                                                        className: "text-muted-foreground hover:bg-secondary/40 hover:text-foreground border border-transparent"
                                                    }}
                                                />
                                            }
                                            tooltip={label}
                                            className="h-8.5 rounded-md px-2.5 transition-all text-xs cursor-pointer group-data-[collapsible=icon]:justify-center"
                                        >
                                            <Icon strokeWidth={1.75} className="size-3.5 shrink-0" />
                                            <span className="text-xs truncate">{label}</span>
                                        </SidebarMenuButton>
                                    </SidebarMenuItem>
                                ))}
                            </SidebarMenu>
                        </SidebarGroupContent>
                    </SidebarGroup>
                </nav>
            </SidebarContent>

            <SidebarFooter className="border-t border-border/80 p-2.5">
                <SidebarMenu>
                    <SidebarMenuItem>
                        <SidebarMenuButton
                            onClick={handleLogout}
                            tooltip="Sign out"
                            className="h-8.5 rounded-md px-2.5 transition-all text-xs cursor-pointer group-data-[collapsible=icon]:justify-center text-muted-foreground hover:bg-destructive/10 hover:text-destructive border border-transparent"
                        >
                            <LogOut strokeWidth={1.75} className="size-3.5 shrink-0" />
                            <span className="text-xs">Sign Out</span>
                        </SidebarMenuButton>
                    </SidebarMenuItem>
                </SidebarMenu>
            </SidebarFooter>

            <SidebarRail />
        </Sidebar>
    );
}
