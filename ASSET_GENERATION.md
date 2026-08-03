# 用自己的猫生成整套桌宠素材

这份文件是本项目唯一需要长期保留的素材生成提示词与操作说明。目标是用 2–4 张同一只猫的清晰照片，生成并覆盖 `assets/generated/gifs/` 中的 11 个 GIF；程序代码和 CSS 不需要修改。

## 准备照片

选择能看清以下特征的照片：正脸、左右侧脸、全身、尾巴。照片应光线自然、无遮挡，最好包含坐姿和站姿。所有照片必须是同一只猫。

生成过程中最重要的要求是：每次都把这些照片或已经确认正确的基础姿态图作为身份参考，不要只依赖文字描述毛色。

## 第一步：生成九种基础姿态

把猫咪照片全部作为参考图，使用以下提示词生成一张 3×3 九宫格，保存为：

`assets/generated/cat-poses-chroma.png`

```text
Use case: stylized-concept
Asset type: a strict 3-by-3 desktop-pet character pose sheet for a 200x200 transparent desktop window.
Primary request: Create nine consistent full-body poses of the exact same pet cat shown in all reference photos. Preserve the cat's real identity across every pose.
Input images: all supplied images are identity references of the same cat from different angles.
Identity invariants: faithfully preserve the reference cat's exact coat colors, patch shapes and locations, facial asymmetry, eye color, nose color, ear shape, body proportions, leg markings, and tail pattern. Do not mirror, simplify, invent, or move any identifying marking. The same cat must be immediately recognizable in every cell.
Style/medium: polished cute 2D animation sprite, soft cel shading, clean expressive linework, subtle fur texture, cozy modern Japanese desktop-pet aesthetic, not photorealistic.
Layout: strict 3 columns by 3 rows, nine equal square cells, one centered pose in each cell, identical character scale, stable ground line, generous empty margin, no overlap between cells, no grid lines.
Poses, left-to-right and top-to-bottom:
1. calm sitting idle, tail curled naturally;
2. playfully surprised with one paw raised;
3. happy cheek rub, leaning into a gentle human hand;
4. dangling safely as if gently held by the loose skin at the back of the neck, relaxed body and paws;
5. low stalking crouch focused on a small traditional feather shuttlecock toy;
6. sitting and grooming one front paw;
7. asleep curled on a small warm beige round rug;
8. asleep curled in a simple kraft cardboard box;
9. asleep curled on a compact cream-and-wood cat-tree platform.
Backdrop: perfectly flat solid #00ff00 chroma-key filling the whole image. The green must be uniform, with no shadow, gradient, floor plane, reflection, texture, or lighting variation. Do not use #00ff00 in the cat or props.
Constraints: keep every cat, hand, toy, and sleeping prop fully inside its own cell with at least 8% padding. No cast shadow outside the subject silhouette.
Avoid: no text, labels, borders, watermark, collar, clothing, extra animals, extra limbs, duplicated paws, malformed hands, cropped ears, cropped tail, cropped props, camera movement, or identity drift.
```

安装 Pillow 并把绿色背景转为透明，同时切出后续生成动画所需的九张参考姿态，并用新的 `idle` 姿态重建应用图标和托盘图标：

```bash
python3 -m pip install pillow
python3 scripts/prepare_pose_sheet.py
```

参考姿态会输出到 `assets/generated/poses/`，新图标会覆盖 `assets/icons/` 中的同名文件。

## 第二步：生成 11 张动画九宫格

每个动作单独生成一张 3×3 九帧图。按下表选择参考姿态和文件名，然后把“动作要求”代入后面的统一提示词。

