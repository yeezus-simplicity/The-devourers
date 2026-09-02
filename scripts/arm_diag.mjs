// 诊断：复刻墓穴魔手臂数学，验证手臂位置
// 模拟一条竖直向下的身体链（头部在上，体节向下延伸）
const sc = 1.4; // currentChar.scale
const overlap = 16;

function segBodyHalf(type) {
  if (type === 'head') return 0;
  if (type === 'body1' || type === 'body2') return 82 / 2; // body.png 170x82
  if (type === 'energy_ball') return 24 / 2; // energy_ball 22x24
  if (type === 'tail') return 54 / 2;
  return 0;
}

function buildChain() {
  const core = [{ type: 'head' }];
  for (let i = 0; i < 9; i++) core.push({ type: i % 2 === 0 ? 'body1' : 'body2' });
  core.push({ type: 'tail' });
  const s = [];
  for (let i = 0; i < core.length; i++) {
    if (i > 0) s.push({ type: 'energy_ball' });
    s.push(core[i]);
  }
  // 竖直向下：head 在 (700, 300)，每节沿 +y 方向
  const points = [{ x: 700, y: 300 }];
  for (let i = 1; i < s.length; i++) {
    const d = (segBodyHalf(s[i - 1].type) + segBodyHalf(s[i].type)) * sc - overlap;
    points.push({ x: 700, y: points[i - 1].y + d });
  }
  return { s, points };
}

function wrapAngle(a) {
  while (a > Math.PI) a -= 2 * Math.PI;
  while (a < -Math.PI) a += 2 * Math.PI;
  return a;
}

function computeArm(segIndex, dir, rotation, seg, p) {
  const segRot = seg.angle + Math.PI / 2;
  const lerpVal = Math.max(0, Math.min(1, (rotation + 0.51) / 0.45));
  const sideFactor = 200 + (18 - 200) * lerpVal;
  const aheadFactor = 284 + (680 - 284) * lerpVal;
  const a1 = segRot + rotation * dir - Math.PI / 2;
  const a2 = a1 + (Math.PI / 2) * dir;
  const armX = p.x + Math.cos(a1) * aheadFactor * sc + Math.cos(a2) * sideFactor * sc;
  const armY = p.y + Math.sin(a1) * aheadFactor * sc + Math.sin(a2) * sideFactor * sc;
  // offsetFromSegment
  const vx0 = dir * 60, vy0 = 55;
  const ang = segRot - (Math.PI / 2 - rotation * 1.7 - 0.77) * dir;
  const rx = vx0 * Math.cos(ang) - vy0 * Math.sin(ang);
  const ry = vx0 * Math.sin(ang) + vy0 * Math.cos(ang);
  const rl = Math.hypot(rx, ry) || 1;
  const offX = (rx / rl) * 92;
  const offY = (ry / rl) * 92;
  const l0 = { x: p.x + offX, y: p.y + offY, rot: Math.atan2(offY, offX) };
  const l1 = {
    x: l0.x + offX * 0.5 + ((armX - l0.x) / (Math.hypot(armX - l0.x, armY - l0.y) || 1)) * 84,
    y: l0.y + offY * 0.5 + ((armY - l0.y) / (Math.hypot(armX - l0.x, armY - l0.y) || 1)) * 84,
    rot: Math.atan2(armY - l0.y, armX - l0.x)
  };
  return { armX, armY, l0, l1 };
}

const { s, points } = buildChain();
console.log('=== 体节链（竖直向下，head 在 700,300）===');
s.forEach((seg, i) => console.log(`[${i}] ${seg.type} @ (${points[i].x.toFixed(0)}, ${points[i].y.toFixed(0)})`));

console.log('\n=== 手臂位置（rotation=0 时）===');
let rotationalOffset = 0;
for (let i = 3; i < s.length; i++) {
  if (i % 4 === 0 && (s[i].type === 'body1' || s[i].type === 'body2')) {
    const seg = { angle: -Math.PI / 2 }; // 竖直身体（头在上）：angle = atan2(prev-this) = atan2(-dy,0) = -PI/2
    const a1 = computeArm(i, 1, rotationalOffset, seg, points[i]);
    rotationalOffset += Math.PI / 6;
    const a2 = computeArm(i, -1, rotationalOffset + Math.PI, seg, points[i]);
    rotationalOffset += Math.PI / 6;
    rotationalOffset = wrapAngle(rotationalOffset);
    console.log(`seg[${i}] (${s[i].type}) @ (${points[i].x.toFixed(0)},${points[i].y.toFixed(0)})`);
    console.log(`  dir=+1: base=(${a1.armX.toFixed(0)},${a1.armY.toFixed(0)}) forearm=(${a1.l0.x.toFixed(0)},${a1.l0.y.toFixed(0)}) upper=(${a1.l1.x.toFixed(0)},${a1.l1.y.toFixed(0)})`);
    console.log(`  dir=-1: base=(${a2.armX.toFixed(0)},${a2.armY.toFixed(0)}) forearm=(${a2.l0.x.toFixed(0)},${a2.l0.y.toFixed(0)}) upper=(${a2.l1.x.toFixed(0)},${a2.l1.y.toFixed(0)})`);
  }
}
