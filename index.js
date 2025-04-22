const express = require('express');
const { createCanvas } = require('canvas');
const fs = require('fs');
const axios = require('axios');
const app = express();
const port = 3000;

// Chart settings
const width = 800;
const height = 400;

function createBaseCanvas() {
  const canvas = createCanvas(width, height);
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = 'white';
  ctx.fillRect(0, 0, width, height);
  return { canvas, ctx };
}

async function fetchKlines(symbol, interval, limit = 200) {
  const res = await axios.get(`https://api.binance.com/api/v3/klines?symbol=${symbol}&interval=${interval}&limit=${limit}`);
  return res.data.map((d, i) => ({ x: i, y: parseFloat(d[4]) }));
}

function calculateRSI(data, period = 14) {
  let result = [];
  let gains = 0, losses = 0;

  for (let i = 1; i <= period; i++) {
    let diff = data[i].y - data[i - 1].y;
    if (diff >= 0) gains += diff;
    else losses -= diff;
  }

  let avgGain = gains / period;
  let avgLoss = losses / period;
  let rs = avgGain / avgLoss;
  let rsi = 100 - (100 / (1 + rs));
  result.push({ x: data[period].x, y: rsi });

  for (let i = period + 1; i < data.length; i++) {
    let diff = data[i].y - data[i - 1].y;
    if (diff >= 0) {
      avgGain = (avgGain * (period - 1) + diff) / period;
      avgLoss = (avgLoss * (period - 1)) / period;
    } else {
      avgGain = (avgGain * (period - 1)) / period;
      avgLoss = (avgLoss * (period - 1) - diff) / period;
    }
    rs = avgGain / avgLoss;
    rsi = 100 - (100 / (1 + rs));
    result.push({ x: data[i].x, y: rsi });
  }
  return result;
}

function calculateEMA(data, period) {
  const result = [];
  let multiplier = 2 / (period + 1);
  let emaPrev;

  for (let i = 0; i < data.length; i++) {
    if (i < period) continue;
    if (emaPrev === undefined) {
      let sum = 0;
      for (let j = 0; j < period; j++) {
        sum += data[i - j].y;
      }
      emaPrev = sum / period;
    } else {
      emaPrev = (data[i].y - emaPrev) * multiplier + emaPrev;
    }
    result.push({ x: data[i].x, y: emaPrev });
  }
  return result;
}

function calculateWMA(data, period) {
  const result = [];
  let denominator = (period * (period + 1)) / 2;

  for (let i = period; i < data.length; i++) {
    let weightedSum = 0;
    for (let j = 0; j < period; j++) {
      weightedSum += data[i - j].y * (period - j);
    }
    result.push({ x: data[i].x, y: weightedSum / denominator });
  }
  return result;
}

function padStartToMatch(refData, targetData) {
  const padLength = refData.length - targetData.length;
  const padded = Array.from({ length: padLength }, (_, i) => ({
    x: refData[i].x,
    y: null
  }));
  return padded.concat(targetData);
}

function drawLine(ctx, data, color) {
  ctx.beginPath();
  ctx.strokeStyle = color;
  for (let i = 0; i < data.length; i++) {
    const x = (i / data.length) * width;
    if (data[i].y === null) continue;
    const y = height - (data[i].y / 100) * height;
    if (i === 0 || data[i - 1].y === null) {
      ctx.moveTo(x, y);
    } else {
      ctx.lineTo(x, y);
    }
  }
  ctx.stroke();
}

function drawStripLine(ctx, yVal, label) {
  const y = height - (yVal / 100) * height;
  ctx.beginPath();
  ctx.moveTo(0, y);
  ctx.lineTo(width, y);
  ctx.strokeStyle = '#cccccc';
  ctx.setLineDash([5, 5]);
  ctx.stroke();
  ctx.setLineDash([]);

  ctx.fillStyle = 'black';
  ctx.font = '12px sans-serif';
  ctx.fillText(label, 5, y - 5);
}

function drawLegend(ctx) {
  const items = [
    { color: 'black', label: 'RSI 14' },
    { color: 'blue', label: 'EMA 9 (RSI)' },
    { color: 'orange', label: 'WMA 45 (RSI)' },
  ];
  items.forEach((item, i) => {
    const x = width - 150;
    const y = 20 + i * 20;
    ctx.fillStyle = item.color;
    ctx.fillRect(x, y - 10, 10, 10);
    ctx.fillStyle = 'black';
    ctx.fillText(item.label, x + 15, y);
  });
}

function drawTitle(ctx, interval) {
  ctx.fillStyle = 'black';
  ctx.font = 'bold 18px sans-serif';
  ctx.fillText(`RSI Chart (${interval})`, 10, 25);
}

async function renderRSIChart(interval = '15m') {
  const { canvas, ctx } = createBaseCanvas();
  const closePrices = await fetchKlines('BTCUSDT', interval);
  const rsiData = calculateRSI(closePrices);
  const emaDataRaw = calculateEMA(rsiData, 9);
  const wmaDataRaw = calculateWMA(rsiData, 45);

  let emaData = padStartToMatch(rsiData, emaDataRaw);
  let wmaData = padStartToMatch(rsiData, wmaDataRaw);

  let emaStartIndex = emaData.findIndex(item => item.y !== null);
  let wmaStartIndex = wmaData.findIndex(item => item.y !== null);

  const paddingPoints = 50;
  const lastX = rsiData[rsiData.length - 1].x;
  for (let i = 1; i <= paddingPoints; i++) {
    const x = lastX + i;
    rsiData.push({ x, y: null });
    emaData.push({ x, y: null });
    wmaData.push({ x, y: null });
  }

  const paddedRSIData = rsiData.slice(Math.max(emaStartIndex, wmaStartIndex));
  const paddedEMAData = emaData.slice(Math.max(emaStartIndex, wmaStartIndex));
  const paddedWMAData = wmaData.slice(Math.max(emaStartIndex, wmaStartIndex));

  drawStripLine(ctx, 70, '70');
  drawStripLine(ctx, 50, '50');
  drawStripLine(ctx, 30, '30');
  drawTitle(ctx, interval);
  drawLegend(ctx);
  drawLine(ctx, paddedRSIData, 'black');
  drawLine(ctx, paddedEMAData, 'blue');
  drawLine(ctx, paddedWMAData, 'orange');

  const timestamp = Date.now();
  const filename = `rsi_${interval}_${timestamp}.png`;
  const filepath = `./${filename}`;
  const buffer = canvas.toBuffer('image/png');
  fs.writeFileSync(filepath, buffer);

  return { filename, filepath };
}

// API endpoint
app.get('/rsi', async (req, res) => {
  try {
    const interval = req.query.interval || '15m';
    const { filepath, filename } = await renderRSIChart(interval);
    res.download(filepath, filename, err => {
      if (!err) fs.unlinkSync(filepath); // Delete file after sending
    });
  } catch (err) {
    console.error(err);
    res.status(500).send('Error generating RSI chart');
  }
});

app.listen(port, () => {
  console.log(`📊 Server is running at http://localhost:${port}`);
});
