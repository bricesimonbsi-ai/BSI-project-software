import { useState, type FormEvent } from "react";
import { useCollaborators, useAddCollaborator, useRemoveCollaborator } from "@/features/projects/use-collaborators";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import type { Permission } from "@/types/database";
import { Trash2, UserPlus } from "lucide-react";

export function CollaboratorsPanel({ projectId }: { projectId: string }) {
  const { data: collaborators, isLoading } = useCollaborators(projectId);
  const addCollaborator = useAddCollaborator(projectId);
  const removeCollaborator = useRemoveCollaborator(projectId);
  const [email, setEmail] = useState("");
  const [permission, setPermission] = useState<Permission>("read");

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!email.trim()) return;
    await addCollaborator.mutateAsync({ email, permission });
    setEmail("");
  }

  return (
    <div className="space-y-4">
      <form onSubmit={handleSubmit} className="flex flex-col gap-2 sm:flex-row">
        <Input
          type="email"
          placeholder="email@exemple.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="flex-1"
        />
        <Select value={permission} onValueChange={(v) => setPermission(v as Permission)}>
          <SelectTrigger className="sm:w-40">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="read">Lecture seule</SelectItem>
            <SelectItem value="write">Modification</SelectItem>
          </SelectContent>
        </Select>
        <Button type="submit">
          <UserPlus className="mr-2 h-4 w-4" /> Inviter
        </Button>
      </form>

      {isLoading && <p className="text-sm text-muted-foreground">Chargement...</p>}

      <ul className="space-y-2">
        {(collaborators ?? []).map((c) => (
          <li key={c.id} className="flex items-center justify-between rounded-md border border-border p-3">
            <div>
              <p className="text-sm font-medium">{c.email}</p>
              {!c.user_id && <p className="text-xs text-muted-foreground">Invitation en attente (pas encore de compte)</p>}
            </div>
            <div className="flex items-center gap-2">
              <Badge variant="secondary">{c.permission === "write" ? "Modification" : "Lecture seule"}</Badge>
              <Button variant="ghost" size="icon" onClick={() => removeCollaborator.mutate(c.id)}>
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
