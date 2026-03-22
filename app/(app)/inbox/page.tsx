"use client";

import { ThreadList } from "@/components/inbox/thread-list";
import { ThreadView } from "@/components/inbox/thread-view";
import { AiSidebar } from "@/components/ai-sidebar/ai-sidebar";
import { useAppState } from "@/lib/dirac/store";
import { Button } from "@/components/ui/button";
import { Sparkles } from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

export default function InboxPage() {
  const { aiSidebarOpen, setAiSidebarOpen } = useAppState();

  return (
    <>
      <div className="dirac-panel relative flex flex-1 overflow-hidden">
        <ThreadList />
        <ThreadView />

        {!aiSidebarOpen && (
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="outline"
                size="icon"
                className="absolute bottom-4 right-4 h-10 w-10 rounded-full shadow-sm"
                onClick={() => setAiSidebarOpen(true)}
              >
                <Sparkles className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="left">Open AI sidebar</TooltipContent>
          </Tooltip>
        )}
      </div>
      <AiSidebar />
    </>
  );
}
