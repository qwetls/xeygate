import { useState, type FormEvent, type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { api, ApiError } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

interface UserInfo {
    id: string;
    email: string;
    name: string;
    credits: number;
}

interface UserAuthFormProps {
    mode: "login" | "register";
    onAuthenticated: () => void;
    onSwitchMode: () => void;
}

function UserAuthForm({ mode, onAuthenticated, onSwitchMode }: UserAuthFormProps) {
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [name, setName] = useState("");
    const [error, setError] = useState<string | null>(null);
    const [isSubmitting, setIsSubmitting] = useState(false);

    async function handleSubmit(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();
        setError(null);
        setIsSubmitting(true);

        try {
            if (mode === "register") {
                await api.post<UserInfo>("/v1/users/register", { email, password, name });
            } else {
                await api.post<UserInfo>("/v1/users/login", { email, password });
            }
            onAuthenticated();
        } catch (cause) {
            setError(cause instanceof ApiError ? cause.message : "Authentication failed");
        } finally {
            setIsSubmitting(false);
        }
    }

    return (
        <main className="flex min-h-svh items-center justify-center bg-background px-4 py-8">
            <Card className="w-full max-w-md">
                <CardHeader>
                    <p className="font-mono text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                        XEYGATE
                    </p>
                    <CardTitle>{mode === "register" ? "Create your account" : "Sign in"}</CardTitle>
                    <CardDescription>
                        {mode === "register"
                            ? "Register to get API keys and start using the gateway."
                            : "Sign in to manage your API keys and usage."}
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <form className="flex flex-col gap-4" onSubmit={handleSubmit}>
                        {mode === "register" && (
                            <label className="flex flex-col gap-1.5 text-xs font-medium">
                                Name
                                <Input
                                    autoFocus
                                    type="text"
                                    autoComplete="name"
                                    value={name}
                                    onChange={(e) => setName(e.target.value)}
                                    placeholder="Your name"
                                />
                            </label>
                        )}
                        <label className="flex flex-col gap-1.5 text-xs font-medium">
                            Email
                            <Input
                                autoFocus={mode === "login"}
                                type="email"
                                autoComplete="email"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                placeholder="you@example.com"
                                required
                            />
                        </label>
                        <label className="flex flex-col gap-1.5 text-xs font-medium">
                            Password
                            <Input
                                type="password"
                                autoComplete={mode === "register" ? "new-password" : "current-password"}
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                placeholder={mode === "register" ? "Min 8 characters" : "Your password"}
                                required
                                minLength={8}
                            />
                        </label>
                        {error && (
                            <p className="rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-xs text-destructive">
                                {error}
                            </p>
                        )}
                        <Button type="submit" disabled={isSubmitting} className="mt-1 w-full">
                            {isSubmitting ? "Please wait..." : mode === "register" ? "Create account" : "Sign in"}
                        </Button>
                        <p className="text-center text-xs text-muted-foreground">
                            {mode === "register" ? (
                                <>
                                    Already have an account?{" "}
                                    <button type="button" onClick={onSwitchMode} className="text-foreground underline underline-offset-2 hover:text-foreground/80 cursor-pointer">
                                        Sign in
                                    </button>
                                </>
                            ) : (
                                <>
                                    Don&apos;t have an account?{" "}
                                    <button type="button" onClick={onSwitchMode} className="text-foreground underline underline-offset-2 hover:text-foreground/80 cursor-pointer">
                                        Register
                                    </button>
                                </>
                            )}
                        </p>
                    </form>
                </CardContent>
            </Card>
        </main>
    );
}

function AuthLoadingScreen() {
    return (
        <main className="flex min-h-svh items-center justify-center bg-background px-4">
            <p className="font-mono text-xs text-muted-foreground">Checking session...</p>
        </main>
    );
}

export function UserAuthGate({ children }: { children: ReactNode }) {
    const [mode, setMode] = useState<"login" | "register">("login");

    const statusQuery = useQuery({
        queryKey: ["user-auth-status"],
        queryFn: () => api.get<UserInfo>("/v1/users/me"),
        retry: false,
        staleTime: 0
    });

    if (statusQuery.isPending) return <AuthLoadingScreen />;
    if (statusQuery.isError) {
        return (
            <UserAuthForm
                mode={mode}
                onAuthenticated={() => void statusQuery.refetch()}
                onSwitchMode={() => setMode(mode === "login" ? "register" : "login")}
            />
        );
    }

    return <>{children}</>;
}
