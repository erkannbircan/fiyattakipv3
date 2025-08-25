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
   const alarm = state.userAlarms?.find(a => a.id === alarmId);
    if (!alarm) {
        console.error(`runBacktest: Alarm bulunamadı (${alarmId}).`);
        return;
    }
    
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
// API önizleme: veriyi çek, UI'ye bas
async function runSignalAnalysisPreview(params) {
  try {
    const resp = await findSignalDNA(params); // sunucu çağrısı
    console.log('findSignalDNA sonucu:', resp);

    const data = (resp && resp.data) ? resp.data : {};
    // Hedef container her zaman aynı id
    if (typeof renderSignalAnalysisPreview === 'function') {
      await renderSignalAnalysisPreview(data);
    } else {
      const rc = document.getElementById('signalAnalysisResultContainer');
      if (rc) {
        rc.innerHTML = `<pre style="white-space:pre-wrap;">${JSON.stringify(data, null, 2)}</pre>`;
      }
    }
    return data;
  } catch (err) {
    console.error('runSignalAnalysisPreview hata:', err);
    const rc = document.getElementById('signalAnalysisResultContainer');
    if (rc) rc.innerHTML = `<div class="error-msg">Analiz sırasında hata oluştu.</div>`;
    throw err;
  }
}

async function saveDnaProfile(profileData, button) {
    if (button) showLoading(button);
    
    // Yeni ve basit Cloud Function'ı çağırıyoruz.
    const saveProfileFunc = state.firebase.functions.httpsCallable('saveDnaProfile');
    
    try {
        const result = await saveProfileFunc({ profile: profileData });
        if (result.data.success) {
            showNotification(`DNA profili (${profileData.name}) başarıyla kaydedildi!`, true);
            // Kayıttan sonra listeyi yenile
            fetchDnaProfiles('dnaProfilesContainerDiscovery');
        } else {
            throw new Error(result.data.error || 'Profil kaydedilemedi.');
        }
    } catch (error) {
        console.error("saveDnaProfile hatası:", error);
        showNotification(`Profil kaydedilirken hata oluştu: ${error.message}`, false);
    } finally {
        if (button) hideLoading(button);
    }
}

// *** DEĞİŞİKLİK: Fonksiyon artık bir containerId parametresi alıyor ***
function fetchDnaProfiles(containerId) {
    const container = document.getElementById(containerId);
    
    if (container) {
        container.innerHTML = '<div class="loading" style="margin: 20px auto; display:block;"></div>';
    } else {
        console.error(`fetchDnaProfiles: '${containerId}' ID'li element bulunamadı.`);
        return Promise.reject(new Error("Container not found"));
    }
    
    const getProfilesFunc = state.firebase.functions.httpsCallable('manageDnaProfiles');
    
    return getProfilesFunc({ action: 'get' })
        .then(result => {
            console.log("fetchDnaProfiles sonucu:", result);
            
            if (result.data && result.data.success) {
                // *** DEĞİŞİKLİK: Gelen containerId'yi render fonksiyonuna pasla ***
                renderDnaProfiles(result.data.profiles, containerId);
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
                        <button onclick="fetchDnaProfiles('${containerId}')" style="margin-top: 10px; padding: 5px 10px;">
                            Tekrar Dene
                        </button>
                    </p>`;
            }
        });
}


async function deleteDnaProfile(profileId, containerIdToRefresh) {
    if (!confirm(`"${profileId}" profilini silmek istediğinizden emin misiniz? Bu işlem geri alınamaz.`)) {
        return;
    }
    
    const deleteProfileFunc = state.firebase.functions.httpsCallable('manageDnaProfiles');
    
    try {
        const result = await deleteProfileFunc({ action: 'delete', profileId: profileId });
        if (result.data.success) {
            showNotification("Profil başarıyla silindi.", true);
            // Hangi listeden silindiyse (backtest veya strateji sayfası), onu yenile
            if (containerIdToRefresh) {
                fetchDnaProfiles(containerIdToRefresh);
            }
        } else {
            throw new Error(result.data.error || "Bilinmeyen hata.");
        }
    } catch (error) {
        console.error("Profil silinirken hata oluştu:", error);
        showNotification("Profil silinemedi: " + error.message, false);
    }
}

async function runDnaBacktest(profileId, periodDays, scoreThreshold, debugMode) {
    const container = document.getElementById('backtest-results-section');
    if (container) {
         document.querySelector('#dnaBacktestResultTable tbody').innerHTML = `<tr><td colspan="7"><div class="loading" style="margin: 20px auto; display:block;"></div></td></tr>`;
         container.style.display = 'block';
    }

    const backtestFunc = state.firebase.functions.httpsCallable('runDnaBacktest');
    
    try {
        const result = await backtestFunc({ profileId, periodDays, scoreThreshold, debugMode });
        renderDnaBacktestResults(result.data, profileId);

    } catch (error) {
        // Hata yakalandığında, 'HttpsError' kontrolü yapmadan doğrudan mesajı gösteriyoruz.
        console.error("DNA Backtest Sunucu Hatası Yakalandı:", error);
        
        // Firebase'den gelen gerçek hata mesajı 'error.message' içinde yer alır.
        const errorMessage = error.message || "Sunucuda bilinmeyen bir hata oluştu.";
        
        showNotification(`Backtest hatası: ${errorMessage}`, false);
        
        // Arayüzde hata mesajını göster
        if (container) {
            const tableBody = document.querySelector('#dnaBacktestResultTable tbody');
            if(tableBody){
                tableBody.innerHTML = `<tr><td colspan="7" style="text-align:center; color: var(--accent-red); padding: 20px;"><strong>Hata:</strong> ${errorMessage}</td></tr>`;
            }
        }
    }
}
// api.js dosyasının sonuna ekleyin
async function analyzeWithGemini(dataToAnalyze) {
    const analysisContent = document.getElementById('analysisContent');
    if (!analysisContent) {
        console.error("Analiz sonuçlarının gösterileceği 'analysisContent' elementi bulunamadı.");
        return;
    }

    showPanel('analysisPanel');
    analysisContent.innerHTML = '<div class="loading" style="margin: 20px auto; display:block;"></div>';

    try {
        // Veriyi Gemini'nin anlayacağı basit bir JSON metnine dönüştür
        const promptData = JSON.stringify(dataToAnalyze);
        
        const geminiProxyFunc = state.firebase.functions.httpsCallable('geminiProxy');
        const result = await geminiProxyFunc({ prompt: promptData });

        if (result.data && result.data.analysis) {
            analysisContent.innerHTML = result.data.analysis;
        } else {
            throw new Error("Yapay zekadan geçerli bir yanıt alınamadı.");
        }
    } catch (error) {
        console.error("Gemini analizi sırasında hata:", error);
        analysisContent.innerHTML = `<p style="color:var(--accent-red); text-align:center;">Analiz sırasında bir hata oluştu: ${error.message}</p>`;
    }
}
