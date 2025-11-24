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
export type Interactividad = "alta" | "media" | "baja" // niveles de interactividad

/**
 * Interfaz Process - define la forma de un proceso en el simulador
 */
export interface Process {
  pid: string; // identificador único del proceso (string por compatibilidad)
  nombre: string; // nombre legible
  prioridad: number; // prioridad numérica
  tiempo_total: number; // tiempo total estimado para completar
  tiempo_restante: number; // tiempo que queda por ejecutar
  quantum: number; // quantum asignado
  iteracion: number; // número de veces que recibió CPU (iteraciones)
  estado: EstadoProceso; // estado actual (union type)
  progreso: number; // porcentaje de avance 0..100
  tiempo_cpu: number; // uso de CPU (porcentaje relativo o valor heurístico)
  interactividad: Interactividad; // interactividad: alta/media/baja
  resident?: boolean; // opcional: si está residente en memoria

  created_at?: number;       // timestamp ms cuando se creó el proceso (local)
  t_inicio?: number | null;  // timestamp ms cuando empezó a ejecutarse por primera vez
  t_fin?: number | null;     // timestamp ms cuando terminó
  tiempo_espera?: number;    // segundos de espera antes de iniciar
}

/**
 * Props del componente ProcessForm
 */
interface ProcessFormProps {
  onSave: (process: Process) => void // callback cuando se guarda (creación/edición)
  initial?: Process | null // proceso inicial para edición (si existe)
  onCancel?: () => void // callback para cancelar/cerrar el formulario
  existingPids?: string[] // PIDs existentes para evitar colisiones al generar
}

/**
 * ProcessForm - formulario simple para crear o editar procesos.
 *
 * - En modo creación autogenera casi todo (PID, prioridad, tiempos, quantum).
 * - En modo edición solo permite cambiar `nombre` y muestra los demás campos como lectura.
 *
 * @param {ProcessFormProps} props
 * @returns JSX.Element
 */
