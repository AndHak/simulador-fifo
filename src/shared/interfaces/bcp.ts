export interface BCP {
  pid: number;
  nombre: string;
  prioridad: number;
  tiempoCPU: number;
  estado: "Corriendo" | "Suspendido" | "Apagado";
  llegada: number;
  rafaga: number;
  usoRAM: number;
  usoGPU: number;
  usoAlmacenamiento: number;
  usoRed: number;
}
