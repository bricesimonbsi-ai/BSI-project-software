import { TodoList } from "@/features/todos/todo-list";

export function TodosPage() {
  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Tâches</h1>
        <p className="text-sm text-muted-foreground">Vue transverse, tous projets confondus.</p>
      </div>
      <TodoList />
    </div>
  );
}
