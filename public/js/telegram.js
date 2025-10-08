// GITHUB/public/js/telegram.js DOSYASININ YENİ İÇERİĞİ

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

        // --- DÜZELTME BURADA ---
        // Sunucuya artık hem chatId hem de bir "text" alanı gönderiyoruz.
        const payload = {
            chatId: state.settings.telegramChatId,
            text: '✅ Bu bir test bildirimidir. Ayarlarınız doğru çalışıyor!'
        };
        
        await sendTestNotification(payload);

        showNotification("Test bildirimi başarıyla gönderildi!", true);
    } catch (error) {
        console.error("Telegram test hatası:", error);
        // Hata mesajını daha anlaşılır hale getirdik.
        showNotification(`Test gönderilemedi: ${error.message}`, false);
    } finally {
        hideLoading(btn);
    }
}
