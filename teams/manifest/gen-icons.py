#!/usr/bin/env python3
"""Generate placeholder Teams app icons for the Kan bot.

Produces:
  color.png   192x192  accent-color (#282828) background, white "K"
  outline.png  32x32   transparent background, white "K" (Teams requires a
                       transparent, single-color outline icon)

Replace these with real brand assets when available. Pure stdlib (zlib) — no PIL.
"""
import struct
import zlib

ACCENT = (0x28, 0x28, 0x28)  # manifest accentColor
WHITE = (0xFF, 0xFF, 0xFF)


def _seg_dist(px, py, ax, ay, bx, by):
    vx, vy = bx - ax, by - ay
    wx, wy = px - ax, py - ay
    seg_len2 = vx * vx + vy * vy
    t = 0.0 if seg_len2 == 0 else max(0.0, min(1.0, (wx * vx + wy * vy) / seg_len2))
    cx, cy = ax + t * vx, ay + t * vy
    return ((px - cx) ** 2 + (py - cy) ** 2) ** 0.5


def _draw_k(size, bg):
    """Return RGBA bytes for a `size`x`size` image: white K on `bg` (or transparent)."""
    pad = size * 0.18
    x0, x1 = pad, size - pad
    y0, y1 = pad, size - pad
    stem_w = max(1.0, size * 0.16)
    mid_y = (y0 + y1) / 2.0
    arm_t = stem_w  # arm half-thickness driver
    stem_x = x0 + stem_w / 2.0

    rows = bytearray()
    for y in range(size):
        rows.append(0)  # PNG filter byte (none)
        for x in range(size):
            cx, cy = x + 0.5, y + 0.5
            on_stem = abs(cx - stem_x) <= stem_w / 2.0 and y0 <= cy <= y1
            on_upper = _seg_dist(cx, cy, stem_x, mid_y, x1, y0) <= arm_t / 2.0
            on_lower = _seg_dist(cx, cy, stem_x, mid_y, x1, y1) <= arm_t / 2.0
            if on_stem or on_upper or on_lower:
                rows += bytes((*WHITE, 255))
            elif bg is None:
                rows += bytes((0, 0, 0, 0))
            else:
                rows += bytes((*bg, 255))
    return bytes(rows)


def _write_png(path, size, rgba):
    def chunk(tag, data):
        return (struct.pack(">I", len(data)) + tag + data
                + struct.pack(">I", zlib.crc32(tag + data) & 0xFFFFFFFF))

    ihdr = struct.pack(">IIBBBBB", size, size, 8, 6, 0, 0, 0)  # 8-bit RGBA
    png = (b"\x89PNG\r\n\x1a\n"
           + chunk(b"IHDR", ihdr)
           + chunk(b"IDAT", zlib.compress(rgba, 9))
           + chunk(b"IEND", b""))
    with open(path, "wb") as f:
        f.write(png)
    print(f"wrote {path} ({size}x{size})")


def main():
    import os
    here = os.path.dirname(os.path.abspath(__file__))
    _write_png(os.path.join(here, "color.png"), 192, _draw_k(192, ACCENT))
    _write_png(os.path.join(here, "outline.png"), 32, _draw_k(32, None))


if __name__ == "__main__":
    main()
