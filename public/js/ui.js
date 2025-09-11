// ---- GLOBAL ÇATI (her JS dosyasının en üstüne koy) ----
window.App = window.App || {
  // sürüm bilgisi bu tur için (elle güncelle)
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
  timeZone: 'Europe/Istanbul'       // ✅ sabit İstanbul TZ
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
        if (page) page.style.display = 'flex';
    }
}

function showPanel(id) {
  const el = document.getElementById(id);
  if (!el) return;
  el.classList.add('show');
}

function hidePanel(id) {
  const el = document.getElementById(id);
  if (!el) return;
  el.classList.remove('show');
}

function closeAllPanels() {
  document.querySelectorAll('.panel.show').forEach(p => p.classList.remove('show'));
}


// --- Sinyal performansı: veriyi çek ve çiz ---
async function loadAlarmReports() {
  const tbody = document.getElementById('alarmReportsTbody');
  if (!tbody) return;

  try {
    if (!state.firebase?.firestore) {
      console.warn('[Signals] Firestore hazır değil (state.firebase.firestore yok).');
      renderAlarmReports([]);
      return;
    }
    const db = state.firebase.firestore;

    const snap = await db
      .collection('signals')
      .orderBy('createdAt','desc')
      .limit(200)
      .get();

    if (snap.empty) {
      console.info('[Signals] Koleksiyon boş veya erişilemedi: signals');
      renderAlarmReports([]);
      return;
    }

    const rows = [];
    snap.forEach(doc => {
      const d = doc.data() || {};
      rows.push({
        coin: d.coin || d.pair || '-',
        dir: d.direction || '-',
        entry: d.entryPrice || d.signalPrice || '-',
        now: d.currentPrice || '-',
        score: d.score ?? '-',
        exp15m: d.expected_15m ?? d.expected15m ?? '-',
        got15m: d.realized_15m ?? d.realized15m ?? '-',
        exp1h:  d.expected_1h ?? '-',
        got1h:  d.realized_1h ?? '-',
        exp4h:  d.expected_4h ?? '-',
        got4h:  d.realized_4h ?? '-',
        exp1d:  d.expected_1d ?? '-',
        got1d:  d.realized_1d ?? '-',
        signalText: d.text || d.signal || ''
      });
    });

    renderAlarmReports(rows);
  } catch (err) {
    console.error('[Signals] Yükleme hatası:', err);
    renderAlarmReports([]);
  }
}


function renderAlarmReports(rows) {
  const tbody = document.getElementById('alarmReportsTbody');
  if (!tbody) return;
  tbody.innerHTML = (rows || []).map(r => `
    <tr>
      <td>${r.coin}</td>
      <td>${r.dir}</td>
      <td>${typeof r.entry==='number'? r.entry.toFixed(4):r.entry}</td>
      <td>${typeof r.now==='number'? r.now.toFixed(4):r.now}</td>
      <td>${r.score}</td>
      <td>${fmtPct(r.exp15m)}</td><td>${fmtPct(r.got15m)}</td>
      <td>${fmtPct(r.exp1h)}</td><td>${fmtPct(r.got1h)}</td>
      <td>${fmtPct(r.exp4h)}</td><td>${fmtPct(r.got4h)}</td>
      <td>${fmtPct(r.exp1d)}</td><td>${fmtPct(r.got1d)}</td>
      <td>${r.signalText}</td>
    </tr>
  `).join('') || `<tr><td colspan="13">Kayıt bulunamadı.</td></tr>`;
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
    const telegramChatIdInput = document.getElementById('telegramChatIdInput');
    if (telegramChatIdInput) telegramChatIdInput.value = state.settings.telegramChatId || '';
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
    const chartPanelTitle = document.getElementById('chartPanelTitle');
    const container = document.getElementById('chartContainer');
    
    if (!chartPanelTitle || !container) {
        console.error('Chart elements not found!');
        return;
    }

    chartPanelTitle.textContent = pair.replace("USDT", "");
    container.innerHTML = '<div class="loading" style="margin: auto;"></div>';
    showPanel('chartPanel');
    
    const savedStudies = state.settings?.chartIndicators?.[pair] || [];
    
    try {
        // TradingView widget'ı oluştur
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
            saved_data: state.settings?.chartDrawings?.[pair] || {}, // Çizimleri de kaydet
            loading_screen: { backgroundColor: "#1e222d" },
            overrides: {
                "mainSeriesProperties.showPriceLine": true,
                "mainSeriesProperties.priceLineWidth": 2
            },
            studies_overrides: {
                "volume.volume.color.0": "#ff6b6b",
                "volume.volume.color.1": "#4ecdc4",
                "volume.volume.transparency": 70,
                "volume.volume ma.color": "#ffa726",
                "volume.volume ma.transparency": 30,
                "volume.volume ma.linewidth": 5
            }
        });

        // Widget hazır olduğunda çizimleri yükle
        state.tradingViewWidget.onChartReady(function() {
            console.log('TradingView chart ready for:', pair);
            
            // Kayıtlı çizimleri yükle
            if (state.settings?.chartDrawings?.[pair]) {
                state.tradingViewWidget.loadDrawings(state.settings.chartDrawings[pair]);
            }
            
            // Çizim değişikliklerini dinle ve kaydet
            state.tradingViewWidget.subscribe('onAutoSaveNeeded', function() {
                saveChartState(pair);
            });
        });

    } catch (error) {
        console.error("TradingView widget hatası:", error);
        container.innerHTML = `<p style="color:var(--accent-red); text-align:center; padding:20px;">Grafik yüklenemedi: ${error.message}</p>`;
    }
}

