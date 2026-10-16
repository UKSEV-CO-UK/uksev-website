/** Icons from the admin mockups (16×16 strokes). */
const S = { fill: "none", stroke: "currentColor", strokeLinecap: "round" as const, strokeLinejoin: "round" as const };
const paths = {
  check: <path {...S} strokeWidth={1.6} d="m3.5 8.4 2.9 2.8 6.1-6.4" />,
  x: <path {...S} strokeWidth={1.5} d="m4.5 4.5 7 7m0-7-7 7" />,
  alert: (
    <g {...S} strokeWidth={1.4}>
      <circle cx="8" cy="8" r="6" />
      <path d="M8 4.8v3.6M8 10.9v.1" />
    </g>
  ),
  ext: <path {...S} strokeWidth={1.3} d="M6 3.5h6.5V10M12.5 3.5 4 12" />,
  edit: <path {...S} strokeWidth={1.3} d="M10.8 2.7 13.3 5.2 5.6 12.9 2.6 13.4l.5-3z M9.4 4.1l2.5 2.5" />,
  search: (
    <g {...S} strokeWidth={1.4}>
      <circle cx="7" cy="7" r="4.5" />
      <path d="m10.5 10.5 3 3" />
    </g>
  ),
  cam: (
    <g {...S} strokeWidth={1.3}>
      <path d="M2 5.2h2.6L5.8 3.5h4.4l1.2 1.7H14V13H2z" />
      <circle cx="8" cy="8.8" r="2.3" />
    </g>
  ),
  grip: (
    <g fill="currentColor">
      <circle cx="6" cy="4" r="1.1" />
      <circle cx="10" cy="4" r="1.1" />
      <circle cx="6" cy="8" r="1.1" />
      <circle cx="10" cy="8" r="1.1" />
      <circle cx="6" cy="12" r="1.1" />
      <circle cx="10" cy="12" r="1.1" />
    </g>
  ),
  left: <path {...S} strokeWidth={1.5} d="M10 3.5 5.5 8l4.5 4.5" />,
  chev: <path {...S} strokeWidth={1.4} d="m4.5 6.2 3.5 3.5 3.5-3.5" />,
  key: (
    <g {...S} strokeWidth={1.3}>
      <circle cx="5.5" cy="10.5" r="3" />
      <path d="M7.7 8.3 13.5 2.5M11.5 4.5l1.8 1.8M10 6l1.3 1.3" />
    </g>
  ),
  eye: (
    <g {...S} strokeWidth={1.3}>
      <path d="M1.5 8S4 3.5 8 3.5 14.5 8 14.5 8 12 12.5 8 12.5 1.5 8 1.5 8z" />
      <circle cx="8" cy="8" r="2" />
    </g>
  ),
  lock: (
    <g {...S} strokeWidth={1.3}>
      <rect x="3" y="7" width="10" height="7" rx="1.5" />
      <path d="M5.5 7V5a2.5 2.5 0 0 1 5 0v2" />
    </g>
  ),
};
export type AIconName = keyof typeof paths;

export function AIcon({ name, className }: { name: AIconName; className?: string }) {
  return (
    <svg viewBox="0 0 16 16" className={className} aria-hidden="true">
      {paths[name]}
    </svg>
  );
}
