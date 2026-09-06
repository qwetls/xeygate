import { useState, useEffect } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
    Activity,
    HardDrive,
    Palette,
    RotateCcw,
    ScrollText,
    ShieldCheck,
    Sliders,
    Sparkles,
    UploadCloud
} from "lucide-react";
import { api, getGatewayBaseUrl } from "@/lib/api";
import { useTheme } from "@/context/Theme";
import { useSettings } from "@/hooks/useSettings";
import { useVersion } from "@/hooks/useVersion";
import {
    AppearanceSettings,
    DataSettings,
    GatewaySettings,
    LoggingSettings,
    SecuritySettings,
    SystemSettings
} from "@/components/settings";
import { SettingsSkeleton } from "@/components/skeletons";

export const Route = createFileRoute("/admin/settings")({
    staticData: { title: "Settings" },
    component: SettingsPage
});

interface ServerSettingsResponse {
    require_api_key?: boolean;
    requireApiKey?: boolean;
    settings?: Record<string, string>;
}

const SECTIONS = [
    { id: "security", label: "Security", icon: ShieldCheck },
    { id: "gateway", label: "Gateway", icon: Sliders },
    { id: "appearance", label: "Appearance", icon: Palette },
    { id: "logging", label: "Logging", icon: ScrollText },
    { id: "data", label: "Data", icon: HardDrive },
    { id: "system", label: "System", icon: Activity }
] as const;

