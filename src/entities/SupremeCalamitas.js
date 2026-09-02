// ===== entities/SupremeCalamitas.js =====
// 「至尊灾厄」跟随从者（墓穴魔场景专属）
//  - 状态0：默认漂浮（第 0~5 帧行）
//  - 状态2：冲刺（第 6~11 帧行，按数字键 2 释放，方向朝鼠标）
//  - 默认兜帽形态，P 键切换兜帽/无兜帽（toggleForm）
//  - 以 sepulcher 头部为圆心、半径 R 圆内惯性漂浮
//  - 目标点始终在「sepulcher 运动方向的正前方」（先于头部飞出最前）
//  - 用强弹簧 + 低阻尼产生「刹不住车」的惯性与过冲：速度更快、过冲可暂时出圈，
//    再由指圆心恢复力自然拉回，稳定时稳落回圈内、且位于运动方向最前方
//  - 骷髅护盾（Top 上颚 + Bottom 下颚）随朝向旋转，冲刺时下颚张开约 40°

import { W, H, segments, mouse } from '../core/globals.js';
import { supremeShield } from './SupremeShield.js';
import { supremeBrothers } from './SupremeBrothers.js';

const HOOD_SHEET = 'textures/sepulcher/SupremeCalamitasHooded.png'; // 兜帽（默认）
const NUDE_SHEET = 'textures/sepulcher/SupremeCalamitas.png';       // 无兜帽
const FIREDUST   = 'textures/sepulcher/Firedust.png';                // 火焰尾迹粒子贴图
const BLAST_SHEET = 'textures/sepulcher/SCalBrimstoneGigablast.png'; // 巨型火球弹幕精灵图（6 帧）
const BRIM_SHEET = 'textures/sepulcher/BrimstoneFlame.png';          // Debris.Brimstone 火焰小尘
const SMOKE_SHEET = 'textures/sepulcher/smoke.png';                  // Dust.Smoke 灰烟
const TEX = {                                                       // 召唤兄弟粒子贴图
  glow:   'textures/sepulcher/GlowOrbParticle.png',   // 光带发光粒子
  star:   'textures/sepulcher/StarProj.png',          // 火花
  bloom:  'textures/sepulcher/BloomCircle.png',       // 绽放光晕
  silver: 'textures/sepulcher/silverflame.png',       // 银焰尘埃
};
const FRAME_W = 60;        // 单帧宽度（精灵图每列宽 60px）
const FRAMES  = 6;         // 每个姿态 6 帧
// 姿态 → 帧索引段（帧 g 按「列垂直排布」：先填满第 0 列 21 帧，再第 1 列）
//   列 = floor(g/21)、列内垂直位 = g%21 → 漂浮=第0列0~5、冲刺=第0列6~11、施法=第0列12~17
const FRAME_BASE = { idle: 0, dash: 6, cast: 12, blast: 18 };  // 漂浮0~5 / 冲刺6~11 / 施法12~17 / BlastCast18~23
const FRAME_T = 0.12;      // 每帧时长(s)（漂浮）
const DASH_FRAME_T = 0.09; // 冲刺帧速（0.2f 快于漂浮 0.15f → 更快切换）
const CAST_FRAME_T = 0.15; // 施法帧速（FrameChangeSpeed=0.15f）
const BLAST_ANIM_T = 0.135; // BlastCast 帧速（0.175f 比默认更快）
const FH = { hooded: 62, naked: 60 };   // 对应像素扫描出的帧高

const PARAMS = {
  TGT_DIST_RATIO: 0.90,  // 目标点距离 = R * 此比例（R 已扩到0.42→实际落在更远的圈内）
  DIR_STOP: 14.0,         // 直线逼近系数：距锚点越远速度越大（远快近停，无过冲=不绕圈）
  DIR_ACCEL: 12.0,        // 速度逼近锚点方向的快慢（越大越跟手、越直线）
  TURN_ANG: 0.5,          // 直线航段死区角(rad)：头部朝向与当前航向偏差小于此时不折转（避免小弧抖动）
  TURN_RATE: 3.5,         // 折转速率(rad/s)：超过死区后以固定角速度线性折转到新航向（折线而非弧）
  MV_MIN: 4.0,            // 移动判定阈值(px，暂用于复位/位移检测)
  ABOVE_RATIO: 0.30,      // 锚点距 sepulcher 头部上方的距离 = 屏幕短边 * 此比例
  ABOVE_STOP: 14.0,       // 直线逼近系数：距锚点越远速度越大（远快近停，无过冲=不绕圈）
  ABOVE_ACCEL: 12.0,      // 速度逼近锚点方向的快慢（越大越跟手、越直线）
  R_RATIO: 0.42,          // 以 sepulcher 头部为圆心的活动范围 = 屏幕短边 * 此比例
  DISP_RATIO: 0.115,      // 显示高度 = 屏幕短边 * 此比例
  MAX_SPD_RATIO: 1.8,     // 最大速度 = 屏幕短边 * 此比例（常规飞行更快）
  SHIELD_DIAM_RATIO: 3.1, // 能量护盾直径 = DISP * 此比例（再放大力场）
  SKULL_LEAD_RATIO: 0.30, // 冲刺骷髅盾向身前偏移距离 = 力场直径 * 此比例（收近）
  JAW_CHARGE_SWING: 0.35, // 蓄力(即将冲刺)时下颚张合的幅度色度

  // —— 冲刺（状态2，按 2 释放，方向朝鼠标）——
  DASH_DUR: 1.17,        // 冲刺总时长 70 帧 ≈ 1.17s
  DASH_FAST: 0.40,       // 高速飞行段（2~25 帧，约 0.4s）
  DASH_SPD_RATIO: 3.6,   // 冲刺极速 = 屏幕短边 * 此比例（更快）
  JAW_OPEN: 0.85,        // 冲刺时下颚大幅张开（正值→下颚向下张开，明显）
  FIREDUST_SCALE: 0.028, // 火焰粒子显示尺寸 = 屏幕短边 * 此比例（再缩小）

  // —— 召唤兄弟（状态3，按 3 释放，150 帧 = 2.5s 施法）——
  CAST_DUR: 2.5,          // 施法总时长(s)，对应 150 帧
  CAST_PHASE1: 0.75,      // 起手：150~105 帧，双手发光无光带
  CAST_PHASE2: 1.50,      // 延伸：105~60 帧，CatmullRom 光带布满发光粒子
  CAST_PHASE3: 2.50,      // 爆发：60~0 帧，Bloom光晕 + 火花尘埃；0 帧生成兄弟
  BROS_DIST_RATIO: 0.13,  // 兄弟生成点距至尊灾厄 = 屏幕短边 * 此比例（约 500px 参考）
  BROS_SIZE_RATIO: 0.14,  // 兄弟占位显示尺寸 = 屏幕短边 * 此比例

  // —— BlastCast 巨型火球（状态：按 5 释放，向鼠标发射爆炸火球）——
  BLAST_SPD_RATIO: 2.2,   // 火球初速 = 屏幕短边 * 此比例（放慢，肉眼可追踪）
  BLAST_SIZE_RATIO: 0.16, // 火球显示尺寸 = 屏幕短边 * 此比例（放大清晰可见）
  BLAST_REACH_RATIO: 0.85, // 火球目标射程 = 屏幕短边 * 此比例（朝瞄准方向直线飞行后爆炸）
  BLAST_LIFE: 2.0,        // 飞行存在时长 2s
  BLAST_EXPLODE_DUR: 0.62, // 抵达后爆炸续场时长(s)：紫爆更早（约0.3s），压缩滞留
  BLAST_HAND_OFFSET: 0.30,// 发射手部位置相对本体的偏移比例

  // —— 分裂小火球（BrimstoneBarrage，OnKill 生成）——
  BARR_COUNT: 20,         // 数量（原版根据难度 20~44，取 20）
  BARR_SPD_RATIO: 0.30,   // 初速 = 屏幕短边 * 此比例（≈原版 6.5 px/帧）
  BARR_LIFE: 1.8,         // 小火球存活时长(s)，继续追踪鼠标并带尾迹
  BARR_SIZE_RATIO: 0.05,  // 小火球尺寸 = 屏幕短边 * 此比例
};
const BLAST_FRAME_H = 82;  // 巨型火球精灵图单帧高（52×492，6帧）
const BLAST_FRAMES  = 6;   // 帧数

