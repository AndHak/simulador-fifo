/**
 * SystemGraphics.tsx
 *
 * Componente encargado de renderizar gráficas/resúmenes del sistema (CPU, progreso, RAM, estado).
 * Comentarios línea-por-línea / bloque-por-bloque que explican la lógica y las decisiones.
 */

import {
  ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip as ChartTooltip,
  BarChart, Bar, CartesianGrid, AreaChart, Area,
} from "recharts"; // componentes Recharts para gráficos

import { Card, CardContent, CardHeader, CardTitle } from "@/shared/components/ui/card"; // contenedores UI
import { Process } from "./ProcessFrom"; // tipo Process compartido
import { useMemo } from "react"; // hook para memoización de cálculos costosos
import { cn } from "@/shared/lib/utils"; // helper para concatenar clases (utilitario)

/** Props del componente */
interface SystemGraphicsProps { procesos: Process[] }

/**
 * SystemGraphics
 * - Recibe la lista de procesos y presenta cuatro vistas:
 *   1) Uso de CPU por proceso (BarChart)
 *   2) Progreso por proceso (LineChart)
 *   3) Consumo estimado de RAM (AreaChart)
 *   4) Estado general (tarjeta con promedio)
 *
 * Las métricas son estimadas/inferidas a partir de los campos del `Process`.
 */
