// public/js/main.js

// --- GLOBAL STATE VARIABLES ---
let currentUserRole = null, coinLimit = 10, settings = {}, pageInitialized = false;
let autoRefreshTimer = null, reportsRefreshTimer = null;
let allCryptoData = [], userAlarms = [], trackedReports = [];
let currentSort = { key: null, order: 'default' };
let userPortfolios = {};
let activePortfolio = 'Varsayılan';
let cryptoAiPairs = [];
let discoveryCoins = [];
let userDocRef = null;
let sortableInstance = null;
let currentRecommendationFilter = 'all';
let tempAlarmCoins = [];
let tradingViewWidget = null;

// Firebase services that will be initialized
let auth, db, functions;

// --- INITIALIZATION ---
document.addEventListener('DOMContentLoaded', () => {
    // Initialize Firebase
    firebase.initializeApp(firebaseConfig);
    auth = firebase.auth();
    db = firebase.firestore();
    functions = firebase.app().functions('europe-west1');

    // Setup Listeners
    setupGlobalEventListeners();
    setupAuthEventListeners();
    initializeAuthListener(); // This will trigger the main app flow
});


// --- CORE APP LOGIC ---
function loadSettingsAndRole(userData) {
    const defaultSettings = getDefaultSettings();
    settings = { ...defaultSettings, ...userData.settings };
    // Deep merge settings objects
    settings.columns = { ...defaultSettings.columns, ...(userData.settings?.columns || {}) };
    settings.colors = { ...defaultSettings.colors, ...(userData.settings?.colors || {}) };
    settings.cryptoAnalysisIndicators = { ...defaultSettings.cryptoAnalysisIndicators, ...(userData.settings?.cryptoAnalysisIndicators || {}) };
    settings.chartStates = userData.settings?.chartStates || {};
    trackedReports = userData.settings?.trackedReportIds || [];

    currentUserRole = userData.role;
    const limits = { admin: {coin: Infinity}, qualified: {coin: 50}, new_user: {coin: 15} };
    coinLimit = limits[currentUserRole]?.coin ?? 15;
    document.getElementById('userEmail').textContent = auth.currentUser.email;
}

async function initializeTrackerPage(userData) {
    pageInitialized = true;

    userPortfolios = userData.portfolios || { "Varsayılan": ["BTCUSDT", "ETHUSDT", "SOLUSDT"] };
    activePortfolio = userData.activePortfolio || Object.keys(userPortfolios)[0];
    cryptoAiPairs = userData.coins_ai || ["BTCUSDT", "ETHUSDT", "SOLUSDT"];
    discoveryCoins = userData.coins_discovery || ["BTCUSDT", "ETHUSDT"];
    userAlarms = userData.alarms || [];

    // Render UI components
    // renderIndicatorFilters();
    // renderDictionary();
    applySettingsToUI(); // This function needs to be defined or moved here
    // renderAllPortfolioTabs();

    await fetchAllDataAndRender();
    // fetchAiDataAndRender();
    // renderAlarmReports();

    setupTrackerPageEventListeners();
}

async function fetchAllDataAndRender() {
    const refreshBtn = document.getElementById('refreshBtn');
    if (refreshBtn) showLoading(refreshBtn);

    const currentCoinList = userPortfolios[activePortfolio] || [];
    allCryptoData = await Promise.all(currentCoinList.map(pair => fetchCryptoData(pair, false)));

    sortAndRenderTable();
    renderSupportResistance();
    if (refreshBtn) hideLoading(refreshBtn);
    const updateTimeEl = document.getElementById('updateTime');
    if(updateTimeEl) updateTimeEl.textContent = new Date().toLocaleString(settings.lang);
}

function sortAndRenderTable() {
    const { key, order } = currentSort;
    let sortedData = (order === 'default') ? [...allCryptoData] : [...allCryptoData].sort((a, b) => {
        let valA, valB;
        if (key.startsWith('col')) { valA = a[key]?.pct; valB = b[key]?.pct; }
        else { valA = a[key]; valB = b[key]; }
        if (a.error) return 1; if (b.error) return -1;
        if (valA === undefined || valA === null || valA === 'N/A') return 1;
        if (valB === undefined || valB === null || valB === 'N/A') return -1;
        if (typeof valA === 'string') return order === 'asc' ? valA.localeCompare(valB) : valB.localeCompare(valA);
        return order === 'asc' ? valA - valB : valB - valA;
    });

    document.querySelectorAll('#crypto-content th.sortable').forEach(th => {
        th.classList.remove('asc', 'desc');
        if (th.dataset.sortKey === key && order !== 'default') th.classList.add(order);
    });
    updateAllTableRows(sortedData);
}


// --- EVENT LISTENERS SETUP ---
function setupGlobalEventListeners() {
    document.body.addEventListener('click', (e) => {
        if (e.target.closest('.close-btn') || e.target === document.getElementById('modalOverlay')) {
            closeAllPanels();
        }
    });
}

function setupTrackerPageEventListeners() {
    const trackerPageEl = document.getElementById('tracker-page');
    if (!trackerPageEl) return;

    // The logic from the original setupTrackerPageEventListeners
    // should be moved here, calling functions from other modules.
    // For example:
    trackerPageEl.addEventListener('click', async (e) => {
        if (e.target.closest('#refreshBtn')) {
            await fetchAllDataAndRender();
            return;
        }
        // ... other event handlers
    });
}

// Other orchestrating functions like saveSettings, setActivePortfolio etc. go here
