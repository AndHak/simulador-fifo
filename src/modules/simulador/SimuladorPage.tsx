import { useState, useEffect, useRef } from "react"; // hooks React: estado, efectos y refs
import { useLocation } from "react-router-dom"; // para leer location.state (navegación)
import { Plus, Trash2 } from "lucide-react"; // iconos usados en UI
import {
    Sheet,
    SheetContent,
    SheetTrigger,
} from "@/shared/components/ui/sheet"; // componentes UI: sheet (panel lateral)
import { Button } from "@/shared/components/ui/button"; // componente Button reutilizable
import SimulationProcess from "./SimulationProcess"; // componente que renderiza la lista de procesos
import SystemGraphics from "./SystemGraphics"; // componente que muestra gráficas del sistema
import ProcessForm, { Process } from "./ProcessFrom"; // formulario y tipo Process
import { toast, ToastContainer } from "react-toastify"; // notificaciones tipo toast
import { createToastConfig } from "@/shared/utils/notify"; // helper para configurar ToastContainer
import {
    Tooltip,
    TooltipTrigger,
    TooltipContent,
} from "@/shared/components/ui/tooltip"; // componente tooltip para ayudas en UI

/**
 * SimuladorPage
 *
 * Componente principal del simulador FIFO.
 */
export default function SimuladorPage() {
    const confirmToastIdRef = useRef<string | number | null>(null); // ref para guardar id del toast de confirmación

    const [procesos, setProcesos] = useState<Process[]>(() => { // estado que guarda la lista de procesos
        const saved = localStorage.getItem("procesos_simulador"); // intentar leer persistencia
        if (saved) {
            try {
                return JSON.parse(saved); // parsear JSON guardado
            } catch {
                console.error("Error al parsear procesos guardados"); // log si falla parseo
                return []; // fallback a array vacío
            }
        }
        return []; // si no hay nada guardado devolver array vacío
    });

    const [editing, setEditing] = useState<Process | null>(null); // proceso que se está editando (null si ninguno)
    const [openSheet, setOpenSheet] = useState(false); // controla apertura del Sheet
    const [initialFromMonitor, setInitialFromMonitor] =
        useState<Process | null>(null); // proceso pasado desde monitor para prellenar formulario
    const [running, setRunning] = useState(false); // indica si la simulación está corriendo
    const [theme, setTheme] = useState<"dark" | "light">("light"); // tema para toasts

    const location = useLocation(); // obtener objeto location del router

    useEffect(() => {
        try {
            localStorage.setItem(
                "procesos_simulador",
                JSON.stringify(procesos)
            ); // persistir procesos en localStorage al cambiar
        } catch (err) {
            console.error("Error guardando procesos en localStorage", err); // manejar error de escritura
        }
    }, [procesos]); // efecto depende de `procesos`

    useEffect(() => {
        const state = location.state as { simulatedProcess?: Process } | null; // extraer state de location
        if (state?.simulatedProcess) {
            setInitialFromMonitor(state.simulatedProcess); // guardar proceso inicial para el sheet
            setOpenSheet(true); // abrir sheet si vino un proceso desde el monitor
            window.history.replaceState({}, document.title); // limpiar state de navegación para evitar reabrir al refrescar
        }
    }, [location.state]); // efecto cuando cambia location.state

    useEffect(() => {
        const media = window.matchMedia("(prefers-color-scheme: dark)"); // escuchar preferencia color del sistema
        const handleThemeChange = () =>
            setTheme(media.matches ? "dark" : "light"); // actualizar estado `theme`
        handleThemeChange(); // setear inicialmente
        media.addEventListener("change", handleThemeChange); // agregar listener para cambios
        return () => media.removeEventListener("change", handleThemeChange); // limpiar listener al desmontar
    }, []); // solo se ejecuta al montar

    /**
     * crearProceso
     * - Añade un proceso nuevo a la lista con valores por defecto/seguridad.
     */
    const crearProceso = (bcp: Process) => {
        setProcesos((prev) => {
            if (prev.some((p) => p.pid === bcp.pid)) { // evitar PID duplicado
                toast.error("El PID ya existe. Usa uno diferente.", {
                    toastId: `err-pid-${bcp.pid}`,
                });
                return prev; // no modificar estado
            }

            const initialEstado =
                bcp.estado ?? (running ? "listo" : "inactivo"); // decidir estado inicial según `running`

            const createdAt = bcp.created_at ?? Date.now(); // timestamp de creación (ms) si no viene, generar ahora

            const toAdd: Process = {
                ...bcp, // mantener campos proporcionados
                created_at: createdAt, // asegurar created_at
                t_inicio: bcp.t_inicio ?? null, // inicio (null si no existe)
                t_fin: bcp.t_fin ?? null, // fin (null si no existe)
                tiempo_espera: bcp.tiempo_espera ?? 0, // tiempo de espera por defecto 0
                tiempo_restante: bcp.tiempo_restante ?? bcp.tiempo_total, // si no viene, igual al tiempo_total
                estado: initialEstado, // estado calculado
                resident: bcp.resident ?? true, // por defecto resident true
            };

            const next = [...prev, toAdd]; // añadir al final (FIFO)
            toast.success(`Proceso ${bcp.nombre} agregado correctamente`, {
                toastId: `added-${bcp.pid}`,
            }); // notificar creación
            setOpenSheet(false); // cerrar sheet
            setInitialFromMonitor(null); // limpiar posible initialFromMonitor
            return next; // nuevo estado
        });
    };

    /**
     * actualizarProceso
     * - Actualiza campos parciales de un proceso por pid.
     * - Si se pone en 'ejecutando', asegura que nadie más quede en 'ejecutando'.
     * - Si se pone en 'listo' desde otro estado, lo mueve al final (FIFO).
     */
    const actualizarProceso = (pid: string, cambios: Partial<Process>) => {
        setProcesos((prev) => {
            const idx = prev.findIndex((p) => p.pid === pid); // localizar índice
            if (idx === -1) return prev; // si no existe, no hacer nada
            const prevP = prev[idx]; // proceso previo
            const updated = { ...prevP, ...cambios }; // merge con cambios

            if (cambios.estado === "ejecutando") {
                return prev.map((p) =>
                    p.pid === pid
                        ? updated // actualizar el que se ejecuta
                        : p.estado === "ejecutando"
                        ? { ...p, estado: "listo", tiempo_cpu: 0 } // resetear cualquier otro que estuviera ejecutando
                        : p
                );
            }

            if (cambios.estado === "listo" && prevP.estado !== "listo") {
                return prev.filter((p) => p.pid !== pid).concat(updated); // mover al final
            }

            const copia = [...prev]; // copia del array
            copia[idx] = updated; // reemplazar en su lugar
            setOpenSheet(false); // cerrar sheet si estaba abierto
            return copia; // retornar nuevo estado
        });
    };

    /**
     * eliminarProceso
     * - Elimina por pid y notifica si existía o no.
     */
    const eliminarProceso = (pid: string) => {
        let existed = false; // bandera para saber si existía
        setProcesos((prev) => {
            if (prev.some((x) => x.pid === pid)) existed = true; // marcar si existía
            return prev.filter((x) => x.pid !== pid); // filtrar para eliminar
        });
        if (existed) {
            toast.info(`Proceso ${pid} eliminado`, {
                toastId: `deleted-${pid}`,
            }); // notificar eliminación
        } else {
            toast.warning(`Proceso ${pid} no encontrado`, {
                toastId: `delete-notfound-${pid}`,
            }); // notificar intento de eliminar no existente
        }
    };

    /**
     * reordenarProcesos
     * - Mueve elemento de índice `from` a `to` validando rangos.
     */
    const reordenarProcesos = (from: number, to: number) => {
        setProcesos((prev) => {
            const copia = [...prev]; // copiar array
            if (
                from < 0 ||
                from >= copia.length ||
                to < 0 ||
                to >= copia.length
            )
                return copia; // si índices inválidos, no cambiar
            const [moved] = copia.splice(from, 1); // extraer elemento
            copia.splice(to, 0, moved); // insertarlo en nueva posición
            return copia; // devolver nuevo orden
        });
    };

    /**
     * borrarTodos
     * - Muestra un toast con confirmación para borrar toda la lista.
     */
    const borrarTodos = () => {
        if (!procesos.length) {
            toast.warning("No hay procesos para borrar"); // aviso si lista vacía
            return;
        }

        if (confirmToastIdRef.current !== null) return; // si ya hay confirm abierto, no abrir otro

        const ConfirmContent = () => ( // componente inline para el contenido del toast
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
                            setProcesos([]); // vaciar lista
                            if (confirmToastIdRef.current !== null)
                                toast.dismiss(confirmToastIdRef.current); // cerrar el toast de confirm
                            confirmToastIdRef.current = null; // limpiar ref
                            toast.success(
                                "Todos los procesos han sido eliminados"
                            ); // notificar éxito
                        }}
                    >
                        Borrar
                    </Button>

                    <Button
                        variant="outline"
                        onClick={() => {
                            if (confirmToastIdRef.current !== null)
                                toast.dismiss(confirmToastIdRef.current); // cerrar confirm
                            confirmToastIdRef.current = null; // limpiar ref
                            toast.info("Operación cancelada"); // notificar cancelación
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
        }); // crear toast persistente con el contenido de confirmación

        confirmToastIdRef.current = id; // guardar id del toast para control
    };

    /**
     * handleToggleRunning
     * - Alterna el modo ejecución/detenido y ajusta estados de procesos.
     */
    const handleToggleRunning = () => {
        const next = !running; // valor opuesto
        setRunning(next); // actualizar estado

        if (next) {
            setProcesos((prev) =>
                prev.map((p) =>
                    p.estado !== "terminado" && p.estado !== "suspendido"
                        ? { ...p, estado: "listo" } // arrancando: marcar listos los no terminados/suspendidos
                        : p
                )
            );
        } else {
            setProcesos((prev) =>
                prev.map((p) =>
                    p.estado !== "terminado"
                        ? { ...p, estado: "inactivo", tiempo_cpu: 0 } // detenido: poner inactivo y reset CPU
                        : p
                )
            );
        }
    };

    /**
     * simularPasoQuantum
     * - Ejecuta un tick de simulación FIFO: normaliza estados, encuentra primer listo,
     *   decrementa tiempo_restante en 1 (quantum = 1), actualiza progreso, iteración, inicio/fin/espera.
     */
    const simularPasoQuantum = () => {
    setProcesos((prev) => {
        if (!prev.length) return prev; // si no hay procesos, nada que hacer
        const copia = prev.map((p) => ({ ...p })); // clonar para mutar sin afectar referencias externas

        // Normalizar estados y resetear tiempo_cpu por defecto
        for (let i = 0; i < copia.length; i++) {
            if (
                copia[i].estado !== "terminado" &&
                copia[i].estado !== "suspendido"
            ) {
                copia[i].estado = "listo"; // marcar como listo si no terminado/suspendido
            }
            copia[i].tiempo_cpu = 0; // resetear uso CPU por defecto
        }

        // Encontrar el primer proceso en estado 'listo' (comportamiento FIFO)
        const idx = copia.findIndex((p) => p.estado === "listo");
        if (idx === -1) return copia; // si no hay listos, devolver copia

        const procesoActivo = copia[idx]; // proceso que se va a ejecutar este tick

        // Calcular tiempo de inicio y espera SOLO la primera vez que ejecuta
        let t_inicio = procesoActivo.t_inicio; // leer posible t_inicio existente
        let tiempo_espera = procesoActivo.tiempo_espera ?? 0; // tiempo de espera actual o 0

        if (t_inicio === null || t_inicio === undefined) {
            // Si nunca se ejecutó antes, calcular espera acumulada basada en tiempos totales de procesos anteriores
            let esperaAcumulada = 0;
            for (let i = 0; i < idx; i++) {
                esperaAcumulada += copia[i].tiempo_total; // sumar tiempo_total de los procesos anteriores
            }
            
            tiempo_espera = esperaAcumulada; // tiempo de espera en segundos (entero)
            t_inicio = esperaAcumulada + 1; // inicio relativo en segundos desde el comienzo de la cola
        }

        // Restar 1 unidad (quantum = 1) al tiempo resto del proceso activo
        const tiempo_restante = Math.max(0, procesoActivo.tiempo_restante - 1);

        // Calcular progreso porcentual basado en tiempo_total vs tiempo_restante
        const progreso = Math.round(
            ((procesoActivo.tiempo_total - tiempo_restante) /
                procesoActivo.tiempo_total) *
                100
        );

        const terminado = tiempo_restante === 0; // si el tiempo restante llegó a 0, se terminó

        // Calcular t_fin si terminó: t_inicio + tiempo_total (ambos en segundos)
        let t_fin = procesoActivo.t_fin;
        if (terminado) {
            t_fin = (t_inicio ?? 0) + procesoActivo.tiempo_total;
        }

        // Reemplazar el proceso activo con los nuevos campos actualizados
        copia[idx] = {
            ...procesoActivo,
            tiempo_restante, // nuevo tiempo restante
            progreso, // progreso %
            iteracion: procesoActivo.iteracion + 1, // incrementar contador de iteraciones
            estado: terminado ? "terminado" : "ejecutando", // estado actualizado
            tiempo_cpu: terminado ? 0 : 100, // si no terminó, simular CPU al 100% para UI
            t_inicio, // inicio (segundos) si se fijó ahora
            t_fin, // fin (segundos) si se terminó
            tiempo_espera, // tiempo de espera calculado
        };

        return copia; // devolver nuevo array de procesos actualizado
    });
};

    // Loop de simulación: mientras `running` sea true, llamar a simularPasoQuantum cada 1000ms
    useEffect(() => {
        if (!running) return; // si no está corriendo, no crear intervalo
        const interval = setInterval(() => simularPasoQuantum(), 1000); // tick cada 1s
        return () => clearInterval(interval); // limpiar intervalo al desmontar o cuando running cambie
    }, [running]); // efecto depende de `running`

    // ------------------ RENDER ------------------
    return (
        <main className="p-6 space-y-6 relative">
            <ToastContainer {...createToastConfig(theme)} /> {/* container para toasts con configuración de tema */}

            <div className="flex items-center justify-between">
                <h1 className="text-2xl font-bold">
                    Simulador de Procesos (FIFO)
                </h1>

                <div className="flex gap-2 items-center">
                    <Button
                        variant={running ? "destructive" : "default"} // estilo cambia si está corriendo
                        onClick={handleToggleRunning} // alternar ejecución
                    >
                        {running ? "Detener" : "Iniciar"} {/* texto según estado */}
                    </Button>

                    {/* Sheet para crear proceso */}
                    <Sheet open={openSheet} onOpenChange={setOpenSheet}>
                        <SheetTrigger asChild>
                            <Button>
                                <Plus className="mr-2 h-4 w-4" /> Crear proceso
                            </Button>
                        </SheetTrigger>
                        <SheetContent className="w-[480px]">
                            <ProcessForm
                                initial={initialFromMonitor ?? undefined} // prellenar si viene desde monitor
                                onSave={crearProceso} // callback al guardar
                                onCancel={() => { // cancelar creación
                                    setOpenSheet(false);
                                    setInitialFromMonitor(null);
                                }}
                                existingPids={procesos.map((p) => p.pid)} // pasar PIDs existentes para validación
                            />
                        </SheetContent>
                    </Sheet>

                    {/* Botón borrar todos envuelto en tooltip */}
                    <Tooltip>
                        <TooltipTrigger asChild>
                            <Button
                                onClick={borrarTodos} // abrir confirm
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

            {/* Lista/monitor de procesos con callbacks para editar/suspender/eliminar/actualizar/reordenar */}
            <SimulationProcess
                procesos={procesos}
                onEditar={(p) => setEditing(p)} // abrir edición
                onSuspender={(pid) =>
                    actualizarProceso(pid, {
                        estado: "suspendido",
                        tiempo_cpu: 0,
                        resident: true,
                    })
                } // acción suspender delegada
                onReanudar={(pid) =>
                    actualizarProceso(pid, { estado: "listo" })
                } // reanudar (pasar a listo)
                onEliminar={eliminarProceso} // eliminar delegado
                onActualizar={actualizarProceso} // actualizar delegado
                onReorder={reordenarProcesos} // reordenar delegado
            />

            {/* Gráficas y resumen del sistema */}
            <SystemGraphics procesos={procesos} />

            {/* Sheet de edición si `editing` no es null */}
            {editing && (
                <Sheet open={!!editing} onOpenChange={() => setEditing(null)}>
                    <SheetContent className="w-[480px]">
                        <ProcessForm
                            initial={editing} // pasar proceso a editar
                            onSave={(bcp) => {
                                actualizarProceso(editing.pid, bcp); // guardar cambios
                                setEditing(null); // cerrar sheet
                                toast.success(
                                    `Proceso ${bcp.nombre} actualizado`,
                                    { toastId: `updated-${editing.pid}` }
                                ); // notificar éxito
                            }}
                            onCancel={() => setEditing(null)} // cancelar edición
                            existingPids={procesos.map((p) => p.pid)} // validar PIDs
                        />
                    </SheetContent>
                </Sheet>
            )}
        </main>
    );
}
