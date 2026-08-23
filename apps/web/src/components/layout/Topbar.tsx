import { Link, useMatches } from "@tanstack/react-router";
import { Moon, Sun, Terminal } from "lucide-react";
import { useTheme } from "@/context/Theme";
import { Button } from "@/components/ui/button";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { KNOWN_PROVIDER_MAP, providerBaseId } from "@srouter/constants";
import { useProvider } from "@/hooks/useProvider";

type BreadcrumbInfo = {
    section: string;
    sectionHref?: string;
    detail?: string;
};

function useBreadcrumb(): BreadcrumbInfo {
    const matches = useMatches();

    const providerMatch = matches.find((m) => m.routeId === "/providers/$providerId");
    const rawId = (providerMatch?.params as { providerId?: string })?.providerId;
    const { data: providerData } = useProvider(rawId ?? "");

    if (rawId) {
        const fallbackName =
            KNOWN_PROVIDER_MAP[rawId]?.name ??
            KNOWN_PROVIDER_MAP[providerBaseId(rawId)]?.name ??
            rawId;
        const displayName = providerData?.name || fallbackName;

        return {
            section: "Providers",
            sectionHref: "/providers",
            detail: displayName
        };
    }

    const match = [...matches].reverse().find((item) => item.staticData?.title);
    return {
        section: (match?.staticData?.title as string | undefined) ?? "Dashboard"
    };
}

export function Topbar() {
    const crumb = useBreadcrumb();
    const { theme, toggleTheme } = useTheme();

    return (
        <header className="sticky top-0 z-30 flex h-12 min-h-12 shrink-0 items-center justify-between gap-4 border-b border-border/80 bg-background/80 px-3 sm:px-5 backdrop-blur-md font-mono">
            {/* Left: Sidebar toggle + Tactical Breadcrumb */}
            <div className="flex min-w-0 items-center gap-2.5 sm:gap-3.5">
                <SidebarTrigger className="size-7 rounded-md text-muted-foreground transition-colors hover:bg-secondary/60 hover:text-foreground focus-visible:ring-1 focus-visible:ring-ring cursor-pointer" />

                <div className="flex items-center gap-1.5 text-xs">
                    <span className="hidden sm:inline-flex items-center gap-1 text-[10.5px] font-semibold text-muted-foreground/70 uppercase tracking-wider">
                        <Terminal className="size-3 text-muted-foreground/60" />
                        <span>SROUTER</span>
                        <span className="text-muted-foreground/40">/</span>
                    </span>

                    {crumb.detail && crumb.sectionHref ? (
                        <div className="flex items-center gap-1.5 font-bold text-xs tracking-tight">
                            <Link
                                to={crumb.sectionHref}
                                className="text-muted-foreground transition-colors hover:text-foreground"
                            >
                                {crumb.section}
                            </Link>
                            <span className="text-muted-foreground/40 font-normal">/</span>
                            <span className="text-foreground">{crumb.detail}</span>
                        </div>
                    ) : (
                        <span className="font-bold text-foreground text-xs tracking-tight">
                            {crumb.section}
                        </span>
                    )}
                </div>
            </div>

            {/* Right: Actions */}
            <div className="flex shrink-0 items-center gap-2 sm:gap-3">
                <div className="flex items-center gap-1">
                    <Button
                        type="button"
                        variant="ghost"
                        size="icon-sm"
                        onClick={(event) => toggleTheme(event)}
                        aria-label={
                            theme === "dark" ? "Switch to light mode" : "Switch to dark mode"
                        }
                        className="size-8 rounded-md text-muted-foreground transition-colors hover:bg-secondary/70 hover:text-foreground cursor-pointer"
                        title={theme === "dark" ? "Light theme" : "Dark theme"}
                    >
                        {theme === "dark" ? (
                            <Sun className="size-3.5" strokeWidth={1.75} />
                        ) : (
                            <Moon className="size-3.5" strokeWidth={1.75} />
                        )}
                    </Button>
                </div>
            </div>
        </header>
    );
}
