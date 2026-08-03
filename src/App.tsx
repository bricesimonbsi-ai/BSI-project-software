import { Routes, Route } from "react-router-dom";
import { ProtectedRoute } from "@/app/layout/protected-route";
import { AppShell } from "@/app/layout/app-shell";
import { LoginPage } from "@/features/auth/login-page";
import { SignupPage } from "@/features/auth/signup-page";
import { PortfolioHome } from "@/features/portfolio/portfolio-home";
import { CategoryDetailPage } from "@/features/portfolio/category-detail-page";
import { CategoriesAdminPage } from "@/features/portfolio/categories-admin-page";
import { ProjectDetailRouter } from "@/features/projects/project-detail-router";
import { TodosPage } from "@/features/todos/todos-page";
import { SettingsPage } from "@/features/theme/settings-page";

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <ProtectedRoute>
      <AppShell>{children}</AppShell>
    </ProtectedRoute>
  );
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/signup" element={<SignupPage />} />
      <Route
        path="/"
        element={
          <Shell>
            <PortfolioHome />
          </Shell>
        }
      />
      <Route
        path="/categories"
        element={
          <Shell>
            <CategoriesAdminPage />
          </Shell>
        }
      />
      <Route
        path="/categories/:categoryId"
        element={
          <Shell>
            <CategoryDetailPage />
          </Shell>
        }
      />
      <Route
        path="/projects/:projectId"
        element={
          <Shell>
            <ProjectDetailRouter />
          </Shell>
        }
      />
      <Route
        path="/todos"
        element={
          <Shell>
            <TodosPage />
          </Shell>
        }
      />
      <Route
        path="/settings"
        element={
          <Shell>
            <SettingsPage />
          </Shell>
        }
      />
    </Routes>
  );
}
