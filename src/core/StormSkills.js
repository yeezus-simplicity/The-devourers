// ===== core/StormSkills.js =====
// Storm Weaver 技能系统（改编自 storm-weaver.html 演出逻辑）：
//   4 = 头部发射闪电球（沿头部指向飞行，途中劈击分叉闪电）
//   5 = 天降一排冰霜波（带预告）
//   6 = 尾部生成龙卷风（程序化螺旋柱）
//   P = 蜕壳动画（装甲碎块 + 紫尘）
import { ctx, W, H, imgs, animTime, currentChar, currentCharKey, segments, points } from './globals.js';

export const stormSkills = {
  orbs: [],        // 闪电球
  bolts: [],       // 劈击分叉闪电（静态折线，短时淡出）
  frosts: [],      // 冰霜波
  tornadoes: [],   // 龙卷风
  gores: [],       // 蜕壳装甲碎块
  dusts: [],       // 紫尘粒子
  flash: 0,        // 技能触发时的屏幕闪电闪烁（帧）

  reset() {
    this.orbs.length = 0;
    this.bolts.length = 0;
    this.frosts.length = 0;
    this.tornadoes.length = 0;
    this.gores.length = 0;
    this.dusts.length = 0;
    this.flash = 0;
  },

  // ===== 4 键：头部发射闪电球，沿头部指向飞行（发射口在头顶） =====
  spawnOrb() {
    if (!segments[0] || !points[0]) return;
    const a = segments[0].angle;
    // 头部贴图以根部为锚点向上延伸，头顶 = 锚点 + 头长×朝向
    const headImg = currentChar.armorOff ? imgs.head_naked : imgs.head;
    const headLen = (headImg ? headImg.height : 88) * currentChar.scale;
    this.orbs.push({
      x: points[0].x + Math.cos(a) * headLen,
      y: points[0].y + Math.sin(a) * headLen,
      vx: Math.cos(a) * 3.2,
      vy: Math.sin(a) * 3.2,
      life: 180, maxLife: 180,
      pulse: 0,
      frame: 0, frameTimer: 0,      // 4 帧纵向图集
      nextBolt: 30 + (Math.random() * 20 | 0)   // 首次劈击延迟（30~50 帧）
    });
  },

  // ===== 5 键：天降一排冰霜波 =====
  spawnFrost() {
    const count = 5;
    const startX = W / 2 - (count - 1) * 70;
    for (let i = 0; i < count; i++) {
      this.frosts.push({
        x: startX + i * 140,
        y: -60,
        vy: 10,
        telegraph: 36,    // 预告期帧数（先亮再下落）
        life: 200, maxLife: 200
      });
    }
  },

  // ===== 6 键：尾部生成龙卷风 =====
  spawnTornado() {
    const tail = points[points.length - 1];
    if (!tail) return;
    // 柱底在尾部位置，但限制在屏幕中下部，避免柱顶冲出屏幕太多
    const baseY = Math.max(H * 0.35, Math.min(H * 0.85, tail.y));
    this.tornadoes.push({
      x: tail.x,
      baseY: baseY,
      vx: (Math.random() - 0.5) * 0.35,
      height: 480 + Math.random() * 60,
      ai: 0,
      life: 420, maxLife: 420
    });
  },

  // ===== P 键蜕壳：装甲碎块 + 紫尘 =====
  shedArmor() {
    for (let i = 0; i < segments.length; i++) {
      const seg = segments[i];
      if (!seg || !points[i]) continue;
      const p = points[i];
      let goreKey = null;
      if (seg.type === 'head') goreKey = 'armor_gore_head';
      else if (seg.type === 'tail') goreKey = Math.random() < 0.5 ? 'armor_gore_tail1' : 'armor_gore_tail2';
      else goreKey = 'armor_gore_body' + (1 + Math.floor(Math.random() * 3));
      const tex = imgs[goreKey];
      if (tex) {
        for (let k = 0; k < 2; k++) {
          const a = Math.random() * Math.PI * 2;
          const sp = 2 + Math.random() * 3;
          this.gores.push({
            tex: tex,
            x: p.x, y: p.y,
            vx: Math.cos(a) * sp,
            vy: Math.sin(a) * sp - 1,
            rot: Math.random() * Math.PI * 2,
            vrot: (Math.random() - 0.5) * 0.6,
            scale: 0.65 + Math.random() * 0.35,
            life: 120, maxLife: 120
          });
        }
      }
      // 紫色粉尘迸发
      for (let k = 0; k < 8; k++) {
        const a = Math.random() * Math.PI * 2;
        const sp = 1 + Math.random() * 2;
        this.dusts.push({
          x: p.x, y: p.y,
          vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 1,
          life: 60 + Math.random() * 30,
          maxLife: 90,
          color: `hsl(${280 + Math.random() * 30}, 90%, 70%)`,
          size: 2 + Math.random() * 3
        });
      }
    }
    this.flash = 12;
  },

  // ===== 形态切换：原地替换体节贴图（不重建 points，保持身体姿态 → 平滑变身） =====
  swapForm() {
    const naked = !!currentChar.armorOff;
    const head = naked ? imgs.head_naked : imgs.head;
    const body = naked ? imgs.body_naked : imgs.body;
    const tail = naked ? imgs.tail_naked : imgs.tail;
    for (const seg of segments) {
      if (seg.type === 'head') seg.img = head;
      else if (seg.type === 'tail') seg.img = tail;
      else seg.img = body;
    }
  },

  // ===== 劈击闪电：从球心沿球速方向延伸的分叉射线 =====
  spawnForkBolt(ball) {
    const ang = Math.atan2(ball.vy, ball.vx);
    const ux = Math.cos(ang), uy = Math.sin(ang);
    const nx = -Math.sin(ang), ny = Math.cos(ang);
    const main = [{ x: ball.x, y: ball.y }];
    const turnCount = 2 + (Math.random() * 2 | 0);
    const turnIdx = new Set();
    while (turnIdx.size < turnCount) turnIdx.add(2 + (Math.random() * 6 | 0));
    const SEG = 20;
    let px = ball.x, py = ball.y, side = 1;
    let i = 0, guard = 0;
    while (guard++ < 200) {
      px += ux * SEG; py += uy * SEG;
      let off;
      if (i < 8 && turnIdx.has(i + 1)) {
        off = side * (14 + Math.random() * 18);
        side = -side;
      } else {
        off = (Math.random() - 0.5) * 4;
      }
      main.push({ x: px + nx * off, y: py + ny * off });
      i++;
      if (px < -60 || px > W + 60 || py < -60 || py > H + 60) break;
    }
    const forks = [];
    const forkCount = Math.random() < 0.7 ? (1 + (Math.random() * 2 | 0)) : 0;
    const candidates = [2, 4, 6].slice().sort(() => Math.random() - 0.5).slice(0, forkCount);
    for (const fi of candidates) {
      const startNode = main[fi];
      const fs = Math.random() < 0.5 ? 1 : -1;
      const fAng = ang + fs * (Math.PI / 3 + Math.random() * 0.4);
      const fux = Math.cos(fAng), fuy = Math.sin(fAng);
      const FSEGS = 2 + (Math.random() * 2 | 0);
      const fk = [{ x: startNode.x, y: startNode.y }];
      let fx = startNode.x, fy = startNode.y;
      for (let j = 0; j < FSEGS; j++) {
        fx += fux * 16; fy += fuy * 16;
        fk.push({ x: fx, y: fy });
      }
      forks.push({ fromIdx: fi, nodes: fk });
    }
    this.bolts.push({ main: main, forks: forks, life: 22, maxLife: 22 });
  },

  // ===== 每帧更新（dt 秒 → 帧等效 ×60） =====
  update(dt) {
    if (currentCharKey !== 'storm_weaver') return;
    const f = dt * 60;
    // 闪电球
    for (let i = this.orbs.length - 1; i >= 0; i--) {
      const O = this.orbs[i];
      O.x += O.vx * f; O.y += O.vy * f;
      O.pulse += 0.3 * f;
      O.frameTimer += f;
      if (O.frameTimer >= 5) { O.frameTimer = 0; O.frame = (O.frame + 1) % 4; }
      O.nextBolt -= f;
      if (O.nextBolt <= 0) {
        this.spawnForkBolt(O);
        O.nextBolt = 45 + (Math.random() * 20 | 0);
      }
      O.life -= f;
      if (O.life <= 0) this.orbs.splice(i, 1);
    }
    // 劈击闪电老化
    for (let j = this.bolts.length - 1; j >= 0; j--) {
      this.bolts[j].life -= f;
      if (this.bolts[j].life <= 0) this.bolts.splice(j, 1);
    }
    // 冰霜波
    for (let i = this.frosts.length - 1; i >= 0; i--) {
      const F = this.frosts[i];
      if (F.telegraph > 0) F.telegraph -= f;
      else F.y += F.vy * f;
      if (F.y > H + 80) this.frosts.splice(i, 1);
    }
    // 龙卷风
    for (let i = this.tornadoes.length - 1; i >= 0; i--) {
      const T = this.tornadoes[i];
      T.x += T.vx * f;
      T.ai += f;
      T.life -= f;
      if (T.life <= 0) this.tornadoes.splice(i, 1);
      if (T.x < 60) { T.vx = Math.abs(T.vx); T.x = 60; }
      if (T.x > W - 60) { T.vx = -Math.abs(T.vx); T.x = W - 60; }
    }
    // 碎块：强重力旋转下坠，下落中缩小并淡出消失
    for (let i = this.gores.length - 1; i >= 0; i--) {
      const g = this.gores[i];
      g.x += g.vx * f; g.y += g.vy * f;
      g.vy += 0.45 * f;         // 强重力：明显下坠，不再空中飘浮
      g.vx *= 0.96;
      g.rot += g.vrot * f;      // 持续旋转
      g.scale = Math.max(0.05, g.scale - 0.012 * f);   // 下落中缩小
      g.life -= f;
      if (g.life <= 0) this.gores.splice(i, 1);
    }
    // 紫尘
    for (let i = this.dusts.length - 1; i >= 0; i--) {
      const p = this.dusts[i];
      p.x += p.vx * f; p.y += p.vy * f;
      p.vy += 0.02 * f;
      p.life -= f;
      if (p.life <= 0) this.dusts.splice(i, 1);
    }
    if (this.flash > 0) this.flash -= f;
  },

  // ===== 绘制（在暗化层之后调用，保持亮色） =====
  draw() {
    this.drawTornadoes();
    this.drawFrosts();
    this.drawOrbs();
    this.drawBolts();
    this.drawDusts();
    this.drawGores();
    // 技能触发时的全屏闪电闪烁
    if (this.flash > 0) {
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      ctx.fillStyle = `rgba(220, 240, 255, ${Math.min(1, this.flash / 36) * 0.35})`;
      ctx.fillRect(0, 0, W, H);
      ctx.restore();
    }
  },

  drawOrbs() {
    const tex = imgs.lightning_orb;
    if (!tex) return;
    const FW = 100, FH = 100;
    for (const O of this.orbs) {
      const a = Math.min(1, O.life / 50);
      ctx.save();
      ctx.globalAlpha = a * 0.95;
      ctx.translate(O.x, O.y);
      ctx.globalCompositeOperation = 'screen';
      const sw = 128, sh = 128;
      ctx.drawImage(tex, 0, O.frame * FH, FW, FH, -sw / 2, -sh / 2, sw, sh);
      const ringR = 44 + Math.sin(O.pulse) * 10;
      ctx.globalAlpha = a * 0.3;
      ctx.drawImage(tex, 0, O.frame * FH, FW, FH, -ringR, -ringR, ringR * 2, ringR * 2);
      ctx.globalCompositeOperation = 'source-over';
      ctx.restore();
    }
  },

  drawBolts() {
    for (const B of this.bolts) {
      const fade = B.life / B.maxLife;
      if (fade <= 0.01) continue;
      const N = B.main.length - 1;
      const visibleN = fade * N;
      const whole = Math.floor(visibleN);
      const frac = visibleN - whole;
      const main = B.main;
      ctx.save();
      ctx.globalCompositeOperation = 'screen';
      ctx.lineJoin = 'round'; ctx.lineCap = 'round';
      ctx.shadowColor = '#b070ff'; ctx.shadowBlur = 14;
      ctx.strokeStyle = '#d8c8ff';
      ctx.globalAlpha = 0.95;
      ctx.lineWidth = 8;
      ctx.beginPath();
      ctx.moveTo(main[0].x, main[0].y);
      for (let i = 1; i <= whole; i++) ctx.lineTo(main[i].x, main[i].y);
      if (whole < N && frac > 0.02) {
        const a = main[whole], b = main[whole + 1];
        ctx.lineTo(a.x + (b.x - a.x) * frac, a.y + (b.y - a.y) * frac);
      }
      ctx.stroke();
      ctx.globalAlpha = 0.4;
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 3.2;
      ctx.shadowBlur = 0;
      ctx.stroke();
      ctx.globalAlpha = 0.95;
      for (const fk of B.forks) {
        if (fk.fromIdx > visibleN) continue;
        const fn = fk.nodes;
        ctx.beginPath();
        ctx.moveTo(fn[0].x, fn[0].y);
        for (let i = 1; i < fn.length; i++) ctx.lineTo(fn[i].x, fn[i].y);
        ctx.stroke();
      }
      ctx.globalAlpha = 0.4;
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 3.2;
      for (const fk of B.forks) {
        if (fk.fromIdx > visibleN) continue;
        const fn = fk.nodes;
        ctx.beginPath();
        ctx.moveTo(fn[0].x, fn[0].y);
        for (let i = 1; i < fn.length; i++) ctx.lineTo(fn[i].x, fn[i].y);
        ctx.stroke();
      }
      ctx.restore();
    }
  },

  drawFrosts() {
    const tex = imgs.frost_wave;
    if (!tex) return;
    for (const F of this.frosts) {
      ctx.save();
      ctx.globalAlpha = 1;
      ctx.translate(F.x, F.y);
      ctx.rotate(Math.PI);
      ctx.globalCompositeOperation = 'screen';
      if (F.telegraph > 0) ctx.globalAlpha = 0.5;
      ctx.drawImage(tex, -40, -24, 80, 48);
      ctx.globalCompositeOperation = 'source-over';
      ctx.restore();
    }
  },

  drawTornadoes() {
    const snow = imgs.tornado_snow, rain = imgs.tornado_rain;
    if (!snow || !rain) return;
    for (const T of this.tornadoes) {
      const Ht = T.height;
      let clamp = Math.min(1, T.ai / 30);
      if (T.life < 60) clamp = Math.min(clamp, T.life / 60);
      if (clamp <= 0.01) continue;
      const aiTrackMult = -0.06283186 * T.ai;
      const step = 5.1;
      let inc = 0;
      let layerIdx = 0;
      const baseY = T.baseY, topY = T.baseY - Ht;
      for (let k = baseY; k > topY; k -= step) {
        inc += step;
        const ch = inc / Ht;
        let alpha = (ch < 0.5 ? ch * 2 : 2 - ch * 2) * 0.5 * clamp;
        if (alpha <= 0.015) continue;
        const incMult = inc * 6.283185 / -20;
        const rot = aiTrackMult + incMult;
        const scale = 1 + (ch - 0.15);
        const tex = (layerIdx % 2 === 0) ? snow : rain;
        layerIdx++;
        const sz = 68 * scale;
        ctx.save();
        ctx.globalAlpha = alpha;
        ctx.translate(T.x, k);
        ctx.rotate(rot);
        ctx.drawImage(tex, -sz / 2, -sz / 2, sz, sz);
        ctx.restore();
      }
    }
  },

  drawGores() {
    for (const g of this.gores) {
      const a = Math.min(1, g.life / 35);
      ctx.save();
      ctx.globalAlpha = a;
      ctx.translate(g.x, g.y);
      ctx.rotate(g.rot);
      ctx.scale(g.scale, g.scale);
      ctx.drawImage(g.tex, -g.tex.width / 2, -g.tex.height / 2);
      ctx.restore();
    }
    ctx.globalAlpha = 1;
  },

  drawDusts() {
    for (const p of this.dusts) {
      const a = Math.min(1, p.life / p.maxLife);
      ctx.save();
      ctx.globalAlpha = a;
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size * a, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
    ctx.globalAlpha = 1;
  }
};
