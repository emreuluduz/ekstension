const CACHE_DURATION = 60 * 60 * 1000 / 2; // 30 dk cache süresi
const RATE_LIMIT_DURATION = 60000; // 1 dakika
const MAX_REQUESTS_PER_DAY = 100;
const CACHE_KEY = 'football_api_cache';

class FootballAPI {
    constructor() {
        this.requestCount = 0;
        this.lastRequestTime = 0;
        this.lastResetTime = Date.now();
        this.apiResponseCache = new Map();
        this.loadCache();
        
        // Periyodik cache temizliği
        setInterval(() => this.cleanCache(), CACHE_DURATION);
        
        // Sayfa kapatılırken cache'i kaydet
        window.addEventListener('beforeunload', () => this.saveCache());
    }

    // Cache'i localStorage'dan yükle
    async loadCache() {
        try {
            const savedCache = await chrome.storage.local.get(CACHE_KEY);
            if (savedCache[CACHE_KEY]) {
                const cacheData = JSON.parse(savedCache[CACHE_KEY]);
                this.apiResponseCache = new Map(Object.entries(cacheData));
                this.cleanCache(); // Yüklerken expired olanları temizle
            }
        } catch (error) {
            console.error('Cache yüklenirken hata:', error);
        }
    }

    // Cache'i localStorage'a kaydet
    async saveCache() {
        try {
            const cacheObject = Object.fromEntries(this.apiResponseCache);
            await chrome.storage.local.set({ [CACHE_KEY]: JSON.stringify(cacheObject) });
        } catch (error) {
            console.error('Cache kaydedilirken hata:', error);
        }
    }

    // API yanıtını cache'den kontrol eden fonksiyon
    getCachedApiResponse(date) {
        const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD formatı
        const cacheKey = `${date}_${today}`; // Tarih ve günü birleştir
        
        const cachedData = this.apiResponseCache.get(cacheKey);
        if (!cachedData) return null;

        const now = Date.now();
        if (now - cachedData.timestamp > CACHE_DURATION) {
            this.apiResponseCache.delete(cacheKey);
            return null;
        }

        return cachedData.response;
    }

    // Rate limiting kontrolü
    async checkRateLimit() {
        const now = Date.now();
        
        if (now - this.lastResetTime > 24 * 60 * 60 * 1000) {
            this.requestCount = 0;
            this.lastResetTime = now;
        }
        
        if (this.requestCount >= MAX_REQUESTS_PER_DAY) {
            throw new Error('Günlük API istek limiti aşıldı');
        }

        const timeToWait = Math.max(0, RATE_LIMIT_DURATION - (now - this.lastRequestTime));
        if (timeToWait > 0) {
            await new Promise(resolve => setTimeout(resolve, timeToWait));
        }
        
        this.lastRequestTime = now;
        this.requestCount++;
    }

    // API'den maç verilerini al
    async getMatchesByDate(date) {
        try {
            const today = new Date().toISOString().split('T')[0];
            const cacheKey = `${date}_${today}`;
            
            let matchData = this.getCachedApiResponse(date);
            if (matchData) return matchData;

            // API isteğini ve timeout'u yarıştır
            const timeoutPromise = new Promise((_, reject) => {
                setTimeout(() => reject(new Error('timeout')), 2000); // 2 saniye timeout
            });

            const fetchPromise = (async () => {
                await this.checkRateLimit();

                const options = {
                    method: 'GET',
                    headers: {
                        'X-RapidAPI-Key': 'ebb2fe4b299d593eab6373b2497b6d5c',
                        'X-RapidAPI-Host': 'api-football-v1.p.rapidapi.com'
                    }
                };

                const response = await fetch(`https://v3.football.api-sports.io/fixtures?date=${date}`, options);
                
                if (response.status === 403) throw new Error('API anahtarı geçersiz veya eksik');
                if (response.status === 429) throw new Error('API istek limiti aşıldı');
                if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
                
                const data = await response.json();
                return data.response;
            })();

            try {
                matchData = await Promise.race([fetchPromise, timeoutPromise]);
                
                // Cache'e kaydet
                this.apiResponseCache.set(cacheKey, {
                    response: matchData,
                    timestamp: Date.now()
                });
                
                // Arka planda cache'i kaydet
                this.saveCache().catch(console.error);
                
                return matchData;
            } catch (error) {
                if (error.message === 'timeout') {
                    // Timeout oldu, ama arka planda isteği devam ettir
                    fetchPromise
                        .then(data => {
                            this.apiResponseCache.set(cacheKey, {
                                response: data,
                                timestamp: Date.now()
                            });
                            return this.saveCache();
                        })
                        .catch(console.error);
                    
                    // Cache'de veri yoksa null dön
                    return null;
                }
                throw error;
            }
        } catch (error) {
            console.error('API hatası:', error.message);
            return null;
        }
    }

    // Türkçe karakterleri İngilizce karakterlere çevirme
    turkishToEnglish(text) {
        const turkishChars = {
            'ı': 'i', 'İ': 'I', 'ğ': 'g', 'Ğ': 'G',
            'ü': 'u', 'Ü': 'U', 'ş': 's', 'Ş': 'S',
            'ö': 'o', 'Ö': 'O', 'ç': 'c', 'Ç': 'C'
        };
        return text.replace(/[ıİğĞüÜşŞöÖçÇ]/g, char => turkishChars[char] || char);
    }

    // Takım isimlerini normalize et
    normalizeTeamName(name) {
        return this.turkishToEnglish(name)
            .toLowerCase()
            .replace(/\s+/g, ' ')
            .trim();
    }

    // Belirli bir maçın skorunu bul
    findMatchScore(matches, homeTeam, awayTeam) {
        const match = matches.find(m => {
            const apiHome = m.teams.home.name.toLowerCase();
            const apiAway = m.teams.away.name.toLowerCase();
            const searchHome = this.normalizeTeamName(homeTeam);
            const searchAway = this.normalizeTeamName(awayTeam);
            
            // Tam eşleşme kontrolü
            const exactMatch = (apiHome === searchHome && apiAway === searchAway) ||
                             (apiHome === searchAway && apiAway === searchHome);
            
            if (exactMatch) return true;
            
            // Kısmi eşleşme kontrolü
            const homeMatches = apiHome.includes(searchHome) || apiHome.includes(searchAway);
            const awayMatches = apiAway.includes(searchHome) || apiAway.includes(searchAway);
            
            return homeMatches || awayMatches;
        });

        if (match && match.goals.home !== null) {
            return {
                home: match.goals.home,
                away: match.goals.away,
                status: match.fixture.status.short
            };
        }

        return null;
    }

    // Cache temizliği
    cleanCache() {
        const now = Date.now();
        let cacheUpdated = false;
        
        for (const [key, value] of this.apiResponseCache.entries()) {
            if (now - value.timestamp > CACHE_DURATION) {
                this.apiResponseCache.delete(key);
                cacheUpdated = true;
            }
        }
        
        // Cache değiştiyse kaydet
        if (cacheUpdated) {
            this.saveCache();
        }
    }
}

// Singleton instance
let instance = null;
export const footballApi = (() => {
    if (!instance) {
        instance = new FootballAPI();
    }
    return instance;
})(); 