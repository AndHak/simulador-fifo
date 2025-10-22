// src/components/ProcessMonitor.tsx
"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { invoke } from "@tauri-apps/api/core";
import { useNavigate } from "react-router-dom";

import { Card, CardContent } from "@/shared/components/ui/card";
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
    BarChart,
    Bar,
    XAxis,
    YAxis,
    Tooltip as ChartTooltip,
    CartesianGrid,
    ResponsiveContainer,
} from "recharts";
import {
    DropdownMenu,
    DropdownMenuTrigger,
    DropdownMenuContent,
} from "@/shared/components/ui/dropdown-menu";
import { EllipsisVertical } from "lucide-react";

import type { Proceso } from "@/shared/types/types";
import type { Process } from "../simulador/ProcessFrom";

const PAGE_SIZE = 20;

export default function ProcessMonitor() {
    const [procesosReales, setProcesosReales] = useState<Proceso[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [page, setPage] = useState(1);

    const containerRef = useRef<HTMLDivElement | null>(null);
    const savedScrollRef = useRef<number>(0);
    const navigate = useNavigate();

    // fetch desde Tauri
    const fetchProcesos = useCallback(async () => {
        try {
            // guardar scroll actual antes de actualizar
            if (containerRef.current)
                savedScrollRef.current = containerRef.current.scrollTop;

            setLoading(true);
            setError(null);
            const data = await invoke<Proceso[]>("obtener_procesos");
            if (!Array.isArray(data)) {
                console.error("Respuesta inválida de obtener_procesos", data);
                setProcesosReales([]);
                setError("Respuesta inválida del backend");
                return;
            }
            setProcesosReales(data);
        } catch (err) {
            console.error("invoke error", err);
            setProcesosReales([]);
            setError(String(err ?? "Error desconocido"));
        } finally {
            setLoading(false);
            // restaurar scroll para evitar jump
            requestAnimationFrame(() => {
                if (containerRef.current) {
                    containerRef.current.scrollTop = savedScrollRef.current;
                }
            });
        }
    }, []);

    useEffect(() => {
        fetchProcesos();
        const intervalo = setInterval(fetchProcesos, 10000);
        return () => clearInterval(intervalo);
    }, [fetchProcesos]);

    function mapToSimulator(p: Proceso): Partial<Process> {
        const pid = String(p.pid ?? Date.now());
        const nombre = p.nombre ?? `proc-${pid}`;
        const prioridad = typeof p.prioridad === "number" ? p.prioridad : 1;
        const tiempo_total =
            typeof p.tiempo_cpu === "number" && p.tiempo_cpu > 0
                ? Math.max(5, Math.round(p.tiempo_cpu))
                : Math.max(
                      5,
                      Math.round((p.memoria ?? 0) / (1024 * 1024 * 10))
                  );

        const tiempo_restante = tiempo_total;
        const quantum = 10;
        const iteracion = typeof p.iteraciones === "number" ? p.iteraciones : 0;
        const tiempo_cpu = typeof p.tiempo_cpu === "number" ? p.tiempo_cpu : 0;
        const progreso =
            typeof p.avance === "number"
                ? Math.round(Math.max(0, Math.min(100, p.avance)))
                : 0;
        const interactividad = (p.interactividad ??
            "media") as Process["interactividad"];

        return {
            pid,
            nombre,
            prioridad,
            tiempo_total,
            tiempo_restante,
            quantum,
            iteracion,
            estado: "listo",
            progreso,
            tiempo_cpu,
            interactividad,
        };
    }

    const simularProceso = (p: Proceso) => {
        const simulated = mapToSimulator(p);
        navigate("/simulador", { state: { simulatedProcess: simulated } });
    };

    const chartData = procesosReales
        .slice()
        .sort((a, b) => (b.tiempo_cpu ?? 0) - (a.tiempo_cpu ?? 0))
        .slice(0, 10)
        .map((p) => ({
            nombre: p.nombre ?? `PID ${p.pid}`,
            tiempo_cpu: Number(p.tiempo_cpu ?? 0),
        }));

    const totalPages = Math.max(
        1,
        Math.ceil(procesosReales.length / PAGE_SIZE)
    );
    const pageData = procesosReales.slice(
        (page - 1) * PAGE_SIZE,
        page * PAGE_SIZE
    );

    useEffect(() => {
        if (page > totalPages) setPage(totalPages);
    }, [totalPages, page]);

    return (
        <div className="p-6 grid gap-6" ref={containerRef}>
            <div className="flex items-center justify-between">
                <h1 className="text-2xl font-bold">Monitor de Procesos</h1>

                <div className="flex gap-2 items-center">
                    <Button onClick={() => fetchProcesos()}>
                        {loading ? "Refrescando..." : "Refrescar"}
                    </Button>
                    <div className="text-sm text-muted-foreground">
                        Total procesos: {procesosReales.length}
                    </div>
                </div>
            </div>

            {error && (
                <div className="text-sm text-destructive">Error: {error}</div>
            )}

            <Card>
                <CardContent className="overflow-x-auto">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>PID</TableHead>
                                <TableHead>Nombre</TableHead>
                                <TableHead>Prioridad</TableHead>
                                <TableHead>Interactividad</TableHead>
                                <TableHead>Tiempo CPU (%)</TableHead>
                                <TableHead>Estado</TableHead>
                                <TableHead style={{ width: 240 }}>
                                    % Avance
                                </TableHead>
                                <TableHead className="text-center">
                                    Acciones
                                </TableHead>
                            </TableRow>
                        </TableHeader>

                        <TableBody>
                            {pageData.map((p) => (
                                <TableRow key={p.pid}>
                                    <TableCell className="min-w-[80px]">
                                        {p.pid}
                                    </TableCell>
                                    <TableCell className="min-w-[200px]">
                                        {p.nombre}
                                    </TableCell>
                                    <TableCell>{p.prioridad ?? "-"}</TableCell>
                                    <TableCell>
                                        {p.interactividad ?? "-"}
                                    </TableCell>
                                    <TableCell>
                                        {(p.tiempo_cpu ?? 0).toFixed(2)}
                                    </TableCell>
                                    <TableCell>{p.estado ?? "-"}</TableCell>
                                    <TableCell>
                                        <div className="w-full">
                                            <Progress
                                                value={Math.round(
                                                    (p.avance ?? 0) as number
                                                )}
                                            />
                                        </div>
                                    </TableCell>

                                    <TableCell className="w-28">
                                        <div className="flex items-center justify-center h-full">
                                            <DropdownMenu>
                                                <DropdownMenuTrigger asChild>
                                                    <Button
                                                        variant="ghost"
                                                        className="justify-center"
                                                    >
                                                        <EllipsisVertical />
                                                    </Button>
                                                </DropdownMenuTrigger>

                                                <DropdownMenuContent>
                                                    <Button
                                                        variant="ghost"
                                                        onClick={() =>
                                                            simularProceso(p)
                                                        }
                                                    >
                                                        Simulación de este
                                                        proceso
                                                    </Button>
                                                </DropdownMenuContent>
                                            </DropdownMenu>
                                        </div>
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>

                    {/* Pagination controls */}
                    <div className="flex items-center justify-between mt-4">
                        <div className="text-sm text-muted-foreground">
                            Página {page} / {totalPages}
                        </div>
                        <div className="flex gap-2">
                            <Button
                                variant="ghost"
                                onClick={() => setPage(1)}
                                disabled={page === 1}
                            >
                                {"<<"}
                            </Button>
                            <Button
                                variant="ghost"
                                onClick={() =>
                                    setPage((p) => Math.max(1, p - 1))
                                }
                                disabled={page === 1}
                            >
                                Prev
                            </Button>

                            {/* page numbers */}
                            {Array.from({ length: totalPages }, (_, i) => i + 1)
                                .slice(
                                    Math.max(0, page - 3),
                                    Math.min(totalPages, page + 2)
                                )
                                .map((n) => (
                                    <Button
                                        key={n}
                                        variant={
                                            n === page ? "default" : "ghost"
                                        }
                                        onClick={() => setPage(n)}
                                    >
                                        {n}
                                    </Button>
                                ))}

                            <Button
                                variant="ghost"
                                onClick={() =>
                                    setPage((p) => Math.min(totalPages, p + 1))
                                }
                                disabled={page === totalPages}
                            >
                                Next
                            </Button>
                            <Button
                                variant="ghost"
                                onClick={() => setPage(totalPages)}
                                disabled={page === totalPages}
                            >
                                {">>"}
                            </Button>
                        </div>
                    </div>
                </CardContent>
            </Card>

            <Card>
                <CardContent>
                    <h2 className="text-lg font-semibold mb-4">
                        Distribución de Uso de CPU
                    </h2>
                    <div className="w-full h-64">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart
                                data={chartData}
                                layout="vertical"
                                margin={{ left: 8, right: 8 }}
                            >
                                <CartesianGrid
                                    strokeDasharray="3 3"
                                    stroke="var(--muted)"
                                />
                                <XAxis
                                    type="number"
                                    domain={[0, 100]}
                                    tickFormatter={(v) => `${v}%`}
                                />
                                <YAxis
                                    dataKey="nombre"
                                    type="category"
                                    width={180}
                                />
                                <ChartTooltip
                                    formatter={(value: any) => [
                                        `${Number(value).toFixed(2)}%`,
                                        "CPU",
                                    ]}
                                />
                                <Bar
                                    dataKey="tiempo_cpu"
                                    fill="var(--primary)"
                                    radius={[4, 4, 4, 4]}
                                />
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
