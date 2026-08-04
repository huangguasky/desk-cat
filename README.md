# Mikan Desk Cat

一只由你的猫咪照片定制的 Windows / macOS 桌面宠物。

## 已实现

- 首次启动出现在当前屏幕右下角，窗口为 200×200、透明、无边框、默认置顶。
- 不显示在任务栏和常规窗口切换列表；macOS 使用菜单栏图标，Windows 使用系统托盘图标。
- 无论当前是什么状态，拖动都会立即切换成“被轻轻拎起”的姿态，松手后回到待机；位置会自动保存。
- 猫咪本身只通过左键单击、鼠标移入和拖动播放动作；右键只打开功能菜单，不触发动画，也不设双击或鼠标静止动作。
- 90 秒没有互动后，随机睡在地毯、纸箱或猫爬架上。
- 系统托盘菜单和猫咪右键菜单均可切换置顶、让猫咪回到右下角或退出。
- 十一种姿态均使用独立透明 GIF，包含眨眼、耳朵、尾巴、爪子、舔毛、呼吸、吃猫条，以及醒来伸懒腰并原地磨爪的逐帧动作。
- 刚入睡 30 秒内鼠标移入会播放醒来动画；睡久后需要左键点击才会醒来。
- 空闲时鼠标移入会随机撒娇或扑羽毛毽子；单击会随机撒娇、扑羽毛毽子、吃猫条、舔毛或惊讶。等待睡眠且没有互动时，会偶尔惊讶或舔毛。

## 本地运行

需要 Node.js 20 或更高版本。

```bash
npm install
npm start
```

## 换成你自己的猫

不需要修改程序代码。准备 2–4 张同一只猫的清晰照片，按照 [ASSET_GENERATION.md](ASSET_GENERATION.md) 中保留的提示词依次生成基础姿态和 11 张动画九宫格，再运行：

```bash
python3 -m pip install pillow
python3 scripts/prepare_pose_sheet.py
python3 scripts/build_gifs.py
npm test
npm start
```

新生成的 GIF 会覆盖 `assets/generated/gifs/` 中的同名文件，基础姿态脚本也会用新猫咪生成应用和托盘图标。桌宠的交互规则不变，只替换猫咪。生成时应重点检查脸部花纹、眼睛、尾巴、九宫格边界和各帧落脚点；有问题的动作应单独重新生成。

## 测试与打包

```bash
npm test
npm run dist:mac
npm run dist:win
```

成品安装包会出现在 `release` 目录。通常建议在对应系统上构建对应安装包；界面和窗口逻辑本身同时支持 Windows 与 macOS。
默认会生成 Apple Silicon macOS 包和 x64 Windows 包；Windows on ARM 可使用 `npm run dist:win:arm64`。

### 打开 GitHub Release 中的 macOS 版本

macOS 包使用 ad-hoc 签名，不需要 Apple Developer 账号，但系统无法验证开发者。首次打开时：

1. 尝试打开应用一次，然后关闭系统提示。
2. 打开“系统设置 → 隐私与安全性”。
3. 在安全性区域找到被阻止的 `Mikan Desk Cat`，点击“仍要打开”。
4. 再次确认“打开”。后续启动不需要重复操作。

也可以在 Finder 中按住 Control 键点按应用，选择“打开”，然后再次确认。请仅对从本项目 GitHub Release 下载的安装包执行这些操作。

## 素材说明

应用运行与打包只使用 `assets/generated/gifs/` 中的 11 个最终 GIF，不包含原始猫咪照片、基础姿态表或动画九宫格。提示词和完整换猫流程集中保存在 [ASSET_GENERATION.md](ASSET_GENERATION.md)。
