import type { Metadata } from "next";
import { Header } from "../../components/Header";
import { Footer } from "../../components/Footer";
import { RevealController } from "../../components/Reveal";
import { IntegrateTabs } from "../../components/IntegrateTabs";

export const metadata: Metadata = {
  title: "Integrate: Reckon",
  description: "Add the Reckon seatbelt to your dApp, agent, or wallet: SDK, MCP guard, wallet guard.",
};

export default function IntegratePage() {
  return (
    <div className="wrap">
      <RevealController />
      <Header variant="app" />

      <div className="app-shell-banner">
        <h1>Integrate Reckon</h1>
        <p>
          Four surfaces, one pre-flight engine underneath. Pick the one that matches where your
          transactions come from.
        </p>
      </div>

      <section style={{ paddingTop: 12 }}>
        <IntegrateTabs />
      </section>

      <Footer />
    </div>
  );
}
