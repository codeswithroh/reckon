"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Logo } from "./Logo";
import { Icon, type IconName } from "./Icon";

const NAV: Array<{ href: string; label: string; icon: IconName }> = [
  { href: "/app", label: "Overview", icon: "layout-dashboard" },
  { href: "/app/proof", label: "On-chain proof", icon: "bar-chart-3" },
  { href: "/app/integrate", label: "Integrate", icon: "book-open" },
];

export function AppSidebar() {
  const pathname = usePathname();
  return (
    <aside className="app-sidebar">
      <Link href="/" className="app-sidebar-brand">
        <Logo />
        Reckon
      </Link>
      <span className="app-sidebar-eyebrow">Monad testnet</span>
      <nav className="app-sidebar-nav">
        {NAV.map((item) => {
          const active =
            item.href === "/app" ? pathname === "/app" || pathname === "/app/" : pathname?.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`app-sidebar-link ${active ? "active" : ""}`}
            >
              <Icon name={item.icon} size={16} />
              {item.label}
            </Link>
          );
        })}
      </nav>

      <div className="app-sidebar-spacer" />

      <div className="app-sidebar-foot">
        <a
          href="https://github.com/codeswithroh/reckon"
          className="app-sidebar-link"
          target="_blank"
          rel="noreferrer"
        >
          <Icon name="code-2" size={16} />
          GitHub
        </a>
        <Link href="/" className="app-sidebar-link">
          <Icon name="log-out" size={16} />
          Back to site
        </Link>
      </div>
    </aside>
  );
}
