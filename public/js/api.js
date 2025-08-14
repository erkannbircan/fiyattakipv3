function getKlines(pair, interval, limit = 500) {
    return axios.get(`https://api.binance.com/api/v3/klines`, {
        params: { symbol: pair, interval, limit }
    }).then(res => res.data);
}

function fetchCryptoData(pair, withIndicators = false) {
    const timeout = 7000;
    const dailyKlinesPromise = axios.get(`https://api.binance.com/api/v3/klines?symbol=${pair}&interval=1d&limit=1000`, { timeout });
    const tickerPromise = axios.get(`https://api.binance.com/api/v3/ticker/24hr?symbol=${pair}`, { timeout });

    return Promise.all([dailyKlinesPromise, tickerPromise])
        .then(([dailyKlinesResult, tickerResult]) => {
            const dailyKlines = dailyKlinesResult.data;
            const tickerData = tickerResult.data;

            if (!dailyKlines || dailyKlines.length < 2) throw new Error("Yetersiz günlük veri.");

            const latestPrice = parseFloat(tickerData.lastPrice);
            const calculatePct = (colKey) => {
                const days = state.settings.columns[colKey].days;
                if (dailyKlines.length < days + 1) return { pct: 'N/A' };
                const periodData = dailyKlines.slice(-(days + 1), -1);
                let lowestPrice = Infinity, lowestDate = null;
                periodData.forEach(d => {
                    const low = parseFloat(d[3]);
                    if (low < lowestPrice) {
                        lowestPrice = low;
                        lowestDate = new Date(d[0]);
                    }
                });
                if (lowestPrice === Infinity) return { pct: 'N/A' };
                return {
                    pct: ((latestPrice - lowestPrice) / lowestPrice * 100),
                    lowestPrice,
                    lowestDate: lowestDate.toLocaleDateString(state.settings.lang)
                };
            };
            const yesterday = dailyKlines[dailyKlines.length - 2];
            const high = parseFloat(yesterday[2]), low = parseFloat(yesterday[3]), close = parseFloat(yesterday[4]);
            const pivot = (high + low + close) / 3;

            return {
                pair,
                latestPrice,
                error: false,
                type: 'crypto',
                currency: 'USDT',
                col1: calculatePct(1),
                col2: calculatePct(2),
                col3: calculatePct(3),
                sr: { r2: pivot + (high - low), r1: (2 * pivot) - low, pivot: pivot, s1: (2 * pivot) - high, s2: pivot - (high - low) }
            };
        })
        .catch(error => {
            console.error(`${pair} verisi çekilirken hata oluştu:`, error);
            return { pair, error: true, type: 'crypto' };
        });
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
            console.log("runBacktest sonucu:", result);
            const data = result.data;
            
            let html = '';
            for (const coin in data) {
                const res = data[coin];
                const successRate = res.totalSignals > 0 ? (res.positiveSignals_1h / res.totalSignals * 100) : 0;
                html += `
                    <div class="backtest-card">
                        <h5>${coin.replace("USDT","")}</h5>
                        <div class="backtest-results-grid">
                            <p><span class="label">Toplam Sinyal:</span><span class="value">${res.totalSignals}</span></p>
                            <p><span class="label">Başarı Oranı (1S):</span><span class="value ${successRate > 50 ? 'positive' : 'negative'}">${successRate.toFixed(1)}%</span></p>
                            <p><span class="label">Ort. Getiri (1S):</span><span class="value ${res.averageReturn_1h > 0 ? 'positive' : 'negative'}">${res.averageReturn_1h}%</span></p>
                            <p><span class="label">Ort. Getiri (4S):</span><span class="value ${res.averageReturn_4h > 0 ? 'positive' : 'negative'}">${res.averageReturn_4h}%</span></p>
                        </div>
                    </div>`;
            }
            container.innerHTML = html || '<p>Backtest sonucu bulunamadı.</p>';
        })
        .catch(error => {
            console.error("runBacktest hatası:", error);
            const errorMessage = error.message || "Bilinmeyen hata oluştu.";
            container.innerHTML = `<p style="color:var(--accent-red)">Hata: ${errorMessage}</p>`;
        });
}

function runSignalAnalysisPreview() {
    const btn = document.getElementById('runSignalAnalysisBtn');
    showLoading(btn);
    
    const dnaParams = {};
    document.querySelectorAll('#signalDnaParamsGrid input:checked').forEach(cb => {
        dnaParams[cb.dataset.param] = true;
    });
    
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
    
    // DÜZELTME: httpsCallable kullanımı düzeltildi
    const findSignalDNAFunc = state.firebase.functions.httpsCallable('findSignalDNA');
    
    findSignalDNAFunc(params)
        .then(result => {
            console.log("findSignalDNA sonucu:", result);
            // result.data içinde sonuç gelir
            renderSignalAnalysisPreview(result.data);
        })
        .catch(error => {
            console.error("findSignalDNA Hatası:", error);
            
            let errorMessage = "Bilinmeyen hata oluştu.";
            
            if (error.code) {
                switch (error.code) {
                    case 'unauthenticated':
                        errorMessage = "Oturum süresi dolmuş. Lütfen tekrar giriş yapın.";
                        break;
                    case 'invalid-argument':
                        errorMessage = "Geçersiz parametre gönderildi.";
                        break;
                    case 'internal':
                        errorMessage = error.message || "İç sunucu hatası oluştu.";
                        break;
                    default:
                        errorMessage = error.message || errorMessage;
                }
            } else if (error.message) {
                errorMessage = error.message;
            }
            
            resultContainer.innerHTML = `
                <p style="color:var(--accent-red); padding: 10px;">
                    <strong>Analiz sırasında bir hata oluştu.</strong><br>
                    Detay: ${errorMessage}<br>
                    <small>Hata Kodu: ${error.code || 'Bilinmiyor'}</small>
                </p>`;
        })
        .finally(() => {
            hideLoading(btn);
        });
}


