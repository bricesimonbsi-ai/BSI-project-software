import { useEffect, useState } from "react";
import { useUpdateProject } from "@/features/projects/use-projects";
import { Input } from "@/components/ui/input";

/** Titre de projet éditable inline (commit au blur/Entrée) — utilisé sur toutes les pages de
 * détail de projet pour que le renommage soit possible partout, pas seulement sur Voyages. */
export function ProjectTitleInput({ projectId, title }: { projectId: string; title: string }) {
  const updateProject = useUpdateProject();
  const [value, setValue] = useState(title);

  useEffect(() => setValue(title), [title]);

  function commit() {
    const trimmed = value.trim();
    if (!trimmed || trimmed === title) {
      setValue(title);
      return;
    }
    updateProject.mutate({ id: projectId, title: trimmed });
  }

  return (
    <Input
      value={value}
      onChange={(e) => setValue(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => e.key === "Enter" && (e.currentTarget as HTMLInputElement).blur()}
      className="h-auto border-transparent bg-transparent px-1.5 py-0 text-2xl font-bold hover:border-border focus-visible:border-border"
    />
  );
}
