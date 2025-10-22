
import { useState, useEffect } from "react"
import { Button } from "@/shared/components/ui/button"
import { Input } from "@/shared/components/ui/input"
import { Label } from "@/shared/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/shared/components/ui/select"
import { SheetFooter, SheetHeader, SheetTitle } from "@/shared/components/ui/sheet"
import { Tooltip, TooltipTrigger, TooltipContent } from "@/shared/components/ui/tooltip"
import { CircleHelp } from "lucide-react"

export type EstadoProceso = "listo" | "ejecutando" | "suspendido" | "terminado" | "inactivo"
export type Interactividad = "alta" | "media" | "baja"

export interface Process {
  pid: string
  nombre: string
  prioridad: number
  tiempo_total: number
  tiempo_restante: number
  quantum: number
  iteracion: number
  estado: EstadoProceso
  progreso: number
  tiempo_cpu: number
  interactividad: Interactividad
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
  const [form, setForm] = useState<Process>({
    pid: "",
    nombre: "",
    prioridad: 1,
    tiempo_total: 100,
    tiempo_restante: 100,
    quantum: 10,
    iteracion: 0,
    estado: "listo",
    progreso: 0,
    tiempo_cpu: 0,
    interactividad: "media",
  })

  const [errors, setErrors] = useState<{ pid?: string; nombre?: string }>({})

  useEffect(() => {
    if (initial) setForm((prev) => ({ ...prev, ...initial }))
  }, [initial])

  const handle = <K extends keyof Process>(key: K, value: Process[K]) =>
    setForm((prev) => ({ ...prev, [key]: value }))

  const validate = () => {
    const newErrors: typeof errors = {}

    // PID validaciones
    if (!form.pid.trim()) {
      newErrors.pid = "El PID es obligatorio"
    } else if (!/^\d+$/.test(form.pid)) {
      newErrors.pid = "El PID debe ser un número entero positivo"
    } else if (!initial && existingPids.includes(form.pid)) {
      newErrors.pid = "Ya existe un proceso con ese PID"
    }

    // Nombre validaciones
    if (!form.nombre.trim()) {
      newErrors.nombre = "El nombre es obligatorio"
    }

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleSave = () => {
    if (!validate()) return
    onSave({ ...form })
    onCancel?.() // cerrar sheet después de guardar
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
    <div className="flex flex-col h-full justify-between">
      <div className="overflow-y-auto p-6 space-y-5">
        <SheetHeader>
          <SheetTitle>{initial ? "Editar proceso" : "Crear proceso"}</SheetTitle>
        </SheetHeader>

        <div className="flex flex-col space-y-4 w-full">
          <div>
            <TooltipLabel text="PID" tooltip="Identificador único del proceso" />
            <Input
              value={form.pid}
              onChange={(e) => handle("pid", e.target.value)}
              className={errors.pid ? "border-destructive" : ""}
              disabled={!!initial} // no se puede cambiar el PID al editar
            />
            {errors.pid && <p className="text-sm text-destructive mt-1">{errors.pid}</p>}
          </div>

          <div>
            <TooltipLabel text="Nombre" tooltip="Nombre del proceso" />
            <Input
              value={form.nombre}
              onChange={(e) => handle("nombre", e.target.value)}
              className={errors.nombre ? "border-destructive" : ""}
            />
            {errors.nombre && <p className="text-sm text-destructive mt-1">{errors.nombre}</p>}
          </div>

          <div>
            <TooltipLabel text="Prioridad" tooltip="Nivel de prioridad asignado" />
            <Input
              type="number"
              min={1}
              value={form.prioridad}
              onChange={(e) => handle("prioridad", Number(e.target.value))}
            />
          </div>

          <div>
            <TooltipLabel text="Tiempo total" tooltip="Tiempo necesario para ejecutar el proceso" />
            <Input
              type="number"
              min={1}
              value={form.tiempo_total}
              onChange={(e) => {
                const total = Number(e.target.value)
                handle("tiempo_total", total)
                if (!initial) handle("tiempo_restante", total)
              }}
            />
          </div>

          <div>
            <TooltipLabel text="Tiempo restante" tooltip="Cuánto le falta por ejecutar" />
            <Input
              type="number"
              min={0}
              value={form.tiempo_restante}
              onChange={(e) => handle("tiempo_restante", Number(e.target.value))}
            />
          </div>

          <div>
            <TooltipLabel text="Quantum" tooltip="Tiempo máximo antes de pasar a la cola" />
            <Input
              type="number"
              min={1}
              value={form.quantum}
              onChange={(e) => handle("quantum", Number(e.target.value))}
            />
          </div>

          <div>
            <TooltipLabel text="Iteración" tooltip="Cantidad de ciclos ejecutados" />
            <Input
              type="number"
              min={0}
              value={form.iteracion}
              onChange={(e) => handle("iteracion", Number(e.target.value))}
            />
          </div>

          <div>
            <TooltipLabel text="Estado" tooltip="Estado actual del proceso" />
            <Select
              value={form.estado}
              onValueChange={(v: Process["estado"]) => handle("estado", v)}
            >
              <SelectTrigger>
                <SelectValue placeholder="Seleccionar" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="listo">Listo</SelectItem>
                <SelectItem value="ejecutado">Ejecutado</SelectItem>
                <SelectItem value="suspendido">Suspendido</SelectItem>
                <SelectItem value="terminado">Terminado</SelectItem>
                <SelectItem value="inactivo">Inactivo</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div>
            <TooltipLabel text="Interactividad" tooltip="Nivel de interactividad del proceso" />
            <Select
              value={form.interactividad}
              onValueChange={(v: Process["interactividad"]) => handle("interactividad", v)}
            >
              <SelectTrigger>
                <SelectValue placeholder="Seleccionar" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="alta">Alta</SelectItem>
                <SelectItem value="media">Media</SelectItem>
                <SelectItem value="baja">Baja</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div>
            <TooltipLabel text="Progreso" tooltip="Porcentaje completado del proceso" />
            <Input
              type="number"
              min={0}
              max={100}
              value={form.progreso}
              onChange={(e) => handle("progreso", Number(e.target.value))}
            />
          </div>
        </div>
      </div>

      <SheetFooter className="p-4 border-t flex justify-end gap-2">
        <Button variant="secondary" onClick={onCancel}>
          Cancelar
        </Button>
        <Button onClick={handleSave}>Guardar</Button>
      </SheetFooter>
    </div>
  )
}
