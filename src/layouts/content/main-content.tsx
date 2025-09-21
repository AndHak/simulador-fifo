import GlobalRoutes from "@/routes/globalRoutes.route";
import { ScrollArea } from "@/shared/components/ui/scroll-area";

export const MainContent = () => {
    return (
        <div className="flex flex-1 w-full overflow-hidden">
            <ScrollArea className="h-full w-full">
                    <GlobalRoutes />
            </ScrollArea>
        </div>
    );
};
