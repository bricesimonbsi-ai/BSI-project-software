import { useMemo, useState, type FormEvent } from "react";
import { useTodos, useCreateTodo, useToggleTodo, useDeleteTodo, useUpdateTodo } from "@/features/todos/use-todos";
import { usePeople, useProjectPeople } from "@/features/people/use-people";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn, formatDate } from "@/lib/utils";
import type { Person, Todo } from "@/types/database";
import { Trash2, Plus, Pencil, Users } from "lucide-react";

const categoryLabels: Record<string, string> = {
  visa: "Visa",
  vaccin: "Vaccin",
  permis: "Permis intl.",
  materiel: "Matériel",
  itineraire: "Itinéraire",
  vol: "Vol",
  autre: "Autre",
};

const CATEGORY_OPTIONS = Object.entries(categoryLabels).map(([value, label]) => ({ value, label }));

/** Valeurs spéciales du filtre/sélecteur "responsable", à côté des id de personnes. */
const UNASSIGNED = "__unassigned__";
const ALL_TRAVELERS = "__all_travelers__";

function assigneeLabel(todo: Todo, people: Person[]): string | null {
  if (todo.assigned_to_all) return "Tous les voyageurs";
  if (todo.assigned_person_id) return people.find((p) => p.id === todo.assigned_person_id)?.name ?? null;
  return null;
}

function isOverdue(todo: Todo): boolean {
  if (!todo.due_date || todo.done) return false;
  return new Date(todo.due_date) < new Date(new Date().toDateString());
}

function isWithinNext7Days(dueDate: string): boolean {
  const due = new Date(dueDate);
  const today = new Date(new Date().toDateString());
  const in7Days = new Date(today);
  in7Days.setDate(in7Days.getDate() + 7);
  return due >= today && due <= in7Days;
}

/** Sélecteur "Personne assignée" partagé par le formulaire d'ajout et l'édition d'une tâche :
 * limité aux voyageurs du projet quand `projectId` est connu (contexte intégré à un voyage),
 * sinon ouvert à tout le répertoire de personnes (page transverse Tâches, tous projets). */
