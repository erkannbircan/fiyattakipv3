// public/js/ui.js

// --- UI HELPER FUNCTIONS ---
function translatePage(lang) { document.querySelectorAll('[data-lang]').forEach(el => { const key = el.getAttribute('data-lang'); if (translations[lang]?.[key] && typeof translations[lang][key] === 'string') el.textContent = translations[lang][key]; }); }
function showPage(pageId) {
    document.getElementById('app-loader').style.display = 'none';
    document.getElementById('login-page').style.display = 'none';
    document.getElementById('tracker-page').style.display = 'none';
    if (pageId) {
        const page = document.getElementById(pageId);
        if (page) page.style.display = 'flex';
    }
}
function showPanel(panelId) { document.getElementById(panelId)?.classList.add('show'); document.getElementById('modalOverlay').classList.add('show'); document.body.classList.add('modal-open'); }
function closeAllPanels() {
    if (document.getElementById('chartPanel').classList.contains('show')) {
        saveChartState();
    }
    document.querySelectorAll('.panel.show').forEach(p => p.classList.remove('show'));
    document.getElementById('modalOverlay').classList.remove('show');
    document.body.classList.remove('modal-open');
}
function showNotification(message, isSuccess = true) {
    const notification = document.getElementById("notification");
    notification.textContent = message;
    notification.style.backgroundColor = isSuccess ? 'var(--accent-green)' : 'var(--accent-red)';
    notification.classList.add('show');
    setTimeout(() => notification.classList.remove('show'), 3000);
}
function showLoading(button) { if (!button) return; button.dataset.originalHtml = button.innerHTML; button.innerHTML = '<div class="loading"></div>'; button.disabled = true; }
function hideLoading(button) { if (!button) return; if (button.dataset.originalHtml) { button.innerHTML = button.dataset.originalHtml; } button.disabled = false; }
const formatPrice = (price) => {
    const num = parseFloat(price);
    if (isNaN(num)) return 'N/A';
    if (num < 0.001) return num.toFixed(8).replace(/0+$/, '');
    if (num < 1) return num.toFixed(4).replace(/0+$/, '0');
    if (num < 10) return num.toFixed(3);
    return num.toFixed(2);
};
const formatVolume = (volume) => { const num = parseFloat(volume); if (isNaN(num)) return 'N/A'; if (num >= 1_000_000_000) return `${(num / 1_000_000_000).toFixed(2)}B`; if (num >= 1_000_000) return `${(num / 1_000_000).toFixed(2)}M`; if (num >= 1_000) return `${(num / 1_000).toFixed(2)}K`; return num.toFixed(0); };

// --- UI RENDERING FUNCTIONS ---
// The functions below render parts of the UI based on the current state.

function updateAllTableRows(data) {
    const tableBody = document.getElementById('cryptoPriceTable');
    if (!tableBody) return;
    tableBody.innerHTML = '';
    const isSorting = document.querySelector('#crypto-content .drag-handle-col') && !document.querySelector('#crypto-content .drag-handle-col.hidden');

    const formatPct = (pct) => (typeof pct === 'number') ? `${pct.toFixed(2)}%` : 'N/A';
    const getCellStyle = (colData, threshold) => {
        const pct = colData?.pct; let classes = '', style = '';
        if (typeof pct !== 'number') return { classes: '', style: '' };
        if (pct < 0) { classes = 'negative'; }
        else if (pct >= threshold) { classes = 'positive-high'; style = `style="color: ${settings.colors.high};"`; }
        else { classes = 'positive-low'; style = `style="color: ${settings.colors.low};"`; }
        return { classes, style };
    };

    data.forEach(result => {
        const row = document.createElement("tr");
        row.dataset.pair = result.pair;
        let rowHTML;

        if (result.error) {
            rowHTML = `<td class="drag-handle-col ${isSorting ? '' : 'hidden'}"><i class="fas fa-grip-lines drag-handle"></i></td><td class="asset-cell">${result.pair.replace("USDT", "")}</td><td colspan="5" style="text-align:center; color: var(--accent-red);">Veri alınamadı</td>`;
        } else {
            const cellStyle1 = getCellStyle(result.col1, settings.columns[1].threshold);
            const cellStyle2 = getCellStyle(result.col2, settings.columns[2].threshold);
            const cellStyle3 = getCellStyle(result.col3, settings.columns[3].threshold);
            rowHTML = `
                <td class="drag-handle-col ${isSorting ? '' : 'hidden'}"><i class="fas fa-grip-lines drag-handle"></i></td>
                <td class="asset-cell" data-pair="${result.pair}">${result.pair.replace("USDT", "")}</td>
                <td>${formatPrice(result.latestPrice)}</td>
                <td class="${cellStyle1.classes} clickable-pct" ${cellStyle1.style} data-col="1" data-pair="${result.pair}">${formatPct(result.col1.pct)}</td>
                <td class="${cellStyle2.classes} clickable-pct" ${cellStyle2.style} data-col="2" data-pair="${result.pair}">${formatPct(result.col2.pct)}</td>
                <td class="${cellStyle3.classes} clickable-pct" ${cellStyle3.style} data-col="3" data-pair="${result.pair}">${formatPct(result.col3.pct)}</td>
            `;
        }
        rowHTML += `<td><button class="action-btn remove-btn" data-list-name="crypto" data-pair="${result.pair}"><i class="fas fa-times"></i></button></td>`;
        row.innerHTML = rowHTML;
        tableBody.appendChild(row);
    });
}

