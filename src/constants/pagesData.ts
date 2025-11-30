import AboutPage from "@/modules/monitor/AboutPage";
import { MonitorPage } from "@/modules/monitor/MonitorPage";
import SimuladorPage from "@/modules/simulador/SimuladorPage";

export const pagesData = {
    "pagina-simulador": {label: "Simulador", href: "/simulador", page: SimuladorPage },
    "pagina-monitor": {label: "Monitor", href: "/monitor", page: MonitorPage },
    "pagina-about": {label: "Acerca De", href: "/about", page: AboutPage }
}