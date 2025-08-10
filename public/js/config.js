// public/js/config.js

// --- Firebase Config ---
const firebaseConfig = {
    apiKey: "AIzaSyA3flTu3Jz9E1D1U_DympYE7B4I4FDxj88",
    authDomain: "fiyattakipv3.firebaseapp.com",
    projectId: "fiyattakipv3",
    storageBucket: "fiyattakipv3.firebasestorage.app",
    messagingSenderId: "440839843277",
    appId: "1:440839843277:web:2c9c15e4a103e8b2f2e884"
};

// --- GLOBAL STATE & CONSTANTS ---
const STRATEGY_PRESETS = {
    momentum: { name: '⚡ Momentum', indicators: { rsi: true, stochRsi: true, macd: true, volume: true, sma: false, ema: false, ichimoku: false, bollinger: false, atr: false, fibonacci: false } },
    trend: { name: '📈 Trend', indicators: { ema: true, sma: true, ichimoku: true, macd: true, adx: true, rsi: false, stochRsi: false, bollinger: false, volume: false, atr: false, fibonacci: false } },
    volatility: { name: '🌊 Volatilite', indicators: { bollinger: true, atr: true, volume: true, rsi: false, stochRsi: false, macd: false, sma: false, ema: false, ichimoku: false, fibonacci: false } },
    all: { name: '⭐ Kapsamlı', indicators: { rsi: true, macd: true, ema: true, bollinger: true, fibonacci: true, ichimoku: true, volume: true, stochRsi: true, sma: true, atr: true } },
};

const AVAILABLE_INDICATORS = { ema: "EMA", sma: "SMA", rsi: "RSI", macd: "MACD", bollinger: "Bollinger Bantları", stochRsi: "Stochastic RSI", volume: "Hacim (24s)", atr: "ATR", ichimoku: "Ichimoku Cloud", fibonacci: "Fibonacci" };

const translations = {
    tr: {
        login_prompt: "Devam etmek için giriş yapın veya yeni hesap oluşturun.", email: "E-posta", password: "Şifre", login: "Giriş Yap", signup: "Kayıt Ol", logout: "Çıkış Yap", app_title: "Fiyat Takipçisi", add: "Ekle", refresh: "Yenile", settings: "Ayarlar", coin: "Coin", price: "Fiyat", delete: "Sil", last_update: "Son güncelleme", general_settings: "Genel Ayarlar", language: "Dil", auto_refresh: "Otomatik Yenileme (Liste/Rapor)", refresh_interval: "Yenileme Aralığı (sn)", column_settings: "Kolon Ayarları", color_settings: "Renk Ayarları", high_positive_color: "Yüksek Pozitif Renk", low_positive_color: "Düşük Pozitif Renk", save_settings: "Ayarları Kaydet", saved: "Kaydedildi!", settings_saved: "Ayarlar başarıyla kaydedildi.", analysis_updated: "Analiz başarıyla güncellendi.", limit_exceeded: "Limit aşıldı!",
        role_info: (role, limit, type) => `Rolünüz (${role}) en fazla ${limit} ${type} eklemeye izin veriyor.`,
        invalid_asset: (asset) => `Geçersiz varlık: ${asset}`,
        already_in_list: (asset) => `${asset} zaten listede.`,
        lowest_price_detail: (period, lowestPrice, lowestDate, currentPrice, pctChange) => `<div style="line-height: 1.8; font-size: 0.95rem;"><p style="border-bottom: 1px solid var(--border-color); padding-bottom: 10px; margin-bottom: 10px;"><strong>${period} periyodundaki analiz:</strong></p><p>Bu dönemdeki en düşük fiyat: <strong style="color: var(--accent-yellow);">${lowestPrice}</strong><br><small>(Tarih: ${lowestDate})</small></p><p>Mevcut Fiyat: <strong style="color: var(--accent-blue);">${currentPrice}</strong></p><hr style="border-color: var(--border-color); margin: 15px 0;"><p>Hesaplanan Değişim: <strong style="font-size: 1.2rem; color: ${pctChange > 0 ? 'var(--accent-green)' : 'var(--accent-red)'};">${pctChange}%</strong></p></div>`,
        no_data: "Veri yok"
    },
    en: {}
};

function getDefaultSettings() {
    return {
        lang: 'tr', autoRefresh: false, refreshInterval: 300,
        telegramPhone: '',
        columns: { 1: { name: '1G', days: 1, threshold: 2 }, 2: { name: '7G', days: 7, threshold: 5 }, 3: { name: '30G', days: 30, threshold: 10 } },
        colors: { high: '#26a69a', low: '#f59e0b' },
        cryptoPivotFilter: 'all',
        cryptoAnalysisInterval: '4h',
        cryptoAnalysisIndicators: { ema: true, rsi: true, macd: true, bollinger: true, volume: false, sma: false, stochRsi: false, atr: false, ichimoku: false, fibonacci: false },
        chartStates: {},
        trackedReportIds: []
    };
}
