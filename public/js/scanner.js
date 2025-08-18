/**
 * Otomatik tarama zamanlayıcısını yönetir.
 * @param {boolean} shouldBeActive - Tarayıcının aktif olup olmayacağını belirtir.
 */
function toggleAutoScanner(shouldBeActive) {
    if (state.liveScannerTimer) {
        clearInterval(state.liveScannerTimer);
        state.liveScannerTimer = null;
    }

    updateScannerStatusUI(shouldBeActive ? 'idle' : 'stopped');

    if (shouldBeActive) {
        startScanner(); 
        const intervalMinutes = state.settings.liveScannerInterval || 5;
        state.liveScannerTimer = setInterval(startScanner, intervalMinutes * 60 * 1000);
    }
}

/**
 * Sunucudaki tarama fonksiyonunu çağıran ve sonuçları işleyen ana fonksiyon.
 */
async function startScanner() {
    updateScannerStatusUI('running');
    const resultsTableBody = document.getElementById('scannerResultsTable');

    try {
        const runLiveScannerFunc = state.firebase.functions.httpsCallable('runLiveScanner');
        const result = await runLiveScannerFunc();
        
        const matches = result.data.matches;
        renderScannerResults(matches);

    } catch (error) {
        console.error("Tarama sırasında hata oluştu:", error);
        resultsTableBody.innerHTML = `<tr><td colspan="4" style="text-align: center; color: var(--accent-red);">Hata: ${error.message}</td></tr>`;
    } finally {
        updateScannerStatusUI('idle');
    }
}
