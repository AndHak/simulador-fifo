import { useEffect, useState, useCallback, useRef } from "react"; // React hooks: efectos, estado, callback y refs
import { invoke } from "@tauri-apps/api/core"; // invoke para llamar comandos Tauri
import { useNavigate } from "react-router-dom"; // navegar entre rutas

import { Card, CardContent } from "@/shared/components/ui/card"; // UI: tarjeta
import { Progress } from "@/shared/components/ui/progress"; // UI: barra de progreso
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/shared/components/ui/table"; // UI: tabla y subcomponentes
import { Button } from "@/shared/components/ui/button"; // UI: botón
import {
    BarChart,
    Bar,
    XAxis,
    YAxis,
    Tooltip as ChartTooltip,
    CartesianGrid,
    ResponsiveContainer,
} from "recharts"; // Recharts para gráficos
import {
    DropdownMenu,
    DropdownMenuTrigger,
    DropdownMenuContent,
} from "@/shared/components/ui/dropdown-menu"; // UI: dropdown
import { EllipsisVertical } from "lucide-react"; // icono de tres puntos

import type { Proceso } from "@/shared/types/types"; // tipo del backend
import type { Process } from "../simulador/ProcessFrom"; // tipo para el simulador

const PAGE_SIZE = 20; // tamaño de página para paginación

