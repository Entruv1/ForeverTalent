# 永恒天赋计算器 · 中文离线版

《魔兽世界：永恒》(World of Warcraft: Forever) 天赋计算器的**中文离线版**。

- 上游站点：[talentsforever.com](https://talentsforever.com/) —— Chris Baldwin 制作的粉丝作品
- 本仓库：把上游整站汉化为中文，并打包成**单文件、可离线、无广告无统计**的产物

## 下载

| 产物 | 适用平台 | 大小 | 位置 |
| --- | --- | --- | --- |
| `永恒天赋计算器-1.1.6.exe` | Windows，双击即用、免安装、不写注册表 | 101 MB | [Releases](../../releases/latest) |
| `永恒天赋计算器.html` | 任意现代浏览器，双击即用 | 19 MB | 仓库根目录，或 [Releases](../../releases/latest) |

## 特性

- **完全离线**：图标、天赋树底图、前后对比截图等 866 张图片全部内联进单个 HTML，断网可用。
- **全中文**：职业、天赋、法术、改动说明均按《魔兽世界》官方译名（参照 Wowhead 中文）汉化。
- **干净**：不含任何广告、统计或追踪脚本（`googletagmanager` / `adsbygoogle` / `dataLayer` 计数均为 0）。
- **离线路由**：站内跳转要么在页内完成，要么交给系统浏览器打开上游页面，不会掉进文件系统根目录。

## 内容规模

| 项 | 数量 |
| --- | --- |
| 职业 | 9（战士 / 圣骑士 / 猎人 / 潜行者 / 牧师 / 萨满 / 法师 / 术士 / 德鲁伊） |
| 法术说明 | 1798 条 |
| 改动前 / 后对比图 | 57 组 |
| 版本更新记录 | 9 条 |
| 传承专长 | 27 项 |

## 当前版本

| 本地版本 | 对应上游站点 | 内容 |
| --- | --- | --- |
| **1.1.6** | `1.60.1.70170` | 补齐 9 个缺失的图标/对比图（战士·狂怒两个天赋此前是空块），并给构建链加上资源完整性硬闸 |
| 1.1.5 | `1.60.1.70170` | 战士天赋树的服务器热修、暴雪「提示框之外」开发说明、新增技能与前后对比图 |

## 从源码构建

仓库里带完整构建链。依赖：**Python 3**（+ Pillow）、**Node.js 22**。

### 1. 单文件 HTML（`_src/`）

按顺序执行，任一步失败就不要继续：

```bash
cd _src
python _assets_fetch.py --write   # 体检并补齐 dl/ 里缺的图标/对比图（缺失时构建会直接失败）
python gen_i18n.py      # 合并 zh_*.tsv -> i18n.json，含数字对账与基线闸门
node   build_data.js    # 上游数据 js + i18n.json -> zh_data.js
python _gen_ui2.py      # 重写 ui_zh.py 的补丁表（IDX / EXTRA_S / RE_S）
python build_html.py    # 内联资源 + 文案补丁 -> ../永恒天赋计算器.html

# 校验
python _numcanary.py    # 数字对账金丝雀（改过 numfix.py 必跑）
python _numaudit.py     # 数字对账只读审计
python _ghverify.py     # 白名单复现：把仓库文件复制到空目录跑完整链、比 md5
```

成功判据：`gen_i18n.py` 打出 `缺口 names=0 descs=0`；`build_data.js` 打出
`every string has a translation`；`build_html.py` 打出 **`missed: 0`** 并通过三道硬闸
（补丁定界符自检 + 资源完整性 + `node --check` 语法自检）。

### 2. 便携版 EXE（`_exe/`）

```bash
cd _exe
npm install                      # 首次；国内走 .npmrc 里的 npmmirror 镜像
node node_modules/electron/install.js   # electron 44 无 postinstall，需手动拉二进制
node scripts/build-app.js        # 由根目录 HTML 派生 app.html + 生成 icon.ico
node scripts/smoke.js            # 自检：中文数据 + 0 JS 错误 + 0 可见英文
node scripts/dist.js             # 打包 -> dist/永恒天赋计算器-x.y.z.exe
node scripts/verify-dist.js      # 校验 asar 内 app.html 与源文件逐字节一致
```

> 必须用 `node scripts/dist.js`，不要直接调 `electron-builder`：前者会补全
> `PATHEXT`、注入 `npm.cmd` shim 与 npmmirror 镜像，并自行清理中间产物。

### 发布白名单

仓库根目录的 `.gitignore` 是**白名单式**的：工作目录里的一次性中间产物
（`tmp*.js`、`_built_*`、`_bak_*`、历史数据快照、调试脚本、`node_modules`、`dist`）
一律不入库。这份白名单经过验证 —— `python _src/_ghverify.py` 会把清单内的文件复制到空目录
跑完整构建链，产出的单文件 HTML 与发布版**逐字节相同**才算过。
（它顺带做覆盖性检查：构建脚本引用到的输入文件若没放行，会直接点出来。）

## 免责声明

- 本仓库是**非官方**粉丝汉化版，与暴雪娱乐（Blizzard Entertainment）及上游站点作者均无隶属关系。
- 游戏数据（天赋、法术、图标等）版权归暴雪娱乐所有；本仓库仅提供汉化与离线打包。
- 上游站点改版后本版可能过时，请以 [Releases](../../releases/latest) 页的最新版本为准。