// Chart state kaydetme fonksiyonunu güncelle
function saveChartState(pair) {
    if (state.tradingViewWidget && typeof state.tradingViewWidget.getStudiesList === 'function') {
        const studiesList = state.tradingViewWidget.getStudiesList();
        const drawings = state.tradingViewWidget.getDrawings ? state.tradingViewWidget.getDrawings() : [];
        
        const updateData = {
            [`settings.chartIndicators.${pair}`]: studiesList,
            [`settings.chartDrawings.${pair}`]: drawings
        };

        if (state.userDocRef) {
            state.userDocRef.update(updateData)
                .then(() => {
                    if (!state.settings.chartIndicators) state.settings.chartIndicators = {};
                    if (!state.settings.chartDrawings) state.settings.chartDrawings = {};
                    
                    state.settings.chartIndicators[pair] = studiesList;
                    state.settings.chartDrawings[pair] = drawings;
                    
                    console.log('Chart state saved for:', pair);
                })
                .catch(error => {
                    console.error("Grafik ayarları kaydedilirken hata:", error);
                });
        }
    }
}

(function attachUiHelpersOnce() {
  if (!window.__UI_HELPERS__) {
    const trTimeFmt = { year:'2-digit', month:'2-digit', day:'2-digit', hour:'2-digit', minute:'2-digit' };
    const formatPct   = v => (typeof v === 'number' ? `${v.toFixed(2)}%` : 'N/A');
    const formatPrice = v => (typeof v === 'number' ? (v >= 1 ? v.toFixed(2) : v.toPrecision(6)) : 'N/A');
    const paramNice   = k => ({rsi:'RSI', macd:'MACD', adx:'ADX', volume:'Hacim', volatility:'Volatilite', candle:'Mum Şekli', speed:'Hız'}[k] || k);
    const clsPerf     = v => (typeof v === 'number' ? (v >= 0 ? 'positive' : 'negative') : '');

    window.__UI_HELPERS__ = { trTimeFmt, formatPct, formatPrice, paramNice, clsPerf };
  }
})();
const clsPerf = v => (typeof v === 'number' ? (v >= 0 ? 'positive' : 'negative') : '');

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

