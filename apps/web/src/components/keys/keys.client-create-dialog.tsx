import { useState } from "react";
import { KeyRound } from "lucide-react";
import { cn } from "@/lib/utils";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";

export interface ClientCreateKeyDialogProps {
    open: boolean;
    creating: boolean;
    onOpenChange: (open: boolean) => void;
    onSubmit: (data: { name: string; enabled: boolean }) => Promise<void>;
}

export function ClientCreateKeyDialog({
    open,
    creating,
    onOpenChange,
    onSubmit
}: ClientCreateKeyDialogProps) {
    const [name, setName] = useState("");
    const [enabled, setEnabled] = useState(true);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!name.trim()) return;
        await onSubmit({ name: name.trim(), enabled });
        setName("");
        setEnabled(true);
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-md bg-card border-border p-6">
                <DialogHeader className="space-y-1 text-left">
                    <div className="flex items-center gap-2">
                        <div className="flex size-7 items-center justify-center rounded-md bg-secondary text-foreground">
                            <KeyRound className="size-3.5" />
                        </div>
                        <DialogTitle className="text-base font-semibold text-foreground">
                            Create API Key
                        </DialogTitle>
                    </div>
                    <DialogDescription className="text-xs text-muted-foreground leading-relaxed">
                        Generate a bearer token for SDKs, clients, and automated workloads.
                        Limits are managed by your subscription plan.
                    </DialogDescription>
                </DialogHeader>

                <form onSubmit={handleSubmit} className="space-y-4 pt-1">
                    <div className="flex items-start gap-3">
                        <div className="flex-1 space-y-1.5">
                            <Label
                                htmlFor="client-key-name"
                                className="block text-xs font-medium text-foreground"
                            >
                                Key Name <span className="text-destructive">*</span>
                            </Label>
                            <Input
                                id="client-key-name"
                                type="text"
                                required
                                autoFocus
                                value={name}
                                onChange={(e) => setName(e.target.value)}
                                placeholder="e.g. production-backend"
                                className="h-9 font-mono text-xs rounded-md bg-background border-input"
                            />
                        </div>

                        <div className="space-y-1.5">
                            <Label
                                htmlFor="client-key-status"
                                className="block text-xs font-medium text-foreground"
                            >
                                Status
                            </Label>
                            <div className="flex h-9 items-center gap-2 rounded-md border border-input bg-background px-2.5">
                                <Switch
                                    id="client-key-status"
                                    checked={enabled}
                                    onCheckedChange={setEnabled}
                                />
                                <span
                                    className={cn(
                                        "text-xs font-medium select-none min-w-14",
                                        enabled
                                            ? "text-emerald-600 dark:text-emerald-400"
                                            : "text-muted-foreground"
                                    )}
                                >
                                    {enabled ? "Active" : "Disabled"}
                                </span>
                            </div>
                        </div>
                    </div>

                    <p className="text-[10px] text-muted-foreground leading-relaxed">
                        Rate limits, token quotas, and model access are set by the platform.
                    </p>

                    <DialogFooter className="pt-2 gap-2">
                        <Button
                            type="button"
                            variant="outline"
                            onClick={() => onOpenChange(false)}
                            className="h-8.5 text-xs font-medium cursor-pointer"
                        >
                            Cancel
                        </Button>
                        <Button
                            type="submit"
                            disabled={creating || !name.trim()}
                            className="h-8.5 text-xs font-semibold cursor-pointer shadow-xs"
                        >
                            {creating ? "Creating…" : "Create API Key"}
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}