export default function ProcessMonitor() {
    // estados principales del componente
    const [procesosReales, setProcesosReales] = useState<Proceso[]>([]); // lista de procesos tal como los entrega Tauri
    const [loading, setLoading] = useState(false); // indicador de carga
    const [error, setError] = useState<string | null>(null); // mensaje de error (si hay)
    const [page, setPage] = useState(1); // página actual de la paginación

    // refs para manejar scroll/contendor
    const containerRef = useRef<HTMLDivElement | null>(null); // referencia al contenedor principal
    const savedScrollRef = useRef<number>(0); // almacenar scrollTop antes de refrescar para restaurarlo
    const navigate = useNavigate(); // hook para navegar a la ruta del simulador

    // ----------------------
    // fetch desde Tauri
    // ----------------------
    const fetchProcesos = useCallback(async () => {
        try {
            // guardar scroll actual antes de actualizar (evita salto visible)
            if (containerRef.current) savedScrollRef.current = containerRef.current.scrollTop;
            console.log("Se ha refrescado"); // log informativo

            setLoading(true); // empezar loading
            setError(null); // limpiar error previo
            const data = await invoke<Proceso[]>("obtener_procesos"); // llamar comando Tauri
            if (!Array.isArray(data)) {
                // si la respuesta no es un array, tratar como error
                console.error("Respuesta inválida de obtener_procesos", data);
                setProcesosReales([]);
                setError("Respuesta inválida del backend");
                return;
            }
            setProcesosReales(data); // actualizar estado con los procesos reales
        } catch (err) {
            // manejo de errores en invoke
            console.error("invoke error", err);
            setProcesosReales([]);
            setError(String(err ?? "Error desconocido"));
        } finally {
            setLoading(false); // terminar loading
            // restaurar scroll en el siguiente frame para evitar jump visual
            requestAnimationFrame(() => {
                if (containerRef.current) {
                    containerRef.current.scrollTop = savedScrollRef.current;
                }
            });
        }
    }, []); // dependencias vacías: la función es estable

    // al montar, hacer la primera carga y luego refrescar cada 10s
    useEffect(() => {
        fetchProcesos();
        const intervalo = setInterval(fetchProcesos, 10000);
        return () => clearInterval(intervalo);
    }, [fetchProcesos]);

    // ----------------------
    // util: convertir valores a número o undefined
    // ----------------------
    const toNumber = (v: any): number | undefined => {
        if (v == null) return undefined; // null/undefined -> undefined
        const n = Number(v); // intentar convertir
        return Number.isFinite(n) ? n : undefined; // solo números finitos válidos
    };

    /**
     * mapToSimulator
     * - Normaliza/convierte un `Proceso` real a un `Partial<Process>` que entiende el simulador.
     * - Reglas:
     *   * pid y nombre se normalizan a string/placeholder.
     *   * prioridad: usar p.prioridad si viene, si no -> 1.
     *   * tiempo_total: preferir p.tiempo_total; si no existe, usar tiempo_cpu redondeado; si tampoco, valor por defecto 10.
     *   * tiempo_restante: preferir p.tiempo_restante; si no existe, igualar a tiempo_total.
     *   * quantum: en FIFO dejamos 0 (o lo que decidas).
     *   * iteracion: normalizar iteraciones/iteracion.
     *   * tiempo_cpu: usar p.tiempo_cpu si viene.
     *   * progreso: calcular de forma sencilla y segura a partir de tiempo_total/tiempo_restante; fallback a p.avance si existe.
     */
    function mapToSimulator(p: Proceso): Partial<Process> {
        // asegurar pid y nombre como strings legibles
        const pid = String(p.pid ?? Date.now()); // fallback a timestamp si no hay pid
        const nombre = p.nombre ?? `proc-${pid}`; // fallback a proc-<pid> si no hay nombre
        // --- TIEMPOS ---
        // tomar tiempo_total preferido desde p.tiempo_total; si no existe, usar tiempo_cpu heurístico; si no, default 10
        const ttFromProceso = toNumber((p as any).tiempo_total);
        const tiempoCpuNum = toNumber(p.tiempo_cpu);
        const tiempo_total = ttFromProceso ?? (typeof tiempoCpuNum === "number" && tiempoCpuNum > 0 ? Math.max(5, Math.round(tiempoCpuNum)) : 10);

        // tiempo_restante: preferir campo real, si no usar tiempo_total (proceso no ha avanzado aún)
        const trFromProceso = toNumber((p as any).tiempo_restante);
        const tiempo_restante = typeof trFromProceso === "number" ? trFromProceso : tiempo_total;

        // quantum: ahora representa ROTACIONES.
        // Heurística: tiempo_total / 3, mínimo 3.
        const quantum = Math.max(3, Math.floor(tiempo_total / 3));

        // iteracion: normalizar iteraciones -> iteracion
        const iteracion = toNumber((p as any).iteraciones) ?? toNumber((p as any).iteracion) ?? 0;

        // tiempo_cpu: usar el valor proveniente del proceso (fallback 0)
        const tiempo_cpu = tiempoCpuNum ?? 0;

        // --- PROGRESO: cálculo simple basado en tiempo_total y tiempo_restante ---
        // convertir a Number seguros
        const tt = Number(tiempo_total);
        const tr = Number(tiempo_restante);

        // si p.avance explícito es número, lo preferimos (pero lo clamp a 0..100)
        // sino si tenemos tt > 0 calculamos ((tt - tr) / tt) * 100
        // finalmente fallback 0
        let progreso: number;
        if (typeof p.avance === "number" && !Number.isNaN(p.avance)) {
            progreso = Math.round(Math.max(0, Math.min(100, p.avance)));
        } else if (Number.isFinite(tt) && tt > 0 && Number.isFinite(tr)) {
            const raw = ((tt - tr) / tt) * 100;
            progreso = Math.round(Math.max(0, Math.min(100, raw)));
        } else {
            progreso = 0;
        }

        // interactividad: mantener si viene, si no default "media" (2), clamp 0-3
        let interactividad = toNumber(p.interactividad) ?? 2;
        interactividad = Math.max(0, Math.min(3, interactividad));

        // devolver el Partial<Process> listo para pasar al simulador
        return {
            pid,
            nombre,
            tiempo_total,
            tiempo_restante,
            quantum,
            iteracion,
            estado: "listo", // al crear desde monitor, lo abrimos como listo
            progreso,
            tiempo_cpu,
            interactividad,
            interactividad_inicial: interactividad, // Set initial interactivity
        };
    }

    // abrir simulador con el proceso simulado (navegar pasando state)
    const simularProceso = (p: Proceso) => {
        const simulated = mapToSimulator(p);
        navigate("/simulador", { state: { simulatedProcess: simulated } });
    };

    // datos para la gráfica: top 10 por tiempo_cpu
    const chartData = procesosReales
        .slice()
        .sort((a, b) => (Number(b.tiempo_cpu ?? 0) - Number(a.tiempo_cpu ?? 0)))
        .slice(0, 10)
        .map((p) => ({
            nombre: p.nombre ?? `PID ${p.pid}`,
            tiempo_cpu: Number(p.tiempo_cpu ?? 0),
        }));

    // paginación básica
    const totalPages = Math.max(1, Math.ceil(procesosReales.length / PAGE_SIZE));
    const pageData = procesosReales.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

    // si la página actual queda fuera de rango, ajustarla
    useEffect(() => {
        if (page > totalPages) setPage(totalPages);
    }, [totalPages, page]);

    // ----------------------
    // RENDER
    // ----------------------
    return (
        <div className="p-6 grid gap-6" ref={containerRef}>
            {/* cabecera: título y controles */}
            <div className="flex items-center justify-between">
                <h1 className="text-2xl font-bold">Monitor de Procesos</h1>

                <div className="flex gap-2 items-center">
                    {/* botón manual para refrescar (usa fetchProcesos) */}
                    <Button onClick={() => fetchProcesos()}>
                        {loading ? "Refrescando..." : "Refrescar"}
                    </Button>
                    <div className="text-sm text-muted-foreground">
                        Total procesos: {procesosReales.length}
                    </div>
                </div>
            </div>

            {/* mostrar error si existe */}
            {error && <div className="text-sm text-destructive">Error: {error}</div>}

            {/* tabla principal con la lista (paginada) */}
            <Card>
                <CardContent className="overflow-x-auto">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>PID</TableHead>
                                <TableHead>Nombre</TableHead>
                                <TableHead>Prioridad</TableHead>
                                <TableHead>Tiempo Total</TableHead>
                                <TableHead>Tiempo Restante</TableHead>
                                <TableHead>Iteración</TableHead>
                                <TableHead>Tiempo CPU (%)</TableHead>
                                <TableHead>Estado</TableHead>
                                <TableHead style={{ width: 240 }}>% Avance</TableHead>
                                <TableHead className="text-center">Acciones</TableHead>
                            </TableRow>
                        </TableHeader>

                        <TableBody>
                            {pageData.map((p) => (
                                <TableRow key={p.pid}>
                                    {/* PID */}
                                    <TableCell className="min-w-[80px]">{p.pid}</TableCell>

                                    {/* Nombre */}
                                    <TableCell className="min-w-[200px]">{p.nombre}</TableCell>

                                    {/* Interactividad */}
                                    <TableCell>{p.interactividad ?? "-"}</TableCell>

                                    {/* Tiempo total: preferir p.tiempo_total, si no mostrar p.tiempo_cpu redondeado, si no '-' */}
                                    <TableCell>
                                        {typeof (p as any).tiempo_total === "number"
                                            ? (p as any).tiempo_total
                                            : typeof p.tiempo_cpu === "number"
                                                ? Math.round(p.tiempo_cpu)
                                                : "-"}
                                    </TableCell>

                                    {/* Tiempo restante: mostrar si existe, si no '-' */}
                                    <TableCell>
                                        {typeof (p as any).tiempo_restante === "number"
                                            ? (p as any).tiempo_restante
                                            : "-"}
                                    </TableCell>

                                    {/* Iteración */}
                                    <TableCell>
                                        {typeof (p as any).iteraciones === "number"
                                            ? (p as any).iteraciones
                                            : (p as any).iteracion ?? "-"}
                                    </TableCell>

                                    {/* Tiempo CPU (numérico con 2 decimales) */}
                                    <TableCell>{(Number(p.tiempo_cpu ?? 0)).toFixed(2)}</TableCell>

                                    {/* Estado */}
                                    <TableCell>{p.estado ?? "-"}</TableCell>

                                    {/* Progreso: usar p.avance si lo trae el proceso (en el monitor),
                                        redondeado para la barra y el texto */}
                                    <TableCell>
                                        <div className="w-full flex items-center gap-2">
                                            <div className="flex-1">
                                                <Progress value={Math.round((p.avance ?? 0) as number)} />
                                            </div>
                                            <div className="w-12 text-right text-sm">
                                                {Math.round((p.avance ?? 0) as number)}%
                                            </div>
                                        </div>
                                    </TableCell>

                                    {/* Acciones: abrir simulación del proceso (manda a /simulador con estado) */}
                                    <TableCell className="w-28">
                                        <div className="flex items-center justify-center h-full">
                                            <DropdownMenu>
                                                <DropdownMenuTrigger asChild>
                                                    <Button variant="ghost" className="justify-center">
                                                        <EllipsisVertical />
                                                    </Button>
                                                </DropdownMenuTrigger>

                                                <DropdownMenuContent>
                                                    <Button variant="ghost" onClick={() => simularProceso(p)}>
                                                        Simulación de este proceso
                                                    </Button>
                                                </DropdownMenuContent>
                                            </DropdownMenu>
                                        </div>
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>

                    {/* Pagination controls simples */}
                    <div className="flex items-center justify-between mt-4">
                        <div className="text-sm text-muted-foreground">
                            Página {page} / {totalPages}
                        </div>
                        <div className="flex gap-2">
                            <Button variant="ghost" onClick={() => setPage(1)} disabled={page === 1}>{"<<"}</Button>
                            <Button variant="ghost" onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1}>Prev</Button>

                            {/* botones de página (ventana parcial) */}
                            {Array.from({ length: totalPages }, (_, i) => i + 1)
                                .slice(Math.max(0, page - 3), Math.min(totalPages, page + 2))
                                .map((n) => (
                                    <Button key={n} variant={n === page ? "default" : "ghost"} onClick={() => setPage(n)}>
                                        {n}
                                    </Button>
                                ))}

                            <Button variant="ghost" onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page === totalPages}>Next</Button>
                            <Button variant="ghost" onClick={() => setPage(totalPages)} disabled={page === totalPages}>{">>"}</Button>
                        </div>
                    </div>
                </CardContent>
            </Card>

            {/* Gráfica de distribución de uso de CPU (vertical) */}
            <Card>
                <CardContent>
                    <h2 className="text-lg font-semibold mb-4">Distribución de Uso de CPU</h2>
                    <div className="w-full h-64">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={chartData} layout="vertical" margin={{ left: 8, right: 8 }}>
                                <CartesianGrid strokeDasharray="3 3" stroke="var(--muted)" />
                                <XAxis type="number" domain={[0, 100]} tickFormatter={(v) => `${v}%`} />
                                <YAxis dataKey="nombre" type="category" width={180} />
                                <ChartTooltip formatter={(value: any) => [`${Number(value).toFixed(2)}%`, "CPU"]} />
                                <Bar dataKey="tiempo_cpu" fill="var(--primary)" radius={[4, 4, 4, 4]} />
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
