import type { ReactNode } from "react";
import { AppSidebar } from "../components/AppSidebar";
import { AppTopbar } from "../components/AppTopbar";
import { RevealController } from "../components/Reveal";

export default function AppLayout({ children }: { children: ReactNode }) {
  return (
    <div className="app-shell">
      <RevealController />
      <AppSidebar />
      <div className="app-main">
        <AppTopbar />
        <div className="app-content">{children}</div>
      </div>
    </div>
  );
}
