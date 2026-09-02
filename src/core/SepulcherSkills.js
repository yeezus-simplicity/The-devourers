// ===== core/SepulcherSkills.js =====
// 墓穴魔 Brimstone Barrage 技能系统（仿 C# BrimstoneBarrage.cs，Canvas2D 移植）：
//   1 = 头部前释放 30 颗圆形扩散飞刃弹幕 + 释放闪光 + 红色火焰拖尾尘
//   4 帧帧动画（飞刃翻涌）、急速起步(×1.01)→巡航→最后冲刺(timeLeft>600 ×1.015)→末尾 60 帧淡出
import { ctx, W, H, currentChar, currentCharKey, segments, points, imgs } from './globals.js';
import { screenShake } from '../utils/ScreenShake.js';

// ===== 资源路径（vite inlinePublicAssets 会在构建时整字替换为 data URI） =====
const PATH_BRIM  = 'textures/sepulcher/BrimstoneBarrage.png'; // 4 帧竖排飞刃图集
const PATH_BLOOM = 'textures/sepulcher/BloomCircle.png';       // 白色辉光圆（中心白→外淡）
const PATH_RING  = 'textures/sepulcher/HollowCircleHardEdge.png'; // 硬边空心环（扩散冲击波）
const PATH_FIRE  = 'textures/sepulcher/Firedust.png';         // 3 帧竖排 + 形火星

// ===== 懒加载：模块局部 Image + 帧高（4 帧 / 3 帧竖排，由 onload 拿 naturalHeight 推算） =====
let imgBrim = null, imgBloom = null, imgRing = null, imgFire = null;
let brimFrameH = 32, fireFrameH = 60;  // 占位默认，onload 后覆盖
function ensureLoaded() {
  if (!imgBrim)  { imgBrim  = new Image(); imgBrim.onload  = () => { brimFrameH = (imgBrim.naturalHeight  / 4) || 32; }; imgBrim.onerror  = () => {}; imgBrim.src  = PATH_BRIM;  }
  if (!imgBloom) { imgBloom = new Image(); imgBloom.onload = () => {}; imgBloom.onerror = () => {}; imgBloom.src = PATH_BLOOM; }
  if (!imgRing)  { imgRing  = new Image(); imgRing.onload  = () => {}; imgRing.onerror  = () => {}; imgRing.src  = PATH_RING;  }
  if (!imgFire)  { imgFire  = new Image(); imgFire.onload  = () => { fireFrameH = (imgFire.naturalHeight  / 3) || 60; }; imgFire.onerror  = () => {}; imgFire.src  = PATH_FIRE;  }
}

