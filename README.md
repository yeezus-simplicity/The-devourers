# The Devourers — 灾虫模拟器 / Boss 演出展示

一个基于 **Vite + 原生 ES Module + Canvas2D / WebGL** 的 Terraria Calamity Mod 风格互动演出项目。
选择一只「灾虫」Boss，它会以平滑插值跟随鼠标游走，并可用按键释放原版 Mod 中对应的招式、形态切换与死亡动画。

项目不含战斗数值、无玩家角色 —— 纯粹是 **Boss 动画 / 特效 / Shader 的展示与调试沙盒**，重点在于把 Calamity Mod 的 C#/HLSL 实现忠实移植到浏览器。

---

## 一、快速开始

```bash
npm install
npm run dev      # 开发服务器 http://localhost:5173（自动打开浏览器）
npm run build    # 产出单文件 dist/index.html
npm run preview  # 预览构建产物
```

| 命令 | 说明 |
|------|------|
| `dev` | 走 `public/` 静态服务，支持 HMR（改 `characters.json` 会热更新到正在运行的游戏） |
| `build` | 把 JS / CSS / **全部贴图** 内联进单个 `dist/index.html`（约 23MB），**双击即可直接运行** |
| `preview` | 本地起服务预览 `dist/` |

> 环境：Node ≥ 18，Vite 5。浏览器需支持 WebGL2（不支持时 DoG 天空 / 护盾 / 激光墙会自动回退到 Canvas2D 近似，不会白屏）。

---

## 二、操作说明

标题界面 → `Play` → 选虫 → 进入。所有键位均可在 **Controls** 界面点击重新绑定，保存在 `localStorage['scourge_keybindings']`。
**没有硬编码键码**，全局通过 `isBound(actionId, e)` 查表分发。

### 通用

| 键 | 动作 | 说明 |
|----|------|------|
| 鼠标移动 / 触摸 | 移动与瞄准 | 蠕虫平滑跟随 |
| `L` | 昼 → 黄昏 → 夜 循环 | 影响全屏暗化强度（0 / 0.30 / 0.55） |
| `T` | 开关下雨 | 雨滴从屏幕上方自然生成落下 |
| `R` | 复位位置 | 虫体归位到屏幕中央 |
| `↑` `↓` | 增 / 减体节 | 下限为角色 `segFloor` |
| `ESC` | 返回 | 游戏中→选虫界面；界面→标题 |
| `F3` | 调试面板 | FPS / 体节数 / 主题 / DoG 状态 / 鼠标坐标 |

### 各角色专属

| 角色 | 键 | 动作 |
|------|----|------|
| **穿孔者** | `1` `2` `3` | 切换 大 / 中 / 小 三种形态（各自独立体节数与贴图） |
| **Storm Weaver** | `P` | 蜕壳（单向：装甲 → 裸形态，不可逆） |
| | `4` `5` `6` | 头部闪电球 / 天降冰霜波 / 尾部龙卷风 |
| | `R` | 复位位置 **并** 恢复装甲初代形态 |
| **Devourer of Gods** | `5`（长按） | 蓄力咬合：按住蓄力，松开触发咬合 + 冲击波 |
| | `P` | P1→P2 过场（漩涡门钻入 → 裂缝 → 冲刺钻出） |
| | `6` | 隐去铠甲（纯能量亮纹形态，toggle，仅 P2） |
| | `7` | 死亡演示（仅 P2 可用） |
| | `8` | 激光墙（仅 `armorOff` 形态，多轮预警→攻击→冷却） |
| | `Space` | 重置全部动画状态回到 P1 |
| **Sepulcher（墓穴魔）** | `1` | Brimstone Barrage：30 颗扩散飞刃 + 火焰拖尾 |
| | `P` / `O` | 至尊灾厄：切换兜帽形态 / 开关能量护盾 |
| | `2` / `5` | 至尊灾厄：冲刺 / BlastCast 巨型火球 |
| | `3` | 召唤 / 退场 两位「兄弟」（toggle） |
| | `4` | 两位兄弟同时攻击 |

> 数字键在不同角色下语义不同（如 `5` 在 Storm 是冰霜、在 DoG 是咬合、在 Sepulcher 是火球），由 `currentCharKey` 分派，互不冲突。

