"use client";

import { useState, useEffect, useCallback } from "react";
import { useAuth } from "@clerk/nextjs";
import { Plus, Copy, Check, Trash2, Key, AlertCircle, RotateCw, Terminal } from "lucide-react";

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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

import { createAPIClient, type APIKey, type InkogAPI } from "@/lib/api";
import { posthog } from "@/components/PostHogProvider";

export default function APIKeysPage() {
  const { getToken } = useAuth();
  const [api, setApi] = useState<InkogAPI | null>(null);

  const [keys, setKeys] = useState<APIKey[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Create key dialog state
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [newKeyName, setNewKeyName] = useState("");
  const [creating, setCreating] = useState(false);

  // Show key dialog state
  const [showKeyDialog, setShowKeyDialog] = useState(false);
  const [newKey, setNewKey] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  // Revoke dialog state
  const [showRevokeDialog, setShowRevokeDialog] = useState(false);
  const [keyToRevoke, setKeyToRevoke] = useState<APIKey | null>(null);
  const [revoking, setRevoking] = useState(false);

  // Rotate dialog state
  const [showRotateDialog, setShowRotateDialog] = useState(false);
  const [keyToRotate, setKeyToRotate] = useState<APIKey | null>(null);
  const [rotating, setRotating] = useState(false);

  // Initialize API client
  useEffect(() => {
    const client = createAPIClient(getToken);
    setApi(client);
  }, [getToken]);

  // Fetch keys on mount
  const fetchKeys = useCallback(async () => {
    if (!api) return;

    try {
      setLoading(true);
      setError(null);
      const response = await api.keys.list();
      setKeys(response.api_keys);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load API keys");
    } finally {
      setLoading(false);
    }
  }, [api]);

  useEffect(() => {
    fetchKeys();
  }, [fetchKeys]);

  // Create a new key
  const handleCreateKey = async () => {
    if (!api) return;

    try {
      setCreating(true);
      const response = await api.keys.create(newKeyName || "Default Key");
      setNewKey(response.key);
      setShowCreateDialog(false);
      setShowKeyDialog(true);
      setNewKeyName("");
      fetchKeys();

      // Track key generation event
      posthog.capture("api_key_created", {
        key_name: newKeyName || "Default Key",
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create API key");
    } finally {
      setCreating(false);
    }
  };

  // Copy key to clipboard
  const handleCopyKey = async () => {
    if (!newKey) return;

    await navigator.clipboard.writeText(newKey);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Copy command to clipboard
  const [copiedCommand, setCopiedCommand] = useState<string | null>(null);
  const handleCopyCommand = async (command: string, id: string) => {
    await navigator.clipboard.writeText(command);
    setCopiedCommand(id);
    setTimeout(() => setCopiedCommand(null), 2000);
  };

  // Revoke a key
  const handleRevokeKey = async () => {
    if (!api || !keyToRevoke) return;

    try {
      setRevoking(true);
      await api.keys.revoke(keyToRevoke.id);
      setShowRevokeDialog(false);
      setKeyToRevoke(null);
      fetchKeys();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to revoke API key");
    } finally {
      setRevoking(false);
    }
  };

  // Rotate a key (revoke old, create new with same name)
  const handleRotateKey = async () => {
    if (!api || !keyToRotate) return;

    try {
      setRotating(true);
      // First revoke the old key
      await api.keys.revoke(keyToRotate.id);
      // Then create a new key with the same name
      const response = await api.keys.create(keyToRotate.name);
      setNewKey(response.key);
      setShowRotateDialog(false);
      setKeyToRotate(null);
      setShowKeyDialog(true);
      fetchKeys();

      // Track key rotation event
      posthog.capture("api_key_rotated", {
        key_name: keyToRotate.name,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to rotate API key");
    } finally {
      setRotating(false);
    }
  };

  // Format date for display with defensive parsing
  const formatDate = (dateStr: string | null | undefined) => {
    if (!dateStr) return "Never";
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) return "Invalid Date";
    return date.toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">API Keys</h1>
          <p className="text-gray-600 mt-1">
            Manage your API keys for CLI authentication
          </p>
        </div>
        <Button onClick={() => setShowCreateDialog(true)}>
          <Plus className="h-4 w-4 mr-2" />
          Generate New Key
        </Button>
      </div>

      {error && (
        <Card className="border-red-200 bg-red-50">
          <CardContent className="flex items-center gap-2 py-4">
            <AlertCircle className="h-5 w-5 text-red-500" />
            <p className="text-red-700">{error}</p>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Key className="h-5 w-5" />
            Active API Keys
          </CardTitle>
          <CardDescription>
            API keys are used to authenticate CLI requests. Keep them secret!
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
            </div>
          ) : keys.length === 0 ? (
            <div className="text-center py-8">
              <Key className="mx-auto h-12 w-12 text-gray-400" />
              <h3 className="mt-2 text-sm font-semibold text-gray-900">
                No API keys
              </h3>
              <p className="mt-1 text-sm text-gray-500">
                Get started by generating a new API key.
              </p>
              <div className="mt-6">
                <Button onClick={() => setShowCreateDialog(true)}>
                  <Plus className="h-4 w-4 mr-2" />
                  Generate New Key
                </Button>
              </div>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Key</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead>Last Used</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {keys.map((key) => (
                  <TableRow key={key.id}>
                    <TableCell className="font-medium">{key.name}</TableCell>
                    <TableCell>
                      <code className="bg-gray-100 px-2 py-1 rounded text-sm">
                        {key.key_prefix}
                      </code>
                    </TableCell>
                    <TableCell className="text-gray-500">
                      {formatDate(key.created_at)}
                    </TableCell>
                    <TableCell className="text-gray-500">
                      {formatDate(key.last_used_at)}
                    </TableCell>
                    <TableCell className="text-right space-x-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-blue-600 hover:text-blue-700 hover:bg-blue-50"
                        onClick={() => {
                          setKeyToRotate(key);
                          setShowRotateDialog(true);
                        }}
                        title="Rotate key"
                      >
                        <RotateCw className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-red-600 hover:text-red-700 hover:bg-red-50"
                        onClick={() => {
                          setKeyToRevoke(key);
                          setShowRevokeDialog(true);
                        }}
                        title="Revoke key"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Create Key Dialog */}
      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Generate New API Key</DialogTitle>
            <DialogDescription>
              Create a new API key for CLI authentication. You can name it to
              help identify where it&apos;s being used.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="name">Key Name (optional)</Label>
              <Input
                id="name"
                placeholder="e.g., Production CI/CD"
                value={newKeyName}
                onChange={(e) => setNewKeyName(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowCreateDialog(false)}
            >
              Cancel
            </Button>
            <Button onClick={handleCreateKey} disabled={creating}>
              {creating ? "Generating..." : "Generate Key"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Show Key Dialog */}
      <Dialog open={showKeyDialog} onOpenChange={setShowKeyDialog}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Your New API Key</DialogTitle>
            <DialogDescription>
              Copy this key now. You won&apos;t be able to see it again!
            </DialogDescription>
          </DialogHeader>
          <div className="py-4 space-y-4">
            <div className="flex items-center gap-2">
              <code className="flex-1 bg-gray-100 px-3 py-2 rounded text-sm font-mono break-all">
                {newKey}
              </code>
              <Button variant="outline" size="icon" onClick={handleCopyKey}>
                {copied ? (
                  <Check className="h-4 w-4 text-green-600" />
                ) : (
                  <Copy className="h-4 w-4" />
                )}
              </Button>
            </div>
            <p className="text-sm text-amber-600 bg-amber-50 px-3 py-2 rounded">
              Make sure to copy your API key now. For security reasons, we
              can&apos;t show it to you again.
            </p>

            {/* Quick Start Instructions */}
            <div className="border-t pt-4">
              <div className="flex items-center gap-2 mb-3">
                <Terminal className="h-4 w-4 text-gray-600" />
                <span className="text-sm font-medium text-gray-900">Quick Start</span>
              </div>
              <div className="space-y-2">
                <div className="flex items-center gap-2 bg-gray-100 rounded px-3 py-2">
                  <code className="flex-1 text-xs font-mono text-gray-800">
                    export INKOG_API_KEY=&quot;{newKey?.slice(0, 20)}...&quot;
                  </code>
                  <button
                    type="button"
                    onClick={() => handleCopyCommand(`export INKOG_API_KEY="${newKey}"`, "env")}
                    className="p-1 rounded hover:bg-gray-200 transition-colors"
                    title="Copy command"
                  >
                    {copiedCommand === "env" ? (
                      <Check className="h-3.5 w-3.5 text-green-600" />
                    ) : (
                      <Copy className="h-3.5 w-3.5 text-gray-500" />
                    )}
                  </button>
                </div>
                <div className="flex items-center gap-2 bg-gray-100 rounded px-3 py-2">
                  <code className="flex-1 text-xs font-mono text-gray-800">
                    inkog scan ./my-agent
                  </code>
                  <button
                    type="button"
                    onClick={() => handleCopyCommand("inkog scan ./my-agent", "scan")}
                    className="p-1 rounded hover:bg-gray-200 transition-colors"
                    title="Copy command"
                  >
                    {copiedCommand === "scan" ? (
                      <Check className="h-3.5 w-3.5 text-green-600" />
                    ) : (
                      <Copy className="h-3.5 w-3.5 text-gray-500" />
                    )}
                  </button>
                </div>
              </div>
              <p className="mt-2 text-xs text-gray-500">
                Install CLI: <code className="bg-gray-100 px-1 rounded">go install github.com/inkog-io/inkog/cmd/inkog@latest</code>
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button
              onClick={() => {
                setShowKeyDialog(false);
                setNewKey(null);
              }}
            >
              Done
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Revoke Key Dialog */}
      <Dialog open={showRevokeDialog} onOpenChange={setShowRevokeDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Revoke API Key</DialogTitle>
            <DialogDescription>
              Are you sure you want to revoke this API key? Any applications
              using this key will no longer be able to authenticate.
            </DialogDescription>
          </DialogHeader>
          {keyToRevoke && (
            <div className="py-4">
              <p className="text-sm text-gray-600">
                <strong>Name:</strong> {keyToRevoke.name}
              </p>
              <p className="text-sm text-gray-600">
                <strong>Key:</strong>{" "}
                <code className="bg-gray-100 px-1 rounded">
                  {keyToRevoke.key_prefix}
                </code>
              </p>
            </div>
          )}
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setShowRevokeDialog(false);
                setKeyToRevoke(null);
              }}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleRevokeKey}
              disabled={revoking}
            >
              {revoking ? "Revoking..." : "Revoke Key"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Rotate Key Dialog */}
      <Dialog open={showRotateDialog} onOpenChange={setShowRotateDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Rotate API Key</DialogTitle>
            <DialogDescription>
              This will revoke the current key and generate a new one with the
              same name. Any applications using the old key will need to be
              updated with the new key.
            </DialogDescription>
          </DialogHeader>
          {keyToRotate && (
            <div className="py-4">
              <p className="text-sm text-gray-600">
                <strong>Name:</strong> {keyToRotate.name}
              </p>
              <p className="text-sm text-gray-600">
                <strong>Current Key:</strong>{" "}
                <code className="bg-gray-100 px-1 rounded">
                  {keyToRotate.key_prefix}
                </code>
              </p>
              <p className="mt-3 text-sm text-amber-600 bg-amber-50 px-3 py-2 rounded">
                After rotation, you&apos;ll receive a new key. Make sure to update
                your applications immediately.
              </p>
            </div>
          )}
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setShowRotateDialog(false);
                setKeyToRotate(null);
              }}
            >
              Cancel
            </Button>
            <Button
              onClick={handleRotateKey}
              disabled={rotating}
              className="bg-blue-600 hover:bg-blue-700"
            >
              {rotating ? "Rotating..." : "Rotate Key"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
