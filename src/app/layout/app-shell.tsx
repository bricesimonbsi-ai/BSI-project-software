import type { ReactNode } from "react";
import { NavLink, useNavigate } from "react-router-dom";
import { Briefcase, ListChecks, Settings, LogOut, Bell, Sun, Moon, Monitor } from "lucide-react";
import { useAuth } from "@/app/providers/auth-provider";
import { useThemeStore } from "@/features/theme/theme-store";
import { useNotifications } from "@/features/notifications/use-notifications";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import type { NotificationRow } from "@/types/database";

const navItems = [
  { to: "/", label: "Accueil", icon: Briefcase, end: true },
  { to: "/todos", label: "Tâches", icon: ListChecks },
  { to: "/settings", label: "Réglages", icon: Settings },
];

export function AppShell({ children }: { children: ReactNode }) {
  const { profile, signOut } = useAuth();
  const mode = useThemeStore((s) => s.mode);
  const setMode = useThemeStore((s) => s.setMode);
  const { data: notifications, unreadCount, markRead } = useNotifications();
  const navigate = useNavigate();

  const modeIcon = mode === "dark" ? Moon : mode === "light" ? Sun : Monitor;
  const ModeIcon = modeIcon;

  function cycleMode() {
    setMode(mode === "light" ? "dark" : mode === "dark" ? "system" : "light");
  }

  function handleNotificationClick(n: NotificationRow) {
    markRead(n.id);
    const projectId = n.payload.project_id as string | undefined;
    if ((n.type === "journal_reaction" || n.type === "journal_comment") && projectId) {
      navigate(`/projects/${projectId}?tab=journal`);
    } else if (n.type === "todo_assigned" && projectId) {
      navigate(`/projects/${projectId}?tab=todos`);
    }
  }

  return (
    <div className="flex min-h-screen flex-col">
      <header className="sticky top-0 z-40 border-b border-border bg-background/95 backdrop-blur">
        <div className="container flex h-14 items-center justify-between">
          <NavLink to="/" className="flex items-center gap-2 font-semibold text-foreground">
            <img src="/icons/icon-192.png" alt="" className="h-6 w-6 rounded-md" />
            Projeko
          </NavLink>
          <nav className="hidden gap-1 md:flex">
            {navItems.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                className={({ isActive }) =>
                  cn(
                    "flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium text-muted-foreground hover:text-foreground",
                    isActive && "bg-secondary text-foreground"
                  )
                }
              >
                <item.icon className="h-4 w-4" />
                {item.label}
              </NavLink>
            ))}
          </nav>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="icon" onClick={cycleMode} title="Changer de thème">
              <ModeIcon className="h-4 w-4" />
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="relative">
                  <Bell className="h-4 w-4" />
                  {unreadCount > 0 && (
                    <Badge variant="destructive" className="absolute -right-1 -top-1 h-4 min-w-4 justify-center px-1 text-[10px]">
                      {unreadCount}
                    </Badge>
                  )}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-80">
                <DropdownMenuLabel>Notifications</DropdownMenuLabel>
                <DropdownMenuSeparator />
                {(!notifications || notifications.length === 0) && (
                  <p className="px-2 py-4 text-center text-sm text-muted-foreground">Aucune notification</p>
                )}
                {notifications?.slice(0, 8).map((n) => (
                  <DropdownMenuItem key={n.id} onClick={() => handleNotificationClick(n)} className="flex-col items-start gap-0.5">
                    <span className={cn("text-sm", !n.read_at && "font-semibold")}>{n.title}</span>
                    {n.body && <span className="text-xs text-muted-foreground">{n.body}</span>}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button>
                  <Avatar>
                    <AvatarFallback>{(profile?.display_name ?? profile?.email ?? "?").slice(0, 2).toUpperCase()}</AvatarFallback>
                  </Avatar>
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuLabel>
                  {profile?.display_name}
                  {profile?.is_admin && <Badge className="ml-2">Admin</Badge>}
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => signOut()}>
                  <LogOut className="mr-2 h-4 w-4" /> Déconnexion
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </header>

      <main className="container flex-1 py-6 pb-24 md:pb-6">{children}</main>

      <nav className="fixed bottom-0 left-0 right-0 z-40 flex border-t border-border bg-background md:hidden">
        {navItems.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.end}
            className={({ isActive }) =>
              cn(
                "flex flex-1 flex-col items-center gap-1 py-2 text-xs text-muted-foreground",
                isActive && "text-foreground"
              )
            }
          >
            <item.icon className="h-5 w-5" />
            {item.label}
          </NavLink>
        ))}
      </nav>
    </div>
  );
}
