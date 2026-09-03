import { useState, useMemo } from "react";
import {
    type ColumnDef,
    type SortingState,
    type PaginationState,
    flexRender,
    getCoreRowModel,
    getPaginationRowModel,
    getSortedRowModel,
    useReactTable
} from "@tanstack/react-table";
import {
    AlertCircle,
    ArrowDown,
    ArrowUp,
    ArrowUpDown,
    CheckCircle2,
    ChevronLeft,
    ChevronRight,
    KeyRound,
    Cpu,
    Coins
} from "lucide-react";
import type { RequestLogEntry } from "@srouter/types";
import { Badge } from "@/components/ui/badge";
import {
    Table,
    TableHeader,
    TableBody,
    TableHead,
    TableRow,
    TableCell
} from "@/components/ui/table";
import { formatTime } from "@/utils/format";

function formatDate(ms: number): string {
    return new Date(ms).toLocaleDateString();
}

interface LogTableProps {
    logs: RequestLogEntry[];
    requireApiKey?: boolean;
    onSelect: (log: RequestLogEntry) => void;
}

export function LogTable({ logs, requireApiKey = false, onSelect }: LogTableProps) {
    const [sorting, setSorting] = useState<SortingState>([{ id: "createdAt", desc: true }]);
    const [pagination, setPagination] = useState<PaginationState>({
        pageIndex: 0,
        pageSize: 25
    });

    const columns = useMemo<ColumnDef<RequestLogEntry>[]>(() => {
        const cols: ColumnDef<RequestLogEntry>[] = [
            {
                accessorKey: "createdAt",
                header: ({ column }) => {
                    const isSorted = column.getIsSorted();
                    return (
                        <button
                            type="button"
                            onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
                            className="flex items-center gap-1.5 hover:text-foreground transition-colors cursor-pointer select-none"
                        >
                            <span>Timestamp</span>
                            {isSorted === "asc" ? (
                                <ArrowUp className="size-3 text-amber-500" />
                            ) : isSorted === "desc" ? (
                                <ArrowDown className="size-3 text-amber-500" />
                            ) : (
                                <ArrowUpDown className="size-3 opacity-40 hover:opacity-100" />
                            )}
                        </button>
                    );
                },
                cell: ({ row }) => (
                    <div className="whitespace-nowrap">
                        <div className="font-mono text-xs font-semibold text-foreground">
                            {formatTime(row.original.createdAt, true)}
                        </div>
                        <div className="text-[10px] text-muted-foreground/80">
                            {formatDate(row.original.createdAt)}
                        </div>
                    </div>
                )
            }
        ];

        // Tampilkan kolom API Key hanya jika requireApiKey aktif
        if (requireApiKey) {
            cols.push({
                accessorKey: "apiKeyId",
                header: "API Key",
                cell: ({ row }) => {
                    const keyId = row.original.apiKeyId;
                    const keyName = row.original.apiKeyName;

                    if (!keyId) {
                        return (
                            <span className="font-mono text-[11px] text-muted-foreground/50 italic">
                                None (bypass)
                            </span>
                        );
                    }

                    return (
                        <div className="flex items-center gap-1.5 max-w-[140px] truncate" title={`Key: ${keyName || keyId}`}>
                            <div className="flex size-5 shrink-0 items-center justify-center rounded bg-secondary/50 text-indigo-400 border border-border/50">
                                <KeyRound className="size-2.5" />
                            </div>
                            <div className="flex flex-col min-w-0">
                                <span className="font-mono text-xs font-medium text-foreground truncate">
                                    {keyName || "Virtual Key"}
                                </span>
                                <span className="font-mono text-[9px] text-muted-foreground truncate">
                                    {keyId.slice(0, 10)}…
                                </span>
                            </div>
                        </div>
                    );
                }
            });
        }

        cols.push(
            {
                accessorKey: "ipAddress",
                header: "Client IP",
                cell: ({ row }) => {
                    const ip = row.original.ipAddress;
                    if (!ip) {
                        return (
                            <span className="font-mono text-[10px] text-muted-foreground/40 italic">
                                —
                            </span>
                        );
                    }
                    return (
                        <span className="inline-flex items-center font-mono text-[11px] text-muted-foreground/90 bg-secondary/30 px-1.5 py-0.5 rounded border border-border/40">
                            {ip}
                        </span>
                    );
                }
            },
            {
                accessorKey: "providerId",
                header: ({ column }) => {
                    const isSorted = column.getIsSorted();
                    return (
                        <button
                            type="button"
                            onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
                            className="flex items-center gap-1.5 hover:text-foreground transition-colors cursor-pointer select-none"
                        >
                            <span>Provider</span>
                            {isSorted === "asc" ? (
                                <ArrowUp className="size-3 text-amber-500" />
                            ) : isSorted === "desc" ? (
                                <ArrowDown className="size-3 text-amber-500" />
                            ) : (
                                <ArrowUpDown className="size-3 opacity-40 hover:opacity-100" />
                            )}
                        </button>
                    );
                },
                cell: ({ row }) => (
                    <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[11px] font-mono font-medium bg-secondary/40 text-muted-foreground border border-border/40">
                        {row.original.providerId}
                    </span>
                )
            },
            {
                accessorKey: "model",
                header: ({ column }) => {
                    const isSorted = column.getIsSorted();
                    return (
                        <button
                            type="button"
                            onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
                            className="flex items-center gap-1.5 hover:text-foreground transition-colors cursor-pointer select-none"
                        >
                            <span>Model & Route</span>
                            {isSorted === "asc" ? (
                                <ArrowUp className="size-3 text-amber-500" />
                            ) : isSorted === "desc" ? (
                                <ArrowDown className="size-3 text-amber-500" />
                            ) : (
                                <ArrowUpDown className="size-3 opacity-40 hover:opacity-100" />
                            )}
                        </button>
                    );
                },
                cell: ({ row }) => {
                    const model = row.original.model;
                    const resolved = row.original.resolvedModel;

                    return (
                        <div className="flex flex-col gap-0.5 max-w-xs">
                            <div className="flex items-center gap-1.5">
                                <span className="font-mono text-xs font-semibold text-foreground truncate block">
                                    {model}
                                </span>
                                {row.original.fallbackOccurred && (
                                    <span className="shrink-0 inline-flex items-center rounded px-1.5 py-0.2 text-[9px] font-mono font-bold bg-amber-500/15 text-amber-400 border border-amber-500/30">
                                        Fallback
                                    </span>
                                )}
                            </div>
                            {resolved && resolved !== model && (
                                <span
                                    className="font-mono text-[10px] text-muted-foreground truncate flex items-center gap-1"
                                    title={`Dispatched to: ${resolved}`}
                                >
                                    <span className="text-indigo-400">↳</span>
                                    <span>{resolved}</span>
                                </span>
                            )}
                        </div>
                    );
                }
            },
            {
                accessorKey: "statusCode",
                header: "Status",
                cell: ({ row }) => {
                    const status = row.original.statusCode;
                    const is2xx = status >= 200 && status < 300;
                    const is4xx = status >= 400 && status < 500;
                    const variant = is2xx ? "emerald" : is4xx ? "amber" : "destructive";

                    return (
                        <Badge
                            variant={variant}
                            className="font-mono text-[10px] px-2 py-0.5 font-bold"
                        >
                            {is2xx ? (
                                <CheckCircle2 className="size-3" />
                            ) : (
                                <AlertCircle className="size-3" />
                            )}
                            {status}
                        </Badge>
                    );
                }
            },
            {
                accessorKey: "totalTokens",
                header: ({ column }) => {
                    const isSorted = column.getIsSorted();
                    return (
                        <button
                            type="button"
                            onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
                            className="flex items-center gap-1.5 hover:text-foreground transition-colors cursor-pointer select-none"
                        >
                            <span>Tokens</span>
                            {isSorted === "asc" ? (
                                <ArrowUp className="size-3 text-amber-500" />
                            ) : isSorted === "desc" ? (
                                <ArrowDown className="size-3 text-amber-500" />
                            ) : (
                                <ArrowUpDown className="size-3 opacity-40 hover:opacity-100" />
                            )}
                        </button>
                    );
                },
                cell: ({ row }) => {
                    const cached = row.original.cachedTokens ?? 0;
                    return (
                        <div className="flex flex-col font-mono">
                            <div className="flex items-center gap-1.5">
                                <span className="text-xs font-semibold text-foreground">
                                    {row.original.totalTokens.toLocaleString()}
                                </span>
                                {cached > 0 && (
                                    <span className="text-[9px] px-1 py-0.2 rounded bg-sky-500/15 text-sky-400 border border-sky-500/30">
                                        ⚡{cached.toLocaleString()} cached
                                    </span>
                                )}
                            </div>
                            <span className="text-[10px] text-muted-foreground/80">
                                {row.original.promptTokens.toLocaleString()} in / {row.original.completionTokens.toLocaleString()} out
                            </span>
                        </div>
                    );
                }
            },
            {
                accessorKey: "latencyMs",
                header: ({ column }) => {
                    const isSorted = column.getIsSorted();
                    return (
                        <button
                            type="button"
                            onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
                            className="flex items-center gap-1.5 hover:text-foreground transition-colors cursor-pointer select-none"
                        >
                            <span>Latency</span>
                            {isSorted === "asc" ? (
                                <ArrowUp className="size-3 text-amber-500" />
                            ) : isSorted === "desc" ? (
                                <ArrowDown className="size-3 text-amber-500" />
                            ) : (
                                <ArrowUpDown className="size-3 opacity-40 hover:opacity-100" />
                            )}
                        </button>
                    );
                },
                cell: ({ row }) => {
                    const latency = row.original.latencyMs;
                    const color =
                        latency > 2000
                            ? "text-rose-400"
                            : latency > 1000
                            ? "text-amber-400"
                            : "text-emerald-400";

                    return (
                        <span className={`font-mono text-xs font-semibold ${color}`}>
                            {latency}ms
                        </span>
                    );
                }
            },
            {
                accessorKey: "estimatedCost",
                header: "Cost",
                cell: ({ row }) => {
                    const totalCost = row.original.costBreakdown?.totalCost ?? row.original.estimatedCost;
                    const cacheReadCost = row.original.costBreakdown?.cacheReadCost ?? 0;

                    if (!totalCost && totalCost !== 0) {
                        return <span className="font-mono text-xs text-muted-foreground/50">—</span>;
                    }

                    return (
                        <div className="flex flex-col font-mono">
                            <span className="text-xs font-semibold text-emerald-400">
                                ${totalCost.toFixed(5)}
                            </span>
                            {cacheReadCost > 0 && (
                                <span className="text-[9px] text-sky-400/90" title="Cost attributed to cache read">
                                    cache: ${cacheReadCost.toFixed(5)}
                                </span>
                            )}
                        </div>
                    );
                }
            },
            {
                id: "details",
                header: () => <div className="text-right">Details</div>,
                cell: ({ row }) => (
                    <div className="text-right">
                        <button
                            type="button"
                            onClick={(e) => {
                                e.stopPropagation();
                                onSelect(row.original);
                            }}
                            className="inline-flex size-6 items-center justify-center rounded-md border border-border/60 bg-secondary/30 text-muted-foreground group-hover:bg-foreground group-hover:text-background transition-all cursor-pointer shadow-2xs"
                            title="Inspect log breakdown"
                        >
                            <ChevronRight className="size-3.5" />
                        </button>
                    </div>
                )
            }
        );

        return cols;
    }, [requireApiKey, onSelect]);

    const table = useReactTable({
        data: logs,
        columns,
        state: {
            sorting,
            pagination
        },
        onSortingChange: setSorting,
        onPaginationChange: setPagination,
        getCoreRowModel: getCoreRowModel(),
        getSortedRowModel: getSortedRowModel(),
        getPaginationRowModel: getPaginationRowModel()
    });

    const pageCount = table.getPageCount();
    const currentPage = table.getState().pagination.pageIndex;
    const pageSize = table.getState().pagination.pageSize;
    const totalRows = logs.length;
    const startRow = totalRows === 0 ? 0 : currentPage * pageSize + 1;
    const endRow = Math.min((currentPage + 1) * pageSize, totalRows);

    return (
        <div className="space-y-3 font-mono">
            <div className="rounded-xl border border-border/80 bg-card shadow-2xs overflow-hidden">
                <Table>
                    <TableHeader className="bg-secondary/20 border-b border-border/70">
                        {table.getHeaderGroups().map((headerGroup) => (
                            <TableRow key={headerGroup.id}>
                                {headerGroup.headers.map((header) => (
                                    <TableHead
                                        key={header.id}
                                        className={`text-[11px] font-semibold tracking-wider uppercase text-muted-foreground/90 ${
                                            header.id === "details" ? "text-right" : ""
                                        }`}
                                    >
                                        {header.isPlaceholder
                                            ? null
                                            : flexRender(
                                                  header.column.columnDef.header,
                                                  header.getContext()
                                              )}
                                    </TableHead>
                                ))}
                            </TableRow>
                        ))}
                    </TableHeader>
                    <TableBody>
                        {table.getRowModel().rows.map((row) => (
                            <TableRow
                                key={row.id}
                                onClick={() => onSelect(row.original)}
                                className="cursor-pointer group hover:bg-secondary/30 transition-colors border-b border-border/40"
                            >
                                {row.getVisibleCells().map((cell) => (
                                    <TableCell
                                        key={cell.id}
                                        className={cell.column.id === "details" ? "text-right" : ""}
                                    >
                                        {flexRender(cell.column.columnDef.cell, cell.getContext())}
                                    </TableCell>
                                ))}
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            </div>

            {/* Pagination Controls */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 px-1 text-xs text-muted-foreground">
                <div className="flex items-center gap-2 text-[11px]">
                    <span>Showing</span>
                    <span className="font-semibold text-foreground">
                        {totalRows === 0 ? 0 : `${startRow}-${endRow}`}
                    </span>
                    <span>of</span>
                    <span className="font-semibold text-foreground">{totalRows}</span>
                    <span>logs</span>
                </div>

                <div className="flex items-center gap-3 self-end sm:self-auto">
                    <div className="flex items-center gap-1.5 text-[11px]">
                        <span>Rows:</span>
                        <select
                            value={pageSize}
                            onChange={(e) => table.setPageSize(Number(e.target.value))}
                            className="rounded-[4px] border border-border bg-secondary/30 px-2 py-0.5 text-[11px] text-foreground focus:outline-none cursor-pointer"
                        >
                            <option value={10}>10</option>
                            <option value={25}>25</option>
                            <option value={50}>50</option>
                            <option value={100}>100</option>
                        </select>
                    </div>

                    <div className="flex items-center gap-1">
                        <button
                            type="button"
                            onClick={() => table.previousPage()}
                            disabled={!table.getCanPreviousPage()}
                            className="flex size-6 items-center justify-center rounded-[4px] border border-border bg-secondary/30 text-foreground hover:bg-secondary disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer transition-colors"
                            title="Previous page"
                        >
                            <ChevronLeft className="size-3.5" />
                        </button>
                        <span className="px-2 text-[11px] text-foreground">
                            {pageCount === 0 ? 1 : currentPage + 1} / {Math.max(1, pageCount)}
                        </span>
                        <button
                            type="button"
                            onClick={() => table.nextPage()}
                            disabled={!table.getCanNextPage()}
                            className="flex size-6 items-center justify-center rounded-[4px] border border-border bg-secondary/30 text-foreground hover:bg-secondary disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer transition-colors"
                            title="Next page"
                        >
                            <ChevronRight className="size-3.5" />
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
