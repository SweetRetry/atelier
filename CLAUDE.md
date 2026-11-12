# atelier

A painting engine built for Claude, and the paintings made with it. `README.md` is the reference for the engine. `METHOD.md` is how the work is done. Read `METHOD.md` before starting a painting or changing the engine.

## Rules

- Works import only from `engine/index.ts`.
- After any change to a painting, render it and look at the image. First the whole, then a crop of the part that changed.
- After any change to the engine, run `bun run check` and `bun verify`. Every work must report `same`. If one changed, look at it. Run `bun verify --update` only when the change is intended.
- When the engine cannot make a mark a painting needs, change the engine. Do not settle for a weaker picture or work around the gap in the painting.
- A new engine capability gets a panel in a proof sheet (`works/000-*.ts`) with the expected result written in a comment.
- When a mark looks wrong, find the cause in the mechanism before changing a parameter.
- Report what is still not good, and say whether it is a limit of the engine, of the painter, or a choice.
- Label every number as measured, inferred, or a guess.
- Keep `README.md` current, including its list of known limits.

## Commands

```
bun paint <work> [--scale n] [--crop x,y,w,h] [--only a,b] [--seed n] [--full]
bun verify [--update]
bun sheet out.png a.png b.png
bun compare <work> <reference image> [--crop fx,fy,fw,fh]
bun measure <work> [--at x,y;x,y] [--ref image] [--grid n] [--crop x,y,w,h]
bun run check
```

To make or revise a painting, follow the `paint` skill in `.claude/skills/paint/SKILL.md`.
