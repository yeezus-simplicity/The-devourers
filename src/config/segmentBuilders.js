// ===== config/segmentBuilders.js =====
// Per-character worm segment builders.
//
// These were previously methods on the CHARACTERS objects in characters.js.
// They are pulled out here because JSON cannot hold functions — the data now
// lives in characters.json and each builder is re-attached by characters.js
// at load time. They are called as `currentChar.buildSegments(imgs, count, …)`
// so `this` still points at the (JSON-derived) character config.

import { currentChar } from '../core/globals.js';

export const SEGMENT_BUILDERS = {
  // 渊海灾虫：交替 body1/body2，一次成对其加入保持交替
  aquatic_scourge(imgs, count) {
    const s = [{ type: 'head', img: imgs.head, angle: 0, dist: 0, orient: 'v' }];
    const n = Math.max(2, Math.floor(count));
    const bodyCount = n + (n % 2);
    for (let i = 0; i < bodyCount; i++) {
      const type = i % 2 === 0 ? 'body1' : 'body2';
      s.push({ type, img: imgs[type], angle: 0, dist: 0, orient: 'v' });
    }
    s.push({ type: 'tail', img: imgs.tail, angle: 0, dist: 0, orient: 'v' });
    return { segments: s, bodyCount };
  },

  // 荒漠灾虫：4 种固定体节 + 仅在 body_02/body_04 之间追加 body_03
  desert_scourge(imgs, count) {
    const total = Math.max(4, Math.floor(count || this.bodyCount || 4));
    const k = total - 3; // body_03 段数（01/02/04 各固定 1 个）
    const s = [{ type: 'head', frameKey: 'head', angle: 0, dist: 0, orient: 'v' }];
    s.push({ type: 'body_01', img: imgs.body_01, angle: 0, dist: 0, orient: 'v' });
    s.push({ type: 'body_02', img: imgs.body_02, angle: 0, dist: 0, orient: 'v' });
    for (let i = 0; i < k; i++) {
      s.push({ type: 'body_03', img: imgs.body_03, angle: 0, dist: 0, orient: 'v' });
    }
    s.push({ type: 'body_04', img: imgs.body_04, angle: 0, dist: 0, orient: 'v' });
    s.push({ type: 'tail', img: imgs.tail, angle: 0, dist: 0, orient: 'v' });
    return { segments: s, bodyCount: total };
  },

  // 穿孔者：large/medium/small 三种变体
  the_perforator(imgs) {
    const v = this.variants[this.currentVariant];
    const pfx = v.spritePrefix;
    const s = [{ type: 'head', img: imgs[pfx + '_head'], angle: 0, dist: 0, orient: 'v' }];
    if (v.hasAltBody) {
      for (let i = 0; i < v.bodyCount; i++) {
        const type = i % 2 === 0 ? 'body1' : 'body2';
        s.push({ type, img: imgs[pfx + '_' + type], angle: 0, dist: 0, orient: 'v' });
      }
    } else {
      for (let i = 0; i < v.bodyCount; i++) {
        s.push({ type: 'body', img: imgs[pfx + '_body'], angle: 0, dist: 0, orient: 'v' });
      }
    }
    s.push({ type: 'tail', img: imgs[pfx + '_tail'], angle: 0, dist: 0, orient: 'v' });
    return { segments: s, bodyCount: v.bodyCount };
  },

  // XM-05 塔纳托斯：交替 body1/body2，带精灵表与发光层
  xm05_thanatos(imgs) {
    const s = [{ type: 'head', frameKey: 'head', angle: 0, dist: 0, orient: 'v' }];
    for (let i = 0; i < this.bodyCount; i++) {
      const fk = i % 2 === 0 ? 'body1' : 'body2';
      s.push({ type: fk, frameKey: fk, angle: 0, dist: 0, orient: 'v' });
    }
    s.push({ type: 'tail', frameKey: 'tail', angle: 0, dist: 0, orient: 'v' });
    return { segments: s, bodyCount: this.bodyCount };
  },

  // Astrum Deus 星神：严格交替 altspectral/body，双虫模式由 Scourge.buildSegments 驱动
  astrum_deus(imgs, count, glowSuffix = '') {
    const gs = glowSuffix;
    const s = [
      { type: 'head', img: imgs.head, angle: 0, dist: 0, orient: 'v', glowKey: 'head_glows' + gs }
    ];
    for (let i = 0; i < count; i++) {
      const isAlt = i % 2 === 0;
      s.push({
        type: isAlt ? 'body_alt' : 'body',
        img: isAlt ? imgs.body_alt_spectral : imgs.body,
        angle: 0, dist: 0, orient: 'v',
        glowKey: (isAlt ? 'body_alt_glows' : 'body_glows') + gs
      });
    }
    s.push({ type: 'tail', img: imgs.tail, angle: 0, dist: 0, orient: 'v', glowKey: 'tail_glows' + gs });
    return { segments: s, bodyCount: count };
  },

  // Devourer of Gods：P1/P2 + armorOff（无颚纯能量）形态切换
  devourer_of_gods(imgs, count, phase = 1) {
    const p = phase || 1;
    const isP2 = p >= 2;
    const armorOff = !!currentChar.armorOff;
    const headImg = armorOff ? imgs.head_p2_cyan : (isP2 ? imgs.head_final : imgs.head);
    const bodyImg = armorOff ? imgs.body_p2_cyan : (isP2 ? imgs.body_final : imgs.body);
    const tailImg = armorOff ? imgs.tail_p2_cyan : (isP2 ? imgs.tail_final : imgs.tail);
    const headGlow = armorOff
      ? [imgs.head_p2_cyan, imgs.head_p2_purple].filter(Boolean)
      : (isP2 ? [imgs.head_p2_cyan, imgs.head_p2_purple].filter(Boolean) : [imgs.head_cyan, imgs.head_purple].filter(Boolean));
    const bodyGlow = armorOff
      ? [imgs.body_p2_cyan, imgs.body_p2_purple].filter(Boolean)
      : (isP2 ? [imgs.body_p2_cyan, imgs.body_p2_purple].filter(Boolean) : [imgs.body_glow].filter(Boolean));
    const tailGlow = armorOff
      ? [imgs.tail_p2_cyan, imgs.tail_p2_purple].filter(Boolean)
      : (isP2 ? [imgs.tail_p2_cyan, imgs.tail_p2_purple].filter(Boolean) : [imgs.tail_cyan, imgs.tail_purple].filter(Boolean));
    const s = [{ type: 'head', img: headImg, angle: 0, dist: 0, orient: 'v', glowKey: '__dog_head_glow__' }];
    for (let i = 0; i < count; i++) {
      s.push({ type: 'body', img: bodyImg, angle: 0, dist: 0, orient: 'v', glowKey: '__dog_body_glow__' });
    }
    s.push({ type: 'tail', img: tailImg, angle: 0, dist: 0, orient: 'v', glowKey: '__dog_tail_glow__' });
    imgs['__dog_head_glow__'] = headGlow;
    imgs['__dog_body_glow__'] = bodyGlow;
    imgs['__dog_tail_glow__'] = tailGlow;
    return { segments: s, bodyCount: count };
  },

  // Storm Weaver 风暴编织者：装甲/裸装双形态（P 键切换），尾部亮纹内建于装甲尾贴图
  storm_weaver(imgs, count) {
    const naked = !!currentChar.armorOff;
    const s = [
      { type: 'head', img: naked ? imgs.head_naked : imgs.head, angle: 0, dist: 0, orient: 'v' }
    ];
    for (let i = 0; i < count; i++) {
      s.push({ type: 'body', img: naked ? imgs.body_naked : imgs.body, angle: 0, dist: 0, orient: 'v' });
    }
    s.push({ type: 'tail', img: naked ? imgs.tail_naked : imgs.tail, angle: 0, dist: 0, orient: 'v', glowKey: 'tail_glow' });
    return { segments: s, bodyCount: count };
  },

  // Primordial Wyrm（成年幻海妖龙）：头部与尾部均连接普通体节（不带 alternate），
  // 中间 body1/body_alt 严格交替；初始 7 节，bodyStyle='alternating' 使 ↑/↓ 一次成对 ±2。
  primordial_wyrm(imgs, count) {
    const n = Math.max(1, Math.floor(count));
    const s = [{ type: 'head', img: imgs.head, angle: 0, dist: 0, orient: 'v' }];
    for (let i = 0; i < n; i++) {
      const isAlt = i % 2 === 1;            // 0,2,4…=普通 body；1,3,5…=alternate
      s.push({ type: isAlt ? 'body_alt' : 'body', img: isAlt ? imgs.body_alt : imgs.body, angle: 0, dist: 0, orient: 'v' });
    }
    s.push({ type: 'tail', img: imgs.tail, angle: 0, dist: 0, orient: 'v' });
    return { segments: s, bodyCount: n };
  },

  // 墓穴魔 Sepulcher：头部后是左体节(body1)，之后交替 body1/body2，与尾部相连的也是左体节；
  // 能量球保留在头尾：head → ball → body → ball → … → body → ball → tail。
  // 体节数强制奇数 → 两端始终是左体节。头→球距离由 Scourge.buildSegments 的 Math.max(0,…) 保证非负，避免振荡。
  sepulcher(imgs, count) {
    const n = Math.max(3, Math.floor(count));
    const bodyCount = n % 2 === 0 ? n + 1 : n;   // 强制奇数，保证头尾都是左体节
    const core = [{ type: 'head', img: imgs.head, angle: 0, dist: 0, orient: 'v' }];
    for (let i = 0; i < bodyCount; i++) {
      const isLeft = i % 2 === 0;
      core.push({ type: isLeft ? 'body1' : 'body2', img: isLeft ? imgs.body1 : imgs.body2, angle: 0, dist: 0, orient: 'v' });
    }
    core.push({ type: 'tail', img: imgs.tail, angle: 0, dist: 0, orient: 'v' });
    // 每个体节（除头部）之前都插一个能量球 → 头尾都有球
    const s = [];
    for (let i = 0; i < core.length; i++) {
      if (i > 0) s.push({ type: 'energy_ball', frameKey: 'energy_ball', angle: 0, dist: 0, orient: 'v' });
      s.push(core[i]);
    }
    return { segments: s, bodyCount };
  }
};
