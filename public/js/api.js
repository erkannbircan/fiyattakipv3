// public/js/api.js

// This function calls the backend to get crypto data.
async function fetchCryptoData(pair, withIndicators = false) {
    try {
        const timeout = 5000;
        const dailyKlinesResponse = axios.get(`https://api.binance.com/api/v3/klines?symbol=${pair}&interval=1d&limit=1000`, { timeout });
        const tickerResponse = axios.get(`https://api.binance.com/api/v3/ticker/24hr?symbol=${pair}`, { timeout });

        const promises = [dailyKlinesResponse, tickerResponse];
        if (withIndicators) {
            promises.push(axios.get(`https://api.binance.com/api/v3/klines?symbol=${pair}&interval=${settings.cryptoAnalysisInterval}&limit=400`, { timeout }));
        }

        const [dailyKlinesResult, tickerResult, analysisKlinesResult] = await Promise.all(promises);

        const dailyKlines = dailyKlinesResult.data;
        const tickerData = tickerResult.data;

        if (!dailyKlines || dailyKlines.length < 2) throw new Error("Yetersiz günlük veri.");

        const latestPrice = parseFloat(tickerData.lastPrice);
        const calculatePct = (col) => {
            const days = settings.columns[col].days;
            if (dailyKlines.length < days + 1) return { pct: 'N/A' };
            const periodData = dailyKlines.slice(-(days + 1), -1);
            let lowestPrice = Infinity, lowestDate = null;
            periodData.forEach(d => { const low = parseFloat(d[3]); if (low < lowestPrice) { lowestPrice = low; lowestDate = new Date(d[0]); } });
            if (lowestPrice === Infinity) return { pct: 'N/A' };
            return { pct: ((latestPrice - lowestPrice) / lowestPrice * 100), lowestPrice, lowestDate: lowestDate.toLocaleDateString(settings.lang) };
        };
        const yesterday = dailyKlines[dailyKlines.length - 2];
        const high = parseFloat(yesterday[2]), low = parseFloat(yesterday[3]), close = parseFloat(yesterday[4]);
        const pivot = (high + low + close) / 3;

        const baseData = {
            pair, latestPrice, error: false, type: 'crypto', currency: 'USDT',
            col1: calculatePct(1), col2: calculatePct(2), col3: calculatePct(3),
            sr: { r2: pivot + (high - low), r1: (2 * pivot) - low, pivot: pivot, s1: (2 * pivot) - high, s2: pivot - (high - low) }
        };

        // Indicator calculations should be done on the backend for consistency,
        // but this is a placeholder based on the original script.
        if (withIndicators) {
            // This part should ideally be a call to a backend function
            // to avoid exposing calculation logic and for better performance.
            baseData.indicators = { /* ... indicator data ... */ };
        }

        return baseData;
    } catch (error) {
        console.error(`${pair} verisi çekilirken hata oluştu:`, error);
        return { pair, error: true, type: 'crypto' };
    }
}

// This function calls the 'runBacktest' cloud function.
async function runBacktest(alarmId) {
    const alarm = userAlarms.find(a => a.id === alarmId);
    if(!alarm) return;
    showPanel('backtestPanel');
    const container = document.getElementById('backtest-results-container');
    container.innerHTML = `<div class="loading" style="margin:20px auto;"></div>`;
    document.getElementById('backtestAlarmName').textContent = `"${alarm.name}" Stratejisi`;
    try {
        const runBacktestFunc = functions.httpsCallable('runBacktest');
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

// Other API calling functions like runSignalAnalysis should be moved here.
