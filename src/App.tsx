import { useEffect, useState } from "react";
import { getSession } from "./lib/session";
import { Start } from "./pages/Start";
import { Dashboard } from "./pages/Dashboard";
import { GroupHome } from "./pages/GroupHome";

type Screen = "start" | "dashboard" | "group";

export default function App() {
  const [screen, setScreen] = useState<Screen>("start");
  const [activeGroupId, setActiveGroupId] = useState<string | null>(null);

  useEffect(() => {
    const s = getSession();
    setScreen(s ? "dashboard" : "start");
  }, []);

  // ✅ FIX: if screen is "group" but no activeGroupId, redirect in effect
  useEffect(() => {
    if (screen === "group" && !activeGroupId) {
      setScreen("dashboard");
    }
  }, [screen, activeGroupId]);

  if (screen === "start") {
    return (
      <Start
        onDone={(groupId) => {
          if (groupId) {
            setActiveGroupId(groupId);
            setScreen("group");
            return;
          }
          setScreen("dashboard");
        }}
      />
    );
  }

  if (screen === "dashboard") {
    return (
      <Dashboard
        onLogout={() => {
          setActiveGroupId(null);
          setScreen("start");
        }}
        onOpenGroup={(groupId) => {
          setActiveGroupId(groupId);
          setScreen("group");
        }}
      />
    );
  }

  // GROUP SCREEN
  if (!activeGroupId) {
    // ✅ no setState here
    return null;
  }

  return (
    <GroupHome groupId={activeGroupId} onBack={() => setScreen("dashboard")} />
  );
}
