// scanner.js dosyasının tam ve güncel hali

/**
 * Otomatik tarama zamanlayıcısını yönetir.
 * @param {boolean} shouldBeActive - Tarayıcının aktif olup olmayacağını belirtir.
 */
function toggleAutoScanner(shouldBeActive) {
    // Mevcut bir zamanlayıcı varsa temizle
    if (state.liveScannerTimer) {
        clearInterval(state.liveScannerTimer);
        state.liveScannerTimer = null;
    }

    // Arayüzü güncelle
    updateScannerStatusUI(shouldBeActive ? 'idle' : 'stopped');

    if (shouldBeActive) {
        // Tarayıcıyı hemen bir kere çalıştır
        startScanner(); 
        
        // Ayarlanan aralıkla periyodik olarak çalışması için zamanlayıcı kur
        const intervalMinutes = state.settings.liveScannerInterval || 5;
        state.liveScannerTimer = setInterval(startScanner, intervalMinutes * 60 * 1000);
    }
}

/**
 * Tarama işlemini başlatan ana fonksiyon. Artık butonsuz çalışır.
 */
async function startScanner() {
    const resultsTableBody = document.getElementById('scannerResultsTable');
    updateScannerStatusUI('running');

    try {
        const getProfilesFunc = state.firebase.functions.httpsCallable('manageDnaProfiles');
        const profilesResult = await getProfilesFunc({ action: 'get' });
        
        const activeProfiles = profilesResult.data.profiles.filter(p => p.isActive);

        if (activeProfiles.length === 0) {
            resultsTableBody.innerHTML = `<tr><td colspan="4" style="text-align: center;">Taranacak aktif DNA profili bulunamadı.</td></tr>`;
            updateScannerStatusUI('idle');
            return;
        }

        const uniqueCoins = [...new Set(activeProfiles.map(p => p.coin))];
        
        await runScan(activeProfiles, uniqueCoins);

    } catch (error) {
        console.error("Tarama sırasında hata oluştu:", error);
        resultsTableBody.innerHTML = `<tr><td colspan="4" style="text-align: center; color: var(--accent-red);">Hata: ${error.message}</td></tr>`;
    } finally {
        updateScannerStatusUI('idle');
    }
}

/**
 * Piyasayı tarar ve eşleşmeleri bulur.
 * @param {object[]} profiles - Aktif DNA profilleri.
 * @param {string[]} coins - Taranacak coin listesi.
 */
async function runScan(profiles, coins) {
    console.log(`Tarama başlıyor: ${coins.length} coin, ${profiles.length} profile karşı taranacak.`);
    
    const dataRequirements = {};
    profiles.forEach(p => {
        if (!dataRequirements[p.coin]) dataRequirements[p.coin] = {};
        const lookback = p.lookbackCandles || 3;
        const requiredCandles = 50 + lookback; 
        if (!dataRequirements[p.coin][p.timeframe] || requiredCandles > dataRequirements[p.coin][p.timeframe]) {
            dataRequirements[p.coin][p.timeframe] = requiredCandles;
        }
    });

    const klinePromises = [];
    for (const coin in dataRequirements) {
        for (const timeframe in dataRequirements[coin]) {
            klinePromises.push(
                getKlines(coin, timeframe, dataRequirements[coin][timeframe]).then(data => ({ coin, timeframe, data }))
            );
        }
    }
    
    const klinesResults = await Promise.all(klinePromises);
    const klinesData = {};
    klinesResults.forEach(res => {
        if (!klinesData[res.coin]) klinesData[res.coin] = {};
        klinesData[res.coin][res.timeframe] = res.data;
    });

    const matches = [];
    const now = new Date();

    for (const profile of profiles) {
        const { coin, timeframe, featureOrder, lookbackCandles } = profile;
        const klines = klinesData[coin]?.[timeframe];
        
        if (!klines || klines.length < dataRequirements[coin][timeframe]) continue;

        const params = {};
        if (featureOrder.some(f => f.startsWith('rsi'))) params.rsi = true;
        if (featureOrder.some(f => f.startsWith('macd'))) params.macd = true;
        if (featureOrder.some(f => f.startsWith('adx'))) params.adx = true;
        if (featureOrder.some(f => f.startsWith('volume'))) params.volume = true;
        if (featureOrder.some(f => f.startsWith('atr') || f.startsWith('bb') || f.startsWith('rv'))) params.volatility = true;
        if (featureOrder.some(f => f.startsWith('candle'))) params.candle = true;
        if (featureOrder.some(f => f.startsWith('rsi_vel') || f.startsWith('macd_hist_vel'))) params.velocity = true;
        
        const currentFeatures = getMultiCandleFeatureVector(klines, klines.length - 2, lookbackCandles, params);
        
        if (currentFeatures && currentFeatures.vector) {
            const distance = matchDnaProfile(currentFeatures.vector, profile);
            if (distance !== null) {
                matches.push({
                    coin: coin,
                    profileName: profile.name,
                    distance: distance.toFixed(4),
                    time: now.toLocaleTimeString('tr-TR', { timeZone: 'Europe/Istanbul' })
                });
            }
        }
    }
    
    renderScannerResults(matches);
}