function renderSupportResistance() {
    const container = document.getElementById('crypto-pivot-container');
    if (!container) return;
    container.innerHTML = '';
    const dictContainer = document.getElementById('pivot-dictionary-container');
    if(dictContainer) dictContainer.innerHTML = `<div class="pivot-dictionary"><p><span>P:</span> Pivot Noktası (Referans)</p><p><span>R1, R2:</span> Direnç Seviyeleri (Yükseliş Hedefleri)</p><p><span>S1, S2:</span> Destek Seviyeleri (Düşüş Durakları)</p></div>`;

    const filter = settings.cryptoPivotFilter;
    const pivotPortfolioName = document.querySelector('#pivotPortfolioTabs .portfolio-tab.active')?.dataset.portfolioName || activePortfolio;
    const pivotCoinList = userPortfolios[pivotPortfolioName] || [];
    const dataToRender = allCryptoData.filter(asset => pivotCoinList.includes(asset.pair) && !asset.error && asset.sr);
    
    dataToRender.forEach(asset => {
        if ((filter === 'above' && asset.latestPrice < asset.sr.pivot) || (filter === 'below' && asset.latestPrice > asset.sr.pivot)) return;

        const { s2, s1, pivot, r1, r2 } = asset.sr;
        const min = s2, max = r2;
        if (max <= min) return;
        const range = max - min;
        const getPosition = (value) => Math.max(0, Math.min(100, ((value - min) / range) * 100));

        let insight = '';
        if (asset.latestPrice > r1) insight = `R1 direnci kırıldı, R2 hedefleniyor.`;
        else if (asset.latestPrice > pivot) insight = `Pivot üzerinde, R1 direncine yaklaşıyor.`;
        else if (asset.latestPrice < s1) insight = `S1 desteği kırıldı, S2 test edilebilir.`;
        else if (asset.latestPrice < pivot) insight = `Pivot altında, S1 desteğine yaklaşıyor.`;

        const card = document.createElement('div');
        card.className = 'pivot-bar-card';
        card.innerHTML = `
            <div class="pivot-bar-header"><span class="pair-name">${asset.pair.replace("USDT", "")} - Günlük Pivot</span><span class="insight">${insight}</span></div>
            <div class="pivot-bar-container">
                <div class="pivot-bar"></div>
                <div class="current-price-indicator" style="left: ${getPosition(asset.latestPrice)}%;" data-price="$${formatPrice(asset.latestPrice)}"></div>
            </div>
            <div class="pivot-values">
                <span>S2: ${formatPrice(s2)}</span><span>S1: ${formatPrice(s1)}</span><span style="font-weight:bold;">P: ${formatPrice(pivot)}</span><span>R1: ${formatPrice(r1)}</span><span>R2: ${formatPrice(r2)}</span>
            </div>`;
        container.appendChild(card);
    });
}

