import { Logo } from "./Logo";

export function Footer() {
  return (
    <footer className="site-footer">
      <div className="footer-top">
        <div className="footer-brand">
          <div className="brand">
            <Logo />
            Reckon
          </div>
          <p>A transaction seatbelt for Monad. Stop burning MON on failures and oversized limits.</p>
        </div>

        <div className="footer-col">
          <span className="footer-heading">Product</span>
          <a href="/app">Dashboard</a>
          <a href="/app/proof">Proof</a>
          <a href="/app/integrate">Integrate</a>
        </div>

        <div className="footer-col">
          <span className="footer-heading">Contract</span>
          <a href="https://testnet.monadscan.com/address/0x84e5C3c524f473c19821ae2D1494b274730bB6AE">
            Monadscan &#8599;
          </a>
          <a href="https://testnet.monadexplorer.com/address/0x84e5C3c524f473c19821ae2D1494b274730bB6AE">
            Explorer &#8599;
          </a>
        </div>

        <div className="footer-col">
          <span className="footer-heading">Project</span>
          <a href="https://github.com/codeswithroh/reckon">GitHub &#8599;</a>
          <a href="https://github.com/codeswithroh/reckon/blob/main/PLAN.md">Build plan &#8599;</a>
          <a href="https://github.com/codeswithroh/reckon/blob/main/research/gas-model/VERIFICATION.md">
            Verified problem &#8599;
          </a>
        </div>
      </div>
      <div className="footer-bottom">
        <span>Built on Monad testnet. MIT licensed.</span>
        <span className="mono">Built with Monskills</span>
      </div>
    </footer>
  );
}
