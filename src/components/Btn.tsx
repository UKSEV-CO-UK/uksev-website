import Link from "next/link";
import type { ComponentProps } from "react";

type BtnProps = {
  href: string;
  solid?: boolean;
  children: React.ReactNode;
  className?: string;
  external?: boolean;
} & Omit<ComponentProps<"a">, "href" | "className" | "children">;

const base =
  "inline-flex items-center justify-center rounded-full border border-hair px-[18px] py-3 text-[10.5px] font-semibold tracking-[0.14em] uppercase transition-colors hover:border-amber hover:text-amber";
const solidCls =
  "border-ink bg-ink !text-ground hover:border-amber hover:bg-amber hover:!text-ground";

function isPlainAnchor(href: string) {
  return (
    href.startsWith("http") ||
    href.startsWith("tel:") ||
    href.startsWith("mailto:") ||
    href.startsWith("sms:")
  );
}

export function Btn({
  href,
  solid,
  children,
  className = "",
  external,
  ...rest
}: BtnProps) {
  const cls = `${base} ${solid ? solidCls : ""} ${className}`.trim();
  if (external || isPlainAnchor(href)) {
    return (
      <a
        href={href}
        className={cls}
        {...(href.startsWith("http")
          ? { target: "_blank", rel: "noopener noreferrer" }
          : {})}
        {...rest}
      >
        {children}
      </a>
    );
  }
  return (
    <Link href={href} className={cls} {...rest}>
      {children}
    </Link>
  );
}
