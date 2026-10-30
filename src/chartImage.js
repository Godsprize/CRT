import { deflateSync } from "node:zlib";

const WIDTH = 1000;
const HEIGHT = 620;
const PADDING = { top: 44, right: 48, bottom: 72, left: 70 };

export function renderCrtChartPng({ candles, signal }) {
  const image = createImage(WIDTH, HEIGHT, [250, 250, 248, 255]);
  const chart = {
    left: PADDING.left,
    top: PADDING.top,
    right: WIDTH - PADDING.right,
    bottom: HEIGHT - PADDING.bottom
  };

  const visible = candles.slice(-30);
  const prices = visible.flatMap((candle) => [candle.high, candle.low]);
  const min = Math.min(...prices);
  const max = Math.max(...prices);
  const range = Math.max(max - min, Number.EPSILON);
  const priceToY = (price) =>
    chart.bottom - ((price - min) / range) * (chart.bottom - chart.top);

  drawGrid(image, chart);

  const [rangeCandle, manipulationCandle] = signal.candles;
  const accumulationTop = priceToY(rangeCandle.high);
  const accumulationBottom = priceToY(rangeCandle.low);
  drawRect(
    image,
    chart.left,
    accumulationTop,
    chart.right - chart.left,
    accumulationBottom - accumulationTop,
    [49, 130, 206, 36]
  );
  drawLine(image, chart.left, accumulationTop, chart.right, accumulationTop, [35, 90, 160, 255], 2);
  drawLine(image, chart.left, accumulationBottom, chart.right, accumulationBottom, [35, 90, 160, 255], 2);

  const candleStep = (chart.right - chart.left) / visible.length;
  const candleWidth = Math.max(8, candleStep * 0.52);
  for (const [index, candle] of visible.entries()) {
    const x = chart.left + candleStep * index + candleStep / 2;
    drawCandle(image, candle, x, candleWidth, priceToY);
  }

  const manipulationIndex = visible.findIndex((candle) => candle.epoch === manipulationCandle.epoch);
  if (manipulationIndex >= 0) {
    const x = chart.left + candleStep * manipulationIndex + candleStep / 2;
    const highY = priceToY(manipulationCandle.high);
    const lowY = priceToY(manipulationCandle.low);
    drawOutline(
      image,
      x - candleWidth * 0.95,
      highY - 16,
      candleWidth * 1.9,
      lowY - highY + 32,
      [230, 126, 34, 255],
      4
    );
  }

  drawLegend(image, signal.direction);
  return encodePng(image);
}

function createImage(width, height, color) {
  const data = new Uint8Array(width * height * 4);
  for (let i = 0; i < data.length; i += 4) data.set(color, i);
  return { width, height, data };
}

function drawGrid(image, chart) {
  drawRect(image, chart.left, chart.top, chart.right - chart.left, chart.bottom - chart.top, [255, 255, 255, 255]);
  for (let i = 0; i <= 5; i++) {
    const y = chart.top + ((chart.bottom - chart.top) / 5) * i;
    drawLine(image, chart.left, y, chart.right, y, [226, 226, 220, 255], 1);
  }
}

function drawCandle(image, candle, x, width, priceToY) {
  const bullish = candle.close >= candle.open;
  const color = bullish ? [32, 151, 112, 255] : [207, 69, 69, 255];
  const openY = priceToY(candle.open);
  const closeY = priceToY(candle.close);
  const highY = priceToY(candle.high);
  const lowY = priceToY(candle.low);
  drawLine(image, x, highY, x, lowY, color, 2);
  drawRect(image, x - width / 2, Math.min(openY, closeY), width, Math.max(3, Math.abs(closeY - openY)), color);
}

function drawLegend(image, direction) {
  drawRect(image, 70, 560, 22, 12, [49, 130, 206, 80]);
  drawRect(image, 340, 558, 22, 16, [230, 126, 34, 255]);
  drawRect(image, 650, 558, 22, 16, direction === "bullish" ? [32, 151, 112, 255] : [207, 69, 69, 255]);
}

function drawOutline(image, x, y, width, height, color, thickness) {
  drawRect(image, x, y, width, thickness, color);
  drawRect(image, x, y + height - thickness, width, thickness, color);
  drawRect(image, x, y, thickness, height, color);
  drawRect(image, x + width - thickness, y, thickness, height, color);
}

function drawLine(image, x1, y1, x2, y2, color, thickness = 1) {
  const steps = Math.max(Math.abs(x2 - x1), Math.abs(y2 - y1));
  for (let i = 0; i <= steps; i++) {
    const t = steps === 0 ? 0 : i / steps;
    drawRect(image, x1 + (x2 - x1) * t - thickness / 2, y1 + (y2 - y1) * t - thickness / 2, thickness, thickness, color);
  }
}

function drawRect(image, x, y, width, height, color) {
  const startX = Math.max(0, Math.floor(x));
  const endX = Math.min(image.width, Math.ceil(x + width));
  const startY = Math.max(0, Math.floor(y));
  const endY = Math.min(image.height, Math.ceil(y + height));
  for (let yy = startY; yy < endY; yy++) {
    for (let xx = startX; xx < endX; xx++) {
      blendPixel(image, xx, yy, color);
    }
  }
}

function blendPixel(image, x, y, source) {
  const offset = (y * image.width + x) * 4;
  const alpha = source[3] / 255;
  for (let channel = 0; channel < 3; channel++) {
    image.data[offset + channel] = Math.round(
      source[channel] * alpha + image.data[offset + channel] * (1 - alpha)
    );
  }
  image.data[offset + 3] = 255;
}

function encodePng(image) {
  const raw = Buffer.alloc((image.width * 4 + 1) * image.height);
  for (let y = 0; y < image.height; y++) {
    const rowStart = y * (image.width * 4 + 1);
    raw[rowStart] = 0;
    image.data.copy?.(raw, rowStart + 1, y * image.width * 4, (y + 1) * image.width * 4);
    if (!image.data.copy) {
      raw.set(image.data.subarray(y * image.width * 4, (y + 1) * image.width * 4), rowStart + 1);
    }
  }

  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk("IHDR", ihdr(image.width, image.height)),
    chunk("IDAT", deflateSync(raw)),
    chunk("IEND", Buffer.alloc(0))
  ]);
}

function ihdr(width, height) {
  const buffer = Buffer.alloc(13);
  buffer.writeUInt32BE(width, 0);
  buffer.writeUInt32BE(height, 4);
  buffer[8] = 8;
  buffer[9] = 6;
  return buffer;
}

function chunk(type, data) {
  const typeBuffer = Buffer.from(type);
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length, 0);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([typeBuffer, data])), 0);
  return Buffer.concat([length, typeBuffer, data, crc]);
}

function crc32(buffer) {
  let crc = 0xffffffff;
  for (const byte of buffer) {
    crc ^= byte;
    for (let i = 0; i < 8; i++) {
      crc = crc & 1 ? 0xedb88320 ^ (crc >>> 1) : crc >>> 1;
    }
  }
  return (crc ^ 0xffffffff) >>> 0;
}
