// ---- GLOBAL ÇATI (her JS dosyasının en üstüne koy) ----
window.App = window.App || {
  // sürüm bilgisi bu tur için (elle güncelle)
  version: 'v3.0.0-' + (window.App?.versionTag || ''),
  loaded: {},
  guards: {},
  log: (...args) => console.log('[App]', ...args),
};

async function sendTestTelegramMessage() {
    const btn = document.getElementById('testAlarmBtn');
    if (!state.settings.telegramChatId) {
        showNotification("Lütfen Ayarlar'dan Telegram Chat ID'nizi kaydedin.", false);
        return;
    }
    showLoading(btn);
    try {
        const sendTestNotification = state.firebase.functions.httpsCallable('sendTestNotification');
        await sendTestNotification({ chatId: state.settings.telegramChatId });
        showNotification("Test bildirimi başarıyla gönderildi!", true);
    } catch (error) {
        console.error("Telegram test hatası:", error);
        showNotification("Test bildirimi gönderilemedi. Chat ID'nizi kontrol edin.", false);
    } finally {
        hideLoading(btn);
    }
}
