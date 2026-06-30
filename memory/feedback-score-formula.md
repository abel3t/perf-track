---
name: feedback-score-formula
description: Agreed scoring formula for activity performance points
metadata:
  type: feedback
---

Final agreed formula:

```
Score = actualDuration × multiplier × onTimeFactor × streakBonus × skipPenalty

onTimeFactor  = 1.1 (on time) | 0.9 (late)
streakBonus   = min(1 + streak × 0.01, 1.4)   ← caps at 40 days
skipPenalty   = max(0.5, 1 − (consecutiveSkips − 1) × 0.1)  [only when skips > 0]
```

- `actualDuration` = minutes logged manually by user at task end — NO CAP, "làm nhiêu ăn nhiêu"
- `multiplier` = x1–x10, importance set when creating task
- "On time" is a simple boolean the user toggles manually
- Streak is per-task (not global)
- Consecutive skips reset streak to 0 immediately

**Daily efficiency %** = achieved score / baseline (sum of plannedDuration × multiplier) × 100. Can exceed 100%.

**Why:** User wants effort = reward, no artificial caps. Task substitution (doing x10 instead of x1) is intentionally allowed.

**How to apply:** Never add caps to actualDuration. Never change the formula without explicit user approval.
