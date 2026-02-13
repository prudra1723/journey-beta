// src/pages/StartPage.tsx
import { useNavigate } from "react-router-dom";
import { Start } from "./Start";

export default function StartPage() {
  const nav = useNavigate();
  return (
    <Start
      onDone={(groupId) =>
        nav(groupId ? `/g/${groupId}` : "/dashboard", { replace: true })
      }
    />
  );
}
