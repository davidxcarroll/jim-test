'use client'

/**
 * Matches Buy Me a Coffee's button.prod.min.js widget (no supporter count).
 * The img.buymeacoffee.com/button-api/ image always includes the count.
 */
export function BuyMeCoffeeButton() {
  return (
    <div className="flex justify-center">
      <a
        href="https://www.buymeacoffee.com/hazeltine"
        target="_blank"
        rel="noopener noreferrer"
        className="bmc-btn inline-flex items-center box-border no-underline hover:no-underline focus:no-underline active:no-underline cursor-pointer font-bold xl:text-base text-sm shadow-[inset_0_0_0_1px_#000000]"
        style={{
          height: 40,
          padding: '0 16px',
          fontFamily: 'var(--font-chakra-petch), sans-serif',
          fontWeight: 'bold',
          border: '1px solid white',
        }}
      >
        <span className="inline-flex items-center gap-1 text-[32px] leading-none select-none" aria-hidden>
          <span
            title="System text emoji"
            style={{
              fontFamily: 'Apple Color Emoji, Segoe UI Emoji, system-ui, sans-serif',
              fontVariantEmoji: 'text',
            }}
          >
            ☕
          </span>
        </span>
        <span
          className="bmc-btn-text"
          style={{
            marginLeft: 8,
            whiteSpace: 'nowrap',
            fontFamily: 'var(--font-chakra-petch), sans-serif',
          }}
        >
          Buy me a coffee
        </span>
      </a>
    </div>
  )
}
