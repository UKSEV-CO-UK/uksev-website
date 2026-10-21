const P = {
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.3,
  strokeLinejoin: "round" as const,
  strokeLinecap: "round" as const,
};

const paths = {
  cam: (
    <g {...P}>
      <path d="M2 5.2h2.6L5.8 3.5h4.4l1.2 1.7H14V13H2z" />
      <circle cx="8" cy="8.8" r="2.3" />
    </g>
  ),
  phone: (
    <path
      {...P}
      d="M5.4 2.5 3.3 3c-.6.2-1 .8-.9 1.4.6 4.8 4.4 8.6 9.2 9.2.6.1 1.2-.3 1.4-.9l.5-2.1-2.7-1.3-1.2 1.3c-1.6-.7-2.9-2-3.6-3.6L7.3 5.8z"
    />
  ),
  chat: <path {...P} d="M8 2.2a5.8 5.8 0 0 0-5 8.7L2.3 13.8l3-.8A5.8 5.8 0 1 0 8 2.2z" />,
  mail: (
    <g {...P}>
      <rect x="2" y="3.5" width="12" height="9" rx="1.5" />
      <path d="m2.5 4.5 5.5 4 5.5-4" />
    </g>
  ),
  pin: (
    <g {...P}>
      <path d="M8 14.5s4.5-4.2 4.5-8a4.5 4.5 0 0 0-9 0c0 3.8 4.5 8 4.5 8z" />
      <circle cx="8" cy="6.5" r="1.6" />
    </g>
  ),
  chev: <path {...P} strokeWidth={1.4} d="m4.5 6.2 3.5 3.5 3.5-3.5" />,
  check: <path {...P} strokeWidth={1.6} d="m3.5 8.4 2.9 2.8 6.1-6.4" />,
  x: <path {...P} strokeWidth={1.5} d="m4.5 4.5 7 7m0-7-7 7" />,
  search: (
    <g {...P} strokeWidth={1.4}>
      <circle cx="7" cy="7" r="4.5" />
      <path d="m10.5 10.5 3 3" />
    </g>
  ),
};

export type IconName = keyof typeof paths;

export function Icon({ name, className = "i" }: { name: IconName; className?: string }) {
  return (
    <svg viewBox="0 0 16 16" className={className} aria-hidden="true">
      {paths[name]}
    </svg>
  );
}
