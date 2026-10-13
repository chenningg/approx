import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Link,
  Outlet,
  createFileRoute,
  redirect,
  useNavigate,
} from "@tanstack/react-router";
import { BoxesIcon, LogOutIcon } from "lucide-react";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { logout as logoutRequest } from "@/features/auth/api";
import { authKey, verifyQueryOptions } from "@/features/auth/queries";

function initials(username?: string) {
  return username ? username.slice(0, 2).toUpperCase() : "??";
}

function UserMenu() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { data: user } = useQuery(verifyQueryOptions);

  async function handleLogout() {
    try {
      await logoutRequest();
    } catch {
      // Clear the local session even if the request fails.
    }
    queryClient.removeQueries({ queryKey: authKey });
    navigate({ to: "/login" });
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          aria-label="Open user menu"
          className="flex size-9 cursor-pointer items-center justify-center rounded-full bg-primary/10 text-sm font-semibold text-primary ring-1 ring-primary/20 transition-colors outline-none hover:ring-primary/40"
        >
          {initials(user?.username)}
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" sideOffset={8} className="w-56">
        <DropdownMenuLabel>
          <div className="flex flex-col">
            <span className="truncate text-sm font-medium text-foreground">
              {user?.username ?? "Signed in"}
            </span>
            {user?.email && (
              <span className="truncate text-xs text-muted-foreground">
                {user.email}
              </span>
            )}
          </div>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem variant="destructive" onSelect={handleLogout}>
          <LogOutIcon />
          Log out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function AppLayout() {
  return (
    <div className="flex h-svh flex-col">
      <header className="sticky top-0 z-10 border-b border-border/60 bg-background/80 backdrop-blur">
        <div className="flex h-16 items-center justify-between px-4 sm:px-6">
          <Link to="/upload" className="flex items-center gap-2">
            <div className="flex aspect-square size-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
              <BoxesIcon className="size-4" />
            </div>
            <span className="font-heading text-xl font-bold tracking-tight">
              ApproX
            </span>
          </Link>
          <UserMenu />
        </div>
      </header>
      <main className="flex min-h-0 flex-1 flex-col overflow-y-auto">
        <Outlet />
      </main>
    </div>
  );
}

export const Route = createFileRoute("/_app")({
  beforeLoad: async ({ context }) => {
    try {
      await context.queryClient.query(verifyQueryOptions);
    } catch {
      context.queryClient.removeQueries({ queryKey: authKey });
      throw redirect({ to: "/login" });
    }
  },
  component: AppLayout,
});
