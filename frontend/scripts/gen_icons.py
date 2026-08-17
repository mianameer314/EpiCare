"""Generate EpiCare app/PWA icons from the current brand mark (favicon.svg).

Renders the emerald squircle + white pulse waveform design at the sizes a
PWA / mobile install needs: 192x192, 512x512 (maskable), 180x180
(apple-touch-icon). Matches the design in public/favicon.svg.
"""
from __future__ import annotations

import math
from pathlib import Path

from PIL import Image, ImageDraw

OUT = Path(__file__).resolve().parent.parent / "public"

# Design constants (scaled from favicon.svg, viewBox 64x64)
GRAD_TOP = (45, 90, 63)      # #2d5a3f
GRAD_BOTTOM = (20, 51, 34)   # #143322
BORDER_WHITE = (255, 255, 255, 90)   # rgba(255,255,255,0.35)
PULSE_WHITE = (255, 255, 255, 255)
PULSE_WIDTH = 4.5            # stroke-width in 64-unit space


def lerp(a: tuple, b: tuple, t: float) -> tuple:
    return tuple(round(a[i] + (b[i] - a[i]) * t) for i in range(3))


def gradient(size: int) -> Image.Image:
    """Vertical linear gradient image at given size."""
    img = Image.new("RGB", (size, size))
    px = img.load()
    for y in range(size):
        t = y / (size - 1)
        color = lerp(GRAD_TOP, GRAD_BOTTOM, t)
        for x in range(size):
            px[x, y] = color
    return img


def draw_icon(size: int, maskable: bool = False) -> Image.Image:
    s = size / 64.0  # scale factor from 64-unit viewBox

    # Corner radius: favicon uses rx=16/64; maskable fills the whole canvas
    # (the OS applies its own mask, so it must be a full-bleed square).
    radius = 0 if maskable else round(16 * s)

    base = gradient(size).convert("RGBA")

    # Rounded-rectangle mask
    mask = Image.new("L", (size, size), 0)
    md = ImageDraw.Draw(mask)
    md.rounded_rectangle([0, 0, size - 1, size - 1], radius=radius, fill=255)

    icon = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    icon.paste(base, (0, 0), mask)

    d = ImageDraw.Draw(icon)

    if not maskable:
        # Subtle top highlight (favicon's ::after / inner glow)
        hl = Image.new("RGBA", (size, size), (0, 0, 0, 0))
        hd = ImageDraw.Draw(hl)
        hd.rounded_rectangle(
            [0, 0, size - 1, round(size * 0.5)],
            radius=radius,
            fill=(255, 255, 255, 46),
        )
        hl = Image.composite(hl, Image.new("RGBA", (size, size), (0, 0, 0, 0)), mask)
        icon = Image.alpha_composite(icon, hl)

        # Border stroke rgba(255,255,255,0.35) width 1.5
        bw = max(1, round(1.5 * s))
        inset = bw / 2
        d.rounded_rectangle(
            [inset, inset, size - 1 - inset, size - 1 - inset],
            radius=max(0, radius - bw),
            outline=BORDER_WHITE,
            width=bw,
        )

    # White pulse waveform: M12 33h8l6-15 10 28 7-17 4 4h9
    # For maskable, shrink toward center so it stays inside the 80% safe zone.
    pts = [(12, 33), (20, 33), (26, 18), (36, 46), (43, 29), (47, 33), (56, 33)]
    if maskable:
        pts = [(x * 0.78 + 7.0, y * 0.78 + 7.0) for x, y in pts]
    scaled = [(round(x * s), round(y * s)) for x, y in pts]

    # Draw as rounded-join polyline (PIL joint="curve")
    d.line(scaled, fill=PULSE_WHITE, width=max(1, round(PULSE_WIDTH * s)), joint="curve")

    # Round the two open endpoints (line caps)
    cap_r = max(1, round((PULSE_WIDTH * s) / 2))
    for p in (scaled[0], scaled[-1]):
        d.ellipse(
            [p[0] - cap_r, p[1] - cap_r, p[0] + cap_r, p[1] + cap_r],
            fill=PULSE_WHITE,
        )

    return icon


def main() -> None:
    OUT.mkdir(parents=True, exist_ok=True)

    # Render at 4x then downscale for crisp edges
    for name, target in [
        ("icon-192.png", 192),
        ("icon-512.png", 512),
        ("icon-maskable-512.png", 512),
        ("apple-touch-icon.png", 180),
    ]:
        maskable = "maskable" in name
        big = draw_icon(target * 4, maskable=maskable)
        icon = big.resize((target, target), Image.LANCZOS)
        path = OUT / name
        icon.save(path, "PNG")
        print(f"wrote {path} ({target}x{target})")


if __name__ == "__main__":
    main()
