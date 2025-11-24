// Import React y utilidades: memo para memoizar filas, useMemo/useState para estado y optimizaciones
import React, { useMemo, useState, memo } from "react";

// Componentes UI: Card y su contenido
import { Card, CardContent } from "@/shared/components/ui/card";

// Componentes de tabla reutilizables (cabeceras, filas, celdas)
import {
    Table,
    TableHeader,
    TableRow,
    TableHead,
    TableBody,
    TableCell,
} from "@/shared/components/ui/table";

// Componente Button reutilizable
import { Button } from "@/shared/components/ui/button";

// Componentes para menú desplegable (Dropdown)
import {
    DropdownMenu,
    DropdownMenuTrigger,
    DropdownMenuContent,
} from "@/shared/components/ui/dropdown-menu";

// Iconos usados en las acciones de la fila
import {
    EllipsisVertical,
    Edit,
    Trash2,
    XCircle,
    RotateCcw,
    CheckLine,
    Pause,
} from "lucide-react";

// Import del tipo Process compartido con el formulario (tipado TS)
import { Process } from "./ProcessFrom";

// Import de dnd-kit: contexto, sensores y evento de fin de drag
import {
    DndContext,
    closestCenter,
    PointerSensor,
    useSensor,
    useSensors,
    DragEndEvent,
} from "@dnd-kit/core";

// Helpers de dnd-kit para listas ordenables
import {
    SortableContext,
    useSortable,
    verticalListSortingStrategy,
} from "@dnd-kit/sortable";

// Utilidad para convertir transform en string CSS
import { CSS } from "@dnd-kit/utilities";

// Definición de props que recibe el componente SimulationProcess
interface SimulationProcessProps {
    procesos: Process[]; // lista de procesos a mostrar
    onEditar?: (p: Process) => void; // callback para editar un proceso
    onSuspender?: (pid: string) => void; // callback cuando se suspende (opcional)
    onReanudar?: (pid: string) => void; // callback para reanudar (no usado aquí)
    onEliminar?: (pid: string) => void; // callback para eliminar proceso
    onActualizar: (pid: string, cambios: Partial<Process>) => void; // actualizar campos parciales
    onReorder?: (from: number, to: number) => void; // reordenar elementos (drag & drop)
}

