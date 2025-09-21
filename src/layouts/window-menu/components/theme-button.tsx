import { Moon, Sun } from "lucide-react"
import { Button } from "@/shared/components/ui/button"
import { useTheme } from "@/shared/theme/theme-provider"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/shared/components/ui/tooltip"

export function ThemeButton() {
  const { theme, setTheme } = useTheme()

  return (
    <Tooltip>
        <TooltipTrigger asChild>
            <Button
            className="w-7 h-7 no-drag"
            size="icon"
            variant="ghost"
            onClick={() => theme === "light" ? setTheme("dark") : setTheme("light")}>
                {theme === "dark" ? <Sun/> : <Moon/>}
            </Button>
        </TooltipTrigger>
        <TooltipContent>
            {theme === "dark" ? "Tema claro" : "Tema oscuro"}
        </TooltipContent>
    </Tooltip>
  )
}