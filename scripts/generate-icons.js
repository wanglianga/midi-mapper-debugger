import { writeFileSync } from "fs";
import { createCanvas, loadImage } from "canvas";

async function generateIcon(size, outputPath) {
  const canvas = createCanvas(size, size);
  const ctx = canvas.getContext("2d");

  const gradient = ctx.createLinearGradient(0, 0, size, size);
  gradient.addColorStop(0, "#6366f1");
  gradient.addColorStop(1, "#8b5cf6");

  const radius = size * 0.125;
  ctx.beginPath();
  ctx.roundRect(0, 0, size, size, radius);
  ctx.fillStyle = gradient;
  ctx.fill();

  ctx.fillStyle = "white";
  const keyWidth = size * 0.0625;
  const keyHeight = size * 0.53125;
  const keySpacing = size * 0.109375;
  const startX = size * 0.15625;
  const startY = size * 0.234375;

  const keyHeights = [
    keyHeight,
    keyHeight * 0.7647,
    keyHeight,
    keyHeight * 0.7647,
    keyHeight,
    keyHeight * 0.7647,
    keyHeight,
  ];

  for (let i = 0; i < 7; i++) {
    const x = startX + i * keySpacing;
    const h = keyHeights[i];
    ctx.beginPath();
    ctx.roundRect(x, startY, keyWidth, h, size * 0.015625);
    ctx.fill();
  }

  ctx.fillStyle = "#1e1b4b";
  const blackKeyWidth = size * 0.046875;
  const blackKeyHeight = keyHeight * 0.4706;
  const blackKeyPositions = [0.6, 2.65, 4.6, 5.55];

  for (const pos of blackKeyPositions) {
    const x = startX + pos * keySpacing;
    ctx.beginPath();
    ctx.roundRect(x, startY, blackKeyWidth, blackKeyHeight, size * 0.0078125);
    ctx.fill();
  }

  ctx.beginPath();
  ctx.arc(size * 0.5, size * 0.859375, size * 0.046875, 0, Math.PI * 2);
  ctx.fillStyle = "#22c55e";
  ctx.fill();

  const buffer = canvas.toBuffer("image/png");
  writeFileSync(outputPath, buffer);
  console.log(`Generated ${outputPath}`);
}

async function main() {
  try {
    await generateIcon(32, "src-tauri/icons/32x32.png");
    await generateIcon(128, "src-tauri/icons/128x128.png");
    await generateIcon(256, "src-tauri/icons/128x128@2x.png");
    console.log("All icons generated successfully!");
  } catch (error) {
    console.error("Failed to generate icons:", error);
    console.log("Using placeholder icons. You can replace them later.");
    
    const placeholder = Buffer.from(
      "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==",
      "base64"
    );
    
    writeFileSync("src-tauri/icons/32x32.png", placeholder);
    writeFileSync("src-tauri/icons/128x128.png", placeholder);
    writeFileSync("src-tauri/icons/128x128@2x.png", placeholder);
    
    const icoHeader = Buffer.from([0x00, 0x00, 0x01, 0x00, 0x01, 0x00, 0x20, 0x20, 0x00, 0x00, 0x01, 0x00, 0x20, 0x00, 0x68, 0x04, 0x00, 0x00, 0x16, 0x00, 0x00, 0x00]);
    writeFileSync("src-tauri/icons/icon.ico", icoHeader);
    writeFileSync("src-tauri/icons/icon.icns", icoHeader);
  }
}

main().catch(console.error);
