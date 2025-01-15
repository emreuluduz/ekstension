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
  return match ? parseInt(match[1]) : 0;
} 