import { Navigate, Route, Routes } from "react-router-dom";
import { AppShell } from "./components/layout/AppShell";
import { Overview } from "./pages/Overview";
import { Events } from "./pages/Events";
import { EventDetails } from "./pages/EventDetails";
import { CommandCenter } from "./pages/CommandCenter";
import { Schedule } from "./pages/Schedule";
import { Teams } from "./pages/Teams";
import { Volunteers } from "./pages/Volunteers";
import { Tasks } from "./pages/Tasks";
import { Resources } from "./pages/Resources";
import { Incidents } from "./pages/Incidents";
import { Timeline } from "./pages/Timeline";
import { ImpactSimulator } from "./pages/ImpactSimulator";
import { Knowledge } from "./pages/Knowledge";
import { Copilot } from "./pages/Copilot";
import { Settings } from "./pages/Settings";
import { NotionConnect } from "./pages/NotionConnect";
import { SyncCenter } from "./pages/SyncCenter";
import { Reports } from "./pages/Reports";
import { Replay } from "./pages/Replay";
import { VolunteerMobile } from "./pages/VolunteerMobile";
import { Join } from "./pages/Join";
import { Docs } from "./pages/Docs";

export default function App() {
  return (
    <Routes>
      <Route element={<AppShell />}>
        <Route path="/" element={<Overview />} />
        <Route path="/events" element={<Events />} />
        <Route path="/events/:eventId" element={<EventDetails />} />
        <Route path="/command" element={<CommandCenter />} />
        <Route path="/schedule" element={<Schedule />} />
        <Route path="/teams" element={<Teams />} />
        <Route path="/volunteers" element={<Volunteers />} />
        <Route path="/tasks" element={<Tasks />} />
        <Route path="/resources" element={<Resources />} />
        <Route path="/incidents" element={<Incidents />} />
        <Route path="/timeline" element={<Timeline />} />
        <Route path="/replay" element={<Replay />} />
        <Route path="/impact" element={<ImpactSimulator />} />
        <Route path="/reports" element={<Reports />} />
        <Route path="/knowledge" element={<Knowledge />} />
        <Route path="/copilot" element={<Copilot />} />
        <Route path="/notion" element={<NotionConnect />} />
        <Route path="/sync" element={<SyncCenter />} />
        <Route path="/me" element={<VolunteerMobile />} />
        <Route path="/join" element={<Join />} />
        <Route path="/docs" element={<Docs />} />
        <Route path="/settings" element={<Settings />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  );
}