### 可选 URL 参数

| 参数 | 作用 |
|------|------|
| `?handrift=0` | 关闭 DoG 手持裂隙渲染 |
| `?dogdebug=1&grid=1` | DoG 天空调试视图（见 `DogSkyV3.js` 第六格前景扭曲层） |

---

## 三、可选角色（9 只）

| Key | 名称 | 背景 | 昼夜 | 特点 |
|-----|------|------|------|------|
| `aquatic_scourge` | 渊海灾虫 | 渊海 | day | 交替 body1/body2，云 + 雷电 |
| `desert_scourge` | 荒漠灾虫 | 荒漠 | day | 固定 4 种体节，7 帧头部精灵表 |
| `the_perforator` | 穿孔者 | 赤渊 | day | 大 / 中 / 小 三形态切换 |
| `xm05_thanatos` | XM-05 塔纳托斯 | 塔纳托斯 | night | 蓝 ⇄ 红 状态机（各 5s，过渡 1.5s），带 glow 精灵表 |
| `astrum_deus` | Astrum Deus | 星虚空 | night | **双虫模式**：A 跟随鼠标，B 以竖直中线镜像；自发光 |
| `devourer_of_gods` | Devourer of Gods | 虚空浮岛 | day | 内容最多的 Boss：入场动画、P1/P2 过场、咬合、激光墙、死亡 |
| `primordial_wyrm` | Primordial Wyrm | 幻海深渊 | day | 大体节重叠 |
| `storm_weaver` | Storm Weaver | 风暴 | day | 三技能 + 蜕壳 |
| `sepulcher` | 墓穴魔 | 冥狱 | day | 出仓召唤特效、手臂、至尊灾厄 + 两兄弟 |

---

## 四、目录结构

```
scourge-game/
├─ index.html              # 标题 / Controls / 选虫 / 游戏 四个全屏层
├─ vite.config.js          # 三个自定义插件：内联 public 资源、单文件化、脚本时序修复
├─ src/
│  ├─ main.js              # 入口：装配输入、UI、背景、调试面板
│  ├─ style.css            # 全部 UI 样式 + @font-face（Andy）
│  ├─ core/
│  │  ├─ Game.js           # 生命周期、主循环 loop()、按键分发、角色切换
│  │  ├─ globals.js        # 跨模块共享状态（let 导出 + set_xxx() 配套 setter）
│  │  ├─ Renderer.js       # draw() 主绘制管线 + DoGAnim 动画状态机（最大的模块，2.3k 行）
│  │  ├─ Background.js     # 背景/云/雷/雨/日月交替 + DoGSky 门面对象
│  │  ├─ DogSkyV3.js       # DoG 战天天空：WebGL2 完整渲染器（5 层 + 前景扭曲）
│  │  ├─ SkyShaders.js     # DoGSky.cs 的 5 个 HLSL .fx → WebGL 逐行移植
│  │  ├─ RiftShader.js     # MetaballEdgeShader.fx（裂隙边缘检测）移植
│  │  ├─ DogLaserWallGL.js # 激光墙 WebGL2 渲染器（5 层 quad 批量绘制）
│  │  ├─ DogDeathBoomGL.js # 死亡爆炸护盾（Perlin + smoothstep 壳层）
│  │  ├─ DogDialogue.js    # 神吞台词系统（EdgyBossText，带 [Shaking]/[Scale]/[Colors] 标签）
│  │  ├─ BossReelIntro.js  # 神吞入场动画（Ceaseless Void→Signus→Storm Weaver 三段，主包内嵌）
│  │  ├─ StormSkills.js    # Storm Weaver 三技能 + 蜕壳粒子
│  │  ├─ SepulcherSkills.js# 墓穴魔 Brimstone Barrage 弹幕
│  │  └─ Input.js          # 鼠标 / 触摸坐标追踪
│  ├─ entities/
│  │  ├─ Scourge.js        # 体节构建、蠕虫运动学（跟随/链条约束）、双虫模式
│  │  ├─ SupremeCalamitas.js  # 至尊灾厄跟随着（弹簧-阻尼惯性 + 圆约束）
│  │  ├─ SupremeBrothers.js   # 两兄弟 Cataclysm(L) / Catastrophe(R)
│  │  ├─ SupremeShield.js     # 能量护盾（WebGL 复刻 SupremeShieldShader.fx）+ 骷髅护盾
│  │  └─ BrotherProjectiles.js# 兄弟投射物：拳头 / 剑气
│  ├─ effects/SpawnBossEffect.js  # 出仓召唤：暗化 + 震屏 + 红色调
│  ├─ ui/
│  │  ├─ SelectionScreen.js   # 界面切换 + 键位绑定系统（重绑定 / 持久化）
│  │  └─ DebugPanel.js        # F3 实时调试面板
│  ├─ config/
│  │  ├─ characters.json      # ★ 全部数值与贴图路径（可热更新，无需改代码）
│  │  ├─ characters.js        # 读 JSON + 挂回 builder + HMR 钩子
│  │  └─ segmentBuilders.js   # 每角色的体节构建函数（JSON 存不了函数，单独拆出）
│  └─ utils/
│     ├─ ScreenShake.js       # 屏震（trauma 模型，px 单位，帧率无关衰减）
│     └─ effects.js           # 扩展接口：EffectRegistry / ParticleEmitter / TrailRenderer
├─ public/                  # 378 个静态资源（backgrounds / characters / sprites / textures / reel / clouds …）
├─ scripts/                 # 开发辅助：截图、裁图、尺寸检查、诊断（非构建依赖）
└─ dist/                    # 构建产物：单文件 index.html + 散落资源
```

