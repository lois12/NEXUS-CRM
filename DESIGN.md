# NEXUS CRM — Design System Specification

## Identity
Product UI Designer — designing for a small creative team's daily workspace, not a consumer app.

## Grounding
Junior Designer assumption: This is a cyberpunk-themed internal CRM for a creative/marketing organization. The visual language draws from terminal aesthetics, neon-noir, and glass morphism — not "dark mode with green accent." The 90% state is a dashboard with data cards, not a marketing landing page.

---

## §1 Objective
NEXUS CRM is a local-first workspace for a small creative organization. It manages content plans, kanban tasks, partners, HR, inventory, events, projects, knowledge base, and brand assets. The design must feel like a command center — dense, fast, scannable — not a SaaS marketing page.

**Design goal:** Every screen should feel like looking at a terminal/holographic HUD. Data density > whitespace. Function > decoration.

---

## §2 Product Context
- **Users:** 5-15 people in a creative/marketing team
- **Daily drivers:** Dashboard, Kanban, Content Plan, IdeaMap
- **Occasional:** Partners, Vacations, Inventory, Events, Projects
- **Admin-only:** Users management, Inventory
- **Platform:** Desktop-first (Electron launcher + web), responsive down to tablet

---

## §3 Visual Foundations

### Color Palette
```css
/* Backgrounds */
--color-bg:          #0a0a0f     /* Main background — near-black with blue tint */
--color-card:        rgba(20, 20, 35, 0.8)  /* Card background — translucent dark */

/* Primary — Neon Green */
--color-primary:     #00ff88     /* Primary actions, active states, success */
--color-secondary:   #00cc6a     /* Hover states, secondary emphasis */
--color-glow:        rgba(0, 255, 136, 0.3)  /* Glow/shadow color */

/* Accent — Cyan */
--color-accent:      #00d4ff     /* Links, info, secondary actions */

/* Semantic */
--color-success:     #00ff88
--color-warning:     #eab308
--color-danger:      #ff3b30
--color-info:        #00d4ff

/* Text */
--color-text-primary:   #e8e8ec  /* High contrast — headings, body */
--color-text-secondary: #8888a0  /* Medium — labels, descriptions */
--color-text-tertiary:  #4a4a60  /* Low — placeholders, disabled */

/* Borders */
--color-border:      rgba(0, 255, 136, 0.2)  /* Default border — subtle neon */
```

### Typography
```
Headings:  Inter 700/800, tight letter-spacing (-0.02em)
Body:      Inter 400, 14px, line-height 1.6
Mono:      JetBrains Mono 400/700, 13px — used for data, labels, buttons, inputs
Data:      JetBrains Mono, tabular figures (tnum)
```

**Type scale (px):**
| Token | Size | Usage |
|-------|------|-------|
| xs | 11 | Captions, badges |
| sm | 13 | Buttons, inputs, labels |
| base | 14 | Body text |
| lg | 16 | Section headings |
| xl | 20 | Page titles |
| 2xl | 28 | Hero numbers, stats |
| 3xl | 40 | Dashboard hero |

### Spacing
Base unit: 4px. Scale: 2, 4, 8, 12, 16, 20, 24, 32, 40, 48, 64, 80, 96

### Border Radius
```
Cards:     16px
Buttons:   12px
Inputs:    12px
Badges:    8px
Small:     6px
```

### Shadows
```
neon:      0 0 20px rgba(0, 255, 136, 0.15)
neon-lg:   0 0 40px rgba(0, 255, 136, 0.25)
neon-pink: 0 0 20px rgba(255, 0, 255, 0.15)
neon-blue: 0 0 20px rgba(0, 212, 255, 0.15)
card:      0 4px 24px rgba(0, 0, 0, 0.3)
```

### Glass Morphism
Three tiers:
1. **glass** — light frosted, 20px blur, subtle white edge
2. **glass-accent** — with neon border glow
3. **glass-frost** — heavy frosted, 40px blur, for overlays

---

## §4 Accessibility
- **Contrast:** Text primary (#e8e8ec) on bg (#0a0a0f) = 15.8:1 — AAA
- **Neon green (#00ff88) on dark = 11.2:1 — AAA for large text**
- **Focus states:** All interactive elements have visible focus ring (3px glow)
- **Reduced motion:** `@media (prefers-reduced-motion: reduce)` disables all animations
- **Keyboard:** Full keyboard navigation for all CRUD operations

---

## §5 Voice & Tone
- **UI language:** Russian, informal-professional
- **System feedback:** Short, direct, no exclamation marks
- **Error messages:** State what happened + what to do
- **Success messages:** Brief confirmation, no celebration
- **Placeholders:** Uppercase JetBrains Mono, neon green at 30% opacity

---

## §6 Implementation Practices
- **Framework:** React 18 + TypeScript + Tailwind CSS
- **State:** Context API (AuthContext, ThemeContext)
- **Animations:** Framer Motion for page transitions, CSS for micro-interactions
- **Icons:** Lucide React — consistent 20px, currentColor
- **Rich text:** TipTap editor with custom cyberpunk styling

---

## §7 Anti-Patterns (Do Not)
- ❌ Gradient hero backgrounds (purple-blue-cyan)
- ❌ Rounded-16px-shadow-sm card grids with emoji icons
- ❌ "Seamlessly unlock your team's potential" copy
- ❌ White/light mode — the product is dark-only
- ❌ Decorative 3D illustrations or isometric people
- ❌ Floating stat cards with no context
- ❌ All actions as filled primary buttons — use ghost/outline for secondary

---

## §8 Decision-Making
Design decisions are documented in the Decision Trace section of each artifact. The trace format is:
```json
{
  "decision": "what was chosen",
  "reason": "why this fits",
  "alternatives": ["rejected options"],
  "tradeoff": "what this costs"
}
```

---

## §9 Workflow
1. DESIGN.md governs all visual artifacts in this project
2. New screens/components reference this spec for colors, spacing, typography
3. Deviations require a Decision Trace entry
4. The spec evolves — update this file when patterns change

---

## Decision Trace

| Decision | Reason | Alternatives | Tradeoff |
|----------|--------|-------------|----------|
| Neon green as primary | Cyberpunk identity, high contrast on dark | Blue (#3b82f6), Purple (#a855f7) | Harder to pair with warm accent colors |
| JetBrains Mono for UI | Terminal aesthetic, excellent readability | Fira Code, Source Code Pro | Slightly wider than Inter, more horizontal space |
| Glass morphism cards | Depth without flatness, fits "holographic HUD" | Solid dark cards, outlined cards | Performance cost on low-end devices |
| Dark-only theme | Core identity, reduces eye strain for desk workers | Light mode option | Users in bright environments may struggle |
| 16px card radius | Soft enough to feel modern, sharp enough to feel structured | 8px (too sharp), 24px (too bubbly) | Inconsistent with 12px button radius |
| Russian UI language | Team is Russian-speaking | English + Russian toggle | No internationalization path |
