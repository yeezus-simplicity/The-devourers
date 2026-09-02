// ===== entities/SupremeShield.js =====
// 「至尊灾厄」护盾双形态：
//  - 常驻「能量护盾」：WebGL 离屏渲染，100% 还原 SupremeShieldShader.fx 的
//    PixelFunction —— ForcefieldTexture(uImage0) × Perlin 流动噪声(uImage1)，
//    暗紫(uColor)→红(uSecondaryColor)径向渐变、脉动环、噪声增幅、uOpacity=0.65
//  - 冲刺附加「骷髅护盾」：Top（上颚+主体）+ Bottom（下颚）两张骷髅贴图，
//    冲刺时在能量护盾「外侧 + 身前方向」临时生成，下颚张开约 40°，结束后消失

const FF_TEX    = 'textures/sepulcher/ForcefieldTexture.png';
const PERLIN_TEX = 'textures/sepulcher/Perlin.png';
const GOLD_TEX  = 'textures/sepulcher/CentralGold.png';
const TOP_TEX   = 'textures/sepulcher/SupremeShieldTop.png';
const BOTTOM_TEX = 'textures/sepulcher/SupremeShieldBottom.png';

const loadImg = (src) => new Promise((res) => { const i = new Image(); i.onload = () => res(i); i.onerror = () => res(null); i.src = src; });

// —— WebGL fragment shader：逐行复刻 fx 的 PixelFunction ——
const FRAG = `
precision mediump float;
varying vec2 vUV;
uniform sampler2D uImage0;      // ForcefieldTexture
uniform sampler2D uImage1;      // Perlin
uniform vec3 uColor;            // DarkViolet
uniform vec3 uSecondaryColor;   // Red*1.4
uniform float uOpacity;         // 0.65
uniform float uSaturation;      // 1
uniform float uTime;

float inverseLerp(float x, float minv, float maxv) {
  return clamp((x - minv) / (maxv - minv), 0.0, 1.0);
}
void main() {
  vec4 baseColor = texture2D(uImage0, vUV);
  vec4 noiseColor = texture2D(uImage1, vec2(vUV.x, fract(vUV.y + uTime * 0.7)));
  float start = 0.45 + sin(uTime * 3.0) * 0.04;
  float ringRadus = 0.1;
  float distanceRatio = distance(vUV, vec2(0.5, 0.5)) * 1.414;
  vec3 colorToUse = mix(uColor, uSecondaryColor, pow(distanceRatio, 0.6));
  float originalAlpha = pow(inverseLerp(distanceRatio, 0.0, start), 2.6);
  float ringAlpha = sin(3.14159265 * inverseLerp(distanceRatio, start, start + ringRadus)) * 1.96;
  if (distanceRatio < start)
    originalAlpha *= mix(1.0, 2.6, noiseColor.r);
  else
    originalAlpha = mix(originalAlpha, ringAlpha, inverseLerp(distanceRatio, start, start + ringRadus * 0.5));
  originalAlpha *= mix(1.0, 0.56, distanceRatio) * mix(1.0, 2.45, min(1.0, pow(sin(uTime * 3.1), 10.0) * 0.7 + uSaturation));
  baseColor = vec4(mix(baseColor.rgb, colorToUse, 0.5), 1.0);
  gl_FragColor = baseColor * originalAlpha * uOpacity;
}
`;

const VERT = `
attribute vec2 aPos;
varying vec2 vUV;
void main() {
  vUV = aPos * 0.5 + 0.5;
  gl_Position = vec4(aPos, 0.0, 1.0);
}
`;

