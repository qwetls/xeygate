import { Check, Moon, Sun, Palette } from "lucide-react";
import type { AppSettings } from "@/hooks/useSettings";
import { SettingsSection, SettingsRow, SegmentedControl } from "./settings.ui";

interface AppearanceSettingsProps {
    theme: "light" | "dark";
    toggleTheme: (event?: React.MouseEvent) => void;
    settings: AppSettings;
    updateSetting: <K extends keyof AppSettings>(key: K, value: AppSettings[K]) => void;
}

export function AppearanceSettings({
    theme,
    toggleTheme,
    settings,
    updateSetting
}: AppearanceSettingsProps) {
    return (
        <SettingsSection
            id="appearance"
            icon={Palette}
            tag="UI"
            title="Appearance & Interface"
            description="Visual color theme preferences and dashboard table density settings."
        >
            <SettingsRow
                title="Color Theme"
                control={
                    <div className="flex gap-1.5">
                        <button
                            type="button"
                            onClick={(e) => theme !== "dark" && toggleTheme(e)}
                            className={`flex items-center gap-1.5 rounded-md border px-2.5 py-1.5 text-[11px] font-medium cursor-pointer transition-all ${
                                theme === "dark"
                                    ? "border-foreground bg-foreground text-background"
                                    : "border-border/70 text-muted-foreground hover:text-foreground"
                            }`}
                        >
                            <Moon className="size-3" />
                            Dark
                            {theme === "dark" && <Check className="size-2.5" />}
                        </button>
                        <button
                            type="button"
                            onClick={(e) => theme !== "light" && toggleTheme(e)}
                            className={`flex items-center gap-1.5 rounded-md border px-2.5 py-1.5 text-[11px] font-medium cursor-pointer transition-all ${
                                theme === "light"
                                    ? "border-foreground bg-foreground text-background"
                                    : "border-border/70 text-muted-foreground hover:text-foreground"
                            }`}
                        >
                            <Sun className="size-3" />
                            Light
                            {theme === "light" && <Check className="size-2.5" />}
                        </button>
                    </div>
                }
            />
            <SettingsRow
                title="Table Density"
                control={
                    <SegmentedControl
                        options={[
                            { value: "compact", label: "Compact" },
                            { value: "cozy", label: "Cozy" }
                        ]}
                        value={settings.uiDensity}
                        onChange={(density) => updateSetting("uiDensity", density)}
                    />
                }
            />
        </SettingsSection>
    );
}
