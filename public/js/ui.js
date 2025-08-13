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
    // Bu fonksiyon artık sadece ve sadece panelleri kapatır.
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

// --- HATA BURADAYDI: FAZLADAN '}' KARAKTERİ SİLİNDİ ---

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
    document.getElementById('langSelect').value = state.settings.lang;
    document.getElementById('autoRefreshToggle').checked = state.settings.autoRefresh;
    document.getElementById('refreshInterval').value = state.settings.refreshInterval;
    document.getElementById('refreshInterval').min = { admin: 10, qualified: 120, new_user: 300 }[state.currentUserRole] || 300;
    document.getElementById('telegramPhoneInput').value = state.settings.telegramPhone || '';

    for (let i = 1; i <= 3; i++) {
        if (state.settings.columns[i]) {
            document.getElementById(`col${i}_name_input`).value = state.settings.columns[i].name;
            document.getElementById(`col${i}_days_input`).value = state.settings.columns[i].days;
            document.getElementById(`col${i}_threshold_input`).value = state.settings.columns[i].threshold;
            document.getElementById(`col${i}_header_crypto`).innerHTML = `${state.settings.columns[i].name}<span class="sort-indicator"></span>`;
        }
    }
    document.getElementById('high_color_input').value = state.settings.colors.high;
    document.getElementById('low_color_input').value = state.settings.colors.low;
    document.getElementById('high_color_preview').style.backgroundColor = state.settings.colors.high;
    document.getElementById('low_color_preview').style.backgroundColor = state.settings.colors.low;

    document.querySelectorAll(`#cryptoPivotFilters button.active, #cryptoIntervalFilters button.active`).forEach(b => b.classList.remove('active'));
    document.querySelector(`#cryptoPivotFilters button[data-filter="${state.settings.cryptoPivotFilter}"]`)?.classList.add('active');
    document.querySelector(`#cryptoIntervalFilters button[data-interval="${state.settings.cryptoAnalysisInterval}"]`)?.classList.add('active');

    Object.keys(AVAILABLE_INDICATORS).forEach(key => {
        const checkbox = document.querySelector(`#crypto-indicator-filters-grid input[data-indicator="${key}"]`);
        if (checkbox) checkbox.checked = !!state.settings.cryptoAnalysisIndicators[key];
    });
    translatePage(state.settings.lang);
    toggleAutoRefresh();
    toggleReportsAutoRefresh(false);
}

