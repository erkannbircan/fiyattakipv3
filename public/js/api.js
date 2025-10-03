// ---- GLOBAL ÇATI (her JS dosyasının en üstüne koy) ----
window.App = window.App || {
  // sürüm bilgisi bu tur için (elle güncelle)
  version: 'v3.0.0-' + (window.App?.versionTag || ''),
  loaded: {},
  guards: {},
  log: (...args) => console.log('[App]', ...args),
};

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

// api.js — Strateji keşfi önizleme (istemci)
// api.js — Strateji keşfi önizleme (SUNUCUYA DEVRET)
async function runSignalAnalysisPreview(params) {
  try {
    const fn = state.firebase.functions.httpsCallable('findSignalDNA'); // backend
    const { data } = await fn(params);
    renderSignalAnalysisPreview(data);
  } catch (err) {
    console.error('runSignalAnalysisPreview hata:', err);
    renderSignalAnalysisPreview({
      info: { status: 'error', message: String(err?.message || err) }
    });
  }
}


async function saveDnaProfile(profileData, button) {
  if (button) showLoading(button);

  try {
    if (!profileData || typeof profileData !== 'object') {
      throw new Error('Kaydedilecek profil verisi bulunamadı.');
    }

    // name boşsa güvenli bir ad üret (backend de üretebilir ama önden garanti edelim)
    if (!profileData.name) {
      const ts  = Date.now();
      const sym = profileData.coin || 'COIN';
      const tf  = profileData.timeframe || 'TF';
      const lb  = profileData.lookbackCandles ?? 'LB';
      const dir = (profileData.direction === 'down' ? '-' : '+') + (profileData.changePercent ?? 0) + '%';
      const sig = Array.isArray(profileData.featureOrder) ? profileData.featureOrder.join('').slice(0,12) : 'DNA';
      profileData.name = `${sym}__${dir}__${tf}__${lb}LB__${sig}__${ts}`;
    }

    // Zorunlu alanlar kontrolü – eksikse kullanıcıya anlaşılır mesaj
    const must = ['coin','timeframe','lookbackCandles','featureOrder','mean','std'];
    const missing = must.filter(k => profileData[k] == null || (Array.isArray(profileData[k]) && !profileData[k].length));
    if (missing.length) {
      throw new Error(`Profil alanları eksik: ${missing.join(', ')}`);
    }
    if (Array.isArray(profileData.featureOrder) &&
        (profileData.featureOrder.length !== profileData.mean.length ||
         profileData.featureOrder.length !== profileData.std.length)) {
      throw new Error('featureOrder / mean / std uzunlukları eşleşmiyor.');
    }

    const fn = state.firebase.functions.httpsCallable('saveDnaProfile');
    const result = await fn({ profile: profileData }); // uid’yi index.js ekliyor

    if (result?.data?.success) {
      showNotification(`DNA profili (${profileData.name}) başarıyla kaydedildi!`, true);
      const profileListContainer = document.getElementById('dnaProfilesContainerDiscovery');
      if (profileListContainer) fetchDnaProfiles('dnaProfilesContainerDiscovery');
      return result.data.profileId;
    } else {
      throw new Error(result?.data?.error || 'Profil kaydedilemedi.');
    }
  } catch (error) {
    console.error("saveDnaProfile hatası:", error);
    showNotification(`Profil kaydedilirken hata oluştu: ${error.message}`, false);
    throw error;
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
    const ok = await App.confirm({
        title: 'Profili Sil',
        message: `"${profileId}" profilini silmek istediğinizden emin misiniz?\nBu işlem geri alınamaz.`,
        confirmText: 'Sil',
        cancelText: 'Vazgeç',
        confirmStyle: 'danger'
    });
    if (!ok) return;

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

// === GÜNCEL: Sunucu tabanlı gerçek önizleme (multi-coin -> single-coin map) ===
async function runSignalAnalysisPreviewRemote(params) {
  try {
    // UI parametrelerini al
  const {
  coins = [],
  timeframe,
  changePercent,
  direction,
  days: periodDays,
  lookbackCandles,
  lookaheadCandles = 0,
  lookaheadMode = 'smart',
  params: dnaParams = {},
  auto = false,                       // ← YENİ
  successWindowMinutes: swm           // ← Olaydan da gelebiliyor
} = params || {};


    if (!Array.isArray(coins) || coins.length === 0) {
      renderSignalAnalysisPreview({ info: { status:'info', message:'Analiz edilecek en az bir coin seçin.' } });
      return;
    }

    // timeframe → dakika
    const tfToMin = { '15m': 15, '1h': 60, '4h': 240, '1d': 1440 };
    const timeframeMinutes = tfToMin[timeframe] || 60;

    // successWindowMinutes hesabı (UI modlarına göre)
    let successWindowMinutes = timeframeMinutes; // varsayılan: 1 mum
    if (lookaheadMode === 'custom' && Number(lookaheadCandles) > 0) {
      successWindowMinutes = timeframeMinutes * Number(lookaheadCandles);
    } else if (lookaheadMode === '1h') {
      successWindowMinutes = 60;
    } else if (lookaheadMode === '4h') {
      successWindowMinutes = 240;
    } else if (lookaheadMode === '1d') {
      successWindowMinutes = 1440;
    }

    // Feature sırası: seçili kutucuklardan üret
    const featureOrder = [];
    if (dnaParams.rsi)       featureOrder.push('rsi_avg','rsi_slope','rsi_final');
    if (dnaParams.macd)      featureOrder.push('macd_hist_avg','macd_hist_slope','macd_hist_final');
    if (dnaParams.adx)       featureOrder.push('adx_avg','adx_slope','adx_final');
    if (dnaParams.volume)    featureOrder.push('volume_mult_avg','volume_mult_slope','volume_mult_final');
    if (dnaParams.volatility)featureOrder.push('atr_pct_avg','atr_pct_slope','atr_pct_final','bb_width_avg','bb_width_slope','bb_width_final','rv_pct_avg','rv_pct_slope','rv_pct_final');
    if (dnaParams.candle)    featureOrder.push('candle_body_pct','candle_upper_shadow_pct','candle_lower_shadow_pct','candle_bullish');
    if (dnaParams.velocity||dnaParams.speed) featureOrder.push('rsi_velocity_pct','macd_hist_velocity_pct');

    const call = state.firebase.functions.httpsCallable('findSignalDNA');

    // Her coin için tek tek çağırıp UI’nin beklediği forma dönüştürelim
    const out = {};
    for (const coin of coins) {
      try {
               // ... üst kısımda featureOrder hesaplanıyor
const payload = {
  coin, timeframe, periodDays, direction,
  changePercent, lookbackCandles,
  successWindowMinutes, lookaheadCandles, lookaheadMode,
  params: dnaParams,
  auto
};

// Akıllı mod kapalıysa manuel sırayı gönder
if (!auto && Array.isArray(featureOrder)) {
  payload.featureOrder = featureOrder;
}
// Akıllı mod açıkken kesin güvence: varsa kaldır
if (auto && 'featureOrder' in payload) delete payload.featureOrder;

        const res = await call(payload);
        const data = res.data; // { summary, events, profile }

        // UI şekline çeviri
        out[coin] = {
          status: 'ok',
          eventCount: data?.summary?.signalCount ?? 0,
          avgReturns: data?.summary?.averageReturns || {}, // {'15m','1h','4h','1d'}
                     eventDetails: Array.isArray(data?.events)
             ? data.events.map(e => ({
                 timestamp:    e.details?.timestamp,
                 priceBefore:  e.details?.priceBefore,
                 priceAfter:   e.details?.priceAfter,
                 targetTime:   e.details?.targetTime,
                 mfePct:       e.details?.mfePct,
                 perf:         e.details?.perf || {},
                 score:        e.details?.score,                         // YENİ
                 mtfConfirm:   !!(e.mtfConfirm || e.details?.mtfConfirm),// YENİ → UI'daki "MTF✓"
                 expectedPct:  e.expectedPct || {},                      // YENİ → "≈ Beklenen"
                 expectedN:    e.expectedN || {}                         // YENİ → "(n)"
               }))
             : [],

          dnaProfile: data?.profile || null,
          dnaSummary: data?.profile
            ? { featureOrder: data.profile.featureOrder || [], mean: data.profile.mean || [] }
            : null
        };

      } catch (errOne) {
        console.error(`runSignalAnalysisPreviewRemote/${coin} hata:`, errOne);
        // Hata mesajını kullanıcıya Türkçe ve anlaşılır verelim
        const msg = errOne?.message || 'Sunucu hatası';
        out[coin] = { status: 'error', message: `Önizleme başarısız: ${msg}` };
      }
    }

    // Sonuçları ekrana bas
    renderSignalAnalysisPreview(out);

  } catch (err) {
    console.error('runSignalAnalysisPreviewRemote genel hata:', err);
    renderSignalAnalysisPreview({
      info: { status:'error', message: 'Sunucu önizleme başarısız. Lütfen ayarları kontrol edin.' }
    });
  }
}

