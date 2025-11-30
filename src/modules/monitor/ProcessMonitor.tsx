import { useEffect, useState, useCallback, useRef } from "react";
import { invoke } from "@tauri-apps/api/core";
import { useNavigate } from "react-router-dom";

import { Card, CardContent, CardHeader, CardTitle } from "@/shared/components/ui/card";
import { Progress } from "@/shared/components/ui/progress";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/shared/components/ui/table";
import { Button } from "@/shared/components/ui/button";
import {
    DropdownMenu,
    DropdownMenuTrigger,
    DropdownMenuContent,
    DropdownMenuItem,
} from "@/shared/components/ui/dropdown-menu";
import { 
    EllipsisVertical, 
    Cpu, 
    MemoryStick, 
    Server, 
    PlayCircle, 
    RefreshCw 
} from "lucide-react";

import type { Proceso } from "@/shared/types/types";
import type { Process } from "../simulador/ProcessFrom";
import { cn } from "@/shared/lib/utils";

const PAGE_SIZE = 10;

interface SystemInfo {
    total_memory: number;
    used_memory: number;
    total_swap: number;
    used_swap: number;
}

export default function ProcessMonitor() {
    const [procesosReales, setProcesosReales] = useState<Proceso[]>([]);
    const [systemInfo, setSystemInfo] = useState<SystemInfo | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [page, setPage] = useState(1);

    const containerRef = useRef<HTMLDivElement | null>(null);
    const savedScrollRef = useRef<number>(0);
    const navigate = useNavigate();

    const fetchProcesos = useCallback(async () => {
        try {
            if (containerRef.current) savedScrollRef.current = containerRef.current.scrollTop;
            
            setLoading(true);
            setError(null);
            
            // Fetch both processes and system info in parallel
            const [procesosData, infoData] = await Promise.all([
                invoke<Proceso[]>("obtener_procesos"),
                invoke<SystemInfo>("obtener_info_sistema")
            ]);

            if (!Array.isArray(procesosData)) {
                console.error("Respuesta inválida de obtener_procesos", procesosData);
                setProcesosReales([]);
                setError("Respuesta inválida del backend");
                return;
            }
            setProcesosReales(procesosData);
            setSystemInfo(infoData);

        } catch (err) {
            console.error("invoke error", err);
            // Don't clear processes if just a transient error, but here we set empty for safety
            // setProcesosReales([]); 
            setError(String(err ?? "Error desconocido"));
        } finally {
            setLoading(false);
            requestAnimationFrame(() => {
                if (containerRef.current) {
                    containerRef.current.scrollTop = savedScrollRef.current;
                }
            });
        }
    }, []);

    useEffect(() => {
        fetchProcesos();
        const intervalo = setInterval(fetchProcesos, 5000); // Refresh every 5s for better responsiveness
        return () => clearInterval(intervalo);
    }, [fetchProcesos]);

    const toNumber = (v: any): number | undefined => {
        if (v == null) return undefined;
        const n = Number(v);
        return Number.isFinite(n) ? n : undefined;
    };

    function mapToSimulator(p: Proceso): Partial<Process> {
        const pid = String(p.pid ?? Date.now());
        const nombre = p.nombre ?? `proc-${pid}`;
        
        const ttFromProceso = toNumber((p as any).tiempo_total);
        const tiempoCpuNum = toNumber(p.tiempo_cpu);
        const tiempo_total = ttFromProceso ?? (typeof tiempoCpuNum === "number" && tiempoCpuNum > 0 ? Math.max(5, Math.round(tiempoCpuNum)) : 10);

        const trFromProceso = toNumber((p as any).tiempo_restante);
        const tiempo_restante = typeof trFromProceso === "number" ? trFromProceso : tiempo_total;

        const quantum = Math.max(3, Math.floor(tiempo_total / 3));
        const iteracion = toNumber((p as any).iteraciones) ?? toNumber((p as any).iteracion) ?? 0;
        const tiempo_cpu = tiempoCpuNum ?? 0;

        let progreso: number;
        const tt = Number(tiempo_total);
        const tr = Number(tiempo_restante);

        if (typeof p.avance === "number" && !Number.isNaN(p.avance)) {
            progreso = Math.round(Math.max(0, Math.min(100, p.avance)));
        } else if (Number.isFinite(tt) && tt > 0 && Number.isFinite(tr)) {
            const raw = ((tt - tr) / tt) * 100;
            progreso = Math.round(Math.max(0, Math.min(100, raw)));
        } else {
            progreso = 0;
        }

        let interactividad = toNumber(p.interactividad) ?? 2;
        interactividad = Math.max(0, Math.min(3, interactividad));

        return {
            pid,
            nombre,
            tiempo_total,
            tiempo_restante,
            quantum,
            iteracion,
            estado: "listo",
            progreso,
            tiempo_cpu,
            interactividad,
            interactividad_inicial: interactividad,
        };
    }

    const simularProceso = (p: Proceso) => {
        const simulated = mapToSimulator(p);
        navigate("/simulador", { state: { simulatedProcess: simulated } });
    };

    // --- Statistics ---
    const totalProcesos = procesosReales.length;
    const avgCpu = totalProcesos > 0 
        ? procesosReales.reduce((acc, p) => acc + (toNumber(p.tiempo_cpu) ?? 0), 0) / totalProcesos 
        : 0;
    
    // Memory calculation from SystemInfo
    const usedMemGB = systemInfo ? systemInfo.used_memory / 1024 / 1024 : 0;
    const totalMemGB = systemInfo ? systemInfo.total_memory / 1024 / 1024 : 0;
    const memPercentage = totalMemGB > 0 ? (usedMemGB / totalMemGB) * 100 : 0;

    // --- Pagination ---
    const totalPages = Math.max(1, Math.ceil(procesosReales.length / PAGE_SIZE));
    const pageData = procesosReales.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

    useEffect(() => {
        if (page > totalPages) setPage(totalPages);
    }, [totalPages, page]);

    return (
        <div className="p-6 space-y-6 animate-in fade-in duration-500" ref={containerRef}>
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">Monitor de Sistema</h1>
                    <p className="text-muted-foreground">Vista en tiempo real de los procesos del sistema.</p>
                </div>
                <Button onClick={() => fetchProcesos()} variant="outline" className="gap-2">
                    <RefreshCw className={cn("h-4 w-4", loading && "animate-spin")} />
                    Refrescar
                </Button>
            </div>

            {/* Dashboard Cards */}
            <div className="grid gap-4 md:grid-cols-3">
                <Card className="bg-card/50 backdrop-blur border-primary/10 shadow-sm">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Total Procesos</CardTitle>
                        <Server className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{totalProcesos}</div>
                        <p className="text-xs text-muted-foreground">Procesos detectados por el sistema</p>
                    </CardContent>
                </Card>
                <Card className="bg-card/50 backdrop-blur border-primary/10 shadow-sm">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Uso CPU Promedio</CardTitle>
                        <Cpu className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{avgCpu.toFixed(1)}%</div>
                        <Progress value={Math.min(100, avgCpu)} className="h-2 mt-2" />
                    </CardContent>
                </Card>
                <Card className="bg-card/50 backdrop-blur border-primary/10 shadow-sm">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Uso de Memoria</CardTitle>
                        <MemoryStick className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">
                            {usedMemGB.toFixed(1)} / {totalMemGB.toFixed(1)} MB
                        </div>
                        <Progress value={Math.min(100, memPercentage)} className="h-2 mt-2" />
                        <p className="text-xs text-muted-foreground mt-1">
                            {memPercentage.toFixed(1)}% utilizado
                        </p>
                    </CardContent>
                </Card>
            </div>

            {error && (
                <div className="p-4 rounded-md bg-destructive/10 text-destructive text-sm font-medium">
                    Error: {error}
                </div>
            )}

            {/* Process Table */}
            <Card className="border-primary/10 shadow-md overflow-hidden">
                <CardHeader className="bg-muted/30 border-b border-border/50 py-4">
                    <CardTitle className="text-lg font-medium flex items-center gap-2">
                        <MemoryStick className="h-5 w-5 text-primary" />
                        Tabla de Procesos
                    </CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                    <div className="overflow-x-auto">
                        <Table>
                            <TableHeader>
                                <TableRow className="bg-muted/50 hover:bg-muted/50">
                                    <TableHead className="w-[100px]">PID</TableHead>
                                    <TableHead>Nombre</TableHead>
                                    <TableHead className="text-center">Prioridad</TableHead>
                                    <TableHead className="text-center">CPU (%)</TableHead>
                                    <TableHead className="text-center">Estado</TableHead>
                                    <TableHead className="w-[200px]">Progreso</TableHead>
                                    <TableHead className="text-right">Acciones</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {pageData.length === 0 ? (
                                    <TableRow>
                                        <TableCell colSpan={7} className="h-24 text-center text-muted-foreground">
                                            No se encontraron procesos.
                                        </TableCell>
                                    </TableRow>
                                ) : (
                                    pageData.map((p) => (
                                        <TableRow key={p.pid} className="hover:bg-muted/30 transition-colors">
                                            <TableCell className="font-mono font-medium text-xs">{p.pid}</TableCell>
                                            <TableCell className="font-medium text-foreground/90 max-w-[200px] truncate" title={p.nombre}>
                                                {p.nombre}
                                            </TableCell>
                                            <TableCell className="text-center">{p.interactividad ?? "-"}</TableCell>
                                            <TableCell className="text-center font-mono">
                                                {(Number(p.tiempo_cpu ?? 0)).toFixed(1)}%
                                            </TableCell>
                                            <TableCell className="text-center">
                                                <span className={cn(
                                                    "px-2 py-0.5 rounded-full text-[10px] uppercase font-bold tracking-wider",
                                                    (p.estado === "Run" || p.estado === "Running") 
                                                        ? "bg-green-500/10 text-green-600 dark:text-green-400 border border-green-500/20"
                                                        : "bg-slate-500/10 text-slate-500 border border-slate-500/20"
                                                )}>
                                                    {p.estado ?? "Unknown"}
                                                </span>
                                            </TableCell>
                                            <TableCell>
                                                <div className="flex items-center gap-2">
                                                    <Progress value={Math.round((p.avance ?? 0) as number)} className="h-1.5" />
                                                    <span className="text-[10px] text-muted-foreground w-8 text-right">
                                                        {Math.round((p.avance ?? 0) as number)}%
                                                    </span>
                                                </div>
                                            </TableCell>
                                            <TableCell className="text-right">
                                                <DropdownMenu>
                                                    <DropdownMenuTrigger asChild>
                                                        <Button variant="ghost" size="icon" className="h-8 w-8">
                                                            <EllipsisVertical className="h-4 w-4" />
                                                        </Button>
                                                    </DropdownMenuTrigger>
                                                    <DropdownMenuContent align="end">
                                                        <DropdownMenuItem onClick={() => simularProceso(p)}>
                                                            <PlayCircle className="mr-2 h-4 w-4" />
                                                            Simular Proceso
                                                        </DropdownMenuItem>
                                                    </DropdownMenuContent>
                                                </DropdownMenu>
                                            </TableCell>
                                        </TableRow>
                                    ))
                                )}
                            </TableBody>
                        </Table>
                    </div>
                </CardContent>
                
                {/* Pagination Footer */}
                <div className="flex items-center justify-between px-4 py-4 border-t border-border/50 bg-muted/20">
                    <div className="text-xs text-muted-foreground">
                        Mostrando {pageData.length} de {totalProcesos} procesos
                    </div>
                    <div className="flex items-center gap-2">
                        <Button 
                            variant="outline" 
                            size="sm" 
                            onClick={() => setPage(1)} 
                            disabled={page === 1}
                            className="h-8 w-8 p-0"
                        >
                            {"<<"}
                        </Button>
                        <Button 
                            variant="outline" 
                            size="sm" 
                            onClick={() => setPage(p => Math.max(1, p - 1))} 
                            disabled={page === 1}
                            className="h-8 w-8 p-0"
                        >
                            {"<"}
                        </Button>
                        <span className="text-xs font-medium min-w-[3rem] text-center">
                            {page} / {totalPages}
                        </span>
                        <Button 
                            variant="outline" 
                            size="sm" 
                            onClick={() => setPage(p => Math.min(totalPages, p + 1))} 
                            disabled={page === totalPages}
                            className="h-8 w-8 p-0"
                        >
                            {">"}
                        </Button>
                        <Button 
                            variant="outline" 
                            size="sm" 
                            onClick={() => setPage(totalPages)} 
                            disabled={page === totalPages}
                            className="h-8 w-8 p-0"
                        >
                            {">>"}
                        </Button>
                    </div>
                </div>
            </Card>
        </div>
    );
}
