(() => {
  'use strict';

  // cells: measured sub-regions exported as standalone images so buttons can
  // use true 9-slice frames and uniform-scale textures instead of sheet crops.
  const assets = [
    { property: '--rib-hero-sheet', src: './a_clean_high_resolution_game_ui_asset_sheet_on_a_1_batch_1.png', enclosedBackgroundSeeds: [[132, 1100]], cells: [] },
    { property: '--rib-panel-sheet', src: './a_clean_ui_graphic_assets_sprite_sheet_mockup_im_2_batch_2.png', enclosedBackgroundSeeds: [], cells: [
      ['--rib-cell-gold', 823, 345, 392, 135],
      ['--rib-cell-navy', 823, 495, 392, 111],
      ['--rib-cell-square', 823, 621, 148, 161],
      ['--rib-divider-gold', 62, 823, 719, 29],
      ['--rib-spark-gold', 633, 900, 362, 44],
      ['--rib-tex-stadium', 61, 1024, 357, 180],
      ['--rib-tex-gold', 462, 1020, 351, 183],
      ['--rib-tex-navy', 857, 1020, 337, 183],
    ] },
    { property: '--rib-icon-sheet', src: './a_clean_graphic_artwork_ui_icon_sheet_on_a_trans_3_batch_3.png', enclosedBackgroundSeeds: [[627, 528]], cells: [
      ['--rib-chevron', 401, 994, 94, 130],
    ] },
  ];

  const isBackground = (data, offset) => {
    const r = data[offset];
    const g = data[offset + 1];
    const b = data[offset + 2];
    const hi = Math.max(r, g, b);
    const lo = Math.min(r, g, b);
    return lo > 190 && hi - lo < 18;
  };

  const loadImage = (src) => new Promise((resolve, reject) => {
    const image = new Image();
    image.decoding = 'async';
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error(`Failed to load menu asset: ${src}`));
    image.src = src;
  });

  async function removeCheckerboard(src, enclosedBackgroundSeeds = []) {
    const image = await loadImage(src);
    const canvas = document.createElement('canvas');
    canvas.width = image.naturalWidth;
    canvas.height = image.naturalHeight;
    const context = canvas.getContext('2d', { willReadFrequently: true });
    context.drawImage(image, 0, 0);
    const pixels = context.getImageData(0, 0, canvas.width, canvas.height);
    const { data, width, height } = pixels;
    const count = width * height;
    const seen = new Uint8Array(count);
    const queue = new Int32Array(count);
    let head = 0;
    let tail = 0;

    const enqueue = (index) => {
      if (index < 0 || index >= count || seen[index]) return;
      const offset = index * 4;
      if (!isBackground(data, offset)) return;
      seen[index] = 1;
      queue[tail++] = index;
    };

    for (let x = 0; x < width; x += 1) {
      enqueue(x);
      enqueue((height - 1) * width + x);
    }
    for (let y = 1; y < height - 1; y += 1) {
      enqueue(y * width);
      enqueue(y * width + width - 1);
    }
    for (const [x, y] of enclosedBackgroundSeeds) enqueue(Math.round(y) * width + Math.round(x));

    while (head < tail) {
      const index = queue[head++];
      const x = index % width;
      const y = (index - x) / width;
      if (x > 0) enqueue(index - 1);
      if (x + 1 < width) enqueue(index + 1);
      if (y > 0) enqueue(index - width);
      if (y + 1 < height) enqueue(index + width);
    }

    for (let index = 0; index < count; index += 1) {
      if (seen[index]) data[index * 4 + 3] = 0;
    }

    // De-fringe: foreground pixels within a few px of removed background were
    // blended with the white backdrop, which leaves a white halo around every
    // sprite edge. Estimate their true coverage from how far they are from
    // white and un-blend the color so edges stay clean against dark UI.
    const fringe = new Uint8Array(count);
    let frontier = [];
    for (let index = 0; index < count; index += 1) {
      if (seen[index]) continue;
      const x = index % width;
      const y = (index - x) / width;
      if ((x > 0 && seen[index - 1]) || (x + 1 < width && seen[index + 1]) ||
          (y > 0 && seen[index - width]) || (y + 1 < height && seen[index + width])) {
        fringe[index] = 1;
        frontier.push(index);
      }
    }
    for (let ringNo = 2; ringNo <= 3; ringNo += 1) {
      const next = [];
      for (const index of frontier) {
        const x = index % width;
        const y = (index - x) / width;
        const neighbors = [x > 0 ? index - 1 : -1, x + 1 < width ? index + 1 : -1, y > 0 ? index - width : -1, y + 1 < height ? index + width : -1];
        for (const n of neighbors) {
          if (n >= 0 && !seen[n] && !fringe[n]) {
            fringe[n] = ringNo;
            next.push(n);
          }
        }
      }
      frontier = next;
    }
    for (let index = 0; index < count; index += 1) {
      if (!fringe[index]) continue;
      const offset = index * 4;
      const lo = Math.min(data[offset], data[offset + 1], data[offset + 2]);
      const coverage = Math.min(1, (255 - lo) / 200);
      if (coverage <= 0.03) {
        data[offset + 3] = 0;
        continue;
      }
      for (let channel = 0; channel < 3; channel += 1) {
        const value = (data[offset + channel] - (1 - coverage) * 255) / coverage;
        data[offset + channel] = Math.max(0, Math.min(255, Math.round(value)));
      }
      data[offset + 3] = Math.round(data[offset + 3] * coverage);
    }

    context.putImageData(pixels, 0, 0);
    return canvas;
  }

  const canvasUrl = (canvas, label) => new Promise((resolve, reject) =>
    canvas.toBlob((value) => value ? resolve(URL.createObjectURL(value)) : reject(new Error(`Failed to encode menu asset: ${label}`)), 'image/png'));

  async function start() {
    const root = document.documentElement;
    try {
      for (const asset of assets) {
        const cleaned = await removeCheckerboard(asset.src, asset.enclosedBackgroundSeeds);
        root.style.setProperty(asset.property, `url("${await canvasUrl(cleaned, asset.src)}")`);
        for (const [property, x, y, w, h] of asset.cells) {
          const cell = document.createElement('canvas');
          cell.width = w;
          cell.height = h;
          cell.getContext('2d').drawImage(cleaned, x, y, w, h, 0, 0, w, h);
          root.style.setProperty(property, `url("${await canvasUrl(cell, property)}")`);
        }
      }
      root.classList.add('rib-assets-ready');
      window.__RIB_MENU_ASSETS = { ready: true };
    } catch (error) {
      console.error('[RIB menu assets]', error);
      root.classList.add('rib-assets-ready', 'rib-assets-failed');
      window.__RIB_MENU_ASSETS = { ready: false, error: String(error) };
    }
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, { once: true });
  else start();
})();
