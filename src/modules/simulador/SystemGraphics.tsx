"use client";

import {
  ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip as ChartTooltip,
  BarChart, Bar, CartesianGrid, AreaChart, Area,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/shared/components/ui/card";
import { Process } from "./ProcessFrom";
import { useMemo } from "react";
import { cn } from "@/shared/lib/utils";

interface SystemGraphicsProps { procesos: Process[] }

export default function SystemGraphics({ procesos }: SystemGraphicsProps) {
  const isDark = typeof window !== "undefined" && window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches;
  const strokeColor = isDark ? "hsl(220 12% 70%)" : "hsl(220 15% 25%)";
  const gridColor = isDark ? "hsl(220 12% 20%)" : "hsl(220 15% 95%)";
  const primaryColor = isDark ? "hsl(200 90% 62%)" : "hsl(222 85% 52%)";
  const accentSuccess = isDark ? "hsl(140 60% 60%)" : "hsl(145 70% 45%)";
  const accentWarn = "hsl(35 90% 55%)";
  const accentDanger = "hsl(0 80% 60%)";


  const cpuData = useMemo(() => {
    if (!procesos?.length) return [];

    const data = procesos.map((p) => ({
      name: p.nombre,
      cpu: typeof p.tiempo_cpu === "number" ? Math.max(0, Math.min(100, p.tiempo_cpu)) : 0,
      progreso: p.progreso ?? 0,
      estado: p.estado,
      pid: p.pid,
    }));

    if (data.some((d) => d.cpu > 0)) return data;

    const firstExec = data.find((d) => d.estado === "ejecutando") ?? data.find((d) => d.estado === "listo");
    if (firstExec) {
      return data.map((d) => (d.pid === firstExec.pid ? { ...d, cpu: 90 } : { ...d, cpu: 0 }));
    }

    return data;
  }, [procesos]);

  // progreso promedio
  const progresoTotal = useMemo(() => {
    if (!procesos?.length) return 0;
    const sum = procesos.reduce((s, p) => s + (p.progreso ?? 0), 0);
    return Math.round(sum / procesos.length);
  }, [procesos]);

  // RAM estimation 
  const ramTotal = useMemo(() => {
    if (!procesos?.length) return 0;
    const sum = procesos.reduce((acc, p) => {
      const base = 8;
      const iterBonus = (p.iteracion ?? 0) * 0.4;
      const priorityBonus = p.prioridad <= 2 ? 6 : p.prioridad <= 4 ? 3 : 0;
      const stateFactor = p.estado === "ejecutando" ? 1 : p.estado === "listo" ? 0.7 : p.estado === "suspendido" ? 0.35 : 0;
      return acc + (base + iterBonus + priorityBonus) * stateFactor;
    }, 0);
    return Math.min(100, Math.round((sum / (procesos.length * 20)) * 100));
  }, [procesos]);

  const ramData = useMemo(() => {
    if (!procesos?.length) return [{ time: "T0", ram: 0 }];
    return procesos.map((p, i) => {
      const base = 8 + (p.iteracion ?? 0) * 0.4 + (p.prioridad <= 2 ? 6 : p.prioridad <= 4 ? 3 : 0);
      const factor = p.estado === "ejecutando" ? 1 : p.estado === "listo" ? 0.7 : p.estado === "suspendido" ? 0.35 : 0;
      return { time: `T${i + 1}`, ram: Math.min(100, Math.round(base * factor)) };
    });
  }, [procesos]);

  const getProgressColor = (value: number) => (value < 40 ? accentDanger : value < 80 ? accentWarn : accentSuccess);
  const tooltipStyle = { backgroundColor: "hsl(var(--card))", border: `1px solid hsl(var(--border))`, borderRadius: "0.5rem", color: "hsl(var(--foreground))" };

  return (
    <div className={cn("grid gap-4", "md:flex md:flex-col", "lg:grid lg:grid-cols-2 lg:grid-rows-2 lg:gap-6")}>
      {/* CPU */}
      <Card className="shadow-sm border border-border/40 bg-card">
        <CardHeader><CardTitle className="text-base font-medium text-foreground/90">Uso de CPU por proceso</CardTitle></CardHeader>
        <CardContent>
          <div className="h-[240px]">
            <ResponsiveContainer>
              <BarChart data={cpuData}>
                <CartesianGrid strokeDasharray="3 3" stroke={gridColor} />
                <XAxis dataKey="name" stroke={strokeColor} />
                <YAxis stroke={strokeColor} domain={[0, 100]} tickFormatter={(v) => `${v}%`} />
                <ChartTooltip contentStyle={tooltipStyle} formatter={(value: any) => [`${value}%`, "CPU"]} />
                <Bar dataKey="cpu" fill={primaryColor} radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      {/* Progreso */}
      <Card className="shadow-sm border border-border/40 bg-card">
        <CardHeader><CardTitle className="text-base font-medium text-foreground/90">Progreso de procesos (ojiva)</CardTitle></CardHeader>
        <CardContent>
          <div className="h-[240px]">
            <ResponsiveContainer>
              <LineChart data={cpuData}>
                <CartesianGrid strokeDasharray="3 3" stroke={gridColor} />
                <XAxis dataKey="name" stroke={strokeColor} />
                <YAxis stroke={strokeColor} domain={[0, 100]} tickFormatter={(v) => `${v}%`} />
                <ChartTooltip contentStyle={tooltipStyle} formatter={(value: any) => [`${value}%`, "Progreso"]} />
                <Line type="monotone" dataKey="progreso" stroke={primaryColor} strokeWidth={2.5}
                  dot={(props: any) => {
                    const color = getProgressColor(props.payload.progreso);
                    return <circle cx={props.cx} cy={props.cy} r={4} fill={color} stroke={color} />;
                  }}
                  activeDot={{ r: 6, stroke: primaryColor, strokeWidth: 2 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
          <div className="mt-3 text-sm text-muted-foreground">Promedio total: <span className="text-foreground font-semibold">{progresoTotal}%</span></div>
        </CardContent>
      </Card>

      {/* RAM */}
      <Card className="shadow-sm border border-border/40 bg-card">
        <CardHeader><CardTitle className="text-base font-medium text-foreground/90">Consumo estimado de RAM</CardTitle></CardHeader>
        <CardContent>
          <div className="h-[240px]">
            <ResponsiveContainer>
              <AreaChart data={ramData}>
                <defs><linearGradient id="ramGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={primaryColor} stopOpacity={0.6} />
                  <stop offset="95%" stopColor={primaryColor} stopOpacity={0.1} />
                </linearGradient></defs>
                <CartesianGrid strokeDasharray="3 3" stroke={gridColor} />
                <XAxis dataKey="time" stroke={strokeColor} />
                <YAxis stroke={strokeColor} />
                <ChartTooltip contentStyle={tooltipStyle} />
                <Area type="monotone" dataKey="ram" stroke={primaryColor} fill="url(#ramGradient)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
          <div className="mt-3 text-sm text-muted-foreground">RAM estimada: <span className="text-foreground font-semibold">{ramTotal}%</span></div>
        </CardContent>
      </Card>

      {/* Estado general */}
      <Card className="shadow-sm border border-border/40 bg-card">
        <CardHeader><CardTitle className="text-base font-medium text-foreground/90">Estado general</CardTitle></CardHeader>
        <CardContent className="flex flex-col justify-center items-center h-[240px] space-y-3">
          <div className="text-3xl font-semibold text-foreground">{progresoTotal}%</div>
          <div className="text-sm text-muted-foreground text-center">Promedio global: tiempo medio y consumo estimado de recursos.</div>
        </CardContent>
      </Card>
    </div>
  );
}
