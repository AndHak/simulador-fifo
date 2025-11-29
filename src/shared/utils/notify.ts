import type { ToastContainerProps, TypeOptions, ToastPosition } from "react-toastify"
import "react-toastify/dist/ReactToastify.css"


export type Theme = "dark" | "light" | "system"

type ToastClassNameContext = {
  type?: TypeOptions
  defaultClassName?: string
  position?: ToastPosition
  rtl?: boolean
}

function resolveTheme(theme: Theme): "dark" | "light" {
  if (typeof window === "undefined") return "light"
  if (theme === "system") {
    return window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light"
  }
  return theme === "dark" ? "dark" : "light"
}

export const createToastConfig = (theme: Theme): ToastContainerProps => {
  const resolved = resolveTheme(theme)

  const toastClassName = (context?: ToastClassNameContext) => {
    const t = context?.type ?? "default"

    const light = {
      base: "relative flex items-start gap-4 rounded-xs p-5 shadow-lg pointer-events-auto overflow-hidden font-medium text-sm transition-all duration-300 hover:shadow-xl hover:scale-[1.01] transform-gpu text-black/80",
      success: "bg-stone-50",
      error: "bg-stone-50",
      info: "bg-stone-50",
      warning: "bg-stone-50",
      default: "bg-stone-50 flex flex-col justify-center items-center",
    }

    const dark = {
      base: "relative flex items-start gap-4 rounded-xs p-5 shadow-lg pointer-events-auto overflow-hidden font-medium text-sm transition-all duration-300 hover:shadow-xl hover:scale-[1.01] transform-gpu text-white/80",
      success: "bg-slate-800 ",
      error: "bg-slate-800",
      info: "bg-slate-800 ",
      warning: "bg-slate-800",
      default: "bg-slate-800 flex flex-col justify-center items-center",
    }

    const palette = resolved === "dark" ? dark : light
    const map: Record<string, string> = {
      success: palette.success,
      error: palette.error,
      info: palette.info,
      warning: palette.warning,
      default: palette.default,
    }

    return `${palette.base} ${map[t] ?? map["default"]}`
  }

return {
  position: "top-center",
  autoClose: 2000,
  hideProgressBar: false,
  closeOnClick: true,
  pauseOnHover: true,
  draggable: true,
  theme: resolved,
  toastClassName,
  className: "z-[9999] font-sans",
  newestOnTop: true,
  rtl: false,
  limit: 3,
  pauseOnFocusLoss: true,
  draggablePercent: 60,
  closeButton: true,
  style: { gap: "16px", margin: '100px 0px 0px 0px' },
} satisfies ToastContainerProps
}
