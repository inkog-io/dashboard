"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@clerk/nextjs";
import { ShieldCheck, Users, ChevronDown, Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Skeleton } from "@/components/ui/skeleton";

import { createAPIClient, type CurrentUser, type InkogAPI } from "@/lib/api";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { useToast } from "@/hooks/useToast";

export default function AdminPage() {
  const router = useRouter();
  const { getToken } = useAuth();
  const { user: currentUser, isAdmin, isLoading: loadingCurrentUser } = useCurrentUser();
  const toast = useToast();

  const [api, setApi] = useState<InkogAPI | null>(null);
  const [users, setUsers] = useState<CurrentUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [updatingUserId, setUpdatingUserId] = useState<string | null>(null);

  // Initialize API client
  useEffect(() => {
    setApi(createAPIClient(getToken));
  }, [getToken]);

  // Guard: redirect non-admins
  useEffect(() => {
    if (!loadingCurrentUser && !isAdmin) {
      router.push("/dashboard");
    }
  }, [loadingCurrentUser, isAdmin, router]);

  // Fetch users
  const fetchUsers = useCallback(async () => {
    if (!api) return;
    try {
      setLoading(true);
      const response = await api.admin.listUsers();
      setUsers(response.users);
    } catch (err) {
      toast.handleAPIError(err, "Failed to load users");
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [api]);

  useEffect(() => {
    if (api && isAdmin) {
      fetchUsers();
    }
  }, [api, isAdmin, fetchUsers]);

  // Update user role
  const handleRoleChange = async (userId: string, newRole: "admin" | "user") => {
    if (!api) return;

    setUpdatingUserId(userId);
    try {
      await api.admin.updateUserRole(userId, newRole);
      toast.success({
        title: "Role updated",
        description: `User role changed to ${newRole}`,
      });
      // Update local state
      setUsers((prev) =>
        prev.map((u) => (u.id === userId ? { ...u, role: newRole } : u))
      );
    } catch (err) {
      toast.handleAPIError(err, "Failed to update role");
    } finally {
      setUpdatingUserId(null);
    }
  };

  // Don't render until we know user is admin
  if (loadingCurrentUser || !isAdmin) {
    return null;
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
          <ShieldCheck className="h-6 w-6" />
          Team Members
        </h1>
        <p className="text-muted-foreground mt-1">
          Manage user roles and permissions
        </p>
      </div>

      {/* Members Card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Members
          </CardTitle>
          <CardDescription>
            {loading ? "Loading..." : `${users.length} total members`}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="space-y-3">
              {[...Array(3)].map((_, i) => (
                <div key={i} className="flex items-center gap-4">
                  <Skeleton className="h-10 w-10 rounded-full" />
                  <div className="space-y-2 flex-1">
                    <Skeleton className="h-4 w-[200px]" />
                    <Skeleton className="h-3 w-[150px]" />
                  </div>
                  <Skeleton className="h-8 w-[80px]" />
                </div>
              ))}
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>User</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Joined</TableHead>
                  <TableHead className="w-[120px]">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {users.map((user) => {
                  const isSelf = user.id === currentUser?.id;
                  const isUpdating = updatingUserId === user.id;

                  return (
                    <TableRow key={user.id}>
                      <TableCell>
                        <div className="flex items-center gap-3">
                          {user.avatar_url ? (
                            <img
                              src={user.avatar_url}
                              alt=""
                              className="h-8 w-8 rounded-full"
                            />
                          ) : (
                            <div className="h-8 w-8 rounded-full bg-muted flex items-center justify-center text-xs font-medium">
                              {(user.name || user.email)[0]?.toUpperCase()}
                            </div>
                          )}
                          <span className="font-medium">
                            {user.name || "—"}
                            {isSelf && (
                              <span className="ml-2 text-xs text-muted-foreground">(you)</span>
                            )}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {user.email}
                      </TableCell>
                      <TableCell>
                        {user.role === "admin" ? (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400">
                            Admin
                          </span>
                        ) : (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400">
                            User
                          </span>
                        )}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {new Date(user.created_at).toLocaleDateString()}
                      </TableCell>
                      <TableCell>
                        {isSelf ? (
                          <span className="text-xs text-muted-foreground">—</span>
                        ) : (
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button
                                variant="outline"
                                size="sm"
                                disabled={isUpdating}
                                className="h-8 gap-1"
                              >
                                {isUpdating ? (
                                  <Loader2 className="h-3 w-3 animate-spin" />
                                ) : (
                                  <>
                                    Role
                                    <ChevronDown className="h-3 w-3" />
                                  </>
                                )}
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem
                                onClick={() => handleRoleChange(user.id, "admin")}
                                disabled={user.role === "admin"}
                              >
                                Make Admin
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                onClick={() => handleRoleChange(user.id, "user")}
                                disabled={user.role === "user"}
                              >
                                Make User
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
