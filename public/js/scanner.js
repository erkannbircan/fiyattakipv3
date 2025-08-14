// Yeni Dosya: scanner.js

/**
 * Tarama işlemini başlatan ana fonksiyon.
 */
async function startScanner() {
    const btn = document.getElementById('startScannerBtn');
    showLoading(btn);

    const resultsTable = document.getElementById('scannerResultsTable');
    resultsTable.innerHTML = `<tr><td colspan="4" style="text-align: center;">Profiller ve piyasa verileri yükleniyor...</td></tr>`;

    try {
        // 1. Aktif olan tüm DNA profillerini getir.
        const getProfilesFunc = state.firebase.functions.httpsCallable('manageDnaProfiles');
        const profilesResult = await getProfilesFunc({ action: 'get' });
        
        const activeProfiles = profilesResult.data.profiles.filter(p => p.isActive);

        if (activeProfiles.length === 0) {
            resultsTable.innerHTML = `<tr><td colspan="4" style="text-align: center;">Taranacak aktif DNA profili bulunamadı.</td></tr>`;
            hideLoading(btn);
            return;
        }

        // 2. Tarama için gerekli tüm coinleri ve parametreleri topla.
        const coinsToScan = [...new Set(activeProfiles.map(p => p.coin))];
        const uniqueParams = [...new Set(activeProfiles.map(p => JSON.stringify(p.featureOrder)))].map(s => JSON.parse(s));

        // 3. Tarama işlemini çalıştır.
        await runScan(activeProfiles, coinsToScan, uniqueParams);

    } catch (error) {
        console.error("Tarama başlatılırken hata oluştu:", error);
        resultsTable.innerHTML = `<tr><td colspan="4" style="text-align: center; color: var(--accent-red);">Hata: ${error.message}</td></tr>`;
    } finally {
        hideLoading(btn);
    }
}


/**
 * Piyasayı tarar ve eşleşmeleri bulur.
 * @param {object[]} profiles - Aktif DNA profilleri.
 * @param {string[]} coins - Taranacak coin listesi.
 */
async function runScan(profiles, coins) {
    console.log(`Tarama başlıyor: ${coins.length} coin, ${profiles.length} profile karşı taranacak.`);
    const resultsTable = document.getElementById('scannerResultsTable');
    resultsTable.innerHTML = `<tr><td colspan="4" style="text-align: center;">${coins.length} coin için anlık veriler analiz ediliyor...</td></tr>`;

    // Tüm coinler için en son mum verilerini paralel olarak çek.
    // Her coin için en az 200 mum çekerek indikatörlerin hesaplanmasını sağlıyoruz.
    const promises = coins.map(coin => getKlines(coin, '15m', 200));
    const klinesData = await Promise.all(promises);

    const matches = [];

    // Her bir coinin güncel verisini, ilgili profillerle karşılaştır.
    for (let i = 0; i < coins.length; i++) {
        const coin = coins[i];
        const klines = klinesData[i];

        if (!klines || klines.length < 50) continue;

        const relevantProfiles = profiles.filter(p => p.coin === coin);
        
        for (const profile of relevantProfiles) {
            // Profilin istediği parametreleri (featureOrder) kullanarak özellik vektörünü oluştur.
            const featureParams = {};
            profile.featureOrder.forEach(f => featureParams[f] = true);
            
            // Son mumdan bir önceki mumu baz alarak anlık DNA'yı çıkarıyoruz.
            const currentFeatures = getFeatureVector(klines, klines.length - 2, featureParams);

            if (currentFeatures && currentFeatures.vector) {
                // EŞLEŞTİRME MOTORU'nu burada kullanıyoruz.
                const distance = matchDnaProfile(currentFeatures.vector, profile);

                // Uzaklık belirli bir eşik değerinin altındaysa bu bir eşleşmedir.
                // Bu eşik değeri (örn: 1.5) ayarlanabilir bir parametre olabilir.
                if (distance !== null && distance < 1.5) {
                    matches.push({
                        coin: coin,
                        profileName: profile.name,
                        distance: distance.toFixed(4),
                        time: new Date().toLocaleTimeString()
                    });
                }
            }
        }
    }
    
    renderScannerResults(matches);
}


/**
 * Tarama sonuçlarını ekrandaki tabloya yazar.
 * @param {object[]} matches - Bulunan eşleşmelerin listesi.
 */
function renderScannerResults(matches) {
    const tableBody = document.getElementById('scannerResultsTable');
    if (matches.length === 0) {
        tableBody.innerHTML = `<tr><td colspan="4" style="text-align: center;">Eşleşme bulunamadı.</td></tr>`;
        return;
    }

    tableBody.innerHTML = matches.map(match => `
        <tr>
            <td>${match.coin.replace('USDT', '')}</td>
            <td>${match.profileName}</td>
            <td>${match.distance}</td>
            <td>${match.time}</td>
        </tr>
    `).join('');
}