export const sepulcherSkills = {
  brimstones: [],     // 飞刃弹幕：{x,y,vx,vy,targetSpeed,life,maxLife,scale,rot,frame,frameCounter,opacity,trail}
  dusts: [],          // 红色火焰拖尾尘：{x,y,vx,vy,life,maxLife,scale,rot,frame}
  flashes: [],        // 释放闪光：{x,y,kind,life,maxLife,scale,targetScale}
  screenFlash: 0,     // 全屏红闪帧数

  reset() {
    this.brimstones.length = 0;
    this.dusts.length = 0;
    this.flashes.length = 0;
    this.screenFlash = 0;
  },

  // ===== 释放：在头部前方生成 30 颗圆形扩散飞刃 + 3 道释放闪光 =====
  spawnBarrage() {
    if (currentCharKey !== 'sepulcher' || !points[0] || !segments[0]) return;
    ensureLoaded();
    const a = segments[0].angle;
    const headImg = imgs.head;
    const headLen = (headImg && headImg.height ? headImg.height : 88) * currentChar.scale;
    const cx = points[0].x + Math.cos(a) * headLen;
    const cy = points[0].y + Math.sin(a) * headLen;

    // 3 道释放闪光（位置在弹幕中心）
    this.flashes.push({ x: cx, y: cy, kind: 'bloomRed',   life: 30, maxLife: 30, scale: 1.4 });
    this.flashes.push({ x: cx, y: cy, kind: 'bloomWhite', life: 28, maxLife: 28, scale: 1.1 });
    this.flashes.push({ x: cx, y: cy, kind: 'ring',       life: 25, maxLife: 25, scale: 0.4, targetScale: 4.2 });

    // 30 颗圆形扩散（基础方向左下 → 均匀旋转到 360°）
    const N = 30;
    const baseAng = Math.atan2(-1, -1);
    for (let k = 0; k < N; k++) {
      const ang = baseAng + k * (Math.PI * 2 / N);
      this.brimstones.push({
        x: cx, y: cy,
        vx: Math.cos(ang) * 0.5,  // 初始极小速度（视觉从中心"炸"开）
        vy: Math.sin(ang) * 0.5,
        targetSpeed: 15,
        life: 690, maxLife: 690,
        scale: 0.85,
        rot: ang + Math.PI / 2,   // 长轴对齐初始方向
        frame: 0, frameCounter: 0,
        opacity: 1.0,
        trail: []
      });
    }
    this.screenFlash = 6;          // 全屏短暂红闪
    if (screenShake && screenShake.set) screenShake.set(6);
  },

  // ===== 每帧更新 =====
  update(dt) {
    // 释放闪光衰减
    for (let i = this.flashes.length - 1; i >= 0; i--) {
      this.flashes[i].life--;
      if (this.flashes[i].life <= 0) this.flashes.splice(i, 1);
    }
    if (this.screenFlash > 0) this.screenFlash--;

    // 弹幕：加速 / 二次冲刺 / 旋转 / 帧动画 / 拖尾 / 寿命 / 火焰尘
    for (let i = this.brimstones.length - 1; i >= 0; i--) {
      const p = this.brimstones[i];
      const speed = Math.hypot(p.vx, p.vy);
      if (speed < p.targetSpeed) {
        // 起步加速：每帧 ×1.01
        p.vx *= 1.01; p.vy *= 1.01;
        const ns = Math.hypot(p.vx, p.vy);
        if (ns > p.targetSpeed) { p.vx = p.vx / ns * p.targetSpeed; p.vy = p.vy / ns * p.targetSpeed; }
      } else if (p.life > 600) {
        // 最后冲刺：timeLeft 690→600（90 帧）内 ×1.015
        p.vx *= 1.015; p.vy *= 1.015;
      }
      p.x += p.vx; p.y += p.vy;
      // 长轴对齐飞行方向
      p.rot = Math.atan2(p.vy, p.vx) + Math.PI / 2;
      // 4 帧翻涌动画
      p.frameCounter++;
      if (p.frameCounter > 4) { p.frameCounter = 0; p.frame = (p.frame + 1) % 4; }
      // 拖尾残影（保留最近 3 帧位置）
      p.trail.push({ x: p.x, y: p.y });
      if (p.trail.length > 3) p.trail.shift();
      // 末尾 60 帧透明度淡出
      if (p.life < 60) p.opacity = Math.max(0, p.life / 60);
      p.life--;
      // 寿命到 / 出屏 → 移除
      if (p.life <= 0 || p.x < -300 || p.x > W + 300 || p.y < -300 || p.y > H + 300) {
        this.brimstones.splice(i, 1);
        continue;
      }
      // 火焰拖尾尘：随机喷射（反向衰减速度）
      if (imgFire && imgFire.complete && Math.random() < 0.6) {
        const a = Math.atan2(p.vy, p.vx);
        const spd = Math.hypot(p.vx, p.vy);
        this.dusts.push({
          x: p.x + (Math.random() - 0.5) * 8,
          y: p.y + (Math.random() - 0.5) * 8,
          vx: -p.vx * 0.5 * (0.1 + Math.random() * 0.8),
          vy: -p.vy * 0.5 * (0.1 + Math.random() * 0.8),
          life: 25 + ((Math.random() * 25) | 0), maxLife: 50,
          scale: 0.4 + Math.random() * 0.4,
          rot: a + (Math.random() - 0.5) * 0.6,
          frame: (Math.random() * 3) | 0
        });
      }
    }
    // 尘更新：减速、寿命
    for (let i = this.dusts.length - 1; i >= 0; i--) {
      const d = this.dusts[i];
      d.x += d.vx; d.y += d.vy;
      d.vx *= 0.92; d.vy *= 0.92;
      d.life--;
      if (d.life <= 0) this.dusts.splice(i, 1);
    }
  },

  // ===== 绘制：弹幕（带残影）→ 尘 → 释放闪光 → 屏幕红闪 =====
  draw() {
    if (!ctx) return;
    ensureLoaded();
    const brimReady = imgBrim && imgBrim.complete && imgBrim.naturalWidth > 0;
    const fireReady = imgFire && imgFire.complete && imgFire.naturalWidth > 0;
    const bloomReady = imgBloom && imgBloom.complete && imgBloom.naturalWidth > 0;
    const ringReady  = imgRing  && imgRing.complete  && imgRing.naturalWidth > 0;

    // 1) 弹幕（带 2 帧残影 + 当前帧）
    for (const p of this.brimstones) {
      if (brimReady) {
        const fw = imgBrim.naturalWidth, fh = brimFrameH;
        // 残影（trail 中保留的旧位置）
        for (let k = 0; k < p.trail.length - 1; k++) {
          const t = p.trail[k];
          const alpha = 0.32 * ((k + 1) / p.trail.length) * p.opacity;
          ctx.save();
          ctx.globalAlpha = alpha;
          ctx.translate(t.x, t.y);
          ctx.rotate(p.rot);
          ctx.drawImage(imgBrim, 0, p.frame * fh, fw, fh, -fw * p.scale / 2, -fh * p.scale / 2, fw * p.scale, fh * p.scale);
          ctx.restore();
        }
        // 当前帧
        ctx.save();
        ctx.globalAlpha = p.opacity;
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rot);
        ctx.drawImage(imgBrim, 0, p.frame * fh, fw, fh, -fw * p.scale / 2, -fh * p.scale / 2, fw * p.scale, fh * p.scale);
        ctx.restore();
      } else {
        // 占位（贴图未就绪时）：红色圆，方向由 vx/vy 决定轻微拉伸
        ctx.save();
        ctx.globalAlpha = p.opacity;
        const ang = Math.atan2(p.vy, p.vx);
        ctx.translate(p.x, p.y);
        ctx.rotate(ang);
        ctx.fillStyle = '#ff2200';
        ctx.beginPath(); ctx.ellipse(0, 0, 10 * p.scale, 6 * p.scale, 0, 0, Math.PI * 2); ctx.fill();
        ctx.restore();
      }
    }
    // 2) 火焰尘
    if (fireReady) {
      const fw = imgFire.naturalWidth, fh = fireFrameH;
      for (const d of this.dusts) {
        const alpha = d.life / d.maxLife;
        ctx.save();
        ctx.globalAlpha = alpha;
        ctx.translate(d.x, d.y);
        ctx.rotate(d.rot);
        ctx.drawImage(imgFire, 0, d.frame * fh, fw, fh, -fw * d.scale / 2, -fh * d.scale / 2, fw * d.scale, fh * d.scale);
        ctx.restore();
      }
    } else {
      // 占位
      for (const d of this.dusts) {
        const alpha = d.life / d.maxLife;
        ctx.save();
        ctx.globalAlpha = alpha;
        ctx.fillStyle = '#ff5522';
        ctx.beginPath(); ctx.arc(d.x, d.y, 4 * d.scale, 0, Math.PI * 2); ctx.fill();
        ctx.restore();
      }
    }
    // 3) 释放闪光（lighter 混合，盖在弹幕上）
    for (const f of this.flashes) {
      const t = f.life / f.maxLife;
      const inv = 1 - t;  // 0→1
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      ctx.globalAlpha = t;
      if (f.kind === 'bloomRed' && bloomReady) {
        const sz = 200 * f.scale * (0.5 + 0.6 * inv);
        ctx.drawImage(imgBloom, f.x - sz / 2, f.y - sz / 2, sz, sz);
      } else if (f.kind === 'bloomWhite' && bloomReady) {
        const sz = 160 * f.scale * (0.4 + 0.6 * inv);
        ctx.drawImage(imgBloom, f.x - sz / 2, f.y - sz / 2, sz, sz);
      } else if (f.kind === 'ring' && ringReady) {
        const sz = 200 * (f.scale + inv * (f.targetScale - f.scale));
        ctx.drawImage(imgRing, f.x - sz / 2, f.y - sz / 2, sz, sz);
      } else {
        // 占位
        const r = f.kind === 'ring'
          ? 20 + inv * 120
          : 50 * f.scale * (0.5 + 0.5 * inv);
        ctx.fillStyle = f.kind === 'ring' ? 'rgba(255,40,40,0.6)' : (f.kind === 'bloomWhite' ? 'rgba(255,240,200,0.8)' : 'rgba(255,80,40,0.7)');
        ctx.beginPath(); ctx.arc(f.x, f.y, r, 0, Math.PI * 2); ctx.fill();
      }
      ctx.restore();
    }
    // 4) 屏幕红闪
    if (this.screenFlash > 0) {
      ctx.save();
      ctx.globalAlpha = (this.screenFlash / 6) * 0.35;
      ctx.fillStyle = '#ff7755';
      ctx.fillRect(0, 0, W, H);
      ctx.restore();
    }
  }
};
