// ===== effects/SpawnBossEffect.js =====
// "出仓召唤"全屏特效（摹仿灾厄：在受诅咒祭坛用灾厄之烬/仪式瓮召唤 Boss）：
//   ① 屏幕变暗  ② 屏幕震动  ③ 整体偏红色调
// 由外部触发（进入墓穴魔时自动播放），draw 阶段读取 darken()/red() 作为全屏覆盖层，
// 震动复用全局 screenShake（utils/ScreenShake.js）。
//
// 时间线（中等强度）：
//   0     ──────────────── 压暗快速拉高（≈0.45s 到峰值 0.66）
//   0.3~2.2s ─────────── 红色调平滑升至峰值 0.40 后保持
//   尾段  ─────────────── 全部回落至恢复

import { screenShake } from '../utils/ScreenShake.js';

const DUR = 2.6;        // 总时长（秒）
const SHAKE = 14;       // 峰值震屏强度（px，中等强度）
const DARK_PEAK = 0.66; // 暗化峰值 alpha（黑、偏暗红）
const RED_PEAK = 0.20;  // 红色调峰值 alpha（用户反馈 0.40 太深，减半）

const clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);

export const spawnEffect = {
  t: -1,   // 已运行时长；-1 = 未激活

  get active() { return this.t >= 0; },

  trigger() {
    if (this.t >= 0) return;   // 已在播放则不重入
    this.t = 0;
    screenShake.set(SHAKE);
  },

  update(dt) {
    if (this.t < 0) return;
    this.t += dt;
    if (this.t >= DUR) { this.t = -1; return; }
    // 贯穿特效前 1.4s 持续强震荡，之后随时间线性减弱直到静止：
    // 在暗化/红色调覆盖之下也清晰可见（不再是一次性瞬时应）。
    const shakeEnv = 1 - clamp01((this.t - 1.4) / 1.0);
    if (shakeEnv > 0) screenShake.set(SHAKE * shakeEnv);
  },

  /** 全屏暗化层 alpha（0..1），快速压暗后维持，尾部回落 */
  darken() {
    if (this.t < 0) return 0;
    const t = this.t;
    const up = clamp01(t / 0.45);                       // 快速压暗
    const fall = t > DUR - 0.7 ? clamp01((DUR - t) / 0.7) : 1; // 尾部淡出
    return DARK_PEAK * up * fall;
  },

  /** 全屏红色调 alpha（0..1），稍晚于压暗出现、峰值保持、尾部淡出 */
  red() {
    if (this.t < 0) return 0;
    const t = this.t;
    const up = clamp01(t / 0.38);                       // 红色调稍迟上升
    const hold = clamp01((t - 0.2) / 1.1);              // 平滑升至中段
    const fall = t > DUR - 0.5 ? clamp01((DUR - t) / 0.5) : 1;
    return RED_PEAK * up * hold * fall;
  },
};