import { Button } from "@/shared/components/ui/button"
import { Github } from "lucide-react"
import { open } from "@tauri-apps/plugin-shell"

const AboutPage = () => {
  const openRepository = async () => {
    try {
      await open("https://github.com/AndHak/simulador-fifo.git")
    } catch (error) {
      console.error("Error opening repository:", error)
    }
  }

  return (
    <section className="min-h-screen flex items-start pt-20 justify-center bg-gradient-to-br from-background to-muted/20 p-4">
      <div className="max-w-2xl w-full space-y-12">
        {/* Header */}
        <div className="text-center space-y-2">
          <h1 className="text-5xl font-bold bg-gradient-to-r from-sky-600 to-indigo-600 bg-clip-text text-transparent">
            Creadores
          </h1>
          <div className="h-1 w-20 bg-gradient-to-r from-sky-600 to-indigo-600 mx-auto rounded-full"></div>
        </div>

        {/* Creators Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {[
            "Andrés Felipe Martinez Guerra",
            "Sebastian David Ordoñez Bolaños",
            "Juan Felipe Pantoja Andrade",
            "Yoel Alejandro Torres Arciniegas"
          ].map((creator) => (
            <div
              key={creator}
              className="p-4 rounded-lg border border-border/50 bg-card/50 hover:bg-card hover:border-primary/50 transition-all duration-300 backdrop-blur-sm"
            >
              <span className="text-foreground font-medium">{creator}</span>
            </div>
          ))}
        </div>

        {/* Footer */}
        <div className="text-center pt-8 border-t border-border/30 space-y-3">
          <span className="text-sm text-muted-foreground block">
            Simulador FIFO 2025©
          </span>
          <div className="flex items-center justify-center gap-2">
            <span className="text-sm">Open Source for pull and code -</span>
            <Button variant="outline" size="sm" className="gap-2" onClick={openRepository}>
              <Github className="w-4 h-4" />
              Repositorio
            </Button>
          </div>
        </div>
      </div>
    </section>
  )
}

export default AboutPage