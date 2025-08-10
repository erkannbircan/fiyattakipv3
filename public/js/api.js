// --- HESAPLAMA FONKSİYONLARI ---
const calculateSMA = (data, period) => { if (data.length < period) return null; return data.slice(-period).reduce((s, v) => s + parseFloat(v), 0) / period; };
const calculateEMA = (data, period) => { if (data.length < period) return null; const k = 2 / (period + 1); let ema = calculateSMA(data.slice(0, period), period); for (let i = period; i < data.length; i++) { ema = (parseFloat(data[i]) * k) + (ema * (1 - k)); } return ema; };
const calculateStdDev = (data, period) => { let mean = data.slice(-period).reduce((s, v) => s + parseFloat(v), 0) / period; return Math.sqrt(data.slice(-period).reduce((s, v) => s + Math.pow(parseFloat(v) - mean, 2), 0) / period); };
const calculateBollingerBands = (data, period = 20, stdDev = 2) => { if (data.length < period) return null; const middle = calculateEMA(data, period); if (middle === null) return null; const deviation = calculateStdDev(data, period); return { upper: middle + (deviation * stdDev), middle: middle, lower: middle - (deviation * stdDev) }; };
const calculateRSI = (data, period = 14) => {
    if (data.length <= period) return null;
    let gains = 0, losses = 0;
    for (let i = data.length - period; i < data.length; i++) { const diff = parseFloat(data[i]) - parseFloat(data[i - 1]); if (diff >= 0) { gains += diff; } else { losses -= diff; } }
    let avgGain = gains / period; let avgLoss = losses / period;
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

// --- API FONKSİYONLARI ---
async function fetchCryptoData(pair, withIndicators = false) {
    try {
        const timeout = 5000;
        const dailyKlinesResponse = axios.get(`https://api.binance.com/api/v3/klines?symbol=${pair}&interval=1d&limit=1000`, { timeout });
        const tickerResponse = axios.get(`https://api.binance.com/api/v3/ticker/24hr?symbol=${pair}`, { timeout });
        
        const promises = [dailyKlinesResponse, tickerResponse];
        if (withIndicators) {
            promises.push(axios.get(`https://api.binance.com/api/v3/klines?symbol=${pair}&interval=${state.settings.cryptoAnalysisInterval}&limit=400`, { timeout }));
        }

        const [dailyKlinesResult, tickerResult, analysisKlinesResult] = await Promise.all(promises);

        const dailyKlines = dailyKlinesResult.data;
        const tickerData = tickerResult.data;

        if (!dailyKlines || dailyKlines.length < 2) throw new Error("Yetersiz günlük veri.");
        
        const latestPrice = parseFloat(tickerData.lastPrice);
        const calculatePct = (col) => {
            const days = state.settings.columns[col].days;
            if (dailyKlines.length < days + 1) return { pct: 'N/A' };
            const periodData = dailyKlines.slice(-(days + 1), -1);
            let lowestPrice = Infinity, lowestDate = null;
            periodData.forEach(d => { const low = parseFloat(d[3]); if (low < lowestPrice) { lowestPrice = low; lowestDate = new Date(d[0]); } });
            if (lowestPrice === Infinity) return { pct: 'N/A' };
            return { pct: ((latestPrice - lowestPrice) / lowestPrice * 100), lowestPrice, lowestDate: lowestDate.toLocaleDateString(state.settings.lang) };
        };
        const yesterday = dailyKlines[dailyKlines.length - 2];
        const high = parseFloat(yesterday[2]), low = parseFloat(yesterday[3]), close = parseFloat(yesterday[4]);
        const pivot = (high + low + close) / 3;

        const baseData = {
            pair, latestPrice, error: false, type: 'crypto', currency: 'USDT',
            col1: calculatePct(1), col2: calculatePct(2), col3: calculatePct(3),
            sr: { r2: pivot + (high - low), r1: (2 * pivot) - low, pivot: pivot, s1: (2 * pivot) - high, s2: pivot - (high - low) }
        };

        if (withIndicators) {
            const analysisKlines = analysisKlinesResult.data;
            if (!analysisKlines || analysisKlines.length < 52) throw new Error("Yetersiz analiz verisi.");
            const analysisClosePrices = analysisKlines.map(d => parseFloat(d[4]));
            baseData.indicators = { 
                sma: calculateSMA(analysisClosePrices, 50), 
                ema: calculateEMA(analysisClosePrices, 50), 
                rsi: calculateRSI(analysisClosePrices, 14), 
                macd: calculateMACD(analysisClosePrices), 
                bollinger: calculateBollingerBands(analysisClosePrices), 
                stochRsi: calculateStochasticRSI(analysisClosePrices, 14), 
                volume: parseFloat(tickerData.quoteVolume), 
                atr: calculateATR(analysisKlines, 14), 
                ichimoku: calculateIchimokuCloud(analysisKlines), 
                fibonacci: calculateFibonacciRetracement(analysisKlines) 
            };
        }

        return baseData;
    } catch (error) {
        console.error(`${pair} verisi çekilirken hata oluştu:`, error);
        return { pair, error: true, type: 'crypto' };
    }
}

async function runBacktest(alarmId) {
    const alarm = state.userAlarms.find(a => a.id === alarmId);
    if(!alarm) return;
    showPanel('backtestPanel');
    const container = document.getElementById('backtest-results-container');
    container.innerHTML = `<div class="loading" style="margin:20px auto;"></div>`;
    document.getElementById('backtestAlarmName').textContent = `"${alarm.name}" Stratejisi`;
    try {
        const runBacktestFunc = state.firebase.functions.httpsCallable('runBacktest');
        const result = await runBacktestFunc({ alarm });
        const data = result.data;
        let html = '';
        for (const coin in data) {
            const res = data[coin];
            const successRate = res.totalSignals > 0 ? (res.positiveSignals_1h / res.totalSignals * 100) : 0;
             html += `
                <div class="backtest-card">
                    <h5>${coin.replace("USDT","")}</h5>
                    <div class="backtest-results-grid">
                        <p><span class="label">Toplam Sinyal:</span> <span class="value">${res.totalSignals}</span></p>
                        <p><span class="label">Başarı Oranı (1S):</span> <span class="value ${successRate > 50 ? 'positive' : 'negative'}">${successRate.toFixed(1)}%</span></p>
                        <p><span class="label">Ort. Getiri (1S):</span> <span class="value ${res.averageReturn_1h > 0 ? 'positive' : 'negative'}">${res.averageReturn_1h}%</span></p>
                        <p><span class="label">Ort. Getiri (4S):</span> <span class="value ${res.averageReturn_4h > 0 ? 'positive' : 'negative'}">${res.averageReturn_4h}%</span></p>
                    </div>
                </div>
            `;
        }
        container.innerHTML = html || '<p>Backtest sonucu bulunamadı.</p>';
    } catch(e) {
        container.innerHTML = `<p style="color:var(--accent-red)">Hata: ${e.message}</p>`
    }
}

async function runSignalAnalysis() {
    const btn = document.getElementById('runSignalAnalysisBtn');
    showLoading(btn);

    const dnaParams = {};
    document.querySelectorAll('#signalDnaParamsGrid input:checked').forEach(cb => dnaParams[cb.dataset.param] = true);

    const params = {
        coins: state.discoveryCoins,
        timeframe: document.getElementById('signalAnalysisTimeframe').value,
        changePercent: parseFloat(document.getElementById('signalAnalysisChange').value),
        direction: document.getElementById('signalAnalysisDirection').value,
        days: parseInt(document.getElementById('signalAnalysisPeriod').value),
        params: dnaParams
    };

    if(params.coins.length === 0) {
        showNotification("Lütfen en az bir coin seçin.", false);
        hideLoading(btn);
        return;
    }

    const resultContainer = document.getElementById('signalAnalysisResultContainer');
    resultContainer.innerHTML = '<div class="loading" style="margin: 20px auto; display:block;"></div>';
    try {
        const findSignalDNA = state.firebase.functions.httpsCallable('findSignalDNA');
        const result = await findSignalDNA(params);
        const data = result.data;
        
        let html = '';
        for (const coin of params.coins) {
            const res = data[coin];
            html += `<div class="backtest-card" style="margin-bottom:15px;"><h4>${coin.replace("USDT","")} Analiz Sonuçları</h4>`;
            
            if (!res || res.status === 'error') {
                const errorMessage = res?.message || 'Analiz sırasında bilinmeyen bir hata oluştu.';
                html += `<p style="color:var(--accent-red); padding: 10px 0;">${errorMessage}</p>`;
            } else if (res.status === 'info') {
                 html += `<p style="color:var(--text-secondary); padding: 10px 0;">${res.message}</p>`;
            }
            else if (res.status === 'success') {
                html += `<p style="color:var(--value-positive);">${res.message}</p>`;
                html += '<ul>';
                res.profile.featureOrder.forEach((feature, index) => {
                    html += `<li><strong>${feature}:</strong> ${res.profile.mean[index]}</li>`;
                });
                html += '</ul>';
            }
            html += `</div>`;
        }
        resultContainer.innerHTML = html || `<p>Analiz için sonuç bulunamadı.</p>`;
    } catch (error) {
        resultContainer.innerHTML = `<p style="color:var(--accent-red)">Analiz sırasında bir hata oluştu: ${error.message}</p>`;
    } finally {
        hideLoading(btn);
    }
}

async function matchDnaProfile(coin, timeframe) {
    try {
        const matchSignalDNA = state.firebase.functions.httpsCallable('matchSignalDNA');
        const result = await matchSignalDNA({ coin, timeframe });
        return result.data;
    } catch (error) {
        console.error(`Eşleştirme hatası (${coin}):`, error);
        throw error;
    }
}
