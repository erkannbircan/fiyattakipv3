import { functions } from './config.js';
import { httpsCallable } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-functions.js";

export const calculateSMA = (data, period) => { if (data.length < period) return null; return data.slice(-period).reduce((s, v) => s + parseFloat(v), 0) / period; };

let findSignalDNAFunc, manageDnaProfilesFunc, runBacktestFunc;

export function initializeApi(firebaseApp) {
    if (!firebaseApp || !firebaseApp.functions) {
        console.error("Firebase App, API başlatılamadan önce hazır değil!");
        return;
    }
    findSignalDNAFunc = httpsCallable(functions, 'findSignalDNA');
    manageDnaProfilesFunc = httpsCallable(functions, 'manageDnaProfiles');
    runBacktestFunc = httpsCallable(functions, 'runBacktest');
    console.log("API fonksiyonları başarıyla başlatıldı.");
}

export async function runSignalAnalysisPreview() {
    if (!findSignalDNAFunc) throw new Error("API henüz başlatılmadı.");
    const btn = document.getElementById('runSignalAnalysisBtn');
    showLoading(btn);
    try {
    } catch (error) {
    } finally {
        hideLoading(btn);
    }
}

export async function saveDnaProfile(params) {
    if (!findSignalDNAFunc) throw new Error("API henüz başlatılmadı.");
}

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
    }
}

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

export async function runBacktest(alarmId) {
    if (!runBacktestFunc) throw new Error("API henüz başlatılmadı.");
}

export async function matchDnaProfile(coin, timeframe) {
    console.warn(`'matchDnaProfile' fonksiyonu şu an pasif. Sonuçlar arka planda işleniyor.`);
    return { matches: [] };
}
