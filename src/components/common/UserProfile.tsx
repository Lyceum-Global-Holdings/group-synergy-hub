import { User, Settings, LogOut, ShieldCheck } from "lucide-react";
import { Link } from "react-router-dom";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { useCurrentUserRoles, getHighestPriorityRole } from "@/hooks/useCurrentUserRoles";
import { useSuperAdmin, useIsAdmin } from "@/hooks/useSuperAdmin";

export function UserProfile() {
  const { user, signOut } = useAuth();
  const { toast } = useToast();
  const { data: roles, isLoading: rolesLoading } = useCurrentUserRoles();
  const { data: isSuperAdmin, isLoading: superAdminLoading } = useSuperAdmin();
  const { data: isAdminRole, isLoading: adminLoading } = useIsAdmin();

  if (!user) return null;

  // Priority: Super Admin > Admin > roles hook > User
  const roleLabel = superAdminLoading || adminLoading || rolesLoading
    ? "Loading..."
    : isSuperAdmin
      ? "Super Admin"
      : isAdminRole
        ? "Admin"
        : (roles && roles.length > 0 ? getHighestPriorityRole(roles).display : "User");
  
  const isAdmin = isSuperAdmin || isAdminRole;

  const handleSignOut = async () => {
    try {
      await signOut();
      toast({
        title: "Signed out",
        description: "You have been successfully signed out.",
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to sign out. Please try again.",
        variant: "destructive",
      });
    }
  };

  const getInitials = (email: string) => {
    return email
      .split('@')[0]
      .split('.')
      .map(part => part.charAt(0).toUpperCase())
      .join('')
      .slice(0, 2);
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger className="flex items-center gap-3 hover:bg-accent rounded-md p-2 transition-colors">
        <Avatar className="h-8 w-8">
          <AvatarImage src={user.user_metadata?.avatar_url} />
          <AvatarFallback className="bg-primary text-primary-foreground">
            {getInitials(user.email || 'U')}
          </AvatarFallback>
        </Avatar>
        <div className="text-left hidden md:block">
          <p className="text-sm font-medium">
            {user.user_metadata?.full_name || user.email?.split('@')[0]}
          </p>
          <p className={`text-xs ${isAdmin ? 'text-primary font-medium' : 'text-muted-foreground'}`}>
            {roleLabel}
          </p>
        </div>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel>
          <div className="flex flex-col space-y-1">
            <p className="text-sm font-medium">
              {user.user_metadata?.full_name || user.email?.split('@')[0]}
            </p>
            <p className="text-xs text-muted-foreground">{user.email}</p>
          </div>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem>
          <User className="mr-2 h-4 w-4" />
          Profile
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link to="/account/mfa">
            <ShieldCheck className="mr-2 h-4 w-4" />
            Two-factor authentication
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem>
          <Settings className="mr-2 h-4 w-4" />
          Settings
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem className="text-destructive" onClick={handleSignOut}>
          <LogOut className="mr-2 h-4 w-4" />
          Log out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}