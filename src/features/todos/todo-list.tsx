import { useState, type FormEvent } from "react";
import { useTodos, useCreateTodo, useToggleTodo, useDeleteTodo } from "@/features/todos/use-todos";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { cn, formatDate } from "@/lib/utils";
import { Trash2, Plus } from "lucide-react";

export function TodoList({ projectId }: { projectId?: string }) {
  const { data: todos, isLoading } = useTodos(projectId);
  const createTodo = useCreateTodo();
  const toggleTodo = useToggleTodo();
  const deleteTodo = useDeleteTodo();
  const [title, setTitle] = useState("");
  const [dueDate, setDueDate] = useState("");

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
        {(todos ?? []).map((todo) => (
          <li key={todo.id} className="flex items-center gap-3 p-3">
            <Checkbox checked={todo.done} onCheckedChange={(checked) => toggleTodo.mutate({ id: todo.id, done: !!checked })} />
            <div className="flex-1">
              <p className={cn("text-sm", todo.done && "text-muted-foreground line-through")}>{todo.title}</p>
              {todo.due_date && <p className="text-xs text-muted-foreground">Échéance : {formatDate(todo.due_date)}</p>}
            </div>
            <Button variant="ghost" size="icon" onClick={() => deleteTodo.mutate(todo.id)}>
              <Trash2 className="h-4 w-4" />
            </Button>
          </li>
        ))}
        {!isLoading && (todos ?? []).length === 0 && (
          <li className="p-4 text-center text-sm text-muted-foreground">Aucune tâche pour l'instant.</li>
        )}
      </ul>
    </div>
  );
}
