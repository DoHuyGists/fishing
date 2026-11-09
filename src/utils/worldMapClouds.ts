// A cached, seamless cloud height field. Light comes from the upper left;
// broad cloud banks and fine wisps share the same lighting rather than radial spots.
export function createWorldMapCloudTexture(): HTMLCanvasElement | null {
  const size = 512;
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = size;
  const context = canvas.getContext("2d", { willReadFrequently: true });
  if (!context) return null;

  const hash = (x: number, y: number) => {
    let value = Math.imul(x, 374761393) ^ Math.imul(y, 668265263);
    value = Math.imul(value ^ (value >>> 13), 1274126177);
    return ((value ^ (value >>> 16)) >>> 0) / 4294967295;
  };
  const noise = (x: number, y: number, period: number) => {
    const ix = Math.floor(x), iy = Math.floor(y);
    const tx = x - ix, ty = y - iy;
    const sx = tx * tx * (3 - 2 * tx), sy = ty * ty * (3 - 2 * ty);
    const wrap = (n: number) => ((n % period) + period) % period;
    const a = hash(wrap(ix), wrap(iy)), b = hash(wrap(ix + 1), wrap(iy));
    const c = hash(wrap(ix), wrap(iy + 1)), d = hash(wrap(ix + 1), wrap(iy + 1));
    return a + (b - a) * sx + (c - a) * sy + (a - b - c + d) * sx * sy;
  };
  const heights = new Float32Array(size * size);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const u = x / size, v = y / size;
      const warpX = (noise(u * 4, v * 4, 4) - 0.5) * 0.12;
      const warpY = (noise(u * 4 + 17, v * 4 + 9, 4) - 0.5) * 0.12;
      let height = 0, weight = 0.53;
      for (let frequency = 8; frequency <= 128; frequency *= 2) {
        height += noise((u + warpX) * frequency, (v + warpY) * frequency, frequency) * weight;
        weight *= 0.49;
      }
      heights[y * size + x] = height;
    }
  }

  const image = context.createImageData(size, size);
  const heightAt = (x: number, y: number) => heights[((y + size) % size) * size + (x + size) % size];
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const height = heightAt(x, y);
      const slope = (heightAt(x + 2, y + 2) - heightAt(x - 2, y - 2)) * 5.2;
      const light = Math.max(0, Math.min(1, 0.55 + (height - 0.5) * 1.15 + slope));
      const offset = (y * size + x) * 4;
      image.data[offset] = 190 + light * 65;
      image.data[offset + 1] = 207 + light * 48;
      image.data[offset + 2] = 219 + light * 36;
      image.data[offset + 3] = 255;
    }
  }
  context.putImageData(image, 0, 0);
  return canvas;
}
