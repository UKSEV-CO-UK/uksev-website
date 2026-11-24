import { SITE } from "@/config/site";
import "./preowned.css";

export default function PreownedLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="po">
      {children}
      <footer className="foot">
        <div className="in">
          <div>
            <b>{SITE.name}</b>
          </div>
          <div>
            <span className="parts">
              <a href={SITE.phoneHref}>{SITE.phoneDisplay}</a>
              <a href={SITE.emailHref}>{SITE.email}</a>
            </span>
          </div>
        </div>
      </footer>
    </div>
  );
}
