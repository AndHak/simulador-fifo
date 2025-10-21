import SimulationProcess from "./SimulationProcess";
import SystemGraphics from "./SystemGraphics";

export const SimuladorPage = () => {
    return (
        <main className="justify-center">
            <div>
                <SimulationProcess/>
                <SystemGraphics/>
            </div>
        </main>
    );
};
