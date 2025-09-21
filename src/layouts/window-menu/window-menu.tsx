import { ThemeButton } from "./components/theme-button";
import { WindowControls } from "./components/window-controls";

export const WindowMenu = () => {
    return (
        <div className="relative flex bg-background draggable top-0 h-10 p-0 border-b z-50 w-full justify-between items-center">
            <div className="justify-start items-center no-drag flex">
                <div className="flex w-full pt-0.5 text-center items-center gap-2 px-4 no-drag">
                    <span className="text-sm font-semibold">
                        Simulador FIFO
                    </span>
                </div>
            </div>

            <div className="h-full p-0 m-0 flex gap-3 items-center">
                <ThemeButton />

                <WindowControls />
            </div>
        </div>
    );
};
