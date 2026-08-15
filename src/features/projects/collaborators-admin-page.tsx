import { useMemo, useState, type FormEvent } from "react";
import { useAuth } from "@/app/providers/auth-provider";
import {
  useMyOwnedProjects,
  useAllProjectCollaborators,
  useRemoveProjectCollaboratorGlobal,
  useUpdateProjectCollaboratorPermission,
} from "@/features/projects/use-all-collaborators";
import { useAddCollaborator } from "@/features/projects/use-collaborators";
import {
  useAgendaCollaborators,
  useAddAgendaCollaborator,
  useRemoveAgendaCollaborator,
  useUpdateAgendaCollaboratorPermission,
} from "@/features/agenda/use-agenda";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import type { Permission } from "@/types/database";
import { Trash2, UserPlus } from "lucide-react";

type AccessEntry = { id: string; label: string; icon: string | null; permission: Permission; kind: "project" | "agenda" };

/**
 * Vue centralisée de tous les accès accordés — jusqu'ici il fallait ouvrir chaque projet (ou
 * l'agenda) séparément pour voir/gérer ses collaborateurs. Regroupe par email : une même personne
 * peut avoir accès à plusieurs projets et/ou à l'agenda, tout apparaît en un seul endroit avec
 * retrait et changement de permission directs, sans naviguer projet par projet.
 */
export function CollaboratorsAdminPage() {
  const { session } = useAuth();
  const myId = session?.user.id ?? "";

  const { data: myProjects } = useMyOwnedProjects();
  const { data: projectCollabs } = useAllProjectCollaborators();
  const { data: agendaCollabs } = useAgendaCollaborators(myId);

  const removeProjectCollab = useRemoveProjectCollaboratorGlobal();
  const updateProjectPermission = useUpdateProjectCollaboratorPermission();
  const removeAgendaCollab = useRemoveAgendaCollaborator(myId);
  const updateAgendaPermission = useUpdateAgendaCollaboratorPermission(myId);

  const byEmail = useMemo(() => {
    const map = new Map<string, AccessEntry[]>();
    for (const c of projectCollabs ?? []) {
      const list = map.get(c.email) ?? [];
      list.push({ id: c.id, label: c.projectTitle, icon: c.projectIcon, permission: c.permission, kind: "project" });
      map.set(c.email, list);
    }
    for (const c of agendaCollabs ?? []) {
      const list = map.get(c.email) ?? [];
      list.push({ id: c.id, label: "Agenda", icon: null, permission: c.permission, kind: "agenda" });
      map.set(c.email, list);
    }
    return [...map.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  }, [projectCollabs, agendaCollabs]);

  const [email, setEmail] = useState("");
  const [target, setTarget] = useState<string>("");
  const [permission, setPermission] = useState<Permission>("write");
  const addProjectCollaborator = useAddCollaborator(target !== "agenda" ? target : "");
  const addAgendaCollaborator = useAddAgendaCollaborator(myId);

  async function handleAdd(e: FormEvent) {
    e.preventDefault();
    if (!email.trim() || !target) return;
    if (target === "agenda") await addAgendaCollaborator.mutateAsync({ email, permission });
    else await addProjectCollaborator.mutateAsync({ email, permission });
    setEmail("");
  }

  function handleRemove(entry: AccessEntry) {
    if (entry.kind === "agenda") removeAgendaCollab.mutate(entry.id);
    else removeProjectCollab.mutate(entry.id);
  }

  function handlePermissionChange(entry: AccessEntry, next: Permission) {
    if (entry.kind === "agenda") updateAgendaPermission.mutate({ id: entry.id, permission: next });
    else updateProjectPermission.mutate({ id: entry.id, permission: next });
  }

  return (
    <div className="max-w-2xl space-y-6">
      <h1 className="text-2xl font-bold">Collaborateurs</h1>
      <p className="text-sm text-muted-foreground">
        Toutes les personnes ayant accès à l'un de tes projets ou à ton agenda, réunies ici — plus besoin d'ouvrir
        chaque projet pour gérer les accès.
      </p>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Donner un accès</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleAdd} className="flex flex-col gap-2 sm:flex-row">
            <Input type="email" placeholder="email@exemple.com" value={email} onChange={(e) => setEmail(e.target.value)} className="flex-1" />
            <Select value={target} onValueChange={setTarget}>
              <SelectTrigger className="sm:w-52">
                <SelectValue placeholder="À quoi..." />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="agenda">📅 Mon agenda</SelectItem>
                {(myProjects ?? []).map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.icon ? `${p.icon} ` : ""}
                    {p.title}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={permission} onValueChange={(v) => setPermission(v as Permission)}>
              <SelectTrigger className="sm:w-40">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="write">Modification</SelectItem>
                <SelectItem value="read">Lecture seule</SelectItem>
              </SelectContent>
            </Select>
            <Button type="submit" disabled={!email.trim() || !target}>
              <UserPlus className="mr-2 h-4 w-4" /> Inviter
            </Button>
          </form>
        </CardContent>
      </Card>

      {byEmail.length === 0 ? (
        <p className="text-sm text-muted-foreground">Personne n'a encore accès à l'un de tes projets ou à ton agenda.</p>
      ) : (
        <div className="space-y-3">
          {byEmail.map(([collabEmail, entries]) => (
            <Card key={collabEmail}>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">{collabEmail}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {entries.map((entry) => (
                  <div
                    key={`${entry.kind}-${entry.id}`}
                    className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-border/60 p-2"
                  >
                    <span className="flex items-center gap-1.5 text-sm">
                      {entry.icon ? `${entry.icon} ` : entry.kind === "agenda" ? "📅 " : ""}
                      {entry.label}
                    </span>
                    <div className="flex items-center gap-2">
                      <Select value={entry.permission} onValueChange={(v) => handlePermissionChange(entry, v as Permission)}>
                        <SelectTrigger className="h-8 w-36 text-xs">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="write">Modification</SelectItem>
                          <SelectItem value="read">Lecture seule</SelectItem>
                        </SelectContent>
                      </Select>
                      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleRemove(entry)}>
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
