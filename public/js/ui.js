// ---- GLOBAL ÇATI (her JS dosyasının en üstüne koy) ----
window.App = window.App || {
  version: 'v3.0.1-' + (window.App?.versionTag || ''),
  loaded: {},
  guards: {},
  log: (...args) => console.log('[App]', ...args),
};

// ---- UI HELPERS (tekil) ----
(() => {
  if (window.App.guards.uiHelpers) return;
  window.App.guards.uiHelpers = true;

 App.trTimeFmt   = {
  year:'2-digit', month:'2-digit', day:'2-digit',
  hour:'2-digit', minute:'2-digit',
  hour12: false,
  timeZone: 'Europe/Istanbul'
};
  App.formatPct   = v => (typeof v === 'number' ? `${v.toFixed(2)}%` : 'N/A');
  App.formatPrice = v => (typeof v === 'number' ? (v >= 1 ? v.toFixed(2) : v.toPrecision(6)) : 'N/A');
  App.paramNice   = k => ({rsi:'RSI', macd:'MACD', adx:'ADX', volume:'Hacim', volatility:'Volatilite', candle:'Mum Şekli', speed:'Hız'}[k] || k);
  App.clsPerf     = v => (typeof v === 'number' ? (v >= 0 ? 'positive' : 'negative') : '');
})();


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
        if (page) page.style.display = 'block';
    }
}

function showPanel(id) {
  const el = document.getElementById(id);
  if (!el) return;
  el.classList.add('show');
  const overlay = document.getElementById('modalOverlay');
  if (overlay) overlay.classList.add('show');
}

function hidePanel(id) {
  const el = document.getElementById(id);
  if (!el) return;
  el.classList.remove('show');
}

function closeAllPanels() {
  document.querySelectorAll('.panel.show').forEach(p => p.classList.remove('show'));
  const overlay = document.getElementById('modalOverlay');
  if (overlay) overlay.classList.remove('show');
}

function togglePanel(id) {
    const el = document.getElementById(id);
    if (!el) return;
    
    if (el.classList.contains('show')) {
        closeAllPanels();
    } else {
        closeAllPanels();
        showPanel(id);
    }
}

async function loadAlarmReports() {
  const tbody = document.getElementById('alarmReportsTbody');
  if (!tbody) return;
  try {
    if (!state.firebase?.firestore || !state.user?.uid) {
      renderAlarmReports([]);
      return;
    }
    const db = state.firebase.firestore;
    const eventsSnap = await db.collection('signal_events').where('userId', '==', state.user.uid).orderBy('createdAt', 'desc').limit(500).get();
    const signalsSnap = await db.collection('signals').where('userId', '==', state.user.uid).orderBy('createdAt', 'desc').limit(200).get();
    const rows = [];
    eventsSnap.forEach(doc => { const d = doc.data() || {}; rows.push({ coin: d.coin || d.pair || '-', dir: d.direction || '-', entry: d.entryPrice || d.signalPrice || d.priceAtSignal || '-', now: d.currentPrice || d.lastPrice || d.priceLatest || '-', score: d.score ?? '-', exp15m: d.expected_15m ?? d.expected15m ?? '-', got15m: d.realized_15m ?? d.realized15m ?? '-', exp1h:  d.expected_1h ?? '-', got1h:  d.realized_1h ?? '-', exp4h:  d.expected_4h ?? '-', got4h:  d.realized_4h ?? '-', exp1d:  d.expected_1d ?? '-', got1d:  d.realized_1d ?? '-', signalText: d.text || d.signal || '' }); });
    signalsSnap.forEach(doc => { const d = doc.data() || {}; rows.push({ coin: d.coin || d.pair || '-', dir: d.direction || '-', entry: d.entryPrice || d.signalPrice || d.priceAtSignal || '-', now: d.currentPrice || d.lastPrice || d.priceLatest || '-', score: d.score ?? '-', exp15m: d.expected_15m ?? d.expected15m ?? '-', got15m: d.realized_15m ?? d.realized15m ?? '-', exp1h:  d.expected_1h ?? '-', got1h:  d.realized_1h ?? '-', exp4h:  d.expected_4h ?? '-', got4h:  d.realized_4h ?? '-', exp1d:  d.expected_1d ?? '-', got1d:  d.realized_1d ?? '-', signalText: d.text || d.signal || '' }); });
    renderAlarmReports(rows);
  } catch (err) {
    console.error('[Signals] Yükleme hatası:', err);
    renderAlarmReports([]);
  }
}

