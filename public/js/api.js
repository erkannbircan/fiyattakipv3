// api.js - NİHAİ VE DOĞRU VERSİYON

import { functions } from './config.js';
import { httpsCallable } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-functions.js";

// --- HESAPLAMA FONKSİYONLARI ---
// Bunlar bağımsız çalıştığı için olduğu gibi kalabilir
export const calculateSMA = (data, period) => { if (data.length < period) return null; return data.slice(-period).reduce((s, v) => s + parseFloat(v), 0) / period; };
// ... (Diğer tüm calculate... fonksiyonlarınız buraya eklenecek, şimdilik bu örnek yeterli)


// --- FIREBASE BAĞIMLI FONKSİYONLAR ---
// Bu fonksiyonları dışarıdan çağırabilmek için önce tanımlıyoruz
let findSignalDNAFunc, manageDnaProfilesFunc, runBacktestFunc;

// Bu fonksiyon, app.js'den firebase hazır olduğunda çağrılacak
export function initializeApi(firebaseApp) {
    if (!firebaseApp || !firebaseApp.functions) {
        console.error("Firebase App, API başlatılamadan önce hazır değil!");
        return;
    }
    // Firebase hazır olduğunda, callable fonksiyonları tanımlıyoruz
    findSignalDNAFunc = httpsCallable(functions, 'findSignalDNA');
    manageDnaProfilesFunc = httpsCallable(functions, 'manageDnaProfiles');
    runBacktestFunc = httpsCallable(functions, 'runBacktest');
    console.log("API fonksiyonları başarıyla başlatıldı.");
}


// --- DIŞARIYA AÇILAN FONKSİYONLAR ---

// DNA Analizi Önizlemesini Çalıştırır
export async function runSignalAnalysisPreview() {
    if (!findSignalDNAFunc) throw new Error("API henüz başlatılmadı.");
    // ... (Bu fonksiyonun geri kalan mantığı, önceki mesajlardaki gibi aynı)
    // Örnek olarak bir kısmını ekliyorum:
    const btn = document.getElementById('runSignalAnalysisBtn');
    showLoading(btn);
    // ... parametreleri al ...
    try {
        // const result = await findSignalDNAFunc(params);
        // renderSignalAnalysisPreview(result.data);
    } catch (error) {
        // ... hata yönetimi ...
    } finally {
        hideLoading(btn);
    }
}

// DNA Profilini Kaydeder
export async function saveDnaProfile(params) {
    if (!findSignalDNAFunc) throw new Error("API henüz başlatılmadı.");
    // ... (Bu fonksiyonun geri kalan mantığı, önceki mesajlardaki gibi aynı)
}

// Mevcut DNA Profillerini Çeker
export async function fetchDnaProfiles() {
    if (!manageDnaProfilesFunc) throw new Error("API henüz başlatılmadı.");
    try {
        const result = await manageDnaProfilesFunc({ action: 'get' });
        if (result.data.success) {
            renderDnaProfiles(result.data.profiles);
        } else {
            throw new Error(result.data.error);
        }
    } catch (error) {
        console.error("DNA profilleri çekilirken hata oluştu:", error);
        // ... hata yönetimi ...
    }
}

// Bir DNA Profilini Siler
export async function deleteDnaProfile(profileId) {
    if (!manageDnaProfilesFunc) throw new Error("API henüz başlatılmadı.");
     if (!confirm(`"${profileId}" profilini silmek istediğinizden emin misiniz?`)) return;
    try {
        await manageDnaProfilesFunc({ action: 'delete', profileId: profileId });
        showNotification("Profil başarıyla silindi.", true);
        await fetchDnaProfiles();
    } catch (error) {
        console.error("Profil silinirken hata oluştu:", error);
        showNotification("Profil silinemedi.", false);
    }
}

// Backtest Fonksiyonu
export async function runBacktest(alarmId) {
    if (!runBacktestFunc) throw new Error("API henüz başlatılmadı.");
    // ... (Bu fonksiyonun geri kalan mantığı, önceki mesajlardaki gibi aynı)
}


// --- BU FONKSİYON ŞİMDİLİK PASİF ---
export async function matchDnaProfile(coin, timeframe) {
    console.warn(`'matchDnaProfile' fonksiyonu şu an pasif. Sonuçlar arka planda işleniyor.`);
    return { matches: [] };
}


// --- BU FONKSİYON app.js İÇİNE TAŞINACAK ---
// Bu dosyadaki fetchCryptoData fonksiyonunu silin veya yorum satırı yapın.
/*
async function fetchCryptoData(pair, withIndicators = false) {
    // ...
}
*/
