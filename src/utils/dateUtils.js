export function parseDate(dateStr) {
    const months = {
        'ocak': '01', 'şubat': '02', 'mart': '03', 'nisan': '04',
        'mayıs': '05', 'haziran': '06', 'temmuz': '07', 'ağustos': '08',
        'eylül': '09', 'ekim': '10', 'kasım': '11', 'aralık': '12'
    };
    
    const parts = dateStr.split(' ');
    const day = parts[0].padStart(2, '0');
    const month = months[parts[1].toLowerCase()];
    const year = parts[2];
    
    return `${year}-${month}-${day}`;
} 