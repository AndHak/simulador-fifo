// src/shared/components/SystemGraphics.tsx
import { useEffect, useState } from "react";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from "recharts";

// importa funciones y tipos del paquete

type Metrics = {
  timestamp: number;
  cpu: number;
  ram: number;
  disk: number;
  net_rx_kb_s: number;
  net_tx_kb_s: number;
  gpu?: number | null;
};

export default function SystemGraphics({ refreshMs = 2000 }: { refreshMs?: number }) {
  const [history, setHistory] = useState<Metrics[]>([]);

  const fetchMetrics = async () => {
    try {
      // allSysInfo devuelve todo; lo validamos con AllSystemInfo
      const raw = await allSysInfo();
      const parsed = AllSystemInfo.parse(raw);

      // Ejemplo de extracción robusta (las propiedades pueden variar según plataforma)
      // CPU: plugin devuelve un array o un objeto; tomamos el valor principal
      const cpuPct =
        // si tiene cpu.aggregate.usage (depende de la versión), lo usamos, si no usamos cpu[0].usage
        (parsed.cpu?.aggregate?.usage as number) ??
        (Array.isArray(parsed.cpu) ? (parsed.cpu[0]?.usage as number) : (parsed.cpu?.usage as number)) ??
        0;

      // RAM: plugin suele devolver used/total en KB o bytes; usar percentage si existe
      const ramPct = (parsed.memory?.used_percent as number) ?? 0;

      // Disco: algunos plugins dan uso por disco; aquí tomamos total_used_percent si existe
      const diskPct = (parsed.disks?.total_used_percent as number) ?? 0;

      // Red: el plugin puede exponer rates o totales; intentamos obtener rates si están
      const net_rx_kb_s = Number(parsed.networks?.rx_kb_s ?? parsed.networks?.[0]?.rx_kb_s ?? 0);
      const net_tx_kb_s = Number(parsed.networks?.tx_kb_s ?? parsed.networks?.[0]?.tx_kb_s ?? 0);

      const row: Metrics = {
        timestamp: Date.now(),
        cpu: Number(cpuPct ?? 0),
        ram: Number(ramPct ?? 0),
        disk: Number(diskPct ?? 0),
        net_rx_kb_s,
        net_tx_kb_s,
        gpu: (parsed.gpu?.usage_percent as number) ?? null,
      };

      setHistory(prev => {
        const next = [...prev.slice(-59), row];
        return next;
      });
    } catch (err) {
      console.error("Error leyendo system-info:", err);
    }
  };

  useEffect(() => {
    fetchMetrics();
    const id = setInterval(fetchMetrics, refreshMs);
    return () => clearInterval(id);
  }, [refreshMs]);

  return (
    <div className="grid gap-4 md:grid-cols-2">
      {/* (aquí reutilizas tu JSX de gráficas, usando `history` tal como antes) */}
      <div className="h-48 bg-white/5 p-2 rounded">
        <h3 className="font-semibold mb-1">CPU (%)</h3>
        <ResponsiveContainer width="100%" height="80%">
          <LineChart data={history}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="timestamp" tickFormatter={() => ""} />
            <YAxis domain={[0, 100]} />
            <Tooltip labelFormatter={(t: any) => new Date(t).toLocaleTimeString()} />
            <Line type="monotone" dataKey="cpu" stroke="#1f6feb" dot={false} />
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* Resto de gráficas: RAM, DISCO, RED (usa history) — igual que tu componente */}
    </div>
  );
}
