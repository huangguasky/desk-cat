from pathlib import Path
from statistics import median

from PIL import Image, ImageFilter

from remove_green import remove_green


ROOT = Path(__file__).resolve().parents[1]
SHEETS = ROOT / "assets" / "generated" / "animation-sheets"
OUTPUT = ROOT / "assets" / "generated" / "gifs"

ANIMATIONS = {
    "idle": {"duration": 160},
    "surprised": {"duration": 105},
    "affection": {"duration": 130},
    "carried": {"duration": 105},
    "stalking": {"duration": 125},
    "grooming": {"duration": 120},
    "sleep-rug": {"duration": 220},
    "sleep-box": {"duration": 220},
    "sleep-tower": {"duration": 220},
    "wake-scratch": {"duration": 220, "loop": None, "stabilize": "ground"},
    "eat-treat": {"duration": 220, "stabilize": "ground"},
}


def clear_sheet_artifacts(name: str, index: int, crop: Image.Image) -> Image.Image:
    """Remove detached marks from actions that contain only the cat."""
    cleaned = crop.copy()
    if name == "wake-scratch":
        cleaned = keep_largest_component(cleaned)
    return cleaned


def keep_largest_component(rgba: Image.Image) -> Image.Image:
    """Drop detached motion marks while preserving the cat and its soft alpha edge."""
    alpha = rgba.getchannel("A")
    opaque = bytes(1 if value >= 72 else 0 for value in alpha.getdata())
    visited = bytearray(len(opaque))
    largest: list[int] = []

    for start, value in enumerate(opaque):
        if not value or visited[start]:
            continue
        component = []
        queue = [start]
        visited[start] = 1
        for offset in queue:
            component.append(offset)
            x = offset % alpha.width
            y = offset // alpha.width
            neighbors = []
            if x > 0:
                neighbors.append(offset - 1)
            if x + 1 < alpha.width:
                neighbors.append(offset + 1)
            if y > 0:
                neighbors.append(offset - alpha.width)
            if y + 1 < alpha.height:
                neighbors.append(offset + alpha.width)
            for neighbor in neighbors:
                if opaque[neighbor] and not visited[neighbor]:
                    visited[neighbor] = 1
                    queue.append(neighbor)
        if len(component) > len(largest):
            largest = component

    mask_data = bytearray(len(opaque))
    for offset in largest:
        mask_data[offset] = 255
    mask = Image.frombytes("L", rgba.size, bytes(mask_data)).filter(ImageFilter.MaxFilter(5))
    cleaned = Image.new("RGBA", rgba.size, (0, 0, 0, 0))
    cleaned.paste(rgba, mask=mask)
    return cleaned


def alpha_centroid(rgba: Image.Image) -> tuple[float, float]:
    alpha = rgba.getchannel("A")
    total = weighted_x = weighted_y = 0
    for offset, value in enumerate(alpha.getdata()):
        if value < 72:
            continue
        x = offset % alpha.width
        y = offset // alpha.width
        total += value
        weighted_x += x * value
        weighted_y += y * value
    if not total:
        return rgba.width / 2, rgba.height / 2
    return weighted_x / total, weighted_y / total


def translated(rgba: Image.Image, x: int, y: int) -> Image.Image:
    if not x and not y:
        return rgba
    canvas = Image.new("RGBA", rgba.size, (0, 0, 0, 0))
    canvas.alpha_composite(rgba, (x, y))
    return canvas


