import { useState, type FormEvent } from "react";
import { useAgendaCollaborators, useAddAgendaCollaborator, useRemoveAgendaCollaborator } from "@/features/agenda/use-agenda";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import type { Permission } from "@/types/database";
import { Trash2, UserPlus } from "lucide-react";

/** Partage de mon agenda — même formulaire/liste que CollaboratorsPanel (projects), pointé vers
 * agenda_collaborators/invite-agenda-collaborator plutôt que project_collaborators/invite-collaborator. */
export function AgendaCollaboratorsPanel({ ownerId }: { ownerId: string }) {
  const { data: collaborators, isLoading } = useAgendaCollaborators(ownerId);
  const addCollaborator = useAddAgendaCollaborator(ownerId);
  const removeCollaborator = useRemoveAgendaCollaborator(ownerId);
  const [email, setEmail] = useState("");
  const [permission, setPermission] = useState<Permission>("write");

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
            <SelectItem value="write">Modification</SelectItem>
            <SelectItem value="read">Lecture seule</SelectItem>
          </SelectContent>
        </Select>
        <Button type="submit">
          <UserPlus className="mr-2 h-4 w-4" /> Inviter
        </Button>
      </form>

      {isLoading && <p className="text-sm text-muted-foreground">Chargement...</p>}

      {(collaborators ?? []).length === 0 && !isLoading ? (
        <p className="text-sm text-muted-foreground">Personne n'a encore accès à cet agenda.</p>
      ) : (
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
      )}
    </div>
  );
}
