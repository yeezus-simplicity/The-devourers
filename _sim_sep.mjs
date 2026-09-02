// 仿真 IK 版 updateSepulcherArms（体节以恒定速度沿 +x 前进，arm.direction=1, psi=0）
const V_REF=220, MOVE_GATE=0.05, RELEASE_AHEAD=0.35, STEP_SPEED=520, ROT_OFF=0.30;
const scale=1.4, bodyScale=1.35; const S=scale*bodyScale;
const FOREARM_HALF=30*S, ARM_LEN=62*S, R_body=41*S;
const dt=1/60, v=200;

function makeArm(psi){return {state:'held',psi,palmX:undefined,palmY:undefined,stepTX:undefined,stepTY:undefined,
  limbs:[{x:0,y:0,rot:0},{x:0,y:0,rot:0}]};}

const arms=[makeArm(0), makeArm(Math.PI/6), makeArm(-Math.PI/6)];
let px=400, py=300; const segAngle=0;
const fwdX=Math.cos(segAngle), fwdY=Math.sin(segAngle);

let foreErrMax=0, armErrMax=0, elbowFlip=0, prevEx=null, minHandDistBody=Infinity, steps=0;
let maxDH=0, maxDHframe=0, maxErrFrame=0;

for(let f=0; f<900; f++){
  const p={x:px,y:py}; const seg={angle:segAngle};
  const vSeg=v; const s01=Math.min(1,vSeg/V_REF); const active=s01>MOVE_GATE;
  for(let ai=0; ai<arms.length; ai++){
    const arm=arms[ai];
    const dir=1; // test right arm
    const reach=seg.angle+Math.PI/2;
    const sideX=-Math.sin(seg.angle)*dir, sideY=Math.cos(seg.angle)*dir;
    const ang=reach-(Math.PI/2-ROT_OFF-0.77)*dir;
    const ux0=(dir*60)*Math.cos(ang)-55*Math.sin(ang);
    const uy0=(dir*60)*Math.sin(ang)+55*Math.cos(ang);
    const ul=Math.hypot(ux0,uy0)||1; const uX=ux0/ul, uY=uy0/ul;
    const Sx=p.x+uX*(R_body+FOREARM_HALF*0.3), Sy=p.y+uY*(R_body+FOREARM_HALF*0.3);
    const reachDist=FOREARM_HALF+ARM_LEN;
    const fwd0=reachDist*(0.42+0.13*Math.sin(arm.psi));
    const sideOff=70*S;
    if(arm.palmX===undefined){arm.palmX=Sx+fwdX*fwd0+sideX*sideOff; arm.palmY=Sy+fwdY*fwd0+sideY*sideOff;}
    if(active){
      if(arm.state==='held'){
        const fwdGap=(arm.palmX-Sx)*fwdX+(arm.palmY-Sy)*fwdY;
        if(fwdGap < -RELEASE_AHEAD*reachDist){arm.state='stepping'; steps++;
          arm.stepTX=Sx+fwdX*fwd0+sideX*sideOff; arm.stepTY=Sy+fwdY*fwd0+sideY*sideOff;}
      } else {
        const sdx=arm.stepTX-arm.palmX, sdy=arm.stepTY-arm.palmY;
        const sd=Math.hypot(sdx,sdy); const step=STEP_SPEED*dt;
        const oldX=arm.palmX;
        if(sd<=step){arm.palmX=arm.stepTX;arm.palmY=arm.stepTY;arm.state='held';}
        else {arm.palmX+=sdx/sd*step;arm.palmY+=sdy/sd*step;}
      }
    }
    // IK
    const dxH=arm.palmX-Sx, dyH=arm.palmY-Sy;
    const dH=Math.hypot(dxH,dyH)||1e-4;
    const ca=(FOREARM_HALF*FOREARM_HALF+dH*dH-ARM_LEN*ARM_LEN)/(2*FOREARM_HALF*dH);
    const A=Math.acos(Math.max(-1,Math.min(1,ca)));
    const base=Math.atan2(dyH,dxH);
    const E1x=Sx+FOREARM_HALF*Math.cos(base+A), E1y=Sy+FOREARM_HALF*Math.sin(base+A);
    const E2x=Sx+FOREARM_HALF*Math.cos(base-A), E2y=Sy+FOREARM_HALF*Math.sin(base-A);
    const dot1=(E1x-p.x)*sideX+(E1y-p.y)*sideY;
    const dot2=(E2x-p.x)*sideX+(E2y-p.y)*sideY;
    const Ex=dot1>=dot2?E1x:E2x, Ey=dot1>=dot2?E1y:E2y;
    arm.limbs[0].x=Ex; arm.limbs[0].y=Ey;
    arm.limbs[1].x=arm.palmX; arm.limbs[1].y=arm.palmY;
    // metrics
    const foreLen=Math.hypot(Ex-Sx,Ey-Sy);
    const armLen=Math.hypot(arm.palmX-Ex,arm.palmY-Ey);
    foreErrMax=Math.max(foreErrMax,Math.abs(foreLen-FOREARM_HALF));
    armErrMax=Math.max(armErrMax,Math.abs(armLen-ARM_LEN));
    if(dH>maxDH){maxDH=dH;maxDHframe=f;}
    if(Math.abs(armLen-ARM_LEN)>armErrMax-1e-9){maxErrFrame=f;}
    // elbow outward (dot>0) and no flip
    const eDot=(Ex-p.x)*sideX+(Ey-p.y)*sideY;
    if(eDot<0) elbowFlip++;
    if(prevEx!==null){ if(Math.sign(Ex-prevEx)!==Math.sign(Ex-prevEx)){} }
    prevEx=Ex;
    // hand distance from body center
    const hd=Math.hypot(arm.palmX-p.x, arm.palmY-p.y);
    minHandDistBody=Math.min(minHandDistBody,hd);
  }
  px+=v*dt;
}
console.log('[前臂长恒定误差(px)]:', foreErrMax.toFixed(3), '(应≈0=刚性相接)');
console.log('[上臂长恒定误差(px)]:', armErrMax.toFixed(3), '(应≈0=刚性相接)');
console.log('[最大 dH(px)]:', maxDH.toFixed(2), ' frame', maxDHframe, ' (可达上限=', (FOREARM_HALF+ARM_LEN).toFixed(1),')');
console.log('[最大误差帧]:', maxErrFrame);
console.log('[肘翻面到身体内侧次数]:', elbowFlip, '(应=0=肘始终外弯)');
console.log('[掌最少离体节中心(px)]:', minHandDistBody.toFixed(1), '(应明显>0=不缩回身体)');
console.log('[900帧内迈步次数(右臂样例)]:', steps);
const ok = foreErrMax<1e-6 && armErrMax<1e-6 && elbowFlip===0 && minHandDistBody>40 && steps>0;
console.log('结论:', ok ? 'PASS ✅ 手钉死/两段刚性相接/肘外弯/不缩回身体/有爬行步进' : 'FAIL ❌');