// Backtest ile birebir kıyas için önce signal-based ortalama (varsa), yoksa eski alan.
const avg1h  = round2((res.avgReturnsSignal || res.avgReturns)?.['1h']);
const avg4h  = round2((res.avgReturnsSignal || res.avgReturns)?.['4h']);
const avg1d  = round2((res.avgReturnsSignal || res.avgReturns)?.['1d']);


    const paramsHtml = res.dnaProfile?.featureOrder
      .map(f => f.split('_')[0].toUpperCase())
      .filter((v, i, a) => a.indexOf(v) === i)
      .map(p => `<span class="pill">${p}</span>`).join('') || '<span class="muted">Parametre seçilmedi</span>';

    let eventsHtml = '<tbody><tr><td colspan="6" class="muted" style="text-align:center; padding: 20px;">Fırsat bulunamadı</td></tr></tbody>';
    let footerHtml = '';
    if (Array.isArray(res.eventDetails) && res.eventDetails.length) {
      const all = res.eventDetails.slice().sort((a,b) => Number(b.timestamp) - Number(a.timestamp));
      
      const row = (ev, index) => {
  const isHidden = index >= 5 ? 'hidden' : '';
          


  // 1) Sinyal zamanı (mum kapanışı)
  const signalTime = ev.timestamp
    ? new Date(ev.timestamp).toLocaleString('tr-TR', App.trTimeFmt)
    : '—';

  // 2) Hedef mumu (Açılış → Kapanış) veya varsa tek hedef zamanı
  const tgtOpen  = ev.targetCandleOpen ? new Date(ev.targetCandleOpen).toLocaleString('tr-TR', App.trTimeFmt) : null;
  const tgtClose = ev.targetCandleClose ? new Date(ev.targetCandleClose).toLocaleString('tr-TR', App.trTimeFmt) : null;
  const targetTimeBlock = (tgtOpen || tgtClose)
    ? `${tgtOpen || '—'} → ${tgtClose || '—'}`
    : (ev.targetTime ? new Date(ev.targetTime).toLocaleString('tr-TR', App.trTimeFmt) : '—');

  // 3) Fiyatlar
  const pB = Number.isFinite(ev.priceBefore) ? `$${formatPrice(ev.priceBefore)}` : 'N/A';
  const pA = Number.isFinite(ev.priceAfter)  ? `$${formatPrice(ev.priceAfter)}`  : 'N/A';

    // 4) Gerçekleşen performanslar (güvenli: sayı veya nesne)
  const pickVal = (raw) => {
    if (typeof raw === 'number') return raw;
    if (raw && typeof raw === 'object') {
      if (Number.isFinite(raw.mfePct)) return raw.mfePct;
      if (Number.isFinite(raw.mfePctRaw)) return raw.mfePctRaw;
      if (Number.isFinite(raw.value)) return raw.value;
    }
    return NaN;
  };

  const raw15 = ev.perf?.['15m'];
  const raw1h = ev.perf?.['1h'];
  const raw4h = ev.perf?.['4h'];
  const raw1d = ev.perf?.['1d'];

  const val15 = pickVal(raw15);
  const val1h = pickVal(raw1h);
  const val4h = pickVal(raw4h);
  const val1d = pickVal(raw1d);

  const p15 = Number.isFinite(val15) ? `${val15.toFixed(2)}%` : '—';
  const p1h = Number.isFinite(val1h) ? `${val1h.toFixed(2)}%` : '—';
  const p4h = Number.isFinite(val4h) ? `${val4h.toFixed(2)}%` : '—';
  const p1d = Number.isFinite(val1d) ? `${val1d.toFixed(2)}%` : '—';

  // 5) ≈ Beklenen (hem eski alan adı ev.expected hem yeni ev.expectedPct desteklenir), (n) etiketiyle
  const exp = ev.expectedPct || ev.expected || {};
  const n   = ev.expectedN || {};
  const fmtExp = (tf) => {
    const val = exp[tf];
    if (val == null) return '';
    const nVal = n[tf];
    const warn = (typeof nVal === 'number' && nVal > 0 && nVal < 3)
      ? ' <span class="warn">(n küçük)</span>'
      : (typeof nVal === 'number' ? ` <span class="muted">(n=${nVal})</span>` : '');
    return ` <span class="muted">≈ ${Number(val).toFixed(2)}%</span>${warn}`;
  };
  const e15 = fmtExp('15m');
  const e1h = fmtExp('1h');
  const e4h = fmtExp('4h');
  const e1d = fmtExp('1d');

  // 6) Satır HTML
    // 6) Satır HTML (+ MTF rozeti)
 return `<tr class="opportunity-row ${isHidden}" data-coin="${coinSymbol}">
  <td>
    <div>${signalTime}${(ev.mtfConfirm || ev?.details?.mtfConfirm) ? ' <span class="pill">MTF✓</span>' : ''}</div>
    <div class="muted">Sinyal Fiyatı: ${pB}</div>
  </td>
    <td>
      <div>${targetTimeBlock}</div>
      <div class="muted">Hedef Fiyat: ${pA}</div>
    </td>
    <td class="${App.clsPerf(val15)}">${p15}${e15}</td>
    <td class="${App.clsPerf(val1h)}">${p1h}${e1h}</td>
    <td class="${App.clsPerf(val4h)}">${p4h}${e4h}</td>
    <td class="${App.clsPerf(val1d)}">${p1d}${e1d}</td>
  </tr>`;

};



      
      eventsHtml = `<tbody>${all.map(row).join('')}</tbody>`;

      if (all.length > 5) {
        footerHtml = `<tfoot>
          <tr>
            <td colspan="6" style="text-align:center;">
              <button class="show-all-opportunities-btn" data-coin="${coinSymbol}">
                Tüm Fırsatları Göster (${all.length})
              </button>
            </td>
          </tr>
        </tfoot>`;
      }
    }

    let dnaHtml = '<div class="muted">DNA özeti oluşturulamadı.</div>';
    if (res.dnaSummary && res.dnaSummary.featureOrder) {
        dnaHtml = res.dnaSummary.featureOrder.map((key, i) => {
            const value = round2(res.dnaSummary.mean[i]);
            return `<div class="dna-indicator-group"><span class="label">${key}</span><span class="value">${value}</span></div>`;
        }).join('');
    }

    return `
      <div class="analysis-card">
        <div class="analysis-card-header">
          <h4>${coinSymbol}</h4>
        </div>
        <div class="kpi-container" style="padding: 0 20px 20px 20px;">
            <div class="kpi-item"><span class="kpi-label">Sinyal Sayısı</span><span class="kpi-value">${res.eventCount || 0}</span></div>
            <div class="kpi-item"><span class="kpi-label">1S Ort. Getiri</span><span class="kpi-value ${avg1h >= 0 ? 'positive' : 'negative'}">${avg1h}%</span></div>
            <div class="kpi-item"><span class="kpi-label">4S Ort. Getiri</span><span class="kpi-value ${avg4h >= 0 ? 'positive' : 'negative'}">${avg4h}%</span></div>
            <div class="kpi-item"><span class="kpi-label">1G Ort. Getiri</span><span class="kpi-value ${avg1d >= 0 ? 'positive' : 'negative'}">${avg1d}%</span></div>
        </div>
        <div class="analysis-card-body">
          <section>
            <h5 class="setting-subtitle">Bulunan Fırsat Detayları</h5>
            <div class="table-wrapper compact">
              <table>
                <thead><tr><th>Zaman/Fiyat</th><th>Hedef/Fiyat</th><th>15Dk %</th><th>1S %</th><th>4S %</th><th>1G %</th></tr></thead>
                ${eventsHtml}
                ${footerHtml}
              </table>
            </div>
          </section>

          <details class="dna-details-container">
            <summary>DNA Parametreleri ve Özetini Göster/Gizle</summary>
            <div class="details-content-wrapper">
              <section>
                <h5 class="setting-subtitle">DNA Parametreleri</h5>
                <div class="pill-row">${paramsHtml}</div>
              </section>
              <section>
                <h5 class="setting-subtitle">DNA Özeti</h5>
                <div class="dna-summary-grid">${dnaHtml}</div>
              </section>
            </div>
          </details>

        </div>
        <div class="analysis-card-footer">
          <button class="save-dna-btn" data-profile='${JSON.stringify(res.dnaProfile || {})}'>
            <i class="fas fa-save"></i> Bu DNA Profilini Kaydet
          </button>
        </div>
      </div>
    `;
  }).join('');

  resultContainer.innerHTML = html;
}

