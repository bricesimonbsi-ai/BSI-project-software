import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { AppQueryProvider } from "@/app/providers/query-client";
import { AuthProvider } from "@/app/providers/auth-provider";
import { ThemeProvider } from "@/app/providers/theme-provider";
import { Toaster } from "@/components/ui/toaster";
import App from "./App";
import "./index.css";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <BrowserRouter>
      <AppQueryProvider>
        <AuthProvider>
          <ThemeProvider>
            <App />
            <Toaster />
          </ThemeProvider>
        </AuthProvider>
      </AppQueryProvider>
    </BrowserRouter>
  </StrictMode>
);
