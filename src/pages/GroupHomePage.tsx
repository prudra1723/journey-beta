// src/pages/GroupHomePage.tsx
import { useNavigate, useParams } from "react-router-dom";
import { GroupHome } from "./GroupHome";

export default function GroupHomePage() {
  const { groupId } = useParams<{ groupId: string }>();
  const nav = useNavigate();

  if (!groupId) return null;
  return <GroupHome groupId={groupId} onBack={() => nav("/dashboard")} />;
}
