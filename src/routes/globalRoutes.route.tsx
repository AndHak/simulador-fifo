import { Route, Routes, Navigate } from "react-router-dom";
import { MonitorPage } from "@/modules/monitor/MonitorPage";
import SimuladorPage from "@/modules/simulador/SimuladorPage";
import AboutPage from "@/modules/monitor/AboutPage";


const GlobalRoutes = () => {
  return (
    <Routes>
      <Route path="/monitor" element={<MonitorPage />} />
      <Route path="/simulador" element={<SimuladorPage />} />
      <Route path="/about" element={<AboutPage/>} />
      <Route path="*" element={<Navigate to="/simulador" replace />} />
    </Routes>
  );
};

export default GlobalRoutes;
