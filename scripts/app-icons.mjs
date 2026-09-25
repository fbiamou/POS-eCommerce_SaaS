// Draws the icons of the installed app (home screen of a phone, desktop of a
// computer) from the WISHOP mark: the white W thread and its saffron lozenge
// on indigo night. Run once after changing the mark: node scripts/app-icons.mjs
import sharp from "sharp";
import { mkdir } from "node:fs/promises";

const NIGHT = "#141C45";
const SAFFRON = "#F4B63F";

// The mark (src/components/brand/WishopMark.tsx) is drawn in a 48 × 44 box.
// `scale` is the share of the icon it fills: smaller for "maskable" icons,
// which Android may cut into a circle.
function iconSvg(size, scale, rounded) {
  const markWidth = size * scale;
  const unit = markWidth / 48;
  const x = (size - markWidth) / 2;
  const y = (size - 44 * unit) / 2 + 2 * unit;
  const radius = rounded ? size * 0.22 : 0;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
  <rect width="${size}" height="${size}" rx="${radius}" fill="${NIGHT}"/>
  <g transform="translate(${x} ${y}) scale(${unit})">
    <polyline points="4,9 14,33 24,17 34,33 44,9" fill="none" stroke="#FFFFFF" stroke-width="6" stroke-miterlimit="4"/>
    <path d="M24 0l5 5-5 5-5-5z" fill="${SAFFRON}"/>
  </g>
</svg>`;
}

const icons = [
  { file: "icon-192.png", size: 192, scale: 0.62, rounded: true },
  { file: "icon-512.png", size: 512, scale: 0.62, rounded: true },
  { file: "icon-maskable-512.png", size: 512, scale: 0.5, rounded: false },
  { file: "apple-touch-icon.png", size: 180, scale: 0.6, rounded: false },
];

await mkdir("public/icons", { recursive: true });
for (const { file, size, scale, rounded } of icons) {
  await sharp(Buffer.from(iconSvg(size, scale, rounded))).png().toFile(`public/icons/${file}`);
  console.log(`public/icons/${file}`);
}
