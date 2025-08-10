let scannerInterval = null;

function startScanner() {
    const btn = document.getElementById('startScannerBtn');
    if (scannerInterval) {
        clearInterval(scannerInterval);
        scannerInterval = null;
        btn.innerHTML = '<i class="fas fa-play"></i> Taramayı Başlat';
        document.getElementById('scannerTimeframe').disabled = false;
        showNotification("Tarama durduruldu.", true);
        return;
    }

    btn.innerHTML = '<i class="fas fa-stop"></i> Taramayı Durdur';
    document.getElementById('scannerTimeframe').disabled = true;
    showNotification("Tarama başlatıldı...", true);
    
    runScan(); // İlk taramayı hemen yap
    scannerInterval = setInterval(runScan, 60000); // Her 1 dakikada bir tekrarla
}

async function runScan() {
    const timeframe = document.getElementById('scannerTimeframe').value;
    const coinsToScan = state.userPortfolios[state.activePortfolio] || [];
    const tableBody = document.getElementById('scannerResultsTable');

    if (coinsToScan.length === 0) {
        tableBody.innerHTML = `<tr><td colspan="4" style="text-align: center; color: var(--text-secondary);">Taranacak coin bulunmuyor.</td></tr>`;
        return;
    }

    tableBody.innerHTML = `<tr><td colspan="4" style="text-align: center;"><div class="loading"></div></td></tr>`;

    const scanPromises = coinsToScan.map(coin => 
        matchDnaProfile(coin, timeframe)
            .then(result => ({ coin, ...result }))
            .catch(error => ({ coin, score: 0, message: 'Analiz hatası' }))
    );

    const results = await Promise.all(scanPromises);
    
    results.sort((a, b) => b.score - a.score);

    renderScannerResults(results);
}

function renderScannerResults(results) {
    const tableBody = document.getElementById('scannerResultsTable');
    tableBody.innerHTML = '';

    if (results.length === 0) {
        tableBody.innerHTML = `<tr><td colspan="4" style="text-align: center; color: var(--text-secondary);">Sonuç bulunamadı.</td></tr>`;
        return;
    }

    results.forEach(res => {
        const row = document.createElement('tr');
        const scoreColor = res.score > 75 ? 'var(--value-positive)' : (res.score > 50 ? 'var(--accent-yellow)' : 'var(--text-secondary)');
        
        row.innerHTML = `
            <td>${res.coin.replace('USDT', '')}</td>
            <td><strong style="color: ${scoreColor};">${res.score} / 100</strong></td>
            <td>${res.profileId ? res.profileId.replace(/_/g, ' ') : 'N/A'}</td>
            <td>Yükleniyor...</td>
        `;
        tableBody.appendChild(row);

        axios.get(`https://api.binance.com/api/v3/ticker/price?symbol=${res.coin}`)
            .then(response => {
                row.cells[3].textContent = `$${formatPrice(response.data.price)}`;
            })
            .catch(() => {
                row.cells[3].textContent = 'Fiyat alınamadı';
            });
    });
}