function AssigneeSelect({
  value,
  onChange,
  people,
}: {
  value: string;
  onChange: (v: string) => void;
  people: Person[];
}) {
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger className="sm:w-48">
        <SelectValue placeholder="Non assigné" />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value={UNASSIGNED}>Non assigné</SelectItem>
        <SelectItem value={ALL_TRAVELERS}>Tous les voyageurs</SelectItem>
        {people.map((p) => (
          <SelectItem key={p.id} value={p.id}>
            {p.avatar_emoji ? `${p.avatar_emoji} ` : ""}
            {p.name}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

export function TodoList({ projectId }: { projectId?: string }) {
  const { data: todos, isLoading } = useTodos(projectId);
  const { data: allPeople } = usePeople();
  const { data: linkedPeople } = useProjectPeople(projectId);
  const createTodo = useCreateTodo();
  const toggleTodo = useToggleTodo();
  const deleteTodo = useDeleteTodo();
  const updateTodo = useUpdateTodo();
  const [title, setTitle] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [assignee, setAssignee] = useState(UNASSIGNED);
  const [editingId, setEditingId] = useState<string | null>(null);

  const [categoryFilter, setCategoryFilter] = useState("all");
  const [assigneeFilter, setAssigneeFilter] = useState("all");
  const [dueFilter, setDueFilter] = useState("all");

  // Limité aux voyageurs du projet quand on connaît le projet (todo-list intégrée à un
  // voyage/projet) ; sinon tout le répertoire (page transverse Tâches, tous projets confondus).
  const assignablePeople = useMemo(
    () => (projectId ? (linkedPeople ?? []).map((l) => l.people) : allPeople ?? []),
    [projectId, linkedPeople, allPeople]
  );

  const filtered = useMemo(() => {
    return (todos ?? []).filter((t) => {
      if (categoryFilter !== "all" && (t.category ?? "autre") !== categoryFilter) return false;
      if (assigneeFilter === UNASSIGNED && (t.assigned_person_id || t.assigned_to_all)) return false;
      if (assigneeFilter === ALL_TRAVELERS && !t.assigned_to_all) return false;
      if (assigneeFilter !== "all" && assigneeFilter !== UNASSIGNED && assigneeFilter !== ALL_TRAVELERS && t.assigned_person_id !== assigneeFilter)
        return false;
      if (dueFilter === "overdue" && !isOverdue(t)) return false;
      if (dueFilter === "week" && !(t.due_date && isWithinNext7Days(t.due_date))) return false;
      if (dueFilter === "none" && t.due_date) return false;
      return true;
    });
  }, [todos, categoryFilter, assigneeFilter, dueFilter]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!title.trim()) return;
    await createTodo.mutateAsync({
      title: title.trim(),
      project_id: projectId ?? null,
      due_date: dueDate || null,
      assigned_person_id: assignee !== UNASSIGNED && assignee !== ALL_TRAVELERS ? assignee : null,
      assigned_to_all: assignee === ALL_TRAVELERS,
    });
    setTitle("");
    setDueDate("");
    setAssignee(UNASSIGNED);
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
        <AssigneeSelect value={assignee} onChange={setAssignee} people={assignablePeople} />
        <Button type="submit">
          <Plus className="mr-2 h-4 w-4" /> Ajouter
        </Button>
      </form>

      <div className="flex flex-wrap gap-2">
        <Select value={categoryFilter} onValueChange={setCategoryFilter}>
          <SelectTrigger className="w-[9.5rem]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Toutes catégories</SelectItem>
            {CATEGORY_OPTIONS.map((c) => (
              <SelectItem key={c.value} value={c.value}>
                {c.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={assigneeFilter} onValueChange={setAssigneeFilter}>
          <SelectTrigger className="w-[9.5rem]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tous responsables</SelectItem>
            <SelectItem value={UNASSIGNED}>Non assigné</SelectItem>
            <SelectItem value={ALL_TRAVELERS}>Tous les voyageurs</SelectItem>
            {assignablePeople.map((p) => (
              <SelectItem key={p.id} value={p.id}>
                {p.avatar_emoji ? `${p.avatar_emoji} ` : ""}
                {p.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={dueFilter} onValueChange={setDueFilter}>
          <SelectTrigger className="w-[9.5rem]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Toutes échéances</SelectItem>
            <SelectItem value="overdue">En retard</SelectItem>
            <SelectItem value="week">Dans les 7 jours</SelectItem>
            <SelectItem value="none">Sans échéance</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {isLoading && <p className="text-sm text-muted-foreground">Chargement...</p>}

      <ul className="divide-y divide-border rounded-md border border-border">
        {filtered.map((todo) =>
          editingId === todo.id ? (
            <TodoEditRow
              key={todo.id}
              todo={todo}
              people={assignablePeople}
              onDone={() => setEditingId(null)}
              onSave={(updates) => updateTodo.mutate({ id: todo.id, ...updates })}
            />
          ) : (
            <li key={todo.id} className="flex items-center gap-3 p-3">
              <Checkbox checked={todo.done} onCheckedChange={(checked) => toggleTodo.mutate({ id: todo.id, done: !!checked })} />
              <div className="flex-1">
                <p className={cn("flex flex-wrap items-center gap-2 text-sm", todo.done && "text-muted-foreground line-through")}>
                  {todo.title}
                  {todo.auto_generated && (
                    <Badge variant="outline" className="text-[10px]">
                      Auto{todo.category ? ` · ${categoryLabels[todo.category] ?? todo.category}` : ""}
                    </Badge>
                  )}
                  {assigneeLabel(todo, allPeople ?? []) && (
                    <Badge variant="outline" className="gap-1 text-[10px]">
                      <Users className="h-3 w-3" />
                      {assigneeLabel(todo, allPeople ?? [])}
                    </Badge>
                  )}
                </p>
                {todo.due_date && (
                  <p className={cn("text-xs text-muted-foreground", isOverdue(todo) && "font-medium text-destructive")}>
                    Échéance : {formatDate(todo.due_date)}
                    {isOverdue(todo) ? " (en retard)" : ""}
                  </p>
                )}
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
        {!isLoading && filtered.length === 0 && (
          <li className="p-4 text-center text-sm text-muted-foreground">
            {(todos ?? []).length === 0 ? "Aucune tâche pour l'instant." : "Aucune tâche ne correspond aux filtres."}
          </li>
        )}
      </ul>
    </div>
  );
}

function TodoEditRow({
  todo,
  people,
  onSave,
  onDone,
}: {
  todo: Todo;
  people: Person[];
  onSave: (updates: { title: string; due_date: string | null; assigned_person_id: string | null; assigned_to_all: boolean }) => void;
  onDone: () => void;
}) {
  const [title, setTitle] = useState(todo.title);
  const [dueDate, setDueDate] = useState(todo.due_date ?? "");
  const [assignee, setAssignee] = useState(todo.assigned_to_all ? ALL_TRAVELERS : todo.assigned_person_id ?? UNASSIGNED);

  function handleSave() {
    if (!title.trim()) return;
    onSave({
      title: title.trim(),
      due_date: dueDate || null,
      assigned_person_id: assignee !== UNASSIGNED && assignee !== ALL_TRAVELERS ? assignee : null,
      assigned_to_all: assignee === ALL_TRAVELERS,
    });
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
      <AssigneeSelect value={assignee} onChange={setAssignee} people={people} />
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