function SettingsPage() {
    const queryClient = useQueryClient();
    const { theme, toggleTheme } = useTheme();
    const {
        settings,
        updateSetting,
        resetToDefaults,
        exportSettings,
        importSettings,
        clearStorage,
        getStorageStats
    } = useSettings();
    const { hasUpdate, latestVersion, currentVersion } = useVersion();
    const [activeSection, setActiveSection] = useState<string>("security");

    const apiBase = getGatewayBaseUrl();

    const { data: serverSettings, isPending: isLoadingServerSettings } =
        useQuery<ServerSettingsResponse>({
            queryKey: ["server_settings"],
            queryFn: () => api.get<ServerSettingsResponse>("/v1/settings")
        });

    const [requireApiKey, setRequireApiKey] = useState<boolean>(false);

    useEffect(() => {
        if (serverSettings) {
            const val = serverSettings.require_api_key ?? serverSettings.requireApiKey;
            if (typeof val === "boolean") {
                setRequireApiKey(val);
            }
        }
    }, [serverSettings]);

    const updateServerMutation = useMutation({
        mutationFn: (newRequireApiKey: boolean) =>
            api.post("/v1/settings", { require_api_key: newRequireApiKey }),
        onSuccess: (_data, newRequireApiKey) => {
            queryClient.invalidateQueries({ queryKey: ["server_settings"] });
            toast.success(
                newRequireApiKey ? "API Key Authentication Required" : "Open Access Mode Enabled"
            );
        },
        onError: (err) => {
            toast.error("Failed to update security setting", {
                description: err instanceof Error ? err.message : "Unknown error"
            });
        }
    });

    const handleToggleRequireApiKey = (value: boolean) => {
        setRequireApiKey(value);
        updateServerMutation.mutate(value);
    };

    const scrollToSection = (id: string) => {
        setActiveSection(id);
        const el = document.getElementById(id);
        if (el) {
            el.scrollIntoView({ behavior: "smooth", block: "start" });
        }
    };

    if (isLoadingServerSettings) {
        return <SettingsSkeleton />;
    }

    return (
        <div className="mx-auto w-full max-w-5xl font-mono pb-16 space-y-6">
            {/* Header: Tactical Machined Dashboard Bar */}
            <header className="rounded-2xl border border-border/80 bg-card p-5 sm:p-6 shadow-2xs">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                    <div className="space-y-1.5">
                        <div className="flex items-center gap-2.5 flex-wrap">
                            <div className="flex size-7.5 items-center justify-center rounded-xl border border-border/80 bg-secondary/70 text-foreground shadow-2xs">
                                <Sliders className="size-4" />
                            </div>
                            <h1 className="text-base font-bold tracking-tight text-foreground">
                                Gateway Configuration
                            </h1>
                            <span className="rounded-md border border-border/70 bg-secondary/50 px-2 py-0.5 text-[9px] font-semibold text-muted-foreground uppercase tracking-widest">
                                {currentVersion}
                            </span>
                            {hasUpdate && latestVersion && (
                                <span className="flex items-center gap-1 text-[9px] font-bold tracking-wider uppercase text-amber-500 bg-amber-500/10 border border-amber-500/30 rounded-md px-2 py-0.5">
                                    <Sparkles className="size-2.5" />
                                    Update: {latestVersion}
                                </span>
                            )}
                        </div>
                        <p className="text-xs text-muted-foreground max-w-2xl leading-relaxed">
                            Fine-tune routing policies, security gates, logging pipelines, and client
                            environment preferences across your XEYGATE mesh instance.
                        </p>
                    </div>

                    {/* Action Controls */}
                    <div className="flex items-center gap-2 self-start sm:self-auto shrink-0">
                        <button
                            type="button"
                            onClick={exportSettings}
                            className="inline-flex items-center gap-1.5 rounded-lg border border-border/70 bg-secondary/40 hover:bg-secondary text-muted-foreground hover:text-foreground px-3 py-1.5 text-xs font-semibold cursor-pointer transition-all shadow-2xs"
                        >
                            <UploadCloud className="size-3.5" />
                            <span>Export</span>
                        </button>
                        <button
                            type="button"
                            onClick={resetToDefaults}
                            className="inline-flex items-center gap-1.5 rounded-lg border border-border/70 bg-secondary/40 hover:bg-rose-500/10 hover:border-rose-500/40 text-muted-foreground hover:text-rose-500 px-3 py-1.5 text-xs font-semibold cursor-pointer transition-all shadow-2xs"
                        >
                            <RotateCcw className="size-3.5" />
                            <span>Reset</span>
                        </button>
                    </div>
                </div>

                {/* Section Quick Jump Filter Bar */}
                <nav
                    aria-label="Settings section tabs"
                    className="mt-5 pt-4 border-t border-border/60 flex items-center gap-1.5 overflow-x-auto no-scrollbar"
                >
                    {SECTIONS.map(({ id, label, icon: Icon }) => {
                        const isActive = activeSection === id;
                        return (
                            <button
                                key={id}
                                type="button"
                                onClick={() => scrollToSection(id)}
                                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all shrink-0 cursor-pointer ${
                                    isActive
                                        ? "bg-foreground text-background shadow-2xs"
                                        : "text-muted-foreground hover:bg-secondary/60 hover:text-foreground"
                                }`}
                            >
                                <Icon className="size-3.5" />
                                <span>{label}</span>
                            </button>
                        );
                    })}
                </nav>
            </header>

            {/* Main Settings Sections */}
            <main className="space-y-6">
                <SecuritySettings
                    requireApiKey={requireApiKey}
                    onToggleRequireApiKey={handleToggleRequireApiKey}
                    isUpdating={updateServerMutation.isPending}
                    apiBase={apiBase}
                />

                <GatewaySettings settings={settings} updateSetting={updateSetting} />

                <AppearanceSettings
                    theme={theme}
                    toggleTheme={toggleTheme}
                    settings={settings}
                    updateSetting={updateSetting}
                />

                <LoggingSettings settings={settings} updateSetting={updateSetting} />

                <DataSettings
                    exportSettings={exportSettings}
                    importSettings={importSettings}
                    clearStorage={clearStorage}
                    resetToDefaults={resetToDefaults}
                    getStorageStats={getStorageStats}
                />

                <SystemSettings apiBase={apiBase} />
            </main>
        </div>
    );
}
