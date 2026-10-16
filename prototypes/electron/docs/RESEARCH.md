# REA / FliTik 参考研究

研究日期：2026-10-16。研究目的：学习跨平台时钟的产品行为、翻页表现、音效组织及桌面集成；TEMPO 的视觉、计时引擎、音效均独立实现。

## REA

确认仓库为 [morluto/rea — Reverse Engineer Anything](https://github.com/morluto/rea)。使用本地 REA 6.5.0 CLI，没有修改用户的 Codex 全局配置，也没有注册新的 MCP 服务。

已实际执行：

```text
rea analyze-javascript-application <flitik-public> --json
rea inspect-artifact <FliTik安装包.exe> --json
rea inspect-artifact <解包后的FliTik.exe> --json
```

官网四份公开脚本的静态分析证据 ID：`ev_f0ceb715fba87995ab80a55e02f9f26f8fc9aa7140c4ed3a63a0634c974e553b`。其分析范围是下载、FAQ、更新日志和语言导航，不是桌面 App 的动画实现。

REA 的 provider-neutral PE 检查完成了文件识别、摘要和后续分析建议；它没有自动反编译 Dart AOT、没有还原 FliTik 的完整源代码。深层原生反编译需要额外 provider，未在本次安装。README 中的能力描述不作为“已执行”的证据。

## FliTik：已确认的发行包事实

来源：[官网](https://www.flitik.com/index.html)、[官方公开下载配置](https://www.flitik.com/data/downloads.zh.json)。从配置中的备用下载地址获取 Windows 安装包，只做静态读取和解包，没有执行安装程序。

- 文件大小：70,525,400 字节。
- SHA-256：`9f257a0e774a7b41f9603a816f3c0693b9ef6c7a9477be50a2166a28a2e93702`。
- 安装程序元数据的版本：1.2.16.66。7-Zip 将容器识别为 NSIS。
- 包内有 `flutter_windows.dll`、`data/app.so` 和 `data/flutter_assets`，足以确认此发行包使用 Flutter。
- 包内有 `audioplayers_windows_plugin.dll`，并将滴答声放在 `assets/sounds/tik/0.mp3` 至 `11.mp3` 等独立资源中。
- 包内有 `window_size_plugin.dll`、键盘/鼠标事件插件、透明外观插件、单实例插件，以及 `.scr` 文件。
- 包内有 `wakelock_plus` 的资源，说明包含防休眠相关依赖；仅凭文件存在，不能推断其所有实际调用路径。

学习结果：钟面本身、独立机械声音、桌面窗口行为和全屏展示需要共同打磨。TEMPO 将它们分为渲染、时间引擎、声音合成和桌面壳四层。未把 FliTik 的音频、字体、视频或二进制纳入交付物。

## 翻页技术参考

阅读了 [FlipClockGo](https://github.com/jiangnanquan/FlipClockGo) 的公开说明与 standalone.html，重点查看上下叶片、3D 转动、遮罩、音量与 Web Audio 的组织方式。TEMPO 使用独立编写的四层叶片和分阶段旋转：旧上页下折后，新下页落下；数字只在对应单位变化时更新。

TEMPO 的声音使用短高通噪声与不谐和正弦谐振组成，每秒轻微交替音色；翻页额外叠加低频叶片落点。所有音频实时生成，无外部采样。

## 交付边界

Windows 已在本机运行测试。Mac 的两个运行包来自官方 Electron 平台运行库，保留执行权限和符号链接，在 Windows 上组装；尚未在 macOS 实机启动测试，也没有 Apple 开发者签名或公证。附带的首次运行脚本会在用户自己的 Mac 上进行临时签名。
