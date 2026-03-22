"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Inbox,
  PenSquare,
  Activity,
  Settings,
  Sparkles,
  Moon,
  Sun,
  Keyboard,
  MessageCircleQuestion,
} from "lucide-react";
import { useTheme } from "next-themes";
import { cn } from "@/lib/dirac/utils";
import { useAppState } from "@/lib/dirac/store";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

export function AppNav() {
  const pathname = usePathname();
  const { composeOpen, setComposeOpen, setComposeMinimized, unreadCount } = useAppState();
  const { theme, setTheme } = useTheme();

  const navLinks = [
    { href: "/inbox",    label: "Inbox",    icon: Inbox,    badge: unreadCount > 0 ? unreadCount : null },
    { href: "/activity", label: "Activity", icon: Activity, badge: null },
    { href: "/settings", label: "Settings", icon: Settings, badge: null },
  ];

  return (
    <nav className="dirac-panel flex w-16 flex-col items-center py-4">
      {/* Logo */}
      <div className="mb-6 flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
        <Sparkles className="h-4 w-4" />
      </div>

      {/* Compose */}
      <button
        onClick={() => { setComposeOpen(true); setComposeMinimized(false); }}
        className="mb-4 flex w-12 flex-col items-center gap-0.5 rounded-lg bg-primary px-1 py-2 text-primary-foreground transition-colors hover:bg-primary/90"
      >
        <PenSquare className="h-4 w-4" strokeWidth={2} />
        <span className="text-[9px] font-medium leading-none">Compose</span>
      </button>

      {/* Nav items */}
      <div className="flex flex-1 flex-col items-center gap-1">
        {navLinks.map(({ href, label, icon: Icon, badge }) => {
          const isActive = pathname === href || pathname.startsWith(href + "/");
          return (
            <Tooltip key={href} delayDuration={0}>
              <TooltipTrigger asChild>
                <Link
                  href={href}
                  className={cn(
                    "relative flex h-10 w-10 items-center justify-center rounded-lg transition-colors",
                    isActive
                      ? "bg-accent text-accent-foreground"
                      : "text-muted-foreground hover:bg-accent/50 hover:text-foreground",
                  )}
                >
                  <Icon className="h-[18px] w-[18px]" strokeWidth={1.75} />
                  {/* Unread badge */}
                  {badge !== null && (
                    <span className="absolute -top-0.5 -right-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[9px] font-bold text-primary-foreground leading-none">
                      {badge > 99 ? "99+" : badge}
                    </span>
                  )}
                </Link>
              </TooltipTrigger>
              <TooltipContent side="right" sideOffset={8}>{label}</TooltipContent>
            </Tooltip>
          );
        })}
      </div>

      {/* Discord support */}
      <Tooltip delayDuration={0}>
        <TooltipTrigger asChild>
          <a
            href="https://discord.gg/9AMpVkk5yv"
            target="_blank"
            rel="noopener noreferrer"
            className="mb-1 flex h-10 w-10 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-accent/50 hover:text-foreground"
          >
            <MessageCircleQuestion className="h-[18px] w-[18px]" strokeWidth={1.75} />
          </a>
        </TooltipTrigger>
        <TooltipContent side="right" sideOffset={8}>Get help on Discord</TooltipContent>
      </Tooltip>

      {/* Keyboard shortcuts hint */}
      <Tooltip delayDuration={0}>
        <TooltipTrigger asChild>
          <button
            onClick={() => window.dispatchEvent(new CustomEvent("dirac:shortcuts-help"))}
            className="mb-1 flex h-10 w-10 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-accent/50 hover:text-foreground"
          >
            <Keyboard className="h-[18px] w-[18px]" strokeWidth={1.75} />
          </button>
        </TooltipTrigger>
        <TooltipContent side="right" sideOffset={8}>Keyboard shortcuts (?)</TooltipContent>
      </Tooltip>

      {/* Theme toggle */}
      <Tooltip delayDuration={0}>
        <TooltipTrigger asChild>
          <button
            onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
            className="flex h-10 w-10 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-accent/50 hover:text-foreground"
          >
            <Sun  className="h-[18px] w-[18px] rotate-0 scale-100 transition-transform dark:-rotate-90 dark:scale-0" strokeWidth={1.75} />
            <Moon className="absolute h-[18px] w-[18px] rotate-90 scale-0 transition-transform dark:rotate-0 dark:scale-100" strokeWidth={1.75} />
          </button>
        </TooltipTrigger>
        <TooltipContent side="right" sideOffset={8}>
          {theme === "dark" ? "Light mode" : "Dark mode"}
        </TooltipContent>
      </Tooltip>
    </nav>
  );
}
