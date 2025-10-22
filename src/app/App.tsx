import "./App.css"
import { MainContent } from "@/layouts/content/main-content"
import { WindowMenu } from "@/layouts/window-menu/window-menu"
import { Button } from "@/shared/components/ui/button"
import { useNavigate, useLocation } from "react-router-dom"
import { RefreshCcw, Cpu, Activity } from "lucide-react"
import { ToastContainer } from "react-toastify"

export default function App() {
  const navigate = useNavigate()
  const location = useLocation()

  const navItems = [
    { path: "/monitor", label: "Monitor", icon: <Activity className="w-4 h-4 mr-2" /> },
    { path: "/simulador", label: "Simulador", icon: <Cpu className="w-4 h-4 mr-2" /> },
  ]

  return (
    <main className="h-screen flex flex-col bg-background text-foreground">
      {/* Encabezado del sistema */}
      <header className="border-b border-border bg-card/50 backdrop-blur-sm">
        <WindowMenu />
      </header>

      {/* Navbar */}
      <nav className="flex justify-center items-center gap-4 py-3 border-b border-border bg-muted/30">
        {navItems.map((item) => (
          <Button
            key={item.path}
            variant={location.pathname === item.path ? "default" : "ghost"}
            onClick={() => navigate(item.path)}
            className={`flex items-center ${
              location.pathname === item.path
                ? "bg-primary text-primary-foreground shadow-sm"
                : "hover:bg-accent hover:text-accent-foreground"
            } transition-all duration-200`}
          >
            {item.icon}
            {item.label}
          </Button>
        ))}

        {/* Botón de refrescar */}
        <Button variant="outline" size="icon" className="ml-4" onClick={() => window.location.reload()}>
          <RefreshCcw className="w-4 h-4" />
        </Button>
      </nav>

      {/* Contenido principal */}
      <section className="flex-1 flex min-h-0">
        <MainContent />
      </section>

      <ToastContainer />
    </main>
  )
}
