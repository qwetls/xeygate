import { useState, type FormEvent } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation } from "@tanstack/react-query";
import { toast } from "sonner";
import { api, ApiError } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { KeyRound, LogOut } from "lucide-react";

export const Route = createFileRoute("/_client/dashboard/settings")({
    staticData: { title: "Settings" },
    component: SettingsPage
});

function SettingsPage() {
    const [current, setCurrent] = useState("");
    const [next, setNext] = useState("");
    const [confirm, setConfirm] = useState("");

    const passwordMutation = useMutation({
        mutationFn: () => api.post<{ message: string }>("/v1/users/change-password", {
            current_password: current,
            new_password: next,
            confirmation: confirm
        }),
        onSuccess: () => {
            setCurrent("");
            setNext("");
            setConfirm("");
            toast.success("Password updated", {
                description: "All other devices were signed out; this session stays active."
            });
        },
        onError: (err: Error) => {
            toast.error(err instanceof ApiError ? err.message : "Failed to update password");
        }
    });

    function handlePasswordSubmit(e: FormEvent) {
        e.preventDefault();
        if (next !== confirm) {
            toast.error("Password confirmation does not match");
            return;
        }
        passwordMutation.mutate();
    }

    const signOutAllMutation = useMutation({
        mutationFn: () => api.post<{ revoked: number }>("/v1/users/logout-all"),
        onSuccess: () => {
            window.location.href = "/login";
        },
        onError: (err: Error) => {
            toast.error(err instanceof ApiError ? err.message : "Failed to sign out");
        }
    });

    return (
        <div className="mx-auto flex w-full max-w-3xl flex-col gap-6 font-mono">
            <header className="border-b border-border/80 pb-5">
                <h1 className="text-2xl font-bold tracking-tight text-foreground">Settings</h1>
                <p className="mt-1 text-xs text-muted-foreground">
                    Security controls for your account and sessions.
                </p>
            </header>

            <Card>
                <CardHeader>
                    <div className="flex items-center gap-2">
                        <KeyRound className="size-4 text-muted-foreground" strokeWidth={1.75} />
                        <CardTitle className="text-sm">Change password</CardTitle>
                    </div>
                    <CardDescription>
                        Rotating your password signs out every other device. Your current session stays
                        signed in.
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <form className="flex flex-col gap-4" onSubmit={handlePasswordSubmit}>
                        <label className="flex flex-col gap-1.5 text-xs font-medium">
                            Current password
                            <Input
                                type="password"
                                autoComplete="current-password"
                                value={current}
                                onChange={(e) => setCurrent(e.target.value)}
                                required
                            />
                        </label>
                        <label className="flex flex-col gap-1.5 text-xs font-medium">
                            New password
                            <Input
                                type="password"
                                autoComplete="new-password"
                                value={next}
                                onChange={(e) => setNext(e.target.value)}
                                required
                            />
                        </label>
                        <label className="flex flex-col gap-1.5 text-xs font-medium">
                            Confirm new password
                            <Input
                                type="password"
                                autoComplete="new-password"
                                value={confirm}
                                onChange={(e) => setConfirm(e.target.value)}
                                required
                            />
                        </label>
                        <div>
                            <Button type="submit" size="sm" className="h-8 text-xs" disabled={passwordMutation.isPending}>
                                {passwordMutation.isPending ? "Updating..." : "Update password"}
                            </Button>
                        </div>
                    </form>
                </CardContent>
            </Card>

            <Card className="border-destructive/30">
                <CardHeader>
                    <div className="flex items-center gap-2">
                        <LogOut className="size-4 text-destructive" strokeWidth={1.75} />
                        <CardTitle className="text-sm">Sign out everywhere</CardTitle>
                    </div>
                    <CardDescription>
                        Revokes all active sessions for this account — including this device — and returns
                        you to the sign-in page. Use it if you suspect someone else has access.
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <Button
                        variant="outline"
                        size="sm"
                        className="h-8 text-xs border-destructive/40 text-destructive hover:bg-destructive/10 hover:text-destructive"
                        disabled={signOutAllMutation.isPending}
                        onClick={() => signOutAllMutation.mutate()}
                    >
                        {signOutAllMutation.isPending ? "Signing out..." : "Sign out of all devices"}
                    </Button>
                </CardContent>
            </Card>
        </div>
    );
}
