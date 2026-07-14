import Link from "next/link";
import { Logo } from "./Logo";

const LANDING_LINKS = [
  { href: "/#problem", label: "Problem" },
  { href: "/#how-it-works", label: "How it works" },
  { href: "/#proof", label: "Proof" },
];

const APP_LINKS = [
  { href: "/app", label: "Dashboard" },
  { href: "/app/proof", label: "Proof" },
  { href: "/app/integrate", label: "Integrate" },
];

export function Header({ variant }: { variant: "landing" | "app" }) {
  const links = variant === "landing" ? LANDING_LINKS : APP_LINKS;
  return (
    <nav className="nav">
      <Link href="/" className="brand">
        <Logo />
        Reckon
      </Link>
      <div className="nav-links">
        {links.map((l) => (
          <a key={l.href} href={l.href}>
            {l.label}
          </a>
        ))}
        <a href="https://github.com/codeswithroh/reckon">GitHub &#8599;</a>
        {variant === "landing" ? (
          <Link href="/app" className="btn btn-primary btn-sm">
            Launch app
          </Link>
        ) : (
          <Link href="/" className="btn btn-sm">
            &#8592; Back to site
          </Link>
        )}
      </div>
    </nav>
  );
}
