import { cn } from "@/lib/utils";

function Skeleton({ className, ...props }: React.ComponentProps<"div">) {
    return (
        <div
            data-slot="skeleton"
            className={cn(
                "animate-pulse rounded-md bg-secondary/80 dark:bg-secondary/50",
                className
            )}
            {...props}
        />
    );
}

export { Skeleton };