def stabilize_grid(crops: list[Image.Image]) -> list[Image.Image]:
    """Remove the generated sheet's row/column drift without freezing local motion."""
    centers = [alpha_centroid(crop) for crop in crops]
    column_centers = [median(centers[index][0] for index in range(column, 9, 3)) for column in range(3)]
    row_centers = [median(centers[index][1] for index in range(row * 3, row * 3 + 3)) for row in range(3)]
    target_x = median(column_centers)
    target_y = median(row_centers)

    stabilized = []
    for index, crop in enumerate(crops):
        shift_x = round(target_x - column_centers[index % 3])
        shift_y = round(target_y - row_centers[index // 3])
        stabilized.append(translated(crop, shift_x, shift_y))
    return stabilized


def stabilize_on_ground(crops: list[Image.Image]) -> list[Image.Image]:
    """Keep standing and stretching frames on one ground line with a stable center."""
    boxes = [crop.getchannel("A").getbbox() for crop in crops]
    valid_boxes = [box for box in boxes if box]
    target_x = median((box[0] + box[2]) / 2 for box in valid_boxes)
    target_bottom = median(box[3] for box in valid_boxes)
    stabilized = []
    for crop, box in zip(crops, boxes):
        if not box:
            stabilized.append(crop)
            continue
        shift_x = round(target_x - (box[0] + box[2]) / 2)
        shift_y = round(target_bottom - box[3])
        stabilized.append(translated(crop, shift_x, shift_y))
    return stabilized


def gif_frame(rgba: Image.Image) -> Image.Image:
    resized = rgba.resize((320, 320), Image.Resampling.LANCZOS)
    alpha = resized.getchannel("A")
    flattened = Image.new("RGB", resized.size, (255, 255, 255))
    flattened.paste(resized, mask=alpha)
    paletted = flattened.quantize(colors=255, method=Image.Quantize.MEDIANCUT)

    transparency_index = 255
    palette = paletted.getpalette() or []
    palette.extend([0] * (768 - len(palette)))
    palette[transparency_index * 3:transparency_index * 3 + 3] = [0, 255, 0]
    paletted.putpalette(palette)

    alpha_data = alpha.getdata()
    color_data = list(paletted.getdata())
    paletted.putdata([
        transparency_index if alpha_value < 72 else color_value
        for color_value, alpha_value in zip(color_data, alpha_data)
    ])
    paletted.info["transparency"] = transparency_index
    paletted.info["disposal"] = 2
    return paletted


def main() -> None:
    OUTPUT.mkdir(parents=True, exist_ok=True)
    for name, options in ANIMATIONS.items():
        sheet_path = SHEETS / f"{name}.png"
        chroma_path = SHEETS / f"{name}-chroma.png"
        if chroma_path.exists() and (not sheet_path.exists() or chroma_path.stat().st_mtime >= sheet_path.stat().st_mtime):
            sheet_path.parent.mkdir(parents=True, exist_ok=True)
            remove_green(Image.open(chroma_path)).save(sheet_path)
            print(f"Prepared {sheet_path.relative_to(ROOT)}")
        if not sheet_path.exists():
            raise SystemExit(f"Missing {sheet_path.relative_to(ROOT)} or {chroma_path.relative_to(ROOT)}")

        sheet = Image.open(sheet_path).convert("RGBA")
        cell_width = sheet.width // 3
        cell_height = sheet.height // 3
        crops = []
        for index in range(9):
            column = index % 3
            row = index // 3
            crop_x = column * cell_width
            crop_y = row * cell_height
            crop = sheet.crop((
                crop_x,
                crop_y,
                crop_x + cell_width,
                crop_y + cell_height,
            ))
            crops.append(clear_sheet_artifacts(name, index, crop))
        if options.get("stabilize") == "ground":
            crops = stabilize_on_ground(crops)
        else:
            crops = stabilize_grid(crops)

        indices = options.get("frames", tuple(range(9)))
        frames = []
        for index in indices:
            frames.append(gif_frame(crops[index]))

        output_path = OUTPUT / f"{name}.gif"
        save_options = {
            "save_all": True,
            "append_images": frames[1:],
            "duration": options["duration"],
            "transparency": 255,
            "disposal": 2,
            "optimize": False,
        }
        if options.get("loop", 0) is not None:
            save_options["loop"] = options.get("loop", 0)
        frames[0].save(output_path, **save_options)
        print(f"Wrote {output_path.relative_to(ROOT)} ({len(frames)} frames)")


if __name__ == "__main__":
    main()