// Componente principal que renderiza la tabla de procesos y habilita DnD
export default function SimulationProcess({
    procesos,
    onActualizar,
    onEditar,
    onEliminar,
    onSuspender,
    onReorder,
}: SimulationProcessProps) {
    // Crear sensores para dnd-kit: PointerSensor con distancia de activación 6px para evitar arrastres accidentales
    const sensors = useSensors(
        useSensor(PointerSensor, { activationConstraint: { distance: 6 } })
    );

    // Memoizar lista de ids (pids) para usar en SortableContext; se recalcula solo si `procesos` cambia
    const ids = useMemo(() => procesos.map((p) => p.pid), [procesos]);

    // Handler llamado cuando termina un drag; calcula índices y llama al callback onReorder
    const handleDragEnd = (event: DragEndEvent) => {
        const { active, over } = event; // elemento activo y elemento sobre el que se soltó
        if (!over) return; // si no hay destino, no hacemos nada
        if (active.id === over.id) return; // si se soltó en sí mismo, no hacemos nada

        // localizar índices en el array `procesos` por pid
        const fromIndex = procesos.findIndex(
            (p) => p.pid === String(active.id)
        );
        const toIndex = procesos.findIndex((p) => p.pid === String(over.id));
        if (fromIndex === -1 || toIndex === -1) return; // validación de seguridad
        onReorder?.(fromIndex, toIndex); // invocar callback si existe
    };

    // Estado local que guarda qué PID tiene el menú abierto (control padre de dropdowns)
    const [menuAbierto, setMenuAbierto] = useState<string | null>(null);

    // Tipado de props que recibirá la fila sortable para mayor claridad
    type SRProps = {
        p: Process;
        idx: number;
        menuAbierto: string | null;
        setMenuAbierto: (v: string | null) => void;
        onActualizar: (pid: string, cambios: Partial<Process>) => void;
        onEditar?: (p: Process) => void;
        onEliminar?: (pid: string) => void;
        onSuspender?: (pid: string) => void;
    };

    // Fila memoizada para reducir re-renders innecesarios
    const SortableRow = memo(
        function SortableRow({
            p,
            idx,
            menuAbierto,
            setMenuAbierto,
            onActualizar,
            onEditar,
            onEliminar,
            onSuspender,
        }: SRProps) {
            // useSortable devuelve referencias y transformaciones para el elemento arrastrable
            const { setNodeRef, transform, transition, isDragging } =
                useSortable({ id: p.pid });

            // Estilo inline que aplica la transformación durante el drag
            const style = {
                transform: CSS.Transform.toString(transform),
                transition,
                zIndex: isDragging ? 999 : "auto",
            } as React.CSSProperties;

            // Flag para saber si el proceso está actualmente ejecutando (para resaltar la fila)
            const isExecuting = p.estado === "ejecutando";
            // Flag para saber si el menú de esta fila está abierto (controlado por el padre)
            const isMenuOpen = menuAbierto === p.pid;

            // Helper: muestra número si existe o '-' si es undefined/null
            const showNum = (v: number | undefined | null) =>
                typeof v === "number" ? v : "-";

            // Helper para mostrar solo segundos: '12s' o '-' si no hay valor
            const formatSeconds = (s?: number | null) => {
                if (typeof s === "number") return `${s}s`;
                return "-";
            };

            // JSX de la fila
            return (
                <TableRow
                    ref={setNodeRef as any} // enlace de la fila al dnd-kit
                    style={style} // aplicar transform/transition
                    className={isExecuting ? "bg-blue-50" : ""} // resaltar si está ejecutando
                >
                    {/* Columna: posición en la cola (índice + 1 para humano) */}
                    <TableCell className="w-12">
                        <div className="flex items-center gap-2 mr-10">
                            <span className="text-sm text-muted-foreground select-none">
                                {idx + 1}
                            </span>
                        </div>
                    </TableCell>
                    
                    {/* PID del proceso */}
                    <TableCell>{p.pid}</TableCell>

                    {/* Nombre del proceso */}
                    <TableCell>{p.nombre}</TableCell>

                    {/* Prioridad (o '-' si no existe) */}
                    <TableCell>{showNum(p.prioridad)}</TableCell>

                    {/* Interactividad (etiqueta) */}
                    <TableCell>{p.interactividad ?? "-"}</TableCell>

                    {/* Tiempo total requerido por el proceso */}
                    <TableCell>{showNum(p.tiempo_total)}</TableCell>

                    {/* Tiempo restante por ejecutar */}
                    <TableCell>{showNum(p.tiempo_restante)}</TableCell>

                    {/* Iteración actual (contador de ticks/CPU consumido) */}
                    <TableCell>{showNum(p.iteracion)}</TableCell>
                    
                    {/* Inicio (segundos) — formateado con formatSeconds */}
                    <TableCell>{formatSeconds(p.t_inicio)}</TableCell>
                    
                    {/* Fin (segundos) — formateado con formatSeconds */}
                    <TableCell>{formatSeconds(p.t_fin)}</TableCell>
                    
                    {/* Tiempo de espera (segundos) — formateado con formatSeconds */}
                    <TableCell>{formatSeconds(p.tiempo_espera)}</TableCell>
                    
                    {/* Estado: texto coloreado según tipo */}
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
                    
                    {/* Progreso visual como barra (ancho en %) */}
                    <TableCell className="w-44">
                        <div className="h-2 bg-muted rounded overflow-hidden">
                            <div
                                style={{ width: `${p.progreso ?? 0}%` }}
                                className="h-full bg-primary"
                            />
                        </div>
                    </TableCell>
                    
                    {/* Columna de acciones: menú desplegable */}
                    <TableCell className="w-10">
                        <div className="flex justify-center">
                            <DropdownMenu
                                open={isMenuOpen} // control del estado abierto por el padre
                                onOpenChange={(open) =>
                                    setMenuAbierto(open ? p.pid : null)
                                } // actualizar estado padre al abrir/cerrar
                            >
                                <DropdownMenuTrigger asChild>
                                    <div
                                        // evitar que los eventos del trigger disparen el drag
                                        onPointerDown={(e) => e.stopPropagation()}
                                        onMouseDown={(e) => e.stopPropagation()}
                                        onTouchStart={(e) => e.stopPropagation()}
                                    >
                                        <Button variant="ghost" className="justify-center">
                                            <EllipsisVertical />
                                        </Button>
                                    </div>
                                </DropdownMenuTrigger>

                                {/* Contenido del menú con las acciones disponibles */}
                                <DropdownMenuContent
                                    className="flex flex-col items-start gap-0.5"
                                    onPointerDown={(e) => e.stopPropagation()}
                                >
                                    {/* Marcar como 'listo' — deshabilitado si ya está listo o terminado */}
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
                                        <CheckLine className="mr-2 h-4 w-4" /> Listo
                                    </Button>

                                    {/* Suspender: cambia estado a suspendido y llama onSuspender */}
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
                                            });
                                            onSuspender?.(p.pid);
                                        }}
                                    >
                                        <Pause className="mr-2 h-4 w-4" /> Suspender
                                    </Button>

                                    {/* Finalizar: marca como terminado y completa el progreso */}
                                    <Button
                                        className="w-full justify-start"
                                        variant="ghost"
                                        onClick={() =>
                                            onActualizar(p.pid, {
                                                estado: "terminado",
                                                progreso: 100,
                                                tiempo_restante: 0,
                                                tiempo_cpu: 0,
                                            })
                                        }
                                    >
                                        <XCircle className="mr-2 h-4 w-4" /> Finalizar
                                    </Button>

                                    {/* Reiniciar: devuelve el proceso a su estado inicial listo para volver a ejecutar */}
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
                                            })
                                        }
                                    >
                                        <RotateCcw className="mr-2 h-4 w-4" /> Reiniciar
                                    </Button>

                                    {/* Editar: abre el formulario de edición (callback al padre) */}
                                    <Button
                                        variant="ghost"
                                        className="w-full justify-start"
                                        onClick={() => onEditar?.(p)}
                                    >
                                        <Edit className="mr-2 h-4 w-4" /> Editar
                                    </Button>

                                    {/* Eliminar: elimina el proceso (callback al padre) */}
                                    <Button
                                        variant="destructive"
                                        className="w-full justify-start"
                                        onClick={() => onEliminar?.(p.pid)}
                                    >
                                        <Trash2 className="mr-2 h-4 w-4" /> Eliminar
                                    </Button>
                                </DropdownMenuContent>
                            </DropdownMenu>
                        </div>
                    </TableCell>
                </TableRow>
            );
        },
        // Función de comparación para memo: evita re-render si las props clave no cambiaron
        (prev, next) =>
            prev.p === next.p &&
            prev.idx === next.idx &&
            prev.menuAbierto === next.menuAbierto
    );

    // Render del componente padre: tarjeta que contiene la tabla y el contexto DnD
    return (
        <Card>
            <CardContent>
                <DndContext
                    sensors={sensors} // sensores configurados arriba
                    collisionDetection={closestCenter} // estrategia de colisión para drop
                    onDragEnd={handleDragEnd} // manejar fin de drag
                >
                    <Table>
                        <TableHeader>
                            <TableRow>
                                {/* Cabeceras de la tabla (mismo orden que las celdas de la fila) */}
                                <TableHead>Cola</TableHead>
                                <TableHead>PID</TableHead>
                                <TableHead>Nombre</TableHead>
                                <TableHead>Prioridad</TableHead>
                                <TableHead>Interactividad</TableHead>
                                <TableHead>Tiempo Total</TableHead>
                                <TableHead>Tiempo Restante</TableHead>
                                <TableHead>Iteración</TableHead>
                                <TableHead>Inicio</TableHead>
                                <TableHead>Fin</TableHead>
                                <TableHead>Espera</TableHead>
                                <TableHead>Estado</TableHead>
                                <TableHead>Progreso</TableHead>
                                <TableHead>Acciones</TableHead>
                            </TableRow>
                        </TableHeader>

                        {/* Contexto sortable: lista de ids y estrategia de ordenamiento vertical */}
                        <SortableContext
                            items={ids}
                            strategy={verticalListSortingStrategy}
                        >
                            <TableBody>
                                {/* Renderizar cada proceso como una fila SortableRow memoizada */}
                                {procesos.map((p, idx) => (
                                    <SortableRow
                                        key={p.pid}
                                        p={p}
                                        idx={idx}
                                        menuAbierto={menuAbierto}
                                        setMenuAbierto={setMenuAbierto}
                                        onActualizar={onActualizar}
                                        onEditar={onEditar}
                                        onEliminar={onEliminar}
                                        onSuspender={onSuspender}
                                    />
                                ))}
                            </TableBody>
                        </SortableContext>
                    </Table>
                </DndContext>
            </CardContent>
        </Card>
    );
}
