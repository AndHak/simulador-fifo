import { useState, useEffect, useRef } from "react";
import { useLocation } from "react-router-dom";
import { DockIcon, Plus, Trash2 } from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetTrigger,
} from "@/shared/components/ui/sheet";
import { Button } from "@/shared/components/ui/button";
import SimulationProcess from "./SimulationProcess";
import SystemGraphics from "./SystemGraphics";
import ProcessForm, { Process } from "./ProcessFrom";
import QuickLaunchBar from "./QuickLaunchBar";
import { toast, ToastContainer } from "react-toastify";
import { createToastConfig } from "@/shared/utils/notify";
import {
  Tooltip,
  TooltipTrigger,
  TooltipContent,
} from "@/shared/components/ui/tooltip";

export default function SimuladorPage() {
  const confirmToastIdRef = useRef<string | number | null>(null);

  const [procesos, setProcesos] = useState<Process[]>(() => {
    const saved = localStorage.getItem("procesos_simulador");
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch {
        console.error("Error al parsear procesos guardados");
        return [];
      }
    }
    return [];
  });

  const [showRegistro, setShowRegistro] = useState(false);
  const [editing, setEditing] = useState<Process | null>(null);
  const [openSheet, setOpenSheet] = useState(false);
  const [initialFromMonitor, setInitialFromMonitor] = useState<Process | null>(null);
  const [running, setRunning] = useState(false);
  const [theme, setTheme] = useState<"dark" | "light">("light");

  const location = useLocation();
  const initialPidSelectionDoneRef = useRef<boolean>(false);

  useEffect(() => {
    try {
      localStorage.setItem("procesos_simulador", JSON.stringify(procesos));
    } catch (err) {
      console.error("Error guardando procesos en localStorage", err);
    }
  }, [procesos]);

  useEffect(() => {
    const state = location.state as { simulatedProcess?: Process } | null;
    if (state?.simulatedProcess) {
      setInitialFromMonitor(state.simulatedProcess);
      setOpenSheet(true);
      window.history.replaceState({}, document.title);
    }
  }, [location.state]);

  useEffect(() => {
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const handleThemeChange = () => setTheme(media.matches ? "dark" : "light");
    handleThemeChange();
    media.addEventListener("change", handleThemeChange);
    return () => media.removeEventListener("change", handleThemeChange);
  }, []);

  // ---------- Helpers ----------
  const compareByPid = (a: Process | { pid: string }, b: Process | { pid: string }) => {
    const na = Number(a.pid);
    const nb = Number(b.pid);
    if (!Number.isNaN(na) && !Number.isNaN(nb)) return na - nb;
    return a.pid.localeCompare(b.pid);
  };

  // ---------- crearProceso ----------
  const crearProceso = (bcp: Process) => {
    setProcesos((prev) => {
      if (prev.some((p) => p.pid === bcp.pid)) {
        toast.error("El PID ya existe. Usa uno diferente.", {
          toastId: `err-pid-${bcp.pid}`,
        });
        return prev;
      }

      const tiempo_total = typeof bcp.tiempo_total === "number" ? bcp.tiempo_total : 0;
      const toAdd: Process = {
        ...bcp,
        created_at: bcp.created_at ?? 0,
        t_inicio: bcp.t_inicio ?? null,
        t_fin: bcp.t_fin ?? null,
        tiempo_espera: bcp.tiempo_espera ?? 0,
        tiempo_restante: typeof bcp.tiempo_restante === "number" ? bcp.tiempo_restante : tiempo_total,
        tiempo_cpu: bcp.tiempo_cpu ?? 0,
        iteracion: bcp.iteracion ?? 0,
        progreso: bcp.progreso ?? 0,
        estado: bcp.estado ?? "listo",
        interactividad: bcp.interactividad,
        interactividad_inicial: bcp.interactividad_inicial ?? bcp.interactividad,
        resident: bcp.resident ?? true,
      };

      toast.success(`Proceso ${bcp.nombre} agregado correctamente`, {
        toastId: `added-${bcp.pid}`,
      });
      setOpenSheet(false);
      setInitialFromMonitor(null);

      return [...prev, toAdd];
    });
  };

  // ---------- handleQuickLaunch ----------
  const handleQuickLaunch = (processConfig: Process) => {
    // Generar PID único
    let newPid = 1;
    const existingPids = new Set(procesos.map(p => Number(p.pid)).filter(n => !isNaN(n)));
    while (existingPids.has(newPid)) {
      newPid++;
    }
    
    const newProcess = {
      ...processConfig,
      pid: String(newPid),
    };
    
    crearProceso(newProcess);
  };

  // ---------- actualizarProceso ----------
  const actualizarProceso = (pid: string, cambios: Partial<Process>) => {
    setProcesos((prev) => {
      const idx = prev.findIndex((p) => p.pid === pid);
      if (idx === -1) return prev;
      const prevP = prev[idx];
      const updated = { ...prevP, ...cambios };

      if (cambios.estado === "ejecutando") {
        // Calcular tiempo actual de simulación
        const tiempoActual = prev.reduce((max, p) => {
          const tiempoProc = (p.iteracion ?? 0) + (p.tiempo_espera ?? 0);
          return Math.max(max, tiempoProc);
        }, 0);
        
        return prev.map((p) =>
          p.pid === pid
            ? { ...updated, estado: "ejecutando", t_inicio: p.t_inicio ?? tiempoActual }
            : p.estado === "ejecutando"
            ? { ...p, estado: "listo", tiempo_cpu: p.tiempo_cpu ?? 0 }
            : p
        );
      }

      if (cambios.estado === "listo" && prevP.estado !== "listo") {
        return prev.filter((p) => p.pid !== pid).concat({ ...updated, estado: "listo" });
      }

      if (cambios.estado === "suspendido") {
        const copia = prev.filter((p) => p.pid !== pid);
        // Al suspender manualmente, reseteamos el contador a su valor inicial
        copia.push({ 
          ...updated, 
          estado: "suspendido", 
          interactividad: prevP.interactividad_inicial ?? prevP.interactividad 
        });
        return copia;
      }

      const copia = [...prev];
      copia[idx] = updated;
      return copia;
    });
    setOpenSheet(false);
  };

  // ---------- reordenarProcesos ----------
  const reordenarProcesos = (from: number, to: number) => {
    setProcesos((prev) => {
      const copia = [...prev];
      if (from < 0 || from >= copia.length || to < 0 || to >= copia.length) return copia;
      const [moved] = copia.splice(from, 1);
      copia.splice(to, 0, moved);
      return copia;
    });
  };

  // ---------- eliminarProceso ----------
  const eliminarProcesoLocal = (pid: string) => {
    let existed = false;
    setProcesos((prev) => {
      if (prev.some((x) => x.pid === pid)) existed = true;
      return prev.filter((x) => x.pid !== pid);
    });
    if (existed) {
      toast.info(`Proceso ${pid} eliminado`, {
        toastId: `deleted-${pid}`,
      });
    } else {
      toast.warning(`Proceso ${pid} no encontrado`, {
        toastId: `delete-notfound-${pid}`,
      });
    }
  };

  // ---------- simularPasoQuantum (VERSIÓN CORREGIDA) ----------
  const simularPasoQuantum = () => {
    setProcesos((prev) => {
      if (!prev.length) return prev;

      let copia = prev.map((p) => ({ ...p }));
      
      // Obtener el tiempo actual de simulación (contar ticks transcurridos)
      const tiempoActual = copia.reduce((max, p) => {
        const tiempoProc = (p.iteracion ?? 0) + (p.tiempo_espera ?? 0);
        return Math.max(max, tiempoProc);
      }, 0);

      // PASO 1: Manejo de Suspendidos (Countdown)
      // Decrementar interactividad de TODOS los suspendidos
      copia = copia.map(p => {
        if (p.estado === "suspendido") {
           // Si ya es 0 o menos, está listo para salir, pero lo movemos abajo
           // Si es mayor a 0, decrementamos
           if (p.interactividad > 0) {
             return { ...p, interactividad: p.interactividad - 1 };
           }
        }
        return p;
      });

      // Mover a Listo los que llegaron a 0
      // Lo hacemos en un loop inverso o filter para manejar indices correctamente si borramos
      // Pero mejor: identificar indices a mover
      const toReadyIndices = copia
        .map((p, i) => ({ p, i }))
        .filter(({ p }) => p.estado === "suspendido" && p.interactividad <= 0)
        .map(({ i }) => i)
        .sort((a, b) => b - a); // Descendente para borrar sin afectar indices previos

      if (toReadyIndices.length > 0) {
        const movedProcesses: Process[] = [];
        toReadyIndices.forEach(idx => {
          const [proc] = copia.splice(idx, 1);
          proc.estado = "listo";
          movedProcesses.push(proc);
        });
        // Agregar al final de la cola
        copia.push(...movedProcesses);
      }

      // PASO 2: Encontrar el proceso ejecutando
      let execIdx = copia.findIndex((p) => p.estado === "ejecutando");

      // PASO 3: Si no hay ejecutando, seleccionar el primer listo (FIFO)
      if (execIdx === -1) {
        if (!initialPidSelectionDoneRef.current) {
          // PRIMER inicio: escoger por PID más bajo
          const readyForFirst = copia.filter((p) => p.estado === "listo");
          if (readyForFirst.length === 0) return copia;
          readyForFirst.sort(compareByPid);
          const pidNext = readyForFirst[0].pid;
          execIdx = copia.findIndex((p) => p.pid === pidNext);
          initialPidSelectionDoneRef.current = true;
        } else {
          // FIFO: primer listo en la cola
          execIdx = copia.findIndex((p) => p.estado === "listo");
          if (execIdx === -1) return copia;
        }

        // Marcar como ejecutando y guardar el tiempo de inicio (en segundos desde el inicio de la simulación)
        if (execIdx !== -1) {
          copia[execIdx] = {
            ...copia[execIdx],
            estado: "ejecutando",
            tiempo_cpu: 0,
            t_inicio: copia[execIdx].t_inicio ?? tiempoActual,
          };
        }
      }

      const proc = execIdx !== -1 ? copia[execIdx] : null;
      if (!proc) return copia;

      // PASO 4: Ejecutar 1 tick (1 segundo)
      proc.tiempo_cpu = (proc.tiempo_cpu ?? 0) + 1;
      // NOTA: Ya no incrementamos iteracion aquí por cada tick
      
      const beforeRemaining = typeof proc.tiempo_restante === "number" ? proc.tiempo_restante : proc.tiempo_total ?? 0;
      proc.tiempo_restante = Math.max(0, beforeRemaining - 1);

      // Actualizar progreso
      if (typeof proc.tiempo_total === "number" && proc.tiempo_total > 0) {
        proc.progreso = Math.round(((proc.tiempo_total - proc.tiempo_restante) / proc.tiempo_total) * 100);
      }

      // PASO 5: Incrementar tiempo_espera de los listos y suspendidos
      copia = copia.map((p, idx) =>
        idx !== execIdx && (p.estado === "listo" || p.estado === "suspendido")
          ? { ...p, tiempo_espera: (p.tiempo_espera ?? 0) + 1 }
          : p
      );

      // Calcular el tiempo actual después de este tick
      const tiempoFinal = tiempoActual + 1;

      let processFinishedOrSuspended = false;

      // PASO 6: Verificar si terminó
      if ((proc.tiempo_restante ?? 0) <= 0) {
        proc.estado = "terminado";
        proc.t_fin = proc.t_fin ?? tiempoFinal;
        proc.tiempo_cpu = 0;
        proc.resident = false;
        // Al terminar, cuenta como completar su última "rotación"
        proc.iteracion = (proc.iteracion ?? 0) + 1;
        processFinishedOrSuspended = true;
      }

      // PASO 7: Verificar si agotó el quantum (si no terminó)
      if (!processFinishedOrSuspended) {
        // Quantum ahora es el número de rotaciones
        // Slice Time = Tiempo Total / Quantum
        const total = proc.tiempo_total ?? 0;
        const rotations = proc.quantum || 1;
        const sliceTime = Math.ceil(total / rotations);

        if ((proc.tiempo_cpu ?? 0) >= sliceTime) {
          // Ejecutando → Suspendido
          proc.estado = "suspendido";
          proc.tiempo_cpu = 0;
          // RESETEAR interactividad al valor inicial
          proc.interactividad = proc.interactividad_inicial ?? 0;
          
          // Incrementar iteración (completó una rotación)
          proc.iteracion = (proc.iteracion ?? 0) + 1;

          // Mover al final de la cola
          copia.splice(execIdx, 1);
          copia.push(proc);
          processFinishedOrSuspended = true;
        }
      }

      // PASO 8: Si el proceso actual dejó de ejecutarse, seleccionar INMEDIATAMENTE el siguiente
      if (processFinishedOrSuspended) {
        // Buscar siguiente listo
        const nextExecIdx = copia.findIndex((p) => p.estado === "listo");
        if (nextExecIdx !== -1) {
           copia[nextExecIdx] = {
            ...copia[nextExecIdx],
            estado: "ejecutando",
            tiempo_cpu: 0,
            t_inicio: copia[nextExecIdx].t_inicio ?? tiempoFinal,
          };
        }
      }

      return copia;
    });
  };

  // ---------- loop de simulación ----------
  useEffect(() => {
    if (!running) return;
    
    // Verificar si todos los procesos terminaron
    const allTerminated = procesos.length > 0 && procesos.every(
      (p) => p.estado === "terminado"
    );
    
    if (allTerminated) {
      setRunning(false);
      toast.success("¡Simulación completada! Todos los procesos han terminado.", {
        toastId: "simulation-completed",
      });
      return;
    }
    
    const interval = setInterval(() => simularPasoQuantum(), 1000);
    return () => clearInterval(interval);
  }, [running, procesos]);

  // ---------- handleToggleRunning ----------
  const handleToggleRunning = () => {
    setRunning((prev) => {
      const next = !prev;
      if (next) {
        setProcesos((prevList) => {
          if (prevList.some((p) => p.estado === "ejecutando")) return prevList;

          const ready = prevList.filter((p) => p.estado === "listo");
          if (ready.length === 0) return prevList;

          if (!initialPidSelectionDoneRef.current) {
            const byPid = [...ready].sort(compareByPid);
            const pidNext = byPid[0].pid;
            initialPidSelectionDoneRef.current = true;
            return prevList.map((p) =>
              p.pid === pidNext ? { ...p, estado: "ejecutando", t_inicio: p.t_inicio ?? 0 } : p
            );
          }

          return prevList;
        });
      }
      return next;
    });
  };

  // ---------- borrarTodos ----------
  const borrarTodos = () => {
    if (!procesos.length) {
      toast.warning("No hay procesos para borrar");
      return;
    }

    if (confirmToastIdRef.current !== null) return;

    const ConfirmContent = () => (
      <div className="max-w-xs">
        <div className="font-semibold mb-2">¿Borrar todos los procesos?</div>
        <div className="text-sm mb-3">Esta acción no se puede deshacer.</div>

        <div className="flex gap-2 justify-end">
          <Button
            variant="destructive"
            onClick={() => {
              setProcesos([]);
              initialPidSelectionDoneRef.current = false;
              if (confirmToastIdRef.current !== null) toast.dismiss(confirmToastIdRef.current);
              confirmToastIdRef.current = null;
              toast.success("Todos los procesos han sido eliminados");
            }}
          >
            Borrar
          </Button>

          <Button
            variant="outline"
            onClick={() => {
              if (confirmToastIdRef.current !== null) toast.dismiss(confirmToastIdRef.current);
              confirmToastIdRef.current = null;
              toast.info("Operación cancelada");
            }}
          >
            Cancelar
          </Button>
        </div>
      </div>
    );

    const id = toast(<ConfirmContent />, {
      autoClose: false,
      closeOnClick: false,
      pauseOnHover: false,
      icon: false,
    });

    confirmToastIdRef.current = id;
  };

  // ---------- RENDER ----------
  return (
    <main className="p-6 space-y-6 relative">
      <ToastContainer {...createToastConfig(theme)} />
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Simulador de Procesos (FIFO)</h1>

        <div className="flex gap-2 items-center">
          <Button
            variant={running ? "destructive" : "default"}
            onClick={handleToggleRunning}
          >
            {running ? "Detener" : "Iniciar"}
          </Button>

          <Sheet open={openSheet} onOpenChange={setOpenSheet}>
            <SheetTrigger asChild>
              <Button>
                <Plus className="mr-2 h-4 w-4" /> Crear proceso
              </Button>
            </SheetTrigger>
            <SheetContent className="w-[480px]">
              <ProcessForm
                initial={initialFromMonitor ?? undefined}
                onSave={crearProceso}
                onCancel={() => {
                  setOpenSheet(false);
                  setInitialFromMonitor(null);
                }}
                existingPids={procesos.map((p) => p.pid)}
              />
            </SheetContent>
          </Sheet>

          <Tooltip>
            <TooltipTrigger asChild>
              <Button onClick={borrarTodos} title="Borrar todos los procesos">
                <Trash2 className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Borrar todos los procesos</TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger asChild>
              <Button onClick={() => setShowRegistro(true)} title="Registro">
                Registro
                <DockIcon className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Ver registro de procesos</TooltipContent>
          </Tooltip>
        </div>
      </div>

      <QuickLaunchBar 
        onLaunch={handleQuickLaunch} 
        existingNames={procesos.map(p => p.nombre)} 
      />

      <SimulationProcess
        procesos={procesos}
        onEditar={(p) => setEditing(p)}
        onSuspender={(pid) =>
          actualizarProceso(pid, {
            estado: "suspendido",
            tiempo_cpu: 0,
            resident: true,
            interactividad: 1,
          })
        }
        onReanudar={(pid) => actualizarProceso(pid, { estado: "listo", interactividad: 2 })}
        onEliminar={eliminarProcesoLocal}
        onActualizar={actualizarProceso}
        onReorder={reordenarProcesos}
        showRegistro={showRegistro}
        onCloseRegistro={() => setShowRegistro(false)}
        onOpenRegistro={() => setShowRegistro(true)}
      />

      <SystemGraphics procesos={procesos} />

      {editing && (
        <Sheet open={!!editing} onOpenChange={() => setEditing(null)}>
          <SheetContent className="w-[480px]">
            <ProcessForm
              initial={editing}
              onSave={(bcp) => {
                actualizarProceso(editing.pid, bcp);
                setEditing(null);
                toast.success(`Proceso ${bcp.nombre} actualizado`, { toastId: `updated-${editing.pid}` });
              }}
              onCancel={() => setEditing(null)}
              existingPids={procesos.map((p) => p.pid)}
            />
          </SheetContent>
        </Sheet>
      )}
    </main>
  );
}