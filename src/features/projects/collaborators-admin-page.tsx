import { useMemo, useState, type FormEvent } from "react";
import {
  useMyOwnedProjects,
  useAllProjectCollaborators,
  useRemoveProjectCollaboratorGlobal,
  useUpdateProjectCollaboratorPermission,
} from "@/features/projects/use-all-collaborators";
import { useAddCollaborator } from "@/features/projects/use-collaborators";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import type { Permission } from "@/types/database";
import { Trash2, UserPlus } from "lucide-react";

type AccessEntry = { id: string; label: string; icon: string | null; permission: Permission };

/**
 * Vue centralisée de tous les accès accordés à tes projets — jusqu'ici il fallait ouvrir chaque
 * projet séparément pour voir/gérer ses collaborateurs. Regroupe par email : une même personne
 * peut avoir accès à plusieurs projets, tout apparaît en un seul endroit avec retrait et
 * changement de permission directs, sans naviguer projet par projet. L'agenda a son propre partage
 * dédié (bouton "Partager" sur la page Agenda) — pas mélangé ici.
 */
export function CollaboratorsAdminPage() {
  const { data: myProjects } = useMyOwnedProjects();
  const { data: projectCollabs } = useAllProjectCollaborators();

  const removeProjectCollab = useRemoveProjectCollaboratorGlobal();
  const updateProjectPermission = useUpdateProjectCollaboratorPermission();

  const byEmail = useMemo(() => {
    const map = new Map<string, AccessEntry[]>();
    for (const c of projectCollabs ?? []) {
      const list = map.get(c.email) ?? [];
      list.push({ id: c.id, label: c.projectTitle, icon: c.projectIcon, permission: c.permission });
      map.set(c.email, list);
    }
    return [...map.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  }, [projectCollabs]);

  const [email, setEmail] = useState("");
  const [target, setTarget] = useState<string>("");
  const [permission, setPermission] = useState<Permission>("write");
  const addProjectCollaborator = useAddCollaborator(target);

  async function handleAdd(e: FormEvent) {
    e.preventDefault();
    if (!email.trim() || !target) return;
    await addProjectCollaborator.mutateAsync({ email, permission });
    setEmail("");
  }

  return (
    <div className="max-w-2xl space-y-6">
      <h1 className="text-2xl font-bold">Collaborateurs</h1>
      <p className="text-sm text-muted-foreground">
        Toutes les personnes ayant accès à l'un de tes projets, réunies ici — plus besoin d'ouvrir chaque projet pour
        gérer les accès.
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
                <SelectValue placeholder="Quel projet..." />
              </SelectTrigger>
              <SelectContent>
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
        <p className="text-sm text-muted-foreground">Personne n'a encore accès à l'un de tes projets.</p>
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
                    key={entry.id}
                    className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-border/60 p-2"
                  >
                    <span className="flex items-center gap-1.5 text-sm">
                      {entry.icon ? `${entry.icon} ` : ""}
                      {entry.label}
                    </span>
                    <div className="flex items-center gap-2">
                      <Select
                        value={entry.permission}
                        onValueChange={(v) => updateProjectPermission.mutate({ id: entry.id, permission: v as Permission })}
                      >
                        <SelectTrigger className="h-8 w-36 text-xs">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="write">Modification</SelectItem>
                          <SelectItem value="read">Lecture seule</SelectItem>
                        </SelectContent>
                      </Select>
                      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => removeProjectCollab.mutate(entry.id)}>
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
