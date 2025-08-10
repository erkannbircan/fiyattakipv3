async function sendTestTelegramMessage() {
    const btn = document.getElementById('testAlarmBtn');
    if (!state.settings.telegramPhone) {
        showNotification("Lütfen Ayarlar'dan Telegram Chat ID'nizi kaydedin.", false);
        return;
    }
    showLoading(btn);
    try {
        const sendTestNotification = state.firebase.functions.httpsCallable('sendTestNotification');
        await sendTestNotification({ chatId: state.settings.telegramPhone });
        showNotification("Test bildirimi başarıyla gönderildi!", true);
    } catch (error) {
        console.error("Telegram test hatası:", error);
        showNotification("Test bildirimi gönderilemedi. Chat ID'nizi kontrol edin.", false);
    } finally {
        hideLoading(btn);
    }
}
