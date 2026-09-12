import { useEffect, useState, type FormEvent } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { api, ApiError } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { GitHubSignIn } from "@/components/auth/GitHubSignIn";
import { Input } from "@/components/ui/input";
import { Zap } from "lucide-react";

export const Route = createFileRoute("/login")({
    component: LoginPage,
    validateSearch: (search: Record<string, unknown>): { error?: string } => ({
        error: typeof search.error === "string" ? search.error : undefined
    })
});

// Codes the GitHub OAuth callback redirects back here with (?error=...).
const OAUTH_ERROR_MESSAGES: Record<string, string> = {
    github_not_configured: "GitHub sign-in is not configured on this instance.",
    consent_required: "Tick the Terms & Privacy checkbox before continuing with GitHub.",
    github_state_expired: "GitHub sign-in expired. Please try again.",
    github_state_mismatch: "GitHub sign-in check failed. Please try again.",
    github_cancelled: "GitHub sign-in was cancelled.",
    github_no_code: "GitHub did not complete the sign-in. Please try again.",
    github_exchange_failed: "GitHub sign-in failed. Try again or sign in with email.",
    github_profile_failed: "Could not read your GitHub profile. Please try again.",
    github_email_failed: "Your GitHub account has no usable email address. Sign in with email instead.",
    github_link_failed: "That GitHub account is already linked to a different user.",
    github_account_failed: "Could not create your account via GitHub. Please try again.",
    github_pending_approval: "Account created via GitHub — an admin must approve it before you can sign in.",
    github_pending: "Your account is pending admin approval. Please try again later.",
    github_banned: "This account has been banned. Contact support for assistance.",
    github_terms_required: "Tick the Terms & Privacy checkbox and continue with GitHub again to re-accept."
};

function LoginPage() {
    const queryClient = useQueryClient();
    const navigate = useNavigate();
    const { error: oauthErrorCode } = Route.useSearch();
    const [oauthError] = useState<string | null>(() =>
        oauthErrorCode
            ? OAUTH_ERROR_MESSAGES[oauthErrorCode] ??
              "GitHub sign-in failed. Please try again or sign in with email."
            : null
    );
    useEffect(() => {
        // Show the OAuth error once, then keep the URL clean.
        if (oauthErrorCode) navigate({ to: "/login", search: {}, replace: true });
    }, [oauthErrorCode, navigate]);
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [agreed, setAgreed] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const loginMutation = useMutation({
        mutationFn: () => api.post<{ id: string; isAdmin?: boolean; dailyReward?: { day: number; amount: number } | null }>("/v1/users/login", { email, password, accepted_terms: agreed }),
        onSuccess: (data) => {
            queryClient.invalidateQueries({ queryKey: ["user-auth-status"] });
            if (data?.dailyReward) {
                const { day, amount } = data.dailyReward;
                toast.success(`Daily login reward: +$${amount}`, {
                    description:
                        day === 7
                            ? "Seven-day streak complete — bonus credited."
                            : `Day ${day} of 7 — reach day 7 for the $10 bonus.`
                });
            }
            // Admin accounts land straight in the control plane.
            navigate({ to: data?.isAdmin ? "/admin" : "/dashboard" });
        },
        onError: (err: Error) => {
            setError(err instanceof ApiError ? err.message : "Login failed");
        }
    });

    function handleSubmit(e: FormEvent) {
        e.preventDefault();
        setError(null);
        loginMutation.mutate();
    }

    return (
        <main className="flex min-h-svh items-center justify-center bg-background px-4 py-8">
            <Card className="w-full max-w-md">
                <CardHeader className="text-center">
                    <div className="flex justify-center mb-2">
                        <div className="flex size-10 items-center justify-center rounded-xl border border-border/80 bg-secondary/50">
                            <Zap className="size-5" strokeWidth={2} />
                        </div>
                    </div>
                    <CardTitle>Sign in to XEYGATE</CardTitle>
                    <CardDescription>Access your API keys and usage dashboard</CardDescription>
                </CardHeader>
                <CardContent>
                    <form className="flex flex-col gap-4" onSubmit={handleSubmit}>
                        <label className="flex flex-col gap-1.5 text-xs font-medium">
                            Email
                            <Input type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" required autoFocus />
                        </label>
                        <label className="flex flex-col gap-1.5 text-xs font-medium">
                            Password
                            <Input type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Your password" required />
                        </label>
                        {error && (
                            <p className="rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-xs text-destructive">{error}</p>
                        )}
                        {oauthError && (
                            <p className="rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-xs text-destructive">{oauthError}</p>
                        )}
                        <div className="flex items-start gap-2.5">
                            <Checkbox
                                id="terms-consent"
                                checked={agreed}
                                onCheckedChange={(c) => setAgreed(Boolean(c))}
                                className="mt-px"
                            />
                            <label htmlFor="terms-consent" className="cursor-pointer select-none text-[11px] leading-relaxed text-muted-foreground">
                                I agree to the{" "}
                                <Link to="/terms" target="_blank" rel="noreferrer" className="text-foreground underline underline-offset-2 hover:text-foreground/80">Terms of Service</Link>{" "}
                                and{" "}
                                <Link to="/privacy" target="_blank" rel="noreferrer" className="text-foreground underline underline-offset-2 hover:text-foreground/80">Privacy Policy</Link>.
                            </label>
                        </div>
                        <Button type="submit" disabled={loginMutation.isPending || !agreed} className="w-full">
                            {loginMutation.isPending ? "Signing in..." : "Sign in"}
                        </Button>
                        <GitHubSignIn disabled={!agreed} />
                        <p className="text-center text-xs text-muted-foreground">
                            Don&apos;t have an account?{" "}
                            <Link to="/register" className="text-foreground underline underline-offset-2 hover:text-foreground/80">Register</Link>
                        </p>
                    </form>
                </CardContent>
            </Card>
        </main>
    );
}
