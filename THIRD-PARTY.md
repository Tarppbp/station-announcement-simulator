# 第三方素材说明

本仓库的程序和说明由本项目编写。下面列出仓库里包含的第三方素材，以及**没有包含**、需要使用者自行获取的素材。

## 一、线路标志（包含在本仓库）

位置：`static/line_icons/`，共 37 个 PNG 文件。

这些是 JR 东日本、东京地铁、都营地铁、临海线、东京单轨电车、日暮里・舍人线和都电荒川线（东京樱花电车）的线路标志。原图来自 [Wikimedia Commons：Category:Rapid transit icons of Japan](https://commons.wikimedia.org/wiki/Category:Rapid_transit_icons_of_Japan)，由 [ksleungac/pids-jre-simulator](https://github.com/ksleungac/pids-jre-simulator) 转成 PNG 并缩放。本项目原样使用该项目 `data/line_icons/` 里的文件。下面的授权情况引自该项目的 [THIRD-PARTY.md](https://github.com/ksleungac/pids-jre-simulator/blob/main/THIRD-PARTY.md)。

### 公有领域（34 个）

在 Wikimedia Commons 上标注为 `PD-textlogo`：图案只由简单几何图形或文字构成，达不到著作权保护所需的独创性，属于公有领域。

包括 `JA.png`、`JB.png`、`JC.png`、`JE.png`、`JH.png`、`JI.png`、`JJ.png`、`JK.png`、`JL.png`、`JM.png`、`JN.png`、`JO.png`、`JS.png`、`JT.png`、`JU.png`、`JY.png`、`_universal.png`、`metro_*.png`（10 个）、`toei_*.png`（4 个）、`rinkai.png`、`tokyo_monorail.png`、`nippori_toneri.png`。

### CC BY-SA 4.0（3 个）

授权方式：[知识共享 署名-相同方式共享 4.0（CC BY-SA 4.0）](https://creativecommons.org/licenses/by-sa/4.0/deed.zh-hans)。原图为 SVG，已转成 PNG 并缩放；改动后的文件沿用同一授权。

| 本仓库文件 | Wikimedia Commons 原文件 | 作者 |
|---|---|---|
| `shinkansen_jr_east.png` | [Shinkansen_jre.svg](https://commons.wikimedia.org/wiki/File:Shinkansen_jre.svg) | 原作者不详；矢量化：Carnby、Perhelion |
| `shinkansen_jr_central.png` | [Shinkansen_jrc.svg](https://commons.wikimedia.org/wiki/File:Shinkansen_jrc.svg) | KANAO22 |
| `sakura_tram.png` | [Tokyo_Sakura_Tram_symbol.svg](https://commons.wikimedia.org/wiki/File:Tokyo_Sakura_Tram_symbol.svg) | 東京都交通局 |

### 商标

不受著作权保护，不等于不受商标权保护。这些标志是各铁路公司的注册商标，本项目仅用来标示对应的线路。**本项目与东日本旅客铁道（JR 东日本）、东京地铁、东京都交通局及其他任何铁路公司均无关联，也未获得它们的认可或赞助。**

## 二、JR 全线原声录音（不包含在本仓库）

「JR 全线原声」功能使用的车内广播、发车音乐录音**不在本仓库里**，也不会由本项目分发。

- **来源**：[ksleungac/pids-jre-simulator](https://github.com/ksleungac/pids-jre-simulator) 的 `audio/` 文件夹。录音由铁道爱好者在车站和车内录制，录制者名单见该项目的 README。
- **权利**：录音及其中旋律的著作权属于 JR 东日本及相关权利人。原项目说明录音只供配合其模拟器使用，**不允许再分发**。注明来源并不能取代授权，所以本仓库不收录录音。
- **获取方法**：
  1. 从 GitHub 下载 pids-jre-simulator，例如 `git clone --depth 1 https://github.com/ksleungac/pids-jre-simulator.git`，约 800 MB，大部分是录音。
  2. 在本项目的 `local-config.json` 中，把 `jre_dir` 设为该文件夹的路径（文件夹里应有 `audio` 和 `data`）。
  3. 重启模拟器。程序只在本机读取这些文件，不复制、不上传。
- **运行图数据**：各车次的站点和广播顺序（`audio/**/route.json`、`data/*.json`）属于该项目的 MIT 授权部分。本项目运行时读取，同样不收录在本仓库里。

## 三、其他本地样本（不包含在本仓库）

上海公交、国铁车内广播、JR 单站样本等录音只保存在使用者自己的电脑上（`data/`、`downloads/`、`static/sounds/` 已在 `.gitignore` 中排除）。来源见 README 的「参考与素材来源」。