export const supremeShield = {
  ffImg: null, perlinImg: null, goldImg: null, topImg: null, bottomImg: null, started: false,
  // WebGL 状态
  gl: null, prog: null, fCanvas: null, tex0: null, tex1: null, buf: null,
  unif: {}, readyGL: false,

  async init() {
    if (this.started) { if (!this.readyGL) this.setupGL(); return; }
    this.started = true;
    const [ff, perlin, gold, top, bottom] = await Promise.all([
      loadImg(FF_TEX), loadImg(PERLIN_TEX), loadImg(GOLD_TEX), loadImg(TOP_TEX), loadImg(BOTTOM_TEX),
    ]);
    this.ffImg = ff && ff.complete ? ff : null;
    this.perlinImg = perlin && perlin.complete ? perlin : null;
    this.goldImg = gold && gold.complete ? gold : null;
    this.topImg = top && top.complete ? top : null;
    this.bottomImg = bottom && bottom.complete ? bottom : null;
    if (!this.ffImg || !this.perlinImg) console.error('[Shield] WebGL 力场贴图加载失败');
    this.setupGL();
  },

  setupGL() {
    if (this.readyGL || !this.ffImg || !this.perlinImg) return;
    try {
      // 离屏 canvas（WebGL 目标）
      this.fCanvas = document.createElement('canvas');
      this.fCanvas.width = this.fCanvas.height = 256;
      const gl = this.fCanvas.getContext('webgl', { premultipliedAlpha: false }) || this.fCanvas.getContext('experimental-webgl');
      if (!gl) { console.error('[Shield] WebGL 不可用'); return; }
      this.gl = gl;
      // 编译着色器
      const mk = (type, src) => {
        const s = gl.createShader(type);
        gl.shaderSource(s, src); gl.compileShader(s);
        if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s));
        return s;
      };
      const vs = mk(gl.VERTEX_SHADER, VERT);
      const fs = mk(gl.FRAGMENT_SHADER, FRAG);
      this.prog = gl.createProgram();
      gl.attachShader(this.prog, vs); gl.attachShader(this.prog, fs);
      gl.linkProgram(this.prog);
      if (!gl.getProgramParameter(this.prog, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(this.prog));
      gl.useProgram(this.prog);
      // 纹理
      this.tex0 = gl.createTexture(); this.tex1 = gl.createTexture();
      const upload = (img, tex) => {
        gl.bindTexture(gl.TEXTURE_2D, tex);
        gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, 1);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, img);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.REPEAT);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.REPEAT);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      };
      upload(this.ffImg, this.tex0);
      upload(this.perlinImg, this.tex1);
      // 全屏 quad
      this.buf = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, this.buf);
      gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1,-1, 1,-1, -1,1, 1,1]), gl.STATIC_DRAW);
      const loc = gl.getAttribLocation(this.prog, 'aPos');
      gl.enableVertexAttribArray(loc);
      gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
      // uniform 位置
      const U = this.unif = {};
      U.tex0 = gl.getUniformLocation(this.prog, 'uImage0');
      U.tex1 = gl.getUniformLocation(this.prog, 'uImage1');
      U.color = gl.getUniformLocation(this.prog, 'uColor');
      U.seccolor = gl.getUniformLocation(this.prog, 'uSecondaryColor');
      U.opacity = gl.getUniformLocation(this.prog, 'uOpacity');
      U.saturation = gl.getUniformLocation(this.prog, 'uSaturation');
      U.time = gl.getUniformLocation(this.prog, 'uTime');
      this.readyGL = true;
    } catch (e) {
      console.error('[Shield] WebGL 初始化失败:', e);
      this.readyGL = false;
    }
  },

  ready() { return this.readyGL; },
  skullReady() {
    return this.topImg && this.bottomImg &&
      this.topImg.complete && this.bottomImg.complete &&
      this.topImg.naturalWidth > 0 && this.bottomImg.naturalWidth > 0;
  },
  goldReady() {
    return this.goldImg && this.goldImg.complete && this.goldImg.naturalWidth > 0;
  },

  // —— 渲染力场到离屏 canvas（按 fx 精确成像）——
  render(time, diam) {
    if (!this.ready()) return null;
    const gl = this.gl;
    // 用最近 2 的幂大小的离屏（>=diam，保真且便于纹理采样）
    let sz = 64;
    while (sz < diam) sz <<= 1;
    if (this.fCanvas.width !== sz) { this.fCanvas.width = sz; this.fCanvas.height = sz; }
    gl.viewport(0, 0, sz, sz);
    gl.useProgram(this.prog);
    gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, this.tex0);
    gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D, this.tex1);
    gl.uniform1i(this.unif.tex0, 0);
    gl.uniform1i(this.unif.tex1, 1);
    gl.uniform3f(this.unif.color, 0.584, 0.10, 0.83);        // Color.DarkViolet
    gl.uniform3f(this.unif.seccolor, 1.0, 0.02, 0.02);       // Color.Red * 1.4（饱和后近似红）
    gl.uniform1f(this.unif.opacity, 0.65);
    gl.uniform1f(this.unif.saturation, 1.0);
    gl.uniform1f(this.unif.time, time);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    return this.fCanvas;
  },

  // —— 常驻能量护盾 ——
  drawCore(ctx, cx, cy, diam, time) {
    if (!this.goldReady()) return;
    const g = diam * 0.28;
    ctx.save();
    ctx.imageSmoothingEnabled = true;
    ctx.globalAlpha = 0.85;
    ctx.drawImage(this.goldImg, cx - g / 2, cy - g / 2, g, g);
    ctx.restore();
  },

  // 把 WebGL 力场成像合成到主 2D 画布【精确还原，非手绘】
  drawField(ctx, cx, cy, diam, time, rot) {
    const frm = this.render(time, diam);
    if (!frm) return;
    ctx.save();
    ctx.imageSmoothingEnabled = true;
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
    if (rot) {
      ctx.translate(cx, cy);
      ctx.rotate(rot);
      ctx.drawImage(frm, -diam / 2, -diam / 2, diam, diam);
      ctx.restore();
      return;
    }
    ctx.drawImage(frm, cx - diam / 2, cy - diam / 2, diam, diam);
    ctx.restore();
  },

  // —— 冲刺附加骷髅盾 ——
  drawSkull(ctx, cx, cy, diam, leadDist, rot, jawOffset) {
    if (!this.skullReady()) return;
    const SKULL_SCALE = 0.52;       // 相对力场直径（缩小）
    const s = diam * SKULL_SCALE;
    const fx = Math.cos(rot), fy = Math.sin(rot);
    const sx = cx + fx * leadDist;
    const sy = cy + fy * leadDist;
    ctx.save();
    ctx.imageSmoothingEnabled = true;
    ctx.globalAlpha = 0.95;
    ctx.translate(sx, sy);
    // 上颚：绕护盾朝向 rot 旋转，主体居中
    const tp = this.topImg;
    const wTop = s, hTop = s * (tp.height / tp.width);
    ctx.save();
    if (rot) ctx.rotate(rot);
    ctx.drawImage(tp, -wTop / 2, -hTop / 2, wTop, hTop);
    // 下颚：铰点对齐上颚嘴部底边(约 hTop 的 42% 偏下)，绕铰点相对张开
    const bt = this.bottomImg;
    const wBot = s * 0.80, hBot = wBot * (bt.height / bt.width);
    const hingeY = hTop * 0.30;                 // 上颚嘴部铰点（偏下，下颚尽量露出不被遮）
    ctx.save();
    ctx.translate(0, hingeY);
    if (rot + jawOffset) ctx.rotate(rot + jawOffset);
    // 下颚顶端(关节头)对齐铰点，向下张开（jawOffset>0 时明显下垂）
    ctx.drawImage(bt, -wBot / 2, -hBot * 0.18, wBot, hBot);
    ctx.restore();
    ctx.restore();
    ctx.restore();
  },

  destroy() {
    if (this.gl) { this.gl = null; }
    this.ffImg = null; this.perlinImg = null; this.goldImg = null; this.topImg = null; this.bottomImg = null;
    this.fCanvas = null; this.tex0 = null; this.tex1 = null; this.prog = null; this.buf = null;
    this.started = false; this.readyGL = false;
  },
};