// src/shared/types/types.ts

export type Interactividad = "alta" | "media" | "baja";

export type EstadoProceso = "listo" | "ejecutado" | "suspendido" | "terminado" | "inactivo";

/**
 * Proceso = tipo que proviene desde Rust / Tauri (puede variar entre plataformas).
 * Hacemos la mayoría de campos opcionales porque el backend puede no devolverlos todos.
 */
export interface Proceso {
  pid: string;
  nombre?: string;
  prioridad?: number;
  tiempo_cpu?: number; // porcentaje aproximado
  memoria?: number; // KB
  estado?: string;
  avance?: number; // porcentaje
  iteraciones?: number;
  interactividad?: string; // a veces no existe; será mapeado a Interactividad en frontend
  // campos extra permitidos
  [key: string]: any;
}

/**
 * Process = tipo que usa el simulador (frontend).
 * Todos los campos requeridos aquí (no opcionales) porque el formulario y la simulación esperan estos campos.
 */
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
  resident?: boolean; // true si está en memoria (no paginado). opcional, por compatibilidad.
}