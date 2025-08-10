// public/js/calculations.js

// Bu dosya, gelecekte ön planda anlık olarak yapılması gerekebilecek
// basit indikatör hesaplamaları için bir yer tutucu olarak oluşturulmuştur.
// Şu anki yapıda tüm ağır hesaplamalar arka planda (Firebase Functions) yapıldığı için
// bu dosya şimdilik boş kalabilir veya temel yardımcı fonksiyonlar içerebilir.

// Örnek bir fonksiyon:
const calculateSimpleMovingAverage = (data, period) => {
    if (!data || data.length < period) return null;
    let sum = 0;
    for (let i = data.length - period; i < data.length; i++) {
        sum += data[i];
    }
    return sum / period;
};
