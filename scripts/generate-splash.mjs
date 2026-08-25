import { copyFileSync, mkdirSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { dirname, extname, join } from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const root = fileURLToPath(new URL("..", import.meta.url));
const SIZE = 2732;
const ICON_SIZE = 512;
const WORDMARK_WIDTH = 620;

function walkPngs(dir, acc = []) {
  let entries;
  try {
    entries = readdirSync(dir);
  } catch {
    return acc;
  }
  for (const name of entries) {
    const p = join(dir, name);
    const st = statSync(p);
    if (st.isDirectory()) {
      walkPngs(p, acc);
      continue;
    }
    if (extname(name).toLowerCase() !== ".png") continue;
    const splashLike =
      /^splash/i.test(name) || /^Default@.*anyany/i.test(name);
    if (splashLike) acc.push(p);
  }
  return acc;
}

function textSvg({
  width,
  height,
  text,
  fontSize,
  letterSpacing = 0,
  fontWeight = 700,
  fill = "#ffffff",
}) {
  return Buffer.from(
    `<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
      <text
        x="50%"
        y="50%"
        dominant-baseline="middle"
        text-anchor="middle"
        font-family="Arial, Helvetica, sans-serif"
        font-size="${fontSize}"
        font-weight="${fontWeight}"
        fill="${fill}"
        letter-spacing="${letterSpacing}"
      >${text}</text>
    </svg>`,
  );
}

const iconPath = join(root, "resources/icon.png");
const wordmarkPath = join(root, "public/brands/jambase-wordmark.svg");
const splashPath = join(root, "resources/splash.png");

const icon = await sharp(iconPath).resize(ICON_SIZE, ICON_SIZE).png().toBuffer();
const wordmark = await sharp(wordmarkPath)
  .resize({ width: WORDMARK_WIDTH })
  .png()
  .toBuffer();
const wordmarkMeta = await sharp(wordmark).metadata();
const wordmarkHeight = wordmarkMeta.height ?? Math.round(WORDMARK_WIDTH * (72.558 / 510.998));

const welcome = await sharp(
  textSvg({
    width: SIZE,
    height: 140,
    text: "Welcome to Feedback",
    fontSize: 78,
  }),
)
  .png()
  .toBuffer();

const powered = await sharp(
  textSvg({
    width: SIZE,
    height: 64,
    text: "Powered By",
    fontSize: 32,
    letterSpacing: 8,
    fontWeight: 600,
    fill: "#cccccc",
  }),
)
  .png()
  .toBuffer();

const iconLeft = Math.round((SIZE - ICON_SIZE) / 2);
const iconTop = Math.round(SIZE * 0.42 - ICON_SIZE / 2);
const welcomeTop = iconTop + ICON_SIZE + 36;
const poweredTop = SIZE - 380;
const wordmarkLeft = Math.round((SIZE - WORDMARK_WIDTH) / 2);
const wordmarkTop = poweredTop + 70;

const master = await sharp({
  create: {
    width: SIZE,
    height: SIZE,
    channels: 3,
    background: "#000000",
  },
})
  .composite([
    { input: icon, left: iconLeft, top: iconTop },
    { input: welcome, left: 0, top: welcomeTop },
    { input: powered, left: 0, top: poweredTop },
    { input: wordmark, left: wordmarkLeft, top: wordmarkTop },
  ])
  .png()
  .toBuffer();

mkdirSync(dirname(splashPath), { recursive: true });
writeFileSync(splashPath, master);
console.log("Wrote resources/splash.png");

const targets = [
  splashPath,
  ...walkPngs(join(root, "ios/App/App/Assets.xcassets/Splash.imageset")),
  ...walkPngs(join(root, "android/app/src/main/res")),
];

const unique = [...new Set(targets)];
for (const dest of unique) {
  mkdirSync(dirname(dest), { recursive: true });
  if (dest === splashPath) continue;
  const meta = await sharp(dest).metadata().catch(() => null);
  const width = meta?.width ?? SIZE;
  const height = meta?.height ?? SIZE;
  if (width === SIZE && height === SIZE) {
    copyFileSync(splashPath, dest);
  } else {
    await sharp(master)
      .resize(width, height, { fit: "cover", position: "centre" })
      .png()
      .toFile(dest);
  }
  console.log(`Wrote ${dest.replace(root + "/", "")} (${width}x${height})`);
}
