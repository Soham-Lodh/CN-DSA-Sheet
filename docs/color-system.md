# Obsidian Circuit design tokens

[`tailwind.config.ts`](../tailwind.config.ts) is the project's single source of truth for colour values.
Add or change a hex value there; Tailwind regenerates every semantic utility that
uses the token. Do not introduce hex, `rgb()`, or `rgba()` values in components
or global CSS.

## Token groups

| Group | Use for | Example utility |
| --- | --- | --- |
| `brand` | Primary action, hover, accent, and glow | `bg-brand-primary`, `hover:bg-brand-hover` |
| `surface` | Base, page, card, elevated, and input planes | `bg-surface-card`, `bg-surface-input` |
| `content` | Foreground text and icons | `text-content-primary`, `text-content-muted` |
| `outline` | Borders and separators | `border-outline-subtle`, `border-outline-hairline` |
| `status` | Success, warning, danger, and informational states | `text-status-success`, `bg-status-danger-subtle` |
| `rank` | Gold, silver, and bronze leaderboard treatment | `text-rank-gold` |

## React and Lucide examples

```tsx
import { Trophy } from "lucide-react";

export function RankCard() {
  return (
    <section className="bg-surface-card border border-outline-subtle rounded-xl p-4">
      <Trophy className="size-5 text-brand-primary" aria-hidden />
      <h2 className="text-content-primary">Your rank</h2>
      <p className="text-content-secondary">Top 10%</p>
      <span className="bg-status-success-subtle text-status-success">Improving</span>
    </section>
  );
}
```

Use static, complete class names so Tailwind can detect them. For conditional
colours, map values to complete utilities rather than building strings:

```ts
const difficultyClass = {
  EASY: "text-status-success",
  MEDIUM: "text-status-warning",
  HARD: "text-status-danger",
} as const;
```

For reusable global CSS, compose the same tokens with `@apply`:

```css
.panel { @apply bg-surface-card text-content-primary border border-outline-subtle; }
```

## Naming rule

Use semantic names in components: `brand-primary`, `surface-card`,
`content-muted`, and `status-danger`. They describe purpose rather than a shade,
so a central change updates the entire interface safely. Legacy palette aliases
are deliberately not configured: using an unknown color utility fails visibly
during review instead of silently bypassing the design system.
