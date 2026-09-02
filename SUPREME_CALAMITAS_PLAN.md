# 至尊灾厄（Supreme Calamitas）跟随从者 — 实现计划（状态0：默认漂浮）

## 一、目标
在墓穴魔（sepulcher）场景中新增一个跟随者角色「至尊灾厄」，本期只做**第 0 种状态（默认漂浮）**：

- 默认**兜帽形态**；按 **P** 在兜帽 / 无兜帽之间切换
- 漂浮在 **sepulcher 头部周围**；sepulcher 运动时 SC 快速跟随之方向一侧偏置（上移则在头 部上方、下移在下方、左右同理）
- 飞行带**惯性**（加减速、阻尼、过冲回弹）
- 活动范围被约束在**以 sepulcher 头部为圆心、半径 R 的圆内**
- 漂浮动画使用精灵图**顶部前 6 帧行**

## 二、精灵图解析（已用像素扫描确认）
| 图 | 尺寸 | 色型 | 帧高 | 总帧行数 | 每帧行宽 | 备注 |
|----|------|------|------|---------|---------|------|
| SupremeCalamitasHooded.png（兜帽） | 120×1302 | palette | 62 | ≈21 | 120（左右两个近贴子帧，中缝 x60-68 空） | 默认形态 |
| SupremeCalamitas.png（无兜帽） | 120×1260 | RGBA | 60 | 21 | 同上 | P 切换形态 |

**“前 6 行” = 精灵图顶部 y 0..`~6×Fh` 的 6 个帧行**，作为漂浮循环帧（每行取左列子帧作为主帧，共 6 帧动画）。

> ⚠️ 待确认：每帧行内的两个子帧（左/右）是否为同一动作的两版（镜像 / 备选帧）。本期默认只取**左列子帧**，循环 6 帧；若需更平滑可在实现时用左右交替。此假设需用户评审确认。

## 三、物理模型（惯性 + 圆约束）
中心 `C` = sepulcher 头部屏幕坐标（复用 `points[0]` / `lastHead`）。

每帧（Game.loop 中 `supremeCal.update(dt)`，仅在 `currentCharKey==='sepulcher'` 时运行）：
1. **计算目标点 T**：
   - 取 sepulcher 头部瞬时位移 `mv = P_head(t) - P_head(t-1)`
   - 移动判定阈值 `mvLen > MV_MIN`（产生轻微死区，避免静置抖动）
   - 若移动：`T = C + normalize(mv) * R_BIAS`（R_BIAS≈0.55×R，SC 停向运动方向一侧）
   - 若静止：`T` 缓慢回归 `C`（`T = C`，配合惯性自然回位）
2. **弹簧-阻尼更新位置**（产生惯性/过冲）：
   - `v += (T - P_cur) * SPRING * dt`
   - `v *= (1 - DAMP * dt)`（阻尼）
   - 限速 `|v| ≤ MAX_SPD`（“快速移动”但可感知惯性）
   - `P_cur += v * dt`
3. **圆约束（硬钳制）**：`dist = |P_cur - C|`；若 `dist > R`：把 `P_cur` 拉回到 `C + normalize(P_cur-C)*R`，并把速度沿径向分量清零（让 SC 沿圆沿滑动，不出圈）。

### 参数建议（中档，可在 constants 一处调整）
```
R         = min(W,H)*0.34  // 圆半径
R_BIAS    = 0.55 * R       // 运动方向偏置距离
SPRING    = 6.0
DAMP      = 8.0
MAX_SPD   = min(W,H)*0.35 / s   // 惯性下可达速度
MV_MIN    = 1.2            // 移动判定阈值(px)
```

## 四、形态切换（按 P）
- 在 `Game.js:27` 的 `keydown` 中新增：`currentCharKey==='sepulcher'` 且 `e.key==='p'`/`'P'` 时调用 `supremeCal.toggleForm()`
- 切换即替换 SC 使用的精灵图源（兜帽 ⇄ 无兜帽），同一 `SupremeCalamitas.js` 实体、状态/位置不重置

## 五、渲染（Renderer.draw 接入）
- 绘制时机：**sepulcher 本体与手臂之后、出仓滤镜（暗化+红调）之前**（在 `sepulcherSkills.draw()` 附近、滤镜层前）
- 每帧取当前形态 sheet，按 `frame = floor(animTime / FRAME_T) % 6` 取前 6 行之一绘制
- 叠轻微上下浮沉（`+2*sin(animTime)`）与翻转朝向（面向 sepulcher 移动方向，左右 flip）

## 六、文件改动清单
| 文件 | 改动 |
|------|------|
| **`src/entities/SupremeCalamitas.js`**（新建） | 实体：状态、pos/vel、`update(dt)`（物理+约束）、`toggleForm()`、`draw(ctx, imgs, animTime)`（前6帧行动画）、参数常量 |
| `src/core/Game.js` | `startGame('sepulcher')` 时预加载/启动 SC；`loop` 中 `update` 挂点（`Game.js:89` 附近追加）；`keydown` 加 P 切换（`Game.js:27`） |
| `src/core/Renderer.js` | `draw()` 中在 `sepulcherSkills.draw` 后、出仓滤镜前调用 `supremeCal.draw(...)`；从 globals/animTime 取头坐标与返回变化量 |
| `src/core/globals.js` | 导出 `supremeCal` 单例（或由 module 自身持有）；暴露头部坐标 `points[0]` 已存在 |
| （影像）`public/backgrounds/` 不涉及；SC 贴图放置 `public/textures/sepulcher/` 或 `public/sprites/` | 两张 PNG 拷入，经 `BG/实体加载` 或懒加载 |

## 七、顶部“前 6 行”帧索引（以无兜帽模）：
帧行 i=0..5 对应源图纵坐标 `y = i * Fh`（Fh=无兜帽60 / 有兜帽62），每帧绘 `x=0..60`（左列子帧），时长 `FRAME_T≈120ms`。

## 八、评审待确认点
1. **“前 6 行”子帧用法**：每行取左子帧共 6 帧（默认）vs 左右子帧交替共 12 帧？
2. **SC 显示尺寸**：约 sepulcher 头部的 1.2～1.5 倍高度（默认），是否合适？
3. **静止回位**：sepulcher 停下后 SC 是“缓回圆心”（默认）还是“停在上次偏置位”？
4. **切换键**：确认用 **P**（当前是否与其他快捷键冲突）。