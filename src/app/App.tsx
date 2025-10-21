import "./App.css";
import { MainContent } from "@/layouts/content/main-content";
import { WindowMenu } from "@/layouts/window-menu/window-menu";
import { Button } from "@/shared/components/ui/button";
import { useNavigate } from "react-router-dom";

import { useProcessContext } from "@/shared/context/ProcessContext"
import { RefreshCcw } from "lucide-react";

function App() {
  const navigate = useNavigate()
  const { limpiarProcesosSimulados, setProcesosReales } = useProcessContext()

  const recargar = async () => {
    limpiarProcesosSimulados()
    setProcesosReales([])
  }

  return (
    <main className="h-screen flex flex-col">
      <header>
        <WindowMenu />
      </header>

      <div className="flex h-20 justify-center items-center gap-7">
        <Button onClick={() => navigate("/monitor")}>Monitor</Button>
        <Button onClick={() => navigate("/simulador")}>Simulador</Button>
        <Button onClick={recargar}>
          <RefreshCcw/>
        </Button>
      </div>

      <section className="flex-1 flex min-h-0">
        <MainContent />
      </section>
    </main>
  )
}


export default App;
