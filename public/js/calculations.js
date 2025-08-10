const calculateSMA = (data, period) => { if (data.length < period) return null; return data.slice(-period).reduce((s, v) => s + parseFloat(v), 0) / period; };
const calculateEMA = (data, period) => { if (data.length < period) return null; const k = 2 / (period + 1); let ema = calculateSMA(data.slice(0, period), period); for (let i = period; i < data.length; i++) { ema = (parseFloat(data[i]) * k) + (ema * (1 - k)); } return ema; };
const calculateStdDev = (data, period) => { let mean = data.slice(-period).reduce((s, v) => s + parseFloat(v), 0) / period; return Math.sqrt(data.slice(-period).reduce((s, v) => s + Math.pow(parseFloat(v) - mean, 2), 0) / period); };
const calculateBollingerBands = (data, period = 20, stdDev = 2) => { if (data.length < period) return null; const middle = calculateEMA(data, period); if (middle === null) return null; const deviation = calculateStdDev(data, period); return { upper: middle + (deviation * stdDev), middle: middle, lower: middle - (deviation * stdDev) }; };
const calculateRSI = (data, period = 14) => {
    if (data.length <= period) return null;
    let gains = 0, losses = 0;
    for (let i = 1; i <= period; i++) { const diff = parseFloat(data[i]) - parseFloat(data[i - 1]); if (diff >= 0) { gains += diff; } else { losses -= diff; } }
    let avgGain = gains / period, avgLoss = losses / period;
    for (let i = period + 1; i < data.length; i++) { const diff = parseFloat(data[i]) - parseFloat(data[i-1]); if (diff >= 0) { avgGain = (avgGain * (period - 1) + diff) / period; avgLoss = (avgLoss * (period - 1)) / period; } else { avgLoss = (avgLoss * (period - 1) - diff) / period; avgGain = (avgGain * (period - 1)) / period; } }
    if (avgLoss === 0) return 100; const rs = avgGain / avgLoss; return 100 - (100 / (1 + rs));
};
const calculateStochasticRSI = (data, period = 14) => {
    if (data.length < period * 2) return null;
    const rsiValues = [];
    for(let i = period; i < data.length; i++) { const rsi = calculateRSI(data.slice(0, i + 1), period); if (rsi !== null) rsiValues.push(rsi); }
    if (rsiValues.length < period) return null;
    const currentRSI = rsiValues[rsiValues.length - 1];
    const rsiSlice = rsiValues.slice(-period);
    const lowestRSI = Math.min(...rsiSlice);
    const highestRSI = Math.max(...rsiSlice);
    if (highestRSI === lowestRSI) return {k: 100};
    return { k: ((currentRSI - lowestRSI) / (highestRSI - lowestRSI)) * 100 };
};
const calculateATR = (klines, period = 14) => {
    if (klines.length < period + 1) return null;
    let trs = [];
    for (let i = 1; i < klines.length; i++) { const high = parseFloat(klines[i][2]), low = parseFloat(klines[i][3]), prevClose = parseFloat(klines[i-1][4]); trs.push(Math.max(high - low, Math.abs(high - prevClose), Math.abs(low - prevClose))); }
    if (trs.length < period) return null;
    return trs.slice(-period).reduce((s, v) => s + v, 0) / period;
};
const calculateMACD = (data, fast = 12, slow = 26, signal = 9) => {
    if (data.length < slow) return null;
    const macdLineData = [];
    for (let i = slow - 1; i < data.length; i++) { const fastEma = calculateEMA(data.slice(0, i + 1), fast); const slowEma = calculateEMA(data.slice(0, i + 1), slow); if (fastEma !== null && slowEma !== null) macdLineData.push(fastEma - slowEma); }
    if (macdLineData.length < signal) return null;
    const signalLine = calculateEMA(macdLineData, signal);
    const macdLine = macdLineData[macdLineData.length - 1];
    return { macd: macdLine, signal: signalLine, histogram: macdLine - signalLine };
};
const calculateIchimokuCloud = (klines) => {
    if (klines.length < 52) return null;
    const slice = klines.slice(-52);
    const high9 = Math.max(...slice.slice(-9).map(k => parseFloat(k[2]))); const low9 = Math.min(...slice.slice(-9).map(k => parseFloat(k[3]))); const tenkanSen = (high9 + low9) / 2;
    const high26 = Math.max(...slice.slice(-26).map(k => parseFloat(k[2]))); const low26 = Math.min(...slice.slice(-26).map(k => parseFloat(k[3]))); const kijunSen = (high26 + low26) / 2;
    const senkouSpanA = (tenkanSen + kijunSen) / 2;
    const high52 = Math.max(...slice.map(k => parseFloat(k[2]))); const low52 = Math.min(...slice.map(k => parseFloat(k[3]))); const senkouSpanB = (high52 + low52) / 2;
    return { tenkanSen, kijunSen, senkouSpanA, senkouSpanB };
};
const calculateFibonacciRetracement = (klines, period = 100) => {
    if (klines.length < period) return null;
    const slice = klines.slice(-period);
    const high = Math.max(...slice.map(k => parseFloat(k[2]))); const low = Math.min(...slice.map(k => parseFloat(k[3]))); const diff = high - low;
    return { level_236: high - diff * 0.236, level_382: high - diff * 0.382, level_500: high - diff * 0.5, level_618: high - diff * 0.618, };
};
