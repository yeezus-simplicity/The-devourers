// ===== entities/BrotherProjectiles.js =====
// 「至尊灾厄之兄弟」攻击投射物
//  - fist  : SupremeCataclysmFist   (Cataclysm 的拳头，126×224 = 4 帧 126×56)
//  - slash : SupremeCatastropheSlash(Catastrophe 的剑气，168×240 = 4 帧 168×60)
//  参照源：SupremeCataclysm.cs L344-360 / SupremeCatastrophe.cs L306-307,L384-405
//   · 拳头：出招点 = Center + UnitX*74*direction，速度 15 px/tick
//   · 剑气：出招点 = Center + UnitX*125*direction，速度 8 px/tick
//   · Phase2 双发散射：拳 RotatedBy(±0.55)、斩 RotatedBy(±0.34)（出招点沿旋转后方向偏移）
//  ai[0] = PunchingFromRight / SlashingFromRight → 左右手交替，表现为垂直翻转

import { W, H } from '../core/globals.js';

const PROJ = {
  fist: {
    sheet: 'textures/sepulcher/SupremeCataclysmFist.png',
    fw: 126, fh: 56, frames: 4,
    frameRate: 14,          // 帧动画速度 (帧/秒)
    life: 2.2,              // 最长存活 (s)
    glow: [255, 70, 160],   // 发光基调：洋红/红（对应 Cataclysm 亮纹）
    trail: 3,               // 残影数
    glowScale: 0.62,        // 尾部径向光斑半径 = 显示高度 * 此比例
  },
  slash: {
    sheet: 'textures/sepulcher/SupremeCatastropheSlash.png',
    fw: 168, fh: 60, frames: 4,
    frameRate: 11,
    life: 2.6,
    glow: [70, 220, 255],   // 发光基调：青（对应 Catastrophe 亮纹）
    trail: 5,               // 剑气是 TrailedSlash，拖尾更长
    glowScale: 0.70,
  },
};

// 贴图旋转补偿：两张贴图的自然朝向均为 +X（向右），与 Terraria
// `Projectile.rotation = velocity.ToRotation()` 一致，故为 0；如发现朝向不对改这里。
const ROT_OFF = 0;

const MAX_PROJ = 120;       // 投射物数量上限（Round2 双发时总量约 ×1.5，留足余量）

let loaded = false;
function ensureImgs() {
  if (loaded) return;
  for (const k of Object.keys(PROJ)) {
    const c = PROJ[k];
    if (!c._img) { const i = new Image(); i.src = c.sheet; c._img = i; }
  }
  loaded = true;
}

