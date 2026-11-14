# Family poster design and style

## Purpose

The family poster turns the recorded family line into a decorative PNG download. It is a read-only view: changing poster options changes the composition, not the underlying family data.

This document describes the existing feature and the design rules to preserve when extending it. The implementation is in [PosterModal](../src/components/Poster/PosterModal.tsx), its stylesheet is [PosterModal.css](../src/components/Poster/PosterModal.css), the family layout is in [posterLayout.ts](../src/processing/posterLayout.ts), and the illustration palettes and drawing model are in [posterArt.ts](../src/components/Poster/posterArt.ts).

## Feature review

- The poster presents a lineage through sons, growing upward from a selected male starting person. Ancestors are stacked along the trunk; descendants branch above them.
- Sibling order is eldest first when birth years are known; siblings without dates retain their recorded order. Daughters are grouped separately from sons and appear on their own, without a husband or descendants. A wife's children recorded under her or her husband can appear in the man's line. These are product rules, not a complete visualization of every relationship in the family data.
- A man's card includes wives in marriage order when the relationship is current or ended by death. Relationships ended by divorce, annulment, or separation are omitted. Women's cards do not list spouses.
- The UI offers a start person, two to eight generations (four by default), four illustration styles, optional life years, optional aged-paper effects, and a fit-to-view control. The default style is Autumn; years are off, aged paper is on, and fit is on.
- The family name in the heading is selected from the most common surname, using the active language where available. Names use the active language's display name.
- The view is opened from the admin interface. PNG download is available from the poster view.
- The renderer uses SVG for the screen and PNG export. The drawing is generated deterministically for a given layout and style, which keeps the composition stable across renders.

## Composition and information hierarchy

1. **Tree silhouette:** The trunk anchors the composition, with ancestors below the selected person and descendants branching toward the canopy. Use the horizontal space to distinguish family branches and vertical space to distinguish generations.
2. **Person tags:** Each person is represented by a hanging tag. Keep the primary name as the most prominent text. Optional birth/death years are secondary and should not compete with names.
3. **Relationships:** List wives on the man's tag in marriage order, separated by small heart markers. Keep every listed name legible.
4. **Family title:** Center the family title below the tree, inside the decorative frame. It should remain fully inside the sheet at narrow and wide layouts.
5. **Decoration:** Foliage, roots, ground, and frame add a keepsake quality, but must remain behind or around the family information rather than obscure it.

The layout should adapt to family width, generation count, card height, and long names. Preserve spacing around the trunk, tags, frame, and title instead of clipping content to achieve a fixed poster ratio.

## Visual style

### Overall character

Use a warm, illustrated botanical keepsake aesthetic. The art is vector-based, with tapered, shaded branches, layered foliage, subtle shadows, visible paper, and a restrained ornamental border. Keep decorative detail cohesive with the tree rather than introducing unrelated UI iconography into the poster artwork.

The poster itself intentionally has a light paper palette regardless of the app's selected interface theme. The modal chrome follows the app's theme tokens; the downloaded sheet remains visually consistent.

### Color and materials

| Element | Current treatment | Guidance |
|---|---|---|
| Paper | Warm ivory (`#f8f1e4`) with a soft vertical tone | Preserve a light, low-noise writing surface and readable contrast. |
| Wood and frame | Layered dark, mid, and light browns | Keep one consistent upper-left light direction and reserve darkest tones for depth. |
| Male tag | Green edge with dark green-brown text | Retain a visible outline and readable text. |
| Female tag | Rose edge with dark wine text and mirrored corner shape | Retain both color and shape distinction; do not make gender legible by color alone. |
| Seasonal foliage | Theme-specific greens, golds, russets, and blossoms | Vary foliage, fallen leaves, and accents while leaving the paper and names readable. |
| Aged-paper option | Fine texture and edge vignette | Keep it subtle. It is optional because it increases PNG size. |

### Typography

- Use the bundled Great Vibes script for English names and Yatra One for Marathi names.
- Use a quiet serif for years and a complementary script treatment for the family title.
- Keep the title and name lettering decorative but readable at screen scale and in the exported image.
- Fit long names by shrinking them only as needed, then adjusting text spacing as a last resort. Do not truncate or silently replace a person's name.
- Bundle/in-line the fonts for export so the image does not depend on the viewer's installed fonts.

### Seasonal styles

| Style | Foliage direction |
|---|---|
| Autumn | Olive inner leaves, russet and gold outer leaves, and more fallen leaves. |
| Spring blossom | Fresh greens with occasional pink blossoms. |
| Summer | Deep greens with sparse fallen leaves and dappled light. |
| Banyan | Broad banyan leaves, occasional red accents, and hanging aerial roots. |

Keep each style's defining details distinct. Avoid introducing random variation that changes from one render to the next.

### Illustration model and retained behavior

