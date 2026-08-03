from pathlib import Path

from PIL import Image

from remove_green import remove_green


ROOT = Path(__file__).resolve().parents[1]
GENERATED = ROOT / "assets" / "generated"
SOURCE = GENERATED / "cat-poses-chroma.png"
TRANSPARENT = GENERATED / "cat-poses.png"
POSES = GENERATED / "poses"
ICONS = ROOT / "assets" / "icons"

POSE_NAMES = (
    "idle",
    "surprised",
    "affection",
    "carried",
    "stalking",
    "grooming",
    "sleep-rug",
    "sleep-box",
    "sleep-tower",
)


def main() -> None:
    if not SOURCE.exists():
        raise SystemExit(f"Missing {SOURCE.relative_to(ROOT)}")

    sheet = remove_green(Image.open(SOURCE))
    TRANSPARENT.parent.mkdir(parents=True, exist_ok=True)
    POSES.mkdir(parents=True, exist_ok=True)
    sheet.save(TRANSPARENT)

    cell_width = sheet.width // 3
    cell_height = sheet.height // 3
    idle_pose = None
    for index, name in enumerate(POSE_NAMES):
        column = index % 3
        row = index // 3
        crop = sheet.crop((
            column * cell_width,
            row * cell_height,
            (column + 1) * cell_width,
            (row + 1) * cell_height,
        ))
        crop.save(POSES / f"{name}.png")
        if name == "idle":
            idle_pose = crop

    if idle_pose is not None:
        bounds = idle_pose.getbbox()
        cat = idle_pose.crop(bounds) if bounds else idle_pose
        icon = Image.new("RGBA", (1024, 1024), (0, 0, 0, 0))
        cat.thumbnail((850, 850), Image.Resampling.LANCZOS)
        icon.alpha_composite(cat, ((1024 - cat.width) // 2, (1024 - cat.height) // 2 + 34))
        ICONS.mkdir(parents=True, exist_ok=True)
        icon.save(ICONS / "icon.png")
        icon.save(ICONS / "icon.ico", sizes=[(16, 16), (24, 24), (32, 32), (48, 48), (64, 64), (128, 128), (256, 256)])
        icon.save(ICONS / "icon.icns")
        icon.resize((44, 44), Image.Resampling.LANCZOS).save(ICONS / "tray.png")

    print(f"Wrote {TRANSPARENT.relative_to(ROOT)}, {len(POSE_NAMES)} pose references, and app icons")


if __name__ == "__main__":
    main()
