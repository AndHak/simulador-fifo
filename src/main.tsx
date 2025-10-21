import React from "react";
import ReactDOM from "react-dom/client";
import App from "./app/App";
import { ThemeProvider } from "./shared/theme/theme-provider";
import { BrowserRouter } from "react-router-dom";
import { ProcessProvider } from "./shared/context/ProcessContext";

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
    <React.StrictMode>
        <ThemeProvider>
            <BrowserRouter>
                <ProcessProvider>
                    <App />
                </ProcessProvider>
            </BrowserRouter>
        </ThemeProvider>
    </React.StrictMode>
);
