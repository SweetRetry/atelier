---
name: paint
description: Paint a picture with the atelier engine. Use when asked to paint, draw or illustrate something (画一幅画, 绘画), to paint from a reference image, or to revise a work in atelier/works.
---

Atelier lives at `/Users/zhangzimin/Documents/sweetRetry/projects/atelier`. Run every command from there.

Before writing, read `README.md` (the engine API) and the finished work nearest to your medium. `works/004-new-friend.ts` is the bar for a character. `works/001-someone-is-awake.ts` is the bar for a landscape. `METHOD.md` holds the principles and the checklist for changing the engine.

A painting is built from large to small. Each step below ends on a render you look at. Move on only when its criterion holds.

## Steps

1. **Brief.** Write three lines as the header comment of the work: what the picture says, where the focal point is, which medium and why. Done when one sentence names the single thing the eye should land on first.

2. **Value thumbnail.** Block in the whole picture with flat shapes in three to five values. The focal point gets the strongest light against dark. Render `bun paint <work> --gray --scale 0.15` and look. Done when the subject's silhouette is identifiable in that gray thumbnail and the focal point holds the highest contrast on the sheet.

3. **Form.** Build each hard form from one simple shape per layer. Fix proportion with a transform on the whole group. Layer creation order is the stacking order, so create what sits behind first. Declare one light direction as a constant and shade every form from it, using `atop` so shading stays inside the form. Done when a `--crop` of every key part (face, eyes, hands, paws, the focal object) reads as what it is in `--gray`.

4. **Color.** Declare the palette as named constants at the top: one dominant hue family, one accent, neutrals. The accent goes on the focal point. Done when the colored preview and the gray thumbnail agree on where the eye lands.

5. **Texture and detail.** Every texture mark belongs to a form. It follows the form's direction, stays inside the form's silhouette (`atop` or `clip`), and spans less value than the form's own light-to-shadow range. Line work is either the style of the whole picture or absent. Done when the gray thumbnail still reads as it did at step 2.

6. **Critique.** Render the preview and look at it whole. Then crop every key part at two times or more and look at each. Write the flaws as a list, each with its cause. Fix and render again. Done when every flaw left on the list is a deliberate choice or an engine limit, and every key part has been looked at in its latest crop.

7. **Seeds.** Render three seeds, tile them with `bun sheet`, and keep the best. Done when `meta.seed` is the one you picked from the sheet.

8. **Deliver.** Render `--full` and look at it. Tell the user where the file is and list what is still not good, each sorted as engine limit, painter limit, or choice.

## When the user gives a reference image

The reference is the criterion for every step. Work from the file, never from memory of it.

1. **Get the file.** Save the reference under `refs/`. A pasted image has no file, so ask the user for its path before painting. Done when `refs/<name>` opens with Read.
2. **Study.** Write into the header comment what makes the reference itself: the crop and where each landmark sits as a fraction of the frame, the value range, the palette, the edge quality, the kind of line, and the three details that carry it. Take colors from the file with `Reference.load` and `ref.color(x, y)`, and write them as the palette constants. Done when every landmark has measured coordinates and every palette constant has a sampled source.
3. **Compare at every step.** After each render run `bun compare <work> refs/<name>` and look at the sheet. It shows reference and render side by side in color and gray. Use `--crop fx,fy,fw,fh` (fractions) for each key part. The done criterion of every step above becomes: the two halves of the sheet agree on that step's subject (placement and values, then form, then color, then texture).
4. **Deliver.** Show the user the final compare sheet and list each remaining difference with its cause.

A study of another artist's picture is practice. Say so in the header comment and keep the artist's credit with it.

## When the engine is in the way

If a flaw's cause is a mark the engine cannot make, follow the engine-change checklist in `METHOD.md`. Run `bun verify` before and after. Works by other sessions must stay `same`.

## Craft notes

- **Faces and figures.** Build the head with `head()` and the body with `figure()`, put them in a `scene`, and draw over them. Any turn of the head is available. Type features in face coordinates and place them with `head.on(u, v)`. Skip a feature when `scene.sees` says it is hidden. Eyes carry the picture, so give them a dark rim, an iris gradient and one highlight from the declared light.
- **Soft edges.** Fur and hair edges are a soft down dab plus a few fine hairs. See `fringe` in `works/004-new-friend.ts`.
- **Glow and shadow.** A soft shadow is `silhouette` then `blur`. A light source needs dark around it to read as light.
- **Unfamiliar subject.** Paint the hard part alone in a scratch work first, then bring it into the picture.
- **Measure before judging.** `bun measure <work>` prints where each layer sits, the value grid and where the strongest edges are. Use it to check that the focal point is among the `pull` cells and that parts are where you meant them.
- **Parts.** Draw each part in its own coordinates inside `layer.at({ x, y, s, rot }, fn)`. Sizes scale with it. Fix proportion by changing the placement.
- **Values.** When `bun measure` shows the range is too narrow or sits in the wrong place, fix the palette first. Use `adjust` or `levels` for the last few points.
- **From a reference.** `bun measure <work> --ref refs/<name> --at "x,y;..."` on each landmark prints how far off the render has it.
- **Randomness.** Take it from `p.rng.fork("name")`, and confine scattered things with `inPoly` or `clip` to the region they belong to.
