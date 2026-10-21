import { SITE } from "@/lib/site";
import { Btn } from "./Btn";

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
        </div>
        <div className="flex flex-wrap gap-3">
          <Btn href={SITE.emailHref} solid>
            Email
          </Btn>
          <Btn href={SITE.phoneHref} solid>
            Call
          </Btn>
          <Btn href={SITE.whatsapp} external>
            WhatsApp
          </Btn>
        </div>
      </div>
      <div className="mx-auto flex max-w-[980px] justify-between border-t border-hair py-[18px] pb-2.5 text-[11px] tracking-[0.08em] text-muted">
        <span>{SITE.name}</span>
      </div>
      <div
        className="font-display translate-y-[18%] text-center text-[clamp(72px,18vw,220px)] leading-[0.85] font-extrabold tracking-[-0.04em] text-ink opacity-[0.92] select-none"
        aria-hidden
      >
        UKSEV
      </div>
    </section>
  );
}