async function computePerEventMFEviaHighLow(symbol, timeframe, events) {
  const out = new Map();
  if (!events || !events.length) return out;

  const kl = await getKlines(symbol, timeframe, 1000);
  if (!kl || kl.length < 5) return out;

  const idx = new Map();
  kl.forEach((k,i)=> idx.set(Number(k[0]), i));

  const tfMin = { '15m':15, '1h':60, '4h':240, '1d':1440 }[timeframe] || 60;
  const need = (m)=> Math.ceil(m / tfMin);

  for (const ev of events) {
    let i = idx.get(ev.timestamp);
    if (i == null) {
      let best=null, bestD=Infinity;
      kl.forEach((k,ii)=>{ const d=Math.abs(Number(k[0])-ev.timestamp); if(d<bestD){bestD=d;best=ii;} });
      i = best;
    }
    if (i == null) continue;

    const entry = Number(kl[i][4]);
    const slice1h = kl.slice(i+1, i+1+need(60));
    const slice4h = kl.slice(i+1, i+1+need(240));
    const slice1d = kl.slice(i+1, i+1+need(1440));

    const calc = (arr) => {
      if (!arr.length) return { mfe:null, t:null };
      const highs = arr.map(k=>Number(k[2]));
      const lows  = arr.map(k=>Number(k[3]));
      const maxH = Math.max(...highs);
      const minL = Math.min(...lows);
      const tIdx = highs.indexOf(maxH); // en iyi an için zaman (yükseliş senaryosu)
      const t = arr[tIdx] ? new Date(Number(arr[tIdx][0])).toLocaleString('tr-TR', trTimeFmt) : '-';
      const upPct = ((maxH - entry)/entry)*100;
      return { mfe: upPct, t };
    };

    const r1 = calc(slice1h);
    const r4 = calc(slice4h);
    const rD = calc(slice1d);

    out.set(ev.timestamp, {
      mfe1h: typeof r1.mfe==='number' ? Number(r1.mfe.toFixed(2)) : null,
      mfe4h: typeof r4.mfe==='number' ? Number(r4.mfe.toFixed(2)) : null,
      mfe1d: typeof rD.mfe==='number' ? Number(rD.mfe.toFixed(2)) : null,
      t1: r1.t || r4.t || rD.t || '-'
    });
  }
  return out;
}