function renderAlarms() {
    const container = document.getElementById('alarmsListContainer');
    if (!container) return;
    container.innerHTML = userAlarms.length === 0 ? `<p style="text-align:center; color: var(--text-secondary);">Henüz oluşturulmuş alarm yok.</p>` : '';
    userAlarms.forEach(alarm => {
        const card = document.createElement('div');
        card.className = 'alarm-card';
        card.dataset.alarmId = alarm.id;
        const coinsToDisplay = alarm.coins || [];
        card.innerHTML = `
            <div class="alarm-card-header">
                <div class="alarm-card-title">${alarm.name}</div>
                <div class="alarm-card-actions">
                    <button class="action-btn check-alarm-status-btn" title="Durumu Kontrol Et"><i class="fas fa-chart-bar"></i></button>
                    <label class="switch" title="${alarm.isActive ? 'Aktif' : 'Pasif'}"><input type="checkbox" class="alarm-status-toggle" ${alarm.isActive ? 'checked' : ''}><span class="slider"></span></label>
                    <button class="action-btn edit-alarm-btn" title="Düzenle"><i class="fas fa-edit"></i></button>
                    <button class="action-btn delete-alarm-btn" title="Sil"><i class="fas fa-trash"></i></button>
                    <button class="action-btn backtest-alarm-btn" title="Backtest Sonuçları"><i class="fas fa-history"></i></button>
                </div>
            </div>
            <div class="alarm-card-details">
                <div class="coin-selection-display">
                    ${(coinsToDisplay.length > 0 ? coinsToDisplay.slice(0, 5) : ['Tüm Liste']).map(c => `<span class="coin-tag-sm">${c.replace("USDT","")}</span>`).join('')}
                    ${(coinsToDisplay.length > 5) ? `<span class="coin-tag-sm">+${coinsToDisplay.length - 5}</span>` : ''}
                </div>
            </div>`;
        container.appendChild(card);
    });
}

function renderIndicatorCards(type, data) {
    const container = document.getElementById('crypto-indicator-cards-container');
    if(!container) return;
    container.innerHTML = '';
    if(!data || data.length === 0) {
        container.innerHTML = `<p style="text-align:center; color: var(--text-secondary);">Analiz edilecek coin bulunmuyor.</p>`;
        return;
    }

    data.forEach(asset => {
        const card = document.createElement('div');
        card.className = 'indicator-card';
        if (asset.error) {
            card.innerHTML = `<h4>${asset.pair.replace("USDT", "")}</h4><p style="color:var(--accent-red)">Veri yüklenemedi.</p>`;
            container.appendChild(card);
            return;
        }
        
        card.innerHTML = `
            <div class="indicator-card-header">
                <h4>${asset.pair.replace("USDT", "")}</h4>
                <span>$${formatPrice(asset.latestPrice)}</span>
            </div>
            <p style="color: var(--text-secondary); font-size: 0.9rem;">Detaylı AI Analizi sonuçları bu alanda gösterilebilir.</p>
             <div class="indicator-details-grid">
                ${settings.cryptoAnalysisIndicators.rsi ? ` <div class="indicator-item"><span class="label">RSI (14)</span><span class="value">${asset.indicators.rsi?.toFixed(2) ?? 'N/A'}</span></div>` : ''}
                ${settings.cryptoAnalysisIndicators.macd ? ` <div class="indicator-item"><span class="label">MACD Hist.</span><span class="value ${asset.indicators.macd?.histogram > 0 ? 'value-positive' : 'value-negative'}">${asset.indicators.macd?.histogram?.toFixed(5) ?? 'N/A'}</span></div>` : ''}
                ${settings.cryptoAnalysisIndicators.ema ? ` <div class="indicator-item"><span class="label">EMA (50)</span><span class="value">$${formatPrice(asset.indicators.ema)}</span></div>` : ''}
                ${settings.cryptoAnalysisIndicators.volume ? ` <div class="indicator-item"><span class="label">Hacim (24s)</span><span class="value">$${formatVolume(asset.indicators.volume)}</span></div>` : ''}
            </div>
        `;
        container.appendChild(card);
    });
}

// Other rendering functions like renderAllPortfolioTabs, createCoinManager, etc.
// should be moved from the original script.js to here.
