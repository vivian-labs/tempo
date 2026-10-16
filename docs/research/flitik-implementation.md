# FliTik 实现研究 · 2026-10-16

## 结论与证据范围

FliTik 的精致感来自完整的产品处理：翻页器件、字体和主题一致，桌面窗口行为与音效配合。实际发布物表明它以 Flutter 为跨平台界面基础，并通过原生插件连接桌面能力。这里研究的是公开发布物和正常启动画面；没有把字符串误认作恢复出来的 Dart 源码，也没有获得其完整动画实现。

研究使用 [REA 6.5.0](https://github.com/morluto/rea)、Ghidra 12.1.4、公开安装包与 Android APK。REA 的 [Flutter 分析说明](https://github.com/morluto/rea/blob/main/docs/flutter-analysis.md)明确区分构建识别、AOT 结构和不完整的池语义。Windows 与 Android 的证据分别记录，不能由移动端二进制断言桌面端所有逻辑完全相同。

原始二进制、完整工具输出、截取的原软件画面保存在本地 `.local/research`，不进入公开仓库。可公开复核的摘要见 [evidence-summary.json](evidence-summary.json)。以下地址仅适用于记录了 SHA-256 的发布物。

## 发布物与桌面分层

Windows 安装器来自官方网站下载配置中的备用下载地址。该批发布物版本为 1.2.16.66，安装器 70,525,400 字节。NSIS 解包后的 254 个文件共 100,691,530 字节。主程序只有 466,064 字节，同时携带约 18.1 MB 的 `flutter_windows.dll`、约 12.0 MB 的 `data/app.so` 和 `flutter_assets`。这些是直接文件证据，说明主 EXE 是原生宿主，不能只反编译这个小 EXE 就声称已经恢复了翻页界面。

插件文件与 Ghidra 导入符号共同显示：

| 能力     | 直接观察                                                                 | 对 TEMPO 的启发                                        |
| -------- | ------------------------------------------------------------------------ | ------------------------------------------------------ |
| 音频     | `AudioplayersWindowsPluginRegisterWithRegistrar` 与音频插件 DLL          | 声音应有独立生命周期、设备失败反馈和音量控制           |
| 窗口     | window size、acrylic、single instance 插件；`bitsdojo_window_api`        | 全屏、置顶、单实例是桌面产品的一部分                   |
| 系统连接 | keyboard/mouse、battery、file selector、URL launcher、video 相关注册入口 | 宿主负责系统集成；不能从插件存在推断某一页面一定使用它 |
| 渲染连接 | Flutter engine / view controller / messenger 导入                        | UI 与原生能力经引擎和消息层连接                        |

Ghidra 默认分析识别出 531 个过程、355 条已定义字符串，装载基址 `0x140000000`。`bitsdojo_window_api` 位于 `0x14000c670`。音频注册导入位于 **EXTERNAL 地址空间** `EXTERNAL:0x3`，精确引用为 `0x140003735` 与 `0x1400104d8`。第一次查询普通地址空间 `0x3` 没有结果；这不代表没有调用。区分地址空间是此次可复用的工具经验。

进一步对 `0x140003735` 反编译，定位到宿主函数 `FUN_1400036b0`：它逐项获取以插件名标识的 registrar，再调用音频、窗口、键鼠等注册入口。Bitsdojo 的注册链落到 `FUN_14000c540`。这是调用关系证据，确认插件确实进入宿主注册流程；仍不能证明某个主题或计时页面的运行时选择。完整反编译文本留在私有证据目录，公开文档只保留关系摘要。

对 `FUN_14000c540` 的第二次反编译又确认：该入口构建名为 `bitsdojo/window` 的 Flutter method channel，创建窗口插件对象，设置方法调用处理器，并将对象交回 registrar 管理。这说明“同一套跨平台界面 + 原生窗口能力”通过消息通道和明确的对象生命周期连接起来。这里看到了窗口桥接层，不等于恢复了所有窗口命令处理细节。TEMPO 用 Tauri 的 typed invoke/event 边界表达自己的宿主接口。

## Flutter / Dart AOT 的实际结果

REA `identify-flutter-build` 完成 APK 构建事实识别。arm64-v8a `libapp.so` 为 9,700,272 字节，`libflutter.so` 为 10,602,168 字节；两种 ABI 都观察到快照 hash `d20a1be77c3d3c41b2a5accaee1ce549`。引擎 build ID 与各库摘要在证据摘要中。工具未给出可靠 Dart 版本，因此不猜版本。

`inspect-dart-aot` 验证了 VM / isolate 指令和数据的四个快照符号、范围与数据头。**结构覆盖完成不等于语义恢复完成**：字符串池投影仍是 partial，class-like token 清单有截断。可见 `package:flitik/main.dart`，以及 `FlipClock`、`cardFlip`、`clockOpacity`、`clockSeq`、`countdownDuration`、`countdownTargetTime`、`countdownCommonDurations`、`countDownLoop`、`countdownLoopInterval`、`countdownShowSeconds`、`audioControl`、`allThemes` 等字节字符串。

这些名称与翻页、倒计时、主题、音频的功能方向一致，**只能作为继续定位的线索**。不能据此认定字段类型、状态机、动画曲线、刷新率或计时精度。也不能据 Android 的 token 断言 Windows 的某项原生调用关系。

## 资源如何组织

Windows `flutter_assets/assets/sounds/tik/` 直接含 `0.mp3` 至 `11.mp3`，另有多种字体、图片和较大视频资源。这证明该发行物携带一组滴答样本，尚未证明每个样本与哪个主题、何时触发如何对应。完整体积也不能作为“时钟引擎本身需要这么大”的证据。

TEMPO 采用自己的矢量表盘、OFL 字体和程序化声音：避免搬运原软件资源，同时允许按声音结构调整起音、金属泛音和衰减。三种音色是原创参数设计，不是 FliTik 的音频转换或仿制。

## 运行观察与明确限制

在 Windows 上直接运行解包的官方 EXE，观察到引导遮罩与三组翻页器件、系统/自定义时间选项、屏保/预览/桌面组件入口。UIA 只暴露 Flutter 宿主 pane，未暴露可遍历的控件树。REA 原生 UI 观察提供者在当前 Windows 环境返回 capability unavailable；没有将这一失败写成成功的 UI 自动化。

因此本轮没有完整验证 FliTik 的倒计时交互、VIP 外观或翻页连续帧，也未测出其精确动画参数。Windows 启动截图受引导遮罩影响，不能用来反推准确主题颜色。未绕过引导、授权、付费限制或网络校验。

## 可复用研究流程

1. 从官方网站解析稳定的下载配置；记录版本、SHA-256、大小。临时重定向令牌不保存到公开资料。
2. 先识别容器，区分安装器与真正宿主，再看框架、资源和插件。
3. 对 APK 做构建识别与 AOT 结构检查；按 ABI 保留证据。
4. 对原生宿主做入口、插件、窗口消息的引用追踪。保留地址空间与目标摘要。
5. 将静态发现、实际运行观察、推测和未验证项分栏记录。
6. 将经验转成自己的设计约束、性能测量与测试，不复制目标程序的资源和反编译实现。

## 可审计的开源参考

另阅读了 [FlipClockGo 的独立页面](https://github.com/jiangnanquan/FlipClockGo/blob/main/standalone.html)，其源码可直接检查上下叶片分层、顺序翻折和程序化音效的方法。TEMPO 借鉴通用分片原理，使用自己的 Svelte 组件、CSS 参数、字体度量和 Rust 声音生成器。该项目 README 的体积、内存、零延迟等表述没有被当作本项目或 FliTik 的测量结论。

FliTik 的公开资料：[官网](https://www.flitik.com/)、[下载脚本](https://www.flitik.com/js/downloads.js)、[更新日志](https://www.flitik.com/logs.html)。本轮不能将网页脚本分析当成桌面 Flutter 源码分析。
