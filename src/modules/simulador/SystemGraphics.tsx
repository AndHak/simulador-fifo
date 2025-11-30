/**
 * SystemGraphics.tsx
 *
 * Visualización del estado del sistema (CPU, RAM, Disco) simulando un SO.
 */

import { Card, CardContent, CardHeader, CardTitle } from "@/shared/components/ui/card";
import { Process } from "./ProcessFrom";
import { Cpu, HardDrive, MemoryStick, Activity, Save, Server } from "lucide-react";
import { cn } from "@/shared/lib/utils";

interface SystemGraphicsProps {
  procesos: Process[];
  registro: Process[];
}

export default function SystemGraphics({ procesos, registro }: SystemGraphicsProps) {
  // Filtrar procesos por estado para determinar su ubicación
  const running = procesos.find((p) => p.estado === "ejecutando");
  
  // RAM: Procesos activos (Listo, Ejecutando, Suspendido)
  // El usuario especificó: "muestre que estan en la ram cuando esta en suspendido, ejecutando o listo"
  const inRam = procesos.filter((p) => ["listo", "ejecutando", "suspendido"].includes(p.estado));
  
  // Disco: Procesos terminados (y conceptualmente los "nuevos" antes de cargar, pero aquí usamos registro)
  // El usuario especificó: "muestre que esta en el disco cuando no se estan ejecutando o terminan"
  // Interpretación: Terminados van al disco.
  const inDisk = registro;

  return (
    <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3 animate-in fade-in duration-500">
      {/* ---------------- CPU SECTION ---------------- */}
      <Card className="border-primary/20 bg-card/50 backdrop-blur shadow-lg relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-primary/5 to-transparent pointer-events-none" />
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 relative z-10">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <Cpu className="h-4 w-4" /> CPU
          </CardTitle>
          <Activity className={cn("h-4 w-4 text-muted-foreground transition-colors", running && "text-primary animate-pulse")} />
        </CardHeader>
        <CardContent className="relative z-10">
          {running ? (
            <div className="flex flex-col items-center justify-center py-4 space-y-3">
              <div className="relative">
                <div className="absolute -inset-1 bg-primary/20 rounded-full blur-sm animate-pulse" />
                <div className="relative bg-background border-2 border-primary rounded-full w-16 h-16 flex items-center justify-center shadow-inner">
                  <span className="text-xl font-bold text-primary">{running.pid}</span>
                </div>
              </div>
              <div className="text-center">
                <div className="font-semibold text-lg">{running.nombre}</div>
                <div className="text-xs text-muted-foreground font-mono mt-1">
                  PC: {running.iteracion ?? 0} | Quantum: {running.tiempo_cpu ?? 0}/{running.quantum}
                </div>
              </div>
              <div className="w-full space-y-1">
                <div className="flex justify-between text-[10px] text-muted-foreground uppercase tracking-wider">
                  <span>Progreso</span>
                  <span>{running.progreso}%</span>
                </div>
                <div className="w-full bg-secondary h-1.5 rounded-full overflow-hidden">
                  <div 
                    className="bg-primary h-full transition-all duration-300 ease-out" 
                    style={{ width: `${running.progreso}%` }} 
                  />
                </div>
              </div>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-10 text-muted-foreground/50">
              <Server className="h-12 w-12 mb-2 opacity-20" />
              <span className="font-mono text-sm tracking-widest">IDLE</span>
            </div>
          )}
        </CardContent>
      </Card>

      {/* ---------------- RAM SECTION ---------------- */}
      <Card className="border-primary/20 bg-card/50 backdrop-blur shadow-lg lg:col-span-2 relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-bl from-blue-500/5 to-transparent pointer-events-none" />
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 relative z-10">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <MemoryStick className="h-4 w-4" /> Memoria RAM
          </CardTitle>
          <span className="text-xs text-muted-foreground">
            {inRam.length} proceso{inRam.length !== 1 && 's'} activo{inRam.length !== 1 && 's'}
          </span>
        </CardHeader>
        <CardContent className="relative z-10">
          <div className="min-h-[140px] p-4 bg-background/50 rounded-lg border border-border/50 shadow-inner">
            <div className="flex flex-wrap gap-3">
              {inRam.length === 0 && (
                <div className="w-full h-full flex items-center justify-center text-muted-foreground/40 text-sm italic py-8">
                  Memoria disponible
                </div>
              )}
              {inRam.map((p) => (
                <div
                  key={p.pid}
                  className={cn(
                    "group relative flex flex-col items-center justify-between p-2 rounded-md border w-20 h-24 transition-all duration-300",
                    p.estado === "ejecutando" 
                      ? "bg-primary/10 border-primary shadow-[0_0_10px_rgba(var(--primary),0.3)] scale-105 z-10" 
                      : p.estado === "listo" 
                        ? "bg-green-500/5 border-green-500/30 hover:bg-green-500/10" 
                        : "bg-yellow-500/5 border-yellow-500/30 hover:bg-yellow-500/10" // suspendido
                  )}
                >
                  <div className="flex w-full justify-between items-start">
                    <span className="text-[10px] font-mono opacity-50">#{p.pid}</span>
                    <div className={cn("w-1.5 h-1.5 rounded-full",
                        p.estado === "ejecutando" ? "bg-primary animate-pulse" :
                        p.estado === "listo" ? "bg-green-500" : "bg-yellow-500"
                    )} />
                  </div>
                  
                  <div className="font-semibold text-xs text-center truncate w-full px-1" title={p.nombre}>
                    {p.nombre}
                  </div>
                  
                  <div className="w-full bg-muted/50 h-1 rounded-full overflow-hidden mt-1">
                     <div 
                        className={cn("h-full", 
                            p.estado === "ejecutando" ? "bg-primary" :
                            p.estado === "listo" ? "bg-green-500/70" : "bg-yellow-500/70"
                        )}
                        style={{ width: `${p.progreso}%` }}
                     />
                  </div>
                  
                  <span className="text-[9px] uppercase tracking-tighter text-muted-foreground mt-1">
                    {p.estado}
                  </span>
                </div>
              ))}
            </div>
          </div>
          
          <div className="flex gap-4 mt-3 text-xs text-muted-foreground justify-end px-2">
              <div className="flex items-center gap-1.5">
                  <div className="w-2 h-2 rounded-full bg-primary animate-pulse"/> 
                  <span>Ejecutando</span>
              </div>
              <div className="flex items-center gap-1.5">
                  <div className="w-2 h-2 rounded-full bg-green-500"/> 
                  <span>Listo</span>
              </div>
              <div className="flex items-center gap-1.5">
                  <div className="w-2 h-2 rounded-full bg-yellow-500"/> 
                  <span>Suspendido</span>
              </div>
          </div>
        </CardContent>
      </Card>

      {/* ---------------- DISK SECTION ---------------- */}
      <Card className="border-primary/20 bg-card/50 backdrop-blur shadow-lg md:col-span-2 lg:col-span-3 relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-t from-slate-500/5 to-transparent pointer-events-none" />
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 relative z-10">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <HardDrive className="h-4 w-4" /> Disco Duro (Almacenamiento)
          </CardTitle>
          <span className="text-xs text-muted-foreground">
            {inDisk.length} archivo{inDisk.length !== 1 && 's'}
          </span>
        </CardHeader>
        <CardContent className="relative z-10">
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
             {inDisk.length === 0 && (
                 <div className="col-span-full py-6 text-center text-sm text-muted-foreground flex flex-col items-center gap-2">
                     <Save className="h-8 w-8 opacity-20" />
                     <span>No hay procesos terminados en disco</span>
                 </div>
             )}
             {inDisk.map((p, idx) => (
                 <div 
                    key={`${p.pid}-${idx}`} 
                    className="flex items-center gap-3 p-2.5 rounded-md border border-border/40 bg-background/40 hover:bg-background/80 transition-colors group"
                 >
                     <div className="h-8 w-8 rounded bg-slate-100 dark:bg-slate-800 flex items-center justify-center group-hover:scale-110 transition-transform">
                        <Save className="h-4 w-4 text-slate-500" />
                     </div>
                     <div className="flex flex-col min-w-0">
                         <span className="text-xs font-medium truncate text-foreground/90">{p.nombre}</span>
                         <span className="text-[10px] text-muted-foreground font-mono">PID: {p.pid}</span>
                     </div>
                 </div>
             ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
