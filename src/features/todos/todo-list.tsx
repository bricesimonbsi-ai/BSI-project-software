import { useState, type FormEvent } from "react";
import { useTodos, useCreateTodo, useToggleTodo, useDeleteTodo, useUpdateTodo } from "@/features/todos/use-todos";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn, formatDate } from "@/lib/utils";
import type { Todo } from "@/types/database";
import { Trash2, Plus, Pencil } from "lucide-react";

const categoryLabels: Record<string, string> = {
  visa: "Visa",
  vaccin: "Vaccin",
  permis: "Permis intl.",
  materiel: "Matériel",
  itineraire: "Itinéraire",
  vol: "Vol",
  autre: "Autre",
};

export function TodoList({ projectId }: { projectId?: string }) {
  const { data: todos, isLoading } = useTodos(projectId);
  const createTodo = useCreateTodo();
  const toggleTodo = useToggleTodo();
  const deleteTodo = useDeleteTodo();
  const updateTodo = useUpdateTodo();
  const [title, setTitle] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!title.trim()) return;
    await createTodo.mutateAsync({ title: title.trim(), project_id: projectId ?? null, due_date: dueDate || null });
    setTitle("");
    setDueDate("");
  }

  return (
    <div className="space-y-4">
      <form onSubmit={handleSubmit} className="flex flex-col gap-2 sm:flex-row">
        <Input
          placeholder="Nouvelle tâche..."
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          className="flex-1"
        />
        <Input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} className="sm:w-40" />
        <Button type="submit">
          <Plus className="mr-2 h-4 w-4" /> Ajouter
        </Button>
      </form>

      {isLoading && <p className="text-sm text-muted-foreground">Chargement...</p>}

      <ul className="divide-y divide-border rounded-md border border-border">
        {(todos ?? []).map((todo) =>
          editingId === todo.id ? (
            <TodoEditRow
              key={todo.id}
              todo={todo}
              onDone={() => setEditingId(null)}
              onSave={(updates) => updateTodo.mutate({ id: todo.id, ...updates })}
            />
          ) : (
            <li key={todo.id} className="flex items-center gap-3 p-3">
              <Checkbox checked={todo.done} onCheckedChange={(checked) => toggleTodo.mutate({ id: todo.id, done: !!checked })} />
              <div className="flex-1">
                <p className={cn("flex items-center gap-2 text-sm", todo.done && "text-muted-foreground line-through")}>
                  {todo.title}
                  {todo.auto_generated && (
                    <Badge variant="outline" className="text-[10px]">
                      Auto{todo.category ? ` · ${categoryLabels[todo.category] ?? todo.category}` : ""}
                    </Badge>
                  )}
                </p>
                {todo.due_date && <p className="text-xs text-muted-foreground">Échéance : {formatDate(todo.due_date)}</p>}
              </div>
              <Button variant="ghost" size="icon" onClick={() => setEditingId(todo.id)}>
                <Pencil className="h-4 w-4" />
              </Button>
              <Button variant="ghost" size="icon" onClick={() => deleteTodo.mutate(todo.id)}>
                <Trash2 className="h-4 w-4" />
              </Button>
            </li>
          )
        )}
        {!isLoading && (todos ?? []).length === 0 && (
          <li className="p-4 text-center text-sm text-muted-foreground">Aucune tâche pour l'instant.</li>
        )}
      </ul>
    </div>
  );
}

function TodoEditRow({
  todo,
  onSave,
  onDone,
}: {
  todo: Todo;
  onSave: (updates: { title: string; due_date: string | null }) => void;
  onDone: () => void;
}) {
  const [title, setTitle] = useState(todo.title);
  const [dueDate, setDueDate] = useState(todo.due_date ?? "");

  function handleSave() {
    if (!title.trim()) return;
    onSave({ title: title.trim(), due_date: dueDate || null });
    onDone();
  }

  return (
    <li className="flex flex-col gap-2 border-l-2 border-l-accent p-3 sm:flex-row sm:items-center">
      <Input
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), handleSave())}
        className="flex-1"
        autoFocus
      />
      <Input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} className="sm:w-40" />
      <div className="flex justify-end gap-2">
        <Button type="button" size="sm" variant="ghost" onClick={onDone}>
          Annuler
        </Button>
        <Button type="button" size="sm" onClick={handleSave}>
          Enregistrer
        </Button>
      </div>
    </li>
  );
}
