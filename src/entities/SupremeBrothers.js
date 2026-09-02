// ===== entities/SupremeBrothers.js =====
// 「至尊灾厄之兄弟」—— 常规漂浮形态（非攻击）精灵动画
//  - 左侧：SupremeCataclysm（红/洋红亮纹）
//  - 右侧：SupremeCatastrophe（青/蓝亮纹）
//  - 兄弟锚定在屏幕左右两侧 X 固定，Y 轴随鼠标 Y 平滑移动
//  - 亮纹(Glow)按原 C# PreDraw：本体 + 同帧 Glow 叠加(lighter 混合)
//  - 参照源：SupremeCataclysm.cs / SupremeCatastrophe.cs 的 FindFrame / PreDraw
//    · Cataclysm：npcFrameCount=9，帧212×208，3列×9行，常规漂浮帧0~11（CurrentFrame=(+1)%12）
//    · Catastrophe：npcFrameCount=8，帧400×230，2列×8行，常规漂浮帧0~5（CurrentFrame=(+1)%6）
//    · 帧索引 → 列(xFrame)=floor(frame/rows)，行(yFrame)=frame%rows

import { W, H, mouse } from '../core/globals.js';
import { brotherProjectiles } from './BrotherProjectiles.js';

// —— 兄弟配置（基于短边缩放显示尺寸）——
const BROS = {
  cataclysm: {
    sheet:  'textures/sepulcher/SupremeCataclysm.png',
    glow:   'textures/sepulcher/SupremeCataclysmGlow.png',
    cols: 3, rows: 9, fw: 212, fh: 208,
    idleFrames: 12,            // 常规漂浮帧数（0~11）
    glowColor: 'red',          // 亮纹基调：红/洋红
    side: 'left',
    DISP_RATIO: 0.340,         // 显示高度 = 短边 * 此比例（2× 放大）
    EDGE_GAP: 0.03,            // 贴图内容与屏幕左/右缘的空隙 = 短边 * 此比例
    cl: 14, cr: 204,           // 实测非透明内容在帧内的左/右边界(px)，用于锚点避免出屏
    // —— 攻击参数（严格取自 SupremeCataclysm.cs）——
    atk0: 12, atk1: 21,        // 攻击帧区间：CurrentFrame = round(Lerp(12,21,punchInterpolant))
    lerpLo: 10,                // punchInterpolant = GetLerpValue(10, LIMIT*2, ...)
    muzzle: 74,                // 出招点 = Center + UnitX*74*direction (L344)
    projType: 'fist',
    projSpeed: 15,             // DirectionTo(Target) * 15f (L349)，原生 px/tick
    scatterAng: 0.55,          // Phase2 双拳 RotatedBy(±0.55)（兄弟存活时；单身时 0.48）(L354-355)
    scatterOff: 74,            // 双发时的出招点偏移（沿旋转后方向）
    dustColor: [255, 0, 127],  // Color.Lerp(Red, Magenta, 0.5f) (L269)
  },
  catastrophe: {
    sheet:  'textures/sepulcher/SupremeCatastrophe.png',
    glow:   'textures/sepulcher/SupremeCatastropheGlow.png',
    cols: 2, rows: 8, fw: 400, fh: 230,
    idleFrames: 6,             // 常规漂浮帧数（0~5）
    glowColor: 'cyan',         // 亮纹基调：青/蓝
    side: 'right',
    DISP_RATIO: 0.330,         // 显示高度 = 短边 * 此比例（2× 放大）
    EDGE_GAP: 0.03,            // 贴图内容与屏幕左/右缘的空隙 = 短边 * 此比例
    cl: 118, cr: 338,          // 实测非透明内容在帧内的左/右边界(px)，用于锚点避免出屏
    // —— 攻击参数（严格取自 SupremeCatastrophe.cs）——
    atk0: 6, atk1: 15,         // 攻击帧区间：CurrentFrame = round(Lerp(6,15,slashInterpolant))
    lerpLo: 0,                 // slashInterpolant = GetLerpValue(0, LIMIT*2, ...)
    muzzle: 125,               // 出招点 = Center + UnitX*125*direction (L384)
    projType: 'slash',
    projSpeed: 8,              // DirectionTo(Target) * 8f (L405)，原生 px/tick
    scatterAng: 0.34,          // 双斩 RotatedBy(±0.34) (L306-307)
    scatterOff: 130,           // 双斩出招点 = Center + DirectionTo.RotatedBy(±0.34)*130 (L306-307)
    dustColor: [0, 255, 255],  // Color.Cyan (L262)
  },
};

