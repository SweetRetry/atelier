# Method

How the work in atelier gets done. For how to use the engine, see `README.md`. [中文](METHOD.zh-CN.md)

## The loop

1. Paint.
2. Render and look at the image.
3. Say what is not good.
4. Find the cause.
5. Fix the painting if the cause is there. Fix the engine if the cause is there.
6. Go to 2.

The preview takes under a second, so a painting can go round this loop a dozen times.

## Principles

1. **Build the tool for whoever uses it.** The engine is for Claude. A painting is a code file and the feedback is a PNG to look at.
2. **Let the painting pull the engine.** Add a capability only when a painting needs a mark the engine cannot make. The lake needed a reflection, so `composite` and `warp` were added.
3. **Accept with your eyes.** A change is not done until it is rendered and looked at, first whole, then cropped. Passing the typecheck is not done.
4. **One proof sheet per capability.** Each panel isolates one behaviour and states the expected result. Proof sheets expose errors of concept that finished paintings hide.
5. **Say what is not good.** List the flaws of every finished piece. Sort each one as a limit of the engine, a limit of the painter, or a choice. Only the first is fixed by adding tools.
6. **Find the cause before turning a knob.** White paint could not cover dark paint because covering and mixing shared one formula. No parameter would have fixed that.
7. **Label every number.** Measured, inferred, or a guess.
8. **Say no, and say what would change your mind.** No GPU backend, because wet mixing is many small serial steps. That changes if a whole-sheet water simulation is needed.
9. **Reuse a mechanism before adding one.** Pencil, charcoal and pastel are wet-layer strokes with one extra parameter.
10. **Break a weak spot into parts you can control.** For the cat: a frontal pose, one simple shape per layer, and whole-group transforms to fix proportion.
11. **Compare side by side.** Tile the candidates into one image with `bun sheet`. Do not compare from memory.
12. **Report what you broke.** Regressions introduced on the way are part of the report.
13. **Turn a repeated chore into a tool.** Re-rendering every work by hand after an engine change became `bun verify`.

## Checklists

**A new painting.** Decide what it says before choosing the subject. Pick layer kinds. Render small and fix in this order: composition, form, color, texture. Crop to check key parts. Compare a few seeds. Render full. Write down what is still not good.

**An engine change.** Run `bun verify` first. Make the change and give it a proof panel. Look at the proof sheet. Run `bun run check` and `bun verify`. Look at anything that changed, and update the baseline only if the change is intended. Update `README.md`.

**A flaw.** Reproduce it, ideally as one proof panel. Ask why until you reach the mechanism. Decide whether it is worth fixing. After the fix, look again and check for new problems.
