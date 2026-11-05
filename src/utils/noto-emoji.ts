/**
 * U+FE0F (emoji presentation) overrides `font-variant-emoji: text` and
 * makes the browser draw the platform color emoji instead of Noto Emoji.
 */
export function notoEmoji(value: string): string {
  return value.replace(/\uFE0F/g, '')
}