function updateAdminUI() {
    const isAdmin = state.currentUserRole === 'admin';
    document.getElementById('analyzeAllCryptoBtn').style.display = isAdmin ? 'flex' : 'none';
    document.getElementById('alarms-tab').style.display = isAdmin ? 'block' : 'none';
    document.getElementById('strategy-discovery-tab').style.display = isAdmin ? 'block' : 'none';
    document.getElementById('alarm-reports-tab').style.display = isAdmin ? 'block' : 'none';
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
        if (typeof pct !== 'number') return { classes: '', style: '' };
        if (pct < 0) { classes = 'negative'; } else if (pct >= threshold) { classes = 'positive-high';
            style = `style="color: ${state.settings.colors.high};"`; } else { classes = 'positive-low';
            style = `style="color: ${state.settings.colors.low};"`; }
        return { classes, style };
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

        const { s2, s1, pivot, r1, r2 } = asset.sr;
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
    // Bu fonksiyon artık grafik panelini kapatırken çağrılacak.
    if (state.tradingViewWidget && typeof state.tradingViewWidget.getStudiesList === 'function') {
        const currentPair = document.getElementById('chartPanelTitle').textContent + 'USDT';

        const studiesList = state.tradingViewWidget.getStudiesList();

        const updatePath = `settings.chartIndicators.${currentPair}`;

        if (state.userDocRef) {
            state.userDocRef.update({
                    [updatePath]: studiesList
                })
                .then(() => {
                    console.log(`Grafik indikatörleri kaydedildi: ${currentPair}`, studiesList);
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

function renderAlarms() {
    const container = document.getElementById('alarmsListContainer');
    if (!container) return;
    container.innerHTML = state.userAlarms.length === 0 ? `<p style="text-align:center; color: var(--text-secondary);">Henüz oluşturulmuş alarm yok.</p>` : '';
    state.userAlarms.forEach(alarm => {
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

function openAlarmPanel(alarm = null, suggestedParams = null) {
    document.getElementById('alarmPanelTitle').textContent = alarm ? 'Alarmı Düzenle' : 'Yeni Alarm Oluştur';
    const alarmId = alarm ? alarm.id : '';
    document.getElementById('alarmIdInput').value = alarmId;

    const dnaRecDiv = document.querySelector('#alarmSettingsPanel .dna-recommendation');
    if (dnaRecDiv) dnaRecDiv.remove();

    document.querySelectorAll('#alarmSettingsPanel [data-condition]').forEach(el => {
        el.checked = false;
        const parentBox = el.closest('.alarm-condition-box');
        if (parentBox) parentBox.dataset.disabled = "true";
    });

    document.getElementById('alarmNameInput').value = '';
    document.getElementById('alarmTimeframe').value = '15m';
    document.getElementById('alarmVolumeMultiplier').value = 2;
    document.getElementById('alarmADXThreshold').value = 25;
    document.getElementById('alarmMacdHistogramValue').value = 0;
    document.getElementById('alarmRsiValue').value = 30;

    if (suggestedParams) {
        const { coin, timeframe, direction, dna, dna_analysis } = suggestedParams;
        document.getElementById('alarmNameInput').value = `${coin.replace('USDT','')} DNA Alarmı`;
        state.tempAlarmCoins = [coin];
        document.getElementById('alarmTimeframe').value = timeframe;

        const recommendationDiv = document.createElement('div');
        recommendationDiv.className = 'dna-recommendation';
        recommendationDiv.innerHTML = `💡 <strong>AI Önerisi:</strong> Bu alarm, "${coin.replace('USDT','')}" için bulunan başarılı DNA'ya göre ayarlanıyor.`;
        const firstCollapsible = document.querySelector('#alarmSettingsPanel .collapsible-content');
        if (firstCollapsible) firstCollapsible.prepend(recommendationDiv);

        document.getElementById('alarmMacdSignalType').value = direction === 'up' ? 'buy' : 'sell';

        if (dna.avgVolumeMultiplier) {
            document.getElementById('alarmVolumeCondition').checked = true;
            document.getElementById('alarmVolumeMultiplier').value = parseFloat(dna.avgVolumeMultiplier).toFixed(1);
        }
        if (dna.avgMacdHist) {
            document.getElementById('alarmMacdHistogramCondition').checked = true;
            document.getElementById('alarmMacdHistogramOperator').value = dna.avgMacdHist > 0 ? 'above' : 'below';
            document.getElementById('alarmMacdHistogramValue').value = parseFloat(dna.avgMacdHist).toFixed(6);
        }
        if (dna.avgAdx) {
            document.getElementById('alarmTrendFilterEnabled').checked = true;
            document.getElementById('alarmADXThreshold').value = Math.max(20, Math.floor(dna.avgAdx));
        }
        if (dna.avgRsi) {
            document.getElementById('alarmRsiCondition').checked = true;
            document.getElementById('alarmRsiOperator').value = direction === 'up' ? 'below' : 'above';
            document.getElementById('alarmRsiValue').value = Math.round(dna.avgRsi);
        }
        document.getElementById('alarmMacdCondition').checked = true;

    } else {
        document.getElementById('alarmNameInput').value = alarm?.name || '';
        state.tempAlarmCoins = alarm?.coins?.length > 0 ? [...alarm.coins] : [...(state.userPortfolios[state.activePortfolio] || [])];
        const conditions = alarm?.conditions || {};
        document.getElementById('alarmTimeframe').value = alarm?.timeframe || '15m';

        if (conditions.volume) {
            document.getElementById('alarmVolumePeriod').value = conditions.volume.period ?? 20;
            document.getElementById('alarmVolumeMultiplier').value = conditions.volume.multiplier ?? 2;
        }
        if (conditions.macdHistogram) {
            document.getElementById('alarmMacdHistogramOperator').value = conditions.macdHistogram.operator ?? 'above';
            document.getElementById('alarmMacdHistogramValue').value = conditions.macdHistogram.value ?? 0;
        }
        if (conditions.rsi) {
            document.getElementById('alarmRsiOperator').value = conditions.rsi.operator ?? 'above';
            document.getElementById('alarmRsiValue').value = conditions.rsi.value ?? 30;
        }
        document.getElementById('alarmADXThreshold').value = alarm?.adxThreshold ?? 25;
    }

    document.querySelectorAll('#alarmSettingsPanel [data-condition]').forEach(el => {
        if (alarm && alarm.conditions) {
            const conditionName = el.dataset.condition;
            const isEnabled = conditionName === 'adx' ? alarm.trendFilterEnabled : alarm.conditions[conditionName]?.enabled;
            el.checked = !!isEnabled;
        }
        const parentBox = el.closest('.alarm-condition-box');
        if (parentBox) {
            parentBox.dataset.disabled = String(!el.checked);
        }
    });

    createCoinManager('alarm-coin-manager-container', state.tempAlarmCoins, 'alarm');
    showPanel('alarmSettingsPanel');
}

// ui.js içindeki renderSignalAnalysisPreview fonksiyonunu bununla değiştirin
function renderSignalAnalysisPreview(data) {
    const resultContainer = document.getElementById('signalAnalysisResultContainer');
    let html = '';

    const getPerformanceClass = (value) => parseFloat(value) > 0 ? 'positive' : 'negative';

    // Veri gelip gelmediğini en başta kontrol et
    if (!data || Object.keys(data).length === 0) {
        resultContainer.innerHTML = `<p>Analiz için sonuç bulunamadı.</p>`;
        return;
    }

    for (const coin in data) {
        const res = data[coin];

        html += `<div class="backtest-card" data-coin="${coin}" style="margin-bottom:15px; border-left: 3px solid var(--accent-blue);">
                    <h4>${coin.replace("USDT","")} Analiz Sonuçları</h4>`;
        
        // --- KESİN ÇÖZÜM: HATA KONTROLÜ ---
        // Önce gelen cevabın bir hata olup olmadığını kontrol ediyoruz.
        if (res.status === 'error' || res.status === 'info') {
            const messageColor = res.status === 'error' ? 'var(--accent-red)' : 'var(--text-secondary)';
            html += `<p style="color:${messageColor}; padding: 10px 0;">${res.message}</p>`;
        
        // Sadece cevap başarılı ise ('preview') bu bloğu çalıştır.
        } else if (res.status === 'preview' && res.params && res.dnaSummary) {
            const paramsString = JSON.stringify(res.params);
            
            // DNA özetini (ortalama değerleri) alarm kurma butonu için hazırlıyoruz
            const dnaForAlarm = {
                coin: res.params.coins[0],
                timeframe: res.params.timeframe,
                direction: res.params.direction,
                dna_analysis: { avgReturn1h: res.avgReturns['1h'] },
                dna: {}
            };
            res.dnaSummary.featureOrder.forEach((feature, index) => {
                const keyMap = { 'rsi': 'avgRsi', 'macd_hist': 'avgMacdHist', 'adx': 'avgAdx', 'volume_mult': 'avgVolumeMultiplier' };
                if (keyMap[feature]) {
                    dnaForAlarm.dna[keyMap[feature]] = res.dnaSummary.mean[index];
                }
            });
            const dnaForAlarmString = JSON.stringify(dnaForAlarm);

            html += `
                <p class="section-description" style="margin-bottom: 15px;">${res.message}</p>
                
                <h5 class="setting-subtitle" style="margin-top:0;">Ortalama Getiri Performansı</h5>
                <div class="backtest-results-grid" style="grid-template-columns: repeat(4, 1fr); gap: 10px;">
                    <div class="backtest-card" style="padding:10px;">
                        <p class="label">15 Dakika</p>
                        <p class="value ${getPerformanceClass(res.avgReturns['15m'])}">${res.avgReturns['15m']}%</p>
                    </div>
                    <div class="backtest-card" style="padding:10px;">
                        <p class="label">1 Saat</p>
                        <p class="value ${getPerformanceClass(res.avgReturns['1h'])}">${res.avgReturns['1h']}%</p>
                    </div>
                    <div class="backtest-card" style="padding:10px;">
                        <p class="label">4 Saat</p>
                        <p class="value ${getPerformanceClass(res.avgReturns['4h'])}">${res.avgReturns['4h']}%</p>
                    </div>
                    <div class="backtest-card" style="padding:10px;">
                        <p class="label">1 Gün</p>
                        <p class="value ${getPerformanceClass(res.avgReturns['1d'])}">${res.avgReturns['1d']}%</p>
                    </div>
                </div>

                <h5 class="setting-subtitle">Fırsat Anının DNA Özeti (Ortalama Değerler)</h5>
                <div class="backtest-results-grid" style="grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));">
                    ${res.dnaSummary.featureOrder.map((feature, index) => `
                        <p><span class="label">${feature}:</span> <span class="value">${parseFloat(res.dnaSummary.mean[index]).toFixed(2)}</span></p>
                    `).join('')}
                </div>

                <div class="preview-actions" style="margin-top: 20px; display:flex; gap:10px; flex-wrap:wrap;">
                    <button class="primary-button save-dna-btn" data-params='${paramsString}'>
                        <i class="fas fa-save"></i> DNA Profili Oluştur
                    </button>
                    <button class="action-btn-sm use-dna-in-alarm-btn" data-dna='${dnaForAlarmString}' style="background-color: var(--bg-tertiary);">
                        <i class="fas fa-bell"></i> Bu Stratejiden Alarm Kur
                    </button>
                </div>
            `;
        } else {
             html += `<p style="color:var(--accent-red); padding: 10px 0;">Sunucudan gelen veri anlaşılamadı veya eksik.</p>`;
        }
        // --- HATA KONTROLÜ BİTTİ ---

        html += `</div>`;
    }
    resultContainer.innerHTML = html;
}
async function renderAlarmReports() {
    if (!state.userDocRef) return;
    const tableBody = document.getElementById('alarmReportsTable');
    if (!tableBody) return;

    if (!state.trackedReports || state.trackedReports.length === 0) {
        tableBody.innerHTML = `<tr><td colspan="8" style="text-align:center;">Takip edilen rapor bulunmuyor. Rapor ID'sini girerek ekleyebilirsiniz.</td></tr>`;
        return;
    }

    try {
        const reportsSnapshot = await state.userDocRef.collection('alarm_reports')
            .where('reportId', 'in', state.trackedReports)
            .orderBy('timestamp', 'desc')
            .get();

        if (reportsSnapshot.empty) {
            tableBody.innerHTML = `<tr><td colspan="8" style="text-align:center;">Takip edilen rapor bulunmuyor.</td></tr>`;
            return;
        }

        const reports = reportsSnapshot.docs.map(doc => doc.data());
        const coinPairs = [...new Set(reports.map(r => r.coin))];
        const pricesData = await Promise.all(coinPairs.map(pair => axios.get(`https://api.binance.com/api/v3/ticker/price?symbol=${pair}`).then(res => res.data).catch(() => ({ symbol: pair, price: null }))));
        const priceMap = new Map(pricesData.map(p => [p.symbol, parseFloat(p.price)]));

        tableBody.innerHTML = '';
        reports.forEach(report => {
            const currentPrice = priceMap.get(report.coin);
            let performancePct = 'N/A';
            let perfClass = '';
            if (currentPrice) {
                const change = ((currentPrice - report.signalPrice) / report.signalPrice) * 100;
                performancePct = (report.signalDirection === 'SATIŞ' ? -change : change);
                perfClass = performancePct > 0 ? 'positive' : 'negative';
            }

            const row = document.createElement('tr');
            row.innerHTML = `
                <td>${report.coin.replace('USDT', '')}</td>
                <td>${report.signalDirection}</td>
                <td>$${formatPrice(report.signalPrice)}</td>
                <td>$${currentPrice ? formatPrice(currentPrice) : 'N/A'}</td>
                <td class="performance-cell ${perfClass}">${typeof performancePct === 'number' ? performancePct.toFixed(2) + '%' : 'N/A'}</td>
                <td>${report.timestamp.toDate().toLocaleString()}</td>
                <td>${report.alarmName}</td>
                <td><button class="action-btn remove-report-btn" data-report-id="${report.reportId}"><i class="fas fa-times"></i></button></td>
            `;
            tableBody.appendChild(row);
        });
    } catch (error) {
        console.error("Error fetching alarm reports:", error);
        tableBody.innerHTML = `<tr><td colspan="8" style="text-align:center; color: var(--accent-red);">Raporlar yüklenirken bir hata oluştu.</td></tr>`;
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

function renderDnaProfiles(profiles) {
    const container = document.getElementById('dnaProfilesContainer');
    if (!container) return;

    if (!profiles || profiles.length === 0) {
        container.innerHTML = `<p style="text-align: center; color: var(--text-secondary);">Henüz kaydedilmiş bir DNA profili bulunmuyor.</p>`;
        return;
    }

    let html = '<div class="table-wrapper"><table><thead><tr>' +
        '<th>Profil Adı</th><th>Parametreler</th><th>Olay Sayısı</th><th>Sil</th>' +
        '</tr></thead><tbody>';

    profiles.forEach(profile => {
        const nameParts = profile.id.split('_');
        const profileName = `${nameParts[0]} / ${nameParts[1]} / ${nameParts[2] === 'up' ? 'Artış' : 'Azalış'} %${nameParts[3].replace('pct','')}`;

        html += `<tr>
                    <td><strong>${profileName}</strong></td>
                    <td><small>${profile.featureOrder.join(', ')}</small></td>
                    <td>${profile.eventCount}</td>
                    <td>
                        <button class="action-btn delete-dna-btn" data-profile-id="${profile.id}" title="Profili Sil">
                            <i class="fas fa-trash"></i>
                        </button>
                    </td>
                 </tr>`;
    });

    html += '</tbody></table></div>';
    container.innerHTML = html;
}