function saveDnaProfile(params) {
    const resultContainer = document.getElementById('signalAnalysisResultContainer');
    const coinCard = resultContainer.querySelector(`.backtest-card[data-coin="${params.coins[0]}"]`);
    if (coinCard) {
        coinCard.innerHTML += '<div class="loading" style="margin-top:10px;"></div>';
    }
    
    const findSignalDNAFunc = state.firebase.functions.httpsCallable('findSignalDNA');
    const finalParams = { ...params, isPreview: false };
    
    findSignalDNAFunc(finalParams)
        .then(result => {
            console.log("saveDnaProfile sonucu:", result);
            const data = result.data[params.coins[0]];
            
            if (data && data.status === 'success') {
                showNotification(`DNA profili (${data.profileId}) başarıyla kaydedildi!`, true);
                if (coinCard) {
                    const loadingEl = coinCard.querySelector('.loading');
                    if(loadingEl) loadingEl.remove();
                    const actionsEl = coinCard.querySelector('.preview-actions');
                    if(actionsEl) {
                        actionsEl.innerHTML = `<p style="color:var(--value-positive);"><i class="fas fa-check-circle"></i> Profil Kaydedildi</p>`;
                    }
                }
            } else {
                throw new Error(data?.message || 'Profil kaydedilemedi.');
            }
        })
        .catch(error => {
            console.error("saveDnaProfile hatası:", error);
            const errorMessage = error.message || "Bilinmeyen hata oluştu.";
            showNotification(`Profil kaydedilirken hata oluştu: ${errorMessage}`, false);
            
            if(coinCard) {
                const loadingEl = coinCard.querySelector('.loading');
                if(loadingEl) loadingEl.remove();
            }
        });
}

function fetchDnaProfiles() {
    const container = document.getElementById('dnaProfilesContainer');
    
    // Loading gösterimi
    if (container) {
        container.innerHTML = '<div class="loading" style="margin: 20px auto; display:block;"></div>';
    }
    
    const getProfilesFunc = state.firebase.functions.httpsCallable('manageDnaProfiles');
    
    return getProfilesFunc({ action: 'get' })
        .then(result => {
            console.log("fetchDnaProfiles sonucu:", result);
            
            if (result.data && result.data.success) {
                renderDnaProfiles(result.data.profiles);
            } else {
                throw new Error(result.data?.error || "Profiller getirilemedi.");
            }
        })
        .catch(error => {
            console.error("DNA profilleri çekilirken hata oluştu:", error);
            
            let errorMessage = "Bilinmeyen hata oluştu.";
            
            if (error.code) {
                switch (error.code) {
                    case 'unauthenticated':
                        errorMessage = "Oturum süresi dolmuş. Lütfen tekrar giriş yapın.";
                        // Kullanıcıyı login sayfasına yönlendir
                        state.firebase.auth.signOut();
                        break;
                    case 'internal':
                        errorMessage = error.message || "İç sunucu hatası oluştu.";
                        break;
                    default:
                        errorMessage = error.message || errorMessage;
                }
            } else if (error.message) {
                errorMessage = error.message;
            }
            
            showNotification("Profiller yüklenemedi: " + errorMessage, false);
            
            if (container) {
                container.innerHTML = `
                    <p style="color:var(--accent-red); padding: 10px;">
                        <b>Profiller yüklenirken bir hata oluştu.</b><br>
                        <small>Detay: ${errorMessage}</small><br>
                        <button onclick="fetchDnaProfiles()" style="margin-top: 10px; padding: 5px 10px;">
                            Tekrar Dene
                        </button>
                    </p>`;
            }
        });
}
function deleteDnaProfile(profileId) {
    if (!confirm(`"${profileId}" profilini silmek istediğinizden emin misiniz? Bu işlem geri alınamaz.`)) {
        return;
    }
    
    const deleteProfileFunc = state.firebase.functions.httpsCallable('manageDnaProfiles');
    
    deleteProfileFunc({ action: 'delete', profileId: profileId })
        .then(result => {
            console.log("deleteDnaProfile sonucu:", result);
            showNotification("Profil başarıyla silindi.", true);
            fetchDnaProfiles(); // Listeyi yenile
        })
        .catch(error => {
            console.error("Profil silinirken hata oluştu:", error);
            
            const errorMessage = error.message || "Bilinmeyen hata oluştu.";
            showNotification("Profil silinemedi: " + errorMessage, false);
        });
}



