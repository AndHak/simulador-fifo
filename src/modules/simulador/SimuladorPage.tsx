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

  const [registro, setRegistro] = useState<Process[]>(() => {
    const saved = localStorage.getItem("registro_simulador");
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch {
        console.error("Error al parsear registro guardado");
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

  useEffect(() => {
    try {
      localStorage.setItem("procesos_simulador", JSON.stringify(procesos));
    } catch (err) {
      console.error("Error guardando procesos en localStorage", err);
    }
  }, [procesos]);

  useEffect(() => {
    try {
      localStorage.setItem("registro_simulador", JSON.stringify(registro));
    } catch (err) {
      console.error("Error guardando registro en localStorage", err);
    }
  }, [registro]);

  // Mover procesos terminados al registro
  useEffect(() => {
    const terminados = procesos.filter((p) => p.estado === "terminado");
    if (terminados.length > 0) {
      setRegistro((prev) => [...prev, ...terminados]);
      setProcesos((prev) => prev.filter((p) => p.estado !== "terminado"));
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

      setOpenSheet(false);
      setInitialFromMonitor(null);

      return [...prev, toAdd];
    });
  };

  // ---------- handleQuickLaunch ----------
  const handleQuickLaunch = (processConfig: Process) => {
    crearProceso(processConfig);
  };

  // ---------- actualizarProceso ----------
  const actualizarProceso = (pid: string, cambios: Partial<Process>) => {
    setProcesos((prev) => {
      const idx = prev.findIndex((p) => p.pid === pid);
      if (idx === -1) return prev;
      const prevP = prev[idx];
      const updated = { ...prevP, ...cambios };

      if (cambios.estado === "ejecutando") {
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
    if (confirmToastIdRef.current !== null) return;

    const ConfirmDelete = () => (
      <div className="max-w-xs">
        <div className="font-semibold mb-2">¿Eliminar proceso {pid}?</div>
        <div className="flex gap-2 justify-end">
          <Button
            variant="destructive"
            size="sm"
            onClick={() => {
              setProcesos((prev) => prev.filter((x) => x.pid !== pid));
              if (confirmToastIdRef.current !== null) toast.dismiss(confirmToastIdRef.current);
              confirmToastIdRef.current = null;
              toast.info(`Proceso ${pid} eliminado`, { toastId: `deleted-${pid}` });
            }}
          >
            Eliminar
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              if (confirmToastIdRef.current !== null) toast.dismiss(confirmToastIdRef.current);
              confirmToastIdRef.current = null;
            }}
          >
            Cancelar
          </Button>
        </div>
      </div>
    );

    const id = toast(<ConfirmDelete />, {
      autoClose: false,
      closeOnClick: false,
      pauseOnHover: false,
      icon: false,
    });
    confirmToastIdRef.current = id;
  };

  // ---------- simularPasoQuantum ----------
  const simularPasoQuantum = () => {
    setProcesos((prev) => {
      if (!prev.length) return prev;

      let copia = prev.map((p) => ({ ...p }));
      
      const tiempoActual = copia.reduce((max, p) => {
        const tiempoProc = (p.iteracion ?? 0) + (p.tiempo_espera ?? 0);
        return Math.max(max, tiempoProc);
      }, 0);

      // PASO 1: Suspendidos
      copia = copia.map(p => {
        if (p.estado === "suspendido") {
           if (p.interactividad > 0) {
             return { ...p, interactividad: p.interactividad - 1 };
           }
        }
        return p;
      });

      const toReadyIndices = copia
        .map((p, i) => ({ p, i }))
        .filter(({ p }) => p.estado === "suspendido" && p.interactividad <= 0)
        .map(({ i }) => i)
        .sort((a, b) => b - a);

      if (toReadyIndices.length > 0) {
        const movedProcesses: Process[] = [];
        toReadyIndices.forEach(idx => {
          const [proc] = copia.splice(idx, 1);
          proc.estado = "listo";
          movedProcesses.push(proc);
        });
        copia.push(...movedProcesses);
      }

      // PASO 2: Ejecutando
      let execIdx = copia.findIndex((p) => p.estado === "ejecutando");

      // PASO 3: FIFO si no hay ejecutando
      if (execIdx === -1) {
        execIdx = copia.findIndex((p) => p.estado === "listo");
        if (execIdx === -1) return copia;

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

      // PASO 4: Ejecutar
      proc.tiempo_cpu = (proc.tiempo_cpu ?? 0) + 1;
      
      const beforeRemaining = typeof proc.tiempo_restante === "number" ? proc.tiempo_restante : proc.tiempo_total ?? 0;
      proc.tiempo_restante = Math.max(0, beforeRemaining - 1);

      if (typeof proc.tiempo_total === "number" && proc.tiempo_total > 0) {
        proc.progreso = Math.round(((proc.tiempo_total - proc.tiempo_restante) / proc.tiempo_total) * 100);
      }

      // PASO 5: Tiempo espera
      copia = copia.map((p, idx) =>
        idx !== execIdx && (p.estado === "listo" || p.estado === "suspendido")
          ? { ...p, tiempo_espera: (p.tiempo_espera ?? 0) + 1 }
          : p
      );

      const tiempoFinal = tiempoActual + 1;
      let processFinishedOrSuspended = false;

      // PASO 6: Terminado
      if ((proc.tiempo_restante ?? 0) <= 0) {
        proc.estado = "terminado";
        proc.t_fin = proc.t_fin ?? tiempoFinal;
        proc.tiempo_cpu = 0;
        proc.resident = false;
        proc.iteracion = (proc.iteracion ?? 0) + 1;
        processFinishedOrSuspended = true;
      }

      // PASO 7: Quantum
      if (!processFinishedOrSuspended) {
        const total = proc.tiempo_total ?? 0;
        const rotations = proc.quantum || 1;
        const sliceTime = Math.ceil(total / rotations);

        if ((proc.tiempo_cpu ?? 0) >= sliceTime) {
          proc.estado = "suspendido";
          proc.tiempo_cpu = 0;
          proc.interactividad = proc.interactividad_inicial ?? 0;
          proc.iteracion = (proc.iteracion ?? 0) + 1;

          copia.splice(execIdx, 1);
          copia.push(proc);
          processFinishedOrSuspended = true;
        }
      }

      // PASO 8: Siguiente
      if (processFinishedOrSuspended) {
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

  // ---------- loop ----------
  useEffect(() => {
    if (!running) return;
    
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

          // ORDENAR por PID ascendente al iniciar
          const sorted = [...prevList].sort(compareByPid);
          
          // Encontrar el primero que esté listo en la lista ordenada
          const firstReadyIdx = sorted.findIndex(p => p.estado === "listo");
          
          if (firstReadyIdx !== -1) {
             return sorted.map((p, idx) => 
               idx === firstReadyIdx ? { ...p, estado: "ejecutando", t_inicio: p.t_inicio ?? 0 } : p
             );
          }

          return sorted;
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

  // ---------- handleReiniciar ----------
  const handleReiniciar = (p: Process) => {
    const newProcess: Process = {
      ...p,
      estado: "listo",
      tiempo_cpu: 0,
      tiempo_restante: p.tiempo_total,
      progreso: 0,
      iteracion: 0,
      t_inicio: null,
      t_fin: null,
      tiempo_espera: 0,
      interactividad: p.interactividad_inicial ?? p.interactividad,
      resident: true,
    };
    crearProceso(newProcess);
  };

  // ---------- handleLimpiarRegistro ----------
  const handleLimpiarRegistro = () => {
    setRegistro([]);
    toast.success("Registro limpiado correctamente");
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
        registro={registro}
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
        onReiniciar={handleReiniciar}
        onLimpiarRegistro={handleLimpiarRegistro}
        showRegistro={showRegistro}
        onCloseRegistro={() => setShowRegistro(false)}
      />

      <SystemGraphics procesos={procesos} registro={registro} />

      {editing && (
        <Sheet open={!!editing} onOpenChange={() => setEditing(null)}>
          <SheetContent className="w-[480px]">
            <ProcessForm
              initial={editing}
              onSave={(bcp) => {
                actualizarProceso(editing.pid, bcp);
                setEditing(null);
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