| 文件名 | 参考图 | 动作要求 |
| --- | --- | --- |
| `idle-chroma.png` | `poses/idle.png` | Natural chest breathing, one slow blink, tiny ear twitch, and a very small tail-tip curl. The seated body and ground contact stay fixed. |
| `surprised-chroma.png` | `poses/surprised.png` | The raised paw waves twice, mouth opens and closes, eyes widen then blink, and ears perk up. |
| `affection-chroma.png` | `poses/affection.png` | The cheek presses into the hand and relaxes, eyes close, whiskers and ears respond, and the hand strokes once. |
| `carried-chroma.png` | `poses/carried.png` | Hind legs and front paws swing gently with inertia, tail sways, and ears and eyes react while the hand's grip point stays perfectly fixed. |
| `stalking-chroma.png` | `poses/stalking.png` | Pupils and head track the feather shuttlecock, shoulders lower, one front paw creeps forward, tail tip flicks, and the toy bounces slightly. |
| `grooming-chroma.png` | `poses/grooming.png` | Paw raises, tongue licks twice, head dips and rises, eyes blink, one ear twitches, and the seated body stays anchored. |
| `sleep-rug-chroma.png` | `poses/sleep-rug.png` | Visible gentle ribcage breathing, one ear twitch, subtle nose and whisker motion, and a tiny tail-tip uncurl. The rug stays still. |
| `sleep-box-chroma.png` | `poses/sleep-box.png` | Gentle breathing, ear and tail twitch, subtle whisker motion, and nearly imperceptible box-flap response. The box stays fixed. |
| `sleep-tower-chroma.png` | `poses/sleep-tower.png` | Gentle breathing, ear twitch, front-paw relaxation, tail curl, and whisker movement. The entire cat tree stays fixed. |
| `wake-scratch-chroma.png` | `poses/idle.png`、`poses/grooming.png` | Wake in a low crouch, reach both front paws into a deep full-body stretch, rise, alternate the front paws to scratch or knead the invisible ground in place, then settle into a calm neutral standing pose. |
| `eat-treat-chroma.png` | `poses/idle.png`、`poses/affection.png`、`poses/grooming.png` | A natural human hand offers one unbranded squeeze-tube cat treat from the right. The seated cat sniffs, clearly licks three times, swallows, looks content, and the hand withdraws slightly. |

所有文件保存到：

`assets/generated/animation-sheets/`

统一动画提示词如下。将 `{ACTION_REQUEST}` 替换为表格中的动作要求，并把表格列出的图片全部作为参考图：

```text
Use case: stylized-concept
Asset type: a strict 3-by-3, nine-frame chronological animation sprite sheet for a 200x200 desktop pet GIF.
Input images: exact identity, pose, prop, hand-interaction, anatomy, and visual-style references. Preserve the same cat and all identifying features from the references.
Primary request: {ACTION_REQUEST}
Layout: strict 3 columns by 3 rows, nine equal square cells, chronological left-to-right then top-to-bottom. One complete centered subject per cell, identical scale, stable body anchor and ground line, generous padding, no overlap between cells, no grid lines.
Identity invariants: preserve the reference cat's exact coat colors, patch shapes and locations, facial asymmetry, eye and nose colors, ear shape, proportions, leg markings, and tail pattern. Never mirror, simplify, or relocate identifying markings. Preserve the same polished soft cel-shaded 2D desktop-pet style, linework, and subtle fur texture.
Motion constraints: animate only the body parts and props named in the request. No camera movement, zoom, canvas movement, whole-character wobble, sliding, rotation, or unexplained scale change.
Backdrop: perfectly flat solid #00ff00 chroma-key in every cell, uniform exact color, no shadow, gradient, floor, texture, reflection, or lighting variation. Do not use #00ff00 in the subject or props.
Constraints: keep the entire cat and every required hand, toy, or prop inside its own cell with at least 8% padding.
Avoid: no text, logo, brand, label, border, watermark, collar, clothing, extra animals, extra hands, extra or duplicated limbs, malformed fingers, motion lines, cropped subjects, or content leaking from another cell.
```

## 第三步：检查并生成 GIF

先逐张检查九宫格：

- 必须正好三列三排，并按时间顺序排列。
- 猫咪、手和道具不能越过各自格子的边界。
- 主体尺寸和落脚点应稳定，不能整只猫左右跳动。
- 毛色、脸部斑纹和尾巴纹路必须始终是同一只猫。
- 若某一张有串帧、错尾巴、额外肢体或身份变化，优先重新生成那一张，不要勉强使用。

确认后运行：

```bash
python3 scripts/build_gifs.py
npm test
npm start
```

`build_gifs.py` 会自动把 `*-chroma.png` 转为透明图，稳定九帧位置，并覆盖 `assets/generated/gifs/` 中同名 GIF。程序通过固定文件名加载素材，因此无需修改代码。

## 最终需要保留什么

应用运行和打包只需要：

- `assets/generated/gifs/*.gif`
- `assets/icons/*`
- `src/*`

确认新猫咪的所有动作正常后，`cat-poses-chroma.png`、`cat-poses.png`、`poses/` 与 `animation-sheets/` 中的 PNG 都可以删除。请保留本文件和 `scripts/`，方便以后再次更换猫咪。
