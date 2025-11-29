import { Icon } from "@iconify/react";
import { Button } from "@/shared/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/shared/components/ui/tooltip";
import { Process } from "./ProcessFrom";

interface QuickLaunchBarProps {
  onLaunch: (config: Process) => void;
  existingNames: string[];
}

interface AppConfig {
  name: string;
  icon: string;
  color?: string;
  config: Partial<Process>;
}

const APPS: AppConfig[] = [
  {
    name: "VS Code",
    icon: "vscode-icons:file-type-vscode",
    config: {
      tiempo_total: 30,
      quantum: 5,
      interactividad: 3,
    },
  },
  {
    name: "Photoshop",
    icon: "logos:adobe-photoshop",
    config: {
      tiempo_total: 35,
      quantum: 7,
      interactividad: 3,
    },
  },
  {
    name: "Illustrator",
    icon: "logos:adobe-illustrator",
    config: {
      tiempo_total: 30,
      quantum: 6,
      interactividad: 3,
    },
  },
  {
    name: "Premiere Pro",
    icon: "logos:adobe-premiere",
    config: {
      tiempo_total: 40,
      quantum: 8,
      interactividad: 3,
    },
  },
  {
    name: "After Effects",
    icon: "logos:adobe-after-effects",
    config: {
      tiempo_total: 45,
      quantum: 9,
      interactividad: 3,
    },
  },
  {
    name: "Google Chrome",
    icon: "logos:chrome",
    config: {
      tiempo_total: 25,
      quantum: 4,
      interactividad: 3,
    },
  },
  {
    name: "Firefox",
    icon: "logos:firefox",
    config: {
      tiempo_total: 20,
      quantum: 4,
      interactividad: 3,
    },
  },
  {
    name: "Spotify",
    icon: "logos:spotify-icon",
    config: {
      tiempo_total: 20,
      quantum: 3,
      interactividad: 2,
    },
  },
  {
    name: "Discord",
    icon: "logos:discord-icon",
    config: {
      tiempo_total: 25,
      quantum: 4,
      interactividad: 2,
    },
  },
  {
    name: "Slack",
    icon: "logos:slack-icon",
    config: {
      tiempo_total: 15,
      quantum: 3,
      interactividad: 2,
    },
  },
  {
    name: "IntelliJ IDEA",
    icon: "logos:intellij-idea",
    config: {
      tiempo_total: 35,
      quantum: 6,
      interactividad: 3,
    },
  },
  {
    name: "PyCharm",
    icon: "logos:pycharm",
    config: {
      tiempo_total: 30,
      quantum: 5,
      interactividad: 3,
    },
  },
  {
    name: "Figma",
    icon: "logos:figma",
    config: {
      tiempo_total: 25,
      quantum: 5,
      interactividad: 3,
    },
  },
  {
    name: "Notion",
    icon: "logos:notion-icon",
    config: {
      tiempo_total: 15,
      quantum: 3,
      interactividad: 1,
    },
  },
  {
    name: "Word",
    icon: "vscode-icons:file-type-word",
    config: {
      tiempo_total: 30,
      quantum: 5,
      interactividad: 1,
    },
  },
  {
    name: "Excel",
    icon: "vscode-icons:file-type-excel",
    config: {
      tiempo_total: 25,
      quantum: 5,
      interactividad: 2,
    },
  },
  {
    name: "Power Point",
    icon: "vscode-icons:file-type-powerpoint",
    config: {
      tiempo_total: 35,
      quantum: 7,
      interactividad: 3,
    },
  },
  {
    name: "Terminal",
    icon: "flat-color-icons:command-line",
    config: {
      tiempo_total: 10,
      quantum: 2,
      interactividad: 3,
    },
  },
];

export default function QuickLaunchBar({ onLaunch, existingNames }: QuickLaunchBarProps) {
  const handleLaunch = (app: AppConfig) => {
    // Generar un PID temporal (el padre lo manejará o regenerará si es necesario)
    // Pero aquí solo pasamos la config base.
    const processConfig: Process = {
      pid: "", // Se generará en el padre
      nombre: app.name,
      tiempo_total: app.config.tiempo_total!,
      quantum: app.config.quantum!,
      interactividad: app.config.interactividad!,
      // Defaults
      estado: "listo",
      tiempo_restante: app.config.tiempo_total!,
      tiempo_cpu: 0,
      iteracion: 0,
      progreso: 0,
      created_at: Date.now(),
      t_inicio: null,
      t_fin: null,
      tiempo_espera: 0,
      resident: true,
      interactividad_inicial: app.config.interactividad!,
    };
    onLaunch(processConfig);
  };

  return (
    <div className="flex items-center gap-4 p-4 bg-muted/20 rounded-lg border border-border/50 overflow-x-auto">
      <div className="text-sm font-medium text-muted-foreground whitespace-nowrap mr-2">
        Quick Launch:
      </div>
      <div className="flex items-center gap-2">
        {APPS.map((app) => {
          const isRunning = existingNames.includes(app.name);
          return (
            <Tooltip key={app.name}>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className={`h-12 w-12 rounded-xl transition-all hover:bg-background hover:shadow-md ${
                    isRunning ? "opacity-50 grayscale cursor-not-allowed" : "hover:scale-110"
                  }`}
                  onClick={() => !isRunning && handleLaunch(app)}
                  disabled={isRunning}
                >
                  <div className="scale-150">
                    <Icon icon={app.icon} fontSize={64} />
                  </div>
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p>{app.name}</p>
              </TooltipContent>
            </Tooltip>
          );
        })}
      </div>
    </div>
  );
}
