import { useMemo } from "react";
import {
    ReactFlow,
    Background,
    Controls,
    Handle,
    Position,
    type Node,
    type Edge,
    type NodeProps,
    BackgroundVariant
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { KeyRound, Shield, Zap, Boxes, ArrowRight, Activity, GitFork } from "lucide-react";
import { useCatalog } from "@/hooks/useCatalog";
import { useFallbacks } from "@/hooks/useFallbacks";
import { useKeys } from "@/hooks/useKeys";

// Custom Node for Virtual API Keys (Ingress)
function KeySourceNode({ data }: NodeProps) {
    const keyCount = typeof data.count === "number" ? data.count : 0;
    return (
        <div className="rounded-xl border border-border/80 bg-card/95 p-3.5 shadow-md font-mono text-left min-w-44 transition-all hover:border-foreground/30">
            <div className="flex items-center justify-between gap-2 pb-2 border-b border-border/50">
                <div className="flex items-center gap-1.5 text-xs font-bold text-foreground">
                    <KeyRound className="size-3.5 text-amber-500" />
                    <span>Virtual Keys</span>
                </div>
                <span className="rounded-xs bg-amber-500/10 text-amber-500 border border-amber-500/20 px-1.5 py-0.2 text-[9px] font-bold">
                    INGRESS
                </span>
            </div>
            <div className="mt-2 flex items-baseline justify-between text-muted-foreground">
                <span className="text-[10px]">Active Keys</span>
                <span className="text-xs font-bold text-foreground">{keyCount}</span>
            </div>
            <Handle
                type="source"
                position={Position.Right}
                className="!bg-amber-500 !w-2.5 !h-2.5 !border-background"
            />
        </div>
    );
}

// Custom Node for Gateway Core / Middleware (Token Saver, Rate Limiter)
function GatewayCoreNode({ data }: NodeProps) {
    return (
        <div className="rounded-xl border border-sky-500/40 bg-card/95 p-3.5 shadow-md font-mono text-left min-w-52 transition-all hover:border-sky-500/80">
            <Handle
                type="target"
                position={Position.Left}
                className="!bg-sky-500 !w-2.5 !h-2.5 !border-background"
            />
            <div className="flex items-center justify-between gap-2 pb-2 border-b border-border/50">
                <div className="flex items-center gap-1.5 text-xs font-bold text-foreground">
                    <Zap className="size-3.5 text-sky-500" />
                    <span>SRouter Core</span>
                </div>
                <span className="rounded-xs bg-sky-500/10 text-sky-500 border border-sky-500/20 px-1.5 py-0.2 text-[9px] font-bold">
                    PROXY
                </span>
            </div>
            <div className="mt-2 space-y-1 text-[10px] text-muted-foreground">
                <div className="flex items-center justify-between">
                    <span>Circuit Breaker</span>
                    <span className="text-emerald-500 font-semibold">Active</span>
                </div>
                <div className="flex items-center justify-between">
                    <span>Token Optimizer</span>
                    <span className="text-foreground/80 font-semibold">Enabled</span>
                </div>
            </div>
            <Handle
                type="source"
                position={Position.Right}
                className="!bg-sky-500 !w-2.5 !h-2.5 !border-background"
            />
        </div>
    );
}

// Custom Node for Combos & Cascades
function CascadeNode({ data }: NodeProps) {
    const cascadeCount = typeof data.count === "number" ? data.count : 0;
    return (
        <div className="rounded-xl border border-purple-500/40 bg-card/95 p-3.5 shadow-md font-mono text-left min-w-48 transition-all hover:border-purple-500/80">
            <Handle
                type="target"
                position={Position.Left}
                className="!bg-purple-500 !w-2.5 !h-2.5 !border-background"
            />
            <div className="flex items-center justify-between gap-2 pb-2 border-b border-border/50">
                <div className="flex items-center gap-1.5 text-xs font-bold text-foreground">
                    <GitFork className="size-3.5 text-purple-400" />
                    <span>Failover Combos</span>
                </div>
                <span className="rounded-xs bg-purple-500/10 text-purple-400 border border-purple-500/20 px-1.5 py-0.2 text-[9px] font-bold">
                    CASCADE
                </span>
            </div>
            <div className="mt-2 flex items-baseline justify-between text-muted-foreground">
                <span className="text-[10px]">Active Rules</span>
                <span className="text-xs font-bold text-foreground">{cascadeCount}</span>
            </div>
            <Handle
                type="source"
                position={Position.Right}
                className="!bg-purple-500 !w-2.5 !h-2.5 !border-background"
            />
        </div>
    );
}

// Custom Node for Provider Clusters
function ProviderNode({ data }: NodeProps) {
    const name = (data.name as string) || "Provider";
    const status = (data.status as string) || "connected";
    const count = typeof data.count === "number" ? data.count : 0;
    const isOnline = status === "connected";

    return (
        <div className="rounded-xl border border-border/80 bg-card/95 p-3 shadow-md font-mono text-left min-w-44 transition-all hover:border-foreground/30">
            <Handle
                type="target"
                position={Position.Left}
                className="!bg-emerald-500 !w-2.5 !h-2.5 !border-background"
            />
            <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-1.5 min-w-0">
                    <span
                        className={`size-2 rounded-full ${
                            isOnline ? "bg-emerald-500 shadow-[0_0_6px_rgba(16,185,129,0.5)]" : "bg-muted-foreground/40"
                        }`}
                    />
                    <span className="text-xs font-bold text-foreground truncate">{name}</span>
                </div>
                <span className="text-[9px] font-mono font-medium text-muted-foreground">
                    {count} keys
                </span>
            </div>
        </div>
    );
}

const nodeTypes = {
    keySource: KeySourceNode,
    gatewayCore: GatewayCoreNode,
    cascadeEngine: CascadeNode,
    providerNode: ProviderNode
};

export function GatewayTopologyMap() {
    const { allProviders, isLoading: providersLoading } = useCatalog();
    const { fallbacks, loading: fallbacksLoading } = useFallbacks();
    const { keys, loading: keysLoading } = useKeys();

    const connectedProviders = useMemo(() => {
        return allProviders.filter((p) => p.status?.state === "connected");
    }, [allProviders]);

    const { nodes, edges } = useMemo(() => {
        const nodeList: Node[] = [];
        const edgeList: Edge[] = [];

        // 1. Ingress Node (Virtual Keys)
        nodeList.push({
            id: "node-ingress",
            type: "keySource",
            position: { x: 50, y: 140 },
            data: { count: keys.length }
        });

        // 2. SRouter Core Gateway
        nodeList.push({
            id: "node-core",
            type: "gatewayCore",
            position: { x: 300, y: 130 },
            data: {}
        });

        edgeList.push({
            id: "edge-ingress-core",
            source: "node-ingress",
            target: "node-core",
            animated: true,
            style: { stroke: "var(--color-amber-500, #f59e0b)", strokeWidth: 2 }
        });

        // 3. Cascade / Combo Engine
        nodeList.push({
            id: "node-cascade",
            type: "cascadeEngine",
            position: { x: 580, y: 140 },
            data: { count: fallbacks.length }
        });

        edgeList.push({
            id: "edge-core-cascade",
            source: "node-core",
            target: "node-cascade",
            animated: true,
            style: { stroke: "var(--color-sky-500, #0ea5e9)", strokeWidth: 2 }
        });

        // 4. Provider Cluster Nodes
        const displayedProviders = connectedProviders.length > 0
            ? connectedProviders.slice(0, 5)
            : allProviders.slice(0, 3); // Fallback sample providers

        const startY = 40;
        const spacingY = 75;

        displayedProviders.forEach((provider, index) => {
            const nodeId = `node-provider-${provider.id}`;
            nodeList.push({
                id: nodeId,
                type: "providerNode",
                position: { x: 840, y: startY + index * spacingY },
                data: {
                    name: provider.name,
                    status: provider.status?.state,
                    count: provider.status?.connectedCount ?? 0
                }
            });

            edgeList.push({
                id: `edge-cascade-${provider.id}`,
                source: "node-cascade",
                target: nodeId,
                animated: provider.status?.state === "connected",
                style: {
                    stroke: provider.status?.state === "connected" ? "var(--color-emerald-500, #10b981)" : "#64748b",
                    strokeWidth: 1.5
                }
            });
        });

        return { nodes: nodeList, edges: edgeList };
    }, [connectedProviders, allProviders, fallbacks.length, keys.length]);

    return (
        <section aria-label="Gateway Architecture Topology" className="rounded-xl border border-border/80 bg-card/60 p-4 font-mono shadow-2xs">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-border/60 pb-3 mb-4">
                <div className="flex items-center gap-2">
                    <div className="flex size-6 items-center justify-center rounded-md bg-secondary text-foreground">
                        <Activity className="size-3.5" />
                    </div>
                    <div>
                        <h2 className="text-xs font-bold text-foreground">
                            Interactive Mesh Routing Topology
                        </h2>
                        <p className="text-[11px] text-muted-foreground">
                            Live graph of ingress keys, core proxy routing, cascade fallback, and upstream providers.
                        </p>
                    </div>
                </div>
                <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
                    <span className="flex items-center gap-1">
                        <span className="size-2 rounded-full bg-amber-500" /> Ingress
                    </span>
                    <span className="flex items-center gap-1">
                        <span className="size-2 rounded-full bg-sky-500" /> Core
                    </span>
                    <span className="flex items-center gap-1">
                        <span className="size-2 rounded-full bg-purple-500" /> Cascade
                    </span>
                    <span className="flex items-center gap-1">
                        <span className="size-2 rounded-full bg-emerald-500" /> Upstream
                    </span>
                </div>
            </div>

            <div className="h-[360px] w-full rounded-lg border border-border/60 bg-background/50 overflow-hidden relative">
                <ReactFlow
                    nodes={nodes}
                    edges={edges}
                    nodeTypes={nodeTypes}
                    fitView
                    fitViewOptions={{ padding: 0.2 }}
                    attributionPosition="bottom-right"
                    proOptions={{ hideAttribution: true }}
                    minZoom={0.5}
                    maxZoom={1.5}
                >
                    <Background variant={BackgroundVariant.Dots} gap={16} size={1} color="#52525b" />
                    <Controls className="!bg-card !border-border !fill-foreground !text-foreground [&>button]:!border-border" />
                </ReactFlow>
            </div>
        </section>
    );
}
