---
name: user-preferences
description: User coding conventions and tech preferences for this project
metadata:
  type: user
---

- **DB naming**: Table names PascalCase (`Activities`, `Users`), column names camelCase (`plannedDuration`, `lastCompletedDate`)
- **Validation**: Use Zod + drizzle-zod for models. Prefer explicit `z.object()` schemas in server functions over drizzle-zod auto-generated ones when type conflicts arise.
- **Language**: User communicates in Vietnamese; responds well to clear explanations in Vietnamese or English.
- **Design**: Mobile-first, iPhone primary. Uses app's existing sea-ink/lagoon color palette from styles.css.
- **Package manager**: Bun
