import { Route, Routes, Navigate } from "react-router-dom";
import { MonitorPage } from "@/modules/monitor/MonitorPage";
import SimuladorPage from "@/modules/simulador/SimuladorPage";


const GlobalRoutes = () => {
  return (
    <Routes>
      <Route path="/monitor" element={<MonitorPage />} />
      <Route path="/simulador" element={<SimuladorPage />} />
      <Route path="*" element={<Navigate to="/monitor" replace />} />
    </Routes>
  );
};

export default GlobalRoutes;
