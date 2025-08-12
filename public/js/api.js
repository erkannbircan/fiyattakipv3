function getKlines(pair, interval, limit = 500) {
    return axios.get(`https://api.binance.com/api/v3/klines`, {
        params: { symbol: pair, interval, limit }
    }).then(res => res.data);
}

function fetchCryptoData(pair, withIndicators = false) {
    return axios.get(`https://api.binance.com/api/v3/ticker/24hr?symbol=${pair}`)
        .then(res => ({ pair, latestPrice: parseFloat(res.data.lastPrice), error: false }))
        .catch(err => ({ pair, error: true }));
}

function runBacktest(alarmId) {
    const alarm = state.userAlarms.find(a => a.id === alarmId);
    if (!alarm) return;
    showPanel('backtestPanel');
    const container = document.getElementById('backtest-results-container');
    container.innerHTML = `<div class="loading" style="margin:20px auto;"></div>`;
    document.getElementById('backtestAlarmName').textContent = `"${alarm.name}" Stratejisi`;
    const runBacktestFunc = state.firebase.functions.httpsCallable('runBacktest');
    return runBacktestFunc({ alarm })
        .then(result => {
            const data = result.data;
            let html = '';
            for (const coin in data) {
                const res = data[coin];
                const successRate = res.totalSignals > 0 ? (res.positiveSignals_1h / res.totalSignals * 100) : 0;
                html += `<div class="backtest-card"><h5>${coin.replace("USDT","")}</h5><div class="backtest-results-grid"><p><span class="label">Toplam Sinyal:</span><span class="value">${res.totalSignals}</span></p><p><span class="label">Başarı Oranı (1S):</span><span class="value ${successRate > 50 ? 'positive' : 'negative'}">${successRate.toFixed(1)}%</span></p><p><span class="label">Ort. Getiri (1S):</span><span class="value ${res.averageReturn_1h > 0 ? 'positive' : 'negative'}">${res.averageReturn_1h}%</span></p><p><span class="label">Ort. Getiri (4S):</span><span class="value ${res.averageReturn_4h > 0 ? 'positive' : 'negative'}">${res.averageReturn_4h}%</span></p></div></div>`;
            }
            container.innerHTML = html || '<p>Backtest sonucu bulunamadı.</p>';
        })
        .catch(e => {
            container.innerHTML = `<p style="color:var(--accent-red)">Hata: ${e.message}</p>`
        });
}

function runSignalAnalysisPreview() {
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
    if (params.coins.length === 0) {
        showNotification("Lütfen en az bir coin seçin.", false);
        hideLoading(btn);
        return;
    }
    const resultContainer = document.getElementById('signalAnalysisResultContainer');
    resultContainer.innerHTML = '<div class="loading" style="margin: 20px auto; display:block;"></div>';
    const findSignalDNAFunc = state.firebase.functions.httpsCallable('findSignalDNA');
    findSignalDNAFunc(params)
        .then(result => {
            renderSignalAnalysisPreview(result.data);
        })
        .catch(error => {
            console.error("findSignalDNA Hatası:", error);
            const errorMessage = error.details ? error.details.message : error.message;
            resultContainer.innerHTML = `<p style="color:var(--accent-red); padding: 10px;"><strong>Analiz sırasında bir sunucu hatası oluştu.</strong><br>Detay: ${errorMessage || 'Lütfen daha sonra tekrar deneyin.'}</p>`;
        })
        .finally(() => {
            hideLoading(btn);
        });
}

function saveDnaProfile(params) {
    const resultContainer = document.getElementById('signalAnalysisResultContainer');
    const coinCard = resultContainer.querySelector(`.backtest-card[data-coin="${params.coins[0]}"]`);
    if (coinCard) coinCard.innerHTML += '<div class="loading" style="margin-top:10px;"></div>';
    
    const findSignalDNAFunc = state.firebase.functions.httpsCallable('findSignalDNA');
    const finalParams = { ...params, isPreview: false };
    
    findSignalDNAFunc(finalParams)
        .then(result => {
            const data = result.data[params.coins[0]];
            if (data && data.status === 'success') {
                showNotification(`DNA profili (${data.profileId}) başarıyla kaydedildi!`, true);
                if (coinCard) {
                    const loadingEl = coinCard.querySelector('.loading');
                    if(loadingEl) loadingEl.remove();
                    const actionsEl = coinCard.querySelector('.preview-actions');
                    if(actionsEl) actionsEl.innerHTML = `<p style="color:var(--value-positive);"><i class="fas fa-check-circle"></i> Profil Kaydedildi</p>`;
                }
            } else {
                throw new Error(data.message || 'Profil kaydedilemedi.');
            }
        })
        .catch(error => {
            showNotification(`Profil kaydedilirken hata oluştu: ${error.message}`, false);
            if(coinCard) {
                 const loadingEl = coinCard.querySelector('.loading');
                 if(loadingEl) loadingEl.remove();
            }
        });
}

function fetchDnaProfiles() {
    const container = document.getElementById('dnaProfilesContainer');
    const getProfilesFunc = state.firebase.functions.httpsCallable('manageDnaProfiles');
    return getProfilesFunc({ action: 'get' })
        .then(result => {
            if (result.data.success) {
                renderDnaProfiles(result.data.profiles);
            } else {
                throw new Error(result.data.error || "Bilinmeyen bir hata oluştu.");
            }
        })
        .catch(error => {
            console.error("DNA profilleri çekilirken hata oluştu:", error);
            showNotification("Profiller yüklenemedi.", false);
            if (container) {
                container.innerHTML = `<p style="color:var(--accent-red); padding: 10px;"><b>Profiller yüklenirken bir hata oluştu.</b><br><small>Detay: ${error.message}</small></p>`;
            }
        });
}

function deleteDnaProfile(profileId) {
    if (!confirm(`"${profileId}" profilini silmek istediğinizden emin misiniz? Bu işlem geri alınamaz.`)) return;
    const deleteProfileFunc = state.firebase.functions.httpsCallable('manageDnaProfiles');
    deleteProfileFunc({ action: 'delete', profileId: profileId })
        .then(() => {
            showNotification("Profil başarıyla silindi.", true);
            fetchDnaProfiles();
        })
        .catch(error => {
            console.error("Profil silinirken hata oluştu:", error);
            showNotification("Profil silinemedi.", false);
        });
}
