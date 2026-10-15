# Trailmix design reference (from the Claude Design canvas)

Source of truth for how each screen looks. These are HTML mockups at 390x844,
not production code: read them for layout, colours, type, spacing and copy,
then rebuild them as fluid Next.js screens.

| File | Screen | Route |
| --- | --- | --- |
| Welcome.dc.html | Welcome | / (first run) |
| Listen.dc.html | Where do you listen | /listen |
| Main.dc.html | Home (incl. check-in card) | /home |
| Library.dc.html | Library (feedback button + credit) | /library |
| Tune.dc.html | Set the vibe | /vibe |
| Mix.dc.html | The mix | /mix |
| Saved.dc.html | Saved | /saved |
| MixPage.dc.html | Shared mix page | /m/[id] |

Ignore the `<x-dc>`, `{{...}}` and `DCLogic` scaffolding; it belongs to the design tool.
The muted variants and the old Save screen were rejected and are not included.
