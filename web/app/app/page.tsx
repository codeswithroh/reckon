import type { Metadata } from "next";
import { DashboardApp } from "../components/DashboardApp";

export const metadata: Metadata = {
  title: "Dashboard: Reckon",
  description: "Check your Monad wallet's real safety history, live, and send guarded transactions.",
};

export default function DashboardPage() {
  return <DashboardApp />;
}