- **Branch thickness follows family size.** The original renderer already models limb weight from the number of people carried and caps maximum width. Keep this behavior so the trunk does not crowd ancestor tags.
- **Branches, foliage and bark.** Retain the original tapered, shaded branch drawing, foliage, bark detail and fixed seeded variation. Additional forks, twigs, textures or age tints should only be introduced if they improve the full poster, not just an isolated detail.
- **Layout.** Parents are centered over their children, with horizontal space for branches and vertical space for generations. Keep the existing root flare, seasonal styles, consistent upper-left lighting and subtle aged-paper treatment.
- **Marriage tags.** The selected visual direction keeps the original combined card: the man and wives are listed on his tag with heart markers. Individual rose tags for wives were tried, then removed because the overall illustration did not improve.
- **Zoom.** Fit (the default) shows the whole sheet. The `−` and `+` buttons, Ctrl/⌘ + wheel (including a trackpad pinch) and a two-finger pinch zoom around the pointer; Fit returns to the whole sheet. Export size does not depend on zoom.
- **Level of detail.** At far zoom, the screen hides fine bark, leaf, ground and fallen-leaf details. This screen-only behavior does not affect the SVG copied for PNG export, so the download retains full detail.
- **Determinism.** Preserve the fixed starting value for drawing variation so a given poster remains stable across renders.

## Poster controls and responsive behavior

- Keep the control labels explicit and localized. Controls should update the preview immediately.
- The current person picker is a native select sorted by display name, with the father's name added to disambiguate duplicate first names. Retain the native control while it remains usable; if replaced, preserve keyboard selection and the same disambiguation.
- Keep the download action visually grouped apart from composition controls. Disable it when there is no useful layout or while an export is in progress.
- The dialog is bounded by the viewport and uses an independently scrollable canvas. Keep the title and export actions together in the top toolbar row, with composition controls on a separate row that wraps cleanly at every width. On narrow screens, use a near-full-height bottom sheet and compact field layouts; action labels may collapse to icons, but accessible names must remain.
- Fit mode shows the complete sheet. Zooming (buttons, Ctrl/⌘ + wheel or pinch) leaves Fit and lets the poster be panned and scrolled without clipping the rendered SVG; Fit returns to the whole sheet.

## Output, accessibility, and localization

- PNG export should preserve the SVG composition, colors, and bundled fonts. Keep canvas dimensions within browser limits and surface export failures rather than producing a misleading success state.
- Keep the modal labelled as a dialog, provide an accessible name for the SVG, use native labelled controls, retain visible keyboard focus, and preserve the shared dialog behavior for focus trapping, Escape, and focus restoration.
- Localize all poster controls and status text in English and Marathi. Use the active language's member names and family title, and ensure Devanagari text remains supported by the selected fonts.
- Keep the no-relatives message available to assistive technology when the selected start person has no recorded relatives.

## Design guardrails

When changing the feature:

- Do not imply that this poster displays every relationship; its lineage rules intentionally omit some branches and former relationships.
- Do not alter source family records as a side effect of preview or export controls.
- Preserve long names, non-Latin text, unknown dates, and families with missing or sparse relationships.
- Keep visual gender distinctions redundant (shape and color), and preserve readable contrast for tag text.
- Avoid adding detail that makes names, years, or branch connections harder to follow.
- Keep screen styling and PNG export visually aligned.

## Improvement plan

Reviewed against the code. Visual experiments were compared against the original poster; the original illustration style is retained. The implemented view changes are zoom and screen-only detail reduction. Family data, lineage rules, and PNG output remain unchanged.

### Review of the proposed improvements

| Proposal | Status in code | Decision |
|---|---|---|
| Branch width from family size | Already modeled and capped in the original renderer. | Keep |
| Natural forks and continuing branches | Original branch geometry retained; experimental geometry was reverted after whole-art comparison. | No additional change |
| Smooth zoom keeping Fit | Added with buttons, wheel/trackpad and touch pinch. | Keep |
| Leaves grow from branches, denser where there is more family | Existing foliage retained; no additional density changes. | Keep original |
| Bark texture and age | Existing shading, cracks and knots retained; age tint was reverted. | Keep original |
| Balanced crown: Reingold–Tilford or Walker packing | Parents are already centered; proposed crown and trunk changes were reverted. | Keep original |
| Wives as paired tags | Individual wife tags were tried and reverted; wives remain on the man's tag with hearts. | Keep original |
| Less detail when zoomed out | Screen-only fine-detail reduction added; PNG exports retain all detail. | Keep |
| Root flare that scales | Existing roots retained without alteration. | Keep original |
| Knots per ancestor generation | Existing bark details retained without alteration. | Keep original |
| Daughters on short twigs | Experimental layout/art changes were reverted. | Keep original |
| Names on leaves, fan or pedigree charts | A redesign. | Not recommended |

### Constraints

- Keep view behavior out of family data and lineage rules.
- Screen-only detail reduction must not reach PNG exports.
- Preserve the original artwork's composition and deterministic rendering; evaluate proposed changes against the full poster, not just an isolated branch.
- Do not add libraries for SVG drawing or zoom.

## Existing verification

The current tests cover poster-root selection, theme and year controls, paper texture toggling, long-name retention, deterministic illustration output, theme-specific art, and export error recovery. Relevant suites are [functional.test.tsx](../src/components/functional.test.tsx), [posterLayout.test.ts](../src/processing/posterLayout.test.ts), and [posterArt.test.ts](../src/components/Poster/posterArt.test.ts).
