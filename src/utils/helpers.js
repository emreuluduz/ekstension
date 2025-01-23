export function debounce(func, wait) {
  let timeout;
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
}

export function parseEntryCount(text) {
  const match = text.match(/(\d+)/);
  return match ? parseFloat(match[1]) : 0;
}

// Metinden sayıyı çıkarır ve formatlar
export function parseNumber(text) {
    // text parametresi string değilse stringe çevir
    if (typeof text !== 'string') {
        text = String(text);
    }

    // 1,8b gibi kısaltılmış sayıları kontrol et
    const shortMatch = text.match(/(\d+,?\d*)([kmb])/i);
    if (shortMatch) {
        const [_, num, unit] = shortMatch;
        const baseNum = parseFloat(num.replace(',', '.'));
        
        switch(unit.toLowerCase()) {
            case 'k': return Math.round(baseNum * 1000);
            case 'm': return Math.round(baseNum * 1000000);
            case 'b': return Math.round(baseNum * 1000);
            default: return baseNum;
        }
    }

    // Normal sayıları kontrol et
    const match = text.match(/(\d+)/);
    if (match) {
        return parseInt(match[1], 10);
    }

    return 0;
}

// Sayıyı kısaltılmış formatta gösterir (1800 -> 1,8b)
export function formatNumber(num) {
    if (typeof num !== 'number') {
        num = parseNumber(num);
    }

    if (num >= 1000000) {
        return (num / 1000000).toFixed(1).replace('.', ',') + 'm';
    }
    if (num >= 1000) {
        return (num / 1000).toFixed(1).replace('.', ',') + 'b';
    }
    return num.toString();
} 