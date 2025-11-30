import { Icon } from '@iconify/react';
import { open } from "@tauri-apps/plugin-shell"
import { cn } from "@/shared/lib/utils";

// ----------------------------------------------------------------------
// Botón simplificado
// ----------------------------------------------------------------------

const Button = ({ variant = "default", size = "default", className = "", children, onClick }: any) => {
    const baseStyle = "inline-flex items-center justify-center rounded-lg text-sm font-medium transition-colors focus-visible:outline-none disabled:opacity-50 disabled:pointer-events-none ring-offset-background";
    const variants: any = {
      default: "bg-primary text-primary-foreground hover:bg-primary/90 shadow-lg shadow-primary/20",
      outline: "border border-input bg-background hover:bg-accent hover:text-accent-foreground",
      ghost: "hover:bg-accent hover:text-accent-foreground",
    };
    const sizes: any = {
      sm: "h-9 px-3 rounded-lg",
      default: "h-10 py-2 px-4",
    };
    return (
      <button className={cn(baseStyle, variants[variant] || variants.default, sizes[size] || sizes.default, className)} onClick={onClick}>
        {children}
      </button>
    );
};

// ----------------------------------------------------------------------
// Íconos Iconify asignados a cada tecnología
// ----------------------------------------------------------------------

const TECHNOLOGIES = [
    { name: "Rust", description: "Backend y lógica de sistema.", icon: "simple-icons:rust", colorClass: "text-orange-600 dark:text-orange-500" },
    { name: "Tauri", description: "Framework para la aplicación de escritorio.", icon: "simple-icons:tauri", colorClass: "text-yellow-500 dark:text-yellow-400" },
    { name: "React", description: "Frontend y lógica de interfaz de usuario.", icon: "logos:react" },
    { name: "TypeScript", description: "Lenguaje de tipado estático para el Frontend.", icon: "logos:typescript-icon" },
    { name: "Tailwind CSS", description: "Estilización rápida y diseño responsivo.", icon: "logos:tailwindcss-icon" },
    { name: "sysinfo", description: "Librería de Rust para monitorizar procesos del sistema.", icon: "mdi:chip", colorClass: "text-green-600 dark:text-green-500" },
];

const AboutPage = () => {
    const openRepository = async () => {
        try {
            await open("https://github.com/AndHak/simulador-fifo.git");
        } catch (error) {
            console.error("Error opening repository:", error);
        }
    };

    return (
        <section className="min-h-screen flex items-start pt-20 justify-center bg-background p-4 animate-in fade-in duration-500">
            <div className="max-w-3xl w-full space-y-12">

                {/* Header */}
                <div className="text-center space-y-2">
                    <h1 className="text-5xl font-extrabold bg-gradient-to-r from-sky-600 to-indigo-600 dark:from-sky-400 dark:to-indigo-400 bg-clip-text text-transparent">
                        Acerca del Proyecto
                    </h1>
                    <p className="text-muted-foreground max-w-xl mx-auto">
                        Simulador y monitor de procesos diseñado para la asignatura de Sistemas Operativos.
                    </p>
                    <div className="h-1 w-32 bg-gradient-to-r from-sky-600 to-indigo-600 dark:from-sky-400 dark:to-indigo-400 mx-auto rounded-full mt-4"></div>
                </div>

                {/* Sección 1: Creadores */}
                <div className="bg-card p-6 md:p-8 rounded-xl shadow-lg border border-border space-y-6">
                    <div className="flex items-center gap-3">
                        <Icon icon="mdi:account-group" className="w-7 h-7 text-indigo-600 dark:text-indigo-400" />
                        <h2 className="text-2xl font-semibold text-card-foreground">Equipo de Desarrollo</h2>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        {[
                            "Andrés Felipe Martinez Guerra",
                            "Sebastian David Ordoñez Bolaños",
                            "Juan Felipe Pantoja Andrade",
                            "Yoel Alejandro Torres Arciniegas"
                        ].map((creator) => (
                            <div
                                key={creator}
                                className="p-3 rounded-lg border border-border bg-muted/50 
                                           hover:shadow-md transition-all hover:bg-muted"
                            >
                                <span className="text-foreground font-medium">{creator}</span>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Sección 2: Tecnologías */}
                <div className="bg-card p-6 md:p-8 rounded-xl shadow-lg border border-border space-y-6">
                    <div className="flex items-center gap-3">
                        <Icon icon="mdi:code-tags" className="w-7 h-7 text-sky-600 dark:text-sky-400" />
                        <h2 className="text-2xl font-semibold text-card-foreground">Tecnologías Clave</h2>
                    </div>

                    <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                        {TECHNOLOGIES.map(({ name, description, icon, colorClass }) => (
                            <div
                                key={name}
                                className="p-4 rounded-lg border border-border bg-muted/50 
                                           flex flex-col items-center text-center 
                                           hover:shadow-md transition-all hover:bg-muted group"
                            >
                                <div className={cn("p-2 rounded-full mb-2 bg-background shadow-sm group-hover:scale-110 transition-transform", colorClass)}>
                                    <Icon icon={icon} className="w-7 h-7" />
                                </div>
                                <h3 className="font-bold text-foreground">{name}</h3>
                                <p className="text-xs text-muted-foreground mt-1">{description}</p>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Footer */}
                <div className="text-center pt-8 border-t border-border space-y-3">
                    <span className="text-sm text-muted-foreground block">
                        Simulador FIFO 2025© - Universidad de Nariño
                    </span>

                    <Button variant="outline" size="sm" className="gap-2" onClick={openRepository}>
                        <Icon icon="mdi:github" className="w-4 h-4" />
                        Ver Repositorio
                    </Button>
                </div>
            </div>
        </section>
    );
};

export default AboutPage;
