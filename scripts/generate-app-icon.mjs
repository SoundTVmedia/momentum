import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const iconSvg = fileURLToPath(new URL("../resources/icon.svg", import.meta.url));
const iconPng = fileURLToPath(new URL("../resources/icon.png", import.meta.url));

const svg = readFileSync(iconSvg);
await sharp(svg, { density: 384 })
  .resize(1024, 1024)
  .png()
  .toFile(iconPng);

console.log("Wrote resources/icon.png");