// —— 攻击时序（按一次键 = 一整段编排：蓄力 → 连射(先单后双) → 收招）——
const ATK = {
  WINDUP: 1.0,     // 蓄力/悬停 60 帧（对应 C# AttackDelayTimer 0→120 的悬停段）
  BURST: 2.0,      // 连射 120 帧；前 50% 单发，后 50% 双发散射
  COOLDOWN: 0.5,   // 收招 30 帧（攻击帧回摆到起始）
};
const COUNTER_LIMIT = 50;      // C# PunchCounterLimit / SlashCounterLimit = 50
const FIRE_RATE = 2.0;         // C# fireRate = Lerp(1.5f, 2f, ...)，两兄弟同在取满速
const SCATTER_ROUND2 = true;   // 后半段改双发散射（对应 C# Phase2 双拳/双斩）；设 false 则全程单发
const HOVER_RISE = 0.03;       // 进入攻击时略微上飘 = 短边 * 此比例（"抬手蓄力"感）

// —— 退场（再按召唤键）：原贴图渐隐 → 亮纹(Glow)渐隐 ——
const EXIT_SHEET = 0.6;        // 本体贴图渐隐时长(s)
const EXIT_GLOW  = 0.9;        // 亮纹渐隐时长(s)，接续在贴图之后

// —— 蓄力尘埃（RainbowTorch，11×31 = 3 帧 11×10）——
const DUST = {
  sheet: 'textures/sepulcher/RainbowTorch.png',
  fw: 11, fh: 10, frames: 3,
};
let dustImg = null;

// —— 漂浮 / 惯性参数 ——
const SPRING_Y = 34;     // Y 弹簧刚度（越大越跟手）
const DAMP_Y   = 0.86;   // Y 速度阻尼（每 1/60s 保留比；越小越快停）
const BOB_FREQ = 1.8;    // 悬浮摆角频率 (rad/s)
const BOB_AMP_Y = 0.035; // 悬浮纵向摆幅 = 屏幕短边 * 此比例
const BOB_AMP_X = 0.012; // 悬浮横向微摆 = 屏幕短边 * 此比例

function makeBrother(type) {
  const cfg = BROS[type];
  const shortSide = Math.min(W, H);
  const disp = shortSide * cfg.DISP_RATIO;     // 显示高度(px)
  const sc = disp / cfg.fh;                    // 单帧缩放
  return {
    type,
    cfg,
    x: 0, y: 0, vx: 0, vy: 0,
    disp, sc,
    dw: cfg.fw * sc, dh: disp,
    currentFrame: 0,
    frameCounter: 0,
    facing: 1,            // 1=不翻转(贴图自然朝左), -1=水平翻转(朝右)
    alive: 1,
    size: 0,              // 出场生长(0→1)
    vy: 0,                // Y 速度（弹簧惯性用）
    bobPhase: Math.random() * Math.PI * 2,  // 悬浮摆相位（每只错开）
    yTarget: 0,
    // —— 攻击态 ——
    attackCounter: 0,     // 对应 C# PunchCounter / SlashCounter（0→50 触发一次出招）
    attackAlt: false,     // 对应 C# PunchingFromRight / SlashingFromRight（左右手交替）
    hovering: false,      // 攻击中：冻结 Y 目标为 hoverY，不再追鼠标
    hoverY: 0,
    frameInterp: 0,       // 当前攻击帧插值（收招时从此值回摆到 0）
    sheetAlpha: 1,        // 退场用：本体贴图不透明度（1=全显 → 0=隐）
    glowAlpha: 1,         // 退场用：亮纹不透明度（1=全显 → 0=隐）
    imgs: { sheet: null, glow: null },
  };
}

