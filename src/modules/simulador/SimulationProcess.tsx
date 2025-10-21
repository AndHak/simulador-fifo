import { useEffect, useMemo, useState } from "react";
import { useLocation } from "react-router-dom";
import { useProcessContext, Proceso } from "@/shared/context/ProcessContext";

import { Button } from "@/shared/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/shared/components/ui/tooltip";
import { Label } from "@/shared/components/ui/label";
import { Input } from "@/shared/components/ui/input";
import SystemMetrics from "./SystemGraphics";

const estadosFIFO = ["Corriendo", "Suspendido", "Apagado"] as const;

export default function SimulationProcess() {
  const { state } = useLocation();
  const selected: Proceso | undefined = state?.proceso;
  const { procesosSimulados, actualizarProcesoSimulado } = useProcessContext();

  // si venimos por navegación, preferimos el proceso en contexto si ya existe (persistencia)
  const procesoContext = useMemo(
    () => procesosSimulados.find(p => p.pid === selected?.pid) ?? selected,
    [procesosSimulados, selected]
  );

  const [form, setForm] = useState<Partial<Proceso> | null>(() => (procesoContext ? { ...procesoContext } : null));

  useEffect(() => {
    setForm(procesoContext ? { ...procesoContext } : null);
  }, [procesoContext]);

  if (!form) return <div className="p-6">No se seleccionó ningún proceso para simular.</div>;

  // Proyección heurística: si subes prioridad, aumentas "share" de CPU; si bajas, lo reduces.
  // Esto es solo visual: no afecta procesos reales.
  const proyectedMetrics = (realCpu: number) => {
    const base = realCpu || 10;
    const prioridadActual = procesoContext?.prioridad ?? 1;
    const prioridadNueva = form.prioridad ?? prioridadActual;
    const delta = (prioridadNueva - prioridadActual);
    // heurística: cada punto de prioridad => +4% CPU relative
    const factor = 1 + delta * 0.04;
    return Math.max(0, Math.min(100, base * factor));
  };

  // handler apply changes
  const aplicarCambios = () => {
    if (!form || !form.pid) return;
    actualizarProcesoSimulado(form.pid, {
      prioridad: Number(form.prioridad ?? 0),
      quantum: Number(form.quantum ?? 200),
      rafaga: Number(form.rafaga ?? form.tiempo_cpu ?? 0),
      estado: String(form.estado ?? procesoContext?.estado ?? "Corriendo"),
      tiempo_cpu: Number(form.tiempo_cpu ?? procesoContext?.tiempo_cpu ?? 0),
    });
  };

  return (
    <div className="p-6 grid gap-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Simulación — {form.nombre}</h1>
        <div className="space-x-2">
          <Button onClick={() => { actualizarProcesoSimulado(form.pid!, { estado: "Corriendo" }); }}>▶ Corriendo</Button>
          <Button onClick={() => { actualizarProcesoSimulado(form.pid!, { estado: "Suspendido" }); }}>⏸ Suspendido</Button>
          <Button onClick={() => { actualizarProcesoSimulado(form.pid!, { estado: "Apagado" }); }}>⏹ Apagado</Button>
        </div>
      </div>

      <div className="grid md:grid-cols-3 gap-4">
        <div className="col-span-2 space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>PID</Label>
              <Input value={form.pid} readOnly />
            </div>
            <div>
              <Label>Nombre</Label>
              <Input value={form.nombre} readOnly />
            </div>

            <div>
              <Label>Prioridad</Label>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Input
                    type="number"
                    value={form.prioridad}
                    onChange={(e: any) => setForm({ ...form, prioridad: Number(e.target.value) })}
                  />
                </TooltipTrigger>
                <TooltipContent>
                  <p>En FIFO la prioridad es informativa — aquí la usamos para simular cambio en share de CPU.</p>
                </TooltipContent>
              </Tooltip>
            </div>

            <div>
              <Label>Estado</Label>
              <select
                className="w-full p-2 border rounded"
                value={form.estado}
                onChange={(e) => setForm({ ...form, estado: e.target.value })}
              >
                {estadosFIFO.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>

            <div>
              <Label>Quantum (ms)</Label>
              <Input type="number" value={form.quantum ?? 200} onChange={(e: any) => setForm({ ...form, quantum: Number(e.target.value) })} />
            </div>

            <div>
              <Label>Ráfaga (ms)</Label>
              <Input type="number" value={form.rafaga ?? form.tiempo_cpu} onChange={(e: any) => setForm({ ...form, rafaga: Number(e.target.value) })} />
            </div>
          </div>

          <div className="flex gap-2">
            <Button onClick={aplicarCambios}>Aplicar cambios</Button>
            <Button variant="outline" onClick={() => setForm({ ...procesoContext })}>Revertir</Button>
          </div>

          <div className="mt-4">
            <h3 className="font-semibold mb-2">Proyección del efecto sobre CPU (heurística)</h3>
            <p className="text-sm text-muted-foreground">La gráfica muestra cómo cambiar la prioridad afectaría el uso de CPU (proyección estimada).</p>
          </div>
        </div>

        <div className="col-span-1 space-y-4">
          <div className="p-4 bg-white/5 rounded">
            <h4 className="font-semibold">Datos actuales</h4>
            <p><strong>Uso CPU actual:</strong> {procesoContext?.tiempo_cpu?.toFixed(2)}%</p>
            <p><strong>Prioridad actual:</strong> {procesoContext?.prioridad}</p>
            <p><strong>Estado:</strong> {procesoContext?.estado}</p>
          </div>

          <div className="p-4 bg-white/5 rounded">
            <h4 className="font-semibold">Proyección</h4>
            <p><strong>CPU proyectado:</strong> {proyectedMetrics(procesoContext?.tiempo_cpu ?? 0).toFixed(2)}%</p>
            <p className="text-sm text-muted-foreground">Heurística simple: cada punto de prioridad ≈ 4% relativo</p>
          </div>
        </div>
      </div>

      <div className="mt-6">
        <h3 className="text-lg font-semibold mb-2">Métricas del sistema (reales)</h3>
        <SystemMetrics refreshMs={2000} />
      </div>
    </div>
  );
}
