import React, { useMemo, useState, memo } from "react";
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
  GripVertical,
} from "lucide-react";
import { Process } from "./ProcessFrom";

import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

interface SimulationProcessProps {
  procesos: Process[];
  onEditar?: (p: Process) => void;
  onSuspender?: (pid: string) => void;
  onReanudar?: (pid: string) => void;
  onEliminar?: (pid: string) => void;
  onActualizar: (pid: string, cambios: Partial<Process>) => void;
  onReorder?: (from: number, to: number) => void;
}

export default function SimulationProcess({
  procesos,
  onActualizar,
  onEditar,
  onEliminar,
  onSuspender,
  onReorder,
}: SimulationProcessProps) {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } })
  );

  const ids = useMemo(() => procesos.map((p) => p.pid), [procesos]);

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over) return;
    if (active.id === over.id) return;

    const fromIndex = procesos.findIndex((p) => p.pid === String(active.id));
    const toIndex = procesos.findIndex((p) => p.pid === String(over.id));
    if (fromIndex === -1 || toIndex === -1) return;
    onReorder?.(fromIndex, toIndex);
  };

  // Estado que controla qué PID tiene el menú abierto (padre)
  const [menuAbierto, setMenuAbierto] = useState<string | null>(null);

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

  // Fila memoizada para reducir re-renders
  const SortableRow = memo(function SortableRow({
    p,
    idx,
    menuAbierto,
    setMenuAbierto,
    onActualizar,
    onEditar,
    onEliminar,
    onSuspender,
  }: SRProps) {
    const {
      attributes,
      listeners,
      setNodeRef,
      transform,
      transition,
      isDragging,
    } = useSortable({ id: p.pid });

    const style = {
      transform: CSS.Transform.toString(transform),
      transition,
      zIndex: isDragging ? 999 : "auto",
    } as React.CSSProperties;

    const isExecuting = p.estado === "ejecutando";
    const isMenuOpen = menuAbierto === p.pid;

    return (
      <TableRow
        ref={setNodeRef as any}
        style={style}
        className={isExecuting ? "bg-blue-50" : ""}
      >
        <TableCell className="w-12">
          <div className="flex items-center gap-2 mr-10">
            <Button
              variant="ghost"
              size="icon"
              // solo permite arrastrar si el menú no está abierto, asi no colapsa el dropdown
              {...attributes}
              {...(!isMenuOpen ? listeners : {})}
              className="p-1 h-6 w-6 flex items-center justify-center cursor-grab"
              aria-label={`Mover proceso ${p.pid}`}
            >
              <GripVertical className="h-4 w-4" />
            </Button>
            <span className="text-sm text-muted-foreground select-none">
              {idx + 1}
            </span>
          </div>
        </TableCell>

        <TableCell>{p.pid}</TableCell>
        <TableCell>{p.nombre}</TableCell>
        <TableCell>{p.prioridad}</TableCell>
        <TableCell>{p.tiempo_total}</TableCell>
        <TableCell>{p.tiempo_restante}</TableCell>
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

        <TableCell className="w-44">
          <div className="h-2 bg-muted rounded overflow-hidden">
            <div
              style={{ width: `${p.progreso ?? 0}%` }}
              className="h-full bg-primary"
            />
          </div>
        </TableCell>

        <TableCell className="w-10">
          <div className="flex justify-center">
            {/* Dropdown controlado por el padre */}
            <DropdownMenu
              open={isMenuOpen}
              onOpenChange={(open) => setMenuAbierto(open ? p.pid : null)}
            >
              <DropdownMenuTrigger asChild>
                <div
                  onPointerDown={(e) => e.stopPropagation()}
                  onMouseDown={(e) => e.stopPropagation()}
                  onTouchStart={(e) => e.stopPropagation()}
                >
                  <Button variant="ghost" className="justify-center">
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
                  disabled={p.estado === "listo" || p.estado === "terminado"}
                  onClick={() => onActualizar(p.pid, { estado: "listo" })}
                >
                  <CheckLine className="mr-2 h-4 w-4" /> Listo
                </Button>

                <Button
                  variant="ghost"
                  className="w-full justify-start"
                  disabled={p.estado === "suspendido" || p.estado === "terminado"}
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
                    })
                  }
                >
                  <RotateCcw className="mr-2 h-4 w-4" /> Reiniciar
                </Button>

                <Button variant="ghost" className="w-full justify-start" onClick={() => onEditar?.(p)}>
                  <Edit className="mr-2 h-4 w-4" /> Editar
                </Button>

                <Button variant="destructive" className="w-full justify-start" onClick={() => onEliminar?.(p.pid)}>
                  <Trash2 className="mr-2 h-4 w-4" /> Eliminar
                </Button>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </TableCell>
      </TableRow>
    );
  },
  // comparator: si las referencias del proceso no cambian, evita re-render.
  // no se puede evitar el re render de kit, resolver este problema en el futuro, es una asimilacion al problema k
  (prev, next) => prev.p === next.p && prev.idx === next.idx && prev.menuAbierto === next.menuAbierto
  );

  return (
    <Card>
      <CardContent>
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={handleDragEnd}
        >
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Cola</TableHead>
                <TableHead>PID</TableHead>
                <TableHead>Nombre</TableHead>
                <TableHead>Prioridad</TableHead>
                <TableHead>Tiempo Total</TableHead>
                <TableHead>Tiempo Restante</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead>Progreso</TableHead>
                <TableHead>Acciones</TableHead>
              </TableRow>
            </TableHeader>

            <SortableContext items={ids} strategy={verticalListSortingStrategy}>
              <TableBody>
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
