import { writeFileSync } from "fs";

const png1x1 = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==",
  "base64"
);

function createPNG(width, height, r, g, b, a = 255) {
  const signature = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

  function crc32(data) {
    let crc = 0xffffffff;
    const table = new Array(256);
    for (let i = 0; i < 256; i++) {
      let c = i;
      for (let j = 0; j < 8; j++) {
        c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
      }
      table[i] = c;
    }
    for (let i = 0; i < data.length; i++) {
      crc = table[(crc ^ data[i]) & 0xff] ^ (crc >>> 8);
    }
    return (crc ^ 0xffffffff) >>> 0;
  }

  function chunk(type, data) {
    const length = Buffer.alloc(4);
    length.writeUInt32BE(data.length, 0);
    const typeData = Buffer.concat([Buffer.from(type), data]);
    const crcVal = Buffer.alloc(4);
    crcVal.writeUInt32BE(crc32(typeData), 0);
    return Buffer.concat([length, typeData, crcVal]);
  }

  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;
  ihdr[9] = 6;
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;

  const rawData = [];
  for (let y = 0; y < height; y++) {
    rawData.push(0);
    for (let x = 0; x < width; x++) {
      const centerX = width / 2;
      const centerY = height / 2;
      const dist = Math.sqrt(Math.pow(x - centerX, 2) + Math.pow(y - centerY, 2));
      const maxDist = Math.min(width, height) / 2;
      const t = Math.min(1, dist / maxDist);
      const f = Math.pow(1 - t, 1.5);
      
      const px = Math.floor(r * f + 30 * (1 - f));
      const py = Math.floor(g * f + 27 * (1 - f));
      const pz = Math.floor(b * f + 75 * (1 - f));
      
      rawData.push(px, py, pz, a);
    }
  }

  const deflate = (data) => {
    const raw = Buffer.from(data);
    const deflated = [];
    
    deflated.push(0x78, 0x01);
    
    let pos = 0;
    while (pos < raw.length) {
      const remaining = raw.length - pos;
      const blockSize = Math.min(remaining, 65535);
      const isLast = pos + blockSize >= raw.length;
      
      deflated.push(isLast ? 0x01 : 0x00);
      deflated.push(blockSize & 0xff);
      deflated.push((blockSize >> 8) & 0xff);
      deflated.push((~blockSize) & 0xff);
      deflated.push(((~blockSize) >> 8) & 0xff);
      
      for (let i = 0; i < blockSize; i++) {
        deflated.push(raw[pos + i]);
      }
      
      pos += blockSize;
    }
    
    let a = 1, b = 0;
    for (let i = 0; i < raw.length; i++) {
      a = (a + raw[i]) % 65521;
      b = (b + a) % 65521;
    }
    const adler32 = (b << 16) | a;
    deflated.push((adler32 >> 24) & 0xff);
    deflated.push((adler32 >> 16) & 0xff);
    deflated.push((adler32 >> 8) & 0xff);
    deflated.push(adler32 & 0xff);
    
    return Buffer.from(deflated);
  };

  const idatData = deflate(rawData);
  
  return Buffer.concat([
    signature,
    chunk("IHDR", ihdr),
    chunk("IDAT", idatData),
    chunk("IEND", Buffer.alloc(0))
  ]);
}

function createICO(pngBuffer, size) {
  const icoHeader = Buffer.alloc(6);
  icoHeader.writeUInt16LE(0, 0);
  icoHeader.writeUInt16LE(1, 2);
  icoHeader.writeUInt16LE(1, 4);
  
  const entry = Buffer.alloc(16);
  entry[0] = size === 256 ? 0 : size;
  entry[1] = size === 256 ? 0 : size;
  entry[2] = 0;
  entry[3] = 0;
  entry.writeUInt16LE(1, 4);
  entry.writeUInt16LE(32, 6);
  entry.writeUInt32LE(pngBuffer.length, 8);
  entry.writeUInt32LE(22, 12);
  
  return Buffer.concat([icoHeader, entry, pngBuffer]);
}

try {
  const icon32 = createPNG(32, 32, 99, 102, 241);
  const icon128 = createPNG(128, 128, 99, 102, 241);
  const icon256 = createPNG(256, 256, 99, 102, 241);
  
  writeFileSync("src-tauri/icons/32x32.png", icon32);
  writeFileSync("src-tauri/icons/128x128.png", icon128);
  writeFileSync("src-tauri/icons/128x128@2x.png", icon256);
  writeFileSync("src-tauri/icons/icon.ico", createICO(icon128, 128));
  writeFileSync("src-tauri/icons/icon.icns", icon128);
  
  console.log("All icons generated successfully!");
} catch (error) {
  console.error("Failed to generate icons:", error);
  
  writeFileSync("src-tauri/icons/32x32.png", png1x1);
  writeFileSync("src-tauri/icons/128x128.png", png1x1);
  writeFileSync("src-tauri/icons/128x128@2x.png", png1x1);
  writeFileSync("src-tauri/icons/icon.ico", png1x1);
  writeFileSync("src-tauri/icons/icon.icns", png1x1);
  
  console.log("Placeholder icons created.");
}
