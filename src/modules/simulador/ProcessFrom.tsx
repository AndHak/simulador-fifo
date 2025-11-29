import { useState, useEffect } from "react" // React hooks básicos: estado y efectos
import { Button } from "@/shared/components/ui/button" // Componente Button reutilizable
import { Input } from "@/shared/components/ui/input" // Input de texto estilizado
import { Label } from "@/shared/components/ui/label" // Label para inputs
import { SheetFooter, SheetHeader, SheetTitle } from "@/shared/components/ui/sheet" // Subcomponentes del Sheet (cabecera y pie)
import { Tooltip, TooltipTrigger, TooltipContent } from "@/shared/components/ui/tooltip" // Tooltip para ayuda contextual
import { CircleHelp } from "lucide-react" // Icono de ayuda (círculo con signo de ?)

/**
 * Tipos exportados para uso en otras partes de la app
 */
export type EstadoProceso = "listo" | "ejecutando" | "suspendido" | "terminado" | "inactivo" // estados válidos

/**
 * Interfaz Process - define la forma de un proceso en el simulador
 */
export interface Process {
  pid: string;
  nombre: string;
  tiempo_total: number;
  tiempo_restante: number;
  quantum: number;
  iteracion: number;
  estado: EstadoProceso;
  progreso: number;
  tiempo_cpu: number;
  interactividad: number;
  interactividad_inicial?: number;
  resident?: boolean;

  created_at?: number;
  t_inicio?: number | null;
  t_fin?: number | null;
  tiempo_espera?: number;
}

/**
 * Props del componente ProcessForm
 */
interface ProcessFormProps {
  onSave: (process: Process) => void
  initial?: Process | null
  onCancel?: () => void
  existingPids?: string[]
}

/**
 * ProcessForm - formulario simple para crear o editar procesos.
 *
 * Cambios clave:
 * - En creación: interactividad siempre = 2 (listo).
 * - Quantum garantizado >= 1 y <= tiempo_total.
 * - Se generan campos auxiliares (created_at, t_inicio=null, t_fin=null, tiempo_espera=0, resident=true).
 * - En edición: solo cambia nombre (como antes).
 */
export default function ProcessForm({
  onSave,
  initial = null,
  onCancel,
  existingPids = [],
}: ProcessFormProps) {
  const [nombre, setNombre] = useState<string>(initial?.nombre ?? "")
  const [errors, setErrors] = useState<{ nombre?: string }>({})

  useEffect(() => {
    if (initial) setNombre(initial.nombre ?? "")
  }, [initial])

  // ---------- utilidades ----------
  const randInt = (min: number, max: number) =>
    Math.floor(Math.random() * (max - min + 1)) + min

  const generatePid = (existing: string[] = []) => {
    const existingSet = new Set(existing.map(String));
    const min = 10;
    const max = 100;
    for (let i = 0; i < 20; i++) {
      const n = Math.floor(Math.random() * (max - min + 1)) + min;
      const pid = String(n)
      if (!existingSet.has(pid)) return pid
    }
    // fallback único
    return String(Date.now()) + String(Math.floor(Math.random() * 900) + 100)
  }

  /**
   * generateInteractivity
   * - Para creación, siempre devolver 2 (listo).
   * - Si quieres variar en el futuro, cambia aquí la heurística.
   */
  const generateInteractivity = () => randInt(0, 3)

  /**
   * generateTiempoTotal
   * - Valores razonables para simular: 6..20s por defecto.
   * - Puedes ajustar el rango si prefieres procesos más largos/cortos.
   */
  const generateTiempoTotal = () => randInt(6, 20)

  /**
   * generateQuantum
   */
  const generateQuantum = (tiempo_total: number) => {
    return randInt(3, tiempo_total/3)
  }

  // ---------- validación ----------
  const validate = () => {
    const newErrors: typeof errors = {}
    if (!nombre.trim()) newErrors.nombre = "El nombre es obligatorio"
    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  // ---------- guardar ----------
  const handleSave = () => {
    if (!validate()) return

    if (initial) {
      onSave({ ...initial, nombre: nombre.trim() })
      onCancel?.()
      return
    }

    // CREACIÓN: generar campos seguros y coherentes con simulador
    const pid = generatePid(existingPids)
    const tiempo_total = generateTiempoTotal()
    const tiempo_restante = tiempo_total
    const quantum = generateQuantum(tiempo_total)
    const interactividad = generateInteractivity()

    const newProcess: Process = {
      pid,
      nombre: nombre.trim(),
      tiempo_total,
      tiempo_restante,
      quantum,
      iteracion: 0,
      estado: "listo",
      progreso: 0,
      tiempo_cpu: 0,
      interactividad,
      resident: true,

      created_at: Date.now(),
      t_inicio: null,
      t_fin: null,
      tiempo_espera: 0,
      interactividad_inicial: interactividad,
    }

    onSave(newProcess)
    onCancel?.()
  }

  const TooltipLabel = ({ text, tooltip }: { text: string; tooltip: string }) => (
    <div className="flex items-center gap-2 mb-2">
      <Label>{text}</Label>
      <Tooltip>
        <TooltipTrigger asChild>
          <CircleHelp className="w-4 h-4 text-muted-foreground cursor-pointer" />
        </TooltipTrigger>
        <TooltipContent>{tooltip}</TooltipContent>
      </Tooltip>
    </div>
  )

  // ---------- render ----------
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault()
        handleSave()
      }}
      className="flex flex-col h-full justify-between"
    >
      <div className="overflow-y-auto p-6 space-y-5">
        <SheetHeader>
          <SheetTitle>{initial ? "Editar proceso" : "Crear proceso"}</SheetTitle>
        </SheetHeader>

        <div className="flex flex-col space-y-4 w-full">
          <div>
            <TooltipLabel text="Nombre" tooltip="Nombre del proceso (campo obligatorio)" />
            <Input
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
              className={errors.nombre ? "border-destructive" : ""}
            />
            {errors.nombre && <p className="text-sm text-destructive mt-1">{errors.nombre}</p>}
          </div>

          {initial ? (
            <div className="text-sm text-muted-foreground space-y-2">
              <div>PID: <strong>{initial.pid}</strong></div>
              <div>Interactividad: <strong>{initial.interactividad}</strong></div>
              <div>Quantum: <strong>{initial.quantum}</strong></div>
              <div>Tiempo total: <strong>{initial.tiempo_total}</strong></div>
              <div>Estado: <strong>{initial.estado}</strong></div>
            </div>
          ) : (
            <div className="text-sm text-muted-foreground">
              PID, interactividad, quantum y tiempos se asignarán automáticamente al guardar.
            </div>
          )}
        </div>
      </div>

      <SheetFooter className="p-4 border-t flex justify-end gap-2">
        <Button type="button" variant="secondary" onClick={onCancel}>Cancelar</Button>
        <Button type="submit">Guardar</Button>
      </SheetFooter>
    </form>
  )
}
