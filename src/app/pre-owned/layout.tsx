import { SITE } from "@/lib/site";
import "./preowned.css";

export default function PreownedLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="po">
      {children}
      <footer className="foot">
        <div className="in">
          <div>
            <b>{SITE.name}</b> · {SITE.address}
          </div>
          <div>
            <a href={SITE.phoneHref}>{SITE.phoneDisplay}</a> · <a href={SITE.emailHref}>{SITE.email}</a>
          </div>
        </div>
      </footer>
    </div>
  );
}
