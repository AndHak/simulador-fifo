import { useEffect } from "react";
import { Card, CardContent } from "@/shared/components/ui/card";
import { Progress } from "@/shared/components/ui/progress";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/shared/components/ui/table";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  ResponsiveContainer,
} from "recharts";
import { invoke } from "@tauri-apps/api/core";
import { Button } from "@/shared/components/ui/button";
import { EllipsisVertical } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/shared/components/ui/dropdown-menu";
import { useNavigate } from "react-router-dom";
import { Proceso, useProcessContext } from "@/shared/context/ProcessContext";

export default function ProcessMonitor() {
  const { procesosReales, setProcesosReales, agregarProcesoSimulado } = useProcessContext();
  const navigate = useNavigate();

  const obtenerProcesos = async () => {
    try {
      // invoke con genérico — devuelve Proceso[]
      const data = await invoke<Proceso[]>("obtener_procesos");
      // validación ligera: asegurar que sea array
      if (!Array.isArray(data)) {
        console.error("Respuesta inválida de obtener_procesos", data);
        setProcesosReales([]);
        return;
      }
      setProcesosReales(data);
    } catch (err) {
      console.error("Error obteniendo procesos:", err);
      setProcesosReales([]);
    }
  };

  const simularProceso = (proceso: any) => {
    agregarProcesoSimulado(proceso);
    navigate("/simulador");
  };

  useEffect(() => {
    obtenerProcesos();
    const intervalo = setInterval(obtenerProcesos, 10000);
    return () => clearInterval(intervalo);
  }, []);

  return (
    <div className="p-6 grid gap-6">
      <h1 className="text-2xl font-bold">Monitor de Procesos (modo real)</h1>

      <Card>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>PID</TableHead>
                <TableHead>Nombre</TableHead>
                <TableHead>Prioridad</TableHead>
                <TableHead>Interactividad</TableHead>
                <TableHead>Tiempo CPU (%)</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead>% Avance</TableHead>
                <TableHead>Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {procesosReales.map((p) => (
                <TableRow key={p.pid}>
                  <TableCell>{p.pid}</TableCell>
                  <TableCell>{p.nombre}</TableCell>
                  <TableCell>{p.prioridad}</TableCell>
                  <TableCell>{p.interactividad}</TableCell>
                  <TableCell>{p.tiempo_cpu.toFixed(2)}</TableCell>
                  <TableCell>{p.estado}</TableCell>
                  <TableCell className="w-40">
                    <Progress value={p.avance} />
                  </TableCell>
                  <TableCell className="w-10">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild className="justify-center">
                        <Button variant="ghost">
                          <EllipsisVertical />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent>
                        <Button
                          onClick={() => simularProceso(p)}
                          variant="ghost"
                        >
                          Simulación de este proceso
                        </Button>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="justify-center">
          <h2 className="text-lg font-semibold mb-4">
            Distribución de Uso de CPU
          </h2>
          <div className="w-full">
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={procesosReales.slice(0, 10)} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis type="number" />
                <YAxis type="category" dataKey="nombre" />
                <Tooltip />
                <Bar dataKey="tiempo_cpu" fill="#333" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