export default function ProcessForm({
  onSave,
  initial = null,
  onCancel,
  existingPids = [],
}: ProcessFormProps) {
  // ---------- estado local ----------
  // valor editable del campo nombre (único campo mutable en la versión minimal)
  const [nombre, setNombre] = useState<string>(initial?.nombre ?? "")

  // objeto de errores para validar campos (solo 'nombre' por ahora)
  const [errors, setErrors] = useState<{ nombre?: string }>({})

  // sincronizar `nombre` si la prop `initial` cambia (por ejemplo abrir edición)
  useEffect(() => {
    if (initial) setNombre(initial.nombre ?? "")
  }, [initial])

  // ---------- helpers locales ----------
  // pick: devuelve un elemento aleatorio de un array
  const pick = <T,>(arr: T[]) => arr[Math.floor(Math.random() * arr.length)]

  // randInt: entero aleatorio entre min y max inclusive
  const randInt = (min: number, max: number) =>
    Math.floor(Math.random() * (max - min + 1)) + min

  /**
   * generatePid
   * - Intenta generar un PID numérico legible (3-6 dígitos) que no colisione con existing.
   * - Realiza hasta 50 intentos; si falla, usa fallback con timestamp para garantizar unicidad.
   */
  const generatePid = (existing: string[] = []) => {
    // convertir a Set para búsquedas O(1)
    const existingSet = new Set(existing.map(String));
    const min = 100;      // valor mínimo (3 dígitos)
    const max = 999999;   // valor máximo (6 dígitos)

    // intentar generar un número no colisionante varias veces
    for (let i = 0; i < 10; i++) {
      const n = Math.floor(Math.random() * (max - min + 1)) + min; // aleatorio en rango
      const pid = String(n)
      if (!existingSet.has(pid)) return pid // si no existe, devolverlo
    }

    // fallback seguro: timestamp + número aleatorio (asegura unicidad)
    return String(Date.now()) + String(Math.floor(Math.random() * 900) + 100)
  }

  // gen de prioridad simple (1..10)
  const generatePriority = () => randInt(1, 10)

  // gen de interactividad: alta/media/baja
  const generateInteractivity = (): Interactividad =>
    pick<Interactividad>(["alta", "media", "baja"])

  // tiempo total por defecto (unidad lógica): 50..200
  const generateTiempoTotal = () => randInt(1, 10)

  /**
   * generateQuantum
   * - heurística simple: base * factor según prioridad
   * - prioridad alta -> quantum un poco menor; prioridad baja -> quantum mayor
   * - se asegura un mínimo para evitar quantum = 0
   */
  const generateQuantum = (prioridad: number) => {
    const base = 8
    // (10 - prioridad) reduce el valor cuando prioridad es alta
    return Math.max(4, Math.round(base * (1 + (10 - prioridad) / 10)))
  }

  // ---------- validación ----------
  const validate = () => {
    const newErrors: typeof errors = {}
    // nombre obligatorio (sin sólo espacios)
    if (!nombre.trim()) newErrors.nombre = "El nombre es obligatorio"
    setErrors(newErrors)
    // true si no hay errores
    return Object.keys(newErrors).length === 0
  }

  // ---------- manejador guardar ----------
  const handleSave = () => {
    // validar primero
    if (!validate()) return

    // MODO EDICIÓN: si tenemos `initial`, solo actualizamos el nombre
    if (initial) {
      onSave({ ...initial, nombre: nombre.trim() }) // mantener todos los campos y cambiar nombre
      onCancel?.() // cerrar formulario si se provee onCancel
      return
    }

    // MODO CREACIÓN: generar todos los campos necesarios automáticamente
    const pid = generatePid(existingPids) // PID único
    const prioridad = generatePriority() // prioridad aleatoria entre 1 y 10
    const interactividad = generateInteractivity() // alta/media/baja
    const tiempo_total = generateTiempoTotal() // tiempo total por defecto
    const tiempo_restante = tiempo_total // al crear, permanece completo
    const quantum = generateQuantum(prioridad) // quantum derivado de prioridad

    // construir objeto Process completo
    const newProcess: Process = {
      pid,
      nombre: nombre.trim(),
      prioridad,
      tiempo_total,
      tiempo_restante,
      quantum,
      iteracion: 0, // aún no ha recibido CPU
      estado: "listo", // estado inicial
      progreso: 0, // 0% al crearse
      tiempo_cpu: 0, // sin uso CPU todavía
      interactividad,
    }

    // ejecutar callback con el nuevo proceso y cerrar formulario
    onSave(newProcess)
    onCancel?.()
  }

  /**
   * TooltipLabel
   * - Componente interno pequeño para renderizar una Label con un icono de ayuda (tooltip).
   * - Recibe `text` (etiqueta visible) y `tooltip` (texto dentro del tooltip).
   */
  const TooltipLabel = ({ text, tooltip }: { text: string; tooltip: string }) => (
    <div className="flex items-center gap-2 mb-2">
      <Label>{text}</Label>
      <Tooltip>
        <TooltipTrigger asChild>
          {/* icono que dispara el tooltip */}
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
        e.preventDefault() // prevenir submit por defecto que recarga la página
        handleSave() // llamar la lógica de guardar
      }}
      className="flex flex-col h-full justify-between"
    >
      {/* Contenido principal con scroll */}
      <div className="overflow-y-auto p-6 space-y-5">
        <SheetHeader>
          {/* Título dinámico según modo (editar/crear) */}
          <SheetTitle>{initial ? "Editar proceso" : "Crear proceso"}</SheetTitle>
        </SheetHeader>

        <div className="flex flex-col space-y-4 w-full">
          <div>
            {/* Etiqueta con tooltip para explicar el campo */}
            <TooltipLabel text="Nombre" tooltip="Nombre del proceso (único campo editable)" />
            <Input
              value={nombre} // valor ligado al estado local
              onChange={(e) => setNombre(e.target.value)} // actualizar estado al escribir
              className={errors.nombre ? "border-destructive" : ""} // estilo en caso de error
            />
            {/* Mostrar mensaje de validación si existe */}
            {errors.nombre && <p className="text-sm text-destructive mt-1">{errors.nombre}</p>}
          </div>

          {/* Mostrar valores autogenerados en modo edición, o nota en creación */}
          {initial ? (
            <>
              <div className="text-sm text-muted-foreground space-y-2">
                {/* Mostrar campos informativos (solo lectura) */}
                <div>PID: <strong>{initial.pid}</strong></div>
                <div>Prioridad: <strong>{initial.prioridad}</strong></div>
                <div>Interactividad: <strong>{initial.interactividad}</strong></div>
                <div>Tiempo total: <strong>{initial.tiempo_total}</strong></div>
                <div>Tiempo restante: <strong>{initial.tiempo_restante}</strong></div>
              </div>
            </>
          ) : (
            // Mensaje para creación indicando que ciertos campos se asignarán automáticamente
            <div className="text-sm text-muted-foreground">
              PID, prioridad, interactividad y tiempos se asignarán automáticamente al guardar.
            </div>
          )}
        </div>
      </div>

      {/* Pie del sheet con botones de acción */}
      <SheetFooter className="p-4 border-t flex justify-end gap-2">
        <Button type="button" variant="secondary" onClick={onCancel}>
          Cancelar
        </Button>
        <Button type="submit">Guardar</Button>
      </SheetFooter>
    </form>
  )
}
