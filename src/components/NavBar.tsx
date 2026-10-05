"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { SITE } from "@/lib/site";

const links = [
  { href: "/shop", label: "Rides" },
  { href: "/#brands", label: "Brands" },
  { href: "/#stock", label: "Stock" },
  { href: "/#about", label: "About" },
  { href: "/#contact", label: "Contact" },
];

export function NavBar() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  return (
    <header className="fixed inset-x-0 top-0 z-50 flex h-[58px] items-center justify-between border-b border-hair bg-[rgba(10,12,14,0.72)] px-4 backdrop-blur-[14px] sm:px-7">
      <Link
        href="/"
        className="font-display flex items-center gap-2.5 text-[15px] font-bold tracking-[-0.02em]"
        aria-label="UKSEV LTD"
        onClick={() => setOpen(false)}
      >
        <Image
          src="/logo/logo-b.svg"
          alt=""
          width={120}
          height={34}
          className="h-[34px] w-auto"
          priority
        />
        <span>
          UKSEV<span className="text-amber">.</span>
        </span>
      </Link>

      <nav className="hidden items-center gap-[22px] md:flex" aria-label="Primary">
        {links.map((l) => {
          const path = pathname.replace(/\/$/, "") || "/";
          const hrefPath = l.href.split("#")[0] || "/";
          const on = hrefPath !== "/" && path === hrefPath.replace(/\/$/, "");
          return (
            <Link
              key={l.href}
              href={l.href}
              className={`text-[10.5px] font-medium tracking-[0.14em] uppercase transition-colors hover:text-amber ${
                on ? "text-amber" : "text-ink-2"
              }`}
            >
              {l.label}
            </Link>
          );
        })}
        <a
          href={SITE.phoneHref}
          className="rounded-full border border-hair px-3.5 py-2 text-[10.5px] font-semibold tracking-[0.14em] uppercase transition-colors hover:border-amber hover:text-amber"
        >
          Call
        </a>
      </nav>

      <div className="flex items-center gap-3 md:hidden">
        <a
          href={SITE.phoneHref}
          className="rounded-full border border-hair px-3.5 py-2 text-[10.5px] font-semibold tracking-[0.14em] uppercase"
        >
          Call
        </a>
        <button
          type="button"
          className="border-0 bg-transparent text-lg text-ink"
          aria-label="Menu"
          aria-expanded={open}
          onClick={() => setOpen((v) => !v)}
        >
          {open ? "✕" : "☰"}
        </button>
      </div>

      {open && (
        <nav
          className="absolute inset-x-0 top-[58px] flex flex-col gap-1 border-b border-hair bg-[rgba(10,12,14,0.96)] px-4 py-4 backdrop-blur-[14px] md:hidden"
          aria-label="Mobile"
        >
          {links.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              className="py-2.5 text-[11px] font-medium tracking-[0.14em] uppercase text-ink-2 hover:text-amber"
              onClick={() => setOpen(false)}
            >
              {l.label}
            </Link>
          ))}
        </nav>
      )}
    </header>
  );
}
