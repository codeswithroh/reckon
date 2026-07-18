import type { Metadata } from "next";
import { IntegrateTabs } from "../../components/IntegrateTabs";

export const metadata: Metadata = {
  title: "Integrate: Reckon",
  description: "Add the Reckon seatbelt to your dApp, agent, or wallet: SDK, MCP guard, wallet guard.",
};

export default function IntegratePage() {
  return (
    <div className="dash-panel" data-reveal>
      <IntegrateTabs />
    </div>
  );
}
