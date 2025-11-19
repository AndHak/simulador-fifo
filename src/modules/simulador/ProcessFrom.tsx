import { useState, useEffect } from "react"
import { Button } from "@/shared/components/ui/button"
import { Input } from "@/shared/components/ui/input"
import { Label } from "@/shared/components/ui/label"
import { SheetFooter, SheetHeader, SheetTitle } from "@/shared/components/ui/sheet"
import { Tooltip, TooltipTrigger, TooltipContent } from "@/shared/components/ui/tooltip"
import { CircleHelp } from "lucide-react"

export type EstadoProceso = "listo" | "ejecutando" | "suspendido" | "terminado" | "inactivo"
export type Interactividad = "alta" | "media" | "baja"

export interface Process {
  pid: string;
  nombre: string;
  prioridad: number;
  tiempo_total: number;
  tiempo_restante: number;
  quantum: number;
  iteracion: number;
  estado: EstadoProceso;
  progreso: number;
  tiempo_cpu: number;
  interactividad: Interactividad;
  resident?: boolean; 
}

interface ProcessFormProps {
  onSave: (process: Process) => void
  initial?: Process | null
  onCancel?: () => void
  existingPids?: string[]
}

export default function ProcessForm({
  onSave,
  initial = null,
  onCancel,
  existingPids = [],
}: ProcessFormProps) {
  // Solo mantenemos el campo editable 'nombre'
  const [nombre, setNombre] = useState<string>(initial?.nombre ?? "")
  const [errors, setErrors] = useState<{ nombre?: string }>({})

  useEffect(() => {
    if (initial) setNombre(initial.nombre ?? "")
  }, [initial])

  // helpers locales (sin archivo utils)
  const pick = <T,>(arr: T[]) => arr[Math.floor(Math.random() * arr.length)]
  const randInt = (min: number, max: number) =>
    Math.floor(Math.random() * (max - min + 1)) + min

  const generatePid = (existing: string[] = []) => {
    // Queremos PIDs numéricos aleatorios de 3 a 6 dígitos (100 .. 999999)
    const existingSet = new Set(existing.map(String));
    const min = 100;      // 3 dígitos mínimo
    const max = 999999;   // 6 dígitos máximo

    // intentos para encontrar uno no colisionante
    for (let i = 0; i < 50; i++) {
      const n = Math.floor(Math.random() * (max - min + 1)) + min;
      const pid = String(n);
      if (!existingSet.has(pid)) return pid;
    }

    // fallback: timestamp + sufijo aleatorio (asegura unicidad)
    return String(Date.now()) + String(Math.floor(Math.random() * 900) + 100);
  }

  const generatePriority = () => randInt(1, 10)
  const generateInteractivity = (): Interactividad => pick<Interactividad>(["alta", "media", "baja"])
  const generateTiempoTotal = () => randInt(50, 200)
  const generateQuantum = (prioridad: number) => {
    const base = 8
    return Math.max(4, Math.round(base * (1 + (10 - prioridad) / 10)))
  }

  const validate = () => {
    const newErrors: typeof errors = {}
    if (!nombre.trim()) newErrors.nombre = "El nombre es obligatorio"
    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleSave = () => {
    if (!validate()) return

    if (initial) {
      // edición: solo modificar nombre (PID y demás permanecen)
      onSave({ ...initial, nombre: nombre.trim() })
      onCancel?.()
      return
    }

    // creación: autogenerar todo excepto nombre
    const pid = generatePid(existingPids)
    const prioridad = generatePriority()
    const interactividad = generateInteractivity()
    const tiempo_total = generateTiempoTotal()
    const tiempo_restante = tiempo_total
    const quantum = generateQuantum(prioridad)

    const newProcess: Process = {
      pid,
      nombre: nombre.trim(),
      prioridad,
      tiempo_total,
      tiempo_restante,
      quantum,
      iteracion: 0,
      estado: "listo",
      progreso: 0,
      tiempo_cpu: 0,
      interactividad,
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
            <TooltipLabel text="Nombre" tooltip="Nombre del proceso (único campo editable)" />
            <Input
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
              className={errors.nombre ? "border-destructive" : ""}
            />
            {errors.nombre && <p className="text-sm text-destructive mt-1">{errors.nombre}</p>}
          </div>

          {/* Mostrar valores autogenerados en modo edición, o nota en creación */}
          {initial ? (
            <>
              <div className="text-sm text-muted-foreground space-y-2">
                <div>PID: <strong>{initial.pid}</strong></div>
                <div>Prioridad: <strong>{initial.prioridad}</strong></div>
                <div>Interactividad: <strong>{initial.interactividad}</strong></div>
                <div>Tiempo total: <strong>{initial.tiempo_total}</strong></div>
                <div>Quantum: <strong>{initial.quantum}</strong></div>
              </div>
            </>
          ) : (
            <div className="text-sm text-muted-foreground">
              PID, prioridad, interactividad y tiempos se asignarán automáticamente al guardar.
            </div>
          )}
        </div>
      </div>

      <SheetFooter className="p-4 border-t flex justify-end gap-2">
        <Button type="button" variant="secondary" onClick={onCancel}>
          Cancelar
        </Button>
        <Button type="submit">Guardar</Button>
      </SheetFooter>
    </form>
  )
}
