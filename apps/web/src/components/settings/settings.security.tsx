import { useState, type FormEvent } from "react";
import { ShieldCheck, KeyRound, Eye, EyeOff } from "lucide-react";
import { toast } from "sonner";
import { api, ApiError } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { SettingsSection, SettingsRow, SegmentedControl } from "./settings.ui";

interface SecuritySettingsProps {
    requireApiKey: boolean;
    onToggleRequireApiKey: (required: boolean) => void;
    isUpdating: boolean;
    apiBase?: string;
}

export function SecuritySettings({
    requireApiKey,
    onToggleRequireApiKey,
    isUpdating
}: SecuritySettingsProps) {
    const [currentPassword, setCurrentPassword] = useState("");
    const [newPassword, setNewPassword] = useState("");
    const [confirmation, setConfirmation] = useState("");
    const [isChangingPassword, setIsChangingPassword] = useState(false);
    const [passwordError, setPasswordError] = useState<string | null>(null);
    const [showPasswords, setShowPasswords] = useState(false);

    const handleChangePassword = async (e: FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        setPasswordError(null);
        if (!currentPassword) {
            setPasswordError("Please enter your current admin password.");
            return;
        }
        if (newPassword !== confirmation) {
            setPasswordError("New password and confirmation do not match.");
            return;
        }
        setIsChangingPassword(true);
        try {
            await api.post("/v1/admin/change-password", {
                current_password: currentPassword,
                new_password: newPassword,
                confirmation
            });
            toast.success("Admin password changed successfully");
            setCurrentPassword("");
            setNewPassword("");
            setConfirmation("");
        } catch (err) {
            const msg = err instanceof ApiError ? err.message : "Failed to change admin password";
            setPasswordError(msg);
            toast.error(msg);
        } finally {
            setIsChangingPassword(false);
        }
    };

    return (
        <SettingsSection
            id="security"
            icon={ShieldCheck}
            tag="Core"
            title="Security & Access Control"
            description="Virtual API key bearer verification and admin dashboard authentication."
        >
            <SettingsRow
                title="Enforce Bearer Authentication"
                description={
                    requireApiKey
                        ? "Unauthenticated requests are rejected with HTTP 401."
                        : "Anyone can query without an API key."
                }
                control={
                    <SegmentedControl
                        options={[
                            { value: false, label: "OFF" },
                            { value: true, label: "ON" }
                        ]}
                        value={requireApiKey}
                        onChange={onToggleRequireApiKey}
                        disabled={isUpdating}
                    />
                }
            />

            <div className="py-3.5">
                <div className="mb-2 text-xs font-semibold text-foreground">Admin Password</div>
                <form onSubmit={handleChangePassword} className="space-y-2 max-w-xl">
                    {passwordError && (
                        <div className="text-[11px] text-destructive">{passwordError}</div>
                    )}
                    <div className="flex flex-wrap items-center gap-2">
                        <Input
                            type={showPasswords ? "text" : "password"}
                            placeholder="Current"
                            value={currentPassword}
                            onChange={(e) => setCurrentPassword(e.target.value)}
                            required
                            className="w-36 text-[11px]"
                        />
                        <Input
                            type={showPasswords ? "text" : "password"}
                            placeholder="New"
                            value={newPassword}
                            onChange={(e) => setNewPassword(e.target.value)}
                            required
                            className="w-36 text-[11px]"
                        />
                        <Input
                            type={showPasswords ? "text" : "password"}
                            placeholder="Confirm"
                            value={confirmation}
                            onChange={(e) => setConfirmation(e.target.value)}
                            required
                            className="w-36 text-[11px]"
                        />
                        <Button
                            type="submit"
                            size="sm"
                            disabled={isChangingPassword}
                            className="font-semibold"
                        >
                            <KeyRound className="size-3.5" />
                            {isChangingPassword ? "Updating..." : "Update"}
                        </Button>
                        <button
                            type="button"
                            onClick={() => setShowPasswords(!showPasswords)}
                            className="flex items-center gap-1 text-[10px] text-muted-foreground hover:text-foreground cursor-pointer"
                        >
                            {showPasswords ? (
                                <EyeOff className="size-3" />
                            ) : (
                                <Eye className="size-3" />
                            )}
                            {showPasswords ? "Hide" : "Show"}
                        </button>
                    </div>
                </form>
            </div>
        </SettingsSection>
    );
}