export const brotherProjectiles = {
  list: [],

  // 生成一枚投射物
  //  type  : 'fist' | 'slash'
  //  x,y   : 出招点（世界坐标）
  //  ang   : 飞行方向 (rad)
  //  speed : 飞行速度 (px/s，已按世界缩放折算)
  //  sc    : 世界缩放（与兄弟精灵同一 scale，保证比例一致）
  //  alt   : 左右手交替标志（对应 C# ai[0]，表现为垂直翻转）
  spawn(type, x, y, ang, speed, sc, alt) {
    ensureImgs();
    const c = PROJ[type];
    if (!c) return;
    this.list.push({
      type, cfg: c,
      x, y,
      vx: Math.cos(ang) * speed,
      vy: Math.sin(ang) * speed,
      ang,
      sc,
      alt: !!alt,
      frame: 0,
      frameT: 0,
      life: c.life,
      maxLife: c.life,
      trail: [],            // 残影历史 [{x,y,ang}]
    });
    if (this.list.length > MAX_PROJ) this.list.splice(0, this.list.length - MAX_PROJ);
  },

  clear() { this.list.length = 0; },

  update(dt) {
    if (!this.list.length) return;
    const dtC = Math.min(dt, 1 / 30);
    for (let i = this.list.length - 1; i >= 0; i--) {
      const p = this.list[i];
      const c = p.cfg;

      // 残影历史（每帧记录，超出 trail 数丢弃最旧）
      p.trail.push({ x: p.x, y: p.y, ang: p.ang });
      if (p.trail.length > c.trail) p.trail.shift();

      p.x += p.vx * dtC;
      p.y += p.vy * dtC;

      // 帧动画循环
      p.frameT += dtC * c.frameRate;
      if (p.frameT >= 1) { p.frame = (p.frame + 1) % c.frames; p.frameT -= 1; }

      p.life -= dtC;

      // 回收：寿命耗尽 / 飞出屏幕外（留一个显示高度的余量）
      const pad = c.fh * p.sc * 2;
      if (p.life <= 0 || p.x < -pad || p.x > W + pad || p.y < -pad || p.y > H + pad) {
        this.list.splice(i, 1);
      }
    }
  },

  draw(ctx) {
    if (!this.list.length) return;
    for (const p of this.list) {
      const c = p.cfg;
      const img = c._img;
      if (!img || !img.complete || img.naturalWidth === 0) continue;

      const dw = c.fw * p.sc;
      const dh = c.fh * p.sc;
      const sx = 0;
      const sy = p.frame * c.fh;
      // 末段淡出（最后 25% 寿命）
      const fade = Math.min(1, (p.life / p.maxLife) / 0.25);

      ctx.save();
      ctx.imageSmoothingEnabled = false;

      // —— 残影拖尾（越旧越淡越小）——
      // 注意：每个残影必须 save/restore，绝不能用 setTransform 重置——
      // 那会抹掉调用方已施加的屏震/相机变换，导致整体错位。
      for (let t = 0; t < p.trail.length; t++) {
        const g = p.trail[t];
        const k = (t + 1) / (p.trail.length + 1);      // 0(最旧) → 1(最新)
        ctx.save();
        ctx.globalAlpha = 0.30 * k * fade;
        ctx.globalCompositeOperation = 'lighter';
        ctx.translate(g.x, g.y);
        ctx.rotate(g.ang + ROT_OFF);
        if (p.alt) ctx.scale(1, -1);
        ctx.drawImage(img, sx, sy, c.fw, c.fh, -dw * k / 2, -dh * k / 2, dw * k, dh * k);
        ctx.restore();
      }
      ctx.globalAlpha = 1;
      ctx.globalCompositeOperation = 'source-over';

      // —— 尾部径向光斑（把投射物"点亮"，贴合 Calamity 的发光感）——
      ctx.globalCompositeOperation = 'lighter';
      const gr = dh * c.glowScale;
      const grd = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, gr);
      grd.addColorStop(0, `rgba(${c.glow[0]},${c.glow[1]},${c.glow[2]},${0.55 * fade})`);
      grd.addColorStop(0.5, `rgba(${c.glow[0]},${c.glow[1]},${c.glow[2]},${0.18 * fade})`);
      grd.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = grd;
      ctx.beginPath(); ctx.arc(p.x, p.y, gr, 0, Math.PI * 2); ctx.fill();
      ctx.globalCompositeOperation = 'source-over';

      // —— 本体 ——
      ctx.translate(p.x, p.y);
      ctx.rotate(p.ang + ROT_OFF);
      if (p.alt) ctx.scale(1, -1);            // 对应 C# ai[0] 的 FlipVertically（左右手交替）
      ctx.globalAlpha = fade;
      ctx.drawImage(img, sx, sy, c.fw, c.fh, -dw / 2, -dh / 2, dw, dh);
      // 亮化叠加一遍，突出发光
      ctx.globalCompositeOperation = 'lighter';
      ctx.globalAlpha = 0.45 * fade;
      ctx.drawImage(img, sx, sy, c.fw, c.fh, -dw / 2, -dh / 2, dw, dh);

      ctx.restore();
    }
  },
};