function computeSimpleMFE(event, direction='up') {
  // Yüksek/düşük veriniz yoksa "priceBefore -> priceAfter" yüzdesini baz al.
  if (event?.mfeHigh != null && event?.mfeLow != null && isFinite(event.priceBefore)) {
    const ref = event.priceBefore;
    const up  = ((event.mfeHigh - ref)/ref)*100;
    const dn  = ((event.mfeLow  - ref)/ref)*100;
    return direction === 'up' ? up : -dn;
  }
  const p = ((event.priceAfter - event.priceBefore)/event.priceBefore)*100;
  return direction === 'down' ? -p : p;
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
                    ${(() => {
  const cnt = profile.count ?? profile.signalCount ?? profile.eventCount ?? profile?.summary?.eventCount;
  return `<div class="summary-item"><strong>Olay Sayısı:</strong> ${Number.isFinite(cnt) ? cnt : '—'}</div>`;
})()}
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
    const periods = ['15m','1h','4h','1d']; // sadece geçerli KPI’lar
summaryContainer.innerHTML = `
  <div class="kpi-container">
    ${periods.map((period) => {
        const stats = summary[period] || { avgMFE:0, tradeCount:0, hitTPRate:0 };
        return `
          <div class="kpi-item">
            <span class="kpi-label">${period} Sonrası Performans</span>
            <span class="kpi-value ${stats.avgMFE > 0 ? 'positive' : 'negative'}">${stats.avgMFE}%</span>
            <span class="kpi-label">Ort. MFE (${stats.tradeCount} işlem)</span>
            <span class="kpi-label" style="margin-top: 5px;">TP Oranı: <strong>${stats.hitTPRate}%</strong></span>
          </div>
        `;
    }).join('')}
  </div>
 ${summary.diagnose?.distance
   ? `<div class="kpi-note muted" style="margin-top:8px">
        <small>
          Skor mesafesi (küçük daha iyidir): 
          min=${summary.diagnose.distance.min} / 
          ort=${summary.diagnose.distance.avg} / 
          max=${summary.diagnose.distance.max}.
          Bu değer 0’a yaklaştıkça sinyal, profilinize daha çok benzer.
        </small>
      </div>`
   : '' }

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
  if (perf == null) return `<td>—</td>`;

  // Hem "sayı" hem "nesne" desteği
  let val, hit = false;
  if (typeof perf === 'number') {
    val = perf;
  } else if (typeof perf === 'object') {
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

        const rowClass = (debugMode && !trade.isSignal) ? 'debug-row' : '';
        return `
            <tr class="${rowClass}">
               <td>${new Date(trade.entryTime).toLocaleString('tr-TR', App.trTimeFmt)}</td>
                <td>$${formatPrice(trade.entryPrice)}</td>
                <td>${trade.score}${Number.isFinite(trade.distance) ? ` <span class="muted">(${trade.distance.toFixed(2)})</span>` : ''}</td>
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
// ---------- CONFIRM MODAL (tasarıma uygun) ----------
if (!App.confirm) {
  App.confirm = ({ 
    title = 'Onay', 
    message = '', 
    confirmText = 'Tamam', 
    cancelText = 'İptal',
    confirmStyle = 'primary' // 'primary' | 'danger'
  }) => new Promise((resolve) => {
    // Overlay hazırla
    let overlay = document.getElementById('modalOverlay');
    if (!overlay) {
      overlay = document.createElement('div');
      overlay.id = 'modalOverlay';
      overlay.className = 'modal-overlay';
      document.body.appendChild(overlay);
    }

    // Panel (modal)
    const panel = document.createElement('div');
    panel.className = 'panel';
    panel.innerHTML = `
      <div class="panel-header">
        <h3>${title}</h3>
        <div class="panel-controls">
          <button class="panel-btn close-btn" aria-label="Kapat">✕</button>
        </div>
      </div>
      <div class="panel-content" style="padding:16px;">
        <p style="margin:0 0 12px 0; color: var(--text-secondary); white-space:pre-wrap;">${message}</p>
        <div class="confirm-footer">
          <button class="confirm-btn cancel">${cancelText}</button>
          <button class="confirm-btn primary ${confirmStyle === 'danger' ? 'danger' : ''}">${confirmText}</button>
        </div>
      </div>
    `;
    document.body.appendChild(panel);

    // Aç
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

