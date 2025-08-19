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

// scanner.js
async function startScanner() {
    updateScannerStatusUI('running');
    // DEĞİŞİKLİK: ID artık tablo değil, ana konteyner.
    const resultsContainer = document.getElementById('scannerResultsTable');

    try {
        const runLiveScannerFunc = state.firebase.functions.httpsCallable('runLiveScanner');
        const result = await runLiveScannerFunc();
        
        // HATA DÜZELTMESİ: Backend 'groupedMatches' dönerken, burada 'matches' bekleniyordu.
        const matches = result.data.groupedMatches; 
        renderScannerResults(matches);

    } catch (error) {
        console.error("Tarama sırasında hata oluştu:", error);
        // DEĞİŞİKLİK: Hata mesajını tablo satırı yerine konteyner içine yaz.
        resultsContainer.innerHTML = `<div class="scanner-no-results" style="color: var(--accent-red);">Hata: ${error.message}</div>`;
    } finally {
        updateScannerStatusUI('idle');
    }
}
