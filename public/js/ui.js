// ---- GLOBAL ÇATI ----
window.App = window.App || {
  version: 'v3.0.1-' + (window.App?.versionTag || ''),
  loaded: {},
  guards: {},
  log: (...args) => console.log('[App]', ...args),
};

// ---- UI HELPERS ----
(() => {
  if (window.App.guards.uiHelpers) return;
  window.App.guards.uiHelpers = true;

  App.trTimeFmt = { year: '2-digit', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'Europe/Istanbul' };
  App.formatPct = v => (typeof v === 'number' ? `${v.toFixed(2)}%` : 'N/A');
  App.formatPrice = v => (typeof v === 'number' ? (v >= 1 ? v.toFixed(2) : v.toPrecision(6)) : 'N/A');
  App.paramNice = k => ({ rsi: 'RSI', macd: 'MACD', adx: 'ADX', volume: 'Hacim', volatility: 'Volatilite', candle: 'Mum Şekli', speed: 'Hız' }[k] || k);
  App.clsPerf = v => (typeof v === 'number' ? (v >= 0 ? 'positive' : 'negative') : '');
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
    const page = document.getElementById(pageId);
    if (page) {
        page.style.display = 'block'; 
    }
}

// ===================================================================================
// PANEL YÖNETİM FONKSİYONLARI (DÜZELTİLDİ)
// ===================================================================================

function showPanel(id, autoShowOverlay = true) {
  const el = document.getElementById(id);
  if (!el) return;
  el.classList.add('show');
  if (autoShowOverlay) {
      const overlay = document.getElementById('modalOverlay');
      if(overlay) overlay.classList.add('show');
  }
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

/**
 * EKLENDİ: 'togglePanel is not defined' hatasını çözer.
 * Bir panelin ID'sini alır, açıksa kapatır, kapalıysa açar.
 */
function togglePanel(id) {
    const el = document.getElementById(id);
    if (!el) return;
    
    if (el.classList.contains('show')) {
        closeAllPanels();
    } else {
        closeAllPanels(); // Önce diğerlerini kapat
        showPanel(id);
    }
}
// ===================================================================================


async function loadAlarmReports() {
    const tbody = document.getElementById('alarmReportsTbody');
    if (!tbody) return;
  
    try {
      if (!state.firebase?.firestore) {
        console.warn('[Signals] Firestore hazır değil.');
        renderAlarmReports([]);
        return;
      }
      if (!state.user?.uid) {
        console.warn('[Signals] Kullanıcı oturumu yok.');
        renderAlarmReports([]);
        return;
      }
  
      const db = state.firebase.firestore;
      const eventsSnap = await db.collection('signal_events').where('userId', '==', state.user.uid).orderBy('createdAt', 'desc').limit(500).get();
      const signalsSnap = await db.collection('signals').where('userId', '==', state.user.uid).orderBy('createdAt', 'desc').limit(200).get();
  
      const rows = [];
      eventsSnap.forEach(doc => {
          const d = doc.data() || {};
          rows.push({ coin: d.coin || d.pair || '-', dir: d.direction || '-', entry: d.entryPrice || d.signalPrice || d.priceAtSignal || '-', now: d.currentPrice || d.lastPrice || d.priceLatest || '-', score: d.score ?? '-', exp15m: d.expected_15m ?? d.expected15m ?? '-', got15m: d.realized_15m ?? d.realized15m ?? '-', exp1h: d.expected_1h ?? '-', got1h: d.realized_1h ?? '-', exp4h: d.expected_4h ?? '-', got4h: d.realized_4h ?? '-', exp1d: d.expected_1d ?? '-', got1d: d.realized_1d ?? '-', signalText: d.text || d.signal || '' });
      });
      signalsSnap.forEach(doc => {
        const d = doc.data() || {};
        rows.push({ coin: d.coin || d.pair || '-', dir: d.direction || '-', entry: d.entryPrice || d.signalPrice || d.priceAtSignal || '-', now: d.currentPrice || d.lastPrice || d.priceLatest || '-', score: d.score ?? '-', exp15m: d.expected_15m ?? d.expected15m ?? '-', got15m: d.realized_15m ?? d.realized15m ?? '-', exp1h: d.expected_1h ?? '-', got1h: d.realized_1h ?? '-', exp4h: d.expected_4h ?? '-', got4h: d.realized_4h ?? '-', exp1d: d.expected_1d ?? '-', got1d: d.realized_1d ?? '-', signalText: d.text || d.signal || '' });
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
    if (!notification) return;
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
        console.error("applySettingsToUI çağrıldı ancak state.settings tanımsız.");
        return;
    }
    document.getElementById('langSelect').value = state.settings.lang;
    document.getElementById('autoRefreshToggle').checked = state.settings.autoRefresh;
    const refreshInterval = document.getElementById('refreshInterval');
    refreshInterval.value = state.settings.refreshInterval;
    refreshInterval.min = { admin: 10, qualified: 120, new_user: 300 }[state.currentUserRole] || 300;
    document.getElementById('telegramChatIdInput').value = state.settings.telegramChatId || '';
    for (let i = 1; i <= 3; i++) {
        if (state.settings.columns && state.settings.columns[i]) {
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
    
    translatePage(state.settings.lang);
    if (typeof toggleAutoRefresh === 'function') toggleAutoRefresh();
    if (typeof toggleReportsAutoRefresh === 'function') toggleReportsAutoRefresh(false);
}

function updateAdminUI() {
    const isAdmin = state.currentUserRole === 'admin';
    const analyzeBtn = document.getElementById('analyzeAllCryptoBtn');
    if (analyzeBtn) analyzeBtn.style.display = isAdmin ? 'flex' : 'none';
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
    const tabsContainer = document.getElementById('portfolioTabs');
    if (!tabsContainer) return;
    tabsContainer.innerHTML = '';
    if (!state.userPortfolios) return;

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
    const titleEl = document.getElementById('portfolioModalTitle');
    const labelEl = document.getElementById('portfolioModalLabel');
    const nameInput = document.getElementById('portfolioNameInput');
    const actionInput = document.getElementById('portfolioActionInput');
    const originalNameInput = document.getElementById('originalPortfolioNameInput');
    const errorMsg = document.getElementById('portfolio-error-message');

    if (!titleEl || !labelEl || !nameInput || !actionInput || !originalNameInput || !errorMsg) {
        console.error("Portföy modal elementleri bulunamadı!");
        return;
    }

    if (action === 'new') {
        titleEl.textContent = 'Yeni Liste Oluştur';
        labelEl.textContent = 'Yeni Listenin Adı';
        nameInput.value = '';
    } else if (action === 'rename') {
        titleEl.textContent = 'Listeyi Yeniden Adlandır';
        labelEl.textContent = 'Yeni Ad';
        nameInput.value = state.activePortfolio || ''; 
    }
    
    actionInput.value = action;
    originalNameInput.value = state.activePortfolio || '';
    errorMsg.textContent = '';
    
    showPanel('portfolioModal');
}

function updateAllTableRows(data) {
    const tableBody = document.getElementById('cryptoPriceTable');
    if (!tableBody) return;
    tableBody.innerHTML = '';
    const isSorting = document.querySelector('#crypto-content .drag-handle-col') && !document.querySelector('#crypto-content .drag-handle-col.hidden');
    const getCellStyle = (colData, threshold) => {
        const pct = colData?.pct;
        if (typeof pct !== 'number') return { classes: '', style: '' };
        if (pct < 0) return { classes: 'negative', style: '' };
        if (pct >= threshold) return { classes: 'positive-high', style: `style="color: ${state.settings.colors.high};"` };
        return { classes: 'positive-low', style: `style="color: ${state.settings.colors.low};"` };
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
                <td class="${cellStyle1.classes} clickable-pct" ${cellStyle1.style} data-col="1" data-pair="${result.pair}">${App.formatPct(result.col1.pct)}</td>
                <td class="${cellStyle2.classes} clickable-pct" ${cellStyle2.style} data-col="2" data-pair="${result.pair}">${App.formatPct(result.col2.pct)}</td>
                <td class="${cellStyle3.classes} clickable-pct" ${cellStyle3.style} data-col="3" data-pair="${result.pair}">${App.formatPct(result.col3.pct)}</td>
            `;
        }
        rowHTML += `<td><button class="action-btn remove-btn" data-list-name="crypto" data-pair="${result.pair}"><i class="fas fa-times"></i></button></td>`;
        row.innerHTML = rowHTML;
        tableBody.appendChild(row);
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
        state.tradingViewWidget = new TradingView.widget({
            symbol: `BINANCE:${pair}`, interval: "D", autosize: true, container_id: "chartContainer", theme: "dark", style: "1", locale: "tr", toolbar_bg: "#1e222d", enable_publishing: false, withdateranges: true, hide_side_toolbar: false, allow_symbol_change: true, details: true, studies: savedStudies, disabled_features: ["use_localstorage_for_settings"], saved_data: state.settings?.chartDrawings?.[pair] || {}, loading_screen: { backgroundColor: "#1e222d" },
            overrides: { "mainSeriesProperties.showPriceLine": true, "mainSeriesProperties.priceLineWidth": 2 },
            studies_overrides: { "volume.volume.color.0": "#ff6b6b", "volume.volume.color.1": "#4ecdc4", "volume.volume.transparency": 70, "volume.volume ma.color": "#ffa726", "volume.volume ma.transparency": 30, "volume.volume ma.linewidth": 5 }
        });
        state.tradingViewWidget.onChartReady(function() {
            if (state.settings?.chartDrawings?.[pair]) {
                state.tradingViewWidget.loadDrawings(state.settings.chartDrawings[pair]);
            }
            state.tradingViewWidget.subscribe('onAutoSaveNeeded', function() {
                saveChartState(pair);
            });
        });
    } catch (error) {
        console.error("TradingView widget hatası:", error);
        container.innerHTML = `<p style="color:var(--accent-red); text-align:center; padding:20px;">Grafik yüklenemedi: ${error.message}</p>`;
    }
}

function saveChartState(pair) {
    if (state.tradingViewWidget && typeof state.tradingViewWidget.getStudiesList === 'function') {
        const studiesList = state.tradingViewWidget.getStudiesList();
        const drawings = state.tradingViewWidget.getDrawings ? state.tradingViewWidget.getDrawings() : [];
        const updateData = { [`settings.chartIndicators.${pair}`]: studiesList, [`settings.chartDrawings.${pair}`]: drawings };
        if (state.userDocRef) {
            state.userDocRef.update(updateData)
                .then(() => {
                    if (!state.settings.chartIndicators) state.settings.chartIndicators = {};
                    if (!state.settings.chartDrawings) state.settings.chartDrawings = {};
                    state.settings.chartIndicators[pair] = studiesList;
                    state.settings.chartDrawings[pair] = drawings;
                })
                .catch(error => { console.error("Grafik ayarları kaydedilirken hata:", error); });
        }
    }
}

(function attachUiHelpersOnce() {
  if (!window.__UI_HELPERS__) {
    window.__UI_HELPERS__ = { App.trTimeFmt, App.formatPct, App.formatPrice, App.paramNice, App.clsPerf };
  }
})();

function renderSignalAnalysisPreview(data) {
    const resultContainer = document.getElementById('signalAnalysisResultContainer');
    if (!resultContainer) return;
    resultContainer.innerHTML = '';
    if (!data || Object.keys(data).length === 0) {
      resultContainer.innerHTML = `<div class="placeholder-text">Analiz için sonuç bulunamadı.</div>`;
      return;
    }
    const html = Object.keys(data).map((coin) => {
      const res = data[coin];
      const coinSymbol = coin.replace('USDT','');
      if (!res || res.status === 'error' || res.status === 'info') {
        const msg = (res && res.message) ? res.message : 'Sonuç yok.';
        const color = (res && res.status === 'error') ? 'var(--accent-red)' : 'var(--text-secondary)';
        return `<div class="analysis-card"><div class="analysis-card-header"><h4>${coinSymbol}</h4></div><div style="color:${color};padding:20px;">${msg}</div></div>`;
      }
      const avg1h = App.formatPct((res.avgReturnsSignal || res.avgReturns)?.['1h']);
      const avg4h = App.formatPct((res.avgReturnsSignal || res.avgReturns)?.['4h']);
      const avg1d = App.formatPct((res.avgReturnsSignal || res.avgReturns)?.['1d']);
      const paramsHtml = res.dnaProfile?.featureOrder?.map(f => f.split('_')[0].toUpperCase())?.filter((v, i, a) => a.indexOf(v) === i)?.map(p => `<span class="pill">${p}</span>`).join('') || '<span class="muted">Parametre seçilmedi</span>';
      let eventsHtml = '<tbody><tr><td colspan="6" class="muted" style="text-align:center; padding: 20px;">Fırsat bulunamadı</td></tr></tbody>';
      let footerHtml = '';
      if (Array.isArray(res.eventDetails) && res.eventDetails.length) {
        const all = res.eventDetails.slice().sort((a,b) => Number(b.timestamp) - Number(a.timestamp));
        const row = (ev, index) => {
          const isHidden = index >= 5 ? 'hidden' : '';
          const signalTime = ev.timestamp ? new Date(ev.timestamp).toLocaleString('tr-TR', App.trTimeFmt) : '—';
          const tgtOpen = ev.targetCandleOpen ? new Date(ev.targetCandleOpen).toLocaleString('tr-TR', App.trTimeFmt) : null;
          const tgtClose = ev.targetCandleClose ? new Date(ev.targetCandleClose).toLocaleString('tr-TR', App.trTimeFmt) : null;
          const targetTimeBlock = (tgtOpen || tgtClose) ? `${tgtOpen || '—'} → ${tgtClose || '—'}` : (ev.targetTime ? new Date(ev.targetTime).toLocaleString('tr-TR', App.trTimeFmt) : '—');
          const pB = Number.isFinite(ev.priceBefore) ? `$${App.formatPrice(ev.priceBefore)}` : 'N/A';
          const pA = Number.isFinite(ev.priceAfter) ? `$${App.formatPrice(ev.priceAfter)}` : 'N/A';
          const pickVal = (raw) => {
            if (typeof raw === 'number') return raw;
            if (raw && typeof raw === 'object') {
              if (Number.isFinite(raw.mfePct)) return raw.mfePct;
              if (Number.isFinite(raw.mfePctRaw)) return raw.mfePctRaw;
              if (Number.isFinite(raw.value)) return raw.value;
            }
            return NaN;
          };
          const val15 = pickVal(ev.perf?.['15m']), val1h = pickVal(ev.perf?.['1h']), val4h = pickVal(ev.perf?.['4h']), val1d = pickVal(ev.perf?.['1d']);
          const p15 = App.formatPct(val15), p1h = App.formatPct(val1h), p4h = App.formatPct(val4h), p1d = App.formatPct(val1d);
          const exp = ev.expectedPct || ev.expected || {}, n = ev.expectedN || {};
          const fmtExp = (tf) => {
            const val = exp[tf];
            if (val == null) return '';
            const nVal = n[tf], warn = (typeof nVal === 'number' && nVal > 0 && nVal < 3) ? ' <span class="warn">(n küçük)</span>' : (typeof nVal === 'number' ? ` <span class="muted">(n=${nVal})</span>` : '');
            return ` <span class="muted">≈ ${Number(val).toFixed(2)}%</span>${warn}`;
          };
          return `<tr class="opportunity-row ${isHidden}" data-coin="${coinSymbol}"><td><div>${signalTime}${ (ev.mtfConfirm || ev?.details?.mtfConfirm) ? ' <span class="pill">MTF✓</span>' : ''}</div><div class="muted">Sinyal Fiyatı: ${pB}</div></td><td><div>${targetTimeBlock}</div><div class="muted">Hedef Fiyat: ${pA}</div></td><td class="${App.clsPerf(val15)}">${p15}${fmtExp('15m')}</td><td class="${App.clsPerf(val1h)}">${p1h}${fmtExp('1h')}</td><td class="${App.clsPerf(val4h)}">${p4h}${fmtExp('4h')}</td><td class="${App.clsPerf(val1d)}">${p1d}${fmtExp('1d')}</td></tr>`;
        };
        eventsHtml = `<tbody>${all.map(row).join('')}</tbody>`;
        if (all.length > 5) {
          footerHtml = `<tfoot><tr><td colspan="6" style="text-align:center;"><button class="show-all-opportunities-btn" data-coin="${coinSymbol}">Tüm Fırsatları Göster (${all.length})</button></td></tr></tfoot>`;
        }
      }
      let dnaHtml = '<div class="muted">DNA özeti oluşturulamadı.</div>';
      if (res.dnaSummary && res.dnaSummary.featureOrder) {
        dnaHtml = res.dnaSummary.featureOrder.map((key, i) => `<div class="dna-indicator-group"><span class="label">${key}</span><span class="value">${App.formatPct(res.dnaSummary.mean[i])}</span></div>`).join('');
      }
      return `<div class="analysis-card"><div class="analysis-card-header"><h4>${coinSymbol}</h4></div><div class="kpi-container" style="padding: 0 20px 20px 20px;"><div class="kpi-item"><span class="kpi-label">Sinyal Sayısı</span><span class="kpi-value">${res.eventCount || 0}</span></div><div class="kpi-item"><span class="kpi-label">1S Ort. Getiri</span><span class="kpi-value ${avg1h >= 0 ? 'positive' : 'negative'}">${avg1h}</span></div><div class="kpi-item"><span class="kpi-label">4S Ort. Getiri</span><span class="kpi-value ${avg4h >= 0 ? 'positive' : 'negative'}">${avg4h}</span></div><div class="kpi-item"><span class="kpi-label">1G Ort. Getiri</span><span class="kpi-value ${avg1d >= 0 ? 'positive' : 'negative'}">${avg1d}</span></div></div><div class="analysis-card-body"><section><h5 class="setting-subtitle">Bulunan Fırsat Detayları</h5><div class="table-wrapper compact"><table><thead><tr><th>Zaman/Fiyat</th><th>Hedef/Fiyat</th><th>15Dk %</th><th>1S %</th><th>4S %</th><th>1G %</th></tr></thead>${eventsHtml}${footerHtml}</table></div></section><details class="dna-details-container"><summary>DNA Parametreleri ve Özetini Göster/Gizle</summary><div class="details-content-wrapper"><section><h5 class="setting-subtitle">DNA Parametreleri</h5><div class="pill-row">${paramsHtml}</div></section><section><h5 class="setting-subtitle">DNA Özeti</h5><div class="dna-summary-grid">${dnaHtml}</div></section></div></details></div><div class="analysis-card-footer"><button class="save-dna-btn" data-profile='${JSON.stringify(res.dnaProfile || {})}'>
              <i class="fas fa-save"></i> Bu DNA Profilini Kaydet
            </button></div></div>`;
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
        const highs = arr.map(k=>Number(k[2])), lows = arr.map(k=>Number(k[3]));
        const maxH = Math.max(...highs), minL = Math.min(...lows);
        const tIdx = highs.indexOf(maxH);
        const t = arr[tIdx] ? new Date(Number(arr[tIdx][0])).toLocaleString('tr-TR', App.trTimeFmt) : '-';
        const upPct = ((maxH - entry)/entry)*100;
        return { mfe: upPct, t };
      };
      const r1 = calc(slice1h), r4 = calc(slice4h), rD = calc(slice1d);
      out.set(ev.timestamp, { mfe1h: typeof r1.mfe==='number' ? Number(r1.mfe.toFixed(2)) : null, mfe4h: typeof r4.mfe==='number' ? Number(r4.mfe.toFixed(2)) : null, mfe1d: typeof rD.mfe==='number' ? Number(rD.mfe.toFixed(2)) : null, t1: r1.t || r4.t || rD.t || '-' });
    }
    return out;
}

function computeSimpleMFE(event, direction='up') {
    if (event?.mfeHigh != null && event?.mfeLow != null && isFinite(event.priceBefore)) {
      const ref = event.priceBefore, up = ((event.mfeHigh - ref)/ref)*100, dn = ((event.mfeLow - ref)/ref)*100;
      return direction === 'up' ? up : -dn;
    }
    const p = ((event.priceAfter - event.priceBefore)/event.priceBefore)*100;
    return direction === 'down' ? -p : p;
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
        const activeParams = profile.featureOrder.map(f => f.split('_')[0].toUpperCase()).filter((value, index, self) => self.indexOf(value) === index).join(', ');
        card.innerHTML = `
            <div class="dna-card-header"><div class="dna-card-title"><h5>${profile.name}</h5><span>${profile.coin} / ${profile.timeframe}</span></div><div class="dna-card-actions"><button class="action-btn run-dna-backtest-btn" data-profile-id="${profile.name}" title="Bu Profili Test Et"><i class="fas fa-history"></i></button><button class="action-btn delete-dna-btn" data-profile-id="${profile.name}" data-container-id="${containerId}" title="Profili Sil"><i class="fas fa-trash"></i></button></div></div>
            <div class="dna-card-body"><div class="dna-card-summary"><div class="summary-item"><strong>Yön:</strong> ${directionText}</div><div class="summary-item"><strong>Hedef Değişim:</strong> %${profile.changePercent}</div>${(() => { const cnt = profile.count ?? profile.signalCount ?? profile.eventCount ?? profile?.summary?.eventCount; return `<div class="summary-item"><strong>Olay Sayısı:</strong> ${Number.isFinite(cnt) ? cnt : '—'}</div>`; })()}<div class="summary-item"><strong>Parametreler:</strong> <small>${activeParams}</small></div></div><div class="dna-card-details-toggle"><a href="#" class="toggle-details-link">Detayları Göster/Gizle</a></div><div class="dna-card-details-content"><h6>DNA Özeti (Ortalama Değerler)</h6><div class="details-grid">${profile.featureOrder.map((feature, index) => `<div class="detail-item"><span class="label">${feature}</span><span class="value">${parseFloat(profile.mean[index]).toFixed(4)}</span></div>`).join('')}</div></div></div>`;
        gridContainer.appendChild(card);
    });
    container.innerHTML = '';
    container.appendChild(gridContainer);
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
    const { trades, summary, debugMode } = data;
    const periods = ['15m','1h','4h','1d'];
    summaryContainer.innerHTML = `<div class="kpi-container">${periods.map((period) => { const stats = summary[period] || { avgMFE:0, tradeCount:0, hitTPRate:0 }; return `<div class="kpi-item"><span class="kpi-label">${period} Sonrası Performans</span><span class="kpi-value ${stats.avgMFE > 0 ? 'positive' : 'negative'}">${stats.avgMFE}%</span><span class="kpi-label">Ort. MFE (${stats.tradeCount} işlem)</span><span class="kpi-label" style="margin-top: 5px;">TP Oranı: <strong>${stats.hitTPRate}%</strong></span></div>`; }).join('')}</div>${summary.diagnose?.distance ? `<div class="kpi-note muted" style="margin-top:8px"><small>Skor mesafesi (küçük daha iyidir): min=${summary.diagnose.distance.min} / ort=${summary.diagnose.distance.avg} / max=${summary.diagnose.distance.max}. Bu değer 0’a yaklaştıkça sinyal, profilinize daha çok benzer.</small></div>` : '' }`;
    if (!trades || trades.length === 0) {
        tableBody.innerHTML = `<tr><td colspan="7" style="text-align:center;">${debugMode ? `Seçilen periyotta bu DNA profiline uyan hiçbir mum bulunamadı.` : `Seçilen periyotta, sinyal eşiği üzerinde bir sinyal bulunamadı.`}</td></tr>`;
        return;
    }
    document.querySelector('#dnaBacktestResultTable thead tr').innerHTML = `<th>Sinyal Tarihi</th><th>Giriş Fiyatı</th><th>Skor</th><th>15dk (MFE %)</th><th>1saat (MFE %)</th><th>4saat (MFE %)</th><th>1gün (MFE %)</th>`;
    tableBody.innerHTML = trades.map(trade => {
        const renderPerfCell = (perf) => {
            if (perf == null) return `<td>—</td>`;
            let val, hit = false;
            if (typeof perf === 'number') val = perf;
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
        const rowClass = (debugMode && !trade.isSignal) ? 'debug-row' : '';
        return `<tr class="${rowClass}"><td>${new Date(trade.entryTime).toLocaleString('tr-TR', App.trTimeFmt)}</td><td>$${formatPrice(trade.entryPrice)}</td><td>${trade.score}${Number.isFinite(trade.distance) ? ` <span class="muted">(${trade.distance.toFixed(2)})</span>` : ''}</td>${renderPerfCell(trade.performance['15m'])}${renderPerfCell(trade.performance['1h'])}${renderPerfCell(trade.performance['4h'])}${renderPerfCell(trade.performance['1d'])}</tr>`;
    }).join('');
    section.scrollIntoView({ behavior: 'smooth' });
}

if (!App.confirm) {
  App.confirm = ({ title = 'Onay', message = '', confirmText = 'Tamam', cancelText = 'İptal', confirmStyle = 'primary' }) => new Promise((resolve) => {
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

// --- Güvenli global bağlama ---
try {
  if (typeof updateAllTableRows === 'function') window.updateAllTableRows = window.updateAllTableRows || updateAllTableRows;
  if (typeof renderSupportResistance === 'function') window.renderSupportResistance = window.renderSupportResistance || renderSupportResistance;
  if (typeof renderSignalAnalysisPreview === 'function') window.renderSignalAnalysisPreview = window.renderSignalAnalysisPreview || renderSignalAnalysisPreview;
  if (typeof loadAlarmReports === 'function') window.loadAlarmReports = window.loadAlarmReports || loadAlarmReports;
  if (typeof renderAlarmReports === 'function') window.renderAlarmReports = window.renderAlarmReports || renderAlarmReports;
} catch (e) { console.warn('UI export warning:', e); }

