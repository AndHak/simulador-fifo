import { getCurrentWindow } from "@tauri-apps/api/window";
import { Icon } from "@iconify/react";
import "../styles/global-window-menu.css";

const appWindow = getCurrentWindow();

export const WindowControls = () => {
    return (
        <div className="no-drag flex h-full items-center">
            <button
                onClick={() => appWindow.minimize()}
                className="no-drag flex items-center justify-center h-full w-12 hover:bg-accent"
            >
                <Icon icon="mdi-light:minus" width="20" height="20" />
            </button>
            <button
                onClick={() => appWindow.toggleMaximize()}
                className="no-drag flex items-center justify-center h-full w-12 hover:bg-accent"
            >
                <Icon
                    icon="qlementine-icons:windows-unmaximize-16"
                    width="16"
                    height="16"
                />
            </button>
            <button
                onClick={() => appWindow.close()}
                className="no-drag flex items-center justify-center h-full w-12 hover:bg-red-600"
            >
                <Icon
                    icon="material-symbols-light:close"
                    width="20"
                    height="20"
                />
            </button>
        </div>
    );
};
