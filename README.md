# 报站模拟器

本地运行的车厢下一站显示与报站工具。选择中国或日本线路，编辑停靠站、线路编号和车种。可以导入自己的录音、试听原声，再按需替换原声中已定位的站名。

## 车内动态显示屏

仿车门上方液晶屏的动态画面，按 16:9 绘制并随窗口等比缩放：

- 站名按语言轮播（日文、假名、英文、中文，或中文、英文），名字过长时横向压缩，英文改为两行。
- 「下一站 / 即将到站 / 到站」三种状态。自动模式下跟随报站播放切换。
- 下半屏轮播路线图（带列车位置箭头）、换乘信息和开门方向。
- 支持全屏，以及只显示屏幕的单独窗口（`/static/display.html`），通过 BroadcastChannel 与主页面同步。
- 轮播速度、路线图站数、屏幕大小、轮播语言、每站的换乘和开门方向都可在「车厢屏设置」中修改。

代码在 `static/lcd.js`、`static/lcd.css` 和 `static/display.html`。

## 启动

需要 Python 3.10 或以上。导入音频或视频时需要 [FFmpeg](https://ffmpeg.org/download.html)，并确保终端可运行 `ffmpeg -version`。

```sh
python -m venv .venv
# Windows
.venv\Scripts\python.exe -m pip install -r requirements.txt
.venv\Scripts\python.exe app.py
# macOS / Linux
.venv/bin/python -m pip install -r requirements.txt
.venv/bin/python app.py
```

打开 [本机模拟器](http://127.0.0.1:8899/)。Windows 安装依赖后也可以双击 `启动报站模拟器.cmd`。

## 播放与替换

1. 选线路查看车厢屏，使用「站点表」编辑停靠站。
2. 展开「导入原声录音」，选文件并指定播报语言。仅试听时，原话可留空。
3. 要替换站名，先配置下面的语音组件。导入时填写录音里念的原站名，双语样本也可填英文。识别完成后修改站名，点「替换并播放」。替换结果可重播或保存。

公开仓库提供程序和线路显示模板。第三方录音、模型权重及个人设置由使用者留在本机。请使用有权使用和处理的录音。

### 语音配置

把 `local-config.example.json` 复制为 `local-config.json`，填写需要的项目。

| 设置 | 用途 |
| --- | --- |
| `tts_dir` | 已安装的 [IndexTTS 2.5](https://github.com/index-tts/index-tts) 目录，含 `checkpoints/config.yaml`。需要替换名称时，用 IndexTTS 的 Python 环境安装本项目的依赖并运行 `app.py`。 |
| `asr_model` | 已下载的 [faster-whisper-medium](https://huggingface.co/Systran/faster-whisper-medium) 本地模型目录，含 `model.bin`。 |
| `asr_python` | 安装了 `faster-whisper` 的 Python 可执行文件。留空时使用运行模拟器的 Python。 |
| `drive_folder`、`drive_url` | 可选。Google Drive 桌面客户端的同步文件夹及相应网页链接。保存线路并生成录音后，可手动把该录音传到云盘。 |

上面各项也可用大写环境变量设置，例如 `STATION_SIM_TTS_DIR`。模拟器默认只监听本机回环地址。导入和替换都在本机处理，「翻译地名」会向 OpenStreetMap 和 Wikidata 查询输入的名称。

## 参考与素材来源

- 车厢屏布局参考 [西武 40000 系](https://www.seiburailway.jp/railway/encyclopedia/40000/)、[JR 东日本站点编号案内](https://www.jreast.co.jp/press/2016/20161210.pdf)和[日立的 E235 系车内 LCD 介绍](https://www.hitachihyoron.com/jp/archive/2020s/2021/03/03a09/index.html)。本项目为独立实现。
- 本地版样本的来源包括 [上海公交录音项目](https://github.com/95xp4qk8y5-code/shanghai-bus)、[JR 样本页面](https://github.com/ksleungac/pids-jre-simulator)以及[黄河铁路网](https://jprailfan.com/announce/download.php?cate=ra&pg=4&subcate=)。录音使用范围见各来源说明。
