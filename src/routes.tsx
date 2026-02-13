// src/routes.tsx
import type { ReactElement } from "react";
import { Navigate, createBrowserRouter } from "react-router-dom";
import { getSession } from "./lib/session";

import StartPage from "./pages/StartPage";
import DashboardPage from "./pages/DashboardPage";
import GroupHomePage from "./pages/GroupHomePage";

function RequireAuth({ children }: { children: ReactElement }) {
  const s = getSession();
  return s ? children : <Navigate to="/" replace />;
}

export const router = createBrowserRouter([
  {
    path: "/",
    element: getSession() ? (
      <Navigate to="/dashboard" replace />
    ) : (
      <StartPage />
    ),
  },
  {
    path: "/dashboard",
    element: (
      <RequireAuth>
        <DashboardPage />
      </RequireAuth>
    ),
  },
  {
    path: "/g/:groupId",
    element: (
      <RequireAuth>
        <GroupHomePage />
      </RequireAuth>
    ),
  },
  { path: "*", element: <Navigate to="/" replace /> },
]);
