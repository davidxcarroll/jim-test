'use client'

/**
 * Matches Buy Me a Coffee's button.prod.min.js widget (no supporter count).
 * The img.buymeacoffee.com/button-api/ image always includes the count.
 */
export function BuyMeCoffeeButton() {
  return (
    <div className="flex justify-center mt-4 mb-4">
      <a
        href="https://www.buymeacoffee.com/hazeltine"
        target="_blank"
        rel="noopener noreferrer"
        className="bmc-btn inline-flex items-center box-border no-underline hover:no-underline focus:no-underline active:no-underline cursor-pointer"
        style={{
          minWidth: 210,
          height: 48,
          borderRadius: 0,
          padding: '0 16px',
          fontFamily: 'var(--font-chakra-petch), sans-serif',
          fontSize: 24,
          fontWeight: 'bold',
          lineHeight: '27px',
          border: '2px solid',
          borderColor: '#000000',
        }}
      >
        <span className="text-[32px] leading-none select-none" aria-hidden>
          ☕
        </span>
        <span
          className="bmc-btn-text"
          style={{
            marginLeft: 8,
            whiteSpace: 'nowrap',
            fontFamily: 'var(--font-chakra-petch), sans-serif',
          }}
        >
          Buy me a coffee!
        </span>
      </a>
    </div>
  )
}
