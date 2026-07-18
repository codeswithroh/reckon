import Link from "next/link";
import { Logo } from "./Logo";

const LANDING_LINKS = [
  { href: "/#problem", label: "Problem" },
  { href: "/#how-it-works", label: "How it works" },
  { href: "/#proof", label: "Proof" },
];

export function Header() {
  return (
    <nav className="nav">
      <Link href="/" className="brand">
        <Logo />
        Reckon
      </Link>
      <div className="nav-links">
        {LANDING_LINKS.map((l) => (
          <a key={l.href} href={l.href}>
            {l.label}
          </a>
        ))}
        <a href="https://github.com/codeswithroh/reckon">GitHub &#8599;</a>
        <Link href="/app" className="btn btn-primary btn-sm">
          Launch app
        </Link>
      </div>
    </nav>
  );
}