function renderAlarmReports(rows) {
  const tbody = document.getElementById('alarmReportsTbody');
  if (!tbody) return;
  tbody.innerHTML = (rows || []).map(r => `<tr><td>${r.coin}</td><td>${r.dir}</td><td>${typeof r.entry==='number'? r.entry.toFixed(4):r.entry}</td><td>${typeof r.now==='number'? r.now.toFixed(4):r.now}</td><td>${r.score}</td><td>${fmtPct(r.exp15m)}</td><td>${fmtPct(r.got15m)}</td><td>${fmtPct(r.exp1h)}</td><td>${fmtPct(r.got1h)}</td><td>${fmtPct(r.exp4h)}</td><td>${fmtPct(r.got4h)}</td><td>${fmtPct(r.exp1d)}</td><td>${fmtPct(r.got1d)}</td><td>${r.signalText}</td></tr>`).join('') || `<tr><td colspan="13">Kayıt bulunamadı.</td></tr>`;
}

function fmtPct(v){ return (typeof v==='number') ? `${v.toFixed(2)}%` : (v??''); }

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
            const res = await fetch(`https://api.binance.com/api/v3/klines?symbol=${symbol}&interval=${interval}&limit=${limit}`);
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

    // --- EKLENECEK KOD BURASI ---
    // İndikatör periyodu seçim kutusunun değerini state'deki değere eşitliyoruz.
    const indicatorTimeframeSelect = document.getElementById('indicatorTimeframeSelect');
    if (indicatorTimeframeSelect) {
        indicatorTimeframeSelect.value = state.settings.indicatorTimeframe || '1d';
    }

    const autoRefreshToggle = document.getElementById('autoRefreshToggle');
    if (autoRefreshToggle) autoRefreshToggle.checked = state.settings.autoRefresh;
    const refreshInterval = document.getElementById('refreshInterval');
    if (refreshInterval) {
        refreshInterval.value = state.settings.refreshInterval;
        refreshInterval.min = { admin: 10, qualified: 120, new_user: 300 }[state.currentUserRole] || 300;
    }
    const telegramChatIdInput = document.getElementById('telegramChatIdInput');
    if (telegramChatIdInput) telegramChatIdInput.value = state.settings.telegramChatId || '';

    const visibleColumns = state.settings.visibleColumns || {};
    document.querySelectorAll('#columnVisibilityCheckboxes input[type="checkbox"]').forEach(cb => {
        const col = cb.dataset.col;
        cb.checked = visibleColumns[col] !== false;
    });

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
            
            const colVisLabel = document.getElementById(`col${i}_vis_label`);
            if (colVisLabel) colVisLabel.textContent = state.settings.columns[i].name;
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
    
    applyColumnVisibility();
    translatePage(state.settings.lang);

    if (typeof toggleAutoRefresh === 'function') {
        toggleAutoRefresh();
    }
    if (typeof toggleReportsAutoRefresh === 'function') {
        toggleReportsAutoRefresh(false);
    }
}

