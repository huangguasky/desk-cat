from __future__ import annotations

import argparse
import math
from pathlib import Path

from PIL import Image


def sampled_key(image: Image.Image) -> tuple[int, int, int]:
    rgb = image.convert("RGB")
    points = [
        rgb.getpixel((0, 0)),
        rgb.getpixel((rgb.width - 1, 0)),
        rgb.getpixel((0, rgb.height - 1)),
        rgb.getpixel((rgb.width - 1, rgb.height - 1)),
    ]
    return tuple(round(sum(point[channel] for point in points) / len(points)) for channel in range(3))


def remove_green(image: Image.Image) -> Image.Image:
    rgba = image.convert("RGBA")
    key_r, key_g, key_b = sampled_key(rgba)
    output = []
    for red, green, blue, source_alpha in rgba.getdata():
        distance = math.sqrt((red - key_r) ** 2 + (green - key_g) ** 2 + (blue - key_b) ** 2)
        if distance <= 14:
            alpha = 0
        elif distance >= 105:
            alpha = source_alpha
        else:
            progress = (distance - 14) / 91
            smooth = progress * progress * (3 - 2 * progress)
            alpha = round(source_alpha * smooth)

        if alpha:
            neutral_green = max(red, blue)
            green = round(neutral_green + (green - neutral_green) * alpha / 255)
        output.append((red, green, blue, alpha))

    rgba.putdata(output)
    return rgba


def main() -> None:
    parser = argparse.ArgumentParser(description="Remove a flat generated chroma-green background.")
    parser.add_argument("input", type=Path)
    parser.add_argument("output", type=Path)
    args = parser.parse_args()

    args.output.parent.mkdir(parents=True, exist_ok=True)
    remove_green(Image.open(args.input)).save(args.output)
    print(f"Wrote {args.output}")


if __name__ == "__main__":
    main()