// X 锚点：按「实测非透明内容半宽」推算，保证放大后内容完整留在屏内。
// 取 max(左半宽, 右半宽) 以兼容水平翻转（翻转后内容的左右半宽互换）。
function anchorX(cfg, sc) {
  const half = Math.max(cfg.fw / 2 - cfg.cl, cfg.cr - cfg.fw / 2) * sc;
  const gap = Math.min(W, H) * cfg.EDGE_GAP;
  return (cfg.side === 'left') ? (gap + half) : (W - gap - half);
}

// 懒加载两套兄弟贴图
let loaded = false;
function ensureImgs() {
  if (loaded) return;
  for (const t of ['cataclysm', 'catastrophe']) {
    const mk = (src) => { const i = new Image(); i.src = src; return i; };
    const c = BROS[t];
    if (!c._sheet) c._sheet = mk(c.sheet);
    if (!c._glow)  c._glow  = mk(c.glow);
  }
  if (!dustImg) { dustImg = new Image(); dustImg.src = DUST.sheet; }
  loaded = true;
}

export const supremeBrothers = {
  list: [],           // Brother 实例数组
  active: false,
  dust: [],           // 蓄力/出招尘埃（RainbowTorch）
  // 攻击状态机：windup(蓄力悬停) → burst(连射：前单发后双散) → cooldown(收招) → idle
  attack: { active: false, phase: 'idle', t: 0 },
  // 退场状态机：sheet(原贴图渐隐) → glow(亮纹渐隐) → 完成清场
  exit: { active: false, phase: 'idle', t: 0 },

  // 召唤：左 Cataclysm + 右 Catastrophe
  summon() {
    ensureImgs();
    const y0 = H / 2;
    const bL = makeBrother('cataclysm');
    bL.x = anchorX(bL.cfg, bL.sc); bL.y = y0;          // 左侧锚点
    const bR = makeBrother('catastrophe');
    bR.x = anchorX(bR.cfg, bR.sc); bR.y = y0;          // 右侧锚点
    bR.facing = 1;    // 右侧兄弟初始朝左(不翻转=自然朝左)；update 每帧按鼠标重算
    this.list = [bL, bR];
    this.active = true;
  },

  clear() {
    this.list.length = 0;
    this.active = false;
    this.dust.length = 0;
    this.attack.active = false; this.attack.phase = 'idle'; this.attack.t = 0;
    this.exit.active = false; this.exit.phase = 'idle'; this.exit.t = 0;
    brotherProjectiles.clear();
  },

  // —— 攻击释放条件：两兄弟都在场且已完成出场生长，且当前不在攻击中 ——
  canAttack() {
    return this.active
      && this.list.length === 2
      && !this.attack.active
      && this.list.every(b => b.size >= 1);
  },

  // 触发「两兄弟同时攻击」：锁定悬停高度，重置射击计数
  triggerAttack() {
    if (!this.canAttack()) return false;
    const a = this.attack;
    a.active = true; a.phase = 'windup'; a.t = 0;
    const shortSide = Math.min(W, H);
    for (const b of this.list) {
      b.hovering = true;
      b.hoverY = b.y - shortSide * HOVER_RISE;   // 冻结在当前高度并略上飘
      b.attackCounter = 0;
      b.attackAlt = false;
      b.frameInterp = 0;
    }
    return true;
  },

  // 退场资格：两兄弟都在场、已完成出场生长、且当前未在退场中
  exitable() {
    return this.active
      && !this.exit.active
      && this.list.length === 2
      && this.list.every(b => b.size >= 1);
  },

  // 触发退场：取消进行中的攻击，进入「原贴图渐隐 → 亮纹渐隐」两段式淡出
  startExit() {
    if (!this.exitable()) return false;
    this.attack.active = false; this.attack.phase = 'idle'; this.attack.t = 0;
    this.exit.active = true; this.exit.phase = 'sheet'; this.exit.t = 0;
    for (const b of this.list) { b.sheetAlpha = 1; b.glowAlpha = 1; }
    return true;
  },

  // 退场完成：复位兄弟本体状态（列表清空、active=false，draw 不再绘制本体）。
  // 注意：不调用 brotherProjectiles.clear()，让已发射的拳/斩把飞行残留继续播完；
  // 残留会在下一次 summon 的 triggerCast→clear() 中统一清理。
  finishExit() {
    this.exit.active = false; this.exit.phase = 'idle'; this.exit.t = 0;
    this.list.length = 0;
    this.active = false;
    this.dust.length = 0;
    this.attack.active = false; this.attack.phase = 'idle'; this.attack.t = 0;
  },

  // 一次出招：Round1 单发直击 / Round2 双发散射（对应 C# Phase2 双拳 ±0.55 / 双斩 ±0.34）
  fire(b) {
    const c = b.cfg;
    const a = this.attack;
    const ang = Math.atan2(mouse.y - b.y, mouse.x - b.x);
    const dirSign = (mouse.x > b.x) ? 1 : -1;              // 对应 C# NPC.direction
    const spd = c.projSpeed * 60 * b.sc;                   // 原生 px/tick → px/s（按世界缩放）
    // 后半段进入双发散射（Round 2）
    const round2 = SCATTER_ROUND2 && (a.t >= ATK.BURST * 0.5);

    if (!round2) {
      // 单发：出招点 = 中心 + UnitX * muzzle * direction（C# fistSpawnPosition / slashSpawnPosition）
      const px = b.x + c.muzzle * b.sc * dirSign;
      brotherProjectiles.spawn(c.projType, px, b.y, ang, spd, b.sc, b.attackAlt);
      this.spawnFireDust(b, px, b.y, 8);
    } else {
      // 双发散射：出招点沿「旋转后的方向」偏移 scatterOff，方向亦为旋转后角度
      // （严格对应 C# L306-307：Center + DirectionTo.RotatedBy(±0.34)*130，速度同向）
      for (const s of [1, -1]) {
        const a2 = ang + c.scatterAng * s;
        const px = b.x + Math.cos(a2) * c.scatterOff * b.sc;
        const py = b.y + Math.sin(a2) * c.scatterOff * b.sc;
        brotherProjectiles.spawn(c.projType, px, py, a2, spd, b.sc, s > 0);
        this.spawnFireDust(b, px, py, 6);
      }
    }
  },

  // 出招瞬间的尘埃小爆（枪口焰）
  spawnFireDust(b, x, y, n) {
    const c = b.cfg;
    const shortSide = Math.min(W, H);
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2;
      const sv = shortSide * (0.06 + Math.random() * 0.20);
      this.dust.push({
        x, y,
        vx: Math.cos(a) * sv, vy: Math.sin(a) * sv,
        life: 0.30 + Math.random() * 0.25, maxLife: 0.55,
        scale: (0.7 + Math.random() * 0.6) * b.sc * 1.6,
        frame: (Math.random() * DUST.frames) | 0,
        col: c.dustColor,
      });
    }
    if (this.dust.length > 420) this.dust.splice(0, this.dust.length - 420);
  },

  // 蓄力尘埃：绕身体一圈向内汇聚（能量积聚感）
  // 对应 C# L264-270：6 个 RainbowTorch dust，NextVector2Circular(w,h)，scale 0.7~1.3，按类型着色
  spawnWindupDust(b, intensity) {
    const c = b.cfg;
    const n = 1 + Math.floor(5 * intensity);      // 1→6 个（越接近爆发越多）
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2;
      const r = (0.55 + Math.random() * 0.65) * b.dh * 0.5;
      const px = b.x + Math.cos(a) * r;
      const py = b.y + Math.sin(a) * r;
      const inward = 0.9 + Math.random() * 1.6;   // 向内汇聚速度系数
      this.dust.push({
        x: px, y: py,
        vx: -Math.cos(a) * r * inward, vy: -Math.sin(a) * r * inward,
        life: 0.28 + Math.random() * 0.22, maxLife: 0.50,
        scale: (0.7 + Math.random() * 0.6) * b.sc * 1.5,   // C# scale 0.7~1.3
        frame: (Math.random() * DUST.frames) | 0,
        col: c.dustColor,
      });
    }
    if (this.dust.length > 420) this.dust.splice(0, this.dust.length - 420);
  },

  updateDust(dt) {
    if (!this.dust.length) return;
    const dtC = Math.min(dt, 1 / 30);
    for (let i = this.dust.length - 1; i >= 0; i--) {
      const d = this.dust[i];
      d.x += d.vx * dtC; d.y += d.vy * dtC;
      d.vx *= 0.90; d.vy *= 0.90;               // noGravity + 阻尼
      d.life -= dtC;
      if (d.life <= 0) this.dust.splice(i, 1);
    }
  },

  drawDust(ctx) {
    if (!this.dust.length || !dustImg || !dustImg.complete || dustImg.naturalWidth === 0) return;
    ctx.save();
    ctx.imageSmoothingEnabled = false;
    ctx.globalCompositeOperation = 'lighter';
    for (const d of this.dust) {
      const t = Math.max(0, d.life / d.maxLife);
      const s = d.scale * (0.5 + 0.5 * t) * 3;       // 显示尺寸（dust 贴图很小，需放大）
      ctx.globalAlpha = t;
      // RainbowTorch 是灰白贴图 → 先叠色块再用贴图做遮罩代价高，这里直接用 lighter 叠贴图 +
      // 同位置叠一层类型色，得到"带色尘埃"的观感
      ctx.drawImage(dustImg, 0, d.frame * DUST.fh, DUST.fw, DUST.fh, d.x - s / 2, d.y - s / 2, s, s);
      ctx.globalAlpha = t * 0.75;
      ctx.fillStyle = `rgb(${d.col[0]},${d.col[1]},${d.col[2]})`;
      ctx.beginPath(); ctx.arc(d.x, d.y, s * 0.30, 0, Math.PI * 2); ctx.fill();
    }
    ctx.restore();
  },

  // 兄弟出场点（屏幕左右两侧锚点，垂直取屏幕中线）——供施法爆炸三阶段定位
  sidePos(type) {
    const c = BROS[type];
    const shortSide = Math.min(W, H);
    const disp = shortSide * c.DISP_RATIO;
    const sc = disp / c.fh;
    return { x: anchorX(c, sc), y: H / 2 };
  },

  update(dt) {
    // 投射物/尘埃独立推进（即使兄弟已消失也要让残留飞完）
    brotherProjectiles.update(dt);
    this.updateDust(dt);

    if (!this.active) return;
    ensureImgs();
    const shortSide = Math.min(W, H);

    // —— 攻击状态机推进：windup → burst → cooldown → idle ——
    const atk = this.attack;
    if (atk.active) {
      atk.t += dt;
      if (atk.phase === 'windup' && atk.t >= ATK.WINDUP) {
        atk.phase = 'burst'; atk.t = 0;
        // 进入连射立刻打出第一发（counter 预置到上限）
        for (const b of this.list) b.attackCounter = COUNTER_LIMIT;
      } else if (atk.phase === 'burst' && atk.t >= ATK.BURST) {
        atk.phase = 'cooldown'; atk.t = 0;
      } else if (atk.phase === 'cooldown' && atk.t >= ATK.COOLDOWN) {
        atk.active = false; atk.phase = 'idle'; atk.t = 0;
        // 收招结束：解除悬停冻结 → Y 目标切回鼠标，弹簧平滑漂回
        for (const b of this.list) {
          b.hovering = false;
          b.currentFrame = 0; b.frameCounter = 0; b.frameInterp = 0;
        }
      }
    }

    // —— 退场状态机推进：sheet(原贴图渐隐) → glow(亮纹渐隐) ——
    // 退场期间冻结位移（不再追鼠标、不再弹簧归位），仅原地淡出
    if (this.exit.active) {
      this.exit.t += dt;
      if (this.exit.phase === 'sheet') {
        const k = Math.min(1, this.exit.t / EXIT_SHEET);
        for (const b of this.list) b.sheetAlpha = 1 - k;
        if (this.exit.t >= EXIT_SHEET) { this.exit.phase = 'glow'; this.exit.t = 0; }
      } else { // glow
        const k = Math.min(1, this.exit.t / EXIT_GLOW);
        for (const b of this.list) b.glowAlpha = 1 - k;
        if (this.exit.t >= EXIT_GLOW) { this.finishExit(); }
      }
    }

    for (const b of this.list) {
      const c = b.cfg;
      // 出场生长
      if (b.size < 1) b.size = Math.min(1, b.size + 0.12);

      const attacking = atk.active;

      if (!attacking || atk.phase === 'windup') {
        // —— 常规漂浮动画（与 C# 一致：frameCounter+=0.15，>=1 推进一帧）——
        // 对应 C# AttackDelayTimer < 120 分支：蓄力悬停期间仍走 idle 帧
        b.frameCounter += 0.15;
        if (b.frameCounter >= 1) {
          b.currentFrame = (b.currentFrame + 1) % c.idleFrames;
          b.frameCounter = 0;
        }
        // 蓄力尘埃：越接近爆发越密（RainbowTorch，按类型着色）
        if (attacking) this.spawnWindupDust(b, Math.min(1, atk.t / ATK.WINDUP));
      } else if (atk.phase === 'burst') {
        // —— 射击节拍：counter += fireRate（每 tick），达到 LIMIT 出一招并左右手交替 ——
        b.attackCounter += FIRE_RATE * Math.min(dt, 1 / 30) * 60;
        if (b.attackCounter >= COUNTER_LIMIT) {
          b.attackCounter -= COUNTER_LIMIT;
          this.fire(b);
          b.attackAlt = !b.attackAlt;      // 对应 C# PunchingFromRight = !PunchingFromRight
        }
        // —— 攻击帧插值（严格对应 C# punchInterpolant / slashInterpolant）——
        // value = counter + (alt ? 0 : LIMIT)，在两次出招间把帧从 atk0 扫到 atk1
        const val = b.attackCounter + (b.attackAlt ? 0 : COUNTER_LIMIT);
        const span = COUNTER_LIMIT * 2 - c.lerpLo;
        b.frameInterp = Math.max(0, Math.min(1, (val - c.lerpLo) / span));
        b.currentFrame = Math.round(c.atk0 + (c.atk1 - c.atk0) * b.frameInterp);
      } else {
        // —— 收招：攻击帧从当前插值回摆到起点（不再发射）——
        const k = Math.max(0, 1 - atk.t / ATK.COOLDOWN);
        b.currentFrame = Math.round(c.atk0 + (c.atk1 - c.atk0) * b.frameInterp * k);
      }

      // —— X 锚定屏幕左/右缘（固定，不随鼠标 X；draw 再叠极小横向微摆）——
      const xAnchor = anchorX(c, b.sc);

      // 退场期间冻结位移与朝向：兄弟在原地淡出，不再追随鼠标/弹簧移动
      if (!this.exit.active) {
        // —— Y：跟随鼠标 Y，但用「弹簧 + 阻尼」产生惯性与过冲（非刚性平移）——
        // 攻击期间 hovering=true → 目标锁为 hoverY（悬停不追鼠标），收招结束才恢复跟随
        // 2× 放大后 dh 变大，额外内边距收窄至 0.015 以保住纵向跟随幅度（仍不裁切贴图）
        const margin = b.dh * 0.5 + shortSide * 0.015;
        const yMin = margin, yMax = H - margin;
        const yGoal = b.hovering ? b.hoverY : mouse.y;
        const yT = Math.max(yMin, Math.min(yMax, yGoal));

        // 半隐式欧拉弹簧：加速度 ∝ (目标-当前)，速度带阻尼 → 鼠标快速移动时滞后+过冲=速度感
        const dtC = Math.min(dt, 1 / 30);                 // 钳制 dt 防数值爆炸
        b.vy += (yT - b.y) * SPRING_Y * dtC;
        b.vy *= Math.pow(DAMP_Y, dtC * 60);
        const vmax = shortSide * 6;                        // 速度上限，避免极端跳变
        if (b.vy > vmax) b.vy = vmax; else if (b.vy < -vmax) b.vy = -vmax;
        b.y += b.vy * dtC;

        // X 仅做极轻弹簧归位（保持锚定侧边）
        b.x += (xAnchor - b.x) * Math.min(1, 10 * dtC);

        // —— 朝向：面朝鼠标（贴图自然朝左，鼠标在右侧时翻转成朝右）——
        // 对应 C# SupremeCataclysm.cs: spriteDirection==1(目标在右) 才 FlipHorizontally
        b.facing = (mouse.x > b.x) ? -1 : 1;   // -1=翻转(朝右), 1=不翻转(朝左)
      }
    }
  },

  draw(ctx, animTime) {
    // 兄弟本体（active 时才画）；尘埃与投射物在末尾无条件绘制，
    // 这样兄弟消失后已发射的拳/斩仍能把飞行残留播完。
    if (this.active) this.drawBodies(ctx, animTime);
    this.drawDust(ctx);
    brotherProjectiles.draw(ctx);
  },

  drawBodies(ctx, animTime) {
    for (const b of this.list) {
      const c = b.cfg;
      const sheet = c._sheet, glow = c._glow;
      if (!sheet || !sheet.complete || sheet.naturalWidth === 0) continue;
      // 帧坐标（参照 C#：xFrame=floor(f/rows), yFrame=f%rows）
      const xFrame = Math.floor(b.currentFrame / c.rows);
      const yFrame = b.currentFrame % c.rows;
      const sx = xFrame * c.fw;
      const sy = yFrame * c.fh;

      const disp = b.disp * b.size;
      const dw = b.dw * b.size;
      const dh = b.dh * b.size;
      // 悬浮摆动：纵向正弦 + 极小横向微摆（相位每只错开），消除"平移感"、制造漂浮惯性
      const shortSide = Math.min(W, H);
      const bobY = Math.sin(animTime * BOB_FREQ + b.bobPhase) * (shortSide * BOB_AMP_Y);
      const bobX = Math.sin(animTime * BOB_FREQ * 0.8 + b.bobPhase) * (shortSide * BOB_AMP_X);
      const cx = b.x + bobX, cy = b.y + bobY;

      ctx.save();
      ctx.imageSmoothingEnabled = false;     // 像素锐利

      // 水平翻转：facing=-1 → 朝左翻转
      const flip = b.facing === -1;
      if (flip) {
        ctx.translate(cx, cy);
        ctx.scale(-1, 1);
        ctx.translate(-cx, -cy);
      }

      // —— 本体（退场时按 sheetAlpha 渐隐）——
      ctx.globalAlpha = b.sheetAlpha;
      ctx.drawImage(sheet, sx, sy, c.fw, c.fh, cx - dw / 2, cy - dh / 2, dw, dh);
      ctx.globalAlpha = 1;

      // —— 亮纹(Glow)叠加：lighter 混合；Glow 贴图已按类型预着色 ——
      // 退场第二阶段按 glowAlpha 渐隐（在原贴图已隐去之后）
      if (glow && glow.complete && glow.naturalWidth > 0) {
        ctx.globalCompositeOperation = 'lighter';
        ctx.globalAlpha = 0.95 * b.glowAlpha;
        ctx.drawImage(glow, sx, sy, c.fw, c.fh, cx - dw / 2, cy - dh / 2, dw, dh);
        ctx.globalAlpha = 1;
        ctx.globalCompositeOperation = 'source-over';
      }
      ctx.restore();
    }
  },
};
