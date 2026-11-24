import { money, priceText } from "@/lib/newbikes-types";

/**
 * Sale price first, then optional struck-through original.
 * Style (UI, 2026-11-23): sale in the existing price colour at normal weight;
 * original at 0.75× the sale size, body grey at 60% opacity, 1px strikethrough
 * in the same colour, 8px gap, bottom-aligned. No SALE badge, no percentage.
 * Only rendered when wasPrice is set and greater than price.
 */
export function SalePrice({
  price,
  wasPrice,
  priceFrom,
  className = "text-lg",
}: {
  price: number;
  wasPrice?: number;
  /** Show the price as a starting price ("From £1,559"). */
  priceFrom?: boolean;
  className?: string;
}) {
  const showWas = wasPrice != null && wasPrice > price;
  return (
    <div className={`flex items-end gap-2 font-display font-normal text-ink ${className}`.trim()}>
      <span>{priceText({ price, priceFrom })}</span>
      {showWas && (
        <s
          className="text-ink-2 decoration-ink-2 [font-size:0.75em] decoration-1"
          style={{ color: "rgb(158 165 168 / 0.6)", textDecorationColor: "rgb(158 165 168 / 0.6)" }}
        >
          {money(wasPrice)}
        </s>
      )}
    </div>
  );
}
