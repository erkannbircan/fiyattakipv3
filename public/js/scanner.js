// scanner.js dosyasının tamamını bu kodla değiştirin.

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
    
    runScan();
    scannerInterval = setInterval(runScan, 60000);
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

    // Her coin için eşleşme fonksiyonunu çağırıp sonuçları tek bir listede topluyoruz
    const scanPromises = coinsToScan.map(coin => 
        matchDnaProfile(coin, timeframe)
            .then(result => result.matches) // Artık 'matches' dizisini alıyoruz
            .catch(error => {
                console.error(`Tarama hatası (${coin}):`, error);
                return []; // Hata durumunda boş dizi döndür
            })
    );

    const resultsArrays = await Promise.all(scanPromises);
    const allResults = resultsArrays.flat(); // Tüm sonuçları tek bir dizide birleştir
    
    // Sonuçları skora göre yüksekten düşüğe sırala
    allResults.sort((a, b) => b.score - a.score);

    renderScannerResults(allResults);
}

function renderScannerResults(results) {
    const tableBody = document.getElementById('scannerResultsTable');
    tableBody.innerHTML = '';

    if (results.length === 0) {
        tableBody.innerHTML = `<tr><td colspan="4" style="text-align: center; color: var(--text-secondary);">Aktif bir eşleşme bulunamadı.</td></tr>`;
        return;
    }

    // Her bir eşleşme için yeni bir satır oluştur
    results.forEach(res => {
        const row = document.createElement('tr');
        const scoreColor = res.score > 75 ? 'var(--value-positive)' : (res.score > 50 ? 'var(--accent-yellow)' : 'var(--text-secondary)');
        const directionIcon = res.direction === 'up' 
            ? '<i class="fas fa-arrow-up" style="color: var(--accent-green);"></i>' 
            : '<i class="fas fa-arrow-down" style="color: var(--accent-red);"></i>';
        
        // Profil ID'sinden daha okunaklı bir isim oluştur
        const profileName = res.profileId.replace(/_/g, ' ').replace('pct', '%');

        row.innerHTML = `
            <td>${res.coin.replace('USDT', '')} ${directionIcon}</td>
            <td><strong style="color: ${scoreColor};">${res.score} / 100</strong></td>
            <td><small>${profileName}</small></td>
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
