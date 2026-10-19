# Great Vibes — font source, subset and license

The Nico logo artwork embeds **Great Vibes** as a base64 WOFF2 data URI inside
`assets/logo/nico-logo.svg` and `assets/logo/nico-mark.svg`, so both files render
identically without the font installed and without any network request.

| | |
| --- | --- |
| Family | Great Vibes Regular |
| Designers | Robert E. Leuschke (with Viktorya Grabowska, Viviana Monsalve, Eben Sorkin) / TypeSETit |
| Version | 1.103 |
| License | SIL Open Font License 1.1 — see [`OFL.txt`](./OFL.txt) |
| Upstream | <https://github.com/google/fonts/tree/main/ofl/greatvibes> |
| Font download | <https://raw.githubusercontent.com/google/fonts/main/ofl/greatvibes/GreatVibes-Regular.ttf> |
| License download | <https://raw.githubusercontent.com/google/fonts/main/ofl/greatvibes/OFL.txt> |
| Original TTF SHA-256 | `8d509802186f1b51572531ecf313e8098f9a5bfdfaca93f0c9b34467f9982d15` |

Only the small subset (`assets/fonts/GreatVibes-subset.woff2`, ~2 KB) is embedded;
the original 457 KB TTF is intentionally not committed. The subset covers the
wordmark glyphs `N i c o` plus the `salt`/`ss01` alternate capital `N` with ball
terminals that `nico-mark.svg` uses. It was verified pixel-identical to the full
font at the sizes the logo is rendered at.

Rebuild the subset with fontTools:

```sh
curl -sSL -o /tmp/GreatVibes-Regular.ttf \
  https://raw.githubusercontent.com/google/fonts/main/ofl/greatvibes/GreatVibes-Regular.ttf
pyftsubset /tmp/GreatVibes-Regular.ttf \
  --text="Nico" --layout-features='*' --no-hinting --flavor=woff2 \
  --output-file=assets/fonts/GreatVibes-subset.woff2
```

The upstream OFL declares no Reserved Font Name, so subsetting and embedding the
font in the SVGs is permitted under OFL 1.1; the license text stays in this folder.