---

## 五、架构要点

### 主循环

`Game.loop(ts)` 每帧按固定顺序推进，任一环节抛异常只跳过当前帧、不中断循环：

```
update(dt)            蠕虫运动学 / 双虫 / 手臂
updateParticles()     环境粒子
updateClouds/Lightning/Rain(dt)
stormSkills / sepulcherSkills.update(dt)
supremeCal.update(dt) 至尊灾厄跟随（仅 sepulcher）
updateDoGAnimations(dt)  DoG 状态机
DoGSky.update(dt)     DoG 天空淡入淡出 + 天空色联动
effects.update(dt)    扩展接口
screenShake.update(dt)
spawnEffect.update(dt)
  ├─ ctx.translate(shake)  →  draw()  →  ctx.restore()
  └─ 出仓滤镜（identity 绘制，盖住震动露出的边缘空白）
```

`dt` 上限 0.1s，防止切标签页回来后瞬移。

### 共享状态为什么用 `let` + `set_x()`

ES Module 的 live binding **只允许导出方修改、导入方只读**。所以 `globals.js` 里每个可变共享量都是
`export let x` 配一个 `export function set_x(v)`，跨模块写入一律走 setter。新增共享状态时请照此成对添加。

模块间存在有意的循环依赖（`Renderer ↔ Background`、`Renderer ↔ Game`），依赖函数提升工作，**不要在模块顶层读取对方的值**。

### 绘制层序（`Renderer.draw()`）

```
背景 → DoG 天空盒 → 雨 → 闪电 → 虫体基础层
  ↓
【昼夜暗化层】← 分水岭：此层之前的都会随夜晚变暗
  ↓
闪电环境闪光 → 技能特效 → 自发光层（Astrum Deus / Storm 亮纹）→ DoG 颚发光
  ↓
DoG 粒子 / 传送裂隙 / P1→P2 过场 / 激光墙 → 至尊灾厄 → 死亡爆炸
  ↓
effects.draw()（扩展接口最上层）→ dogDialogue.draw()（台词覆盖层）
```

台词层是**独立的兄弟 canvas**（`pointer-events:none`），不吃主 `ctx` 的屏震与暗化变换。

### 扩展新特效

无需改渲染管线：

```js
import { effects } from './utils/effects.js';
effects.register('myFx', { update(dt){}, draw(ctx){}, enabled: true });
```

---

## 六、角色配置（`characters.json`）

改这个文件即可调参，**支持 HMR 热更新到正在运行的游戏**（`Game.reloadCurrentCharacter()` 会重建体节、不重置位置、不重新下载已缓存贴图）。

