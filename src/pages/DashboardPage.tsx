// src/pages/DashboardPage.tsx
import { useNavigate } from "react-router-dom";
import { Dashboard } from "./Dashboard";

export default function DashboardPage() {
  const nav = useNavigate();

  return (
    <Dashboard
      onLogout={() => nav("/", { replace: true })}
      onOpenGroup={(groupId) => nav(`/g/${groupId}`)}
    />
  );
}