const BAR_SHEET = 'textures/sepulcher/BrimstoneBarrage.png';       // 分裂小火球贴图（18×176，4 动画帧）
// 4 帧：非透明块之间以横向间隙分隔，底部 6 行空白填充；各帧高度不同，按各自裁剪区绘制
const BAR_FRAMES = [{ y: 0, h: 42 }, { y: 44, h: 30 }, { y: 84, h: 38 }, { y: 134, h: 36 }];
const BAR_FRAME_T = 0.08;  // 小火球动画每帧时长(s)

export const supremeCal = {
  hooded: true,
  imgs: { hooded: null, naked: null },
  firedust: null,          // 火焰贴图
  tex: { glow: null, star: null, bloom: null, silver: null, barrage: null, brim: null, smoke: null }, // 兄弟/BrimstoneBarrage/Dust 贴图
  tintCache: {},        // 滤镜烘焙缓存：每种 (tex,filter) 组合只烘焙一次离屏贴图，杜绝每粒子每帧设昂贵的 ctx.filter
  blast: null,           // 巨型火球弹幕精灵图
  x: 0, y: 0, vx: 0, vy: 0,
  prevC: null,          // 上一帧 sepulcher 头部位置（用于算运动方向）
  dirX: 0, dirY: -1,    // 平滑后的运动方向（默认朝上）
  alive: false,
  R: 0, R_TGT: 0, MAX_SPD: 0, DISP: 0,
  shieldOn: false,
  dashCounter: 0,        // 拖尾生成计数器（螺旋节拍）
  // —— 冲刺状态 ——
  dash: false, dashT: 0, dashDur: 0, dashDir: 0,
  willCharge: false,     // 蓄力标记（按2后下一帧冲刺前下颚快速张合）
  particles: [],
  // —— 召唤兄弟（状态3）——
  casting: false, castT: 0, castDur: 0, castDone: false,
  castFly: false, castFlyVX: 0, castFlyVY: 0,   // 先飞向屏幕中心阶段
  castBloom: false,                     // 绽放光晕(爆发初)已放置标志
  castBloomC: false,                    // 屏幕中心绽放光晕已放置标志(还原原版中心爆炸)
  castOrbs: [],          // CatmullRom 光带上的发光粒子
  blastShots: [],        // BlastCast 巨型火球弹幕（可多个在场上）
  barrages: [],          // 火球分裂的小火球弹幕（BrimstoneBarrage）
  blasting: false,       // 本体 BlastCast 施法姿态（发射后短暂保持）
  blastAnimT: 0,         // 姿态计时（施法动作持续时长）
  // 兄弟实体改由 SupremeBrothers 模块统一管理（summon/clear/update/draw）

  // 懒加载两套贴图 + 初始化尺寸相关参数
  ensure() {
    if (!this.imgs.hooded) {
      const mk = (src) => { const i = new Image(); i.src = src; return i; };
      this.imgs.hooded = mk(HOOD_SHEET);
      this.imgs.naked  = mk(NUDE_SHEET);
      this.firedust    = mk(FIREDUST);
      this.tex.glow   = mk(TEX.glow);
      this.tex.star   = mk(TEX.star);
      this.tex.bloom  = mk(TEX.bloom);
      this.tex.silver = mk(TEX.silver);
      this.tex.barrage = mk(BAR_SHEET);
      this.tex.brim  = mk(BRIM_SHEET);
      this.tex.smoke = mk(SMOKE_SHEET);
      this.blast = mk(BLAST_SHEET);
    }
    // 无条件加载护盾贴图（骷髅盾不再依赖力场开关）
    supremeShield.init();
    this.R     = Math.min(W, H) * PARAMS.R_RATIO;   // 以 sepulcher 头部为圆心的活动半径
    this.R_TGT = this.R * PARAMS.TGT_DIST_RATIO;
    this.MAX_SPD = Math.min(W, H) * PARAMS.MAX_SPD_RATIO;
    this.DISP  = Math.min(W, H) * PARAMS.DISP_RATIO;
    this.shieldDiam = this.DISP * PARAMS.SHIELD_DIAM_RATIO;
    this.fdScale = Math.min(W, H) * PARAMS.FIREDUST_SCALE;
    this.alive = true;
    if (this.lrX === undefined) { this.lrX = 0; this.lrY = -1; }
  },

  // 进入墓穴魔时复位到头部附近（朝上漂浮）
  reset(cx, cy) { this.x = cx; this.y = cy; this.vx = 0; this.vy = 0; this.dirX = 0; this.dirY = -1; this.lrX = 0; this.lrY = -1; this.mousePrev = null; this.prevC = { x: cx, y: cy }; this.dash = false; this.particles.length = 0; this.casting = false; this.castDone = false; this.castOrbs.length = 0; this.castFly = false; this.castBloom = false; this.castBloomC = false; this.castCenter = null; this.blastShots.length = 0; this.barrages.length = 0; this.blasting = false; this.blastAnimT = 0; supremeBrothers.clear(); },

  // 召唤兄弟（状态3）：先飞向屏幕正中心，落位后原地施法150帧，左右各生成一只兄弟
  triggerCast() {
    if (this.casting) return;
    this.casting = true;
    this.castFly = true;            // 先飞向屏幕中心
    this.castFlyVX = 0; this.castFlyVY = 0;
    this.castT = 0;
    this.castDur = PARAMS.CAST_DUR;
    this.castDone = false;
    this.castOrbs.length = 0;
    supremeBrothers.clear();        // 清掉上一轮兄弟
    this.castBloom = false;         // bloom 已触发放置标志
    this.castBloomC = false;        // 屏幕中心 bloom 标志
    this.vx = 0; this.vy = 0;
  },

  // 施法结束：清空光带、于左右各生成一只兄弟（左 Cataclysm / 右 Catastrophe）
  finishCast() {
    this.casting = false;
    this.castDone = true;
    supremeBrothers.summon();     // 由 SupremeBrothers 模块管理实体
    return supremeBrothers.list;
  },

  // 冲刺：方向朝鼠标位置，直线高速突进，结束后回落漂浮
  triggerDash() {
    if (this.dash) return;
    this.dash = true;
    this.dashT = 0;
    this.dashDur = PARAMS.DASH_DUR;
    // 方向 = 从至尊灾厄位置指向鼠标光标
    this.dashDir = Math.atan2(mouse.y - this.y, mouse.x - this.x);
    this.dashSpeed = 0;
    this.dashCounter = 0;
    // 尾迹起始（螺旋节拍归零）
    // 蓄力：下颚快速张合由 willCharge 触发（下颚张开用 sin 波形）
    this.willCharge = true;
  },

  // BlastCast（按 5）：从手部向鼠标发射一颗巨型火球
  triggerBlast() {
    if (!this.alive || !this.sheetReady()) return;
    // 手部位置：本体中心朝当前朝向偏移（单臂前推的方向 = dirX/dirY）
    const fx = this.dirX, fy = this.dirY;
    const hx = this.x + fx * this.DISP * PARAMS.BLAST_HAND_OFFSET;
    const hy = this.y + fy * this.DISP * PARAMS.BLAST_HAND_OFFSET;
    const ang = Math.atan2(mouse.y - hy, mouse.x - hx);
    const spd = Math.min(W, H) * PARAMS.BLAST_SPD_RATIO;

    // 发射瞬间：25 个 GlowOrb（GlowOrbParticle）向前方扇形爆发，红/紫红，寿命 9 帧 ≈ 0.15s
    for (let i = 0; i < 25; i++) {
      const va = ang + (Math.random() - 0.5) * 1.2;                    // ±0.6 rad 喷射锥
      const sp = Math.min(W, H) * (0.20 + Math.random() * 0.38);       // 速度 5~13px/帧（≈0.2~0.58×屏短边/s）
      const sv = { x: Math.cos(va) * sp, y: Math.sin(va) * sp };
      const lp = 9 / 60;
      this.particles.push({
        x: hx + sv.x * 0.03, y: hy + sv.y * 0.03,                    // 从手部中心略前散射（≈+velOffset*2）
        vx: sv.x, vy: sv.y,
        life: lp, maxLife: lp,
        size: Math.min(W, H) * (0.045 + Math.random() * 0.025),       // 缩放 0.4~0.65 量级
        tex: 'glow', spin: Math.random() * Math.PI * 2, vspin: 0, drag: 0.94,
        hue: Math.random() < 0.33 ? 'magenta' : 'red',
      });
    }
    // 辅助 Dust：Brimstone（橙火焰）向扇形喷逸 + Smoke（灰烟）缓飘
    for (let i = 0; i < 6; i++) {
      const va = ang + (Math.random() - 0.5) * 1.4;
      const sp = Math.min(W, H) * (0.08 + Math.random() * 0.13);
      const bs = Math.min(W, H) * (0.028 + Math.random() * 0.018);
      this.particles.push({
        x: hx, y: hy, vx: Math.cos(va) * sp, vy: Math.sin(va) * sp,
        life: 0.30 + Math.random() * 0.25, maxLife: 0, size: bs,
        tex: 'brim', spin: Math.random() * 6, vspin: (Math.random() - 0.5) * 4, hue: 'orange',
        drag: 0.96, decay: 0.93,
      });
      const sla = ang + (Math.random() - 0.5) * 1.0;
      const ssp = Math.min(W, H) * (0.03 + Math.random() * 0.05);
      this.particles.push({
        x: hx, y: hy, vx: Math.cos(sla) * ssp, vy: Math.sin(sla) * ssp - 12,
        life: 0.5 + Math.random() * 0.3, maxLife: 0, size: Math.min(W, H) * (0.06 + Math.random() * 0.04),
        tex: 'smoke', hue: 'silver', drag: 0.96, decay: 0.98,
      });
    }

    // 目标点：朝瞄准(鼠标)方向的固定远距（保证火球明显飞出，而非贴近角色就爆）
    const reach = Math.min(W, H) * PARAMS.BLAST_REACH_RATIO;
    this.blastShots.push({
      x: hx, y: hy,
      vx: Math.cos(ang) * spd, vy: Math.sin(ang) * spd,
      tx: hx + Math.cos(ang) * reach, ty: hy + Math.sin(ang) * reach,  // 锁定发射方向的目标点
      life: PARAMS.BLAST_LIFE, maxLife: PARAMS.BLAST_LIFE,
      frame: 0, frameT: 0, opacity: 0, withinRange: false, setLifetime: false, prevDtg: undefined,
      ang,                                      // 发射方向锁定（滞留/停稳后火球仍保持该朝向，不随速度归零右偏）
    });
    // 本体短暂进入 BlastCast 施法姿态（动画更快、紧张感；结束后回落漂浮）
    this.blasting = true;
    this.blastAnimT = 0.9;
  },

  // 火球飞行：直线飞行 + 淡入 + 抵达目标点当场迸发爆炸（不滞留成静止橙球）
  updateBlast(dt) {
    for (let i = this.blastShots.length - 1; i >= 0; i--) {
      const b = this.blastShots[i];
      b.life -= dt;
      // 帧动画：每 5 帧切一次，6 帧循环
      b.frameT += dt;
      if (b.frameT > 5 / 60) { b.frameT = 0; b.frame = (b.frame + 1) % BLAST_FRAMES; }
      // —— 飞行阶段 ——
      if (!b.withinRange) {
        b.opacity = Math.min(1, b.opacity + dt * 3);          // 淡入
        // 直线飞行（发射方向锁定，不回头追鼠标，避免出生点贴近鼠标而刹停）
        b.x += b.vx * dt; b.y += b.vy * dt;
        const dtg = Math.hypot(b.tx - b.x, b.ty - b.y);
        // 到达/越过目标点、或开始远离(最近点已过)、或超时 → 进入爆炸续场
        if (!b.setLifetime && (b.life <= 0 || dtg < 16 || (b.prevDtg !== undefined && dtg > b.prevDtg))) {
          b.setLifetime = true;
          b.withinRange = true;                       // 小火球随爆炸结束同步迸出
          b.life = PARAMS.BLAST_EXPLODE_DUR;          // 爆炸续场（光晕+烟尘）
        }
        b.prevDtg = dtg;
      }
      // —— 抵达后爆炸（原版时序，压缩滞留：减速+烟尘→紫/红/白光晕→分裂小火球）——
      if (b.withinRange) {
        const t = Math.ceil(b.life * 60);          // 剩余帧数（等效刻度，用于对齐原版事件）
        // 全段减速：每帧 velocity *= 0.9（近似到 dt 秒）
        const dec = Math.pow(0.9, dt * 60);
        b.vx *= dec; b.vy *= dec;
        b.x += b.vx * dt; b.y += b.vy * dt;
        // 每帧 2 个烟尘（Dust.Smoke / Brimstone）
        this.spawnBlastDust(b.x, b.y);
        this.spawnBlastDust(b.x, b.y);
        // 淡出：t<=26 时每帧 Opacity -= 0.05
        if (t <= 26 && b.opacity > 0) b.opacity = Math.max(0, b.opacity - 0.05 * dt * 60);
        // t<=18：火球透明度归零并停速（此刻消失），爆最大紫光晕（滞留已压缩）
        if (!b.bloomPurple && t <= 18) {
          b.bloomPurple = true; b.opacity = 0; b.vx = 0; b.vy = 0;
          this.spawnBlastExplosionBloom(b.x, b.y, 'purple', 18 / 60);
        }
        // t<=9：红色光晕
        if (!b.bloomRed && t <= 9) { b.bloomRed = true; this.spawnBlastExplosionBloom(b.x, b.y, 'red', 9 / 60); }
        // t<=5：白色光晕
        if (!b.bloomWhite && t <= 5) { b.bloomWhite = true; this.spawnBlastExplosionBloom(b.x, b.y, 'white', 5 / 60); }
        // t==0：分裂出小火球
        if (b.life <= 0) {
          this.spawnBarrageSplit(b.x, b.y);
          this.blastShots.splice(i, 1);
          continue;
        }
      }
    }
  },

  // 爆炸烟尘：Dust.Smoke(灰烟) / Dust.Brimstone(橙火星)，随机外飘
  spawnBlastDust(x, y) {
    const a = Math.random() * Math.PI * 2;
    const dr = this.DISP * (0.25 + Math.random() * 0.6);
    if (Math.random() < 0.5) {
      // 灰烟（SilverFlame 贴图 + 灰度滤镜 = 烟）
      this.particles.push({ x, y, vx: Math.cos(a) * dr, vy: Math.sin(a) * dr, life: 0.45 + Math.random() * 0.4, maxLife: 0, size: this.DISP * (0.06 + Math.random() * 0.07), tex: 'silver', spin: 0, vspin: 0, hue: 'silver', drag: 0.965, decay: 0.99 });
    } else {
      // 橙火星（星形贴图）
      this.particles.push({ x, y, vx: Math.cos(a) * dr, vy: Math.sin(a) * dr, life: 0.35 + Math.random() * 0.35, maxLife: 0, size: this.DISP * (0.10 + Math.random() * 0.14), tex: 'star', spin: Math.random() * 6, vspin: (Math.random() - 0.5) * 5, hue: 'orange', drag: 0.97, decay: 0.95 });
    }
  },

  // 三波绽放光晕（大小随生命从 0.1 膨胀到目标 scale，缓出）——最终白爆盖过整个火球
  spawnBlastExplosionBloom(x, y, kind, life) {
    this.particles.push({
      x, y, vx: 0, vy: 0, life, maxLife: life, size: 0, tex: 'bloom',
      bloomRGB: kind === 'purple' ? '210,30,160' : kind === 'red' ? '255,60,60' : '255,255,255',
      bloomScale: kind === 'purple' ? 1.0 : kind === 'red' ? 1.2 : 1.5,
      spin: 0, vspin: 0,
    });
  },

  // OnKill：分裂成 N 颗 BlimstoneBarrage 小火球，环形均布、初速快，继续追踪鼠标并带尾迹
  spawnBarrageSplit(ex, ey) {
    const n = PARAMS.BARR_COUNT;
    const spd = Math.min(W, H) * PARAMS.BARR_SPD_RATIO;
    for (let k = 0; k < n; k++) {
      const ang = (Math.PI * 2 * k) / n;
      this.barrages.push({
        x: ex, y: ey,
        vx: Math.cos(ang) * spd, vy: Math.sin(ang) * spd,
        ispd: spd, life: PARAMS.BARR_LIFE, maxLife: PARAMS.BARR_LIFE,
        animI: Math.floor(Math.random() * BAR_FRAMES.length), animT: Math.random() * BAR_FRAME_T,
        vang: ang,                                 // 外飞方向锁定，避免停稳后朝右
      });
    }
  },

  // 小火球飞行：直线扩散（不追踪），轻微减速 + 携带尾迹火花
  updateBarrage(dt) {
    for (let i = this.barrages.length - 1; i >= 0; i--) {
      const b = this.barrages[i];
      b.life -= dt;
      // 直线外飞，仅轻微阻力让它们自然慢下来落下
      b.vx *= (1 - 0.45 * dt); b.vy *= (1 - 0.45 * dt);
      b.x += b.vx * dt; b.y += b.vy * dt;
      // 帧动画推进
      b.animT += dt;
      if (b.animT > BAR_FRAME_T) { b.animT = 0; b.animI = (b.animI + 1) % BAR_FRAMES.length; }
      // 尾迹火花
      if (Math.random() < 0.5) {
        this.particles.push({ x: b.x, y: b.y, vx: -b.vx * 0.08, vy: -b.vy * 0.08, life: 0.3, maxLife: 0, size: this.DISP * (0.05 + Math.random() * 0.05), tex: 'star', spin: Math.random() * 6, vspin: (Math.random() - 0.5) * 4, hue: 'orange', drag: 0.96, decay: 0.96 });
      }
      if (b.life <= 0) this.barrages.splice(i, 1);
    }
    if (this.barrages.length > 400) this.barrages.splice(0, this.barrages.length - 400);
  },

  // 绘制小火球：用 BrimstoneBarrage 精灵图裁剪 4 帧动画，朝向飞行方向，像素锐利
  drawBarrages(ctx) {
    if (!this.barrages.length) return;
    const im = this.tex.barrage;
    if (!im || !im.complete || im.naturalWidth <= 0) return;
    const rh = Math.min(W, H) * PARAMS.BARR_SIZE_RATIO;   // 显示高度（短边 * 比例）
    ctx.save();
    ctx.imageSmoothingEnabled = false;
    ctx.globalCompositeOperation = 'lighter';
    for (const b of this.barrages) {
      const t = Math.max(0, b.life / b.maxLife);
      const f = BAR_FRAMES[(b.animI || 0) % BAR_FRAMES.length];
      const rw = rh * (18 / f.h);                          // 保持宽高比（贴图宽 18）
      ctx.save();
      ctx.globalAlpha = Math.min(1, t * 1.8);
      ctx.translate(b.x, b.y);
      ctx.rotate((b.vang !== undefined ? b.vang : Math.atan2(b.vy, b.vx)) + Math.PI / 2);    // 朝向外飞方向，尾端朝后
      ctx.drawImage(im, 0, f.y, 18, f.h, -rw / 2, -rh / 2, rw, rh);
      ctx.restore();
    }
    ctx.restore();
  },

  // 绘制巨型火球弹幕：柔和外发光 + 6帧精灵图为主体（不画实心橙色圆盘）
  drawBlasts(ctx) {
    if (!this.blastShots.length) return;
    const ok = this.blast && this.blast.complete && this.blast.naturalWidth > 0;
    ctx.save();
    ctx.imageSmoothingEnabled = false;
    for (const b of this.blastShots) {
      const disp = Math.min(W, H) * PARAMS.BLAST_SIZE_RATIO;
      const R = disp / 2;
      const a = Math.min(1, b.opacity * 1.6);
      // 柔和外发光（只有光晕，不构成实心圆盘）
      let g = ctx.createRadialGradient(b.x, b.y, 0, b.x, b.y, R * 1.5);
      g.addColorStop(0, `rgba(255,110,30,${0.32 * a})`);
      g.addColorStop(1, 'rgba(180,20,10,0)');
      ctx.fillStyle = g;
      ctx.beginPath(); ctx.arc(b.x, b.y, R * 1.5, 0, Math.PI * 2); ctx.fill();
      // 主体 = SCalBrimstoneGigablast 6 帧动画（放大清晰）；朝向锁定发射方向
      if (ok) {
        const rot = (b.ang !== undefined ? b.ang : Math.atan2(b.vy, b.vx)) + Math.PI / 2;
        const s = (disp * 2.0) / BLAST_FRAME_H;
        const dw = this.blast.naturalWidth * s;
        const dh = disp * 2.0;
        ctx.save();
        ctx.globalAlpha = a;
        ctx.translate(b.x, b.y);
        ctx.rotate(rot);
        ctx.drawImage(this.blast, 0, b.frame * BLAST_FRAME_H, this.blast.naturalWidth, BLAST_FRAME_H, -dw / 2, -dh / 2, dw, dh);
        ctx.restore();
      } else {
        // 贴图未就绪时的兜底：半透明橙色光晕（不画实心圆盘）
        g = ctx.createRadialGradient(b.x, b.y, 0, b.x, b.y, R * 0.55);
        g.addColorStop(0, `rgba(255,220,150,${0.75 * a})`);
        g.addColorStop(1, 'rgba(255,120,40,0)');
        ctx.fillStyle = g;
        ctx.beginPath(); ctx.arc(b.x, b.y, R * 0.55, 0, Math.PI * 2); ctx.fill();
      }
    }
    ctx.restore();
  },

  // —— 施法召唤兄弟的状态机（150 帧 = 2.5s，三阶段）——
  updateCast(dt, C) {
    const cxf = (this.castCenter ? this.castCenter.x : W / 2);
    const cyf = (this.castCenter ? this.castCenter.y : H / 2);

    // == 阶段0：飞向屏幕正中心 ==
    if (this.castFly) {
      const dx = cxf - this.x, dy = cyf - this.y;
      const dist = Math.hypot(dx, dy);
      if (dist > this.DISP * 0.5) {
        // 高速直线冲向屏幕中心，保留惯性（没完全到位前不施法）
        const wantSpd = Math.min(this.MAX_SPD * 0.8, dist * PARAMS.ABOVE_STOP);
        this.castFlyVX += (dx / dist * wantSpd - this.castFlyVX) * Math.min(1, PARAMS.ABOVE_ACCEL * dt);
        this.castFlyVY += (dy / dist * wantSpd - this.castFlyVY) * Math.min(1, PARAMS.ABOVE_ACCEL * dt);
        this.x += this.castFlyVX * dt; this.y += this.castFlyVY * dt;
        // 飞行时也产生尾迹火花（沿飞行方向反拖）
        if ((this.castT * 40 | 0) % 3 === 0 && Math.random() < 0.5) {
          this.particles.push(this.starPart(this.x, this.y, 0.5, -this.castFlyVX * 0.15, -this.castFlyVY * 0.15));
        }
        this.castT += dt;
        return;
      }
      // 到位：锁定屏幕中心，开始施法计数
      this.x = cxf; this.y = cyf;
      this.castFlyVX = 0; this.castFlyVY = 0;
      this.castFly = false;
      this.castT = 0;
      this.castCenter = { x: cxf, y: cyf };
      this.castOrbs.length = 0;
    }

    // 施法位置永久锚在屏幕中心（记录于 castCenter），不再跟随头部
    const scx = this.castCenter ? this.castCenter.x : cxf;
    const scy = this.castCenter ? this.castCenter.y : cyf;
    this.x = scx; this.y = scy;

    const phase = this.castT / this.castDur;          // 0→1
    const p1 = PARAMS.CAST_PHASE1 / PARAMS.CAST_DUR;  // 起手
    const p2 = PARAMS.CAST_PHASE2 / PARAMS.CAST_DUR;  // 到延伸结束
    // 朝向：保持既有的 dirX/dirY（施法时朝向看 sepulcher 头部方向）
    const fx = this.dirX, fy = this.dirY;
    const nx = -fy, ny = fx;                            // 法向
    const handSpan = this.DISP * 0.5;
    const leftHand  = { x: scx - nx * handSpan, y: scy - ny * handSpan };
    const rightHand = { x: scx + nx * handSpan, y: scy + ny * handSpan };
    // 兄弟生成点（左右两侧，水平向屏幕两侧）
    const bd = this.DISP * PARAMS.BROS_DIST_RATIO;
    const castL = { x: scx - bd, y: scy };
    const castR = { x: scx + bd, y: scy };

    // 阶段2（延伸）：延伸段生成沿 CatmullRom 样条的光带发光粒子
    if (phase >= p1 && phase < p2) {
      const t = (phase - p1) / (p2 - p1);              // 0→1
      this.castOrbs.push(this.makeOrb(this.catmull(leftHand,  castL, t), phase, leftHand, castL));
      this.castOrbs.push(this.makeOrb(this.catmull(rightHand, castR, t), phase, rightHand, castR));
    }
    // 阶段3（爆发：最后 60 帧）：能量积聚 + 绽放光晕（兄弟出场点 + 屏幕中心 双地点）
    if (phase >= p2) {
      const brosL = supremeBrothers.sidePos('cataclysm');     // 左 = Cataclysm 出场点
      const brosR = supremeBrothers.sidePos('catastrophe');   // 右 = Catastrophe 出场点
      const framesRemaining = (this.castDur - this.castT) * 60;   // ~60 → 0（对应 C# attackCastDelay）
      // —— 兄弟出场点（屏幕两侧）爆炸 ——
      if (!this.castBloom) { this.castBloom = true; this.spawnBloom(brosL, brosR); }
      this.spawnVoidSparks(brosL, brosR, framesRemaining);
      // —— 还原：屏幕中心(Supreme Calamitas 周围)的爆炸 ——
      if (!this.castBloomC) { this.castBloomC = true; this.spawnBloom(castL, castR); }
      this.spawnVoidSparks(castL, castR, framesRemaining);
    }
    // 更新光带粒子寿命
    for (let i = this.castOrbs.length - 1; i >= 0; i--) {
      const o = this.castOrbs[i];
      o.life -= dt;
      if (o.life <= 0) this.castOrbs.splice(i, 1);
    }

    this.castT += dt;
    // 结束：生成兄弟
    if (this.castT >= this.castDur) {
      this.finishCast();
      this.spawnBrotherBurst();
      this.spawnCenterBurst();   // 还原：屏幕中心高潮爆炸(围绕 Supreme Calamitas)
    }
  },

  // 射线型火花粒子（飞行/爆发共用的星星贴图粒子）
  starPart(px, py, life, vx, vy) {
    return {
      x: px, y: py, vx: vx || 0, vy: vy || 0,
      life: (life || 0.5), maxLife: (life || 0.5),
      size: this.fdScale * 1.2, tex: 'star',
      hue: Math.random() < 0.5 ? 'deepblue' : 'red', spin: Math.random() * 6, vspin: (Math.random() - 0.5) * 4,
    };
  },

  // 平滑样条：把 T 时刻的样条点作为光带位置（p0/p3 为延长控制点）
  catmull(p0, p3, t) {
    // 端点点集：p0(上方延长) → p0 → p3 → p3(下方延长)，实现 Catmull-Rom
    const A = { x: p0.x, y: p0.y - 300 };  // 上方延长控制点
    const B = p0;
    const D = p3;
    const E = { x: p3.x, y: p3.y + 300 };  // 下方延长控制点
    // Catmull-Rom 插值（t∈[0,1] 在 B→D 段）
    const t2 = t * t, t3 = t2 * t;
    return {
      x: 0.5 * ((2 * B.x) + (-A.x + D.x) * t + (2 * A.x - 5 * B.x + 4 * D.x - E.x) * t2 + (-A.x + 3 * B.x - 3 * D.x + E.x) * t3),
      y: 0.5 * ((2 * B.y) + (-A.y + D.y) * t + (2 * A.y - 5 * B.y + 4 * D.y - E.y) * t2 + (-A.y + 3 * B.y - 3 * D.y + E.y) * t3),
    };
  },

  // 单个发光粒子（GlowOrbParticle 贴图：圆形发光，尺寸随施法进度放大）
  makeOrb(pos, phase, hand, target) {
    const grow = 2.8 - phase * 0.01;          // 数值越大发光粒子越大（参考：2.8 - attackCastDelay*0.01）
    return {
      x: pos.x, y: pos.y,
      life: 0.25, size: this.DISP * 0.05 * grow,
      color: 'red',
      lifeStart: 0.25,
      tex: 'glow',
    };
  },

  // 第59帧（阶段3首帧）在兄弟出场点放置绽放光晕（BloomCircle）——每侧双光晕(一大一小)
  // 配色：左 Cataclysm=紫红(magenta) / 右 Catastrophe=深蓝(deepblue)，与其 Glow 亮纹一致
  spawnBloom(brosL, brosR) {
    for (const [pt, hue] of [[brosL, 'magenta'], [brosR, 'deepblue']]) {
      // 大光晕
      this.particles.push({ x: pt.x, y: pt.y, vx: 0, vy: 0, life: 1.0, maxLife: 1.0, size: 0, tex: 'bloom', hue, vspin: 0, spin: 0, bloomScale: 1.9 });
      // 小光晕
      this.particles.push({ x: pt.x, y: pt.y, vx: 0, vy: 0, life: 1.0, maxLife: 1.0, size: 0, tex: 'bloom', hue, vspin: 0, spin: 0, bloomScale: 1.3 });
    }
  },

  // 阶段3 能量积聚：暗色火花(VoidSpark)在兄弟出场点持续产生，越接近出现越多
  // 配色：左 Cataclysm=(紫红/红) / 右 Catastrophe=(深蓝/红)，与各自 Glow 亮纹一致
  spawnVoidSparks(brosL, brosR, framesRemaining) {
    // burnPower：60→20 帧线性 0→1；最后一瞬爆发(attackCastDelay==0 时 = 4)
    const burnPower = Math.max(0, Math.min(1, (60 - framesRemaining) / (60 - 20)));
    const burn = (framesRemaining <= 0.5) ? 4 : Math.max(0.15, burnPower);
    const n = Math.max(1, Math.floor(0.5 + 5.5 * burn));   // 约 Lerp(1,6,burn)
    const addAt = (p, hueDark, hueRed) => {
      for (let i = 0; i < n; i++) {
        const a = Math.random() * Math.PI * 2;
        const off = this.DISP * (0.15 + Math.random() * 0.5);
        const sv = this.DISP * (0.25 + Math.random() * 0.45);
        // 暗色火花：细短、向外飞散（对应 VoidSparkParticle，暗调、低透明度）
        this.particles.push({
          x: p.x + Math.cos(a) * off * 4.5, y: p.y + Math.sin(a) * off * 4.5,
          vx: -Math.cos(a) * sv, vy: -Math.sin(a) * sv,
          life: 0.22 + Math.random() * 0.22, maxLife: 0,
          size: (0.10 + Math.random() * 0.14) * this.DISP,
          tex: 'star', dark: true, spin: Math.random() * 6, vspin: (Math.random() - 0.5) * 6,
          hue: Math.random() < 0.28 ? hueDark : hueRed,
        });
        // 少量银焰尘埃（烟雾感）
        if (Math.random() < 0.35) {
          this.particles.push({
            x: p.x + Math.cos(a) * off * 4.5, y: p.y + Math.sin(a) * off * 4.5,
            vx: -Math.cos(a) * sv * 0.5, vy: -Math.sin(a) * sv * 0.5,
            life: 0.5, maxLife: 0,
            size: this.DISP * (0.04 + Math.random() * 0.04), tex: 'silver',
            spin: Math.random() * 6, vspin: 0, hue: 'silver',
          });
        }
      }
    };
    addAt(brosL, 'magenta', 'red');     // 左 = Cataclysm：紫红 / 红
    addAt(brosR, 'deepblue', 'red');    // 右 = Catastrophe：深蓝 / 红
  },

  // 施法结束爆发（高潮）：白色闪光 + 大量明亮火花(Spark) + 银焰尘埃(SilverFlame)
  // 由 spawnBurstAt 统一实现，按传入的爆点列表绘制
  spawnBrotherBurst() {
    const pts = supremeBrothers.list.map(b => ({
      x: b.x, y: b.y,
      hueSide: (b.x < this.x) ? 'magenta' : 'deepblue',   // 左 Cataclysm=紫红 / 右 Catastrophe=深蓝
    }));
    this.spawnBurstAt(pts);
  },

  // 还原：施法结束时的「屏幕中心」高潮爆炸（围绕 Supreme Calamitas）
  spawnCenterBurst() {
    const bd = this.DISP * PARAMS.BROS_DIST_RATIO;
    const cx = this.x, cy = this.y;            // 施法期间 x/y 已锚定屏幕中心
    const pts = [
      { x: cx - bd, y: cy, hueSide: 'deepblue' },   // 左
      { x: cx + bd, y: cy, hueSide: 'magenta' },    // 右
    ];
    this.spawnBurstAt(pts);
  },

  // 通用高潮爆发：在每个爆点生成白光闪光 + 42 明亮火花 + 24 银焰尘埃
  spawnBurstAt(pts) {
    for (const p of pts) {
      // —— 出场高潮闪光：一圈明亮大光晕（白色）——
      this.particles.push({ x: p.x, y: p.y, vx: 0, vy: 0, life: 0.55, maxLife: 0.55, size: 0, tex: 'bloom', hue: 'white', vspin: 0, spin: 0, bloomScale: 2.4 });
      // —— 大量明亮火花向外飞散（42 个，放慢加长：初速约 55%，寿命约 2×，衰减更柔）——
      for (let i = 0; i < 42; i++) {
        const a = Math.random() * Math.PI * 2;
        const sv = this.DISP * (0.55 + Math.random() * 0.80);
        this.particles.push({
          x: p.x, y: p.y,
          vx: Math.cos(a) * sv, vy: Math.sin(a) * sv,
          life: 1.05 + Math.random() * 0.95, maxLife: 0,
          size: (0.32 + Math.random() * 0.40) * this.DISP,
          tex: 'star', spin: Math.random() * 6, vspin: (Math.random() - 0.5) * 3,
          hue: Math.random() < 0.5 ? p.hueSide : 'red',
          drag: 0.966, decay: 0.974,
        });
      }
      // —— 银焰尘埃（SilverFlame，烟雾般弥漫）——
      for (let i = 0; i < 24; i++) {
        const a = Math.random() * Math.PI * 2;
        const sv = this.DISP * (0.09 + Math.random() * 0.30);
        this.particles.push({
          x: p.x, y: p.y,
          vx: Math.cos(a) * sv, vy: Math.sin(a) * sv,
          life: 1.35 + Math.random() * 0.95, maxLife: 0,
          size: this.DISP * (0.06 + Math.random() * 0.07), tex: 'silver',
          spin: 0, vspin: 0, hue: 'silver',
          drag: 0.972, decay: 0.980,
        });
      }
    }
    if (this.particles.length > 900) this.particles.splice(0, this.particles.length - 900);
  },

  toggleForm() { this.hooded = !this.hooded; },

  toggleShield() {
    this.shieldOn = !this.shieldOn;
    if (this.shieldOn) supremeShield.init();
    return this.shieldOn;
  },

  update(dt, C) {
    if (!this.alive || !C) return;
    supremeBrothers.update(dt);   // 兄弟常规跟随鼠标（内部有 active 守卫）
    if (!this.prevC) { this.x = C.x; this.y = C.y; this.prevC = { x: C.x, y: C.y }; return; }
    this.updateBlast(dt);   // BlastCast 巨型火球（任意时刻存活更新）
    this.updateBarrage(dt); // 分裂出的小火球
    // 阶段零：施法召唤兄弟（滞空、无敌冷冻、150帧三阶段）
    if (this.casting) {
      this.updateCast(dt, C);
      this.updateParticles(dt);
      return;
    }
    // 阶段一：推进并渲染冲刺
    if (this.dash) {
      this.dashT += dt;
      // 速度轮廓：0~0.4s 线性加速到极速；0.4~1.17s 线性减速回 0
      const fc = Math.min(1, this.dashT / PARAMS.DASH_FAST);
      const slow = Math.max(0, 1 - (this.dashT - PARAMS.DASH_FAST) / (PARAMS.DASH_DUR - PARAMS.DASH_FAST));
      const spd = 0.25 + 0.75 * fc * slow;
      this.dashSpeed = Math.min(W, H) * PARAMS.DASH_SPD_RATIO * spd;
      const s = this.dashSpeed;
      this.vx = Math.cos(this.dashDir) * s;
      this.vy = Math.sin(this.dashDir) * s;
      this.x += this.vx * dt; this.y += this.vy * dt;
      // 螺旋拖尾（节拍生成）
      this.dashCounter += dt * 30;   // ≈ 每 30 帧节拍
      this.spawnTrail();
      if (this.dashT >= this.dashDur) { this.dash = false; this.willCharge = false; } // 结束回落漂浮
      this.updateParticles(dt);
      this.prevC = { x: C.x, y: C.y };
      return;
    }
    this.updateParticles(dt);
    // BlastCast 施法姿态计时（发射弹幕间隙持续，到点恢复漂浮）
    if (this.blasting && !this.dash && !this.casting) {
      this.blastAnimT -= dt;
      if (this.blastAnimT <= 0) this.blasting = false;
    }
    {
      // —— 跟随 sepulcher 头部，锚点固定在「头部上方」 ——
      // 至尊灾厄的瞄准点始终是 sepulcher 头部正上方一个固定距离的点（不随朝向转，天然不画弧）。
      // 用临界阻尼直线逼近锚点：直线、无过冲、不绕圈；头部移动时锚点平移，至尊灾厄沿直线追。
      const atx = C.x;
      const aty = C.y - Math.min(W, H) * PARAMS.ABOVE_RATIO;   // 头部上方锚点
      const dx = atx - this.x, dy = aty - this.y;
      const dist = Math.hypot(dx, dy);
      if (dist > 0.001) {
        const ux = dx / dist, uy = dy / dist;
        const wantSpd = Math.min(this.MAX_SPD, dist * PARAMS.ABOVE_STOP);
        const kf = Math.min(1, PARAMS.ABOVE_ACCEL * dt);
        this.vx += (ux * wantSpd - this.vx) * kf;
        this.vy += (uy * wantSpd - this.vy) * kf;
      }
      this.x += this.vx * dt; this.y += this.vy * dt;
      // —— 圆范围约束：以 sepulcher 头部为圆心（超调可短暂出圈，稳定时拉回圈内）——
      const dcx = this.x - C.x, dcy = this.y - C.y;
      const dd = Math.hypot(dcx, dcy);
      if (dd > this.R && dd > 0) {
        const n = this.R / dd;
        this.x = C.x + dcx * n; this.y = C.y + dcy * n;
        const rx = dcx / dd, ry = dcy / dd;
        const vdot = this.vx * rx + this.vy * ry;
        if (vdot > 0) { this.vx -= vdot * rx; this.vy -= vdot * ry; }
      }
    }
    this.prevC = { x: C.x, y: C.y };
  },

  // isReady: 当前形态贴图已加载
  sheetReady() {
    const im = this.hooded ? this.imgs.hooded : this.imgs.naked;
    return im && im.complete && im.naturalWidth > 0;
  },

  // 生成螺旋火焰尾迹（参考 calCalamity 冲刺螺旋粒子）
  //  - 沿速度法向按 sin 波形左右两侧生成 SparkParticle（红 / 红紫）
  //  - 中央生成毁灭者尘埃（红色烟雾）
  spawnTrail(amount) {
    const spd = this.dashSpeed || this.MAX_SPD;
    // 归一化方向 + 法向（垂直）
    const ux = Math.cos(this.dashDir), uy = Math.sin(this.dashDir);
    const nx = -uy, ny = ux;
    const n = amount == null ? 1 : amount;
    // 波及范围：随冲刺强度缩放
    const L = Math.min(1, this.dashT / PARAMS.DASH_FAST);
    const scaleAmp = 0.35 + 0.75 * L;
    for (let i = 0; i < n; i++) {
      // 螺旋节拍：sine 决定两侧不对称偏移
      const beam = 10;   // 法向(垂直方向)偏移基准：小 → 收拢贴近轨迹
      const sine = 0.5 + 0.5 * Math.sin(this.dashCounter * 0.9 + (i * 0.8));
      const off = beam * scaleAmp;
      // 两侧火花
      for (const sgn of [1, -1]) {
        const px = this.x + nx * off * sgn - ux * this.DISP * 0.2;
        const py = this.y + ny * off * sgn - uy * this.DISP * 0.2;
        this.particles.push({
          x: px, y: py,
          vx: -ux * spd * 0.8 + (Math.random() - 0.5) * 40,
          vy: -uy * spd * 0.8 + (Math.random() - 0.5) * 40,
          life: 0.3 + Math.random() * 0.4, maxLife: 0,
          size: (0.5 + Math.random()) * this.fdScale * 0.9,
          fire: true, spin: Math.random() * Math.PI * 2,
          vspin: (Math.random() - 0.5) * 6,
          hue: Math.random() < 0.5 ? 'red' : 'magenta',
        });
      }
      // 中央毁灭者尘埃（红烟，无重力）
      if (Math.random() < 0.7) {
        this.particles.push({
          x: this.x + (Math.random() - 0.5) * this.DISP * 0.3,
          y: this.y + (Math.random() - 0.5) * this.DISP * 0.3,
          vx: -ux * spd * (0.9 + Math.random() * 0.3) * (Math.random() < 0.5 ? 1 : -1) * 0.15 + (Math.random() - 0.5) * 30,
          vy: -uy * spd * (0.9 + Math.random() * 0.3) * (Math.random() < 0.5 ? 1 : -1) * 0.15 + (Math.random() - 0.5) * 30,
          life: 0.5 + Math.random() * 0.5, maxLife: 0,
          size: (0.5 + Math.random()) * this.fdScale * 0.5,
          fire: true, dust: true, spin: Math.random() * Math.PI * 2, vspin: (Math.random() - 0.5) * 3,
          hue: 'dust',
        });
      }
    }
    if (this.particles.length > 700) this.particles.splice(0, this.particles.length - 700);
  },

  updateParticles(dt) {
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      if (p.maxLife <= 0) p.maxLife = p.life;
      p.life -= dt;
      if (p.life <= 0) { this.particles.splice(i, 1); continue; }
      p.x += p.vx * dt; p.y += p.vy * dt;
      // 逐帧速度衰减 / 收缩：粒子可用 drag / decay 覆写（不填沿用原默认值）
      const drag = (p.drag !== undefined) ? p.drag : 0.94;
      p.vx *= drag; p.vy *= drag;
      // 火花/尘埃逐帧收缩（SparkParticle: Scale *= 0.95）；bloom 由生命周期控制不缩
      if (p.tex !== 'bloom' && p.size > 1) p.size *= ((p.decay !== undefined) ? p.decay : 0.95);
    }
    if (this.particles.length > 900) this.particles.splice(0, this.particles.length - 900);
  },

  // 把 CSS 滤镜「烘焙」进离屏缓存贴图：每种 (tex,filter) 组合只做一次，
  // 之后粒子直接画缓存图，避免每帧每粒子设置极其昂贵的 ctx.filter 导致入场掉帧。
  // 外观与逐粒子设滤镜完全一致（滤镜在烘焙时作用于源贴图）。
  getTinted(texName, filterStr) {
    const key = texName + '|' + filterStr;
    const cached = this.tintCache[key];
    if (cached) return cached;
    const im = this.tex[texName];
    if (!im || !im.complete || im.naturalWidth === 0) return null;
    const w = im.naturalWidth, h = im.naturalHeight;
    const cv = document.createElement('canvas');
    cv.width = w; cv.height = h;
    const cx = cv.getContext('2d');
    cx.imageSmoothingEnabled = true;
    cx.filter = filterStr;
    cx.drawImage(im, 0, 0);
    cx.filter = 'none';
    this.tintCache[key] = cv;
    return cv;
  },

  drawParticles(ctx) {
    if (!this.firedust || !this.firedust.complete) return;
    const fw = (a) => (a.naturalWidth || a.width || 1), fh = (a) => (a.naturalHeight || a.height || 1);
    ctx.save();
    ctx.imageSmoothingEnabled = true;
    ctx.globalCompositeOperation = 'lighter'; // 发光叠加
    for (const p of this.particles) {
      const t = p.maxLife > 0 ? Math.max(0, p.life / p.maxLife) : 0;
      const tex = p.tex;
      if (tex === 'bloom') {
        // 绽放光晕：BloomCircle 由内向外放大 + 淡出
        const im = this.tex.bloom; if (!im || !im.complete) continue;
        const r = p.size < 0.0001 ? 0 : p.size;
        const growR = this.DISP * (0.6 + 2.2 * (1 - t)) * (p.bloomScale || 1);
        const g = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, growR);
        if (p.bloomRGB) {
          g.addColorStop(0, `rgba(${p.bloomRGB},${0.85 * t})`);
          g.addColorStop(0.5, `rgba(${p.bloomRGB},${0.35 * t})`);
          g.addColorStop(1, 'rgba(0,0,0,0)');
        } else if (p.hue === 'white') {
          g.addColorStop(0, `rgba(255,255,255,${0.9 * t})`);
          g.addColorStop(0.5, `rgba(255,220,255,${0.4 * t})`);
          g.addColorStop(1, 'rgba(0,0,0,0)');
        } else {
          g.addColorStop(0, `rgba(${p.hue === 'deepblue' ? '30,140,255' : '170,40,160'},${0.8 * t})`);
          g.addColorStop(0.5, `rgba(${p.hue === 'deepblue' ? '60,80,255' : '210,60,180'},${0.35 * t})`);
          g.addColorStop(1, 'rgba(0,0,0,0)');
        }
        ctx.fillStyle = g;
        ctx.beginPath(); ctx.arc(p.x, p.y, growR, 0, Math.PI * 2); ctx.fill();
        ctx.globalAlpha = t;
        const s = growR * 2.2;
        ctx.drawImage(im, p.x - s / 2, p.y - s / 2, s, s);
        continue;
      }
      const im = tex === 'star' ? this.tex.star
              : tex === 'silver' ? this.tex.silver
              : tex === 'glow'  ? this.tex.glow
              : tex === 'brim'  ? this.tex.brim
              : tex === 'smoke' ? this.tex.smoke
              : this.firedust;
      if (!im || !im.complete) continue;
      const iw = fw(im), ih = fh(im);
      // 暗色火花（VoidSpark）用低透明度、略微压暗的星形；烟雾更淡
      const alpha = tex === 'silver' ? t * 0.5
                  : tex === 'smoke'  ? t * 0.45
                  : (p.dark ? t * 0.35 : t * 0.85);
      ctx.globalAlpha = alpha;
      // —— 性能修复：把 CSS 滤镜「烘焙」进离屏缓存贴图，粒子直接画缓存图，
      //    避免每帧每粒子设置极昂贵的 ctx.filter（入场高潮 ~268 带滤镜粒子=掉帧根因）——
      let src = im;
      if (tex === 'silver' || tex === 'smoke') {
        src = this.getTinted(tex, 'grayscale(1) brightness(1.7)') || im;
      } else if (tex === 'star') {
        if (p.hue === 'magenta')      src = this.getTinted('star', 'hue-rotate(30deg) saturate(2) brightness(1.15)') || im;
        else if (p.hue === 'deepblue') src = this.getTinted('star', 'hue-rotate(200deg) saturate(2.2) brightness(1.3)') || im;
      } else if (tex === 'brim') {
        src = this.getTinted('brim', 'saturate(1.7) brightness(1.25)') || im;
      }
      ctx.save();
      ctx.translate(p.x, p.y);
      if (tex === 'star') {
        // SparkParticle：旋转=速度方向+90°，非对称拉伸 (0.5,1.6) 沿运动方向拉长，两遍绘制
        const rot = Math.atan2(p.vy, p.vx) + Math.PI / 2;
        ctx.rotate(rot);
        const ls = p.size;                       // 基础长度（沿速度方向）
        const ws = ls * 0.5;                     // 宽度（垂直方向）
        const hs = ls * 1.6;                     // 沿速度方向拉长
        ctx.drawImage(src, -ws / 2, -hs / 2, ws, hs);
        ctx.drawImage(src, -ws / 2 * 0.45, -hs / 2 * 0.9, ws * 0.45, hs * 0.9); // 第二细层
      } else if (tex === 'brim') {
        // Brimstone 火焰小尘：随速度方向拉长，做飞舞感
        ctx.rotate(Math.atan2(p.vy, p.vx) + Math.PI / 2);
        const ds = p.size;
        ctx.drawImage(src, -ds / 2, -ds * 0.9, ds, ds * 1.8);
      } else {
        ctx.rotate(p.spin || 0);
        const ds = p.size;
        ctx.drawImage(src, -ds / 2, -ds / 2, ds, ds * (ih / iw));
      }
      ctx.restore();
    }
    ctx.restore();
  },

  draw(ctx, animTime) {
    if (!this.alive || !this.sheetReady()) return;
    const im = this.hooded ? this.imgs.hooded : this.imgs.naked;
    const Fh = this.hooded ? FH.hooded : FH.naked;
    // 姿态：施法 / 冲刺 / 漂浮——按帧索引 g（物理行=floor(g/2)、列=g%2）
    let base, frameT, bob;
    if (this.casting)       { base = FRAME_BASE.cast;  frameT = CAST_FRAME_T;  bob = 0; }
    else if (this.dash)     { base = FRAME_BASE.dash;  frameT = DASH_FRAME_T;  bob = 0; }
    else if (this.blasting) { base = FRAME_BASE.blast; frameT = BLAST_ANIM_T;  bob = 0; }
    else                    { base = FRAME_BASE.idle;  frameT = FRAME_T; bob = Math.sin(animTime * 4.2) * 2; }
    const fi = (Math.floor(animTime / frameT) % FRAMES + FRAMES) % FRAMES;
    const g = base + fi;                       // 全局帧索引
    // 按「列垂直排布」解析：每个物理列纵向含 21 个帧，帧 g 先填满第 0 列(垂直 0→20)再第 1 列
    //   列 = floor(g/21)，列内垂直位 = g%21 → 漂浮=第0列0~5、冲刺=第0列6~11、施法=第0列12~17
    const COLS_FULL = 21;                    // 每列容纳的帧数
    const srcX = Math.floor(g / COLS_FULL) * FRAME_W;  // 物理列（0→21.. 之上为第1列）
    const srcY = (g % COLS_FULL) * Fh;                 // 列内垂直行
    const sc = this.DISP / Fh;                 // 显示高度固定为 DISP
    const dw = FRAME_W * sc, dh = this.DISP;

    // —— 护盾朝向（跟随运动方向 / 冲刺方向 / 施法方向）——
    let shieldRot;
    if (this.dash) {
      shieldRot = this.dashDir;
    } else {
      // 漂浮/施法：朝 sepulcher 头部朝向
      shieldRot = (segments && segments.length && !Number.isNaN(segments[0].angle)) ? segments[0].angle : Math.atan2(this.lrY || -1, this.lrX || 0);
    }
    // 下颚张合：冲刺时固定张开；施法时下颚轻微张合；蓄力(即将冲刺)时 sin 快速张合；平时轻微咬合
    let jaw = 0;
    if (this.casting) {
      jaw = Math.sin(animTime * 6.0) * 0.5;      // 施法：下颚有节奏地微张合
    } else if (this.dash) {
      jaw = PARAMS.JAW_OPEN;
    } else if (this.willCharge) {
      jaw = (0.04 - 0.82) * 0.5 + (0.04 - 0.82) * 0.5 * Math.sin(animTime * 17.2);
    } else {
      jaw = Math.sin(animTime * 4.2) * PARAMS.JAW_CHARGE_SWING * 0.3;
    }
    if (this.dash && this.dashT >= this.dashDur) {
      jaw = 0; // 结束瞬间收合
    }

    // —— 施法发光粒子（光带），在本体之下 ——
    if (this.casting) this.drawCastOrbs(ctx);

    // —— 常驻力场护盾的分层基底 ——
    // 金色核心画在本体之下
    if (this.shieldOn) supremeShield.drawCore(ctx, this.x, this.y, this.shieldDiam, animTime);

    // —— 火焰尾迹 / 施法爆发粒子 / 兄弟爆炸（有粒子即画，位于角色身后）
    if (this.particles.length) this.drawParticles(ctx);
    // —— BlastCast 巨型火球（画在粒子层与本体之间，随朝向旋转）——
    this.drawBlasts(ctx);
    // —— 分裂小火球（画在火球上方一层）——
    this.drawBarrages(ctx);

    // —— 本体 ——
    ctx.save();
    ctx.imageSmoothingEnabled = false;          // 保持像素锐利(最近邻)
    if (this.vx < 0) {                          // 左移时水平翻转朝向
      ctx.translate(this.x, this.y + bob); ctx.scale(-1, 1);
      ctx.drawImage(im, srcX, srcY, FRAME_W, Fh, -dw / 2, -dh / 2, dw, dh);
    } else {
      ctx.drawImage(im, srcX, srcY, FRAME_W, Fh, this.x - dw / 2, this.y + bob - dh / 2, dw, dh);
    }
    ctx.restore();

    // —— 常驻力场护盾罩（本体之上，WebGL 精确还原 fx；随朝向旋转）——
    if (this.shieldOn) {
      supremeShield.drawField(ctx, this.x, this.y, this.shieldDiam, animTime, shieldRot);
    }

    // —— 冲刺附加骷髅护盾：仅按 2 冲刺时生成（不依赖力场开关），在力场「身前方向」，缩小版 ——
    if (this.dash) {
      const leadDist = this.shieldDiam * PARAMS.SKULL_LEAD_RATIO;   // 身前偏移距离（收近）
      supremeShield.drawSkull(ctx, this.x, this.y, this.shieldDiam, leadDist, shieldRot, jaw);
    }

    // —— 兄弟：施法结束后在左右两侧显示（真实精灵 + Glow 亮纹，由 SupremeBrothers 模块绘制）——
    supremeBrothers.draw(ctx, animTime);
  },

  // 绘制施法光带发光粒子（GlowOrb 模拟，红/紫渐变小发光点）
  drawCastOrbs(ctx) {
    if (!this.castOrbs.length) return;
    const im = this.tex.glow;
    if (!im || !im.complete) return;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.imageSmoothingEnabled = true;
    for (const o of this.castOrbs) {
      const t = o.lifeStart > 0 ? Math.max(0, o.life / o.lifeStart) : 1;
      const r = o.size * (0.6 + 0.4 * t);
      const g = ctx.createRadialGradient(o.x, o.y, 0, o.x, o.y, r);
      g.addColorStop(0, 'rgba(255,80,80,0.95)');
      g.addColorStop(0.5, 'rgba(255,40,40,0.4)');
      g.addColorStop(1, 'rgba(255,0,0,0)');
      ctx.fillStyle = g;
      ctx.beginPath(); ctx.arc(o.x, o.y, r, 0, Math.PI * 2); ctx.fill();
      // 叠加 GlowOrb 贴图
      ctx.globalAlpha = t;
      ctx.drawImage(im, o.x - r, o.y - r, r * 2, r * 2);
      ctx.globalAlpha = 1;
    }
    ctx.restore();
  },
};