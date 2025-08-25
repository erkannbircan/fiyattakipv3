function translatePage(lang) {
    document.querySelectorAll('[data-lang]').forEach(el => {
        const key = el.getAttribute('data-lang');
        if (translations[lang]?.[key] && typeof translations[lang][key] === 'string') {
            el.textContent = translations[lang][key];
        }
    });
}

function showPage(pageId) {
    document.getElementById('app-loader').style.display = 'none';
    document.getElementById('login-page').style.display = 'none';
    document.getElementById('tracker-page').style.display = 'none';
    if (pageId) {
        const page = document.getElementById(pageId);
        if (page) page.style.display = 'flex';
    }
}

function showPanel(panelId) {
    document.getElementById(panelId)?.classList.add('show');
    document.getElementById('modalOverlay').classList.add('show');
    document.body.classList.add('modal-open');
}

function closeAllPanels() {
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

function showLoading(button) {
    if (!button) return;
    button.dataset.originalHtml = button.innerHTML;
    button.innerHTML = '<div class="loading"></div>';
    button.disabled = true;
}

function hideLoading(button) {
    if (!button) return;
    if (button.dataset.originalHtml) {
        button.innerHTML = button.dataset.originalHtml;
    }
    button.disabled = false;
}
if (typeof window.getKlines !== 'function') {
    window.getKlines = async (symbol, interval = '1h', limit = 1000) => {
        try {
            const res = await fetch(
              `https://api.binance.com/api/v3/klines?symbol=${symbol}&interval=${interval}&limit=${limit}`
            );
            return await res.json();
        } catch (e) {
            console.error('getKlines hata:', e);
            return [];
        }
    };
}

const formatPrice = (price) => {
    const num = parseFloat(price);
    if (isNaN(num)) return 'N/A';
    if (num < 0.001) return num.toFixed(8).replace(/0+$/, '');
    if (num < 1) return num.toFixed(4).replace(/0+$/, '0');
    if (num < 10) return num.toFixed(3);
    return num.toFixed(2);
};

const formatVolume = (volume) => {
    const num = parseFloat(volume);
    if (isNaN(num)) return 'N/A';
    if (num >= 1_000_000_000) return `${(num / 1_000_000_000).toFixed(2)}B`;
    if (num >= 1_000_000) return `${(num / 1_000_000).toFixed(2)}M`;
    if (num >= 1_000) return `${(num / 1_000).toFixed(2)}K`;
    return num.toFixed(0);
};

function applySettingsToUI() {
    if (!state.settings) {
        console.error("applySettingsToUI çağrıldı ancak state.settings tanımsız. Ayarlar yüklenemedi.");
        return;
    }
    const langSelect = document.getElementById('langSelect');
    if (langSelect) langSelect.value = state.settings.lang;
    const autoRefreshToggle = document.getElementById('autoRefreshToggle');
    if (autoRefreshToggle) autoRefreshToggle.checked = state.settings.autoRefresh;
    const refreshInterval = document.getElementById('refreshInterval');
    if (refreshInterval) {
        refreshInterval.value = state.settings.refreshInterval;
        refreshInterval.min = { admin: 10, qualified: 120, new_user: 300 }[state.currentUserRole] || 300;
    }
    const liveScannerInterval = document.getElementById('liveScannerInterval');
    if (liveScannerInterval) liveScannerInterval.value = state.settings.liveScannerInterval;
    const telegramPhoneInput = document.getElementById('telegramPhoneInput');
    if (telegramPhoneInput) telegramPhoneInput.value = state.settings.telegramPhone || '';
    for (let i = 1; i <= 3; i++) {
        if (state.settings.columns && state.settings.columns[i]) {
            const colNameInput = document.getElementById(`col${i}_name_input`);
            if (colNameInput) colNameInput.value = state.settings.columns[i].name;
            const colDaysInput = document.getElementById(`col${i}_days_input`);
            if (colDaysInput) colDaysInput.value = state.settings.columns[i].days;
            const colThresholdInput = document.getElementById(`col${i}_threshold_input`);
            if (colThresholdInput) colThresholdInput.value = state.settings.columns[i].threshold;
            const colHeaderCrypto = document.getElementById(`col${i}_header_crypto`);
            if (colHeaderCrypto) colHeaderCrypto.innerHTML = `${state.settings.columns[i].name}<span class="sort-indicator"></span>`;
        }
    }
    const highColorInput = document.getElementById('high_color_input');
    if (highColorInput) highColorInput.value = state.settings.colors.high;
    const lowColorInput = document.getElementById('low_color_input');
    if (lowColorInput) lowColorInput.value = state.settings.colors.low;
    const highColorPreview = document.getElementById('high_color_preview');
    if (highColorPreview) highColorPreview.style.backgroundColor = state.settings.colors.high;
    const lowColorPreview = document.getElementById('low_color_preview');
    if (lowColorPreview) lowColorPreview.style.backgroundColor = state.settings.colors.low;
    document.querySelectorAll(`#cryptoPivotFilters button.active, #cryptoIntervalFilters button.active`).forEach(b => b.classList.remove('active'));
    const pivotFilterButton = document.querySelector(`#cryptoPivotFilters button[data-filter="${state.settings.cryptoPivotFilter}"]`);
    if (pivotFilterButton) pivotFilterButton.classList.add('active');
    const intervalFilterButton = document.querySelector(`#cryptoIntervalFilters button[data-interval="${state.settings.cryptoAnalysisInterval}"]`);
    if (intervalFilterButton) intervalFilterButton.classList.add('active');
    if (typeof AVAILABLE_INDICATORS !== 'undefined' && state.settings.cryptoAnalysisIndicators) {
        Object.keys(AVAILABLE_INDICATORS).forEach(key => {
            const checkbox = document.querySelector(`#crypto-indicator-filters-grid input[data-indicator="${key}"]`);
            if (checkbox) checkbox.checked = !!state.settings.cryptoAnalysisIndicators[key];
        });
    }
    translatePage(state.settings.lang);
    if (typeof toggleAutoRefresh === 'function') {
        toggleAutoRefresh();
    }
    if (typeof toggleReportsAutoRefresh === 'function') {
        toggleReportsAutoRefresh(false);
    }
}

function updateScannerStatusUI(status) {
    const statusTextEl = document.getElementById('scannerStatusText');
    const lastScanTimeEl = document.getElementById('lastScanTime');
    const toggle = document.getElementById('toggleAutoScanner');
    if (!statusTextEl || !lastScanTimeEl || !toggle) return;
    switch (status) {
        case 'running':
            statusTextEl.textContent = 'ÇALIŞIYOR...';
            statusTextEl.className = 'status-running';
            break;
        case 'stopped':
            statusTextEl.textContent = 'DURDURULDU';
            statusTextEl.className = 'status-stopped';
            toggle.checked = false;
            break;
        case 'idle':
        default:
            statusTextEl.textContent = 'BEKLEMEDE';
            statusTextEl.className = 'status-running';
            lastScanTimeEl.textContent = new Date().toLocaleTimeString('tr-TR', {
                timeZone: 'Europe/Istanbul'
            });
            toggle.checked = true;
            break;
    }
}

function updateAdminUI() {
    const isAdmin = state.currentUserRole === 'admin';
    const analyzeBtn = document.getElementById('analyzeAllCryptoBtn');
    if (analyzeBtn) analyzeBtn.style.display = isAdmin ? 'flex' : 'none';
    const alarmsTab = document.getElementById('alarms-tab');
    if (alarmsTab) alarmsTab.style.display = isAdmin ? 'block' : 'none';
    const discoveryTab = document.getElementById('strategy-discovery-tab');
    if (discoveryTab) discoveryTab.style.display = isAdmin ? 'block' : 'none';
    const reportsTab = document.getElementById('alarm-reports-tab');
    if (reportsTab) reportsTab.style.display = isAdmin ? 'block' : 'none';
}

function createCoinManager(containerId, coinList, listName) {
    const container = document.getElementById(containerId);
    if (!container) return;
    container.innerHTML = `
        <div class="coin-manager">
            <div class="add-asset-bar">
                <input type="text" class="new-coin-input" data-list-name="${listName}" placeholder="BTC, ETH, SOL...">
                <button class="add-coin-btn" data-list-name="${listName}"><i class="fas fa-plus"></i> ${translations[state.settings.lang].add}</button>
            </div>
            <div class="coin-selection-grid" data-list-name="${listName}">
                ${(coinList || []).map(pair => `
                    <div class="coin-tag" data-pair="${pair}">
                        <span>${pair.replace("USDT", "")}</span>
                        <button class="remove-coin-tag" data-list-name="${listName}" data-pair="${pair}">&times;</button>
                    </div>
                `).join('')}
            </div>
        </div>`;
}

function updateCoinList(listName, newCoinList) {
    const grid = document.querySelector(`.coin-selection-grid[data-list-name="${listName}"]`);
    if (!grid) return;
    grid.innerHTML = (newCoinList || []).map(pair => `
        <div class="coin-tag" data-pair="${pair}">
            <span>${pair.replace("USDT", "")}</span>
            <button class="remove-coin-tag" data-list-name="${listName}" data-pair="${pair}">&times;</button>
        </div>
    `).join('');
}

function renderAllPortfolioTabs() {
    renderPortfolioTabs('portfolioTabs');
    renderPortfolioTabs('pivotPortfolioTabs');
}

function renderPortfolioTabs(containerId) {
    const tabsContainer = document.getElementById(containerId);
    if (!tabsContainer) return;
    tabsContainer.innerHTML = '';
    for (const name in state.userPortfolios) {
        const tab = document.createElement('div');
        tab.className = 'portfolio-tab';
        tab.textContent = name;
        tab.dataset.portfolioName = name;
        if (name === state.activePortfolio) {
            tab.classList.add('active');
        }
        tabsContainer.appendChild(tab);
    }
}

function showPortfolioModal(action) {
    document.getElementById('portfolioModalTitle').textContent = action === 'new' ? 'Yeni Liste Oluştur' : 'Listeyi Yeniden Adlandır';
    document.getElementById('portfolioModalLabel').textContent = action === 'new' ? 'Yeni Listenin Adı' : 'Yeni Ad';
    document.getElementById('portfolioNameInput').value = action === 'rename' ? state.activePortfolio : '';
    document.getElementById('portfolioActionInput').value = action;
    document.getElementById('originalPortfolioNameInput').value = state.activePortfolio;
    document.getElementById('portfolio-error-message').textContent = '';
    showPanel('portfolioModal');
}

function updateAllTableRows(data) {
    const tableBody = document.getElementById('cryptoPriceTable');
    if (!tableBody) return;
    tableBody.innerHTML = '';
    const isSorting = document.querySelector('#crypto-content .drag-handle-col') && !document.querySelector('#crypto-content .drag-handle-col.hidden');
    const formatPct = (pct) => (typeof pct === 'number') ? `${pct.toFixed(2)}%` : 'N/A';
    const getCellStyle = (colData, threshold) => {
        const pct = colData?.pct;
        let classes = '',
            style = '';
        if (typeof pct !== 'number') return {
            classes: '',
            style: ''
        };
        if (pct < 0) {
            classes = 'negative';
        } else if (pct >= threshold) {
            classes = 'positive-high';
            style = `style="color: ${state.settings.colors.high};"`;
        } else {
            classes = 'positive-low';
            style = `style="color: ${state.settings.colors.low};"`;
        }
        return {
            classes,
            style
        };
    };
    data.forEach(result => {
        const row = document.createElement("tr");
        row.dataset.pair = result.pair;
        let rowHTML;
        if (result.error) {
            rowHTML = `<td class="drag-handle-col ${isSorting ? '' : 'hidden'}"><i class="fas fa-grip-lines drag-handle"></i></td><td class="asset-cell">${result.pair.replace("USDT", "")}</td><td colspan="5" style="text-align:center; color: var(--accent-red);">Veri alınamadı</td>`;
        } else {
            const cellStyle1 = getCellStyle(result.col1, state.settings.columns[1].threshold);
            const cellStyle2 = getCellStyle(result.col2, state.settings.columns[2].threshold);
            const cellStyle3 = getCellStyle(result.col3, state.settings.columns[3].threshold);
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
    if (dictContainer) dictContainer.innerHTML = `
        <div class="pivot-dictionary">
            <p><span>P:</span> Pivot Noktası (Referans)</p>
            <p><span>R1, R2:</span> Direnç Seviyeleri (Yükseliş Hedefleri)</p>
            <p><span>S1, S2:</span> Destek Seviyeleri (Düşüş Durakları)</p>
        </div>`;
    const filter = state.settings.cryptoPivotFilter;
    const pivotPortfolioName = document.querySelector('#pivotPortfolioTabs .portfolio-tab.active')?.dataset.portfolioName || state.activePortfolio;
    const pivotCoinList = state.userPortfolios[pivotPortfolioName] || [];
    const dataToRender = state.allCryptoData.filter(asset => pivotCoinList.includes(asset.pair) && !asset.error && asset.sr);
    dataToRender.forEach(asset => {
        if ((filter === 'above' && asset.latestPrice < asset.sr.pivot) || (filter === 'below' && asset.latestPrice > asset.sr.pivot)) return;
        const {
            s2,
            s1,
            pivot,
            r1,
            r2
        } = asset.sr;
        const min = s2,
            max = r2;
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
            <div class="pivot-bar-header">
                <span class="pair-name">${asset.pair.replace("USDT", "")} - Günlük Pivot</span>
                <span class="insight">${insight}</span>
            </div>
            <div class="pivot-bar-container">
                <div class="pivot-bar"></div>
                <div class="current-price-indicator" style="left: ${getPosition(asset.latestPrice)}%;" data-price="$${formatPrice(asset.latestPrice)}"></div>
            </div>
            <div class="pivot-values">
                <span>S2: ${formatPrice(s2)}</span>
                <span>S1: ${formatPrice(s1)}</span>
                <span style="font-weight:bold;">P: ${formatPrice(pivot)}</span>
                <span>R1: ${formatPrice(r1)}</span>
                <span>R2: ${formatPrice(r2)}</span>
            </div>`;
        container.appendChild(card);
    });
}

function showChart(pair) {
    document.getElementById('chartPanelTitle').textContent = pair.replace("USDT", "");
    const container = document.getElementById('chartContainer');
    container.innerHTML = '<div class="loading" style="margin: auto;"></div>';
    showPanel('chartPanel');
    const savedStudies = state.settings.chartIndicators?.[pair] || [];
    try {
        state.tradingViewWidget = new TradingView.widget({
            symbol: `BINANCE:${pair}`,
            interval: "D",
            autosize: true,
            container_id: "chartContainer",
            theme: "dark",
            style: "1",
            locale: "tr",
            toolbar_bg: "#1e222d",
            enable_publishing: false,
            withdateranges: true,
            hide_side_toolbar: false,
            allow_symbol_change: true,
            details: true,
            studies: savedStudies,
            disabled_features: ["use_localstorage_for_settings"],
        });
    } catch (error) {
        console.error("TradingView widget hatası:", error);
        container.innerHTML = `<p style="color:var(--accent-red); text-align:center;">Grafik yüklenemedi.</p>`;
    }
}

function saveChartState() {
    if (state.tradingViewWidget && typeof state.tradingViewWidget.getStudiesList === 'function') {
        const currentPair = document.getElementById('chartPanelTitle').textContent + 'USDT';
        const studiesList = state.tradingViewWidget.getStudiesList();
        const updatePath = `settings.chartIndicators.${currentPair}`;
        if (state.userDocRef) {
            state.userDocRef.update({
                    [updatePath]: studiesList
                })
                .then(() => {
                    if (!state.settings.chartIndicators) {
                        state.settings.chartIndicators = {};
                    }
                    state.settings.chartIndicators[currentPair] = studiesList;
                })
                .catch(error => {
                    console.error("Grafik indikatörleri kaydedilirken hata:", error);
                });
        }
    }
}

async function renderSignalAnalysisPreview(data) {
    const resultContainer = document.getElementById('signalAnalysisResultContainer');
    if (!resultContainer) return;

    if (!data || Object.keys(data).length === 0) {
        resultContainer.innerHTML = `<p style="text-align: center; color: var(--text-secondary); padding: 20px;">Analiz için sonuç bulunamadı.</p>`;
        return;
    }

    const getPerformanceClass = (value) => (parseFloat(value) > 0 ? 'positive' : 'negative');
    const formatValue = (val, d=3) => (typeof val === 'number' ? val.toFixed(d) : 'N/A');

    // UI seçimlerine bak (gösterim için)
    const timeframe = document.getElementById('signalAnalysisTimeframe')?.value || '1h';

    let finalHtml = '';
    for (const coin in data) {
        const res = data[coin];
        const coinSymbol = coin.replace("USDT", "");
        let contentHtml = '';

        if (res.status === 'error' || res.status === 'info') {
            contentHtml = `<div class="analysis-card-simple-message">${res.message}</div>`;
        } else if (res.status === 'preview') {
            const profileDataString = JSON.stringify(res.dnaProfile);

            // 1) Olayları zamana göre (yeni->eski) sırala ve ilk 5’i al
            const allEvents = (res.eventDetails || []).slice().sort((a,b)=> b.timestamp - a.timestamp);
            const top5 = allEvents.slice(0,5);

            // 2) High/Low bazlı 1s,4s,1g MFE hesapla (gerekli klines tek sefer)
            const perfMap = await computePerEventMFEviaHighLow(coin, timeframe, allEvents);

            // 3) Fırsatlar tablosu + Tümünü Göster
            let eventsTableTop = `
                <h5 class="setting-subtitle">Bulunan Fırsat Detayları (İlk 5)</h5>
                <div class="table-wrapper compact"><table><thead>
                    <tr>
                        <th>Sinyal Zamanı</th>
                        <th>Sinyal Fiyatı</th>
                        <th>Hedef Zamanı</th>
                        <th>1s MFE%</th>
                        <th>4s MFE%</th>
                        <th>1g MFE%</th>
                    </tr>
                </thead><tbody>`;
            top5.forEach(ev => {
                const p = perfMap.get(ev.timestamp) || {};
                eventsTableTop += `
                    <tr>
                        <td>${new Date(ev.timestamp).toLocaleString('tr-TR')}</td>
                        <td>$${formatPrice(ev.priceBefore)}</td>
                        <td>${p.t1 || '-'}</td>
                        <td class="${getPerformanceClass(p.mfe1h)}">${p.mfe1h!=null ? p.mfe1h.toFixed(2)+'%' : 'N/A'}</td>
                        <td class="${getPerformanceClass(p.mfe4h)}">${p.mfe4h!=null ? p.mfe4h.toFixed(2)+'%' : 'N/A'}</td>
                        <td class="${getPerformanceClass(p.mfe1d)}">${p.mfe1d!=null ? p.mfe1d.toFixed(2)+'%' : 'N/A'}</td>
                    </tr>`;
            });
            eventsTableTop += '</tbody></table></div>';

            // Tümünü Göster kutusu
            let eventsFullHtml = `
                <div class="fold-box" id="allEventsBox_${coin}">
                    <div class="fold-box-header" onclick="this.parentElement.classList.toggle('open')">
                        <span>Tüm Fırsatları Göster</span>
                        <button class="fold-toggle"><i class="fas fa-chevron-down"></i></button>
                    </div>
                    <div class="fold-box-body">
                        <div class="table-wrapper compact"><table><thead>
                            <tr>
                                <th>Sinyal Zamanı</th>
                                <th>Sinyal Fiyatı</th>
                                <th>Hedef Zamanı</th>
                                <th>1s MFE%</th>
                                <th>4s MFE%</th>
                                <th>1g MFE%</th>
                            </tr>
                        </thead><tbody>`;

            allEvents.forEach(ev => {
                const p = perfMap.get(ev.timestamp) || {};
                eventsFullHtml += `
                    <tr>
                        <td>${new Date(ev.timestamp).toLocaleString('tr-TR')}</td>
                        <td>$${formatPrice(ev.priceBefore)}</td>
                        <td>${p.t1 || '-'}</td>
                        <td class="${getPerformanceClass(p.mfe1h)}">${p.mfe1h!=null ? p.mfe1h.toFixed(2)+'%' : 'N/A'}</td>
                        <td class="${getPerformanceClass(p.mfe4h)}">${p.mfe4h!=null ? p.mfe4h.toFixed(2)+'%' : 'N/A'}</td>
                        <td class="${getPerformanceClass(p.mfe1d)}">${p.mfe1d!=null ? p.mfe1d.toFixed(2)+'%' : 'N/A'}</td>
                    </tr>`;
            });
            eventsFullHtml += `</tbody></table></div></div></div>`;

            // 4) Parametreleri sade dille + ilk 5 önemli (mutlak değeri en büyük olanlar)
            const fo = res.dnaSummary.featureOrder || [];
            const mean = res.dnaSummary.mean || [];
            const pairs = fo.map((f,i)=>({f, m: mean[i]}));
            const sorted = pairs.slice().sort((a,b)=> Math.abs(b.m)-Math.abs(a.m));
            const top5Params = sorted.slice(0,5);

            const prettyName = (k)=> {
                const base = k.replace(/_/g,' ').toUpperCase();
                if (k.startsWith('rsi')) return 'RSI';
                if (k.startsWith('macd_hist')) return 'MACD Histogram';
                if (k.startsWith('adx')) return 'ADX';
                if (k.startsWith('volume')) return 'Hacim';
                if (k.startsWith('atr') || k.includes('atr_pct')) return 'ATR %';
                if (k.includes('bb_width')) return 'Bollinger Genişliği %';
                if (k.startsWith('rv') || k.includes('rv_pct')) return 'Gerçekleşen Vol %';
                if (k.startsWith('candle')) return 'Mum Şekli';
                return base;
            };

            const explain = (k)=> {
                if (k==='rsi_avg') return 'RSI ortalaması (14). 30 altı aşırı satım, 70 üstü aşırı alım.';
                if (k==='macd_hist_slope') return 'MACD histogram eğimi. Pozitifse momentum artıyor.';
                if (k==='volume_mult_avg') return 'Hacim / 20MA oranı. 1.5 = %50 daha yüksek hacim.';
                if (k==='atr_pct_final') return 'ATR’nin fiyata oranı (%). Oynaklık göstergesi.';
                if (k==='bb_width_final') return 'Bollinger bant genişliği %. Sıkışma/dalgalanma.';
                if (k.startsWith('candle_body')) return 'Mum gövde yüzdesi. Büyük gövde = güçlü hareket.';
                return 'Parametre';
            };

            let topParamsHtml = `
                <h5 class="setting-subtitle">Parametre & Ortalama (İlk 5)</h5>
                <div class="table-wrapper compact"><table><thead>
                    <tr><th>Parametre</th><th>Değer</th><th>Açıklama</th></tr>
                </thead><tbody>`;
            top5Params.forEach(p=>{
                topParamsHtml += `<tr><td>${prettyName(p.f)}</td><td>${formatValue(p.m, 4)}</td><td style="text-align:left;">${explain(p.f)}</td></tr>`;
            });
            topParamsHtml += `</tbody></table></div>`;

            // Tam liste (açılır)
            let allParamsHtml = `
                <div class="fold-box" id="allParams_${coin}">
                    <div class="fold-box-header" onclick="this.parentElement.classList.toggle('open')">
                        <span>Tüm Parametreleri Göster</span>
                        <button class="fold-toggle"><i class="fas fa-chevron-down"></i></button>
                    </div>
                    <div class="fold-box-body">
                        <div class="table-wrapper compact"><table><thead>
                            <tr><th>Parametre</th><th>Değer</th><th>Açıklama</th></tr>
                        </thead><tbody>`;
            pairs.forEach(p=>{
                allParamsHtml += `<tr><td>${prettyName(p.f)}</td><td>${formatValue(p.m, 4)}</td><td style="text-align:left;">${explain(p.f)}</td></tr>`;
            });
            allParamsHtml += `</tbody></table></div></div></div>`;

            // 5) DNA kısa format (kart üstünde gösterelim)
            const dnaFormat = buildDnaShortFormat(res.dnaSummary.featureOrder, res.dnaSummary.mean);

            contentHtml = `
                <div class="kpi-container">
                    <div class="kpi-item"><span class="kpi-value">${res.eventCount}</span><span class="kpi-label">Adet Fırsat</span></div>
                    <div class="kpi-item"><span class="kpi-value ${getPerformanceClass(res.avgReturns['1h'])}">${res.avgReturns['1h']}%</span><span class="kpi-label">1S Ort. Getiri</span></div>
                    <div class="kpi-item"><span class="kpi-value ${getPerformanceClass(res.avgReturns['4h'])}">${res.avgReturns['4h']}%</span><span class="kpi-label">4S Ort. Getiri</span></div>
                    <div class="kpi-item"><span class="kpi-value ${getPerformanceClass(res.avgReturns['1d'])}">${res.avgReturns['1d']}%</span><span class="kpi-label">1G Ort. Getiri</span></div>
                </div>

                <div class="analysis-card-grid">
                    <div class="analysis-card-col">
                        <div class="dna-recommendation"><strong>DNA Formatı:</strong> ${dnaFormat}</div>
                        ${eventsTableTop}
                        ${eventsFullHtml}
                    </div>
                    <div class="analysis-card-col">
                        ${topParamsHtml}
                        ${allParamsHtml}
                    </div>
                </div>

                <div class="preview-actions">
                    <button class="btn-primary save-dna-btn" data-profile='${profileDataString}'>
                        <i class="fas fa-floppy-disk"></i> ${res.dnaProfile.name} Profilini Kaydet
                    </button>
                    <div style="margin-top:8px; color:var(--text-secondary); font-size:.85rem;">
                        Kaydettikten sonra DNA Kütüphanesi’nden test edebilir ve canlı taramada kullanabilirsiniz.
                    </div>
                </div>`;
        }
        
        finalHtml += `<div class="analysis-result-card">
                        <div class="analysis-card-header"><h4>${coinSymbol} Analiz Sonuçları</h4></div>
                        ${contentHtml}
                      </div>`;
    }
    resultContainer.innerHTML = finalHtml;

    // Yardımcılar
    function buildDnaShortFormat(order, mean){
        if (!order || !mean) return '-';
        const parts = [];
        order.forEach((f,i)=>{
            const v = mean[i];
            if (f.startsWith('rsi')) parts.push(`RSI ${formatValue(v,1)}`);
            else if (f.startsWith('macd_hist') && f.includes('slope')) parts.push(`MACD Hist: ↑`);
            else if (f.startsWith('macd_hist')) parts.push(`MACD Hist ${formatValue(v,3)}`);
            else if (f.startsWith('volume_mult')) parts.push(`Hacim x${formatValue(v,2)}`);
            else if (f.includes('atr_pct')) parts.push(`ATR% ${formatValue(v,2)}`);
            else if (f.includes('bb_width')) parts.push(`BB% ${formatValue(v,2)}`);
            else if (f.startsWith('candle_bullish')) parts.push(`Mum: ${v>0.5?'Boğa':'Ayı'}`);
        });
        return parts.join(' | ');
    }

    async function computePerEventMFEviaHighLow(pair, tf, events){
        const out = new Map();
        if (!events || events.length===0) return out;

        // Klines al
        const limit = 1000;
        const klines = await getKlines(pair, tf, limit);
        if (!klines || klines.length<10) return out;

        const tfMin = { '15m':15, '1h':60, '4h':240, '1d':1440 }[tf] || 60;
        const candlesFor = (minutes)=> Math.ceil(minutes / tfMin);

        const idxByTs = new Map();
        klines.forEach((k,i)=> idxByTs.set(Number(k[0]), i));

        // Her event için index bul: en yakın açık zamanı
        for (const ev of events) {
            // ev.timestamp zaten mum açılış zamanına yakın geliyorsa direkt bulur, aksi halde yakın olanı arayalım
            let i = idxByTs.get(ev.timestamp);
            if (i==null){
                // en yakın mum
                let best=null, bestDiff=Infinity;
                klines.forEach((k,idx)=>{
                    const d = Math.abs(Number(k[0]) - ev.timestamp);
                    if (d<bestDiff){ bestDiff=d; best=idx; }
                });
                i = best;
            }
            if (i==null || i>=klines.length-2){ out.set(ev.timestamp, {}); continue; }

            const entry = Number(klines[i][4]); // referans
            const makePerf = (minutes)=>{
                const fIdx = i + candlesFor(minutes);
                const slice = klines.slice(i+1, Math.min(fIdx+1, klines.length));
                if (!slice.length) return { mfe:null, t:null };
                const highs = slice.map(k=>Number(k[2]));
                const lows  = slice.map(k=>Number(k[3]));
                const maxH = Math.max(...highs);
                const minL = Math.min(...lows);
                const upMFE = ((maxH - entry)/entry)*100;
                const downMFE = ((minL - entry)/entry)*100;
                const mfe = upMFE; // yönü UI tarafında bilinmiyorsa yükseliş MFE
                const t = new Date(slice[slice.length-1][0]).toLocaleString('tr-TR');
                return { mfe, t };
            };

            const p1 = makePerf(60);
            const p4 = makePerf(240);
            const pD = makePerf(1440);

            out.set(ev.timestamp, {
                mfe1h: p1.mfe, mfe4h: p4.mfe, mfe1d: pD.mfe,
                t1: p1.t
            });
        }
        return out;
    }
}



async function renderAlarmReports() {
    if (!state.userDocRef) return;
    const tableBody = document.getElementById('alarmReportsTable');
    if (!tableBody) return;
    try {
        const signalsSnapshot = await state.firebase.db.collection('signals')
            .where('userId', '==', state.firebase.auth.currentUser.uid)
            .orderBy('createdAt', 'desc')
            .limit(50)
            .get();
        if (signalsSnapshot.empty) {
            tableBody.innerHTML = `<tr><td colspan="8" style="text-align:center;">Henüz size özel bir sinyal üretilmedi.</td></tr>`;
            return;
        }
        const reports = signalsSnapshot.docs.map(doc => doc.data());
        const coinPairs = [...new Set(reports.map(r => r.coin))];
        if (coinPairs.length === 0) {
            tableBody.innerHTML = `<tr><td colspan="8" style="text-align:center;">Sinyallerde geçerli bir coin bulunamadı.</td></tr>`;
            return;
        }
        const pricesData = await Promise.all(coinPairs.map(pair =>
            axios.get(`https://api.binance.com/api/v3/ticker/price?symbol=${pair}`)
            .then(res => res.data)
            .catch(() => ({
                symbol: pair,
                price: null
            }))
        ));
        const priceMap = new Map(pricesData.map(p => [p.symbol, parseFloat(p.price)]));
        tableBody.innerHTML = '';
        reports.forEach(report => {
            const currentPrice = priceMap.get(report.coin);
            let performancePct = 'N/A';
            let perfClass = '';
            if (currentPrice && report.priceAtSignal > 0) {
                const change = ((currentPrice - report.priceAtSignal) / report.priceAtSignal) * 100;
                performancePct = (report.direction === 'down' ? -change : change);
                perfClass = performancePct > 0.1 ? 'positive' : (performancePct < -0.1 ? 'negative' : '');
            }
            const directionIcon = report.direction === 'up' ?
                '<span class="positive">YÜKSELİŞ</span>' :
                '<span class="negative">DÜŞÜŞ</span>';
            const row = document.createElement('tr');
            row.innerHTML = `
                <td>${report.coin.replace('USDT', '')}</td>
                <td>${directionIcon}</td>
                <td>$${formatPrice(report.priceAtSignal)}</td>
                <td>$${currentPrice ? formatPrice(currentPrice) : 'N/A'}</td>
                <td class="performance-cell ${perfClass}">${typeof performancePct === 'number' ? performancePct.toFixed(2) + '%' : 'N/A'}</td>
                <td>${report.score}/100</td>
                <td>${report.createdAt.toDate().toLocaleString('tr-TR')}</td>
                <td>${report.profileId}</td>
            `;
            tableBody.appendChild(row);
        });
    } catch (error) {
        console.error("Sinyal raporları çekilirken hata:", error);
        tableBody.innerHTML = `<tr><td colspan="8" style="text-align:center; color: var(--accent-red);">Raporlar yüklenirken bir hata oluştu. Lütfen konsolu kontrol edin.</td></tr>`;
    }
}

function renderIndicatorCards(type, data) {
    const container = document.getElementById('crypto-indicator-cards-container');
    if (!container) return;
    container.innerHTML = '';
    if (!data || data.length === 0) {
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
                ${state.settings.cryptoAnalysisIndicators.rsi ? ` <div class="indicator-item"><span class="label">RSI (14)</span><span class="value">${asset.indicators?.rsi?.toFixed(2) ?? 'N/A'}</span></div>` : ''}
                ${state.settings.cryptoAnalysisIndicators.macd ? ` <div class="indicator-item"><span class="label">MACD Hist.</span><span class="value ${asset.indicators?.macd?.histogram > 0 ? 'value-positive' : 'value-negative'}">${asset.indicators?.macd?.histogram?.toFixed(5) ?? 'N/A'}</span></div>` : ''}
                ${state.settings.cryptoAnalysisIndicators.ema ? ` <div class="indicator-item"><span class="label">EMA (50)</span><span class="value">$${formatPrice(asset.indicators?.ema)}</span></div>` : ''}
                ${state.settings.cryptoAnalysisIndicators.volume ? ` <div class="indicator-item"><span class="label">Hacim (24s)</span><span class="value">$${formatVolume(asset.indicators?.volume)}</span></div>` : ''}
            </div>
        `;
        container.appendChild(card);
    });
}

function renderIndicatorFilters() {}

function renderDictionary() {}

function renderDnaProfiles(profiles, containerId) {
    const container = document.getElementById(containerId);
    if (!container) return;
    if (!profiles || profiles.length === 0) {
        container.innerHTML = `<p style="text-align: center; color: var(--text-secondary); padding: 20px;">Henüz kaydedilmiş bir DNA profili bulunmuyor.</p>`;
        return;
    }
    const gridContainer = document.createElement('div');
    gridContainer.className = 'dna-profiles-grid';
    profiles.forEach(profile => {
        const card = document.createElement('div');
        card.className = 'dna-profile-card';
        const directionText = profile.direction === 'up' ? 'Artış Yönlü 📈' : 'Azalış Yönlü 📉';
        const activeParams = profile.featureOrder
            .map(f => f.split('_')[0].toUpperCase())
            .filter((value, index, self) => self.indexOf(value) === index)
            .join(', ');
        card.innerHTML = `
            <div class="dna-card-header">
                <div class="dna-card-title">
                    <h5>${profile.name}</h5>
                    <span>${profile.coin} / ${profile.timeframe}</span>
                </div>
                <div class="dna-card-actions">
                    <button class="action-btn run-dna-backtest-btn" data-profile-id="${profile.name}" title="Bu Profili Test Et">
                        <i class="fas fa-history"></i>
                    </button>
                    <button class="action-btn delete-dna-btn" data-profile-id="${profile.name}" data-container-id="${containerId}" title="Profili Sil">
                        <i class="fas fa-trash"></i>
                    </button>
                </div>
            </div>
            <div class="dna-card-body">
                <div class="dna-card-summary">
                    <div class="summary-item"><strong>Yön:</strong> ${directionText}</div>
                    <div class="summary-item"><strong>Hedef Değişim:</strong> %${profile.changePercent}</div>
                    <div class="summary-item"><strong>Olay Sayısı:</strong> ${profile.count}</div>
                    <div class="summary-item"><strong>Parametreler:</strong> <small>${activeParams}</small></div>
                </div>
                <div class="dna-card-details-toggle">
                    <a href="#" class="toggle-details-link">Detayları Göster/Gizle</a>
                </div>
                <div class="dna-card-details-content">
                    <h6>DNA Özeti (Ortalama Değerler)</h6>
                    <div class="details-grid">
                        ${profile.featureOrder.map((feature, index) => `
                            <div class="detail-item">
                                <span class="label">${feature}</span>
                                <span class="value">${parseFloat(profile.mean[index]).toFixed(4)}</span>
                            </div>
                        `).join('')}
                    </div>
                </div>
            </div>
        `;
        gridContainer.appendChild(card);
    });
    container.innerHTML = '';
    container.appendChild(gridContainer);
}

function renderScannerResults(groupedMatches) {
    const container = document.getElementById('scannerResultsTable');
    if (!container) return;
    if (!groupedMatches || Object.keys(groupedMatches).length === 0) {
        container.innerHTML = `<div class="scanner-no-results">Aktif profillerinize uyan bir eşleşme anlık olarak bulunamadı. Piyasa koşulları değiştikçe tarama devam ediyor...</div>`;
        return;
    }
    let html = '';
    for (const coin in groupedMatches) {
        const data = groupedMatches[coin];
        const coinSymbol = coin.replace('USDT', '');
        const allMatches = data.matches;
        if (allMatches.length === 0) continue;
        const matchesHtml = allMatches.map(match => `
            <div class="scanner-profile-match">
                <div class="profile-info">
                    <span class="profile-name">${match.profileName}</span>
                    <span class="profile-timeframe">${match.timeframe}</span>
                </div>
                <div class="profile-score-container">
                    <div class="score-bar" style="width: ${match.score}%;"></div>
                    <span class="score-text">${match.score}</span>
                </div>
            </div>
        `).join('');
        html += `
            <div class="scanner-coin-card">
                <div class="scanner-card-header">
                    <h4>${coinSymbol}</h4>
                    <span style="font-size: 1rem; font-weight: 600;">$${formatPrice(data.price)}</span>
                </div>
                <div class="scanner-card-body">
                    ${matchesHtml}
                </div>
            </div>
        `;
    }
    if (html === '') {
        container.innerHTML = `<div class="scanner-no-results">Taranacak aktif profil bulunamadı veya veri alınamadı.</div>`;
        return;
    }
    container.innerHTML = `<div class="scanner-results-grid">${html}</div>`;
}

function renderDnaBacktestResults(data, profileId) {
    const section = document.getElementById('backtest-results-section');
    const summaryContainer = document.getElementById('backtestSummaryContainer');
    const tableBody = document.querySelector('#dnaBacktestResultTable tbody');
    if (!section || !tableBody || !summaryContainer) {
        console.error("Backtest sonuçlarını gösterecek HTML elementleri bulunamadı.");
        return;
    }
    document.getElementById('backtestProfileName').textContent = `Profil: ${profileId}`;
    section.style.display = 'block';
    const {
        trades,
        summary,
        debugMode
    } = data;
    summaryContainer.innerHTML = `
        <div class="kpi-container">
            ${Object.entries(summary).map(([period, stats]) => `
                <div class="kpi-item">
                    <span class="kpi-label">${period} Sonrası Performans</span>
                    <span class="kpi-value ${stats.avgMFE > 0 ? 'positive' : 'negative'}">${stats.avgMFE}%</span>
                    <span class="kpi-label">Ort. MFE (${stats.tradeCount} işlem)</span>
                    <span class="kpi-label" style="margin-top: 5px;">TP Oranı: <strong>${stats.hitTPRate}%</strong></span>
                </div>
            `).join('')}
        </div>
    `;
    if (!trades || trades.length === 0) {
        const message = debugMode ?
            `Seçilen periyotta bu DNA profiline uyan hiçbir mum bulunamadı.` :
            `Seçilen periyotta, sinyal eşiği üzerinde bir sinyal bulunamadı.`;
        tableBody.innerHTML = `<tr><td colspan="7" style="text-align:center;">${message}</td></tr>`;
        return;
    }
    const headerHtml = `
        <th>Sinyal Tarihi</th>
        <th>Giriş Fiyatı</th>
        <th>Skor</th>
        <th>15dk (MFE %)</th><th>1saat (MFE %)</th><th>4saat (MFE %)</th><th>1gün (MFE %)</th>
    `;
    document.querySelector('#dnaBacktestResultTable thead tr').innerHTML = headerHtml;
    tableBody.innerHTML = trades.map(trade => {
        const renderPerfCell = (perf) => {
            if (perf === null) return `<td>Veri Yok</td>`;
            const perfClass = perf.mfePct > 0.1 ? 'positive' : (perf.mfePct < -0.1 ? 'negative' : '');
            const hitTPIcon = perf.hitTP ? ' <i class="fas fa-check-circle" style="color: var(--accent-green);"></i>' : '';
            return `<td class="performance-cell ${perfClass}">${perf.mfePct.toFixed(2)}%${hitTPIcon}</td>`;
        };
        const rowClass = (debugMode && !trade.isSignal) ? 'debug-row' : '';
        return `
            <tr class="${rowClass}">
                <td>${new Date(trade.entryTime).toLocaleString('tr-TR')}</td>
                <td>$${formatPrice(trade.entryPrice)}</td>
                <td>${trade.score}</td>
                ${renderPerfCell(trade.performance['15m'])}
                ${renderPerfCell(trade.performance['1h'])}
                ${renderPerfCell(trade.performance['4h'])}
                ${renderPerfCell(trade.performance['1d'])}
            </tr>
        `;
    }).join('');
    section.scrollIntoView({
        behavior: 'smooth'
    });
}
