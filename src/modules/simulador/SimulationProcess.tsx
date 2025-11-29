import { useMemo, useState, memo } from "react";
import { Card, CardContent } from "@/shared/components/ui/card";
import {
    Table,
    TableHeader,
    TableRow,
    TableHead,
    TableBody,
    TableCell,
} from "@/shared/components/ui/table";
import { Button } from "@/shared/components/ui/button";
import {
    DropdownMenu,
    DropdownMenuTrigger,
    DropdownMenuContent,
} from "@/shared/components/ui/dropdown-menu";
import {
    EllipsisVertical,
    Edit,
    Trash2,
    XCircle,
    RotateCcw,
    CheckLine,
    Pause,
    X,
} from "lucide-react";
import { Process } from "./ProcessFrom";

interface SimulationProcessProps {
    procesos: Process[];
    onEditar?: (p: Process) => void;
    onSuspender?: (pid: string) => void;
    onReanudar?: (pid: string) => void;
    onEliminar?: (pid: string) => void;
    onActualizar: (pid: string, cambios: Partial<Process>) => void;
    onReorder?: (from: number, to: number) => void;
    showRegistro?: boolean;
    onCloseRegistro?: () => void;
    onOpenRegistro?: () => void;
}

export default function SimulationProcess({
    procesos,
    onActualizar,
    onEditar,
    onEliminar,
    onSuspender,
    showRegistro = false,
    onCloseRegistro,
}: SimulationProcessProps) {
    const [internalRegistroOpen, setInternalRegistroOpen] = useState(false);
    const registroOpen = showRegistro || internalRegistroOpen;


    const terminated = useMemo(
        () =>
            procesos.filter(
                (p) => p.estado === "terminado"
            ),
        [procesos]
    );

    const executing = useMemo(
        () =>
            procesos.find(
                (p) => p.estado === "ejecutando"
            ) ?? null,
        [procesos]
    );

    const suspended = useMemo(
        () =>
            procesos.filter(
                (p) => p.estado === "suspendido"
            ),
        [procesos]
    );

    const ready = useMemo(
        () =>
            procesos.filter(
                (p) => p.estado === "listo"
            ),
        [procesos]
    );

    const displayList = useMemo(() => {
        const arr: Process[] = [];
        if (executing) arr.push(executing);
        arr.push(...ready);
        arr.push(...suspended);
        return arr;
    }, [executing, ready, suspended]);

    const Row = memo(
        function Row({
            p,
            onActualizar,
            onEditar,
            onEliminar,
            onSuspender,
        }: {
            p: Process;
            onActualizar: (pid: string, cambios: Partial<Process>) => void;
            onEditar?: (p: Process) => void;
            onEliminar?: (pid: string) => void;
            onSuspender?: (pid: string) => void;
        }) {
            const showNum = (v?: number | null) =>
                typeof v === "number" ? v : "-";

            const tiempoEjecutado =
                typeof p.iteracion === "number"
                    ? p.iteracion
                    : typeof p.tiempo_total === "number" &&
                      typeof p.tiempo_restante === "number"
                    ? Math.max(0, p.tiempo_total - p.tiempo_restante)
                    : "-";

            return (
                <TableRow
                    className={p.estado === "ejecutando" ? "bg-blue-50" : ""}
                >
                    <TableCell className="w-12">{p.pid}</TableCell>
                    <TableCell>{p.nombre}</TableCell>
                    <TableCell>{p.interactividad ?? "-"}</TableCell>
                    <TableCell>{showNum(p.quantum)}</TableCell>
                    <TableCell>{showNum(p.tiempo_total)}</TableCell>
                    <TableCell>{showNum(p.tiempo_restante)}</TableCell>
                    <TableCell>{showNum(tiempoEjecutado as any)}</TableCell>
                    <TableCell>{showNum(p.tiempo_espera)}</TableCell>
                    <TableCell>
                        <span
                            className={
                                p.estado === "terminado"
                                    ? "text-green-600"
                                    : p.estado === "suspendido"
                                    ? "text-yellow-600"
                                    : p.estado === "ejecutando"
                                    ? "text-blue-600"
                                    : "text-muted-foreground"
                            }
                        >
                            {p.estado}
                        </span>
                    </TableCell>
                    <TableCell className="w-36">
                        <div className="h-2 bg-muted rounded overflow-hidden">
                            <div
                                style={{
                                    width: `${Math.max(
                                        0,
                                        Math.min(100, p.progreso ?? 0)
                                    )}%`,
                                }}
                                className="h-full bg-primary"
                            />
                        </div>
                    </TableCell>

                    <TableCell className="w-10">
                        <div className="flex justify-center">
                            <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                    <div
                                        onPointerDown={(e) =>
                                            e.stopPropagation()
                                        }
                                        onMouseDown={(e) => e.stopPropagation()}
                                        onTouchStart={(e) =>
                                            e.stopPropagation()
                                        }
                                    >
                                        <Button
                                            variant="ghost"
                                            className="justify-center"
                                        >
                                            <EllipsisVertical />
                                        </Button>
                                    </div>
                                </DropdownMenuTrigger>

                                <DropdownMenuContent
                                    className="flex flex-col items-start gap-0.5"
                                    onPointerDown={(e) => e.stopPropagation()}
                                >
                                    <Button
                                        className="w-full justify-start"
                                        variant="ghost"
                                        disabled={
                                            p.estado === "listo" ||
                                            p.estado === "terminado"
                                        }
                                        onClick={() =>
                                            onActualizar(p.pid, {
                                                estado: "listo",
                                            })
                                        }
                                    >
                                        <CheckLine className="mr-2 h-4 w-4" />{" "}
                                        Listo
                                    </Button>

                                    <Button
                                        variant="ghost"
                                        className="w-full justify-start"
                                        disabled={
                                            p.estado === "suspendido" ||
                                            p.estado === "terminado"
                                        }
                                        onClick={() => {
                                            onActualizar(p.pid, {
                                                estado: "suspendido",
                                                tiempo_cpu: 0,
                                                resident: true,
                                                interactividad: p.interactividad_inicial ?? p.interactividad,
                                            });
                                            onSuspender?.(p.pid);
                                        }}
                                    >
                                        <Pause className="mr-2 h-4 w-4" />{" "}
                                        Suspender
                                    </Button>

                                    <Button
                                        className="w-full justify-start"
                                        variant="ghost"
                                        onClick={() =>
                                            onActualizar(p.pid, {
                                                estado: "terminado",
                                                progreso: 100,
                                                tiempo_restante: 0,
                                                tiempo_cpu: 0,
                                                interactividad: 0,
                                                t_fin: p.t_fin ?? 0,
                                            })
                                        }
                                    >
                                        <XCircle className="mr-2 h-4 w-4" />{" "}
                                        Finalizar
                                    </Button>

                                    <Button
                                        className="w-full justify-start"
                                        variant="ghost"
                                        onClick={() =>
                                            onActualizar(p.pid, {
                                                tiempo_restante: p.tiempo_total,
                                                progreso: 0,
                                                iteracion: 0,
                                                estado: "listo",
                                                tiempo_cpu: 0,
                                                t_inicio: null,
                                                t_fin: null,
                                                tiempo_espera: 0,
                                                interactividad: p.interactividad_inicial ?? 0,
                                            })
                                        }
                                    >
                                        <RotateCcw className="mr-2 h-4 w-4" />{" "}
                                        Reiniciar
                                    </Button>

                                    <Button
                                        variant="ghost"
                                        className="w-full justify-start"
                                        onClick={() => onEditar?.(p)}
                                    >
                                        <Edit className="mr-2 h-4 w-4" /> Editar
                                    </Button>

                                    <Button
                                        variant="destructive"
                                        className="w-full justify-start"
                                        onClick={() => onEliminar?.(p.pid)}
                                    >
                                        <Trash2 className="mr-2 h-4 w-4" />{" "}
                                        Eliminar
                                    </Button>
                                </DropdownMenuContent>
                            </DropdownMenu>
                        </div>
                    </TableCell>
                </TableRow>
            );
        },
        (prev, next) => {
            const a = prev.p;
            const b = next.p;
            const same =
                a.pid === b.pid &&
                a.nombre === b.nombre &&
                a.interactividad === b.interactividad &&
                a.quantum === b.quantum &&
                a.tiempo_total === b.tiempo_total &&
                a.tiempo_restante === b.tiempo_restante &&
                a.estado === b.estado &&
                (typeof a.progreso === "number" ? a.progreso : 0) ===
                    (typeof b.progreso === "number" ? b.progreso : 0);
            return same;
        }
    );

    return (
        <>
            <Card>
                <CardContent>
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>PID</TableHead>
                                <TableHead>Nombre</TableHead>
                                <TableHead>Interactividad</TableHead>
                                <TableHead>Quantum</TableHead>
                                <TableHead>Tiempo total</TableHead>
                                <TableHead>Tiempo restante</TableHead>
                                <TableHead>Iteraciones</TableHead>
                                <TableHead>Espera (s)</TableHead>
                                <TableHead>Estado</TableHead>
                                <TableHead>Avance</TableHead>
                                <TableHead>Acciones</TableHead>
                            </TableRow>
                        </TableHeader>

                        <TableBody>
                            {displayList.map((p) => (
                                <Row
                                    key={p.pid}
                                    p={p}
                                    onActualizar={onActualizar}
                                    onEditar={onEditar}
                                    onEliminar={onEliminar}
                                    onSuspender={onSuspender}
                                />
                            ))}
                        </TableBody>
                    </Table>
                </CardContent>
            </Card>

            {(registroOpen || terminated.length > 0) && (
                <div
                    className={`fixed inset-0 z-40 flex items-center justify-center p-6 ${
                        registroOpen ? "block" : "hidden"
                    }`}
                >
                    <div
                        className="absolute inset-0 bg-black/40"
                        onClick={() => {
                            if (onCloseRegistro) onCloseRegistro();
                            else setInternalRegistroOpen(false);
                        }}
                    />

                    <div className="relative z-50 w-full max-w-5xl bg-background rounded-lg shadow-2xl overflow-hidden max-h-[85vh] flex flex-col">
                        <div className="p-6 border-b flex items-center justify-between bg-gradient-to-r from-primary/10 to-primary/5">
                            <div>
                                <h3 className="text-xl font-bold text-foreground">
                                    Registro de Procesos Terminados
                                </h3>
                                <p className="text-sm text-muted-foreground mt-1">
                                    Historial completo de ejecución
                                </p>
                            </div>
                            <div className="flex items-center gap-3">
                                <div className="px-3 py-1.5 bg-primary/10 rounded-full">
                                    <span className="text-sm font-semibold text-primary">
                                        {terminated.length} {terminated.length === 1 ? 'proceso' : 'procesos'}
                                    </span>
                                </div>
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    onClick={() => {
                                        if (onCloseRegistro) onCloseRegistro();
                                        else setInternalRegistroOpen(false);
                                    }}
                                >
                                    <X className="h-5 w-5" />
                                </Button>
                            </div>
                        </div>

                        <div className="p-6 overflow-auto flex-1">
                            {terminated.length === 0 ? (
                                <div className="text-center py-12">
                                    <p className="text-muted-foreground text-lg">
                                        No hay procesos terminados aún
                                    </p>
                                </div>
                            ) : (
                                <Table>
                                    <TableHeader>
                                        <TableRow className="hover:bg-transparent">
                                            <TableHead className="font-semibold">PID</TableHead>
                                            <TableHead className="font-semibold">Nombre</TableHead>
                                            <TableHead className="font-semibold">Interactividad</TableHead>
                                            <TableHead className="font-semibold">Quantum</TableHead>
                                            <TableHead className="font-semibold">T. Total</TableHead>
                                            <TableHead className="font-semibold">Iteraciones</TableHead>
                                            <TableHead className="font-semibold">Espera (s)</TableHead>
                                            <TableHead className="font-semibold">T. Inicio (s)</TableHead>
                                            <TableHead className="font-semibold">T. Final (s)</TableHead>
                                            <TableHead className="font-semibold">Duración (s)</TableHead>
                                            <TableHead className="font-semibold text-center">Acciones</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {terminated.map((p) => {
                                            // T. Inicio: cuando empezó su primera iteración
                                            const tInicio = typeof p.t_inicio === "number" ? p.t_inicio : 0;
                                            
                                            // T. Final: cuando terminó (tick en que se completó)
                                            const tFinal = typeof p.t_fin === "number" ? p.t_fin : 0;
                                            
                                            // Duración: tiempo total desde el inicio de la simulación hasta que terminó
                                            const duracion = tFinal + tInicio;
                                            
                                            // Iteraciones ejecutadas
                                            const iteraciones = typeof p.iteracion === "number" ? p.iteracion : 0;

                                            return (
                                                <TableRow key={p.pid} className="hover:bg-muted/50">
                                                    <TableCell className="font-medium">{p.pid}</TableCell>
                                                    <TableCell>{p.nombre}</TableCell>
                                                    <TableCell>{p.interactividad_inicial ?? "-"}</TableCell>
                                                    <TableCell>{p.quantum ?? "-"}</TableCell>
                                                    <TableCell>{p.tiempo_total ?? "-"}</TableCell>
                                                    <TableCell>{iteraciones}</TableCell>
                                                    <TableCell>{p.tiempo_espera ?? "-"}</TableCell>
                                                    <TableCell>
                                                        <span className="px-2 py-0.5 bg-blue-100 text-blue-700 rounded text-xs font-medium">
                                                            {tInicio}s
                                                        </span>
                                                    </TableCell>
                                                    <TableCell>
                                                        <span className="px-2 py-0.5 bg-green-100 text-green-700 rounded text-xs font-medium">
                                                            {tFinal}s
                                                        </span>
                                                    </TableCell>
                                                    <TableCell>
                                                        <span className="font-semibold text-primary">
                                                            {duracion}s
                                                        </span>
                                                    </TableCell>
                                                    <TableCell>
                                                        <div className="flex justify-center">
                                                            <DropdownMenu>
                                                                <DropdownMenuTrigger asChild>
                                                                    <div
                                                                        onPointerDown={(e) => e.stopPropagation()}
                                                                        onMouseDown={(e) => e.stopPropagation()}
                                                                        onTouchStart={(e) => e.stopPropagation()}
                                                                    >
                                                                        <Button
                                                                            variant="ghost"
                                                                            size="icon"
                                                                            className="h-8 w-8"
                                                                        >
                                                                            <EllipsisVertical className="h-4 w-4" />
                                                                        </Button>
                                                                    </div>
                                                                </DropdownMenuTrigger>

                                                                <DropdownMenuContent
                                                                    className="flex flex-col items-start gap-0.5"
                                                                    onPointerDown={(e) => e.stopPropagation()}
                                                                >
                                                                    <Button
                                                                        className="w-full justify-start"
                                                                        variant="ghost"
                                                                        onClick={() =>
                                                                            onActualizar(p.pid, {
                                                                                tiempo_restante: p.tiempo_total,
                                                                                progreso: 0,
                                                                                iteracion: 0,
                                                                                estado: "listo",
                                                                                tiempo_cpu: 0,
                                                                                t_inicio: null,
                                                                                t_fin: null,
                                                                                tiempo_espera: 0,
                                                                                interactividad: p.interactividad_inicial ?? 0,
                                                                            })
                                                                        }
                                                                    >
                                                                        <RotateCcw className="mr-2 h-4 w-4" />
                                                                        Reiniciar
                                                                    </Button>

                                                                    <Button
                                                                        variant="ghost"
                                                                        className="w-full justify-start text-muted-foreground"
                                                                        onClick={() => onEditar?.(p)}
                                                                    >
                                                                        <Edit className="mr-2 h-4 w-4" />
                                                                        Ver detalles
                                                                    </Button>

                                                                    <Button
                                                                        variant="destructive"
                                                                        className="w-full justify-start"
                                                                        onClick={() => onEliminar?.(p.pid)}
                                                                    >
                                                                        <Trash2 className="mr-2 h-4 w-4" />
                                                                        Eliminar
                                                                    </Button>
                                                                </DropdownMenuContent>
                                                            </DropdownMenu>
                                                        </div>
                                                    </TableCell>
                                                </TableRow>
                                            );
                                        })}
                                    </TableBody>
                                </Table>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </>
    );
}