export default function SystemGraphics({ procesos }: SystemGraphicsProps) {
  // Determinar si el usuario tiene preferencia por dark mode (si estamos en navegador)
  const isDark =
    typeof window !== "undefined" &&
    window.matchMedia &&
    window.matchMedia("(prefers-color-scheme: dark)").matches;

  // Colores y variables visuales que dependen del tema (dark / light)
  const strokeColor = isDark ? "hsl(220 12% 70%)" : "hsl(220 15% 25%)"; // color de ejes / texto pequeño
  const gridColor = isDark ? "hsl(220 12% 20%)" : "hsl(220 15% 95%)"; // color de la rejilla del chart
  const primaryColor = isDark ? "hsl(200 90% 62%)" : "hsl(222 85% 52%)"; // color principal para series
  const accentSuccess = isDark ? "hsl(140 60% 60%)" : "hsl(145 70% 45%)"; // color para estados buenos
  const accentWarn = "hsl(35 90% 55%)"; // advertencia
  const accentDanger = "hsl(0 80% 60%)"; // peligro / bajo rendimiento

  // ----------------------------
  // CPU: construir dataset simple para la gráfica de CPU
  // ----------------------------
  // Nota: asumimos que solo el proceso en 'ejecutando' debería reportar CPU > 0,
  // pero si `tiempo_cpu` viene explícitamente lo usamos (clamp 0..100).
  const cpuData = useMemo(() => {
    if (!procesos?.length) return []; // sin procesos -> array vacío

    return procesos.map((p) => ({
      name: p.nombre, // etiqueta en eje X
      cpu:
        typeof p.tiempo_cpu === "number"
          ? Math.max(0, Math.min(100, p.tiempo_cpu)) // si viene uso CPU, clamped
          : p.estado === "ejecutando"
          ? 100 // si no viene y está ejecutando, mostrar 100% (indicador visual)
          : 0, // en cualquier otro caso, 0
      progreso: p.progreso ?? 0, // avance por proceso (0..100)
      estado: p.estado, // estado textual (para tooltips si se desea)
      pid: p.pid, // pid por si necesitamos referencias
    }));
  }, [procesos]); // recalcular solo si cambia `procesos`

  // ----------------------------
  // Progreso promedio (número): usar reduce y return round
  // ----------------------------
  const progresoTotal = useMemo(() => {
    if (!procesos?.length) return 0;
    const sum = procesos.reduce((s, p) => s + (p.progreso ?? 0), 0);
    return Math.round(sum / procesos.length); // promedio entero
  }, [procesos]);

  // ----------------------------
  // RAM: heurística simple para estimar "consumo" relativo
  // ----------------------------
  // ramFactorFor: devuelve un factor (0..1) según estado/residency para ponderar uso
  const ramFactorFor = (p: Process) => {
    if (p.estado === "terminado") return 0; // terminado -> no consume
    if (p.estado === "inactivo") return 0; // inactivo -> no residente
    if (p.estado === "suspendido") {
      // suspendido y no residente -> muy poca RAM; si residente -> algo más
      return p.resident === false ? 0.05 : 0.35;
    }
    if (p.estado === "listo") return 0.7; // listos mantienen parte de su working set
    if (p.estado === "ejecutando") return 1; // ejecutando -> máximo
    return 0; // fallback
  };

  // ramTotal: métrica agregada (0..100) que intenta resumir consumo relativo
  const ramTotal = useMemo(() => {
    if (!procesos?.length) return 0;
    const sum = procesos.reduce((acc, p) => {
      const base = 8; // base nominal por proceso (MB abstractos)
      const iterBonus = (p.iteracion ?? 0) * 0.4; // bonus por iteraciones
      const priorityBonus = p.interactividad
      const factor = ramFactorFor(p); // factor según estado
      return acc + (base + iterBonus + priorityBonus) as any * factor; // aportación por proceso
    }, 0);

    // normalizar: dividir por un estimador (procesos.length * 20) y llevar a porcentaje 0..100
    return Math.min(100, Math.round((sum / (procesos.length * 20)) * 100));
  }, [procesos]);

  // ramData: serie por proceso para mostrar en AreaChart (valores 0..100 aproximados)
  const ramData = useMemo(() => {
    if (!procesos?.length) return [{ time: "T0", ram: 0 }];
    return procesos.map((p, i) => {
      const base = p.interactividad as any;
      const factor = ramFactorFor(p);
      // cada punto T{i} contiene un valor ram clamped a 100
      return { time: `T${i + 1}`, ram: Math.min(100, Math.round(base * factor)) };
    });
  }, [procesos]);

  // helper para elegir color según progreso
  const getProgressColor = (value: number) => (value < 40 ? accentDanger : value < 80 ? accentWarn : accentSuccess);

  // estilo inline para el tooltip de Recharts (usar variables del CSS global para consistencia)
  const tooltipStyle = {
    backgroundColor: "hsl(var(--card))",
    border: `1px solid hsl(var(--border))`,
    borderRadius: "0.5rem",
    color: "hsl(var(--foreground))",
  };

  // ----------------------------
  // Render: cuadrícula de 2x2 (responsive)
  // ----------------------------
  return (
    <div className={cn("grid gap-4", "md:flex md:flex-col", "lg:grid lg:grid-cols-2 lg:grid-rows-2 lg:gap-6")}>
      {/* ---------------- CPU (BarChart) ---------------- */}
      <Card className="shadow-sm border border-border/40 bg-card">
        <CardHeader>
          <CardTitle className="text-base font-medium text-foreground/90">Uso de CPU por proceso</CardTitle>
        </CardHeader>

        <CardContent>
          {/* contenedor con altura fija para la gráfica */}
          <div className="h-[240px]">
            <ResponsiveContainer>
              {/* BarChart sencillo que muestra `cpu` por `name` */}
              <BarChart data={cpuData}>
                {/* rejilla y ejes con colores dependientes del tema */}
                <CartesianGrid strokeDasharray="3 3" stroke={gridColor} />
                <XAxis dataKey="name" stroke={strokeColor} />
                <YAxis stroke={strokeColor} domain={[0, 100]} tickFormatter={(v) => `${v}%`} />
                {/* tooltip personalizado que formatea el valor como porcentaje */}
                <ChartTooltip contentStyle={tooltipStyle} formatter={(value: any) => [`${value}%`, "CPU"]} />
                {/* la barra usa primaryColor; radius para esquinas redondeadas */}
                <Bar dataKey="cpu" fill={primaryColor} radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      {/* ---------------- Progreso (LineChart / "ojiva") ---------------- */}
      <Card className="shadow-sm border border-border/40 bg-card">
        <CardHeader>
          <CardTitle className="text-base font-medium text-foreground/90">Progreso de procesos (ojiva)</CardTitle>
        </CardHeader>

        <CardContent>
          <div className="h-[240px]">
            <ResponsiveContainer>
              {/* LineChart usando la misma `cpuData`, pero dibujando `progreso` */}
              <LineChart data={cpuData}>
                <CartesianGrid strokeDasharray="3 3" stroke={gridColor} />
                <XAxis dataKey="name" stroke={strokeColor} />
                <YAxis stroke={strokeColor} domain={[0, 100]} tickFormatter={(v) => `${v}%`} />
                <ChartTooltip contentStyle={tooltipStyle} formatter={(value: any) => [`${value}%`, "Progreso"]} />

                {/* Línea con puntos coloreados según progreso (custom dot) */}
                <Line
                  type="monotone"
                  dataKey="progreso"
                  stroke={primaryColor}
                  strokeWidth={2.5}
                  dot={(props: any) => {
                    // props.payload.progreso es el valor del punto; elegir color con la función helper
                    const color = getProgressColor(props.payload.progreso);
                    // devolver un SVG circle personalizado
                    return <circle cx={props.cx} cy={props.cy} r={4} fill={color} stroke={color} />;
                  }}
                  activeDot={{ r: 6, stroke: primaryColor, strokeWidth: 2 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>

          {/* mostrar el promedio calculado arriba */}
          <div className="mt-3 text-sm text-muted-foreground">
            Promedio total: <span className="text-foreground font-semibold">{progresoTotal}%</span>
          </div>
        </CardContent>
      </Card>

      {/* ---------------- RAM (AreaChart) ---------------- */}
      <Card className="shadow-sm border border-border/40 bg-card">
        <CardHeader>
          <CardTitle className="text-base font-medium text-foreground/90">Consumo estimado de RAM</CardTitle>
        </CardHeader>

        <CardContent>
          <div className="h-[240px]">
            <ResponsiveContainer>
              {/* AreaChart mostrando `ram` por `time` (serie simplificada por proceso) */}
              <AreaChart data={ramData}>
                {/* gradient para relleno del área */}
                <defs>
                  <linearGradient id="ramGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={primaryColor} stopOpacity={0.6} />
                    <stop offset="95%" stopColor={primaryColor} stopOpacity={0.1} />
                  </linearGradient>
                </defs>

                <CartesianGrid strokeDasharray="3 3" stroke={gridColor} />
                <XAxis dataKey="time" stroke={strokeColor} />
                <YAxis stroke={strokeColor} />
                <ChartTooltip contentStyle={tooltipStyle} />
                {/* Area con fill usando el gradiente definido */}
                <Area type="monotone" dataKey="ram" stroke={primaryColor} fill="url(#ramGradient)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>

          {/* mostrar RAM estimada agregada */}
          <div className="mt-3 text-sm text-muted-foreground">
            RAM estimada: <span className="text-foreground font-semibold">{ramTotal}%</span>
          </div>
        </CardContent>
      </Card>

      {/* ---------------- Estado general (tarjeta resumen) ---------------- */}
      <Card className="shadow-sm border border-border/40 bg-card">
        <CardHeader>
          <CardTitle className="text-base font-medium text-foreground/90">Estado general</CardTitle>
        </CardHeader>

        <CardContent className="flex flex-col justify-center items-center h-[240px] space-y-3">
          {/* Muestra el promedio de progreso (valor grande) */}
          <div className="text-3xl font-semibold text-foreground">{progresoTotal}%</div>
          <div className="text-sm text-muted-foreground text-center">
            Promedio global: tiempo medio y consumo estimado de recursos.
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
