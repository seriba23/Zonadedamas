const sharp = require('sharp');
const path = require('path');
const fs = require('fs');

const SRC = path.resolve(__dirname, '..', 'img', 'logoVF.png');
const OUT = path.resolve(__dirname, '..', 'apps', 'web', 'public', 'icons');
const TEAL = { r: 0, g: 128, b: 128 };

if (!fs.existsSync(OUT)) fs.mkdirSync(OUT, { recursive: true });

async function generate() {
  // Standard icons (the source already has the teal background, so resize directly)
  const sizes = [192, 512];
  for (const size of sizes) {
    await sharp(SRC)
      .resize(size, size, { fit: 'cover', background: TEAL })
      .png()
      .toFile(path.join(OUT, `icon-${size}.png`));
    console.log(`OK icon-${size}.png`);
  }

  // Maskable icon: 512 con safe zone (logo al 80% centrado, fondo teal alrededor)
  const safeSize = Math.round(512 * 0.8);
  await sharp(SRC)
    .resize(safeSize, safeSize, { fit: 'cover', background: TEAL })
    .extend({
      top: Math.round((512 - safeSize) / 2),
      bottom: Math.round((512 - safeSize) / 2),
      left: Math.round((512 - safeSize) / 2),
      right: Math.round((512 - safeSize) / 2),
      background: TEAL,
    })
    .png()
    .toFile(path.join(OUT, 'icon-maskable-512.png'));
  console.log('OK icon-maskable-512.png');

  // Apple touch icon 180x180
  await sharp(SRC)
    .resize(180, 180, { fit: 'cover', background: TEAL })
    .png()
    .toFile(path.join(OUT, 'apple-touch-icon.png'));
  console.log('OK apple-touch-icon.png');

  // Favicon 32 + 16
  for (const size of [32, 16]) {
    await sharp(SRC)
      .resize(size, size, { fit: 'cover', background: TEAL })
      .png()
      .toFile(path.join(OUT, `favicon-${size}.png`));
    console.log(`OK favicon-${size}.png`);
  }
}

generate().catch((err) => {
  console.error(err);
  process.exit(1);
});