function applyColumnVisibility() {
    const table = document.querySelector('.table-wrapper table');
    if (!table || !state.settings.visibleColumns) return;

    for (const col in state.settings.visibleColumns) {
        if (state.settings.visibleColumns[col]) {
            table.classList.remove(`hide-col-${col}`);
        } else {
            table.classList.add(`hide-col-${col}`);
        }
    }
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
                ${(coinList || []).map(pair => `<div class="coin-tag" data-pair="${pair}"><span>${pair.replace("USDT", "")}</span><button class="remove-coin-tag" data-list-name="${listName}" data-pair="${pair}">&times;</button></div>`).join('')}
            </div>
        </div>`;
}

function updateCoinList(listName, newCoinList) {
    const grid = document.querySelector(`.coin-selection-grid[data-list-name="${listName}"]`);
    if (!grid) return;
    grid.innerHTML = (newCoinList || []).map(pair => `<div class="coin-tag" data-pair="${pair}"><span>${pair.replace("USDT", "")}</span><button class="remove-coin-tag" data-list-name="${listName}" data-pair="${pair}">&times;</button></div>`).join('');
}

function renderAllPortfolioTabs() {
    renderPortfolioTabs('portfolioTabs');
}

function renderPortfolioTabs(containerId) {
    const tabsContainer = document.getElementById(containerId);
    if (!tabsContainer) return;
    tabsContainer.innerHTML = '';
    for (const name in state.userPortfolios) {
        const tab = document.createElement('div');
        tab.className = 'portfolio-tab';
        tab.textContent = name;
        tab.dataset.name = name; 
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
        let classes = '', style = '';
        if (typeof pct !== 'number') return { classes: '', style: '' };
        if (pct < 0) {
            classes = 'negative';
        } else if (pct >= threshold) {
            classes = 'positive-high';
            style = `style="color: ${state.settings.colors.high};"`;
        } else {
            classes = 'positive-low';
            style = `style="color: ${state.settings.colors.low};"`;
        }
        return { classes, style };
    };

    data.forEach(result => {
        const row = document.createElement("tr");
        row.dataset.pair = result.pair;
        let rowHTML;
        if (result.error) {
            rowHTML = `<td class="drag-handle-col ${isSorting ? '' : 'hidden'}"><i class="fas fa-grip-lines drag-handle"></i></td><td class="asset-cell col-pair">${result.pair.replace("USDT", "")}</td><td colspan="7" style="text-align:center; color: var(--accent-red);">Veri alınamadı</td>`;
        } else {
            const cellStyle1 = getCellStyle(result.col1, state.settings.columns[1].threshold);
            const cellStyle2 = getCellStyle(result.col2, state.settings.columns[2].threshold);
            const cellStyle3 = getCellStyle(result.col3, state.settings.columns[3].threshold);
            
            let rsiCell = '<td class="col-rsi">N/A</td>';
            if (typeof result.rsi === 'number') {
                const rsiVal = result.rsi.toFixed(2);
                let rsiClass = '';
                if (rsiVal >= 70) rsiClass = 'rsi-overbought';
                if (rsiVal <= 30) rsiClass = 'rsi-oversold';
                rsiCell = `<td class="col-rsi ${rsiClass}">${rsiVal}</td>`;
            }

            let macdCell = '<td class="col-macd">N/A</td>';
            if (result.macd && typeof result.macd.histogram === 'number') {
                const hist = result.macd.histogram.toFixed(4);
                const macdClass = hist >= 0 ? 'macd-positive' : 'macd-negative';
                const barWidth = Math.min(100, Math.abs(hist) * 200);
                const barColor = hist >= 0 ? 'var(--accent-green)' : 'var(--accent-red)';
                macdCell = `
                    <td class="col-macd ${macdClass}">
                        <span>${hist}</span>
                        <div class="indicator-bar-container" title="${hist}">
                            <div class="indicator-bar" style="width: ${barWidth}%; background-color: ${barColor};"></div>
                        </div>
                    </td>`;
            }
            
            rowHTML = `
                <td class="drag-handle-col ${isSorting ? '' : 'hidden'}"><i class="fas fa-grip-lines drag-handle"></i></td>
                <td class="asset-cell col-pair" data-pair="${result.pair}">${result.pair.replace("USDT", "")}</td>
                <td class="col-latestPrice">${formatPrice(result.latestPrice)}</td>
                <td class="col-col1 ${cellStyle1.classes} clickable-pct" ${cellStyle1.style} data-col="1" data-pair="${result.pair}">${formatPct(result.col1.pct)}</td>
                <td class="col-col2 ${cellStyle2.classes} clickable-pct" ${cellStyle2.style} data-col="2" data-pair="${result.pair}">${formatPct(result.col2.pct)}</td>
                <td class="col-col3 ${cellStyle3.classes} clickable-pct" ${cellStyle3.style} data-col="3" data-pair="${result.pair}">${formatPct(result.col3.pct)}</td>
                ${rsiCell}
                ${macdCell}
            `;
        }
        rowHTML += `<td class="col-delete"><button class="action-btn remove-btn" data-list-name="crypto" data-pair="${result.pair}"><i class="fas fa-times"></i></button></td>`;
        row.innerHTML = rowHTML;
        tableBody.appendChild(row);
    });
}

function showChart(pair) {
    const chartPanelTitle = document.getElementById('chartPanelTitle');
    const container = document.getElementById('chartContainer');
    const saveBtn = document.getElementById('saveChartStateBtn');

    if (!chartPanelTitle || !container || !saveBtn) {
        console.error('Grafik paneli veya kaydet butonu gibi elementler bulunamadı!');
        return;
    }

    chartPanelTitle.textContent = pair.replace("USDT", "");
    container.innerHTML = '<div class="loading" style="margin: auto;"></div>';
    saveBtn.disabled = true;
    showPanel('chartPanel');
    
    const savedChartState = state.settings?.chartState?.[pair];

    // Widget'ı oluşturan fonksiyonu tanımla
    const createWidget = (chartData) => {
        try {
            new TradingView.widget({
                symbol: `BINANCE:${pair}`,
                interval: "1D",
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
                disabled_features: ["use_localstorage_for_settings"],
                loading_screen: { backgroundColor: "#1e222d" },
                // --- DEĞİŞİKLİK BURADA: Fonksiyona gelen veriyi kullan ---
                saved_data: chartData,
                overrides: { "mainSeriesProperties.showPriceLine": true, "mainSeriesProperties.priceLineWidth": 2 },
                studies_overrides: { "volume.volume.color.0": "#ff6b6b", "volume.volume.color.1": "#4ecdc4", "volume.volume.transparency": 70 },

                onChartReady: function() {
                    state.tradingViewWidget = this.activeChart();
                    console.log('TradingView chart nesnesi hazır ve state\'e atandı.');
                    saveBtn.disabled = false;

                    if (state.tradingViewWidget && typeof state.tradingViewWidget.subscribe === 'function') {
                        state.tradingViewWidget.subscribe('onAutoSaveNeeded', () => {
                            if (typeof saveChartState === "function") saveChartState(pair);
                        });
                    }
                }
            });
        } catch (error) {
            console.error("TradingView widget hatası:", error);
            container.innerHTML = `<p style="color:var(--accent-red); text-align:center; padding:20px;">Grafik yüklenemedi: ${error.message}</p>`;
            saveBtn.disabled = true;
        }
    };

    // --- YENİ MANTIK BURADA ---
    // Önce kayıtlı (bozuk olabilecek) veriyle yüklemeyi dene
    try {
        console.log("Kayıtlı veriyle grafik yükleniyor...");
        createWidget(savedChartState || null);
    } catch (e) {
        // Eğer kayıtlı veriyle yükleme başarısız olursa,
        // bu hatayı yakala ve grafiği temiz bir şekilde yeniden başlat.
        console.warn("Kayıtlı veriyle yükleme başarısız oldu. Grafik temiz olarak başlatılıyor.", e);
        createWidget(null); // Temiz (boş) veriyle tekrar oluştur
    }
}

function showPriceDetailPopup(pair, colKey) {
    const coinData = state.allCryptoData.find(c => c.pair === pair);
    // DEĞİŞİKLİK: colKey'in başına 'col' ekleyerek doğru veriyi buluyoruz (örn: "col1")
    const dataKey = `col${colKey}`;
    if (!coinData || !coinData[dataKey]) return;
    const detailData = coinData[dataKey];
    const colName = state.settings.columns[colKey].name;
    const content = `<div class="status-table"><table><tbody>
        <tr><td>Coin</td><td>${pair.replace("USDT", "")}</td></tr>
        <tr><td>Periyot Adı</td><td>${colName}</td></tr>
        <tr><td>Mevcut Fiyat</td><td>$${formatPrice(coinData.latestPrice)}</td></tr>
        <tr><td>Hesaplanan En Düşük Fiyat</td><td>$${formatPrice(detailData.lowestPrice)}</td></tr>
        <tr><td>En Düşük Fiyat Tarihi</td><td>${detailData.lowestDate}</td></tr>
        <tr><td style="font-weight: bold;">Fark (Yüzde)</td><td style="font-weight: bold; color: var(--accent-green);">${detailData.pct.toFixed(2)}%</td></tr>
    </tbody></table></div>`;
    document.getElementById('detailPanelTitle').textContent = `${pair.replace("USDT", "")} - Fiyat Analizi`;
    document.getElementById('detailPanelContent').innerHTML = content;
    showPanel('detailPanel');
}

function renderDnaBacktestResults(data, profileId) {
    const section = document.getElementById('backtest-results-section');
    const summaryContainer = document.getElementById('backtestSummaryContainer');
    const tableBody = document.querySelector('#dnaBacktestResultTable tbody');
    if (!section || !tableBody || !summaryContainer) { return; }
    document.getElementById('backtestProfileName').textContent = `Profil: ${profileId}`;
    section.style.display = 'block';
    const { trades, summary, debugMode } = data;
    const periods = ['15m', '1h', '4h', '1d'];
    summaryContainer.innerHTML = periods.map((period) => {
        const stats = summary[period] || { avgMFE: 0, tradeCount: 0, hitTPRate: 0 };
        return `<div class="kpi-item"><span class="kpi-label">${period} Sonrası Performans</span><span class="kpi-value ${stats.avgMFE > 0 ? 'positive' : 'negative'}">${stats.avgMFE.toFixed(2)}%</span><span class="kpi-label">Ort. MFE (${stats.tradeCount} işlem)</span><span class="kpi-label" style="margin-top: 5px;">TP Oranı: <strong>${stats.hitTPRate.toFixed(2)}%</strong></span></div>`;
    }).join('') + (summary.diagnose?.distance ? `<div class="kpi-note muted" style="margin-top:8px"><small>Skor mesafesi (küçük daha iyidir): min=${summary.diagnose.distance.min.toFixed(2)} / ort=${summary.diagnose.distance.avg.toFixed(2)} / max=${summary.diagnose.distance.max.toFixed(2)}.</small></div>` : '');
    if (!trades || trades.length === 0) {
        tableBody.innerHTML = `<tr><td colspan="7" style="text-align:center;">${debugMode ? `Seçilen periyotta bu DNA profiline uyan hiçbir mum bulunamadı.` : `Seçilen periyotta, sinyal eşiği üzerinde bir sinyal bulunamadı.`}</td></tr>`;
        return;
    }
    document.querySelector('#dnaBacktestResultTable thead tr').innerHTML = `<th>Sinyal Tarihi</th><th>Giriş Fiyatı</th><th>Skor</th><th>15dk (MFE %)</th><th>1saat (MFE %)</th><th>4saat (MFE %)</th><th>1gün (MFE %)</th>`;
    tableBody.innerHTML = trades.map(trade => {
        const renderPerfCell = (perf) => {
            if (perf == null) return `<td>—</td>`;
            let val, hit = false;
            if (typeof perf === 'number') { val = perf; }
            else if (typeof perf === 'object') {
                if (Number.isFinite(perf.mfePct)) val = perf.mfePct;
                else if (Number.isFinite(perf.mfePctRaw)) val = perf.mfePctRaw;
                else if (Number.isFinite(perf.value)) val = perf.value;
                hit = !!perf.hitTP;
            }
            if (!Number.isFinite(val)) return `<td>—</td>`;
            const perfClass = val > 0.1 ? 'positive' : (val < -0.1 ? 'negative' : '');
            const hitTPIcon = hit ? ' <i class="fas fa-check-circle" style="color: var(--accent-green);"></i>' : '';
            return `<td class="performance-cell ${perfClass}">${val.toFixed(2)}%${hitTPIcon}</td>`;
        };
        return `<tr class="${(debugMode && !trade.isSignal) ? 'debug-row' : ''}"><td>${new Date(trade.entryTime).toLocaleString('tr-TR', App.trTimeFmt)}</td><td>$${formatPrice(trade.entryPrice)}</td><td>${trade.score.toFixed(2)}${Number.isFinite(trade.distance) ? ` <span class="muted">(${trade.distance.toFixed(2)})</span>` : ''}</td>${renderPerfCell(trade.performance['15m'])}${renderPerfCell(trade.performance['1h'])}${renderPerfCell(trade.performance['4h'])}${renderPerfCell(trade.performance['1d'])}</tr>`;
    }).join('');
    section.scrollIntoView({ behavior: 'smooth' });
}

function renderSignalAnalysisPreview(data) {
  const resultContainer = document.getElementById('signalAnalysisResultContainer');
  if (!resultContainer) return;
  resultContainer.innerHTML = '';
  if (!data || Object.keys(data).length === 0) {
    resultContainer.innerHTML = `<div class="placeholder-text">Analiz için sonuç bulunamadı.</div>`;
    return;
  }
  const round2 = (n) => (typeof n === 'number' && isFinite(n)) ? n.toFixed(2) : 'N/A';
  const html = Object.keys(data).map((coin) => {
    const res = data[coin];
    const coinSymbol = coin.replace('USDT','');
    if (!res || res.status === 'error' || res.status === 'info') {
      const msg = (res && res.message) ? res.message : 'Sonuç yok.';
      const color = (res && res.status === 'error') ? 'var(--accent-red)' : 'var(--text-secondary)';
      return `<div class="analysis-card"><div class="analysis-card-header"><h4>${coinSymbol}</h4></div><div style="color:${color};padding:20px;">${msg}</div></div>`;
    }
    const avg1h =  round2((res.avgReturnsSignal || res.avgReturns)?.['1h']);
    const avg4h =  round2((res.avgReturnsSignal || res.avgReturns)?.['4h']);
    const avg1d =  round2((res.avgReturnsSignal || res.avgReturns)?.['1d']);
    const paramsHtml = res.dnaProfile?.featureOrder?.map(f => f.split('_')[0].toUpperCase())?.filter((v, i, a) => a.indexOf(v) === i)?.map(p => `<span class="pill">${p}</span>`).join('') || '<span class="muted">Parametre seçilmedi</span>';
    let eventsHtml = '<tbody><tr><td colspan="6" class="muted" style="text-align:center; padding: 20px;">Fırsat bulunamadı</td></tr></tbody>';
    let footerHtml = '';
    if (Array.isArray(res.eventDetails) && res.eventDetails.length) {
      const all = res.eventDetails.slice().sort((a,b) => Number(b.timestamp) - Number(a.timestamp));
      const row = (ev, index) => {
        const isHidden = index >= 5 ? 'hidden' : '';
        const signalTime = ev.timestamp ? new Date(ev.timestamp).toLocaleString('tr-TR', App.trTimeFmt) : '—';
        const pB = Number.isFinite(ev.priceBefore) ? `$${formatPrice(ev.priceBefore)}` : 'N/A';
        const pA = Number.isFinite(ev.priceAfter)  ? `$${formatPrice(ev.priceAfter)}`  : 'N/A';
        const val1h = (ev.perf?.['1h']?.mfePct ?? ev.perf?.['1h']);
        const p1h = Number.isFinite(val1h) ? `${val1h.toFixed(2)}%` : '—';
        return `<tr class="opportunity-row ${isHidden}" data-coin="${coinSymbol}"><td><div>${signalTime}</div><div class="muted">Sinyal Fiyatı: ${pB}</div></td><td><div class="muted">Hedef Fiyat: ${pA}</div></td><td class="${App.clsPerf(val1h)}">${p1h}</td></tr>`;
      };
      eventsHtml = `<tbody>${all.map(row).join('')}</tbody>`;
      if (all.length > 5) {
        footerHtml = `<tfoot><tr><td colspan="6" style="text-align:center;"><button class="show-all-opportunities-btn" data-coin="${coinSymbol}">Tüm Fırsatları Göster (${all.length})</button></td></tr></tfoot>`;
      }
    }
    let dnaHtml = '<div class="muted">DNA özeti oluşturulamadı.</div>';
    if (res.dnaSummary && res.dnaSummary.featureOrder) {
      dnaHtml = res.dnaSummary.featureOrder.map((key, i) => `<div class="dna-indicator-group"><span class="label">${key}</span><span class="value">${round2(res.dnaSummary.mean[i])}</span></div>`).join('');
    }
    return `<div class="analysis-card"><div class="analysis-card-header"><h4>${coinSymbol}</h4></div><div class="kpi-container" style="padding: 0 20px 20px 20px;"><div class="kpi-item"><span class="kpi-label">Sinyal Sayısı</span><span class="kpi-value">${res.eventCount || 0}</span></div><div class="kpi-item"><span class="kpi-label">1S Ort. Getiri</span><span class="kpi-value ${avg1h >= 0 ? 'positive' : 'negative'}">${avg1h}%</span></div><div class="kpi-item"><span class="kpi-label">4S Ort. Getiri</span><span class="kpi-value ${avg4h >= 0 ? 'positive' : 'negative'}">${avg4h}%</span></div><div class="kpi-item"><span class="kpi-label">1G Ort. Getiri</span><span class="kpi-value ${avg1d >= 0 ? 'positive' : 'negative'}">${avg1d}%</span></div></div><div class="analysis-card-body"><section><h5 class="setting-subtitle">Bulunan Fırsat Detayları</h5><div class="table-wrapper compact"><table><thead><tr><th>Zaman/Fiyat</th><th>Hedef/Fiyat</th><th>1S %</th></tr></thead>${eventsHtml}${footerHtml}</table></div></section><details class="dna-details-container"><summary>DNA Parametreleri ve Özetini Göster/Gizle</summary><div class="details-content-wrapper"><section><h5 class="setting-subtitle">DNA Parametreleri</h5><div class="pill-row">${paramsHtml}</div></section><section><h5 class="setting-subtitle">DNA Özeti</h5><div class="dna-summary-grid">${dnaHtml}</div></section></div></details></div><div class="analysis-card-footer"><button class="save-dna-btn" data-profile='${JSON.stringify(res.dnaProfile || {})}'> <i class="fas fa-save"></i> Bu DNA Profilini Kaydet </button></div></div>`;
  }).join('');
  resultContainer.innerHTML = html;
}

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
        const activeParams = profile.featureOrder.map(f => f.split('_')[0].toUpperCase()).filter((value, index, self) => self.indexOf(value) === index).join(', ');
        card.innerHTML = `<div class="dna-card-header"><div class="dna-card-title"><h5>${profile.name}</h5><span>${profile.coin} / ${profile.timeframe}</span></div><div class="dna-card-actions"><button class="action-btn run-dna-backtest-btn" data-profile-id="${profile.name}" title="Bu Profili Test Et"><i class="fas fa-history"></i></button><button class="action-btn delete-dna-btn" data-profile-id="${profile.name}" data-container-id="${containerId}" title="Profili Sil"><i class="fas fa-trash"></i></button></div></div><div class="dna-card-body"><div class="dna-card-summary"><div class="summary-item"><strong>Yön:</strong> ${directionText}</div><div class="summary-item"><strong>Hedef Değişim:</strong> %${profile.changePercent}</div><div class="summary-item"><strong>Olay Sayısı:</strong> ${profile.count ?? '—'}</div><div class="summary-item"><strong>Parametreler:</strong> <small>${activeParams}</small></div></div><div class="dna-card-details-toggle"><a href="#" class="toggle-details-link">Detayları Göster/Gizle</a></div><div class="dna-card-details-content"><h6>DNA Özeti (Ortalama Değerler)</h6><div class="details-grid">${profile.featureOrder.map((feature, index) => `<div class="detail-item"><span class="label">${feature}</span><span class="value">${parseFloat(profile.mean[index]).toFixed(4)}</span></div>`).join('')}</div></div></div>`;
        gridContainer.appendChild(card);
    });
    container.innerHTML = '';
    container.appendChild(gridContainer);
}

if (!App.confirm) {
  App.confirm = ({ title = 'Onay', message = '', confirmText = 'Tamam', cancelText = 'İptal', confirmStyle = 'primary'}) => new Promise((resolve) => {
    let overlay = document.getElementById('modalOverlay');
    if (!overlay) {
      overlay = document.createElement('div');
      overlay.id = 'modalOverlay';
      overlay.className = 'modal-overlay';
      document.body.appendChild(overlay);
    }
    const panel = document.createElement('div');
    panel.className = 'panel';
    panel.innerHTML = `<div class="panel-header"><h3>${title}</h3><div class="panel-controls"><button class="panel-btn close-btn" aria-label="Kapat">✕</button></div></div><div class="panel-content" style="padding:16px;"><p style="margin:0 0 12px 0; color: var(--text-secondary); white-space:pre-wrap;">${message}</p><div class="confirm-footer"><button class="confirm-btn cancel">${cancelText}</button><button class="confirm-btn primary ${confirmStyle === 'danger' ? 'danger' : ''}">${confirmText}</button></div></div>`;
    document.body.appendChild(panel);
    overlay.classList.add('show');
    panel.classList.add('show');
    document.body.classList.add('modal-open');
    const cleanup = (val) => {
      panel.classList.remove('show');
      overlay.classList.remove('show');
      document.body.classList.remove('modal-open');
      setTimeout(() => panel.remove(), 200);
      resolve(val);
    };
    panel.querySelector('.cancel')?.addEventListener('click', () => cleanup(false));
    panel.querySelector('.close-btn')?.addEventListener('click', () => cleanup(false));
    panel.querySelector('.primary')?.addEventListener('click', () => cleanup(true));
    overlay.addEventListener('click', (e) => { if (e.target === overlay) cleanup(false); });
  });
}

function renderFearAndGreedWidget(data) {
    const widget = document.getElementById('fearGreedWidget');
    if (!widget) return;
    if (!data) {
        widget.innerHTML = `<span class="fg-text">Piyasa Duyarlılığı Yüklenemedi</span>`;
        return;
    }
    const value = parseInt(data.value);
    const classification = data.value_classification.replace(" ", "-").toLowerCase();
    widget.innerHTML = `<span class="fg-text">Piyasa Duyarlılığı:</span><span class="fg-value fg-${classification}">${value}</span><span class="fg-text fg-${classification}">${data.value_classification}</span>`;
}
