// --- HESAPLAMA FONKSİYONLARI ---
// Bu kısım olduğu gibi kalıyor, çünkü projenizin başka yerlerinde kullanılıyor olabilir.
const calculateSMA = (data, period) => { if (data.length < period) return null; return data.slice(-period).reduce((s, v) => s + parseFloat(v), 0) / period; };
// ... (Diğer tüm hesaplama fonksiyonlarınız burada)

// =====================================================================
// --- YENİ VE DOĞRU API FONKSİYONLARI ---
// =====================================================================

// Firebase fonksiyonlarını doğru şekilde tanımlıyoruz
const findSignalDNAFunc = state.firebase.functions.httpsCallable('findSignalDNA');
const manageDnaProfilesFunc = state.firebase.functions.httpsCallable('manageDnaProfiles');
const runBacktestFunc = state.firebase.functions.httpsCallable('runBacktest');


// DNA Analizi Önizlemesini Çalıştırır
async function runSignalAnalysisPreview() {
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

// DNA Profilini Kaydeder
async function saveDnaProfile(params) {
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

// Mevcut DNA Profillerini Çeker
async function fetchDnaProfiles() {
    const container = document.getElementById('dnaProfilesContainer');
    try {
        // Artık 'manageDnaProfiles' fonksiyonunu doğru parametreyle çağırıyoruz
        const result = await manageDnaProfilesFunc({ action: 'get' });
        if (result.data.success) {
            renderDnaProfiles(result.data.profiles);
        } else {
            throw new Error(result.data.error);
        }
    } catch (error) {
        console.error("DNA profilleri çekilirken hata oluştu:", error);
        showNotification("Profiller yüklenemedi.", false);
        if(container) {
            container.innerHTML = `<p style="color:var(--accent-red); padding: 10px;"><b>Profiller yüklenirken bir hata oluştu.</b><br><small>Olası Sebep: ${error.message}</small></p>`;
        }
    }
}

// Bir DNA Profilini Siler
async function deleteDnaProfile(profileId) {
    if (!confirm(`"${profileId}" profilini silmek istediğinizden emin misiniz? Bu işlem geri alınamaz.`)) {
        return;
    }
    try {
        // Artık 'manageDnaProfiles' fonksiyonunu doğru parametreyle çağırıyoruz
        await manageDnaProfilesFunc({ action: 'delete', profileId: profileId });
        showNotification("Profil başarıyla silindi.", true);
        await fetchDnaProfiles(); // Listeyi yenile
    } catch (error) {
        console.error("Profil silinirken hata oluştu:", error);
        showNotification("Profil silinemedi.", false);
    }
}

// Backtest Fonksiyonu (Mevcut haliyle doğru çalışıyor)
async function runBacktest(alarmId) {
    const alarm = state.userAlarms.find(a => a.id === alarmId);
    if(!alarm) return;
    showPanel('backtestPanel');
    const container = document.getElementById('backtest-results-container');
    container.innerHTML = `<div class="loading" style="margin:20px auto;"></div>`;
    document.getElementById('backtestAlarmName').textContent = `"${alarm.name}" Stratejisi`;
    try {
        const result = await runBacktestFunc({ alarm });
        // ... (Geri kalan render kısmı aynı)
    } catch(e) {
        container.innerHTML = `<p style="color:var(--accent-red)">Hata: ${e.message}</p>`
    }
}

// --- matchDnaProfile FONKSİYONU ŞİMDİLİK DEVRE DIŞI ---
// Bu fonksiyon, maliyetli olan eski yapıya aitti.
// Yeni yapıda, arka plandaki "processSignalBatch" sonuçlarını gösterecek şekilde güncellenecek.
// Şimdilik hata vermemesi için boş bir fonksiyon olarak bırakıyoruz.
async function matchDnaProfile(coin, timeframe) {
    console.log(`'matchDnaProfile' fonksiyonu şu an pasif. Sonuçlar arka planda işleniyor.`);
    return { matches: [] }; // Boş sonuç döndürerek hatayı engelle
}