| 字段 | 含义 |
|------|------|
| `scale` / `bodyScale` | 整体缩放 / 体节额外缩放 |
| `overlap` / `tailOverlap` | 体节间重叠像素（防弯曲露缝） |
| `bodyCount` / `segBase` / `segFloor` | 当前体节数 / 进入时默认值 / 最短下限 |
| `maxSpeed` / `accel` / `turnSmooth` | 跟随鼠标的速度、加速度、转向平滑 |
| `headLag` | 头部延迟（墓穴魔专用，制造拖曳感） |
| `particleCount` | 环境粒子数 |
| `background` | 背景 ID（见 `BACKGROUND_LIST`，1–9） |
| `clouds` / `lightning` | 云 / 雷电开关（1/0） |
| `timeOfDay` | `day` / `dusk` / `night` → 决定暗化强度 |
| `selfLuminous` | 是否走暗化层**之后**的自发光绘制 |
| `frames` | 精灵表帧配置：`{ sheet, glow, w, fh, period, anchor, scale }` |
| `variants` | 穿孔者三形态各自的体节与贴图前缀 |
| `phase` / `armorOff` | DoG 阶段与「隐铠甲」状态（运行时可变） |

顶层 `IMAGES` 是 角色 → `{ 部位: 贴图路径 }` 映射，值可以是：

- 字符串（相对 `public/` 的路径）
- 数组（精灵表帧序列，如 Astrum Deus 的 glow 帧）
- `{ url, b64 }` 对象（`url` 优先，失败回退 base64）

---

## 七、Calamity Mod 移植模块

这些是项目的核心资产 —— 每条都对照 C# / HLSL 源码逐行翻译，动画参数**照搬原版、不做「美化式」改动**。

| 模块 | 来源 |
|------|------|
| `SkyShaders.js` | `DoGDistortionWindsShader.fx` / `DoGBackgroundFogShader.fx` / `DoGRiftAuraShader.fx` / `DoGRealityCrackShader.fx` / `MetaballEdgeShader.fx` |
| `DogSkyV3.js` | `DoGSky.cs` + `DoGVisualsManager.cs`（5 层叠加 + 前景扭曲，WebGL2 + 3 FBO） |
| `RiftShader.js` | `MetaballEdgeShader.fx` 单独封装（裂隙内部 / 边缘 / 外部三态） |
| `DogLaserWallGL.js` | `DoGLaserWalls.cs` / `DoGLaserWallsBigBeam.cs` 的 `PreDraw`（每根激光 5 层） |
| `DogDeathBoomGL.js` | `DoGDeathBoom.cs` → `BaseMassiveExplosionProjectile.PreDraw` |
| `SupremeShield.js` | `SupremeShieldShader.fx`（ForcefieldTexture × Perlin 噪声） |
| `SupremeBrothers.js` | `SupremeCataclysm.cs` / `SupremeCatastrophe.cs` 的 `FindFrame` / `PreDraw` |
| `BrotherProjectiles.js` | 同上 L344-360 / L306-307、L384-405 的投射物出招点与速度 |
| `SepulcherSkills.js` | `BrimstoneBarrage.cs` |
| `DogDialogue.js` | Calamity 的 `EdgyBossText` 标签语法 |

### HLSL → GLSL 移植陷阱（改动前必读）

1. `round()` 必须对 `float` / `vec2` / `vec4` 分别重载。
2. `float` 标量**不支持** `.r` swizzle，要写 `.xxxx`。
3. `tex2D()` 返回的 `vec4` 需显式拆 `.r/.g/.b`，不能直接当标量用。
4. `pow(0, 负数)`：HLSL 返回 `inf`，GLSL 行为未定义 —— 必须自己加保护。
5. canvas 默认 `premultipliedAlpha: true`，shader 输出要按预乘语义处理，否则 `drawImage` 合成时二次缩放。

### JS 侧陷阱

- **别用 `HTMLCanvasElement` 当 `Map` 的键** —— `toString()` 冲突，画布缓存必须改用 `WeakMap`。

---

## 八、构建管线（重要）

`vite.config.js` 挂了三个插件，产出**完全自包含、可双击运行**的 `dist/index.html`：

