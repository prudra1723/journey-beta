// src/routes.tsx
import type { ReactElement } from "react";
import { Navigate, createBrowserRouter } from "react-router-dom";
import { getLastGroupId, getSession } from "./lib/session";

import StartPage from "./pages/StartPage";
import DashboardPage from "./pages/DashboardPage";
import GroupHomePage from "./pages/GroupHomePage";
import PrivacyPolicyPage from "./pages/PrivacyPolicyPage";
import TermsPage from "./pages/TermsPage";
import CookiesPolicyPage from "./pages/CookiesPolicyPage";

function RequireAuth({ children }: { children: ReactElement }) {
  const s = getSession();
  return s ? children : <Navigate to="/" replace />;
}

export const router = createBrowserRouter([
  {
    path: "/",
    element: getSession() ? (
      <Navigate
        to={getLastGroupId() ? `/g/${getLastGroupId()}` : "/dashboard"}
        replace
      />
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
  { path: "/privacy", element: <PrivacyPolicyPage /> },
  { path: "/terms", element: <TermsPage /> },
  { path: "/cookies", element: <CookiesPolicyPage /> },
  { path: "*", element: <Navigate to="/" replace /> },
]);
