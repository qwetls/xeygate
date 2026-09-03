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
    ChevronRight
} from "lucide-react";
import type { RequestLogEntry } from "@srouter/types";
import {
    Table,
    TableHeader,
    TableBody,
    TableHead,
    TableRow,
    TableCell
} from "@/components/ui/table";
import { formatTime } from "@/utils/format";
import { parseUserAgent } from "@/utils/agent-detector";

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
                            <span>Time</span>
                            {isSorted === "asc" ? (
                                <ArrowUp className="size-3 text-foreground" />
                            ) : isSorted === "desc" ? (
                                <ArrowDown className="size-3 text-foreground" />
                            ) : (
                                <ArrowUpDown className="size-3 opacity-30 hover:opacity-100" />
                            )}
                        </button>
                    );
                },
                cell: ({ row }) => {
                    const client = parseUserAgent(row.original.userAgent);
                    return (
                        <div className="whitespace-nowrap flex flex-col font-mono leading-tight">
                            <span className="text-xs font-medium text-foreground">
                                {formatTime(row.original.createdAt, true)}
                            </span>
                            <span className="text-[10px] text-muted-foreground/60 truncate max-w-[90px]" title={row.original.userAgent || row.original.ipAddress || "127.0.0.1"}>
                                {client.isKnownAgent ? client.name : (row.original.ipAddress || "127.0.0.1")}
                            </span>
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

                    return (
                        <span
                            className={[
                                "inline-flex items-center gap-1 font-mono text-[11px] tabular-nums font-semibold",
                                is2xx ? "text-foreground" : "text-destructive font-bold"
                            ].join(" ")}
                        >
                            {is2xx ? (
                                <CheckCircle2 className="size-3 text-muted-foreground/60" />
                            ) : (
                                <AlertCircle className="size-3 text-destructive" />
                            )}
                            {status}
                        </span>
                    );
                }
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
                            <span>Route</span>
                            {isSorted === "asc" ? (
                                <ArrowUp className="size-3 text-foreground" />
                            ) : isSorted === "desc" ? (
                                <ArrowDown className="size-3 text-foreground" />
                            ) : (
                                <ArrowUpDown className="size-3 opacity-30 hover:opacity-100" />
                            )}
                        </button>
                    );
                },
                cell: ({ row }) => {
                    const model = row.original.model;
                    const provider = row.original.providerId;
                    const resolved = row.original.resolvedModel;

                    return (
                        <div className="flex flex-col min-w-0 max-w-sm font-mono leading-tight">
                            <div className="flex items-center gap-1.5 truncate">
                                <span className="text-xs font-medium text-foreground truncate">
                                    {model}
                                </span>
                                {row.original.fallbackOccurred && (
                                    <span className="shrink-0 text-[9px] text-muted-foreground bg-secondary/50 px-1 rounded">
                                        fallback
                                    </span>
                                )}
                            </div>
                            <span className="text-[10px] text-muted-foreground/60 truncate">
                                {provider}
                                {resolved && resolved !== model ? ` ↳ ${resolved}` : ""}
                            </span>
                        </div>
                    );
                }
            }
        ];

        if (requireApiKey) {
            cols.push({
                accessorKey: "apiKeyId",
                header: "Key",
                cell: ({ row }) => {
                    const keyName = row.original.apiKeyName;
                    const keyId = row.original.apiKeyId;
                    if (!keyId) {
                        return <span className="font-mono text-[11px] text-muted-foreground/40">—</span>;
                    }
                    return (
                        <span
                            className="font-mono text-[11px] text-muted-foreground truncate block max-w-[120px]"
                            title={keyName || keyId}
                        >
                            {keyName || `${keyId.slice(0, 8)}…`}
                        </span>
                    );
                }
            });
        }

        cols.push(
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
                                <ArrowUp className="size-3 text-foreground" />
                            ) : isSorted === "desc" ? (
                                <ArrowDown className="size-3 text-foreground" />
                            ) : (
                                <ArrowUpDown className="size-3 opacity-30 hover:opacity-100" />
                            )}
                        </button>
                    );
                },
                cell: ({ row }) => (
                    <span className="font-mono text-xs text-foreground tabular-nums">
                        {row.original.totalTokens.toLocaleString()}
                    </span>
                )
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
                                <ArrowUp className="size-3 text-foreground" />
                            ) : isSorted === "desc" ? (
                                <ArrowDown className="size-3 text-foreground" />
                            ) : (
                                <ArrowUpDown className="size-3 opacity-30 hover:opacity-100" />
                            )}
                        </button>
                    );
                },
                cell: ({ row }) => {
                    const ms = row.original.latencyMs;
                    const display = ms >= 1000 ? `${(ms / 1000).toFixed(1)}s` : `${ms}ms`;
                    return (
                        <span className="font-mono text-xs text-muted-foreground tabular-nums">
                            {display}
                        </span>
                    );
                }
            },
            {
                accessorKey: "estimatedCost",
                header: "Cost",
                cell: ({ row }) => {
                    const totalCost = row.original.costBreakdown?.totalCost ?? row.original.estimatedCost ?? 0;
                    return (
                        <span className="font-mono text-xs text-foreground tabular-nums">
                            ${totalCost.toFixed(4)}
                        </span>
                    );
                }
            },
            {
                id: "details",
                header: () => null,
                cell: ({ row }) => (
                    <div className="text-right">
                        <button
                            type="button"
                            onClick={(e) => {
                                e.stopPropagation();
                                onSelect(row.original);
                            }}
                            className="inline-flex size-6 items-center justify-center rounded text-muted-foreground/60 hover:text-foreground hover:bg-secondary/40 transition-colors cursor-pointer"
                            title="Inspect log details"
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
            <div className="rounded-xl border border-border/70 bg-card/40 shadow-2xs overflow-hidden">
                <Table>
                    <TableHeader className="bg-secondary/15 border-b border-border/60">
                        {table.getHeaderGroups().map((headerGroup) => (
                            <TableRow key={headerGroup.id} className="hover:bg-transparent border-none">
                                {headerGroup.headers.map((header) => (
                                    <TableHead
                                        key={header.id}
                                        className="h-9 text-[10px] uppercase tracking-wider text-muted-foreground/80 font-semibold px-4"
                                    >
                                        {header.isPlaceholder
                                            ? null
                                            : flexRender(header.column.columnDef.header, header.getContext())}
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
                                className="cursor-pointer border-b border-border/40 hover:bg-secondary/25 transition-colors group"
                            >
                                {row.getVisibleCells().map((cell) => (
                                    <TableCell key={cell.id} className="py-2.5 px-4 text-xs">
                                        {flexRender(cell.column.columnDef.cell, cell.getContext())}
                                    </TableCell>
                                ))}
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            </div>

            {/* Pagination Controls */}
            {totalRows > pageSize && (
                <div className="flex flex-col sm:flex-row items-center justify-between gap-2.5 px-1 text-xs text-muted-foreground font-mono">
                    <div>
                        Showing <span className="text-foreground font-medium">{startRow}</span>–
                        <span className="text-foreground font-medium">{endRow}</span> of{" "}
                        <span className="text-foreground font-medium">{totalRows}</span> logs
                    </div>
                    <div className="flex items-center gap-1.5">
                        <button
                            type="button"
                            onClick={() => table.previousPage()}
                            disabled={!table.getCanPreviousPage()}
                            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md border border-border/60 bg-secondary/20 hover:bg-secondary/50 text-foreground disabled:opacity-40 disabled:pointer-events-none transition-colors cursor-pointer"
                        >
                            <ChevronLeft className="size-3.5" />
                            <span>Prev</span>
                        </button>
                        <span className="px-2 text-[11px] text-muted-foreground tabular-nums">
                            {currentPage + 1} / {pageCount}
                        </span>
                        <button
                            type="button"
                            onClick={() => table.nextPage()}
                            disabled={!table.getCanNextPage()}
                            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md border border-border/60 bg-secondary/20 hover:bg-secondary/50 text-foreground disabled:opacity-40 disabled:pointer-events-none transition-colors cursor-pointer"
                        >
                            <span>Next</span>
                            <ChevronRight className="size-3.5" />
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}
