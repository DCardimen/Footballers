(() => {
  'use strict';

  const assets = [
    ['--rib-hero-sheet', './a_clean_high_resolution_game_ui_asset_sheet_on_a_1_batch_1.png'],
    ['--rib-panel-sheet', './a_clean_ui_graphic_assets_sprite_sheet_mockup_im_2_batch_2.png'],
    ['--rib-icon-sheet', './a_clean_graphic_artwork_ui_icon_sheet_on_a_trans_3_batch_3.png'],
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

  async function removeCheckerboard(src) {
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
      if (seen[index]) return;
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

    context.putImageData(pixels, 0, 0);
    const blob = await new Promise((resolve, reject) => canvas.toBlob((value) => value ? resolve(value) : reject(new Error(`Failed to encode menu asset: ${src}`)), 'image/png'));
    return URL.createObjectURL(blob);
  }

  async function start() {
    const root = document.documentElement;
    try {
      for (const [property, src] of assets) {
        const cleaned = await removeCheckerboard(src);
        root.style.setProperty(property, `url("${cleaned}")`);
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
