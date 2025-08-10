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
async function showAlarmStatus(alarmId) { showNotification("Alarm durumu kontrol özelliği yakında eklenecek!", true); }

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
        for(const coin in data) {
            const res = data[coin];
            html += `<div class="backtest-card" style="margin-bottom:15px;"><h4>${coin.replace("USDT","")} Analiz Sonuçları</h4>`;
            if(res.error || !res || res.totalEvents === 0) {
                html += `<p style="color:var(--accent-red)">${res?.error || 'Belirtilen koşullarda hiç olay bulunamadı.'}</p>`;
            } else {
                let dnaText = [];
                if (res.dna.avgAdx) dnaText.push(`ADX > ${res.dna.avgAdx.toFixed(0)}`);
                if (res.dna.avgMacdHist) dnaText.push(`MACD Hist. ${res.dna.avgMacdHist > 0 ? '>' : '<'} ${res.dna.avgMacdHist.toFixed(5)}`);
                if (res.dna.avgRsi) dnaText.push(`RSI ~ ${res.dna.avgRsi.toFixed(0)}`);
                if (res.dna.avgVolumeMultiplier) dnaText.push(`Hacim > Ort. x${res.dna.avgVolumeMultiplier.toFixed(1)}`);

                const fullDnaData = {
                    coin, timeframe: params.timeframe, direction: params.direction, dna: res.dna, 
                    dna_analysis: { avgReturn1h: res.avgReturn1h }
                };

                html += `
                    <p>Bu koşul, son ${params.days} günde <strong>${res.totalEvents}</strong> kez gerçekleşti.</p>
                    <p style="margin-top:15px;"><strong>Sinyal Zamanlaması (Ortalama):</strong></p>
                    <p style="font-size:0.9rem; color: var(--text-secondary);">Bu DNA tespit edildikten sonra, ana yükseliş gerçekleşene kadar fiyat ortalama <strong style="color:var(--accent-yellow); font-size:1rem;">%${res.avgRiseUntilEvent.toFixed(2)}</strong> daha hareket etti.</p>
                    <p style="margin-top:15px;"><strong>Yükseliş SONRASI Getiri Potansiyeli (Yönlü):</strong></p>
                    <ul>
                        <li>15 Dk Sonra: <strong style="color:${res.avgReturn15m >= 0 ? 'var(--value-positive)' : 'var(--value-negative)'}">${res.avgReturn15m.toFixed(2)}%</strong></li>
                        <li>1 Saat Sonra: <strong style="color:${res.avgReturn1h >= 0 ? 'var(--value-positive)' : 'var(--value-negative)'}">${res.avgReturn1h.toFixed(2)}%</strong></li>
                        <li>4 Saat Sonra: <strong style="color:${res.avgReturn4h >= 0 ? 'var(--value-positive)' : 'var(--value-negative)'}">${res.avgReturn4h.toFixed(2)}%</strong></li>
                        <li>1 Gün Sonra: <strong style="color:${res.avgReturn1d >= 0 ? 'var(--value-positive)' : 'var(--value-negative)'}">${res.avgReturn1d.toFixed(2)}%</strong></li>
                    </ul>
                    <div class="analysis-summary"><strong>💡 Sinyal DNA'sı:</strong><br>${dnaText.join(' | ')}</div>
                    <div class="analysis-actions"><button class="use-dna-in-alarm-btn" data-dna='${JSON.stringify(fullDnaData)}'><i class="fas fa-magic"></i> Bu DNA ile Alarm Kur</button></div>
                `;
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
