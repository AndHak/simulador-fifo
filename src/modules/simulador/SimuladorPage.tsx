import { useState, useEffect, useRef } from "react";
import { useLocation } from "react-router-dom";
import {  Plus, Trash2 } from "lucide-react";
import {
    Sheet,
    SheetContent,
    SheetTrigger,
} from "@/shared/components/ui/sheet";
import { Button } from "@/shared/components/ui/button";
import SimulationProcess from "./SimulationProcess";
import SystemGraphics from "./SystemGraphics";
import ProcessForm, { Process } from "./ProcessFrom";
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

    const [editing, setEditing] = useState<Process | null>(null);
    const [openSheet, setOpenSheet] = useState(false);
    const [initialFromMonitor, setInitialFromMonitor] =
        useState<Process | null>(null);
    const [running, setRunning] = useState(false);
    const [theme, setTheme] = useState<"dark" | "light">("light");

    const location = useLocation();

    useEffect(() => {
        try {
            localStorage.setItem(
                "procesos_simulador",
                JSON.stringify(procesos)
            );
        } catch (err) {
            console.error("Error guardando procesos en localStorage", err);
        }
    }, [procesos]);

    useEffect(() => {
        const state = location.state as { simulatedProcess?: Process } | null;
        if (state?.simulatedProcess) {
            setInitialFromMonitor(state.simulatedProcess);
            setOpenSheet(true);
            // Limpiar el state de navegación para evitar reabrir el Sheet al refrescar
            window.history.replaceState({}, document.title);
        }
    }, [location.state]);

    useEffect(() => {
        const media = window.matchMedia("(prefers-color-scheme: dark)");
        const handleThemeChange = () =>
            setTheme(media.matches ? "dark" : "light");
        handleThemeChange();
        media.addEventListener("change", handleThemeChange);
        return () => media.removeEventListener("change", handleThemeChange);
    }, []);

    const crearProceso = (bcp: Process) => {
        setProcesos((prev) => {
            if (prev.some((p) => p.pid === bcp.pid)) {
                toast.error("El PID ya existe. Usa uno diferente.", {
                    toastId: `err-pid-${bcp.pid}`,
                });
                return prev;
            }
            // si el simulador está detenido, empezar como 'inactivo'
            const initialEstado =
                bcp.estado ?? (running ? "listo" : "inactivo");
            const toAdd = {
                ...bcp,
                tiempo_restante: bcp.tiempo_restante ?? bcp.tiempo_total,
                estado: initialEstado,
                resident: bcp.resident ?? true,
            };
            const next = [...prev, toAdd];
            toast.success(`Proceso ${bcp.nombre} agregado correctamente`, {
                toastId: `added-${bcp.pid}`,
            });
            setOpenSheet(false);
            setInitialFromMonitor(null);
            return next;
        });
    };

    // actualizarProceso, se cambia al final si se modifica el estado a listo
    const actualizarProceso = (pid: string, cambios: Partial<Process>) => {
        setProcesos((prev) => {
            const idx = prev.findIndex((p) => p.pid === pid);
            if (idx === -1) return prev;
            const prevP = prev[idx];
            const updated = { ...prevP, ...cambios };

            if (cambios.estado === "listo" && prevP.estado !== "listo") {
                // remover y añadir al final
                return prev.filter((p) => p.pid !== pid).concat(updated);
            }

            const copia = [...prev];
            copia[idx] = updated;
            setOpenSheet(false);
            return copia;
        });
    };

    const eliminarProceso = (pid: string) => {
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

    const reordenarProcesos = (from: number, to: number) => {
        setProcesos((prev) => {
            const copia = [...prev];
            if (
                from < 0 ||
                from >= copia.length ||
                to < 0 ||
                to >= copia.length
            )
                return copia;
            const [moved] = copia.splice(from, 1);
            copia.splice(to, 0, moved);
            return copia;
        });
    };

    const borrarTodos = () => {
        if (!procesos.length) {
            toast.warning("No hay procesos para borrar");
            return;
        }

        if (confirmToastIdRef.current !== null) return;

        const ConfirmContent = () => (
            <div className="max-w-xs">
                <div className="font-semibold mb-2">
                    ¿Borrar todos los procesos?
                </div>
                <div className="text-sm mb-3">
                    Esta acción no se puede deshacer.
                </div>

                <div className="flex gap-2 justify-end">
                    <Button
                        variant="destructive"
                        onClick={() => {
                            setProcesos([]);
                            if (confirmToastIdRef.current !== null)
                                toast.dismiss(confirmToastIdRef.current);
                            confirmToastIdRef.current = null;
                            toast.success(
                                "Todos los procesos han sido eliminados"
                            );
                        }}
                    >
                        Borrar
                    </Button>

                    <Button
                        variant="outline"
                        onClick={() => {
                            if (confirmToastIdRef.current !== null)
                                toast.dismiss(confirmToastIdRef.current);
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


    // los procesos no terminados y no suspendidos pasan a 'listo'
    // todos los procesos no terminados pasan a 'inactivo'
    const handleToggleRunning = () => {
        const next = !running;
        setRunning(next);

        if (next) {
            // arrancando: marcar listos los que puedan ejecutarse
            setProcesos((prev) =>
                prev.map((p) =>
                    p.estado !== "terminado" && p.estado !== "suspendido"
                        ? { ...p, estado: "listo" }
                        : p
                )
            );
        } else {
            // detenido: todos (no terminados) en 'inactivo' 
            setProcesos((prev) =>
                prev.map((p) =>
                    p.estado !== "terminado"
                        ? { ...p, estado: "inactivo", tiempo_cpu: 0 }
                        : p
                )
            );
        }
    };

    const simularPasoQuantum = () => {
        setProcesos((prev) => {
            if (!prev.length) return prev;
            const copia = prev.map((p) => ({ ...p }));

            for (let i = 0; i < copia.length; i++) {
                if (
                    copia[i].estado !== "terminado" &&
                    copia[i].estado !== "suspendido"
                ) {
                    copia[i].estado = "listo";
                }
                // Normalizar CPU: solo el activo tendrá >0
                copia[i].tiempo_cpu = 0;
            }

            const idx = copia.findIndex((p) => p.estado === "listo");
            if (idx === -1) return copia;

            const procesoActivo = copia[idx];
            const slice = Math.min(
                procesoActivo.quantum,
                procesoActivo.tiempo_restante
            );
            const tiempo_restante = Math.max(
                0,
                procesoActivo.tiempo_restante - slice
            );
            const progreso = Math.round(
                ((procesoActivo.tiempo_total - tiempo_restante) /
                    procesoActivo.tiempo_total) *
                    100
            );
            const terminado = tiempo_restante === 0;

            copia[idx] = {
                ...procesoActivo,
                tiempo_restante,
                progreso,
                iteracion: procesoActivo.iteracion + 1,
                estado: terminado ? "terminado" : "ejecutando",
                tiempo_cpu: terminado ? 0 : 100,
            };

            return copia;
        });
    };

    useEffect(() => {
        if (!running) return;
        const interval = setInterval(() => simularPasoQuantum(), 1000);
        return () => clearInterval(interval);
    }, [running]);

    return (
        <main className="p-6 space-y-6 relative">
            <ToastContainer {...createToastConfig(theme)} />

            <div className="flex items-center justify-between">
                <h1 className="text-2xl font-bold">
                    Simulador de Procesos (FIFO)
                </h1>

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
                            />
                        </SheetContent>
                    </Sheet>
                    <Tooltip>
                        <TooltipTrigger asChild>
                            <Button
                                onClick={borrarTodos}
                                title="Borrar todos los procesos"
                            >
                                <Trash2 className="h-4 w-4" />
                            </Button>
                        </TooltipTrigger>
                        <TooltipContent>
                            Borrar todos los procesos
                        </TooltipContent>
                    </Tooltip>
                </div>
            </div>

            <SimulationProcess
                procesos={procesos}
                onEditar={(p) => setEditing(p)}
                onSuspender={(pid) =>
                    actualizarProceso(pid, {
                        estado: "suspendido",
                        tiempo_cpu: 0,
                        resident: true,
                    })
                }
                onReanudar={(pid) =>
                    actualizarProceso(pid, { estado: "listo" })
                }
                onEliminar={eliminarProceso}
                onActualizar={actualizarProceso}
                onReorder={reordenarProcesos}
            />

            <SystemGraphics procesos={procesos} />

            {/* Edición */}
            {editing && (
                <Sheet open={!!editing} onOpenChange={() => setEditing(null)}>
                    <SheetContent className="w-[480px]">
                        <ProcessForm
                            initial={editing}
                            onSave={(bcp) => {
                                actualizarProceso(editing.pid, bcp);
                                setEditing(null);
                                toast.success(
                                    `Proceso ${bcp.nombre} actualizado`,
                                    { toastId: `updated-${editing.pid}` }
                                );
                            }}
                            onCancel={() => setEditing(null)}
                        />
                    </SheetContent>
                </Sheet>
            )}
        </main>
    );
}
