"use client";

import { useState, useRef, useEffect } from "react";
import { Card, CardContent } from "@/shared/components/ui/card";
import {
  Table, TableHeader, TableRow, TableHead, TableBody, TableCell,
} from "@/shared/components/ui/table";
import { Button } from "@/shared/components/ui/button";
import { Progress } from "@/shared/components/ui/progress";
import {
  DropdownMenu, DropdownMenuTrigger, DropdownMenuContent,
} from "@/shared/components/ui/dropdown-menu";
import {
  EllipsisVertical, Play, Pause, Edit, Trash2, XCircle, RotateCcw,
} from "lucide-react";
import { Sheet, SheetContent } from "@/shared/components/ui/sheet";
import ProcessForm, { Process } from "./ProcessFrom";

interface SimulationProcessProps {
  procesos: Process[];
  onEditar?: (p: Process) => void;
  onSuspender?: (pid: string) => void;
  onReanudar?: (pid: string) => void;
  onEliminar?: (pid: string) => void;
  onActualizar: (pid: string, cambios: Partial<Process>) => void;
}

export default function SimulationProcess({
  procesos,
  onActualizar,
  onEditar,
  onEliminar,
  onSuspender,
  onReanudar,
}: SimulationProcessProps) {
  const [editingLocal, setEditingLocal] = useState<Process | null>(null);
  const [runningPid, setRunningPid] = useState<string | null>(null);
  const [pausedPid, setPausedPid] = useState<string | null>(null);
  const intervalRef = useRef<number | null>(null);
  const TICK_MS = 1000;

  const computeCpuForPriority = (priority: number) => {
    const p = Math.max(1, Math.min(10, priority));
    return Math.min(100, Math.round(76 + Math.max(0, 6 - p) * 4));
  };

  useEffect(() => {
    return () => {
      if (intervalRef.current !== null) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, []);

  const findProceso = (pid: string) => procesos.find((p) => p.pid === pid) ?? null;

  const startProcess = (pid: string) => {
    if (runningPid && runningPid !== pid) return;
    const p = findProceso(pid);
    if (!p || p.estado === "terminado") return;

    const cpuPercent = computeCpuForPriority(p.prioridad);
    procesos.forEach((x) => {
      if (x.pid === pid) onActualizar(x.pid, { estado: "ejecutando", tiempo_cpu: cpuPercent });
      else onActualizar(x.pid, { tiempo_cpu: 0 });
    });

    setRunningPid(pid);
    setPausedPid((prev) => (prev === pid ? null : prev));

    let remaining = Math.max(0, Math.round(p.tiempo_restante ?? p.tiempo_total));

    if (intervalRef.current !== null) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }

    intervalRef.current = window.setInterval(() => {
      const fresh = findProceso(pid);
      remaining = fresh ? Math.max(0, Math.round(fresh.tiempo_restante)) : remaining;
      remaining = Math.max(0, remaining - 1);

      const progreso = fresh && fresh.tiempo_total > 0
        ? Math.round(((fresh.tiempo_total - remaining) / fresh.tiempo_total) * 100)
        : 0;

      onActualizar(pid, { tiempo_restante: remaining, progreso });

      if (remaining <= 0) {
        if (intervalRef.current !== null) {
          clearInterval(intervalRef.current);
          intervalRef.current = null;
        }
        onActualizar(pid, { estado: "terminado", progreso: 100, tiempo_restante: 0, tiempo_cpu: 0 });
        setRunningPid(null);
        setPausedPid(null);

        const next = procesos.find((q) => q.pid !== pid && q.estado === "listo");
        if (next) setTimeout(() => startProcess(next.pid), 200);
      }
    }, TICK_MS);
  };

  const suspendProcess = (pid: string) => {
    if (runningPid === pid) {
      if (intervalRef.current !== null) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      setRunningPid(null);
      setPausedPid(pid);
      onActualizar(pid, { estado: "suspendido", tiempo_cpu: 0 });
      onSuspender?.(pid);

      const next = procesos.find((q) => q.pid !== pid && q.estado === "listo");
      if (next) setTimeout(() => startProcess(next.pid), 200);
      return;
    }
    onActualizar(pid, { estado: "suspendido", tiempo_cpu: 0 });
    onSuspender?.(pid);
  };

  const resumeProcess = (pid: string) => {
    const p = findProceso(pid);
    if (!p || p.estado !== "suspendido") return;
    onReanudar?.(pid);
    startProcess(pid);
  };

  const finishProcess = (pid: string) => {
    if (runningPid === pid && intervalRef.current !== null) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    setRunningPid(null);
    setPausedPid(null);
    onActualizar(pid, { estado: "terminado", progreso: 100, tiempo_restante: 0, tiempo_cpu: 0 });

    const next = procesos.find((q) => q.estado === "listo" && q.pid !== pid);
    if (next) setTimeout(() => startProcess(next.pid), 200);
  };

  return (
    <Card>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
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
          <TableBody>
            {procesos.map((p) => {
              const isRunning = runningPid === p.pid;
              const isPaused = pausedPid === p.pid;
              const canStart = !runningPid && p.estado !== "terminado";
              const startLabel = isPaused ? "Reanudar proceso" : "Iniciar proceso";

              return (
                <TableRow key={p.pid} className={isRunning ? "bg-blue-50" : ""}>
                  <TableCell>{p.pid}</TableCell>
                  <TableCell>{p.nombre}</TableCell>
                  <TableCell>{p.prioridad}</TableCell>
                  <TableCell>{p.tiempo_total}</TableCell>
                  <TableCell>{p.tiempo_restante}</TableCell>
                  <TableCell>
                    <span className={
                      p.estado === "terminado" ? "text-green-600"
                        : p.estado === "suspendido" ? "text-yellow-600"
                        : p.estado === "ejecutando" ? "text-blue-600"
                        : "text-muted-foreground"
                    }>{p.estado}</span>
                  </TableCell>
                  <TableCell className="w-44"><Progress value={p.progreso} /></TableCell>
                  <TableCell className="w-10">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" className="justify-center"><EllipsisVertical /></Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent className="flex flex-col items-start">
                        <Button variant="ghost" disabled={!canStart && !isPaused} onClick={() => { if (isPaused) resumeProcess(p.pid); else startProcess(p.pid); }}>
                          <Play className="mr-2 h-4 w-4" /> {startLabel}
                        </Button>
                        <Button variant="ghost" disabled={!isRunning} onClick={() => suspendProcess(p.pid)}>
                          <Pause className="mr-2 h-4 w-4" /> Suspender
                        </Button>
                        <Button variant="ghost" disabled={!isPaused} onClick={() => resumeProcess(p.pid)}>
                          <RotateCcw className="mr-2 h-4 w-4" /> Reanudar
                        </Button>
                        <Button variant="ghost" onClick={() => finishProcess(p.pid)}>
                          <XCircle className="mr-2 h-4 w-4" /> Finalizar
                        </Button>
                        <Button variant="ghost" onClick={() => { setEditingLocal(p); onEditar?.(p); }}>
                          <Edit className="mr-2 h-4 w-4" /> Editar
                        </Button>
                        <Button variant="ghost" onClick={() => onEliminar?.(p.pid)}>
                          <Trash2 className="mr-2 h-4 w-4" /> Eliminar
                        </Button>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </CardContent>

      {editingLocal && (
        <Sheet open onOpenChange={() => setEditingLocal(null)}>
          <SheetContent className="w-[480px]">
            <ProcessForm
              initial={editingLocal}
              onSave={(bcp) => { onActualizar(editingLocal.pid, bcp); setEditingLocal(null); }}
              onCancel={() => setEditingLocal(null)}
            />
          </SheetContent>
        </Sheet>
      )}
    </Card>
  );
}
