import { SITE } from "@/lib/site";
import { Btn } from "./Btn";

const contactBtn = "min-h-[56px] w-full sm:min-h-0";

export function CloseContact() {
  return (
    <section id="contact" className="relative overflow-hidden px-7 pt-20">
      <div className="reveal mx-auto flex max-w-[980px] flex-wrap items-end justify-between gap-6 pb-10">
        <div>
          <h2 className="font-display max-w-[14ch] text-[clamp(28px,4vw,48px)] tracking-[-0.03em]">
            Ready when you are.
          </h2>
          <p className="mt-3 max-w-[36ch] text-xs leading-[1.55] text-ink-2">
            Tell us the model. We&apos;ll confirm stock and a firm price —{" "}
            {SITE.name}.
          </p>
          <p className="mt-2 text-[11px] tracking-[0.08em] text-muted">
            Viewing by appointment · Mon–Fri &amp; Sat morning
          </p>
        </div>
        <div className="grid w-full grid-cols-1 gap-3 sm:w-auto sm:grid-cols-3">
          <Btn href={SITE.phoneHref} className={contactBtn}>
            Call
          </Btn>
          <Btn href={SITE.whatsapp} external className={contactBtn}>
            WhatsApp
          </Btn>
          <Btn href={SITE.emailHref} solid className={contactBtn}>
            Email
          </Btn>
        </div>
      </div>
      <footer className="mx-auto max-w-[980px] border-t border-hair py-[18px] pb-2.5 text-[11px] tracking-[0.08em] text-muted">
        <div className="flex flex-wrap justify-between gap-x-6 gap-y-1">
          <span>{SITE.name}</span>
          <span className="flex flex-wrap gap-x-3 gap-y-1">
            <a href={SITE.phoneHref} className="hover:text-amber">
              {SITE.phoneDisplay}
            </a>
            <a href={SITE.emailHref} className="hover:text-amber">
              {SITE.email}
            </a>
          </span>
        </div>
        {SITE.companyNumber ? (
          <p className="mt-2 text-[12px] tracking-normal text-muted">
            {SITE.name} · Registered in England &amp; Wales · Company No.{" "}
            {SITE.companyNumber}
          </p>
        ) : null}
      </footer>
      <div
        className="font-display translate-y-[18%] text-center text-[clamp(72px,18vw,220px)] leading-[0.85] font-extrabold tracking-[-0.04em] text-ink opacity-[0.92] select-none"
        aria-hidden
      >
        UKSEV
      </div>
    </section>
  );
}