1. **`inline-public-assets`**：遍历 `public/` 全部文件转 base64，把源码里**被引号包裹的相对路径字符串**整字替换成 `data:` URI。
   因为游戏贴图全部以路径字符串写在 `characters.json` / `Background.js` 里，不处理的话双击 `dist` 会贴图全空。
2. **`vite-plugin-singlefile`**：JS / CSS 全部内联。
3. **`fix-script-timing`**：
   - 去掉 `type="module"`（`file://` 下 ES module 被 CORS 拦截，整段脚本不执行 → 按钮点了没反应）
   - 修掉 singlefile 误加在 `<style>` 上的 `rel` / `crossorigin`
   - 把内联脚本从 `<head>` 移到 `</body>` 前（否则 DOM 未解析完，`getElementById` 全返回 null）
   - 包一层 `try/catch` + `window.onerror` 红框错误可见化

### 两道构建门禁

| 门禁 | 检查 |
|------|------|
| 1（注入前） | 内联脚本正文里出现 `</script` / `</body` / `</html` → **直接构建失败**。浏览器解析器会提前闭合标签，后半段 JS 被当 HTML → 整站失效 |
| 2（写入后） | 重新读回磁盘，逐字节确认注入片段完整存在，且全文 `</body>` 恰好 1 个 |

### ⚠️ 两个已踩过的坑，别再踩

- **禁止用 `html.replace('</body>', js + '</body>')`**：`String.replace` 的替换串里 `$&` / `` $` `` / `$'` 是元字符，压缩后 JS 里大量 `$` 变量名，一旦凑出 `$&` 就会被展开成 `</body>` 塞进代码 → `SyntaxError`，且**时好时坏**极难定位。本项目已全部改用**索引切片拼接**。
- **别自动转义 `</script`**：若该子串落在代码区而非字符串字面量里，转义本身会造出新的语法错误。发现就中止构建、去修源码。

### 其他构建约定

- `emptyOutDir: false` —— 沙箱环境下 Vite 清空 `dist/`（200+ 文件）会触发 safe-delete 守卫而中止构建。关闭后改为覆盖写入，旧孤儿资源只占空间、不影响运行。
- 在 `dist/` 里 **grep 不到 `reel/assets` 之类的路径字符串 ≠ 代码缺失**，那是已被替换成 base64 了。判断代码是否进包：看体积增量，或搜非路径特征串（如 `signusGlow`、`dog-reel-skip`）。压缩后 JS 全在单行，`grep -c` 恒为 0/1，必须用 `grep -o | wc -l`。

---

## 九、约定与已知遗留

- **字体**：`src/assets/fonts/ANDYB.TTF`，family 名 `Andy`（见 `style.css` 的 `@font-face`）。
- **屏震单位是像素**：`screenShake.set(N)` 的 N 直接是 px，衰减 `pow(0.9, dt*60)`，帧率无关。
- **出仓滤镜必须在 `ctx.restore()` 之后以 identity 绘制**，才能盖住屏震时画布边缘露出的空白。
- **神吞入场**：点击 DoG 图标先播放三段 boss-reel 动画（可 Skip），动画资源运行时仍从 `public/reel/assets/` 读取，构建时内联。
- 遗留：`Background.js` 里的 `_skyQ`（URL 参数解析）目前**未被使用**；`globals.js` 顶部注释里提到的 `?solo=1..5` 参数已失效，实际调试参数是 `?dogdebug=1&grid=1`。
- 项目无 HP / 受击模型，因此 DoG 台词系统里与「受伤 / 死亡灵魂被吞噬」相关的触发全部省略。

---

## 十、开发辅助脚本（`scripts/`，非构建依赖）

| 脚本 | 用途 |
|------|------|
| `screenshot.mjs` / `screenshot2.mjs` | puppeteer 截图对比 |
| `crop.ps1` / `crop_current.ps1` | 裁剪贴图 |
| `img_size.ps1` / `img_size2.ps1` | 批量查贴图尺寸 |
| `arm_diag.mjs` | 墓穴魔手臂诊断 |
| `zoom.ps1` | 局部放大核验 |
| `check_server.ps1` | 预览服务器健康检查 |
