import { state } from './state.js';
import { renderDnaProfiles, showNotification, renderSignalAnalysisPreview } from './ui.js';

const functions = firebase.functions();

const findSignalDNAFunc = functions.httpsCallable('findSignalDNA');
const manageDnaProfilesFunc = functions.httpsCallable('manageDnaProfiles');
const runBacktestFunc = functions.httpsCallable('runBacktest');

export async function fetchCryptoData(pair, withIndicators = false) {
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

        if (withIndicators && analysisKlinesResult) {
            const analysisKlines = analysisKlinesResult.data;
            if (!analysisKlines || analysisKlines.length < 52) throw new Error("Yetersiz analiz verisi.");
        }
        return baseData;
    } catch (error) {
        console.error(`${pair} verisi çekilirken hata oluştu:`, error);
        return { pair, error: true, type: 'crypto' };
    }
}

export async function runBacktest(alarmId) {
    const alarm = state.userAlarms.find(a => a.id === alarmId);
    if(!alarm) return;
    showPanel('backtestPanel');
    const container = document.getElementById('backtest-results-container');
    container.innerHTML = `<div class="loading" style="margin:20px auto;"></div>`;
    document.getElementById('backtestAlarmName').textContent = `"${alarm.name}" Stratejisi`;
    try {
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

export async function runSignalAnalysisPreview() {
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
        params: dnaParams,
        isPreview: true
    };
    if(params.coins.length === 0) {
        showNotification("Lütfen en az bir coin seçin.", false);
        hideLoading(btn);
        return;
    }
    const resultContainer = document.getElementById('signalAnalysisResultContainer');
    resultContainer.innerHTML = '<div class="loading" style="margin: 20px auto; display:block;"></div>';
    try {
        const result = await findSignalDNAFunc(params);
        renderSignalAnalysisPreview(result.data);
    } catch (error) {
        console.error("findSignalDNA Hatası:", error);
        const errorMessage = error.details ? error.details.message : error.message;
        resultContainer.innerHTML = `<p style="color:var(--accent-red); padding: 10px; border-left: 2px solid var(--accent-red); background-color: rgba(239, 83, 80, 0.1);">
            <strong>Analiz sırasında bir sunucu hatası oluştu.</strong><br>
            Detay: ${errorMessage || 'Lütfen daha sonra tekrar deneyin veya farklı parametreler seçin.'}
        </p>`;
    } finally {
        hideLoading(btn);
    }
}

export async function saveDnaProfile(params) {
    const resultContainer = document.getElementById('signalAnalysisResultContainer');
    const coinCard = resultContainer.querySelector(`.backtest-card[data-coin="${params.coins[0]}"]`);
    if(coinCard) {
        coinCard.innerHTML += '<div class="loading" style="margin-top:10px;"></div>';
    }
    try {
        const finalParams = { ...params, isPreview: false };
        const result = await findSignalDNAFunc(finalParams);
        const data = result.data[params.coins[0]];
        if (data && data.status === 'success') {
            showNotification(`DNA profili (${data.profileId}) başarıyla kaydedildi!`, true);
            if(coinCard) coinCard.querySelector('.loading').remove();
            if(coinCard) coinCard.querySelector('.preview-actions').innerHTML = `<p style="color:var(--value-positive);"><i class="fas fa-check-circle"></i> Profil Kaydedildi</p>`;
        } else {
            throw new Error(data.message || 'Profil kaydedilemedi.');
        }
    } catch (error) {
        showNotification(`Profil kaydedilirken hata oluştu: ${error.message}`, false);
        if(coinCard) coinCard.querySelector('.loading').remove();
    }
}

export async function matchDnaProfile(coin, timeframe) {
    console.warn(`'matchDnaProfile' fonksiyonu eski yapıya aittir ve artık kullanılmamaktadır.`);
    return { matches: [] };
}

export async function fetchDnaProfiles() {
    try {
        const result = await manageDnaProfilesFunc({ action: 'get' });
        if(result.data.success){
            renderDnaProfiles(result.data.profiles);
        } else {
            throw new Error(result.data.error || "Bilinmeyen bir hata oluştu.");
        }
    } catch (error) {
        console.error("DNA profilleri çekilirken hata oluştu:", error);
        showNotification("Profiller yüklenemedi.", false);
        const container = document.getElementById('dnaProfilesContainer');
        if(container) {
            container.innerHTML = `<p style="color:var(--accent-red); padding: 10px;">
                <b>Profiller yüklenirken bir hata oluştu.</b><br>
                <small>Detay: ${error.message}</small>
            </p>`;
        }
    }
}

export async function deleteDnaProfile(profileId) {
    if (!confirm(`"${profileId}" profilini silmek istediğinizden emin misiniz? Bu işlem geri alınamaz.`)) {
        return;
    }
    try {
        await manageDnaProfilesFunc({ action: 'delete', profileId: profileId });
        showNotification("Profil başarıyla silindi.", true);
        await fetchDnaProfiles();
    } catch (error) {
        console.error("Profil silinirken hata oluştu:", error);
        showNotification("Profil silinemedi.", false);
    }
}
