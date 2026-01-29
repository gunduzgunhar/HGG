/**
 * Real Estate Assistant - Application Logic
 */
const app = {
    data: {
        listings: [],
        customers: [],
        appointments: [],
        findings: [],
        customers: [],
        appointments: [],
        findings: [],
        fsbo: [],
        targets: []
    },
    currentCustomerRegions: [],
    currentEditRegions: [],

    // --- IndexedDB Photo Storage ---
    photoStore: {
        db: null,
        dbName: 'rea_photos',
        storeName: 'photos',

        init() {
            const self = app.photoStore;
            return new Promise((resolve) => {
                try {
                    const request = indexedDB.open(self.dbName, 1);
                    request.onupgradeneeded = (e) => {
                        const db = e.target.result;
                        if (!db.objectStoreNames.contains(self.storeName)) {
                            db.createObjectStore(self.storeName, { keyPath: 'id' });
                        }
                    };
                    request.onsuccess = (e) => {
                        self.db = e.target.result;
                        console.log('PhotoStore: IndexedDB hazır');
                        resolve(true);
                    };
                    request.onerror = (e) => {
                        console.warn('PhotoStore: IndexedDB açılamadı, fallback moda geçiliyor', e);
                        resolve(false);
                    };
                } catch (e) {
                    console.warn('PhotoStore: IndexedDB desteklenmiyor, fallback mod', e);
                    resolve(false);
                }
            });
        },

        savePhoto(base64, collection, parentId) {
            const self = app.photoStore;
            return new Promise((resolve) => {
                if (!self.db) { console.warn('PhotoStore: DB yok, fallback'); resolve(null); return; }
                const id = 'photo_' + Date.now() + '_' + Math.random().toString(36).substr(2, 4);
                const tx = self.db.transaction(self.storeName, 'readwrite');
                const store = tx.objectStore(self.storeName);
                store.put({ id, data: base64, collection, parentId, created: Date.now() });
                tx.oncomplete = () => resolve(id);
                tx.onerror = () => { console.warn('PhotoStore: Kayıt hatası'); resolve(null); };
            });
        },

        getPhoto(id) {
            const self = app.photoStore;
            return new Promise((resolve) => {
                if (!self.db) { resolve(null); return; }
                const tx = self.db.transaction(self.storeName, 'readonly');
                const store = tx.objectStore(self.storeName);
                const request = store.get(id);
                request.onsuccess = () => resolve(request.result ? request.result.data : null);
                request.onerror = () => resolve(null);
            });
        },

        deletePhotos(ids) {
            const self = app.photoStore;
            return new Promise((resolve) => {
                if (!self.db || !ids || ids.length === 0) { resolve(); return; }
                const tx = self.db.transaction(self.storeName, 'readwrite');
                const store = tx.objectStore(self.storeName);
                ids.forEach(id => { if (id && typeof id === 'string' && id.startsWith('photo_')) store.delete(id); });
                tx.oncomplete = () => resolve();
                tx.onerror = () => resolve();
            });
        },

        getAllPhotos() {
            const self = app.photoStore;
            return new Promise((resolve) => {
                if (!self.db) { resolve({}); return; }
                const tx = self.db.transaction(self.storeName, 'readonly');
                const store = tx.objectStore(self.storeName);
                const request = store.getAll();
                request.onsuccess = () => {
                    const map = {};
                    (request.result || []).forEach(item => { map[item.id] = item.data; });
                    resolve(map);
                };
                request.onerror = () => resolve({});
            });
        }
    },

    // Geçici fotoğraf cache'leri (render sırasında kullanılır)
    _photoCache: {},

    isPhotoRef(val) {
        return typeof val === 'string' && val.startsWith('photo_');
    },

    adanaLocations: {
        "Seyhan": {
            lat: 37.0016, lng: 35.3289,
            neighborhoods: {
                "Güzelyalı": [37.0350, 35.3050],
                "Reşatbey": [36.9950, 35.3250],
                "Kurtuluş": [37.0000, 35.3100],
                "Cemalpaşa": [37.0050, 35.3200],
                "Ziyapaşa": [37.0020, 35.3220],
                "Gazipaşa": [37.0000, 35.3200],
                "Pınar": [37.0200, 35.2800],
                "Tellidere": [37.0250, 35.2900],
                "Yeşilyurt": [37.0200, 35.3000],
                "Fevzipaşa": [37.0100, 35.2900],
                "Mithatpaşa": [37.0090, 35.3090],
                "Aydınlar": [37.0220, 35.2680],
                "Gürselpaşa": [37.0250, 35.2800],
                "Çınarlı": [36.9920, 35.3280],
                "Döşeme": [36.9950, 35.3150],
                "Yenibaraj": [37.0050, 35.2850],
                "2000 Evler": [37.0150, 35.3050]
            }
        },
        "Çukurova": {
            lat: 37.0500, lng: 35.3000,
            neighborhoods: {
                "Toros": [37.0500, 35.3000],
                "Mahfesığmaz": [37.0450, 35.3100],
                "Güzelyalı": [37.0400, 35.3050],
                "Huzurevleri": [37.0550, 35.2950],
                "Yurt": [37.0400, 35.2900],
                "Belediye": [37.0600, 35.3000],
                "100. Yıl": [37.0550, 35.3100],
                "Beyazevler": [37.0350, 35.3200],
                "Kabasakal": [37.0980, 35.2500],
                "Kurttepe": [37.0650, 35.2850],
                "Karslılar": [37.0700, 35.2900]
            }
        },
        "Yüreğir": {
            lat: 36.9850, lng: 35.3500,
            neighborhoods: {
                "Kışla": [37.0000, 35.3500],
                "Yavrular": [36.9900, 35.3600],
                "Sinanpaşa": [36.9950, 35.3400],
                "Atakent": [37.0100, 35.3600],
                "Yamaçlı": [36.9800, 35.3400]
            }
        },
        "Sarıçam": {
            lat: 37.0700, lng: 35.4000,
            neighborhoods: {
                "Sofulu": [37.0700, 35.4100],
                "Gültepe": [37.0800, 35.4000],
                "Osmangazi": [37.0750, 35.4200],
                "Yıldırım": [37.0650, 35.3900]
            }
        }
    },

    // Fotoğraf sıkıştırma (800px max, JPEG %70)
    compressPhoto(file) {
        return new Promise((resolve) => {
            const reader = new FileReader();
            reader.onloadend = function () {
                const img = new Image();
                img.src = reader.result;
                img.onload = function () {
                    const canvas = document.createElement('canvas');
                    const MAX_WIDTH = 800;
                    const scale = Math.min(1, MAX_WIDTH / img.width);
                    canvas.width = img.width * scale;
                    canvas.height = img.height * scale;
                    const ctx = canvas.getContext('2d');
                    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
                    resolve(canvas.toDataURL('image/jpeg', 0.70));
                };
            };
            reader.readAsDataURL(file);
        });
    },

    // Render sonrası data-photo-id attribute'larını IndexedDB'den çöz
    async resolveRenderedPhotos(containerSelector) {
        const container = typeof containerSelector === 'string'
            ? document.querySelector(containerSelector)
            : containerSelector;
        if (!container) return;

        const imgs = container.querySelectorAll('img[data-photo-id]');
        for (const img of imgs) {
            const photoId = img.getAttribute('data-photo-id');
            if (!photoId) continue;

            // Önce cache'e bak
            if (this._photoCache[photoId]) {
                img.src = this._photoCache[photoId];
                continue;
            }

            const data = await this.photoStore.getPhoto(photoId);
            if (data) {
                this._photoCache[photoId] = data;
                img.src = data;
            } else {
                img.style.display = 'none';
            }
        }
    },

    // Ortalama m2 Fiyatları (TL) - MAHALLE BAZLI DETAYLI VERİ
    // Ortalama m2 Fiyatları (TL) - GÜNCEL PİYASA (Ocak 2026 Tahmini)
    marketData: {
        "Seyhan": {
            avg: 28000,
            neighborhoods: { "Gürselpaşa": 37000, "Pınar": 32000, "Gazipaşa": 31000, "Kurtuluş": 36000, "Mithatpaşa": 29000, "2000 Evler": 30000 }
        },
        "Çukurova": {
            avg: 39000,
            neighborhoods: { "Güzelyalı": 45000, "Mahfesığmaz": 42000, "Toros": 40000, "Yurt": 38000, "Kabasakal": 48000, "100. Yıl": 39000, "Belediye Evleri": 36000, "Kurttepe": 35000, "Karslılar": 34000, "Huzurevleri": 33000 }
        },
        "Yüreğir": {
            avg: 24000,
            neighborhoods: { "Atakent": 28000, "Yavuzlar": 22000, "Kışla": 25000 }
        },
        "Sarıçam": {
            avg: 26000,
            neighborhoods: { "Gültepe": 30000, "Sofulu": 27000 }
        }
    },

    evaluateListing(id) {
        const listing = this.data.listings.find(l => l.id === id);
        if (!listing) return;

        // 1. Get Base Info
        const price = parseInt(listing.price);
        const size = parseInt(listing.size_net || listing.size_gross || 100);

        // 2. Get Neighborhood Average - PRIORITY: Sold listings > Market data
        let marketAvg = 25000; // Fallback
        let neighborhood = '';
        let dataSource = 'Genel Tahmin';

        // Find district and neighborhood from listing location
        const districtMatch = Object.keys(this.marketData).find(d => listing.location.includes(d));
        if (districtMatch) {
            neighborhood = districtMatch;
            const districtData = this.marketData[districtMatch];
            marketAvg = districtData.avg;
            dataSource = `${districtMatch} Ortalaması`;

            if (districtData.neighborhoods) {
                const neighName = Object.keys(districtData.neighborhoods).find(n => listing.location.includes(n));
                if (neighName) {
                    marketAvg = districtData.neighborhoods[neighName];
                    neighborhood = neighName;
                    dataSource = `${neighName} Ortalaması`;
                }
            }
        }

        // PRIORITY: Use SOLD listings from EXACT SAME neighborhood only (no district fallback)
        let usingSoldData = false;
        let soldDataAge = null;
        let soldDataSite = null;
        let soldDataKitchen = null;

        const soldListings = this.data.listings.filter(l =>
            l.status === 'sold' &&
            l.final_price &&
            l.location &&
            listing.location &&
            neighborhood && // STRICT: Only if we have a specific neighborhood
            l.location.includes(neighborhood) // Must match exact neighborhood
        );

        if (soldListings.length > 0) {
            usingSoldData = true;
            // Calculate average price per m² from sold listings
            let totalUnitPrice = 0;
            soldListings.forEach(sold => {
                const soldSize = parseInt(sold.size_net || sold.size_gross || 100);
                const soldPrice = parseInt(sold.final_price);
                totalUnitPrice += soldPrice / soldSize;
            });
            marketAvg = Math.round(totalUnitPrice / soldListings.length);
            dataSource = `${neighborhood} Satış Verisi (${soldListings.length} satış)`;

            // Track characteristics of sold listings to avoid double-counting
            // If most sold listings have similar age/site, we skip those adjustments
            const soldAges = soldListings.map(s => s.building_age).filter(a => a);
            const soldSites = soldListings.map(s => s.site_features).filter(s => s);
            const soldKitchens = soldListings.map(s => s.kitchen).filter(k => k);
            if (soldAges.length > 0) soldDataAge = soldAges[0]; // Most recent sold
            if (soldSites.length > 0) soldDataSite = soldSites[0];
            if (soldKitchens.length > 0) soldDataKitchen = soldKitchens[0];
        }

        // Start with base value
        let baseValue = marketAvg * size;
        let estimatedValue = baseValue;
        let adjustments = [];

        // 3. PERCENTAGE-BASED ADJUSTMENTS (More realistic)
        // SMART: Skip adjustments if sold data has same characteristics (avoid double-counting)

        // Building Age - MOST IMPORTANT FACTOR
        const age = listing.building_age || '';
        let ageMultiplier = 1.0;
        let ageLabel = '';

        // Only apply age adjustment if different from sold data OR no sold data
        const sameAgeAsSold = usingSoldData && soldDataAge && age === soldDataAge;

        if (!sameAgeAsSold) {
            if (age === '0' || age === '1' || age === '2' || age === '3' || age === '4' || age === '5') {
                ageMultiplier = 1.20; // +20%
                ageLabel = 'Yeni Bina (0-5 yaş) +%20';
            } else if (age === '6-10') {
                ageMultiplier = 1.10; // +10%
                ageLabel = 'Genç Bina (6-10 yaş) +%10';
            } else if (age === '11-15') {
                ageMultiplier = 1.0; // Baseline
            } else if (age === '16-20') {
                ageMultiplier = 0.90; // -10%
                ageLabel = 'Orta Yaşlı Bina (16-20 yaş) -%10';
            } else if (age === '21-25') {
                ageMultiplier = 0.78; // -22%
                ageLabel = 'Eski Bina (21-25 yaş) -%22';
            } else if (age === '26-30') {
                ageMultiplier = 0.65; // -35%
                ageLabel = 'Çok Eski Bina (26-30 yaş) -%35';
            } else if (age === '30+') {
                ageMultiplier = 0.60; // -40%
                ageLabel = 'Yaşlı Bina (30+ yaş) -%40';
            }
        }

        if (ageLabel) {
            const ageChange = baseValue * (ageMultiplier - 1);
            adjustments.push({ label: ageLabel, amount: ageChange, percent: Math.round((ageMultiplier - 1) * 100) });
        }
        estimatedValue = baseValue * ageMultiplier;

        // Floor Adjustment - Middle floors are baseline (always apply - not tracked in sold data)
        const floor = listing.floor_current;
        const totalFloors = parseInt(listing.floor_total) || 10;
        const floorNum = parseInt(floor);
        let floorMultiplier = 1.0;
        let floorLabel = '';

        if (floor === 'Zemin' || floor === 'Giriş' || floor === 'Bahçe Katı' || floor === '1') {
            floorMultiplier = 0.95; // -5%
            floorLabel = 'Giriş/1. Kat -%5';
        } else if (floorNum && floorNum >= totalFloors) {
            floorMultiplier = 0.97; // -3%
            floorLabel = 'Son Kat -%3';
        }

        if (floorLabel) {
            const floorChange = estimatedValue * (floorMultiplier - 1);
            adjustments.push({ label: floorLabel, amount: floorChange, percent: Math.round((floorMultiplier - 1) * 100) });
        }
        estimatedValue *= floorMultiplier;

        // Site Features - Huge impact
        const siteFeatures = listing.site_features || '';
        let siteMultiplier = 1.0;
        let siteLabel = '';

        // Only apply site adjustment if different from sold data OR no sold data
        const sameSiteAsSold = usingSoldData && soldDataSite && siteFeatures === soldDataSite;

        if (!sameSiteAsSold) {
            if (siteFeatures.includes('Sosyal Donatılı')) {
                siteMultiplier = 1.20; // +20%
                siteLabel = 'Sosyal Donatılı Site +%20';
            } else if (siteFeatures.includes('Kısmi')) {
                siteMultiplier = 1.08; // +8%
                siteLabel = 'Kısmi Sosyal Donatı +%8';
            }
        }

        if (siteLabel) {
            const siteChange = estimatedValue * (siteMultiplier - 1);
            adjustments.push({ label: siteLabel, amount: siteChange, percent: Math.round((siteMultiplier - 1) * 100) });
        }
        estimatedValue *= siteMultiplier;

        // Damage Status - Critical
        const damage = listing.damage || '';
        let damageMultiplier = 1.0;
        let damageLabel = '';

        if (damage.includes('Hasarsız')) {
            // No adjustment - this is the expected default
        } else if (damage.includes('Az')) {
            damageMultiplier = 0.82; // -18%
            damageLabel = 'Az Hasarlı -%18';
        } else if (damage.includes('Orta')) {
            damageMultiplier = 0.70; // -30%
            damageLabel = 'Orta Hasarlı -%30';
        } else if (damage.includes('Ağır')) {
            damageMultiplier = 0.40; // -60%
            damageLabel = 'Ağır Hasarlı -%60';
        }

        if (damageLabel) {
            const damageChange = estimatedValue * (damageMultiplier - 1);
            adjustments.push({ label: damageLabel, amount: damageChange, percent: Math.round((damageMultiplier - 1) * 100) });
        }
        estimatedValue *= damageMultiplier;

        // Deed Status (Tapu Durumu) Adjustment
        const deedStatus = listing.deed_status || '';
        let deedMultiplier = 1.0;
        let deedLabel = '';

        if (deedStatus.includes('İrtifak') || deedStatus.includes('irtifak')) {
            deedMultiplier = 0.93; // -7%
            deedLabel = 'Kat İrtifaklı -%7';
        }

        if (deedLabel) {
            const deedChange = estimatedValue * (deedMultiplier - 1);
            adjustments.push({ label: deedLabel, amount: deedChange, percent: Math.round((deedMultiplier - 1) * 100) });
        }
        estimatedValue *= deedMultiplier;

        // Kitchen Type Adjustment - Closed kitchen is preferred
        // Only apply if sold data didn't have closed kitchen (avoid double-counting)
        const kitchen = listing.kitchen || '';
        let kitchenMultiplier = 1.0;
        let kitchenLabel = '';

        const soldHadClosedKitchen = usingSoldData && soldDataKitchen &&
            (soldDataKitchen.includes('Kapalı') || soldDataKitchen.includes('kapalı'));
        const listingHasClosedKitchen = kitchen.includes('Kapalı') || kitchen.includes('kapalı');

        // Only add +7% if listing has closed kitchen BUT sold data didn't
        if (listingHasClosedKitchen && !soldHadClosedKitchen) {
            kitchenMultiplier = 1.07; // +7%
            kitchenLabel = 'Kapalı Mutfak +%7';
        }

        if (kitchenLabel) {
            const kitchenChange = estimatedValue * (kitchenMultiplier - 1);
            adjustments.push({ label: kitchenLabel, amount: kitchenChange, percent: Math.round((kitchenMultiplier - 1) * 100) });
        }
        estimatedValue *= kitchenMultiplier;

        // Interior Condition (İçinin Durumu) Adjustment
        const interiorCondition = listing.interior_condition || 'Normal';
        let interiorMultiplier = 1.0;
        let interiorLabel = '';

        if (interiorCondition === 'Full Yapılı') {
            interiorMultiplier = 1.20; // +20%
            interiorLabel = 'Full Yapılı +%20';
        } else if (interiorCondition === 'Yapılı') {
            interiorMultiplier = 1.10; // +10%
            interiorLabel = 'Yapılı +%10';
        } else if (interiorCondition === 'Normal') {
            // Baseline - no adjustment
        } else if (interiorCondition === 'Az Masraflı') {
            interiorMultiplier = 0.90; // -10%
            interiorLabel = 'Az Masraflı -%10';
        } else if (interiorCondition === 'Çok Masraflı') {
            interiorMultiplier = 0.80; // -20%
            interiorLabel = 'Çok Masraflı -%20';
        }

        if (interiorLabel) {
            const interiorChange = estimatedValue * (interiorMultiplier - 1);
            adjustments.push({ label: interiorLabel, amount: interiorChange, percent: Math.round((interiorMultiplier - 1) * 100) });
        }
        estimatedValue *= interiorMultiplier;

        // 4. Final Comparison
        const diff = price - estimatedValue;
        const diffPercent = (diff / estimatedValue) * 100;

        let status = '';
        let statusClass = '';
        let statusEmoji = '';

        if (diffPercent < -15) {
            status = 'ÇOK UYGUN';
            statusEmoji = '🔥';
            statusClass = 'text-success';
        } else if (diffPercent >= -15 && diffPercent <= 10) {
            status = 'PİYASA DEĞERİNDE';
            statusEmoji = '✅';
            statusClass = 'text-primary';
        } else if (diffPercent > 10 && diffPercent <= 25) {
            status = 'BİRAZ YÜKSEK';
            statusEmoji = '⚖️';
            statusClass = 'text-warning';
        } else {
            status = 'PAHALI';
            statusEmoji = '🛑';
            statusClass = 'text-danger';
        }

        // 5. Render Result
        let adjustmentsHtml = adjustments.map(adj => `
            <div style="display:flex; justify-content:space-between; font-size:13px; margin-bottom:4px; color: ${adj.amount > 0 ? '#166534' : '#991B1B'}">
                <span>${adj.amount > 0 ? '▲' : '▼'} ${adj.label}</span>
                <span>${adj.amount > 0 ? '+' : ''}${adj.amount.toLocaleString('tr-TR')} TL</span>
            </div>
        `).join('');

        if (adjustments.length === 0) {
            adjustmentsHtml = '<div style="font-size:12px; color:#666; font-style:italic">Standart özellikler (ara kat, hasarsız, normal bina yaşı)</div>';
        }

        const modalBody = document.getElementById('evaluation-result');
        modalBody.innerHTML = `
            <div class="eval-card">
                <div class="metric-row" style="display:flex; gap:20px; margin-bottom:15px;">
                    <div class="metric" style="flex:1; text-align:center; padding:15px; background:#f8fafc; border-radius:8px;">
                        <label style="font-size:11px; color:#64748b; display:block; margin-bottom:5px;">İlan Fiyatı</label>
                        <span style="font-size:20px; font-weight:700; color:#1e293b;">${price.toLocaleString('tr-TR')} TL</span>
                    </div>
                    <div class="metric" style="flex:1; text-align:center; padding:15px; background:linear-gradient(135deg, #e0e7ff, #f0e6ff); border-radius:8px;">
                        <label style="font-size:11px; color:#6366f1; display:block; margin-bottom:5px;">Tahmini Değer</label>
                        <span style="font-size:20px; font-weight:800; color:#4f46e5;">${estimatedValue.toLocaleString('tr-TR', { maximumFractionDigits: 0 })} TL</span>
                    </div>
                </div>
                
                <div style="text-align:center; font-size:28px; font-weight:800; margin: 20px 0; padding: 15px; background:var(--bg-secondary); border-radius:12px;">
                    <span style="font-size:36px;">${statusEmoji}</span><br>
                    <span class="${statusClass}">${status}</span>
                    <div style="font-size:14px; color:#64748b; font-weight:normal; margin-top:5px;">
                        Fark: ${diff > 0 ? '+' : ''}${diff.toLocaleString('tr-TR')} TL
                    </div>
                </div>

                <div style="background:#f8fafc; padding:12px; border-radius:8px; border:1px solid #e2e8f0; margin-bottom:15px;">
                    <div style="font-size:12px; font-weight:600; color:#64748b; margin-bottom:8px; display:flex; justify-content:space-between;">
                        <span>📍 ${dataSource} (${marketAvg.toLocaleString('tr-TR')} TL/m²)</span>
                        <span>${(marketAvg * size).toLocaleString('tr-TR')} TL</span>
                    </div>
                    ${adjustmentsHtml}
                    <div style="margin-top:8px; padding-top:8px; border-top:1px solid #cbd5e1; font-size:13px; font-weight:bold; text-align:right; color:#334155;">
                        TAHMİNİ DEĞER: ${estimatedValue.toLocaleString('tr-TR', { maximumFractionDigits: 0 })} TL
                    </div>
                </div>
                
                <div style="background:#F0FDF4; border-left: 4px solid #10B981; padding: 10px; border-radius: 4px;">
                    <p style="color:#064E3B; font-size:12px; line-height:1.4; margin:0;">
                    💡 Bu değerleme <strong>mahalle ortalaması</strong> üzerine kat, site özellikleri ve hasar durumu gibi faktörler değerlendirilerek hesaplanmıştır.
                    </p>
                </div>
            </div>
        `;

        this.modals.open('evaluation');
    },

    async migratePhotosToIndexedDB() {
        if (!this.photoStore.db) return;
        if (localStorage.getItem('rea_photos_migrated')) return;

        console.log('PhotoStore: Migrasyon başlıyor...');
        let migratedCount = 0;

        // Listings fotoğrafları
        for (const item of (this.data.listings || [])) {
            if (item.photos && Array.isArray(item.photos)) {
                const newPhotos = [];
                for (const photo of item.photos) {
                    if (photo && !this.isPhotoRef(photo) && photo.startsWith('data:')) {
                        const id = await this.photoStore.savePhoto(photo, 'listings', item.id);
                        newPhotos.push(id || photo);
                        if (id) migratedCount++;
                    } else {
                        newPhotos.push(photo);
                    }
                }
                item.photos = newPhotos;
            }
        }

        // Findings fotoğrafları
        for (const item of (this.data.findings || [])) {
            if (item.photos && Array.isArray(item.photos)) {
                const newPhotos = [];
                for (const photo of item.photos) {
                    if (photo && !this.isPhotoRef(photo) && photo.startsWith('data:')) {
                        const id = await this.photoStore.savePhoto(photo, 'findings', item.id);
                        newPhotos.push(id || photo);
                        if (id) migratedCount++;
                    } else {
                        newPhotos.push(photo);
                    }
                }
                item.photos = newPhotos;
            }
        }

        // FSBO fotoğrafları
        for (const item of (this.data.fsbo || [])) {
            if (item.photos && Array.isArray(item.photos)) {
                const newPhotos = [];
                for (const photo of item.photos) {
                    if (photo && !this.isPhotoRef(photo) && photo.startsWith('data:')) {
                        const id = await this.photoStore.savePhoto(photo, 'fsbo', item.id);
                        newPhotos.push(id || photo);
                        if (id) migratedCount++;
                    } else {
                        newPhotos.push(photo);
                    }
                }
                item.photos = newPhotos;
            }
            if (item.photo && !this.isPhotoRef(item.photo) && item.photo.startsWith('data:')) {
                const id = await this.photoStore.savePhoto(item.photo, 'fsbo', item.id);
                if (id) { item.photo = id; migratedCount++; }
            }
        }

        // Target fotoğrafları
        for (const item of (this.data.targets || [])) {
            if (item.photo && !this.isPhotoRef(item.photo) && item.photo.startsWith('data:')) {
                const id = await this.photoStore.savePhoto(item.photo, 'targets', item.id);
                if (id) { item.photo = id; migratedCount++; }
            }
        }

        if (migratedCount > 0) {
            // Kaydet — artık referans ID'leri içerir, localStorage çok küçülecek
            this.saveData('listings');
            this.saveData('findings');
            this.saveData('fsbo');
            this.saveData('targets');
            console.log(`PhotoStore: ${migratedCount} fotoğraf IndexedDB'ye taşındı`);
        }

        localStorage.setItem('rea_photos_migrated', 'true');
    },

    init() {
        if (window.log) log("App.init() called.");
        try {
            const btn = document.getElementById('btn-add-customer-header');
            if (btn) {
                btn.onclick = (e) => {
                    if (window.log) log("Button Clicked (JS Handler)");
                    e.preventDefault();
                    this.modals.open('add-customer');
                };
                if (window.log) log("Button handler attached to btn-add-customer-header");
            } else {
                if (window.log) log("WARNING: btn-add-customer-header NOT FOUND");
            }
        } catch (e) { if (window.log) log("Error attaching button: " + e); }

        console.log("App Initialized v3 - Kabasakal Check");

        // IndexedDB'yi başlat, sonra verileri yükle
        this.photoStore.init().then(() => {
            try { this.loadData(); } catch (e) { console.error("loadData failed", e); }
            try { this.setupNavigation(); } catch (e) { console.error("setupNavigation failed", e); }
            try { this.setupModals(); } catch (e) { console.error("setupModals failed", e); }
            try { this.setupForms(); } catch (e) { console.error("setupForms failed", e); }
            try { this.renderAll(); } catch (e) { console.error("renderAll failed", e); }
        });
    },

    setupForms() {
        const fsboForm = document.getElementById('form-add-fsbo');
        if (fsboForm) {
            fsboForm.addEventListener('submit', (e) => {
                e.preventDefault();
                this.addFsbo(new FormData(e.target));
            });
        }

        const targetForm = document.getElementById('form-add-target');
        if (targetForm) {
            targetForm.addEventListener('submit', (e) => {
                e.preventDefault();
                this.addTarget(new FormData(e.target));
            });
        }
    },

    setupFilters() {
        const searchInput = document.querySelector('.search-input');
        if (searchInput) searchInput.addEventListener('input', () => this.renderListings());

        const filterIds = ['list-filter-type', 'list-filter-neighborhood', 'list-filter-rooms', 'list-filter-damage'];
        filterIds.forEach(id => {
            const el = document.getElementById(id);
            if (el) el.addEventListener('change', () => this.renderListings());
        });

        const districtFilter = document.getElementById('list-filter-district');
        if (districtFilter) {
            districtFilter.addEventListener('change', () => this.onListFilterDistrictChange());
        }
    },

    // --- DATA MANAGEMENT (FIREBASE FIRESTORE) ---
    firestoreDocId: 'main_data',
    firestoreLoaded: false,

    async loadData() {
        try {
            // First load from localStorage (fast, offline)
            const storedListings = localStorage.getItem('rea_listings');
            const storedCustomers = localStorage.getItem('rea_customers');
            const storedAppointments = localStorage.getItem('rea_appointments');
            const storedFsbo = localStorage.getItem('rea_fsbo');
            const storedFindings = localStorage.getItem('rea_findings');
            const storedTargets = localStorage.getItem('rea_targets');

            if (storedListings) this.data.listings = JSON.parse(storedListings);
            if (storedCustomers) this.data.customers = JSON.parse(storedCustomers);
            if (storedAppointments) this.data.appointments = JSON.parse(storedAppointments);
            if (storedFsbo) this.data.fsbo = JSON.parse(storedFsbo);
            if (storedFindings) this.data.findings = JSON.parse(storedFindings);
            if (storedTargets) this.data.targets = JSON.parse(storedTargets);

            // Then load from Firestore (cloud sync)
            if (window.db) {
                const doc = await window.db.collection('emlak_data').doc(this.firestoreDocId).get();
                if (doc.exists) {
                    const cloudData = doc.data();
                    console.log("Firestore data loaded:", cloudData);

                    // FSBO Migration: Merge local FSBO with cloud FSBO (preserve old data)
                    const localFsbo = this.data.fsbo || [];
                    const cloudFsbo = cloudData.fsbo || [];
                    const localFsboIds = new Set(localFsbo.map(f => f.id));
                    const cloudFsboIds = new Set(cloudFsbo.map(f => f.id));

                    // Find local items not in cloud (need to be uploaded)
                    const localOnlyFsbo = localFsbo.filter(f => !cloudFsboIds.has(f.id));
                    if (localOnlyFsbo.length > 0) {
                        console.log(`FSBO Migrasyon: ${localOnlyFsbo.length} eski kayıt Firebase'e aktarılacak`);
                        // Merge: cloud data + local-only data
                        this.data.fsbo = [...cloudFsbo, ...localOnlyFsbo];
                        // Trigger save to upload local data to cloud
                        setTimeout(() => this.saveToFirestore(), 2000);
                    } else {
                        this.data.fsbo = cloudFsbo;
                    }

                    // Merge cloud data (cloud takes priority for other data)
                    if (cloudData.listings) this.data.listings = cloudData.listings;
                    if (cloudData.customers) {
                        // Preserve local interactions/matchHistory before overwriting
                        const localCustomers = this.data.customers || [];
                        this.data.customers = cloudData.customers;
                        localCustomers.forEach(local => {
                            const cloud = this.data.customers.find(c => c.id == local.id);
                            if (!cloud) return;
                            if (local.interactions && Object.keys(local.interactions).length > 0) {
                                cloud.interactions = { ...(cloud.interactions || {}), ...local.interactions };
                            }
                            if (local.matchHistory && Object.keys(local.matchHistory).length > 0) {
                                cloud.matchHistory = { ...(cloud.matchHistory || {}), ...local.matchHistory };
                            }
                        });
                    }
                    if (cloudData.appointments) this.data.appointments = cloudData.appointments;
                    if (cloudData.findings) this.data.findings = cloudData.findings;
                    if (cloudData.targets) this.data.targets = cloudData.targets;

                    // Update localStorage with cloud data
                    localStorage.setItem('rea_listings', JSON.stringify(this.data.listings || []));
                    localStorage.setItem('rea_customers', JSON.stringify(this.data.customers || []));
                    localStorage.setItem('rea_appointments', JSON.stringify(this.data.appointments || []));
                    localStorage.setItem('rea_fsbo', JSON.stringify(this.data.fsbo || []));
                    localStorage.setItem('rea_findings', JSON.stringify(this.data.findings || []));
                    localStorage.setItem('rea_targets', JSON.stringify(this.data.targets || []));
                }
                this.firestoreLoaded = true;

                // Setup real-time listener for live sync
                this.setupFirestoreListener();
            }
        } catch (error) {
            console.error('Data loading error:', error);
        }

        // Fotoğrafları IndexedDB'ye taşı (tek seferlik migrasyon)
        try { await this.migratePhotosToIndexedDB(); } catch (e) { console.error('Photo migration error:', e); }

        this.updateStats();
    },

    setupFirestoreListener() {
        if (!window.db) return;

        window.db.collection('emlak_data').doc(this.firestoreDocId).onSnapshot((doc) => {
            if (doc.exists && this.firestoreLoaded) {
                const cloudData = doc.data();
                console.log("Real-time update received");

                // Skip if we just saved (cooldown 3 seconds)
                if (Date.now() - this.lastSaveTime < 3000) return;

                // Only update if data actually changed (compare timestamps)
                const cloudTimestamp = cloudData.lastUpdated || 0;
                const localTimestamp = this.lastSaveTimestamp || 0;

                if (cloudTimestamp > localTimestamp) {
                    // Preserve local interactions/matchHistory
                    const localCustomers = this.data.customers || [];
                    this.data.listings = cloudData.listings || [];
                    this.data.customers = cloudData.customers || [];
                    localCustomers.forEach(local => {
                        const cloud = this.data.customers.find(c => c.id == local.id);
                        if (!cloud) return;
                        if (local.interactions && Object.keys(local.interactions).length > 0) {
                            cloud.interactions = { ...(cloud.interactions || {}), ...local.interactions };
                        }
                        if (local.matchHistory && Object.keys(local.matchHistory).length > 0) {
                            cloud.matchHistory = { ...(cloud.matchHistory || {}), ...local.matchHistory };
                        }
                    });
                    this.data.appointments = cloudData.appointments || [];
                    this.data.fsbo = cloudData.fsbo || [];
                    this.data.findings = cloudData.findings || [];
                    this.data.targets = cloudData.targets || [];

                    // Refresh UI
                    this.renderAll();
                    this.updateStats();
                }
            }
        });
    },

    lastSaveTimestamp: 0,
    lastSaveTime: 0,

    saveData(key) {
        try {
            // Save to localStorage first (fast)
            if (key === 'listings') {
                localStorage.setItem('rea_listings', JSON.stringify(this.data.listings));
            } else if (key === 'customers') {
                localStorage.setItem('rea_customers', JSON.stringify(this.data.customers));
            } else if (key === 'appointments') {
                localStorage.setItem('rea_appointments', JSON.stringify(this.data.appointments));
            } else if (key === 'fsbo') {
                localStorage.setItem('rea_fsbo', JSON.stringify(this.data.fsbo));
            } else if (key === 'findings') {
                localStorage.setItem('rea_findings', JSON.stringify(this.data.findings));
            } else if (key === 'targets') {
                localStorage.setItem('rea_targets', JSON.stringify(this.data.targets));
            }
        } catch (e) {
            console.error("LocalStorage Save Error:", e);
            if (e.name === 'QuotaExceededError' || e.code === 22) {
                alert("⚠️ HATA: Tarayıcı hafızası (localStorage) doldu!\nFotoğraflar kaydedilemedi. Lütfen gereksiz ilanları silin veya daha az fotoğraf ekleyin.");
            }
        }

        // Save to Firestore (cloud sync)
        this.saveToFirestore();

        this.updateStats();
    },

    // Debounced Firestore save to avoid too many writes
    firestoreSaveTimeout: null,

    saveToFirestore(immediate = false) {
        if (!window.db) return;

        clearTimeout(this.firestoreSaveTimeout);

        const performSave = async () => {
            try {
                this.lastSaveTimestamp = Date.now();
                this.lastSaveTime = this.lastSaveTimestamp;
                await window.db.collection('emlak_data').doc(this.firestoreDocId).set({
                    listings: this.data.listings || [],
                    customers: this.data.customers || [],
                    appointments: this.data.appointments || [],
                    fsbo: this.data.fsbo || [],
                    fsbo: this.data.fsbo || [],
                    findings: this.data.findings || [],
                    targets: this.data.targets || [],
                    lastUpdated: this.lastSaveTimestamp
                });
                console.log("Firestore saved successfully");
            } catch (error) {
                console.error("Firestore save error:", error);
            }
        };

        if (immediate) {
            performSave();
        } else {
            this.firestoreSaveTimeout = setTimeout(performSave, 1000);
        }
    },

    debugDistricts() {
        if (!this.adanaLocations) {
            alert("HATA: Adana verisi (adanaLocations) BULUNAMADI! (Undefined)");
            return;
        }
        const keys = Object.keys(this.adanaLocations);
        alert(`DURUM RAPORU:\n\nBulunan İlçe Sayısı: ${keys.length}\nİlçeler: ${keys.join(', ')}\n\nEğer bu mesajı görüyorsanız veri var demektir. Liste yine de boşsa çizim hatasıdır.`);
    },

    // ... (Navigation and Modals unchanged)



    populateDistricts() {
        // Static HTML used for reliability
        // console.log("Districts are statically defined in HTML.");
    },

    // --- NAVIGATION ---
    setView(targetId) {
        if (!targetId) return;

        const navItems = document.querySelectorAll('.nav-item');
        const views = document.querySelectorAll('.view');
        const pageTitle = document.getElementById('page-title');

        // Update Nav Active State
        navItems.forEach(n => {
            n.classList.remove('active');
            if (n.getAttribute('data-target') === targetId) {
                n.classList.add('active');
            }
        });

        views.forEach(v => v.classList.remove('active'));

        // Handle virtual views (owners reuses crm)
        let viewId = targetId;
        if (targetId === 'owners') {
            viewId = 'crm';
        }

        const viewEl = document.getElementById(viewId);
        if (viewEl) {
            viewEl.classList.add('active');
        }

        // Update Title
        const titles = {
            'dashboard': 'Genel Bakış',
            'listings': 'Portföy Yönetimi',
            'crm': 'Müşteri Listesi',
            'owners': 'Mülk Sahipleri',
            'calendar': 'Ajanda',
            'fsbo': 'FSBO Listesi',
            'targets': 'Patlatılacak İlanlar (Hedefler)',
            'map': 'Harita Görünümü',
            'findings': 'Bulumlar'
        };
        if (pageTitle) pageTitle.textContent = titles[targetId] || 'GündüzGünhar';

        // Re-render specific views to ensure freshness
        if (targetId === 'crm') {
            this.crmFilter = null; // Clear filter for main list
            this.renderCustomers();
        } else if (targetId === 'owners') {
            this.crmFilter = 'seller';
            this.renderCustomers();
        } else if (targetId === 'listings') {
            this.renderListings();
        } else if (targetId === 'calendar') {
            this.renderAppointments();
        } else if (targetId === 'fsbo') {
            this.renderFsboList();
        } else if (targetId === 'targets') {
            this.renderTargetListings();
        } else if (targetId === 'map') {
            this.initMap(); // Initialize map if not already
            this.renderMapPins(); // Ensure pins are fresh
            // Trigger map resize
            setTimeout(() => {
                if (this.map) this.map.invalidateSize();
            }, 200);
        } else if (targetId === 'findings') {
            this.renderFindings();
        }
    },

    setupNavigation() {
        const navItems = document.querySelectorAll('.nav-item');
        navItems.forEach(item => {
            item.addEventListener('click', () => {
                const targetId = item.getAttribute('data-target');
                if (targetId) {
                    this.setView(targetId);
                }
            });
        });
    },

    // --- MODALS ---
    modals: {
        open(id) {
            const modal = document.getElementById(`modal-${id}`);

            if (!modal) {
                console.error('Modal not found: modal-' + id);
                return;
            }
            if (modal) {
                modal.classList.add('active');

                // Force visibility and high z-index
                modal.style.display = 'flex';
                modal.style.zIndex = '99999';
                modal.style.opacity = '1';
                modal.style.visibility = 'visible';

                // Auto-populate districts when opening relevant modals to ensure data is fresh

                // Auto-populate districts when opening relevant modals to ensure data is fresh
                if (id === 'add-listing' || id === 'add-customer' || id === 'edit-customer') {
                    try {
                        if (app && app.populateDistricts) {
                            app.populateDistricts();
                        }
                    } catch (e) {
                        console.error("populateDistricts failed", e);
                    }
                }
            }
        },
        closeAll() {
            document.querySelectorAll('.modal-overlay').forEach(el => {
                el.classList.remove('active');
                el.style.display = '';
                el.style.zIndex = '';
                el.style.opacity = '';
                el.style.visibility = '';
            });
        }
    },

    setupModals() {
        // Close buttons
        document.querySelectorAll('.close-modal').forEach(btn => {
            btn.addEventListener('click', () => this.modals.closeAll());
        });

        // Close on outside click
        document.querySelectorAll('.modal-overlay').forEach(overlay => {
            overlay.addEventListener('click', (e) => {
                if (e.target === overlay) this.modals.closeAll();
            });
        });

        // Quick Add Button logic
        document.getElementById('quick-add-btn').addEventListener('click', () => {
            // For now, default to adding a listing
            this.modals.open('add-listing');
        });
    },

    // --- FORMS ---
    // --- HELPERS ---
    async fetchCoordinates(addressQueries) {
        if (!Array.isArray(addressQueries)) addressQueries = [addressQueries];

        for (const query of addressQueries) {
            try {
                // console.log("Geocoding trying:", query);
                const response = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}`);
                const data = await response.json();
                if (data && data.length > 0) {
                    return { lat: parseFloat(data[0].lat), lng: parseFloat(data[0].lon) };
                }
            } catch (error) {
                console.error("Geocoding failed for:", query, error);
            }
        }
        return null; // All attempts failed
    },

    setupForms() {
        // Add Listing Form
        const formAddListing = document.getElementById('form-add-listing');
        if (formAddListing) {
            formAddListing.addEventListener('submit', (e) => {
                e.preventDefault();
                app.addListing(new FormData(e.target));
            });
        }

        // Format budget input
        const budgetInput = document.querySelectorAll('input[name="budget"]');
        budgetInput.forEach(input => {
            input.addEventListener('input', (e) => {
                let value = e.target.value.replace(/\D/g, '');
                if (value) value = parseInt(value).toLocaleString('tr-TR');
                e.target.value = value;
            });
        });

        // Add Customer Form - logic moved to addNewCustomer()
        const formAddCustomer = document.getElementById('form-add-customer');
        if (formAddCustomer) {
            formAddCustomer.addEventListener('submit', (e) => {
                e.preventDefault();
                app.addNewCustomer();
            });
        }

        // Edit Customer Form
        const formEditCustomer = document.getElementById('form-edit-customer');
        if (formEditCustomer) {
            formEditCustomer.addEventListener('submit', (e) => {
                e.preventDefault();
                const formData = new FormData(e.target);
                const id = parseInt(formData.get('id'));

                const index = this.data.customers.findIndex(c => c.id === id);
                if (index === -1) return;

                let finalRegions = this.currentEditRegions.join(' | ');
                if (!finalRegions) {
                    const district = document.getElementById('edit-customer-district').value;
                    const neighborhood = document.getElementById('edit-customer-neighborhood').value;
                    if (district && neighborhood) finalRegions = `${district}, ${neighborhood}`;
                }

                const budgetRaw = formData.get('budget').replace(/\./g, '');

                const updatedCustomer = {
                    ...this.data.customers[index],
                    name: formData.get('name'),
                    phone: formData.get('phone'),
                    budget: budgetRaw,
                    region: finalRegions,
                    room_pref: Array.from(document.querySelectorAll('#edit-room-pref-group input[name="edit_room_pref_cb"]:checked')).map(cb => cb.value).join(', '),
                    kitchen_pref: formData.get('kitchen_pref'),
                    max_building_age: formData.get('max_building_age'),
                    damage_pref: formData.get('damage_pref'),
                    site_pref: formData.get('site_pref'),
                    type: formData.get('type'),
                    notes: formData.get('notes')
                };

                this.data.customers[index] = updatedCustomer;
                this.saveData('customers');
                this.renderCustomers();
                this.modals.closeAll();
            });
        }

        // Edit Listing Form
        const formEditListing = document.getElementById('form-edit-listing');
        if (formEditListing) {
            formEditListing.addEventListener('submit', (e) => {
                e.preventDefault();
                alert("DEBUG: Edit form submit triggered!");
                const formData = new FormData(e.target);
                const id = parseInt(formData.get('id'));
                alert("DEBUG: ID = " + id + ", Street = " + formData.get('street'));

                const index = this.data.listings.findIndex(l => l.id === id);
                if (index === -1) {
                    alert("İlan bulunamadı!");
                    return;
                }

                const district = document.getElementById('edit-listing-district').value;
                const neighborhood = document.getElementById('edit-listing-neighborhood').value;
                const location = `${neighborhood}, ${district}, Adana`;

                const updatedListing = {
                    ...this.data.listings[index],
                    title: formData.get('title'),
                    price: formData.get('price').replace(/\./g, ''),
                    location: location,
                    street: formData.get('street') || '',
                    type: formData.get('type'),
                    status: formData.get('status'),
                    rooms: formData.get('rooms'),
                    kitchen: formData.get('kitchen'),
                    floor_current: formData.get('floor_current'),
                    floor_total: formData.get('floor_total'),
                    size_gross: formData.get('size_gross'),
                    size_net: formData.get('size_net'),
                    building_age: formData.get('building_age'),
                    damage: formData.get('damage'),
                    interior_condition: formData.get('interior_condition'),
                    facade: formData.get('facade'),
                    deed_status: formData.get('deed_status'),
                    site_features: formData.get('site_features'),
                    owner_name: formData.get('owner_name'),
                    owner_phone: formData.get('owner_phone'),
                    description: formData.get('description'),
                    external_link: formData.get('external_link')
                };

                this.data.listings[index] = updatedListing;
                this.saveData('listings');
                this.renderListings();
                this.updateStats();
                this.modals.closeAll();
            });
        }

        // District Change Listeners
        const listingDistrict = document.getElementById('listing-district');
        if (listingDistrict) {
            listingDistrict.addEventListener('change', () => this.onListingDistrictChange());
        }

        // Edit Listing District Change
        const editListingDistrict = document.getElementById('edit-listing-district');
        if (editListingDistrict) {
            editListingDistrict.addEventListener('change', () => this.onEditListingDistrictChange());
        }

        // Add Appointment Form
        const formAddAppointment = document.getElementById('form-add-appointment');
        if (formAddAppointment) {
            formAddAppointment.addEventListener('submit', (e) => {
                e.preventDefault();
                const formData = new FormData(e.target);
                const newAppointment = {
                    id: Date.now(),
                    title: formData.get('title'),
                    date: formData.get('date'),
                    time: formData.get('time'),
                    notes: formData.get('notes')
                };

                this.data.appointments.push(newAppointment);
                this.data.appointments.sort((a, b) => new Date(a.date + ' ' + a.time) - new Date(b.date + ' ' + b.time));
                this.saveData('appointments');
                this.renderAppointments();
                this.modals.closeAll();
                e.target.reset();
            });
        }

        // Add FSBO Form
        const formAddFsbo = document.getElementById('form-add-fsbo');
        if (formAddFsbo) {
            formAddFsbo.addEventListener('submit', (e) => {
                e.preventDefault();
                app.addFsbo(new FormData(e.target));
            });
        }
    },

    // --- RENDERING ---
    renderAll() {
        this.renderListings();
        this.renderCustomers();
        this.renderAppointments();
        this.renderFindings();
        if (typeof this.renderFsboList === 'function') this.renderFsboList();
        this.updateStats();
        // Map is rendered when tab is activated
    },

    // --- MAP LOGIC ---
    map: null,

    initMap() {
        if (this.map) return; // Already initialized

        // Set default view to Adana (approx)
        this.map = L.map('map-container').setView([37.0000, 35.3213], 13);

        // Define Layers

        // Define Google Maps Layers

        // 1. Google Streets
        const googleStreets = L.tileLayer('http://{s}.google.com/vt/lyrs=m&x={x}&y={y}&z={z}', {
            maxZoom: 20,
            subdomains: ['mt0', 'mt1', 'mt2', 'mt3']
        });

        // 2. Google Hybrid (Satellite + Labels)
        const googleHybrid = L.tileLayer('http://{s}.google.com/vt/lyrs=s,h&x={x}&y={y}&z={z}', {
            maxZoom: 20,
            subdomains: ['mt0', 'mt1', 'mt2', 'mt3']
        });

        // 3. Google Satellite
        const googleSat = L.tileLayer('http://{s}.google.com/vt/lyrs=s&x={x}&y={y}&z={z}', {
            maxZoom: 20,
            subdomains: ['mt0', 'mt1', 'mt2', 'mt3']
        });

        // 4. Google Terrain
        const googleTerrain = L.tileLayer('http://{s}.google.com/vt/lyrs=p&x={x}&y={y}&z={z}', {
            maxZoom: 20,
            subdomains: ['mt0', 'mt1', 'mt2', 'mt3']
        });

        // Add default layer
        googleStreets.addTo(this.map);

        // Add Layer Control
        const baseMaps = {
            "Google Sokak (Varsayılan)": googleStreets,
            "Google Hibrit (Uydu+Yol)": googleHybrid,
            "Google Uydu": googleSat,
            "Google Arazi": googleTerrain
        };

        L.control.layers(baseMaps).addTo(this.map);

        setTimeout(() => {
            this.map.invalidateSize();
            this.renderMapPins();
        }, 200);
    },



    populateDistricts() {
        // Map Filters
        const mapDistrictSelect = document.getElementById('map-filter-district');
        // Customer Form
        const custDistrictSelect = document.getElementById('customer-district');
        // Edit Customer Form
        const editCustDistrictSelect = document.getElementById('edit-customer-district');

        const districts = Object.keys(this.adanaLocations);

        // Helper to populate
        const populate = (select) => {
            if (!select) return;
            select.innerHTML = '<option value="">İlçe Seçiniz</option>';
            districts.forEach(dist => {
                const option = document.createElement('option');
                option.value = dist;
                option.textContent = dist;
                select.appendChild(option);
            });
        };

        populate(mapDistrictSelect);
        populate(custDistrictSelect);
        populate(editCustDistrictSelect);
    },

    // --- EDIT CUSTOMER LOGIC ---
    currentEditRegions: [],

    onEditCustomerDistrictChange() {
        const districtName = document.getElementById('edit-customer-district').value;
        const neighborhoodSelect = document.getElementById('edit-customer-neighborhood');

        neighborhoodSelect.innerHTML = '<option value="">Mahalle Seçiniz</option>';

        if (!districtName || !this.adanaLocations[districtName]) return;

        const distData = this.adanaLocations[districtName];

        Object.keys(distData.neighborhoods).forEach(neigh => {
            const option = document.createElement('option');
            option.value = neigh;
            option.textContent = neigh;
            neighborhoodSelect.appendChild(option);
        });
    },

    addRegionToEdit() {
        const districtSelect = document.getElementById('edit-customer-district');
        const neighborhoodSelect = document.getElementById('edit-customer-neighborhood');

        const district = districtSelect.value;
        const neighborhood = neighborhoodSelect.value;

        if (!district || !neighborhood) {
            alert('Lütfen hem ilçe hem de mahalle seçiniz.');
            return;
        }

        const regionStr = `${district}, ${neighborhood}`;
        if (this.currentEditRegions.includes(regionStr)) return;

        this.currentEditRegions.push(regionStr);
        this.renderEditSelectedRegions();

        districtSelect.value = "";
        neighborhoodSelect.innerHTML = '<option value="">Önce İlçe Seçin</option>';
    },

    removeRegionFromEdit(index) {
        this.currentEditRegions.splice(index, 1);
        this.renderEditSelectedRegions();
    },

    renderEditSelectedRegions() {
        const container = document.getElementById('edit-selected-regions');
        container.innerHTML = this.currentEditRegions.map((reg, idx) => `
                        <div class="region-tag">
                            <span>${reg}</span>
                            <i class="ph ph-x" onclick="app.removeRegionFromEdit(${idx})"></i>
                        </div>
                    `).join('');

        // Update hidden input
        document.getElementById('edit-customer-region-input').value = this.currentEditRegions.join(' | ');
    },

    editCustomer(id) {
        console.log("Editing customer:", id);
        const customer = this.data.customers.find(c => c.id === id);
        if (!customer) {
            alert("Müşteri bulunamadı!");
            return;
        }

        try {
            const form = document.getElementById('form-edit-customer');
            if (!form) {
                console.error("Edit form not found");
                return;
            }

            form.elements['id'].value = customer.id;
            form.elements['name'].value = customer.name;
            form.elements['phone'].value = customer.phone;
            // Format budget for display
            if (form.elements['budget']) {
                form.elements['budget'].value = customer.budget ? parseInt(customer.budget).toLocaleString('tr-TR') : "";
            }
            // Oda tercihi checkbox'larını doldur
            const editRoomGroup = document.getElementById('edit-room-pref-group');
            if (editRoomGroup) {
                editRoomGroup.querySelectorAll('input[type="checkbox"]').forEach(cb => cb.checked = false);
                if (customer.room_pref) {
                    const selectedRooms = customer.room_pref.split(',').map(r => r.trim());
                    editRoomGroup.querySelectorAll('input[type="checkbox"]').forEach(cb => {
                        if (selectedRooms.includes(cb.value)) cb.checked = true;
                    });
                }
            }
            if (form.elements['facade']) form.elements['facade'].value = customer.facade || ""; // NEW
            if (form.elements['deed_status']) form.elements['deed_status'].value = customer.deed_status || ""; // NEW
            if (form.elements['kitchen_pref']) form.elements['kitchen_pref'].value = customer.kitchen_pref || "";
            form.elements['type'].value = customer.type;
            form.elements['notes'].value = customer.notes || "";

            // Populate Regions
            this.currentEditRegions = customer.region ? String(customer.region).split(' | ').filter(r => r.trim() !== '') : [];
            this.renderEditSelectedRegions();

            this.modals.open('edit-customer');
        } catch (e) {
            console.error("Error opening edit modal:", e);
            alert("Düzenleme penceresi açılırken bir hata oluştu.");
        }
    },

    openCustomerEditPopup(customerId) {
        const customer = this.data.customers.find(c => c.id == customerId);
        if (!customer) {
            alert("Müşteri bulunamadı!");
            return;
        }

        // Create popup HTML
        const popup = document.createElement('div');
        popup.id = 'customer-edit-popup';
        popup.innerHTML = `
            <div style="position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0,0,0,0.5); z-index: 9999; display: flex; align-items: center; justify-content: center;" onclick="if(event.target === this) this.remove();">
                <div style="background: white; border-radius: 12px; padding: 24px; width: 90%; max-width: 400px; max-height: 90vh; overflow-y: auto;" onclick="event.stopPropagation();">
                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px;">
                        <h3 style="margin: 0; font-size: 18px;">Müşteri Düzenle</h3>
                        <button onclick="document.getElementById('customer-edit-popup').remove()" style="background: none; border: none; font-size: 24px; cursor: pointer; color: #6b7280;">&times;</button>
                    </div>
                    <form id="customer-edit-form" style="display: flex; flex-direction: column; gap: 12px;">
                        <div>
                            <label style="font-size: 12px; color: #6b7280; display: block; margin-bottom: 4px;">İsim</label>
                            <input type="text" name="name" value="${customer.name || ''}" style="width: 100%; padding: 10px; border: 1px solid #e5e7eb; border-radius: 8px; font-size: 14px;" required>
                        </div>
                        <div>
                            <label style="font-size: 12px; color: #6b7280; display: block; margin-bottom: 4px;">Telefon</label>
                            <input type="tel" name="phone" value="${customer.phone || ''}" style="width: 100%; padding: 10px; border: 1px solid #e5e7eb; border-radius: 8px; font-size: 14px;">
                        </div>
                        <div>
                            <label style="font-size: 12px; color: #6b7280; display: block; margin-bottom: 4px;">Bütçe (TL)</label>
                            <input type="text" name="budget" value="${customer.budget || ''}" style="width: 100%; padding: 10px; border: 1px solid #e5e7eb; border-radius: 8px; font-size: 14px;" oninput="app.formatPriceInput(this)">
                        </div>
                        <div>
                            <label style="font-size: 12px; color: #6b7280; display: block; margin-bottom: 4px;">Öncelik</label>
                            <select name="priority" style="width: 100%; padding: 10px; border: 1px solid #e5e7eb; border-radius: 8px; font-size: 14px;">
                                <option value="" ${!customer.priority ? 'selected' : ''}>Seçiniz</option>
                                <option value="yüksek" ${customer.priority === 'yüksek' ? 'selected' : ''}>🔴 Acil (Yüksek)</option>
                                <option value="orta" ${customer.priority === 'orta' ? 'selected' : ''}>🟡 Orta</option>
                                <option value="düşük" ${customer.priority === 'düşük' ? 'selected' : ''}>🟢 Normal (Düşük)</option>
                            </select>
                        </div>
                        <div>
                            <label style="font-size: 12px; color: #6b7280; display: block; margin-bottom: 4px;">Oda Tercihi</label>
                            <select name="room_pref" style="width: 100%; padding: 10px; border: 1px solid #e5e7eb; border-radius: 8px; font-size: 14px;">
                                <option value="">Farketmez</option>
                                <option value="1+1" ${customer.room_pref === '1+1' ? 'selected' : ''}>1+1</option>
                                <option value="2+1" ${customer.room_pref === '2+1' ? 'selected' : ''}>2+1</option>
                                <option value="3+1" ${customer.room_pref === '3+1' ? 'selected' : ''}>3+1</option>
                                <option value="4+1" ${customer.room_pref === '4+1' ? 'selected' : ''}>4+1</option>
                            </select>
                        </div>
                        <div style="display: flex; gap: 10px; margin-top: 10px;">
                            <button type="button" onclick="document.getElementById('customer-edit-popup').remove()" style="flex: 1; padding: 12px; border: 1px solid #e5e7eb; background: white; border-radius: 8px; cursor: pointer;">İptal</button>
                            <button type="submit" style="flex: 1; padding: 12px; background: #4f46e5; color: white; border: none; border-radius: 8px; cursor: pointer; font-weight: 500;">Kaydet</button>
                        </div>
                    </form>
                </div>
            </div>
        `;
        document.body.appendChild(popup);

        // Handle form submission
        document.getElementById('customer-edit-form').onsubmit = (e) => {
            e.preventDefault();
            const formData = new FormData(e.target);
            customer.name = formData.get('name');
            customer.phone = formData.get('phone');
            customer.budget = formData.get('budget').replace(/\./g, '');
            customer.priority = formData.get('priority');
            customer.room_pref = formData.get('room_pref');

            this.saveData('customers');
            this.renderCustomers();
            document.getElementById('customer-edit-popup').remove();
        };
    },

    deleteCustomer(id) {
        if (!confirm("Bu müşteriyi silmek istediğinize emin misiniz?")) return;

        // Loose equality (==) to handle both string and number IDs
        const index = this.data.customers.findIndex(c => c.id == id);

        if (index === -1) {
            console.error("Müşteri bulunamadı:", id, this.data.customers);
            alert("Hata: Müşteri bulunamadı. Sayfayı yenileyip tekrar deneyin.");
            return;
        }

        this.data.customers.splice(index, 1);
        this.saveData('customers');
        this.renderCustomers();
        this.updateStats(); // Update dashboard stats too
    },

    onDistrictChange() {
        const districtName = document.getElementById('map-filter-district').value;
        const neighborhoodSelect = document.getElementById('map-filter-neighborhood');

        // Reset Neighborhoods
        neighborhoodSelect.innerHTML = '<option value="">Mahalle Seçiniz</option>';

        if (!districtName || !this.adanaLocations[districtName]) return;

        // Pan to District
        const distData = this.adanaLocations[districtName];
        this.map.setView([distData.lat, distData.lng], 13);

        // Populate Neighborhoods
        Object.keys(distData.neighborhoods).forEach(neigh => {
            const option = document.createElement('option');
            option.value = neigh;
            option.textContent = neigh;
            neighborhoodSelect.appendChild(option);
        });
    },

    // --- CUSTOMER REGION LOGIC ---
    currentCustomerRegions: [],

    onCustomerDistrictChange() {
        const districtName = document.getElementById('customer-district').value;
        const neighborhoodSelect = document.getElementById('customer-neighborhood');

        neighborhoodSelect.innerHTML = '<option value="">Mahalle Seçiniz</option>';

        if (!districtName || !this.adanaLocations[districtName]) return;

        const distData = this.adanaLocations[districtName];

        Object.keys(distData.neighborhoods).forEach(neigh => {
            const option = document.createElement('option');
            option.value = neigh;
            option.textContent = neigh;
            neighborhoodSelect.appendChild(option);
        });
    },

    addRegion() {
        const districtSelect = document.getElementById('customer-district');
        const neighborhoodSelect = document.getElementById('customer-neighborhood');

        const district = districtSelect.value;
        const neighborhood = neighborhoodSelect.value;

        if (!district || !neighborhood) {
            alert('Lütfen hem ilçe hem de mahalle seçiniz.');
            return;
        }

        const regionStr = `${district}, ${neighborhood}`;

        // Prevent duplicates
        if (this.currentCustomerRegions.includes(regionStr)) {
            return;
        }

        this.currentCustomerRegions.push(regionStr);
        this.renderSelectedRegions();

        // Reset selection
        districtSelect.value = "";
        neighborhoodSelect.innerHTML = '<option value="">Önce İlçe Seçin</option>';
    },

    removeRegion(index) {
        this.currentCustomerRegions.splice(index, 1);
        this.renderSelectedRegions();
    },

    renderSelectedRegions() {
        const container = document.getElementById('selected-regions');
        container.innerHTML = this.currentCustomerRegions.map((reg, idx) => `
                        <div class="region-tag">
                            <span>${reg}</span>
                            <i class="ph ph-x" onclick="app.removeRegion(${idx})"></i>
                        </div>
                    `).join('');

        // Update hidden input
        document.getElementById('customer-region-input').value = this.currentCustomerRegions.join(' | ');
    },

    onListingDistrictChange() {
        const districtName = document.getElementById('listing-district').value;
        const neighborhoodSelect = document.getElementById('listing-neighborhood');

        neighborhoodSelect.innerHTML = '<option value="">Mahalle Seçiniz</option>';

        if (!districtName || !this.adanaLocations[districtName]) return;

        const distData = this.adanaLocations[districtName];

        Object.keys(distData.neighborhoods).forEach(neigh => {
            const option = document.createElement('option');
            option.value = neigh;
            option.textContent = neigh;
            neighborhoodSelect.appendChild(option);
        });
    },

    onNeighborhoodChange() {
        const districtName = document.getElementById('map-filter-district').value;
        const neighborhoodName = document.getElementById('map-filter-neighborhood').value;

        if (districtName && neighborhoodName) {
            const coords = this.adanaLocations[districtName].neighborhoods[neighborhoodName];
            if (coords) {
                this.map.setView(coords, 15);
            }
        }
    },

    renderMapPins() {
        if (!this.map) return;

        // Get Filter Values
        const typeFilter = document.getElementById('map-filter-type').value;
        const roomsFilter = document.getElementById('map-filter-rooms').value;
        const maxPrice = document.getElementById('map-filter-price-max').value;

        // Remove existing layers if any (except tile layer)
        this.map.eachLayer((layer) => {
            if (layer instanceof L.Marker) {
                this.map.removeLayer(layer);
            }
        });

        let hasChanges = false;

        // Filter and Add pins
        this.data.listings.forEach(listing => {
            // Apply Filters
            if (typeFilter !== 'all' && listing.type !== typeFilter) return;
            if (roomsFilter !== 'all' && listing.rooms !== roomsFilter) return;
            if (maxPrice && parseInt(listing.price) > parseInt(maxPrice)) return;

            // Mock coordinates: Generate random near Adana center if not exists
            // OR if it's stuck at the old default error location (approx 37.00, 35.32)
            const isDefaultLoc = listing.lat && Math.abs(listing.lat - 37.0000) < 0.01 && Math.abs(listing.lng - 35.3213) < 0.01;

            if (!listing.lat || isDefaultLoc) {
                let centerLat = 37.0000;
                let centerLng = 35.3213;

                // Try to use District/Neighborhood center
                if (listing.location) {
                    const parts = listing.location.split(',').map(s => s.trim());
                    if (parts.length >= 2) {
                        // Start from end because format is "Neigh, Dist, City" usually
                        // But mostly it is "Neigh, Dist, Adana"
                        // parts[0] is Neigh, parts[1] is Dist
                        const neigh = parts[0];
                        const dist = parts[1];

                        if (this.adanaLocations[dist] && this.adanaLocations[dist].neighborhoods[neigh]) {
                            [centerLat, centerLng] = this.adanaLocations[dist].neighborhoods[neigh];
                        } else if (this.adanaLocations[dist]) {
                            centerLat = this.adanaLocations[dist].lat;
                            centerLng = this.adanaLocations[dist].lng;
                        }
                    }
                }

                // Random offset 
                listing.lat = centerLat + (Math.random() - 0.5) * 0.005;
                listing.lng = centerLng + (Math.random() - 0.5) * 0.005;

                // Auto-save the fix
                if (isDefaultLoc || !listing.lat) {
                    this.saveData('listings');
                }

                hasChanges = true;
            }

            // Custom Icon - different style for locked pins
            const isLocked = listing.pinLocked === true;
            const customIcon = L.divIcon({
                className: `custom-map-pin ${isLocked ? 'pin-locked' : ''}`,
                html: `<i class="ph ph-house-line"></i>${isLocked ? '<i class="ph ph-lock-simple" style="position:absolute; bottom:-2px; right:-2px; font-size:12px; color:#16a34a; background:white; border-radius:50%; padding:1px;"></i>' : ''}`,
                iconSize: [48, 48],
                iconAnchor: [24, 24],
                popupAnchor: [0, -28]
            });

            const marker = L.marker([listing.lat, listing.lng], {
                draggable: !isLocked, // Only draggable if NOT locked
                icon: customIcon
            }).addTo(this.map);

            // Save new position on drag end
            marker.on('dragend', (event) => {
                const newPos = event.target.getLatLng();
                listing.lat = newPos.lat;
                listing.lng = newPos.lng;
                this.saveData('listings');
                console.log(`Updated location for ${listing.title}:`, newPos);
            });

            // Show Boundary on Click if available
            if (listing.boundary) {
                let boundaryLayer;
                marker.on('popupopen', () => {
                    if (boundaryLayer) this.map.removeLayer(boundaryLayer);
                    boundaryLayer = L.geoJSON(listing.boundary, {
                        style: { color: '#EF4444', weight: 2, fillOpacity: 0.1 }
                    }).addTo(this.map);
                });
                marker.on('popupclose', () => {
                    if (boundaryLayer) this.map.removeLayer(boundaryLayer);
                });
            }

            // Popover content with lock/unlock button
            const lockBtnHtml = isLocked
                ? `<button class="btn btn-secondary" onclick="app.togglePinLock(${listing.id})" style="width: 42px; padding: 0; display: flex; align-items: center; justify-content: center; margin-left: 5px; color: #16a34a; background: #dcfce7; border-color: #bbf7d0;" title="Kilidi Aç"><i class="ph ph-lock-simple-open"></i></button>`
                : `<button class="btn btn-secondary" onclick="app.togglePinLock(${listing.id})" style="width: 42px; padding: 0; display: flex; align-items: center; justify-content: center; margin-left: 5px; color: #d97706; background: #fef3c7; border-color: #fde68a;" title="Konumu Kilitle"><i class="ph ph-lock-simple"></i></button>`;

            const dragHintHtml = isLocked
                ? `<div style="font-size:11px; color:#16a34a; margin-top:2px; font-style:italic;">
                    <i class="ph ph-lock-simple"></i> Konum kilitli
                   </div>`
                : `<div style="font-size:11px; color:#F59E0B; margin-top:2px; font-style:italic;">
                    <i class="ph ph-hand-grabbing"></i> Konumu düzeltmek için pini sürükleyin
                   </div>`;

            const popupContent = `
                            <div style="min-width: 150px">
                                <strong>${listing.title}</strong><br>
                                <span style="font-size:12px; color:#666">${listing.location || 'Konum Yok'}${listing.street ? '<br>' + listing.street : ''}</span><br>
                                <span style="font-size:12px; color:#666">${listing.rooms} | ${listing.size_net ? listing.size_net : listing.size_gross}m²</span><br>
                                <span style="color:var(--primary); font-weight:bold">${parseInt(listing.price).toLocaleString('tr-TR')} TL</span><br>
                                ${dragHintHtml}
                            <div class="listing-actions">
                                <button class="btn btn-primary btn-block" onclick="app.openGallery(${listing.id})">İncele</button>
                                ${lockBtnHtml}
                                <button class="btn btn-secondary" onclick="app.evaluateListing(${listing.id})" style="width: 42px; padding: 0; display: flex; align-items: center; justify-content: center; margin-left: 5px; color: #7C3AED; background: #EDE9FE; border-color: #DDD6FE;" title="Gemini Değerleme"><i class="ph ph-sparkle"></i></button>
                                <button class="btn btn-secondary" onclick="app.openEditListingModal(${listing.id})" style="width: 42px; padding: 0; display: flex; align-items: center; justify-content: center; margin-left: 5px;"><i class="ph ph-pencil-simple"></i></button>
                                <button class="btn btn-secondary" onclick="app.deleteListing(${listing.id})" style="width: 42px; padding: 0; display: flex; align-items: center; justify-content: center; margin-left: 5px; color: #DC2626; background: #FEF2F2; border-color: #FECACA;"><i class="ph ph-trash"></i></button>
                                ${listing.external_link && listing.status === 'active' ? `<a href="${listing.external_link}" target="_blank" class="btn btn-secondary" style="width: 42px; padding: 0; display: flex; align-items: center; justify-content: center; margin-left: 5px;" title="İlana Git"><i class="ph ph-link"></i></a>` : ''}
                            </div>
                        </div>`;

            marker.bindPopup(popupContent);
        });

        // Persist generated coordinates so they don't jump around
        if (hasChanges) {
            this.saveData('listings');
        }
    },

    // Toggle pin lock for a listing
    togglePinLock(listingId) {
        const listing = this.data.listings.find(l => l.id === listingId);
        if (!listing) return;

        listing.pinLocked = !listing.pinLocked;
        this.saveData('listings');

        // Close any open popup and re-render pins
        this.map.closePopup();
        this.renderMapPins();

        // Show feedback
        const msg = listing.pinLocked ? 'Konum kilitlendi!' : 'Kilit açıldı, artık sürükleyebilirsiniz.';
        console.log(msg);
    },

    // --- GALLERY LOGIC ---
    currentGalleryImages: [],
    currentImageIndex: 0,

    openGallery(listingOrId) {
        let listing;
        if (typeof listingOrId === 'object') {
            listing = listingOrId;
        } else {
            // Use == to allow string/number mismatch from HTML attributes
            listing = this.data.listings.find(l => l.id == listingOrId);
        }
        if (!listing) {
            console.error("Gallery: Listing not found for id", listingOrId);
            return;
        }

        // Mock Images using Unsplash
        this.currentGalleryImages = [
            `https://source.unsplash.com/random/800x600/?house,${listing.id},1`,
            `https://source.unsplash.com/random/800x600/?living-room,${listing.id},2`,
            `https://source.unsplash.com/random/800x600/?kitchen,${listing.id},3`,
            `https://source.unsplash.com/random/800x600/?bedroom,${listing.id},4`
        ];

        this.currentImageIndex = 0;
        this.updateGalleryView(listing.title);

        // Populate Details
        const detailsContainer = document.getElementById('gallery-listing-details');
        if (detailsContainer) {
            detailsContainer.innerHTML = `
                            <div><span style="color:#666;">Fiyat:</span> <b>${parseInt(listing.price).toLocaleString('tr-TR')} TL</b></div>
                            <div><span style="color:#666;">Konum:</span> <b>${listing.location}</b></div>
                            <div><span style="color:#666;">Oda:</span> <b>${listing.rooms}</b></div>
                            <div><span style="color:#666;">Brüt m²:</span> <b>${listing.size_gross}m²</b></div>
                            <div><span style="color:#666;">Net m²:</span> <b>${listing.size_net}m²</b></div>
                            <div><span style="color:#666;">Kat:</span> <b>${listing.floor_current} / ${listing.floor_total}</b></div>
                            <div><span style="color:#666;">Bina Yaşı:</span> <b>${listing.building_age || '-'}</b></div>
                            <div><span style="color:#666;">Isıtma:</span> <b>${listing.heating || '-'}</b></div>
                            <div><span style="color:#666;">Cephe:</span> <b>${listing.facade || '-'}</b></div>
                            <div><span style="color:#666;">Tapu:</span> <b style="color:#6366f1">${listing.deed_status || '-'}</b></div>
                        `;
        }

        this.modals.open('gallery');
    },

    updateGalleryView(title) {
        if (title) document.getElementById('gallery-title').textContent = title;

        const imgElement = document.getElementById('gallery-image');
        imgElement.src = this.currentGalleryImages[this.currentImageIndex];

        // Update thumbnails
        const thumbContainer = document.getElementById('gallery-thumbnails');
        thumbContainer.innerHTML = this.currentGalleryImages.map((src, idx) => `
                        <img src="${src}" class="gallery-thumb ${idx === this.currentImageIndex ? 'active' : ''}" onclick="app.switchImage(${idx})">
                    `).join('');
    },

    switchImage(index) {
        this.currentImageIndex = index;
        this.updateGalleryView();
    },

    nextImage() {
        this.currentImageIndex = (this.currentImageIndex + 1) % this.currentGalleryImages.length;
        this.updateGalleryView();
    },

    prevImage() {
        this.currentImageIndex = (this.currentImageIndex - 1 + this.currentGalleryImages.length) % this.currentGalleryImages.length;
        this.updateGalleryView();
    },

    setupGalleryButtons() {
        document.querySelector('.slider-nav.next').addEventListener('click', () => this.nextImage());
        document.querySelector('.slider-nav.prev').addEventListener('click', () => this.prevImage());
    },

    findMatches(customerId) {
        console.log("App finding matches for:", customerId);
        const customer = this.data.customers.find(c => c.id === customerId);
        if (!customer) {
            console.error("Customer not found:", customerId);
            alert("Müşteri bulunamadı!");
            return;
        }

        try {
            // Parse customer regions
            const knownDistricts = ['seyhan', 'çukurova', 'yüreğir', 'sarıçam', 'adana'];
            let regions = [];
            if (customer.region) {
                regions = customer.region.split(/[,|]/)
                    .map(r => r.trim())
                    .filter(r => r.length > 0)
                    .filter(r => !knownDistricts.includes(r.toLocaleLowerCase('tr-TR')));
            }

            // --- SHARED MATCHER ---
            const checkCriteria = (item, isFsbo = false) => {
                // 0. Status Check
                if (isFsbo) {
                    // For FSBO, exclude 'Olumsuz' or 'Satıldı' logic if you had it.
                    // For now, include everything except explicitly negative ones if needed.
                    // Let's just include all available FSBOs.
                } else {
                    if (item.status === 'passive' || item.status === 'sold') return false;
                }

                // 1. Region Match
                let regionMatch = false;
                if (regions.length === 0) {
                    regionMatch = true;
                } else {
                    let neighborhood = "";
                    if (isFsbo) {
                        neighborhood = (item.neighborhood || "").toLocaleLowerCase('tr-TR');
                        // Fallback to searching inside district if neighborhood missing?
                        // Or searching inside text/notes? For now strictly field based.
                    } else {
                        const locParts = (item.location || "").split(',').map(p => p.trim());
                        neighborhood = locParts[0] ? locParts[0].toLocaleLowerCase('tr-TR') : '';
                    }

                    regionMatch = regions.some(r => {
                        const rLower = r.toLocaleLowerCase('tr-TR');
                        return neighborhood.includes(rLower) || rLower.includes(neighborhood);
                    });
                }

                // 2. Room Match
                let roomMatch = true;
                if (customer.room_pref && customer.room_pref !== "") {
                    const itemRooms = (item.rooms || "").toLocaleLowerCase('tr-TR').replace(/\s/g, '');
                    const customerRoomPrefs = customer.room_pref.split(',').map(r => r.trim().toLocaleLowerCase('tr-TR').replace(/\s/g, ''));

                    if (itemRooms === "") roomMatch = false;
                    else roomMatch = customerRoomPrefs.some(pref => itemRooms.includes(pref) || pref.includes(itemRooms));
                }

                // 3. Kitchen Match (Listings Only usually)
                let kitchenMatch = true;
                if (!isFsbo && customer.kitchen_pref && customer.kitchen_pref !== "") {
                    const listingKitchen = (item.kitchen || "").toLocaleLowerCase('tr-TR');
                    const customerKitchen = customer.kitchen_pref.toLocaleLowerCase('tr-TR');
                    kitchenMatch = listingKitchen.includes(customerKitchen) || customerKitchen.includes(listingKitchen);
                }

                // 4. Budget Match
                let budgetMatch = true;
                if (customer.budget) {
                    const itemPrice = parseInt(item.price || '0');
                    const customerBudget = parseInt(customer.budget || '0');
                    if (itemPrice > 0) {
                        budgetMatch = itemPrice <= (customerBudget * 1.15);
                    }
                    // If Price is 0 (Unspecified), let's assume match for FSBO maybe? 
                    // No, usually price is key.
                }

                // 5. Building Age (Listings + FSBO)
                let buildingAgeMatch = true;
                if (customer.max_building_age && customer.max_building_age !== "") {
                    const maxAge = parseInt(customer.max_building_age);
                    const itemAgeStr = item.building_age || "";

                    if (itemAgeStr) {
                        let actualAge = 999;
                        if (itemAgeStr.includes("-")) actualAge = parseInt(itemAgeStr.split("-")[1]) || 999;
                        else if (itemAgeStr.includes("+")) actualAge = 31;
                        else actualAge = parseInt(itemAgeStr) || 999;

                        buildingAgeMatch = actualAge <= maxAge;
                    }
                }

                // 6. Damage & Site (Listings typically)
                // We'll skip complex checks for FSBO as data is often sparse

                return regionMatch && roomMatch && kitchenMatch && budgetMatch && buildingAgeMatch;
            };

            // GET MATCHES
            const listingMatches = this.data.listings.filter(l => checkCriteria(l, false));
            const fsboMatches = (this.data.fsbo || []).filter(f => checkCriteria(f, true));

            console.log(`Found matches: Listings=${listingMatches.length}, FSBO=${fsboMatches.length}`);

            // RENDER UI
            const listContainer = document.getElementById('matches-list');
            const criteriaEl = document.getElementById('matches-criteria');
            const modalTitle = document.querySelector('#modal-matches .modal-header h3');
            if (modalTitle) modalTitle.textContent = 'Uyumlu İlanlar';

            if (criteriaEl) {
                criteriaEl.innerHTML = `
                    Aranan: <strong>${regions.join(', ') || 'Tüm Bölgeler'}</strong> <br>
                    Bütçe: <strong>${customer.budget ? parseInt(customer.budget).toLocaleString('tr-TR') + ' TL' : 'Limitsiz'}</strong> <br>
                    Özellikler: <strong>${customer.room_pref || 'Farketmez'}</strong>
                `;
            }

            let html = '';

            // Helper to get existing match status for a customer-listing pair
            const getMatchStatus = (listingId, isFsbo = false) => {
                if (!customer.matchHistory) return null;
                const key = isFsbo ? `fsbo_${listingId}` : `listing_${listingId}`;
                return customer.matchHistory[key] || null;
            };

            // Status badge colors
            const statusColors = {
                'Sunuldu': { bg: '#dbeafe', color: '#1e40af' },
                'Beğenilmedi': { bg: '#fee2e2', color: '#991b1b' },
                'Fiyat Yüksek': { bg: '#fef3c7', color: '#92400e' },
                'İlgileniyor': { bg: '#dcfce7', color: '#166534' }
            };

            // 1. Internal Listings Section
            if (listingMatches.length > 0) {
                html += '<div style="font-size:12px; font-weight:bold; color:#64748b; margin-bottom:8px; border-bottom:1px solid #e2e8f0; padding-bottom:4px;">PORTFÖYÜMÜZDEN EŞLEŞENLER</div>';
                html += listingMatches.map(item => {
                    const existingStatus = getMatchStatus(item.id, false);
                    const statusStyle = existingStatus ? statusColors[existingStatus] : null;
                    return `
                    <div class="listing-card match-card-${item.id}" style="flex-direction: row; align-items: center; padding: 10px; transition: background 0.2s; margin-bottom: 8px; position: relative;" 
                            onmouseover="this.style.background='var(--bg-secondary)'" 
                            onmouseout="this.style.background='white'">
                        
                        <img src="https://source.unsplash.com/random/100x100/?house,${item.id}" style="width: 70px; height: 70px; border-radius: 8px; object-fit: cover; cursor:pointer;" onclick="triggerOpenGallery(${item.id})" onerror="this.src='https://via.placeholder.com/100?text=Ev'">
                        <div style="margin-left: 10px; flex: 1; cursor:pointer;" onclick="triggerOpenGallery(${item.id})">
                            <div style="font-weight: 600; font-size:14px;">${item.title}</div>
                            <div style="font-size: 12px; color: #666;">${item.location || 'Konum Yok'}</div>
                            <div style="font-size: 13px; color: var(--primary); font-weight:bold;">
                                ${parseInt(item.price || '0').toLocaleString('tr-TR')} TL
                            </div>
                            ${existingStatus ? `<span style="font-size:10px; padding:2px 6px; border-radius:4px; background:${statusStyle.bg}; color:${statusStyle.color}; margin-top:4px; display:inline-block;">${existingStatus}</span>` : ''}
                        </div>
                        <div style="display:flex; flex-direction:column; gap:4px; align-items:center;">
                            <button class="btn btn-sm btn-secondary" onclick="triggerOpenGallery(${item.id})" style="padding:6px;"><i class="ph ph-caret-right"></i></button>
                            ${item.external_link ? `<a href="${item.external_link}" target="_blank" class="btn btn-sm btn-outline" onclick="event.stopPropagation()" style="padding:4px 6px; font-size:10px; color:#3b82f6;" title="İlana Git"><i class="ph ph-arrow-square-out"></i></a>` : ''}
                            <button class="btn btn-sm btn-outline match-status-btn" onclick="event.stopPropagation(); app.toggleMatchStatusMenu(${customer.id}, ${item.id}, 'listing', this)" style="padding:4px 6px; font-size:10px;" title="Durum Belirle">
                                <i class="ph ph-dots-three-vertical"></i>
                            </button>
                        </div>
                    </div>
                `;
                }).join('');
            }

            // 2. FSBO Matches Section
            if (fsboMatches.length > 0) {
                html += '<div style="font-size:12px; font-weight:bold; color:#d97706; margin:16px 0 8px 0; border-bottom:1px solid #ffd8a8; padding-bottom:4px;">SAHİBİNDEN (FSBO) FIRSATLARI</div>';
                html += fsboMatches.map(item => {
                    const existingStatus = getMatchStatus(item.id, true);
                    const statusStyle = existingStatus ? statusColors[existingStatus] : null;
                    return `
                    <div class="listing-card" style="display:flex; flex-direction:column; padding:12px; border-left:3px solid #f59e0b; margin-bottom:8px; position:relative;">
                        <div style="display:flex; justify-content:space-between; margin-bottom:4px;">
                            <strong style="color:#1e293b; font-size:14px;">${item.owner}</strong>
                            <div style="display:flex; align-items:center; gap:6px;">
                                ${existingStatus ? `<span style="font-size:10px; padding:2px 6px; border-radius:4px; background:${statusStyle.bg}; color:${statusStyle.color};">${existingStatus}</span>` : ''}
                                <span style="font-size:11px; background:#fffbeb; color:#b45309; padding:2px 6px; border-radius:4px;">${item.status || 'FSBO'}</span>
                                <button class="btn btn-sm btn-outline match-status-btn" onclick="event.stopPropagation(); app.toggleMatchStatusMenu(${customer.id}, '${item.id}', 'fsbo', this)" style="padding:2px 4px; font-size:10px;" title="Durum Belirle">
                                    <i class="ph ph-dots-three-vertical"></i>
                                </button>
                            </div>
                        </div>
                        <div style="font-size:12px; color:#64748b; margin-bottom:4px;">
                            ${item.district || ''} / ${item.neighborhood || ''} • ${item.rooms || '-'}
                        </div>
                        <div style="display:flex; justify-content:space-between; align-items:center;">
                            <span style="font-size:14px; font-weight:bold; color:#d97706;">${parseInt(item.price || 0).toLocaleString('tr-TR')} TL</span>
                            <a href="tel:${item.phone}" class="btn btn-sm btn-outline" style="padding:4px 8px; font-size:11px;" onclick="event.stopPropagation()">
                                <i class="ph ph-phone"></i> Ara
                            </a>
                        </div>
                        ${item.link ? `<a href="${item.link}" target="_blank" style="font-size:11px; color:#3b82f6; text-decoration:underline; margin-top:4px;">İlana Git</a>` : ''}
                    </div>
                `;
                }).join('');
            }

            if (listingMatches.length === 0 && fsboMatches.length === 0) { // Fix variable name check
                listContainer.innerHTML = `
                    <div class="empty-state">
                        <i class="ph ph-magnifying-glass"></i>
                        <p>Mevcut kriterlere uygun ilan veya FSBO fırsatı bulunamadı.</p>
                    </div>
                `;
            } else {
                listContainer.innerHTML = html;
            }

            this.modals.open('matches');

        } catch (error) {
            console.error("Error finding matches:", error);
            alert("Eşleşme aranırken bir hata oluştu: " + error.message);
        }
    },

    // --- MATCH STATUS MENU ---
    toggleMatchStatusMenu(customerId, itemId, itemType, buttonEl) {
        // Remove any existing menu
        const existingMenu = document.getElementById('match-status-dropdown');
        if (existingMenu) existingMenu.remove();

        // Get button position
        const rect = buttonEl.getBoundingClientRect();

        // Create dropdown menu
        const menu = document.createElement('div');
        menu.id = 'match-status-dropdown';
        menu.style.cssText = `
            position: fixed;
            left: ${rect.left - 140}px;
            top: ${rect.bottom + 4}px;
            background: white;
            border: 1px solid #e2e8f0;
            border-radius: 8px;
            box-shadow: 0 4px 12px rgba(0,0,0,0.15);
            z-index: 99999;
            min-width: 160px;
            overflow: hidden;
        `;

        const statuses = [
            { label: 'Sunuldu', icon: 'ph-check', color: '#1e40af' },
            { label: 'İlgileniyor', icon: 'ph-heart', color: '#166534' },
            { label: 'Beğenilmedi', icon: 'ph-thumbs-down', color: '#991b1b' },
            { label: 'Fiyat Yüksek', icon: 'ph-currency-circle-dollar', color: '#92400e' },
            { label: 'Temizle', icon: 'ph-eraser', color: '#64748b' }
        ];

        menu.innerHTML = statuses.map(s => `
            <div onclick="event.stopPropagation(); app.setMatchStatus(${customerId}, '${itemId}', '${itemType}', '${s.label}')" 
                 style="padding: 10px 14px; cursor: pointer; display: flex; align-items: center; gap: 8px; font-size: 13px; color: ${s.color}; transition: background 0.15s;"
                 onmouseover="this.style.background='#f8fafc'" onmouseout="this.style.background='white'">
                <i class="ph ${s.icon}"></i> ${s.label}
            </div>
        `).join('');

        // Append to body for fixed positioning
        document.body.appendChild(menu);

        // Close menu when clicking outside
        const closeHandler = (e) => {
            if (!menu.contains(e.target) && e.target !== buttonEl) {
                menu.remove();
                document.removeEventListener('click', closeHandler);
            }
        };
        setTimeout(() => document.addEventListener('click', closeHandler), 10);
    },

    setMatchStatus(customerId, itemId, itemType, status) {
        const customer = this.data.customers.find(c => c.id === customerId);
        if (!customer) {
            console.error("Customer not found:", customerId);
            return;
        }

        // Initialize matchHistory if not exists
        if (!customer.matchHistory) customer.matchHistory = {};

        const key = itemType === 'fsbo' ? `fsbo_${itemId}` : `listing_${itemId}`;

        if (status === 'Temizle') {
            delete customer.matchHistory[key];
        } else {
            customer.matchHistory[key] = status;
        }

        // Save and refresh
        this.saveData('customers');
        this.saveToFirestore(true);

        // Remove dropdown
        const menu = document.getElementById('match-status-dropdown');
        if (menu) menu.remove();

        // Refresh the matches modal by re-triggering findMatches
        this.findMatches(customerId);
    },

    // --- HELPERS ---
    formatPriceInput(input) {
        // Remove non-digit characters
        let value = input.value.replace(/\D/g, '');
        if (value === '') {
            input.value = '';
            return;
        }
        // Format with dots
        input.value = parseInt(value).toLocaleString('tr-TR');
    },

    // --- RENDER HELPERS ---


    renderListings() {
        const grid = document.getElementById('listings-grid');
        const statsContainer = document.getElementById('listings-stats');
        grid.innerHTML = '';

        // Get Filter Values
        const searchInput = document.querySelector('.search-input');
        const searchTerm = searchInput ? searchInput.value.toLowerCase() : '';
        const districtFilter = document.getElementById('list-filter-district') ? document.getElementById('list-filter-district').value : '';
        const neighborhoodFilter = document.getElementById('list-filter-neighborhood') ? document.getElementById('list-filter-neighborhood').value : '';
        const roomFilter = document.getElementById('list-filter-rooms') ? document.getElementById('list-filter-rooms').value : '';
        const damageFilter = document.getElementById('list-filter-damage') ? document.getElementById('list-filter-damage').value : '';
        const typeFilter = document.getElementById('list-filter-type') ? document.getElementById('list-filter-type').value : 'all';
        const facadeFilter = document.getElementById('list-filter-facade') ? document.getElementById('list-filter-facade').value : 'all';

        // DEBUG: VISUALIZE FILTERS - REMOVED

        let filtered = this.data.listings.filter(item => {
            try {
                // Safe string access with Turkish Locale support
                const title = (item.title || '').toLocaleLowerCase('tr-TR');
                const location = (item.location || '').toLocaleLowerCase('tr-TR');
                const owner = (item.owner_name || '').toLocaleLowerCase('tr-TR');

                // Text Search
                if (searchTerm && !(title.includes(searchTerm) || location.includes(searchTerm) || owner.includes(searchTerm))) return false;

                // Type Filter
                if (typeFilter === 'passive') {
                    if (item.status !== 'passive') return false;
                } else if (typeFilter !== 'all') {
                    if (item.type !== typeFilter) return false;
                    if (item.status === 'passive' && typeFilter !== 'passive') return false;
                }

                // District Filter
                if (districtFilter && districtFilter !== 'all' && !location.includes(districtFilter.toLocaleLowerCase('tr-TR'))) return false;

                // Neighborhood Filter
                if (neighborhoodFilter && neighborhoodFilter !== 'all' && !location.includes(neighborhoodFilter.toLocaleLowerCase('tr-TR'))) return false;

                // Room Filter
                if (roomFilter && roomFilter !== 'all') {
                    // Loose matching
                    if (!String(item.rooms).includes(roomFilter)) return false;
                }

                // Damage Filter
                // IMPORTANT: Only filter if value exists and is NOT 'all'
                if (damageFilter && damageFilter !== 'all') {
                    const itemDamage = (item.damage || '').toLocaleLowerCase('tr-TR');
                    const filterVal = damageFilter.toLocaleLowerCase('tr-TR');
                    if (!itemDamage.includes(filterVal)) return false;
                }

                // Facade Filter
                if (facadeFilter && facadeFilter !== 'all') {
                    const itemFacade = (item.facade || '').toLocaleLowerCase('tr-TR');
                    const filterValue = facadeFilter.toLocaleLowerCase('tr-TR');
                    // Permissive check for "KD" vs "Kuzey Doğu" variations
                    if (!itemFacade.includes(filterValue) && !filterValue.includes(itemFacade)) return false;
                }

                // Deed Status Filter
                const deedFilter = document.getElementById('list-filter-deed') ? document.getElementById('list-filter-deed').value : 'all';
                if (deedFilter && deedFilter !== 'all') {
                    if ((item.deed_status || '') !== deedFilter) return false;
                }

                return true;
            } catch (err) {
                console.error("Filter error for item:", item, err);
                return true; // Keep item on error to avoid hiding it
            }
        });

        // Display statistics
        if (statsContainer) {
            const total = this.data.listings.length;
            const showing = filtered.length;
            statsContainer.innerHTML = `<strong>Toplam:</strong> ${total} ilan | <strong>Gösterilen:</strong> ${showing} ilan`;
        }

        if (filtered.length === 0) {
            grid.innerHTML = `
                            <div class="empty-state" style="grid-column: 1/-1;">
                                <i class="ph ph-file-search"></i>
                                <p>Filtrelere uygun ilan bulunamadı.</p>
                            </div>`;
            return;
        }

        grid.innerHTML = filtered.map(item => {
            try {
                // Safe Property Access
                const price = item.price ? parseInt(item.price).toLocaleString('tr-TR') : '0';
                const date = item.date ? new Date(item.date).toLocaleDateString('tr-TR') : '-';
                const location = item.location || 'Konum Belirtilmemiş';
                const title = item.title || 'Başlıksız İlan';
                const type = item.type === 'sale' ? 'Satılık' : 'Kiralık';
                let statusBadge = '';
                if (item.status === 'passive') statusBadge = '<span class="status-badge passive">Pasif</span>';
                else if (item.status === 'sold') statusBadge = '<span class="status-badge sold">SATILDI</span>';
                else if (item.status === 'deposit') statusBadge = '<span class="status-badge deposit">KAPORA</span>';
                else if (item.status === 'cancelled') statusBadge = '<span class="status-badge cancelled">İPTAL</span>';
                else statusBadge = `<span class="status-badge ${item.type}">${type}</span>`;

                const matchCount = (item.status !== 'sold' && item.status !== 'cancelled') ? this.getMatchingCustomers(item).length : 0;

                // Meta Tags
                const roomTag = item.rooms ? `<span><i class="ph ph-door"></i> ${item.rooms}</span>` : '';
                const sizeTag = item.size_net ? `<span><i class="ph ph-ruler"></i> ${item.size_net} m²</span>` : '';
                const floorTag = item.floor_current ? `<span><i class="ph ph-stairs"></i> ${item.floor_current}. Kat</span>` : '';
                const facadeTag = item.facade ? `<span><i class="ph ph-compass"></i> ${item.facade}</span>` : '';
                const deedTag = item.deed_status ? `<span><i class="ph ph-file-text"></i> ${item.deed_status}</span>` : '';

                // Compact Card HTML
                return `
                            <div class="listing-card type-${item.type}" onclick="app.openGallery(${item.id})">
                                ${item.status === 'sold' ? `<div class="status-overlay sold">SATILDI<br><span style="font-size: 0.6em">${(item.final_price || 0).toLocaleString('tr-TR')} ₺</span></div>` : ''}
                                ${item.status === 'deposit' ? `<div class="status-overlay deposit">KAPORA ALINDI<br><span style="font-size: 0.6em">${(item.final_price || 0).toLocaleString('tr-TR')} ₺</span></div>` : ''}
                                ${item.status === 'cancelled' ? '<div class="status-overlay cancelled">İPTAL EDİLDİ</div>' : ''}
                                
                                <button class="listing-menu-btn" onclick="app.toggleListingMenu(event, ${item.id})"><i class="ph ph-dots-three"></i></button>
                                <div class="context-menu-dropdown" id="menu-${item.id}">
                                    <div class="context-menu-item" onclick="app.handleStatusUpdate(event, ${item.id}, 'sold')">
                                        <i class="ph ph-check-circle" style="color: #166534"></i> Satıldı
                                    </div>
                                    <div class="context-menu-item" onclick="app.handleStatusUpdate(event, ${item.id}, 'deposit')">
                                        <i class="ph ph-hand-coins" style="color: #854D0E"></i> Kaporası Alındı
                                    </div>
                                    <div class="context-menu-item danger" onclick="app.handleStatusUpdate(event, ${item.id}, 'cancelled')">
                                        <i class="ph ph-x-circle"></i> Vazgeçildi / İptal
                                    </div>
                                </div>
            
                                <!-- Head: Title & Price -->
                                <div class="listing-header">
                                    <div class="listing-title-group">
                                        <h3 class="listing-title" title="${title}">${title}</h3>
                                        <div class="listing-location-sm">
                                            <i class="ph ph-map-pin"></i> ${location}
                                        </div>
                                    </div>
                                    <div class="listing-price-badge">${price} ₺</div>
                                </div>
            
                                <!-- Body: Stats Grid -->
                                <div class="listing-stats-grid">
                                    <div class="stat-item" title="Oda Sayısı">
                                        <i class="ph ph-door"></i> 
                                        <span>${item.rooms || '-'}</span>
                                    </div>
                                    <div class="stat-item" title="Net Metrekare">
                                        <i class="ph ph-ruler"></i> 
                                        <span>${item.size_net ? item.size_net + ' m²' : '-'}</span>
                                    </div>
                                    <div class="stat-item" title="Kat">
                                        <i class="ph ph-stairs"></i> 
                                        <span>${item.floor_current || '-'}${item.floor_total ? ' / ' + item.floor_total : ''}</span>
                                    </div>
                                    <div class="stat-item" title="Cephe">
                                        <i class="ph ph-compass"></i> 
                                        <span>${item.facade || '-'}</span>
                                    </div>
                                </div>
            
                                <!-- Footer: Status & Actions -->
                                <div class="listing-card-footer">
                                    <div class="listing-tags-row">
                                         ${item.status === 'passive' ? '<span class="mini-tag gray">Pasif</span>' : ''}
                                         <span class="mini-tag ${item.type === 'sale' ? 'blue' : 'warn'}">
                                            ${item.type === 'sale' ? 'Satılık' : 'Kiralık'}
                                         </span>
                                         ${item.deed_status ? `<span class="mini-tag gray">${item.deed_status}</span>` : ''}
                                         ${item.damage ? `<span class="mini-tag ${item.damage.includes('Hasarsız') ? 'green' : item.damage.includes('Az') ? 'warn' : 'red'}">${item.damage}</span>` : ''}
                                         ${item.interior_condition ? `<span class="mini-tag ${(item.interior_condition.includes('Full') || item.interior_condition === 'Yapılı') ? 'green' : (item.interior_condition === 'Normal') ? 'gray' : 'warn'}">${item.interior_condition}</span>` : ''}
                                         ${item.site_features ? `<span class="mini-tag blue">${item.site_features}</span>` : ''}
                                    </div>
                                    
                                    <div class="listing-actions-row" onclick="event.stopPropagation()">
                                         <button class="action-btn" onclick="app.evaluateListing(${item.id})" title="Yapay Zeka Değerlemesi">
                                            <i class="ph ph-magic-wand"></i>
                                        </button>
                                        <button class="action-btn" onclick="app.openEditListingModal(${item.id})" title="Düzenle">
                                            <i class="ph ph-pencil-simple"></i>
                                        </button>
                                        <button class="action-btn delete" onclick="app.deleteListing(${item.id})" title="Sil">
                                            <i class="ph ph-trash"></i>
                                        </button>
                                        ${matchCount > 0 ? `<button class="action-btn" onclick="app.showMatchingCustomers(${item.id})" title="${matchCount} uyumlu müşteri" style="background:#dcfce7; color:#166534; font-weight:700; gap:3px; border:1px solid #86efac;"><i class="ph-fill ph-handshake"></i> ${matchCount}</button>` : ''}
                                        ${item.external_link ? `<a href="${item.external_link}" target="_blank" class="action-btn" title="İlana Git"><i class="ph ph-link"></i></a>` : ''}
                                    </div>
                                </div>
                            </div>`;
            } catch (err) {
                console.error("Error rendering item:", item, err);
                return '';
            }
        }).join('');
    },

    renderFindings() {
        const grid = document.getElementById('findings-grid');
        if (!grid) return;
        grid.innerHTML = '';

        const items = this.data.findings || [];

        if (items.length === 0) {
            grid.innerHTML = `
                            <div class="empty-state" style="grid-column: 1/-1;">
                                <i class="ph ph-magnifying-glass-plus"></i>
                                <p>Henüz bulum eklenmedi.</p>
                            </div>`;
            return;
        }

        grid.innerHTML = items.map(item => {
            try {
                const price = item.price ? parseInt(item.price).toLocaleString('tr-TR') : '0';
                const date = item.date ? new Date(item.date).toLocaleDateString('tr-TR') : '-';
                const location = item.location || 'Konum Belirtilmemiş';
                const title = item.title || 'Başlıksız Bulum';
                const type = item.type === 'sale' ? 'Satılık' : 'Kiralık';

                return `
                            <div class="listing-card type-${item.type}" onclick="app.openAddListingModal(${item.id}, 'finding')">
                                <button class="listing-menu-btn" onclick="app.toggleListingMenu(event, ${item.id})"><i class="ph ph-dots-three"></i></button>
                                <div class="context-menu-dropdown" id="menu-${item.id}">
                                    <div class="context-menu-item" onclick="app.handleStatusUpdate(event, ${item.id}, 'begenilmedi')">
                                        <i class="ph ph-thumbs-down" style="color: #ef4444"></i> Beğenilmedi
                                    </div>
                                    <div class="context-menu-item" onclick="app.handleStatusUpdate(event, ${item.id}, 'fiyat_yuksek')">
                                        <i class="ph ph-trend-up" style="color: #f59e0b"></i> Fiyat Yüksek
                                    </div>
                                    <div class="context-menu-item" onclick="app.handleStatusUpdate(event, ${item.id}, 'takip')">
                                        <i class="ph ph-bookmarks" style="color: #3b82f6"></i> Takip
                                    </div>
                                    <div style="border-top:1px solid #eee; margin:4px 0"></div>
                                    <div class="context-menu-item danger" onclick="app.deleteFinding(${item.id})">
                                        <i class="ph ph-trash"></i> Sil
                                    </div>
                                </div>

                                <div class="listing-header">
                                    <div class="listing-title-group">
                                        <h3 class="listing-title" title="${title}">${title}</h3>
                                        <div class="listing-location-sm">
                                            <i class="ph ph-map-pin"></i> ${location}
                                        </div>
                                    </div>
                                    <div class="listing-price-badge" style="background:orange">${price} ₺</div>
                                </div>
                                
                                <div class="listing-stats-grid">
                                    <div class="stat-item"><i class="ph ph-door"></i> <span>${item.rooms || '-'}</span></div>
                                    <div class="stat-item"><i class="ph ph-ruler"></i> <span>${item.size_net || '-'} m²</span></div>
                                    <div class="stat-item"><i class="ph ph-stairs"></i> <span>${item.floor_current || '-'}</span></div>
                                </div>

                                <div class="listing-card-footer">
                                    <div class="listing-tags-row">
                                         <span class="mini-tag blue">Bulum</span>
                                         ${item.damage ? `<span class="mini-tag gray">${item.damage}</span>` : ''}
                                         ${item.interior_condition ? `<span class="mini-tag gray">${item.interior_condition}</span>` : ''}
                                    </div>
                                    <div class="listing-actions-row" onclick="event.stopPropagation()">
                                        <button class="action-btn" onclick="app.openAddListingModal(${item.id}, 'finding')" title="Düzenle">
                                            <i class="ph ph-pencil-simple"></i>
                                        </button>
                                        <button class="action-btn delete" onclick="app.deleteFinding(${item.id})" title="Sil">
                                            <i class="ph ph-trash"></i>
                                        </button>
                                    </div>
                                </div>
                            </div>`;
            } catch (err) {
                console.error("Error rendering finding:", item, err);
                return '';
            }
        }).join('');
    },

    deleteFinding(id) {
        if (confirm('Bu bulumu silmek istediğinize emin misiniz?')) {
            const item = this.data.findings.find(x => x.id === id);
            if (item && item.photos && item.photos.length > 0) {
                const photoIds = item.photos.filter(p => this.isPhotoRef(p));
                if (photoIds.length > 0) this.photoStore.deletePhotos(photoIds);
            }
            this.data.findings = this.data.findings.filter(x => x.id !== id);
            this.saveData('findings');
            this.renderFindings();
        }
    },

    onFsboDistrictChange() {
        const districtSelect = document.getElementById('fsbo-district');
        const district = districtSelect.value;
        const neighborhoodSelect = document.getElementById('fsbo-neighborhood');

        neighborhoodSelect.innerHTML = '<option value="">Seçiniz</option>';

        if (district && this.adanaLocations[district]) {
            const neighborhoods = Object.keys(this.adanaLocations[district].neighborhoods);
            neighborhoods.sort();

            neighborhoods.forEach(n => {
                const option = document.createElement('option');
                option.value = n;
                option.textContent = n;
                neighborhoodSelect.appendChild(option);
            });
        }
    },

    addNewCustomer() {
        const form = document.getElementById('form-add-customer');
        if (!form) return;
        const formData = new FormData(form);

        let finalRegions = this.currentCustomerRegions.join(' | ');
        if (!finalRegions) {
            const district = document.getElementById('customer-district').value;
            const neighborhood = document.getElementById('customer-neighborhood').value;
            if (district && neighborhood) finalRegions = `${district}, ${neighborhood}`;
        }

        const budgetRaw = formData.get('budget').replace(/\./g, '');

        const newCustomer = {
            id: Date.now(),
            name: formData.get('name'),
            phone: formData.get('phone'),
            budget: budgetRaw,
            region: finalRegions,
            room_pref: Array.from(document.querySelectorAll('#add-room-pref-group input[name="room_pref_cb"]:checked')).map(cb => cb.value).join(', '),
            kitchen_pref: formData.get('kitchen_pref'),
            max_building_age: formData.get('max_building_age'),
            damage_pref: formData.get('damage_pref'),
            site_pref: formData.get('site_pref'),
            type: formData.get('type'),
            priority: 'normal',
            notes: formData.get('notes')
        };

        this.data.customers.unshift(newCustomer);
        this.saveData('customers');
        this.renderCustomers();
        this.modals.closeAll();
        form.reset();
        this.currentCustomerRegions = [];
        this.renderSelectedRegions();
        alert("Müşteri eklendi!");
        alert("Müşteri eklendi!");
    },

    findMatches(customerId) {
        this.currentFinderCustomerId = customerId; // Store for actions
        const customer = this.data.customers.find(c => c.id == customerId);
        if (!customer) return;

        const budget = parseInt(customer.budget) || 0;
        const roomPrefs = customer.room_pref ? customer.room_pref.split(',').map(r => r.trim()) : [];

        // Parse Customer Regions
        const regions = (customer.region || '').split('|').map(r => {
            if (!r.trim()) return null;
            const parts = r.split(',').map(p => p.trim().toLowerCase());
            return { district: parts[0], neighborhood: parts[1] || '' };
        }).filter(r => r);

        const checkMatch = (item) => {
            // Active checks
            if (item.status === 'sold' || item.status === 'cancelled') return false;

            // Budget (allow +15%)
            // Fix parsing for dotted prices like "4.500.000"
            const rawPrice = String(item.price || '0').replace(/\./g, '');
            const price = parseInt(rawPrice) || 0;
            if (price > budget * 1.15) return false;

            // Rooms
            if (roomPrefs.length > 0 && item.rooms && !roomPrefs.some(pref => item.rooms.includes(pref))) return false;

            // Location Check
            if (regions.length > 0) {
                const itemLoc = (item.location || (item.district ? item.district + ' ' + (item.neighborhood || '') : '') || '').toLowerCase();
                const matchRegion = regions.some(r => {
                    const distMatch = itemLoc.includes(r.district);
                    const neighMatch = !r.neighborhood || itemLoc.includes(r.neighborhood);
                    return distMatch && neighMatch;
                });
                if (!matchRegion) return false;
            }
            return true;
        };

        const listingMatches = this.data.listings.filter(checkMatch);
        const findingMatches = (this.data.findings || []).filter(checkMatch);
        const fsboMatches = (this.data.fsbo || []).filter(checkMatch);

        const container = document.getElementById('finder-results');
        if (!container) return;

        const renderMatchCard = (item, source) => {
            const rawPrice = String(item.price || '0').replace(/\./g, '');
            const price = parseInt(rawPrice).toLocaleString('tr-TR');
            const title = item.title || item.owner || 'Başlıksız';
            const location = item.location || (item.district ? item.district + ', ' + item.neighborhood : '');

            let badge = '<span class="mini-tag green">İLAN</span>';
            let bg = 'white';

            if (source === 'finding') {
                badge = '<span class="mini-tag blue">BULUM</span>';
                bg = '#eff6ff';
            } else if (source === 'fsbo') {
                badge = '<span class="mini-tag warn">SAHİBİNDEN</span>';
                bg = '#fffbeb';
            }

            // Link normalization (Listings use external_link, FSBO uses link)
            const itemLink = item.external_link || item.link;

            // CUSTOMER SPECIFIC NOTE LOGIC
            const interaction = (customer.interactions || {})[item.id];
            const customerNote = interaction ? interaction.note : null;
            const interactionStatus = interaction ? interaction.status : null;
            const statusBadges = {
                'begenildi': { bg: '#dcfce7', color: '#166534', text: '✅ Beğenildi' },
                'sicak_bakiyor': { bg: '#fff7ed', color: '#c2410c', text: '🔥 Sıcak Bakıyor' },
                'begenilmedi': { bg: '#fee2e2', color: '#991b1b', text: '👎 Beğenilmedi' },
                'fiyat_yuksek': { bg: '#fef3c7', color: '#92400e', text: '📉 Fiyat Yüksek' }
            };
            const sBadge = interactionStatus && statusBadges[interactionStatus] ? statusBadges[interactionStatus] : null;

            return `
                <div class="listing-card" style="background:${sBadge ? sBadge.bg : bg}" onclick="app.modals.closeAll(); app.openAddListingModal(${item.id}, '${source}')">
                    ${sBadge ? `<div style="position:absolute; top:8px; right:40px; font-size:11px; padding:2px 8px; border-radius:4px; background:${sBadge.color}; color:white; font-weight:600; z-index:1;">${sBadge.text}</div>` : ''}
                    <button class="listing-menu-btn" onclick="app.toggleListingMenu(event, ${item.id})"><i class="ph ph-dots-three"></i></button>
                    <div class="context-menu-dropdown" id="menu-${item.id}">
                        <div class="context-menu-item" onclick="app.handleStatusUpdate(event, ${item.id}, 'begenildi')">
                            <i class="ph ph-thumbs-up" style="color: #16a34a"></i> Beğenildi
                        </div>
                        <div class="context-menu-item" onclick="app.handleStatusUpdate(event, ${item.id}, 'sicak_bakiyor')">
                            <i class="ph ph-fire" style="color: #ea580c"></i> Sıcak Bakıyor
                        </div>
                        <div style="border-top:1px solid #eee; margin:4px 0"></div>
                        <div class="context-menu-item" onclick="app.handleStatusUpdate(event, ${item.id}, 'begenilmedi')">
                            <i class="ph ph-thumbs-down" style="color: #ef4444"></i> Beğenilmedi
                        </div>
                        <div class="context-menu-item" onclick="app.handleStatusUpdate(event, ${item.id}, 'fiyat_yuksek')">
                            <i class="ph ph-trend-up" style="color: #f59e0b"></i> Fiyat Yüksek
                        </div>
                    </div>

                    <div class="listing-header">
                        <div class="listing-title-group">
                            <h3 class="listing-title" style="font-size:14px">${title}</h3>
                            <div class="listing-location-sm"><i class="ph ph-map-pin"></i> ${location}</div>
                        </div>
                        <div class="listing-price-badge">${price} ₺</div>
                    </div>
                    <div class="listing-card-footer" style="margin-top:10px">
                        <div class="listing-tags-row">
                            ${badge}
                            ${item.rooms ? `<span class="mini-tag gray">${item.rooms}</span>` : ''}
                            ${item.size_net ? `<span class="mini-tag gray">${item.size_net} m²</span>` : ''}
                            ${item.damage ? `<span class="mini-tag ${item.damage.includes('Hasarsız') ? 'green' : item.damage.includes('Az') ? 'warn' : 'red'}">${item.damage}</span>` : ''}
                            ${item.interior_condition ? `<span class="mini-tag ${(item.interior_condition.includes('Full') || item.interior_condition === 'Yapılı') ? 'green' : (item.interior_condition === 'Normal') ? 'gray' : 'warn'}">${item.interior_condition}</span>` : ''}
                        </div>
                        ${itemLink ? `<a href="${itemLink}" target="_blank" onclick="event.stopPropagation()" class="btn btn-sm" style="margin-top:8px; background:#3b82f6; color:white; font-size:11px; padding:6px 12px; border-radius:6px; text-decoration:none; display:inline-flex; align-items:center; gap:4px;"><i class="ph ph-arrow-square-out"></i> İlana Git</a>` : ''}
                    </div>
                    ${customerNote ? `
                    <div style="background:#fffbeb; padding:6px 8px; border-top:1px dashed #fbbf24; font-size:11px; color:#92400e; margin-top:8px; border-radius:0 0 8px 8px;">
                        <i class="ph ph-user-focus"></i> ${customerNote.split('\n').slice(-1)[0]}
                    </div>` : ''}
                </div>
            `;
        };

        let html = '';
        if (listingMatches.length === 0 && findingMatches.length === 0) {
            html = '<div class="empty-state"><p>Uygun eşleşme bulunamadı.</p></div>';
        } else {
            html += listingMatches.map(x => renderMatchCard(x, 'listing')).join('');
            html += findingMatches.map(x => renderMatchCard(x, 'finding')).join('');

            if (fsboMatches.length > 0) {
                html += `
                <div style="grid-column: 1 / -1; margin-top: 8px;">
                     <details style="background:white; border:1px solid #fed7aa; border-radius:8px; overflow:hidden;">
                        <summary style="padding:12px 16px; background:#fff7ed; cursor:pointer; font-weight:600; color:#c2410c; display:flex; justify-content:space-between; align-items:center; list-style:none;">
                            <div style="display:flex; align-items:center; gap:8px;">
                                <i class="ph ph-user-circle" style="font-size:20px;"></i>
                                <span>Sahibinden (FSBO) Fırsatları (${fsboMatches.length})</span>
                            </div>
                            <i class="ph ph-caret-down"></i>
                        </summary>
                        <div style="padding:16px; display:grid; grid-template-columns: repeat(auto-fill, minmax(320px, 1fr)); gap:16px; border-top:1px solid #fed7aa; background:#fffbeb;">
                            ${fsboMatches.map(x => renderMatchCard(x, 'fsbo')).join('')}
                        </div>
                    </details>
                </div>`;
            }
        }

        container.innerHTML = html;
        this.modals.open('finder');
    },

    toggleListingMenu(e, id) {
        e.stopPropagation();
        const menu = document.getElementById(`menu-${id}`);
        if (menu) {
            document.querySelectorAll('.context-menu-dropdown').forEach(m => {
                if (m.id !== `menu-${id}`) m.style.display = 'none';
            });
            menu.style.display = menu.style.display === 'block' ? 'none' : 'block';
        }
    },

    handleStatusUpdate(event, itemId, status) {
        event.stopPropagation();
        if (!this.currentFinderCustomerId) return;

        const customer = this.data.customers.find(c => c.id == this.currentFinderCustomerId);
        if (!customer) return;

        if (!customer.interactions) customer.interactions = {};

        const currentNote = (customer.interactions[itemId] || {}).note || '';

        const statusText = {
            'begenildi': '✅ Beğenildi',
            'begenilmedi': '👎 Beğenilmedi',
            'sicak_bakiyor': '🔥 Sıcak Bakıyor',
            'fiyat_yuksek': '📉 Fiyat Yüksek'
        };

        const newNoteMsg = `${statusText[status]}`;
        let newNote = `[${new Date().toLocaleDateString()}] ${newNoteMsg}`;
        if (currentNote) newNote = currentNote + '\n' + newNote;

        customer.interactions[itemId] = {
            status: status,
            note: newNote,
            date: new Date().toISOString()
        };

        this.saveData('customers');
        this.saveToFirestore(true);
        this.findMatches(this.currentFinderCustomerId);
    },

    renderCustomers() {
        const list = document.getElementById('crm-list');
        let customers = this.data.customers;

        if (this.crmFilter === 'seller') {
            customers = customers.filter(c => c.type === 'seller');
            document.getElementById('page-title').textContent = 'Mülk Sahipleri';
        } else {
            customers = customers.filter(c => c.type !== 'seller');
            document.getElementById('page-title').textContent = 'Müşteri Listesi';
        }

        if (customers.length === 0) {
            list.innerHTML = `<div class="empty-state"><i class="ph ph-users"></i><p>Liste boş.</p></div>`;
            return;
        }

        // Sort by priority first, then by budget (highest first)
        const priorityOrder = { 'yüksek': 0, 'orta': 1, 'düşük': 2, '': 3 };
        customers.sort((a, b) => {
            const aPriority = priorityOrder[a.priority || ''] ?? 3;
            const bPriority = priorityOrder[b.priority || ''] ?? 3;
            if (aPriority !== bPriority) return aPriority - bPriority;
            return (parseInt(b.budget) || 0) - (parseInt(a.budget) || 0);
        });

        // Grid container with larger cards
        list.innerHTML = `
            <div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(320px, 1fr)); gap: 16px;">
                ${customers.map(customer => {
            const priorityColors = {
                'yüksek': { bg: '#fef2f2', color: '#dc2626', text: '🔴 Acil' },
                'orta': { bg: '#fffbeb', color: '#d97706', text: '🟡 Orta' },
                'düşük': { bg: '#f0fdf4', color: '#16a34a', text: '🟢 Normal' }
            };
            const priority = priorityColors[customer.priority] || null;

            return `
                    <div style="background: white; border-radius: 12px; padding: 16px; box-shadow: 0 2px 4px rgba(0,0,0,0.06); border: 1px solid #e5e7eb; ${priority ? 'border-left: 4px solid ' + priority.color : ''}">
                        <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 10px;">
                            <div>
                                <h4 style="margin: 0; font-size: 16px; font-weight: 600; color: #1f2937;">${customer.name}</h4>
                                <p style="margin: 4px 0 0; font-size: 13px; color: #6b7280;"><i class="ph ph-phone"></i> ${customer.phone}</p>
                            </div>
                            <div style="display: flex; gap: 6px; flex-wrap: wrap; justify-content: flex-end;">
                                ${priority ? `<span style="background: ${priority.bg}; color: ${priority.color}; font-size: 10px; padding: 3px 8px; border-radius: 4px; font-weight: 500;">${priority.text}</span>` : ''}
                                <span style="background: ${customer.type === 'buyer' ? '#dbeafe' : customer.type === 'seller' ? '#fef3c7' : '#d1fae5'}; 
                                             color: ${customer.type === 'buyer' ? '#1d4ed8' : customer.type === 'seller' ? '#b45309' : '#047857'}; 
                                             font-size: 10px; padding: 3px 8px; border-radius: 4px; font-weight: 500;">
                                    ${customer.type === 'buyer' ? 'Alıcı' : customer.type === 'seller' ? 'Satıcı' : 'Kiracı'}
                                </span>
                            </div>
                        </div>
                        ${customer.region ? `<p style="font-size: 12px; color: #6b7280; margin: 8px 0;"><i class="ph ph-map-pin" style="color: #9ca3af;"></i> ${customer.region}</p>` : ''}
                        <div style="display: flex; gap: 16px; margin: 10px 0;">
                            ${customer.budget ? `<span style="font-size: 14px; color: #059669; font-weight: 700;"><i class="ph ph-wallet"></i> ${parseInt(customer.budget).toLocaleString('tr-TR')} TL</span>` : ''}
                            ${customer.room_pref ? `<span style="font-size: 12px; color: #6b7280;"><i class="ph ph-door"></i> ${customer.room_pref}</span>` : ''}
                            ${customer.kitchen_pref ? `<span style="font-size: 12px; color: #6b7280;"><i class="ph ph-cooking-pot"></i> ${customer.kitchen_pref}</span>` : ''}
                        </div>
                        ${customer.notes ? `<p style="font-size: 12px; color: #4b5563; margin: 8px 0 0; padding: 8px; background: #f9fafb; border-radius: 6px; border-left: 3px solid #d1d5db; white-space: pre-wrap; line-height: 1.4;"><i class="ph ph-note-pencil" style="color:#9ca3af;"></i> ${customer.notes}</p>` : ''}
                        <div style="display: flex; gap: 8px; margin-top: 12px; border-top: 1px solid #f3f4f6; padding-top: 12px;">
                            <button onclick="app.findMatches('${customer.id}')" style="flex: 1; background: #4f46e5; color: white; border: none; border-radius: 8px; padding: 8px 0; font-size: 12px; cursor: pointer; font-weight: 500;">İlan Bul</button>
                            <button onclick="app.openCustomerEditPopup('${customer.id}')" style="flex: 1; background: #f3f4f6; color: #374151; border: none; border-radius: 8px; padding: 8px 0; font-size: 12px; cursor: pointer;">Düzenle</button>
                            <button onclick="app.deleteCustomer('${customer.id}')" style="background: #fef2f2; color: #dc2626; border: none; border-radius: 8px; padding: 8px 12px; cursor: pointer;"><i class="ph ph-trash"></i></button>
                        </div>
                    </div>
                `}).join('')}
            </div>`;
    },

    renderAppointments() {
        const list = document.getElementById('appointments-list');
        if (this.data.appointments.length === 0) {
            list.innerHTML = `<div class="empty-state"><p>Randevu yok.</p></div>`;
            return;
        }

        list.innerHTML = this.data.appointments.map(apt => `
                        <div class="appointment-item">
                            <div class="appointment-date">
                                <span class="time">${apt.time}</span>
                            </div>
                            <div class="appointment-info">
                                <h4>${apt.title}</h4>
                                <p>${apt.notes || ''}</p>
                            </div>
                        </div>`).join('');
    },

    onListingDistrictChange() {
        const districtSelect = document.getElementById('listing-district');
        const neighborhoodSelect = document.getElementById('listing-neighborhood');
        if (!districtSelect || !neighborhoodSelect) return;

        const district = districtSelect.value;
        console.log("District Selected:", district);
        neighborhoodSelect.innerHTML = '<option value="">Seçiniz</option>';
        if (!district) return;

        // Simple lookup
        let locationData = this.adanaLocations[district];
        console.log("Location Data Found:", !!locationData, locationData ? Object.keys(locationData.neighborhoods) : 'None');

        if (!locationData && (district === 'Çukurova' || district.includes('ukurova'))) {
            const key = Object.keys(this.adanaLocations).find(k => k.includes('ukurova'));
            if (key) locationData = this.adanaLocations[key];
        }

        if (locationData) {
            Object.keys(locationData.neighborhoods).forEach(n => {
                const option = document.createElement('option');
                option.value = n;
                option.textContent = n;
                neighborhoodSelect.appendChild(option);
            });
            // Explicitly force Kabasakal
            if (district.includes('ukurova')) {
                const kOption = document.createElement('option');
                kOption.value = 'Kabasakal';
                kOption.textContent = 'Kabasakal';
                neighborhoodSelect.appendChild(kOption);
            }
        }
    },

    onEditListingDistrictChange() {
        const districtSelect = document.getElementById('edit-listing-district');
        const neighborhoodSelect = document.getElementById('edit-listing-neighborhood');
        if (!districtSelect || !neighborhoodSelect) return;

        const district = districtSelect.value;
        neighborhoodSelect.innerHTML = '<option value="">Seçiniz</option>';
        if (!district) return;

        // Use same logic as add listing
        let locationData = this.adanaLocations[district];
        if (!locationData && (district === 'Çukurova' || district.includes('ukurova'))) {
            const key = Object.keys(this.adanaLocations).find(k => k.includes('ukurova'));
            if (key) locationData = this.adanaLocations[key];
        }

        if (locationData) {
            Object.keys(locationData.neighborhoods).forEach(n => {
                const option = document.createElement('option');
                option.value = n;
                option.textContent = n;
                neighborhoodSelect.appendChild(option);
            });
            // Explicitly force Kabasakal
            if (district.includes('ukurova')) {
                const kOption = document.createElement('option');
                kOption.value = 'Kabasakal';
                kOption.textContent = 'Kabasakal';
                neighborhoodSelect.appendChild(kOption);
            }
        }
    },

    onListFilterDistrictChange() {
        const districtSelect = document.getElementById('list-filter-district');
        const neighborhoodSelect = document.getElementById('list-filter-neighborhood');
        if (!districtSelect || !neighborhoodSelect) return;

        const district = districtSelect.value;
        neighborhoodSelect.innerHTML = '<option value="">Tüm Mahalleler</option>';

        if (district && this.adanaLocations[district]) {
            Object.keys(this.adanaLocations[district].neighborhoods).forEach(n => {
                const option = document.createElement('option');
                option.value = n;
                option.textContent = n;
                neighborhoodSelect.appendChild(option);
            });
        }
        this.renderListings();
    },

    openEditListingModal(id) {
        const listing = this.data.listings.find(l => l.id === id);
        if (!listing) return;

        const form = document.getElementById('form-edit-listing');
        if (!form) return;

        // Populate basic fields
        if (form.elements['id']) form.elements['id'].value = listing.id;
        if (form.elements['title']) form.elements['title'].value = listing.title || '';
        if (form.elements['price']) form.elements['price'].value = listing.price ? parseInt(listing.price).toLocaleString('tr-TR') : '';
        if (form.elements['street']) form.elements['street'].value = listing.street || '';

        // Selects
        if (form.elements['type']) form.elements['type'].value = listing.type || 'sale';
        if (form.elements['status']) form.elements['status'].value = listing.status || 'active';
        if (form.elements['rooms']) form.elements['rooms'].value = listing.rooms || '';
        if (form.elements['kitchen']) form.elements['kitchen'].value = listing.kitchen || '';
        if (form.elements['floor_current']) form.elements['floor_current'].value = listing.floor_current || '';
        if (form.elements['floor_total']) form.elements['floor_total'].value = listing.floor_total || '';
        if (form.elements['size_gross']) form.elements['size_gross'].value = listing.size_gross || '';
        if (form.elements['size_net']) form.elements['size_net'].value = listing.size_net || '';
        if (form.elements['building_age']) form.elements['building_age'].value = listing.building_age || '';
        if (form.elements['damage']) form.elements['damage'].value = listing.damage || 'Hasarsız';
        if (form.elements['interior_condition']) form.elements['interior_condition'].value = listing.interior_condition || 'Normal';
        if (form.elements['facade']) form.elements['facade'].value = listing.facade || '';
        if (form.elements['deed_status']) form.elements['deed_status'].value = listing.deed_status || '';

        // Owner Info
        if (form.elements['owner_name']) form.elements['owner_name'].value = listing.owner_name || '';
        if (form.elements['owner_phone']) form.elements['owner_phone'].value = listing.owner_phone || '';

        // Description
        if (form.elements['description']) form.elements['description'].value = listing.description || '';
        if (form.elements['external_link']) form.elements['external_link'].value = listing.external_link || '';

        // Location - Format is "Neighborhood, District, Adana"
        const locationParts = (listing.location || '').split(',').map(s => s.trim());
        let district = '';
        let neighborhood = '';

        if (locationParts.length >= 2) {
            neighborhood = locationParts[0]; // First part is Neighborhood
            district = locationParts[1];     // Second part is District
        } else if (locationParts.length === 1) {
            // Fallback try to match from text
            district = Object.keys(this.adanaLocations).find(d => listing.location.includes(d)) || '';
        }

        const districtSelect = document.getElementById('edit-listing-district');
        if (districtSelect) {
            districtSelect.value = district;
            // Manually trigger population of neighborhoods
            this.onEditListingDistrictChange();

            // Set neighborhood after options are populated
            const neighborhoodSelect = document.getElementById('edit-listing-neighborhood');
            if (neighborhoodSelect && neighborhood) {
                neighborhoodSelect.value = neighborhood;
            }
        }

        this.modals.open('edit-listing');
    },

    saveEditListing() {
        const form = document.getElementById('form-edit-listing');
        if (!form) {
            alert("Form bulunamadı!");
            return;
        }

        const formData = new FormData(form);
        const id = parseInt(formData.get('id'));

        const index = this.data.listings.findIndex(l => l.id === id);
        if (index === -1) {
            alert("İlan bulunamadı! ID: " + id);
            return;
        }

        const district = document.getElementById('edit-listing-district').value;
        const neighborhood = document.getElementById('edit-listing-neighborhood').value;
        const location = `${neighborhood}, ${district}, Adana`;

        const updatedListing = {
            ...this.data.listings[index],
            title: formData.get('title'),
            price: formData.get('price').replace(/\./g, ''),
            location: location,
            street: formData.get('street') || '',
            type: formData.get('type'),
            status: formData.get('status'),
            rooms: formData.get('rooms'),
            kitchen: formData.get('kitchen'),
            floor_current: formData.get('floor_current'),
            floor_total: formData.get('floor_total'),
            size_gross: formData.get('size_gross'),
            size_net: formData.get('size_net'),
            building_age: formData.get('building_age'),
            damage: formData.get('damage'),
            interior_condition: formData.get('interior_condition'),
            facade: formData.get('facade'),
            deed_status: formData.get('deed_status'),
            site_features: formData.get('site_features'),
            owner_name: formData.get('owner_name'),
            owner_phone: formData.get('owner_phone'),
            description: formData.get('description'),
            external_link: formData.get('external_link')
        };

        this.data.listings[index] = updatedListing;
        this.saveData('listings');
        this.renderListings();
        this.updateStats();
        this.modals.closeAll();
        alert("İlan güncellendi! Sokak: " + updatedListing.street);
    },

    deleteListing(id) {
        if (confirm('Silinsin mi?')) {
            const item = this.data.listings.find(l => l.id === id);
            if (item && item.photos && item.photos.length > 0) {
                const photoIds = item.photos.filter(p => this.isPhotoRef(p));
                if (photoIds.length > 0) this.photoStore.deletePhotos(photoIds);
            }
            this.data.listings = this.data.listings.filter(l => l.id !== id);
            this.saveData('listings');
            this.renderListings();
        }
    },

    getMatchingCustomers(listing) {
        const knownDistricts = ['seyhan', 'çukurova', 'yüreğir', 'sarıçam', 'adana'];
        const locParts = (listing.location || '').split(',').map(p => p.trim());
        const listingNeighborhood = locParts[0] ? locParts[0].toLocaleLowerCase('tr-TR') : '';
        const listingPrice = parseInt(listing.price || '0');
        const listingRooms = (listing.rooms || '').toLocaleLowerCase('tr-TR').replace(/\s/g, '');
        const listingKitchen = (listing.kitchen || '').toLocaleLowerCase('tr-TR');

        let listingAge = 0;
        const ageStr = listing.building_age || '';
        if (ageStr.includes('-')) listingAge = parseInt(ageStr.split('-')[1]) || 999;
        else if (ageStr.includes('+')) listingAge = 31;
        else listingAge = parseInt(ageStr) || 999;

        return this.data.customers.filter(c => {
            if (c.type !== 'buyer' && c.type !== 'tenant') return false;

            if (c.region) {
                const regions = c.region.split(/[,|]/).map(r => r.trim()).filter(r => r.length > 0)
                    .filter(r => !knownDistricts.includes(r.toLocaleLowerCase('tr-TR')));
                if (regions.length > 0 && listingNeighborhood) {
                    const regionMatch = regions.some(r => {
                        const rLower = r.toLocaleLowerCase('tr-TR');
                        return listingNeighborhood.includes(rLower) || rLower.includes(listingNeighborhood);
                    });
                    if (!regionMatch) return false;
                }
            }

            if (c.room_pref && c.room_pref !== '') {
                const customerRoomPrefs = c.room_pref.split(',').map(r => r.trim().toLocaleLowerCase('tr-TR').replace(/\s/g, ''));
                if (listingRooms === '') return false;
                if (!customerRoomPrefs.some(pref => listingRooms.includes(pref) || pref.includes(listingRooms))) return false;
            }

            if (c.kitchen_pref && c.kitchen_pref !== '') {
                const customerKitchen = c.kitchen_pref.toLocaleLowerCase('tr-TR');
                if (!listingKitchen.includes(customerKitchen) && !customerKitchen.includes(listingKitchen)) return false;
            }

            if (c.budget) {
                const customerBudget = parseInt(c.budget || '0');
                if (listingPrice > 0 && listingPrice > customerBudget * 1.15) return false;
            }

            if (c.max_building_age && c.max_building_age !== '') {
                const maxAge = parseInt(c.max_building_age);
                if (listingAge > maxAge) return false;
            }

            return true;
        });
    },

    showMatchingCustomers(listingId) {
        const listing = this.data.listings.find(l => l.id === listingId);
        if (!listing) { alert('İlan bulunamadı!'); return; }

        const matches = this.getMatchingCustomers(listing);
        const listingPrice = parseInt(listing.price || '0');

        const criteriaEl = document.getElementById('matches-criteria');
        const listContainer = document.getElementById('matches-list');
        const modalTitle = document.querySelector('#modal-matches .modal-header h3');
        if (modalTitle) modalTitle.textContent = 'Uyumlu Müşteriler';

        if (criteriaEl) {
            criteriaEl.innerHTML = `
                İlan: <strong>${listing.title || 'İsimsiz'}</strong> <br>
                Konum: <strong>${listing.location || '-'}</strong> <br>
                Fiyat: <strong>${listingPrice > 0 ? listingPrice.toLocaleString('tr-TR') + ' TL' : '-'}</strong> •
                Oda: <strong>${listing.rooms || '-'}</strong>
            `;
        }

        if (matches.length === 0) {
            listContainer.innerHTML = `
                <div class="empty-state">
                    <i class="ph ph-magnifying-glass"></i>
                    <p>Bu ilana uygun müşteri bulunamadı.</p>
                </div>`;
        } else {
            listContainer.innerHTML = matches.map(c => `
                <div class="listing-card" style="flex-direction: row; align-items: center; padding: 10px; margin-bottom: 8px;"
                     onmouseover="this.style.background='var(--bg-secondary)'" onmouseout="this.style.background='white'">
                    <div style="width:40px; height:40px; border-radius:50%; background:${c.type === 'buyer' ? '#dbeafe' : '#d1fae5'}; display:flex; align-items:center; justify-content:center; flex-shrink:0;">
                        <i class="ph ph-user" style="color:${c.type === 'buyer' ? '#1d4ed8' : '#047857'}; font-size:18px;"></i>
                    </div>
                    <div style="margin-left:10px; flex:1;">
                        <div style="font-weight:600; font-size:14px;">${c.name || 'İsimsiz'}</div>
                        <div style="font-size:12px; color:#64748b;">
                            ${c.type === 'buyer' ? 'Alıcı' : 'Kiracı'} •
                            Bölge: ${c.region || '-'} •
                            Oda: ${c.room_pref || '-'}
                        </div>
                        <div style="font-size:12px; color:#64748b;">
                            Bütçe: <strong>${c.budget ? parseInt(c.budget).toLocaleString('tr-TR') + ' TL' : 'Belirtilmemiş'}</strong>
                        </div>
                    </div>
                    <div style="display:flex; gap:4px;">
                        ${c.phone ? `<a href="tel:${c.phone}" class="btn btn-sm btn-outline" style="padding:4px 8px; font-size:11px;" onclick="event.stopPropagation()"><i class="ph ph-phone"></i></a>` : ''}
                    </div>
                </div>
            `).join('');
        }

        this.modals.open('matches');
    },

    updateStats() {
        try {
            // Count Listings
            const activeListings = this.data.listings.filter(l => l.status === 'active').length;
            const passiveListings = this.data.listings.filter(l => l.status === 'passive').length;

            // Count Customers
            const customers = this.data.customers.filter(c => c.type === 'buyer' || c.type === 'tenant').length;
            const owners = this.data.customers.filter(c => c.type === 'seller').length;

            // Update DOM
            const elActive = document.getElementById('stat-active-listings');
            const elSold = document.getElementById('stat-sold');
            const elCustomers = document.getElementById('stat-customers');
            const elOwners = document.getElementById('stat-owners');
            const elFindings = document.getElementById('stat-findings');

            if (elActive) elActive.textContent = activeListings;
            if (elSold) elSold.textContent = passiveListings;
            if (elCustomers) elCustomers.textContent = customers;
            if (elOwners) elOwners.textContent = owners;
            if (elFindings) elFindings.textContent = (this.data.findings || []).length;

            // Render neighborhood stats
            this.renderNeighborhoodStats();

        } catch (e) {
            console.error("Error updating stats:", e);
        }
    },

    renderNeighborhoodStats() {
        const container = document.getElementById('neighborhood-stats-list');
        if (!container) return;

        // Count listings by neighborhood
        const neighborhoodCounts = {};
        this.data.listings.forEach(listing => {
            if (listing.status === 'active' && listing.location) {
                const parts = listing.location.split(',').map(s => s.trim());
                const neighborhood = parts[0] || 'Diğer';
                neighborhoodCounts[neighborhood] = (neighborhoodCounts[neighborhood] || 0) + 1;
            }
        });

        // Sort by count descending
        const sorted = Object.entries(neighborhoodCounts)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 10); // Top 10

        if (sorted.length === 0) {
            container.innerHTML = '<div class="empty-state" style="padding: 20px 0;">Veri yok.</div>';
            return;
        }

        const maxCount = sorted[0][1];
        container.innerHTML = sorted.map(([name, count]) => {
            const percent = (count / maxCount) * 100;
            return `
                <div onclick="app.filterListingsByNeighborhood('${name}')" 
                     style="display: flex; align-items: center; gap: 10px; cursor: pointer; padding: 6px; border-radius: 6px; transition: background 0.2s;"
                     onmouseover="this.style.background='rgba(0,0,0,0.03)'"
                     onmouseout="this.style.background='transparent'">
                    <div style="flex: 1; font-size: 14px; color: #374151;">${name}</div>
                    <div style="width: 120px; background: #e5e7eb; border-radius: 4px; height: 8px; position: relative;">
                        <div style="position: absolute; left: 0; top: 0; height: 100%; background: var(--primary); border-radius: 4px; width: ${percent}%;"></div>
                    </div>
                    <div style="min-width: 30px; text-align: right; font-weight: 600; color: var(--primary);">${count}</div>
                </div>
            `;
        }).join('');
    },

    manualSubmitAddListing(e) {
        if (e) e.preventDefault();
        if (window.log) window.log("Manual Submit Clicked");
        const form = document.getElementById('form-add-listing');
        if (form) {
            app.addListing(new FormData(form));
        } else {
            alert("Form bulunamadı!");
        }
    },
};

// Initialize App


// global trigger functions (to ensure accessibility)
window.triggerEditCustomer = function (id) {
    if (window.app) {
        window.app.editCustomer(Number(id));
    } else {
        alert("Uygulama yüklenemedi!");
    }
};

window.triggerFindMatches = function (id) {
    console.log("Trigger Find Matches:", id);
    if (window.app) {
        window.app.findMatches(Number(id));
    } else {
        console.error("App not found!");
        alert("Uygulama hazır değil.");
    }
};

// --- STATUS UPDATE LOGIC ---
app.toggleListingMenu = function (event, id) {
    event.stopPropagation(); // Stop card click

    const menu = document.getElementById(`menu-${id}`);
    const allMenus = document.querySelectorAll('.context-menu-dropdown');

    // Close others
    allMenus.forEach(m => {
        if (m.id !== `menu-${id}`) m.classList.remove('active');
    });

    if (menu) menu.classList.toggle('active');
};

// Close menus when clicking outside
document.addEventListener('click', (e) => {
    if (!e.target.closest('.listing-menu-btn') && !e.target.closest('.context-menu-dropdown')) {
        document.querySelectorAll('.context-menu-dropdown').forEach(m => m.classList.remove('active'));
    }
});

app.openAddListingModal = function (id, mode = 'listing') {
    window.currentAddMode = mode;
    const title = mode === 'finding' ? 'Yeni Bulum Ekle' : 'Yeni İlan Ekle';
    const btnText = mode === 'finding' ? 'Bulum Kaydet' : 'Kaydet';

    // Reset form
    const form = document.getElementById('form-add-listing');
    if (form) {
        form.reset();
        delete form.dataset.editId;
        localStorage.removeItem('rea_temp_edit_id');
        window.currentEditId = null;
    }

    const header = document.querySelector('#modal-add-listing h3');
    if (header) header.textContent = id ? 'Düzenle' : title;

    const btn = document.querySelector('#form-add-listing button.btn-primary');
    if (btn) btn.textContent = id ? 'Güncelle' : btnText;

    if (id) {
        // Handled by openEditListingModal
        this.openEditListingModal(id);
    } else {
        this.modals.open('add-listing');
    }
};

app.openEditListingModal = function (id) {
    let item = this.data.listings.find(x => x.id === id);
    let mode = 'listing';

    if (!item) {
        item = this.data.findings.find(x => x.id === id);
        mode = 'finding';
    }

    if (!item) return;

    window.currentAddMode = mode;
    const header = document.querySelector('#modal-add-listing h3');
    if (header) header.textContent = mode === 'finding' ? 'Bulum Düzenle' : 'İlan Düzenle';

    this.modals.open('add-listing');

    const form = document.getElementById('form-add-listing');
    if (!form) return;

    localStorage.setItem('rea_temp_edit_id', item.id); // Persistent storage
    if (window.log) window.log("Edit Open: ID stored=" + item.id);

    form.title.value = item.title;
    form.price.value = item.price ? parseInt(item.price).toLocaleString('tr-TR') : '';

    // Parse Location
    if (item.location) {
        const parts = item.location.split(',').map(s => s.trim());
        if (parts.length >= 2) {
            const dist = parts[parts.length - 2];
            const neigh = parts[parts.length - 3];

            const distSelect = document.getElementById('listing-district');
            if (distSelect && dist) {
                distSelect.value = dist;
                if (app.onListingDistrictChange) app.onListingDistrictChange();
                setTimeout(() => {
                    const neighSelect = document.getElementById('listing-neighborhood');
                    if (neighSelect && neigh) neighSelect.value = neigh;
                }, 50);
            }
        }
    }

    // Set Fields
    const fields = ['type', 'status', 'rooms', 'size_net', 'size_gross', 'floor_current', 'floor_total', 'building_age', 'damage', 'interior_condition', 'facade', 'deed_status', 'kitchen', 'details', 'external_link', 'owner_name', 'owner_phone'];
    fields.forEach(f => {
        if (form[f]) form[f].value = item[f] || '';
    });

    form.dataset.editId = item.id;

    document.querySelector('#modal-add-listing h3').textContent = 'İlanı Düzenle';
    document.querySelector('#form-add-listing button[type="submit"]').textContent = 'Güncelle';
};

app.addListing = function (formData) {
    try {
        const mode = window.currentAddMode || 'listing';
        const targetArray = mode === 'finding' ? app.data.findings : app.data.listings;
        const targetKey = mode === 'finding' ? 'findings' : 'listings';

        const fileInput = document.getElementById('listing-photos');
        if (!fileInput) throw new Error("listing-photos element missing");
        const files = fileInput.files;
        const form = document.getElementById('form-add-listing');
        // Storage option: Valid robust retrieval
        const editId = localStorage.getItem('rea_temp_edit_id');
        if (window.log) window.log("AddListing: ID from Storage=" + editId);

        const saveItem = (photos = []) => {
            let finalPhotos = photos;

            let existingIndex = -1;
            if (editId) {
                existingIndex = targetArray.findIndex(x => x.id == editId);
                if (window.log) window.log("Search Result: Index=" + existingIndex + " for ID=" + editId);
            } else {
                if (window.log) window.log("Search Skipped: No ID");
            }

            if (editId) {
                const existing = targetArray.find(x => x.id == editId);
                if (existing) {
                    if (photos.length > 0) {
                        finalPhotos = [...(existing.photos || []), ...photos];
                    } else {
                        finalPhotos = existing.photos || [];
                    }
                }
            }

            const district = document.getElementById('listing-district').value;
            const neighborhood = document.getElementById('listing-neighborhood').value;
            const street = formData.get('street') || '';
            const location = `${neighborhood}, ${district}, Adana`;

            const newItem = {
                id: editId ? Number(editId) : Date.now(),
                title: formData.get('title'),
                price: formData.get('price').replace(/\./g, ''),
                location: location,
                street: street,
                type: formData.get('type'),
                status: formData.get('status'),
                rooms: formData.get('rooms'),
                size_net: formData.get('size_net'),
                size_gross: formData.get('size_gross'),
                floor_current: formData.get('floor_current'),
                floor_total: formData.get('floor_total'),
                building_age: formData.get('building_age'),
                damage: formData.get('damage'),
                interior_condition: formData.get('interior_condition'),
                facade: formData.get('facade'),
                deed_status: formData.get('deed_status'),
                site_features: formData.get('site_features'),
                kitchen: formData.get('kitchen'),
                details: formData.get('details'),
                external_link: formData.get('external_link'),
                owner_name: formData.get('owner_name'),
                owner_phone: formData.get('owner_phone'),
                photos: finalPhotos,
                date: editId ? (targetArray.find(x => x.id == editId) || {}).date : new Date().toISOString()
            };

            if (editId) {
                const idx = targetArray.findIndex(x => x.id == editId);
                if (idx > -1) targetArray[idx] = newItem;

                delete form.dataset.editId;
                const header = document.querySelector('#modal-add-listing h3');
                if (header) header.textContent = 'Yeni İlan Ekle';

                const btn = document.querySelector('#form-add-listing button.btn-primary');
                if (btn) btn.textContent = 'Kaydet';
            } else {
                targetArray.push(newItem);
            }

            app.saveData(targetKey);

            if (mode === 'finding') {
                app.renderFindings();
            } else {
                app.renderListings();
                app.updateStats();
            }

            app.modals.closeAll();
            localStorage.removeItem('rea_temp_edit_id');
            form.reset();
        };

        if (files.length > 0) {
            const processAndStore = async (file) => {
                const base64 = await app.compressPhoto(file);
                const id = await app.photoStore.savePhoto(base64, targetKey, editId || Date.now());
                if (id) {
                    app._photoCache[id] = base64;
                    return id;
                }
                return base64; // fallback: IndexedDB kullanılamıyorsa inline base64
            };

            Promise.all(Array.from(files).map(processAndStore)).then(photos => {
                saveItem(photos);
            });

        } else {
            saveItem([]);
        }
    } catch (e) {
        if (window.log) window.log("ERROR in addListing: " + e.message);
        alert("CRITICAL ERROR IN ADDLISTING: " + e.message);
        console.error(e);
    }
};


// --- LISTING CONTEXT MENU & STATUS LOGIC ---
app.toggleListingMenu = function (event, id) {
    event.stopPropagation();
    // Use relative DOM traversal to avoid duplicate ID issues
    const card = event.target.closest('.listing-card');
    const menu = card ? card.querySelector('.context-menu-dropdown') : null;
    if (menu) {
        // Close others
        document.querySelectorAll('.context-menu-dropdown').forEach(m => {
            if (m !== menu) m.classList.remove('active');
        });
        menu.classList.toggle('active');
    }
};

// Close menus when clicking outside
document.addEventListener('click', (e) => {
    if (!e.target.closest('.listing-menu-btn') && !e.target.closest('.context-menu-dropdown')) {
        document.querySelectorAll('.context-menu-dropdown').forEach(m => m.classList.remove('active'));
    }
});

app.addListingNote = function (id, text, color = 'green') {
    const item = this.data.listings.find(x => x.id == id);
    if (!item) return;

    const dateStr = new Date().toLocaleDateString('tr-TR');
    const newNote = `[${dateStr}] ${text}`;

    item.notes = item.notes ? item.notes + '\n' + newNote : newNote;
    this.saveData('listings');
    this.renderListings();

    // Color configs
    const colors = {
        green: { bg: '#dcfce7', border: '#16a34a', text: '#166534', icon: 'ph-check-circle' },
        red: { bg: '#fee2e2', border: '#dc2626', text: '#991b1b', icon: 'ph-x-circle' },
        yellow: { bg: '#fef3c7', border: '#f59e0b', text: '#92400e', icon: 'ph-warning' }
    };
    const c = colors[color] || colors.green;

    // Refresh finder-results if modal is open
    const finderContainer = document.getElementById('finder-results');
    if (finderContainer && finderContainer.innerHTML) {
        const card = finderContainer.querySelector(`[onclick*="${id}"]`);
        if (card) {
            card.style.boxShadow = `0 0 0 2px ${c.border}`;
            const notePreview = document.createElement('div');
            notePreview.style.cssText = `background:${c.bg}; padding:6px 8px; font-size:11px; color:${c.text}; margin-top:8px; border-radius:4px;`;
            notePreview.innerHTML = `<i class="ph ${c.icon}"></i> ${newNote}`;
            card.appendChild(notePreview);
        }
    }
};

app.handleStatusUpdate = function (event, id, newStatus) {
    event.stopPropagation();
    const menu = document.getElementById(`menu-${id}`);
    if (menu) menu.classList.remove('active');

    // Feedback Options — müşteriye kaydet
    if (newStatus === 'begenildi' || newStatus === 'sicak_bakiyor' || newStatus === 'begenilmedi' || newStatus === 'fiyat_yuksek') {
        if (!this.currentFinderCustomerId) return;
        const customer = this.data.customers.find(c => c.id == this.currentFinderCustomerId);
        if (!customer) return;

        const statusText = {
            'begenildi': '✅ Beğenildi',
            'sicak_bakiyor': '🔥 Sıcak Bakıyor',
            'begenilmedi': '👎 Beğenilmedi',
            'fiyat_yuksek': '📈 Fiyat Yüksek'
        };

        if (!customer.interactions) customer.interactions = {};
        const currentNote = (customer.interactions[id] || {}).note || '';
        let newNote = `[${new Date().toLocaleDateString('tr-TR')}] ${statusText[newStatus]}`;
        if (currentNote) newNote = currentNote + '\n' + newNote;

        customer.interactions[id] = {
            status: newStatus,
            note: newNote,
            date: new Date().toISOString()
        };

        this.saveData('customers');
        this.saveToFirestore(true);
        this.findMatches(this.currentFinderCustomerId);
        return;
    }

    if (newStatus === 'cancelled') {
        if (confirm('Bu ilanı "İptal/Vazgeçildi" olarak işaretlemek istediğinize emin misiniz?')) {
            this.updateListingStatus(id, 'cancelled', 0, 'İptal edildi');
        }
        return;
    }

    // Open Modal for Sold/Deposit
    const modalId = 'modal-status-update';
    document.getElementById('status-update-id').value = id;
    document.getElementById('status-update-type').value = newStatus;

    const titleEl = document.getElementById('status-modal-title');
    const listing = this.data.listings.find(l => l.id == id);
    const listingPrice = listing ? parseInt(listing.price).toLocaleString('tr-TR') : '0';

    if (newStatus === 'sold') {
        titleEl.textContent = 'Satış Bilgisi Giriniz';
        document.getElementById('status-final-price').placeholder = listingPrice;
    } else {
        titleEl.textContent = 'Kapora Bilgisi Girinız';
        document.getElementById('status-final-price').placeholder = 'Kapora tutarı...';
    }

    // Clear previous inputs
    document.getElementById('status-final-price').value = '';
    document.getElementById('status-notes').value = '';

    // Set Default Date to Today
    const today = new Date().toISOString().split('T')[0];
    document.getElementById('status-date').value = today;

    this.modals.open('status-update');
};

app.updateListingStatus = function (id, status, price, notes, date) {
    const listingIndex = this.data.listings.findIndex(l => l.id == id);
    if (listingIndex > -1) {
        const listing = this.data.listings[listingIndex];

        // Update fields
        listing.status = status;
        listing.final_price = price;
        listing.status_notes = notes;
        listing.status_date = date ? new Date(date).toISOString() : new Date().toISOString();

        this.saveData('listings');
        this.renderListings();
        this.updateStats();
        this.modals.closeAll();
    }
};

// Form Handler (Ensure duplicate listener check if necessary, or just add it safely)
// Since this is inside app.js body which runs once, it's fine.
const statusForm = document.getElementById('form-status-update');
if (statusForm) {
    // Clone to remove old listeners to prevent duplicates if app.js reloaded (hacky but safe)
    const newForm = statusForm.cloneNode(true);
    statusForm.parentNode.replaceChild(newForm, statusForm);
    newForm.addEventListener('submit', function (e) {
        e.preventDefault();
        const id = Number(document.getElementById('status-update-id').value);
        const status = document.getElementById('status-update-type').value;
        const priceStr = document.getElementById('status-final-price').value;
        const price = parseInt(priceStr.replace(/\./g, '')) || 0;
        const notes = document.getElementById('status-notes').value;
        const date = document.getElementById('status-date').value;

        app.updateListingStatus(id, status, price, notes, date);
    });
}


// --- RESTORED FSBO RENDER LOGIC ---
app.renderFsboList = function () {
    const container = document.getElementById('fsbo-list');
    const renewedContainer = document.getElementById('fsbo-renewed-list');
    const renewedSection = document.getElementById('fsbo-renewed-section');
    const renewedCount = document.getElementById('fsbo-renewed-count');
    const statsContainer = document.getElementById('fsbo-stats');
    if (!container) return;

    container.innerHTML = '';
    if (renewedContainer) renewedContainer.innerHTML = '';

    const items = this.data.fsbo || [];
    if (items.length === 0) {
        container.innerHTML = '<div class="empty-state">Henüz kayıtlı FSBO fırsatı yok.</div>';
        if (statsContainer) statsContainer.innerHTML = '';
        if (renewedSection) renewedSection.style.display = 'none';
        return;
    }

    // Separate renewed from regular listings
    const renewedListings = items.filter(item => item.status && item.status.includes('Yenilemiş'));
    const regularListings = items.filter(item => !item.status || !item.status.includes('Yenilemiş'));

    // Calculate statistics
    const stats = {};
    items.forEach(item => {
        const status = item.status || 'Belirtilmemiş';
        stats[status] = (stats[status] || 0) + 1;
    });

    // Render statistics
    if (statsContainer) {
        const total = items.length;
        const statsParts = [`<strong>Toplam:</strong> ${total}`];
        Object.keys(stats).sort().forEach(status => {
            statsParts.push(`<strong>${status}:</strong> ${stats[status]}`);
        });
        statsContainer.innerHTML = statsParts.join(' | ');
    }

    // Update renewed section visibility and count
    if (renewedSection) {
        if (renewedListings.length > 0) {
            renewedSection.style.display = 'block';
            if (renewedCount) renewedCount.textContent = renewedListings.length;
        } else {
            renewedSection.style.display = 'none';
        }
    }

    // Sort: Earliest end_date first
    const sortFn = (a, b) => {
        if (!a.end_date && !b.end_date) return 0;
        if (!a.end_date) return 1;
        if (!b.end_date) return -1;
        return new Date(a.end_date) - new Date(b.end_date);
    };
    const sortedRegular = [...regularListings].sort(sortFn);
    const sortedRenewed = [...renewedListings].sort(sortFn);

    // Helper to create card
    const createFsboCard = (item) => {
        const card = document.createElement('div');
        card.className = 'listing-card';
        card.style.cursor = 'pointer';
        card.onclick = (e) => {
            if (e.target.closest('button, a, .fsbo-gallery')) return;
            app.openFsboDetail(item.id);
        };

        let statusColor = '#64748b'; // gray
        if (item.status && item.status.includes('Randevu')) statusColor = '#d97706'; // orange
        if (item.status && item.status.includes('Olumsuz')) statusColor = '#991b1b'; // red
        if (item.status && item.status.includes('Portföy')) statusColor = '#16a34a'; // green

        // Photo handling
        let photoArray = [];
        if (item.photos && Array.isArray(item.photos)) photoArray = item.photos;
        else if (item.photo) photoArray = [item.photo];

        let galleryHtml = '';
        if (photoArray.length > 0) {
            const photosInner = photoArray.map((src, idx) => {
                if (app.isPhotoRef(src)) {
                    return `<img data-photo-id="${src}" class="fsbo-photo-thumb" data-fsbo-id="${item.id}" data-photo-idx="${idx}" style="width:80px; height:80px; object-fit:cover; border-radius:4px; border:1px solid #e2e8f0; cursor:pointer; -webkit-tap-highlight-color:transparent; background:#f1f5f9;">`;
                }
                return `<img src="${src}" class="fsbo-photo-thumb" data-fsbo-id="${item.id}" data-photo-idx="${idx}" style="width:80px; height:80px; object-fit:cover; border-radius:4px; border:1px solid #e2e8f0; cursor:pointer; -webkit-tap-highlight-color:transparent;">`;
            }).join('');
            galleryHtml = `<div class="fsbo-gallery" style="display:flex; gap:5px; margin-bottom:10px; overflow-x:auto; padding-bottom:5px;">${photosInner}</div>`;
        }

        card.innerHTML = `
            <div class="card-content" style="padding:15px;">
                <div style="display:flex; gap:15px;">
                    <div style="flex:1;">
                        <div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:5px;">
                            <div>
                                <h4 style="margin:0; font-size:16px;">${item.owner || '?'}</h4>
                                <div style="font-size:12px; color:#64748b;">${item.district || ''} / ${item.neighborhood || ''}</div>
                            </div>
                            <span class="badge" style="background:${statusColor}; color:white; font-size:11px; padding:2px 6px; border-radius:4px;">${item.status || '-'}</span>
                        </div>
                        
                        <div style="font-size:15px; color:#1e293b; font-weight:700; margin-bottom:5px;">
                            ${parseInt(item.price || 0).toLocaleString('tr-TR')} TL
                        </div>
                        
                        ${(item.rooms || item.floor_current || item.building_age || item.building_name) ? `
                        <div style="font-size:11px; color:#475569; margin-bottom:8px; display:flex; gap:8px; flex-wrap:wrap;">
                            ${item.rooms ? `<span style="background:#e0f2fe; padding:2px 6px; border-radius:4px;"><i class="ph ph-house"></i> ${item.rooms}</span>` : ''}
                            ${item.floor_current ? `<span style="background:#fef3c7; padding:2px 6px; border-radius:4px;"><i class="ph ph-stairs"></i> ${item.floor_current}${item.floor_total ? '/' + item.floor_total : ''}</span>` : ''}
                            ${item.building_age ? `<span style="background:#f1f5f9; padding:2px 6px; border-radius:4px;"><i class="ph ph-calendar-blank"></i> ${item.building_age} yaş</span>` : ''}
                            ${item.building_name ? `<span style="background:#fce7f3; padding:2px 6px; border-radius:4px;"><i class="ph ph-buildings"></i> ${item.building_name}</span>` : ''}
                        </div>` : ''}
                        
                        <div style="font-size:12px; color:#64748b; display:flex; gap:10px; flex-wrap:wrap; margin-bottom:8px;">
                            ${(() => {
                                const firstDate = item.dateHistory && item.dateHistory.length > 0 ? item.dateHistory[0].start : item.start_date;
                                if (!firstDate) return '';
                                const diffMs = Date.now() - new Date(firstDate).getTime();
                                const diffDays = Math.floor(diffMs / 86400000);
                                const diffMonths = Math.floor(diffDays / 30);
                                const ageText = diffMonths > 0 ? diffMonths + ' aydır ilanda' : diffDays + ' gündür ilanda';
                                return '<span style="background:#fef3c7; color:#92400e; padding:2px 6px; border-radius:4px; font-weight:600;"><i class="ph ph-clock-countdown"></i> ' + ageText + '</span>';
                            })()}
                            ${item.start_date ? `<span><i class="ph ph-calendar-plus"></i> ${new Date(item.start_date).toLocaleDateString('tr-TR')}</span>` : ''}
                            ${item.end_date ? `<span style="color:#d97706"><i class="ph ph-calendar-x"></i> ${new Date(item.end_date).toLocaleDateString('tr-TR')}</span>` : ''}
                            ${item.dateHistory && item.dateHistory.length > 0 ? `<span style="background:#e0f2fe; color:#1e40af; padding:2px 6px; border-radius:4px;"><i class="ph ph-arrows-clockwise"></i> ${item.dateHistory.length}x yenilendi</span>` : ''}
                        </div>
                        ${item.priceHistory && item.priceHistory.length > 0 ? `
                        <div style="font-size:11px; color:#64748b; margin-bottom:6px; display:flex; gap:6px; flex-wrap:wrap; align-items:center;">
                            <i class="ph ph-chart-line-down" style="color:#9ca3af;"></i>
                            ${item.priceHistory.map(p => '<s>' + parseInt(p.price).toLocaleString('tr-TR') + '</s>').join(' → ')} → <strong style="color:#1e293b;">${parseInt(item.price || 0).toLocaleString('tr-TR')} TL</strong>
                        </div>` : ''}
                    </div>
                </div>

                ${galleryHtml}
                
                <div style="margin:10px 0; border-top:1px dashed #e2e8f0; padding-top:10px;">
                     <div style="margin-bottom:8px; font-size:13px; color:#334155;">
                        ${item.phone ?
                `<a href="tel:${item.phone.replace(/\s/g, '')}" style="text-decoration:none; color:inherit; display:inline-flex; align-items:center; gap:6px;">
                            <i class="ph ph-phone" style="vertical-align:middle; color:#64748b"></i> 
                            <span style="font-weight:600; font-size:14px;">${item.phone}</span>
                            <span style="background:#dcfce7; color:#166534; padding:2px 6px; border-radius:4px; font-size:10px; display:flex; align-items:center; gap:4px;"><i class="ph ph-phone-call"></i> ARA</span>
                         </a>`
                :
                `<span><i class="ph ph-phone" style="vertical-align:middle; color:#64748b"></i> -</span>`}
                    </div>

                    ${item.link ? `
                    <div style="margin-bottom:8px;">
                        <a href="${item.link}" target="_blank" style="color:var(--primary); font-size:13px; text-decoration:underline;">
                            İlana Git <i class="ph ph-arrow-square-out"></i>
                        </a>
                    </div>` : ''}
                    
                    ${item.notes ? `
                    <div onclick="this.style.webkitLineClamp = this.style.webkitLineClamp ? '' : 'inherit'; this.style.display = this.style.display === 'block' ? '-webkit-box' : 'block'" 
                         style="background:#f8fafc; padding:8px; border-radius:4px; font-size:12px; color:#475569; font-style:italic; cursor:pointer; overflow:hidden; display:-webkit-box; -webkit-line-clamp:2; -webkit-box-orient:vertical;">
                        "${item.notes}"
                    </div>` : ''}
                </div>
                
                <div style="display:flex; gap:10px; margin-top:10px;">
                     <button class="btn btn-sm btn-outline" onclick="app.deleteFsbo('${item.id}')" title="Sil"><i class="ph ph-trash" style="color:#ef4444;"></i></button>
                     <button class="btn btn-sm btn-outline" onclick="app.populateEditFsbo('${item.id}')" title="Düzenle"><i class="ph ph-pencil-simple" style="color:var(--primary);"></i></button>
                     <button class="btn btn-sm btn-outline" onclick="app.renewFsboListing('${item.id}')" title="İlanı Yenile" style="color:#16a34a; border-color:#16a34a;"><i class="ph ph-arrows-clockwise"></i></button>
                     <button class="btn btn-sm btn-outline" onclick="app.openFsboStatusModal('${item.id}')" style="color:var(--dark); border-color:#cbd5e1;">Durum</button>
                </div>
            </div>`;
        return card;
    };

    if (sortedRegular.length > 0) {
        sortedRegular.forEach(item => container.appendChild(createFsboCard(item)));
    } else {
        container.innerHTML = '<div class="empty-state" style="padding: 20px;">Tüm ilanlar yenilenmiş durumda.</div>';
    }

    if (renewedContainer && sortedRenewed.length > 0) {
        sortedRenewed.forEach(item => renewedContainer.appendChild(createFsboCard(item)));
    }

    // IndexedDB'den fotoğrafları çöz
    this.resolveRenderedPhotos(container);
    if (renewedContainer) this.resolveRenderedPhotos(renewedContainer);
};

app.renewFsboListing = function (id) {
    const item = this.data.fsbo.find(x => x.id === id);
    if (!item) return;

    // Fiyat sor
    const currentPrice = item.price ? parseInt(item.price).toLocaleString('tr-TR') : '';
    const newPriceInput = prompt(`Güncel fiyat (şu an: ${currentPrice} TL):`, currentPrice);
    if (newPriceInput === null) return; // iptal

    const newPrice = newPriceInput.replace(/\./g, '').replace(/\D/g, '');

    // Fiyat geçmişine kaydet
    if (!item.priceHistory) item.priceHistory = [];
    if (item.price) {
        item.priceHistory.push({
            price: item.price,
            date: new Date().toISOString()
        });
    }
    if (newPrice) item.price = newPrice;

    // Tarih geçmişine kaydet
    if (!item.dateHistory) item.dateHistory = [];
    if (item.start_date && item.end_date) {
        item.dateHistory.push({ start: item.start_date, end: item.end_date });
    }

    const today = new Date();
    const todayStr = today.toISOString().split('T')[0];
    const oneMonthLater = new Date(today);
    oneMonthLater.setMonth(oneMonthLater.getMonth() + 1);
    const endStr = oneMonthLater.toISOString().split('T')[0];

    item.start_date = todayStr;
    item.end_date = endStr;
    item.status = 'İlanı Yenilemiş';

    this.saveData('fsbo');
    this.renderFsboList();

    // Fiyat değişimi varsa göster
    const oldPrice = item.priceHistory.length > 0 ? parseInt(item.priceHistory[item.priceHistory.length - 1].price) : 0;
    const np = parseInt(item.price) || 0;
    let msg = 'İlan Yenilendi!';
    if (oldPrice && np && oldPrice !== np) {
        const diff = np - oldPrice;
        const pct = ((diff / oldPrice) * 100).toFixed(0);
        msg += diff > 0
            ? `\nFiyat artışı: +${diff.toLocaleString('tr-TR')} TL (%${pct})`
            : `\nFiyat düşüşü: ${diff.toLocaleString('tr-TR')} TL (%${pct})`;
    }
    alert(msg);
};

app.openFsboDetail = function (id) {
    const item = this.data.fsbo.find(x => x.id === id);
    if (!item) return;

    let statusColor = '#64748b';
    if (item.status && item.status.includes('Randevu')) statusColor = '#d97706';
    if (item.status && item.status.includes('Olumsuz')) statusColor = '#991b1b';
    if (item.status && item.status.includes('Portföy')) statusColor = '#16a34a';

    let photoArray = [];
    if (item.photos && Array.isArray(item.photos)) photoArray = item.photos;
    else if (item.photo) photoArray = [item.photo];

    const photoHtml = photoArray.length > 0
        ? `<div id="fsbo-detail-photos" style="display:flex; gap:8px; flex-wrap:wrap; margin-bottom:16px;">
            ${photoArray.map(src => {
                if (app.isPhotoRef(src)) {
                    return `<img data-photo-id="${src}" style="width:120px; height:120px; object-fit:cover; border-radius:8px; border:1px solid #e2e8f0; cursor:pointer; background:#f1f5f9;" onclick="app.openLightbox(this.src)">`;
                }
                return `<img src="${src}" style="width:120px; height:120px; object-fit:cover; border-radius:8px; border:1px solid #e2e8f0; cursor:pointer;" onclick="app.openLightbox(this.src)">`;
            }).join('')}
           </div>`
        : '';

    const row = (icon, label, value) => value
        ? `<div style="display:flex; align-items:center; gap:10px; padding:8px 0; border-bottom:1px solid #f1f5f9;">
            <i class="ph ph-${icon}" style="color:#64748b; font-size:16px; width:20px; text-align:center;"></i>
            <span style="color:#64748b; font-size:13px; min-width:100px;">${label}</span>
            <span style="font-size:14px; color:#1e293b; font-weight:500;">${value}</span>
           </div>`
        : '';

    // İlan yaşı hesapla
    const firstDate = item.dateHistory && item.dateHistory.length > 0 ? item.dateHistory[0].start : item.start_date;
    let ageHtml = '';
    if (firstDate) {
        const diffMs = Date.now() - new Date(firstDate).getTime();
        const diffDays = Math.floor(diffMs / 86400000);
        const diffMonths = Math.floor(diffDays / 30);
        const ageText = diffMonths > 0 ? diffMonths + ' aydır ilanda' : diffDays + ' gündür ilanda';
        ageHtml = `<span style="background:#fef3c7; color:#92400e; padding:4px 10px; border-radius:6px; font-size:12px; font-weight:600;"><i class="ph ph-clock-countdown"></i> ${ageText}</span>`;
    }

    // Fiyat geçmişi
    let priceHistoryHtml = '';
    if (item.priceHistory && item.priceHistory.length > 0) {
        priceHistoryHtml = `
        <div style="background:#fef2f2; padding:10px 12px; border-radius:8px; margin-bottom:16px; border-left:3px solid #f59e0b;">
            <div style="font-size:11px; color:#92400e; margin-bottom:6px; font-weight:600;"><i class="ph ph-chart-line"></i> Fiyat Geçmişi</div>
            ${item.priceHistory.map((p, i) => {
                const prev = i === 0 ? null : parseInt(item.priceHistory[i - 1].price);
                const cur = parseInt(p.price);
                let changeHtml = '';
                if (prev) {
                    const diff = cur - prev;
                    if (diff > 0) changeHtml = ' <span style="color:#dc2626; font-size:11px;">+' + diff.toLocaleString('tr-TR') + '</span>';
                    else if (diff < 0) changeHtml = ' <span style="color:#16a34a; font-size:11px;">' + diff.toLocaleString('tr-TR') + '</span>';
                }
                return '<div style="font-size:12px; color:#64748b; padding:2px 0;">' + new Date(p.date).toLocaleDateString('tr-TR') + ' — <s>' + cur.toLocaleString('tr-TR') + ' TL</s>' + changeHtml + '</div>';
            }).join('')}
            <div style="font-size:13px; color:#1e293b; font-weight:700; padding-top:4px; border-top:1px solid #fde68a; margin-top:4px;">
                Güncel: ${parseInt(item.price || 0).toLocaleString('tr-TR')} TL
                ${(() => {
                    const firstP = parseInt(item.priceHistory[0].price);
                    const curP = parseInt(item.price || 0);
                    if (!firstP || !curP || firstP === curP) return '';
                    const d = curP - firstP;
                    const pct = ((d / firstP) * 100).toFixed(0);
                    return d > 0
                        ? ' <span style="color:#dc2626; font-size:11px;">(+' + pct + '%)</span>'
                        : ' <span style="color:#16a34a; font-size:11px;">(' + pct + '%)</span>';
                })()}
            </div>
        </div>`;
    }

    document.getElementById('fsbo-detail-title').textContent = item.owner || 'FSBO Detay';
    document.getElementById('fsbo-detail-body').innerHTML = `
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:16px; flex-wrap:wrap; gap:8px;">
            <div style="font-size:22px; font-weight:700; color:#1e293b;">${parseInt(item.price || 0).toLocaleString('tr-TR')} TL</div>
            <div style="display:flex; gap:6px; align-items:center;">
                ${ageHtml}
                <span style="background:${statusColor}; color:white; font-size:12px; padding:4px 10px; border-radius:6px;">${item.status || '-'}</span>
            </div>
        </div>

        ${priceHistoryHtml}
        ${photoHtml}

        <div style="margin-bottom:16px;">
            ${row('map-pin', 'Konum', (item.district || '') + (item.neighborhood ? ' / ' + item.neighborhood : ''))}
            ${row('house', 'Oda', item.rooms)}
            ${row('stairs', 'Kat', item.floor_current ? item.floor_current + (item.floor_total ? ' / ' + item.floor_total : '') : '')}
            ${row('calendar-blank', 'Bina Yaşı', item.building_age ? item.building_age + ' yıl' : '')}
            ${row('buildings', 'Bina Adı', item.building_name)}
            ${row('phone', 'Telefon', item.phone ? '<a href="tel:' + item.phone.replace(/\\s/g, '') + '" style="color:#1e293b; text-decoration:none; font-weight:600;">' + item.phone + '</a>' : '')}
            ${row('calendar-plus', 'İlk İlan', firstDate ? new Date(firstDate).toLocaleDateString('tr-TR') : '')}
            ${row('calendar-plus', 'Son Yenileme', item.start_date ? new Date(item.start_date).toLocaleDateString('tr-TR') : '')}
            ${row('calendar-x', 'Bitiş', item.end_date ? new Date(item.end_date).toLocaleDateString('tr-TR') : '')}
            ${row('arrows-clockwise', 'Yenilenme', item.dateHistory && item.dateHistory.length > 0 ? item.dateHistory.length + ' kez' : '')}
        </div>

        ${item.link ? `<a href="${item.link}" target="_blank" style="display:inline-flex; align-items:center; gap:6px; color:#3b82f6; font-size:13px; margin-bottom:12px;">
            <i class="ph ph-arrow-square-out"></i> İlana Git
        </a>` : ''}

        ${item.notes ? `
        <div style="background:#f8fafc; padding:12px; border-radius:8px; border-left:3px solid #d1d5db; margin-bottom:16px;">
            <div style="font-size:11px; color:#9ca3af; margin-bottom:4px;"><i class="ph ph-note-pencil"></i> Notlar</div>
            <div style="font-size:13px; color:#475569; white-space:pre-wrap; line-height:1.5;">${item.notes}</div>
        </div>` : ''}

        <div style="display:flex; gap:8px; border-top:1px solid #e5e7eb; padding-top:14px;">
            <button class="btn btn-sm" onclick="app.modals.closeAll(); app.populateEditFsbo('${item.id}')" style="flex:1; background:#4f46e5; color:white; border:none; border-radius:8px; padding:10px; font-size:13px; cursor:pointer;">
                <i class="ph ph-pencil-simple"></i> Düzenle
            </button>
            <button class="btn btn-sm" onclick="app.openFsboStatusModal('${item.id}')" style="flex:1; background:#f3f4f6; color:#374151; border:none; border-radius:8px; padding:10px; font-size:13px; cursor:pointer;">
                <i class="ph ph-tag"></i> Durum
            </button>
            <button class="btn btn-sm" onclick="app.renewFsboListing('${item.id}')" style="background:#dcfce7; color:#166534; border:none; border-radius:8px; padding:10px 14px; font-size:13px; cursor:pointer;">
                <i class="ph ph-arrows-clockwise"></i>
            </button>
        </div>
    `;

    this.modals.open('fsbo-detail');

    // IndexedDB'den fotoğrafları çöz
    this.resolveRenderedPhotos('#fsbo-detail-photos');
};

app.openFsboStatusModal = function (id) {
    document.getElementById('fsbo-status-id').value = id;
    this.modals.open('fsbo-status');
};

app.setFsboStatus = function (status) {
    const id = document.getElementById('fsbo-status-id').value;
    const item = this.data.fsbo.find(x => x.id === id);
    if (item) {
        item.status = status;
        this.saveData('fsbo');
        this.renderFsboList();
        this.modals.closeAll();

        // If status is "Portföyümüze Eklendi", maybe offer to create a real listing?
        // For now just update status.
    }
};

app.populateEditFsbo = function (id) {
    const item = this.data.fsbo.find(x => x.id === id);
    if (!item) return;

    // Open modal
    this.modals.open('add-fsbo');

    // Fill form
    const form = document.getElementById('form-add-fsbo');
    form.owner.value = item.owner;
    form.phone.value = item.phone || '';
    form.price.value = item.price ? parseInt(item.price).toLocaleString('tr-TR') : '';
    form.link.value = item.link || '';
    form.status.value = item.status;
    form.notes.value = item.notes || '';
    form.district.value = item.district || '';

    // Trigger district change to populate neighborhoods, then select neighborhood
    app.onFsboDistrictChange();
    if (item.neighborhood) {
        setTimeout(() => {
            document.getElementById('fsbo-neighborhood').value = item.neighborhood;
        }, 50);
    }

    form.start_date.value = item.start_date || '';
    form.end_date.value = item.end_date || '';

    // Store ID for update
    form.dataset.editId = item.id;

    // Change Title/Button
    document.querySelector('#modal-add-fsbo h3').textContent = 'FSBO Düzenle';
    document.querySelector('#form-add-fsbo button[type="submit"]').textContent = 'Güncelle';

    // Populate Photos Preview
    app.initFsboPhotos(); // Clear first
    if (item.photos && item.photos.length > 0) {
        this.fsboPhotos = [...item.photos];
    } else if (item.photo) {
        this.fsboPhotos = [item.photo];
    }
    this.renderFsboImagePreview();
};

app.addFsbo = function (formData) {
    const form = document.getElementById('form-add-fsbo');
    const editId = form.dataset.editId; // Get ID if editing

    // Use the photos currently in the preview array (already base64)
    const currentPhotos = this.fsboPhotos || [];

    const newItem = {
        id: editId || 'fsbo_' + Date.now(),
        owner: formData.get('owner'),
        district: formData.get('district'),
        neighborhood: formData.get('neighborhood'),
        phone: formData.get('phone'),
        price: formData.get('price') ? formData.get('price').replace(/\./g, '') : 0,
        link: formData.get('link'),
        status: formData.get('status'),
        notes: formData.get('notes'),
        start_date: formData.get('start_date'),
        end_date: formData.get('end_date'),
        // New property detail fields
        rooms: formData.get('rooms'),
        floor_current: formData.get('floor_current'),
        floor_total: formData.get('floor_total'),
        building_age: formData.get('building_age'),
        building_name: formData.get('building_name'),
        photos: currentPhotos,
        date: new Date().toISOString()
    };

    if (!this.data.fsbo) this.data.fsbo = [];

    if (editId) {
        const idx = this.data.fsbo.findIndex(x => x.id === editId);
        if (idx > -1) this.data.fsbo[idx] = newItem;
        // Reset UI state
        delete form.dataset.editId;
        document.querySelector('#modal-add-fsbo h3').textContent = 'Yeni FSBO Fırsatı';
        document.querySelector('#form-add-fsbo button[type="submit"]').textContent = 'Kaydet';
    } else {
        this.data.fsbo.push(newItem);
    }

    this.saveData('fsbo');
    this.renderFsboList();
    this.modals.closeAll();
    form.reset();
    // Clear photos
    this.initFsboPhotos();
};

app.deleteFsbo = function (id) {
    if (confirm('Bu kaydı silmek istediğinize emin misiniz?')) {
        const item = this.data.fsbo.find(x => x.id === id);
        if (item) {
            // IndexedDB'den fotoğrafları sil
            const photoIds = [];
            if (item.photos) item.photos.forEach(p => { if (this.isPhotoRef(p)) photoIds.push(p); });
            if (item.photo && this.isPhotoRef(item.photo)) photoIds.push(item.photo);
            if (photoIds.length > 0) this.photoStore.deletePhotos(photoIds);
        }
        this.data.fsbo = this.data.fsbo.filter(x => x.id !== id);
        this.saveData('fsbo');
        this.renderFsboList();
    }
};

// --- RESTORED SMART FSBO & OCR FEATURES ---
app.fsboPhotos = [];

app.initFsboPhotos = function () {
    this.fsboPhotos = [];
    const preview = document.getElementById('fsbo-image-preview');
    if (preview) preview.innerHTML = '';
    const input = document.getElementById('fsbo-photo-input');
    if (input) input.value = '';
    const smartText = document.getElementById('fsbo-smart-text');
    if (smartText) smartText.value = '';
};

app.handleFsboImagePaste = function (e) {
    if (e.target.tagName === 'TEXTAREA') return;
    e.preventDefault();
    const items = (e.clipboardData || e.originalEvent.clipboardData).items;
    let found = false;
    for (let index in items) {
        const item = items[index];
        if (item.kind === 'file' && item.type.includes('image/')) {
            const blob = item.getAsFile();
            this.addFsboPhoto(blob);
            found = true;
        }
    }
    if (!found) {
        if (window.console) console.log("No image found in paste");
    }
};

app.handleFsboFileSelect = function (input) {
    if (input.files) {
        Array.from(input.files).forEach(file => this.addFsboPhoto(file));
    }
};

app.addFsboPhoto = async function (file) {
    if (this.fsboPhotos.length >= 10) {
        alert("En fazla 10 fotoğraf ekleyebilirsiniz.");
        return;
    }
    const base64 = await this.compressPhoto(file);
    const id = await this.photoStore.savePhoto(base64, 'fsbo', 'pending');
    if (id) {
        this._photoCache[id] = base64;
        this.fsboPhotos.push(id);
    } else {
        this.fsboPhotos.push(base64); // fallback
    }
    this.renderFsboImagePreview();
};

app.renderFsboImagePreview = function () {
    const container = document.getElementById('fsbo-image-preview');
    if (!container) return;
    container.innerHTML = this.fsboPhotos.map((src, index) => {
        if (this.isPhotoRef(src)) {
            return `<div style="position: relative; width: 100%; height: 80px; border-radius: 4px; overflow: hidden; border: 1px solid #ddd; background:white;">
                <img data-photo-id="${src}" style="width: 100%; height: 100%; object-fit: contain;">
                <button onclick="event.stopPropagation(); app.removeFsboPhoto(${index})" style="position: absolute; top: 0; right: 0; background: rgba(220, 38, 38, 0.9); color: white; border: none; width: 22px; height: 22px; cursor: pointer; border-radius: 0 0 0 4px;">&times;</button>
            </div>`;
        }
        return `<div style="position: relative; width: 100%; height: 80px; border-radius: 4px; overflow: hidden; border: 1px solid #ddd; background:white;">
            <img src="${src}" style="width: 100%; height: 100%; object-fit: contain;">
            <button onclick="event.stopPropagation(); app.removeFsboPhoto(${index})" style="position: absolute; top: 0; right: 0; background: rgba(220, 38, 38, 0.9); color: white; border: none; width: 22px; height: 22px; cursor: pointer; border-radius: 0 0 0 4px;">&times;</button>
        </div>`;
    }).join('');
    this.resolveRenderedPhotos(container);
};

app.removeFsboPhoto = function (index) {
    this.fsboPhotos.splice(index, 1);
    this.renderFsboImagePreview();
};

app.parseFsboText = function () {
    const text = document.getElementById('fsbo-smart-text').value.trim();
    if (!text) {
        alert("Lütfen önce bir ilan metni yapıştırın.");
        return;
    }

    let parsedCount = 0;

    // --- JSON PARSING (BOOKMARKLET SUPPORT) ---
    if (text.startsWith('{') && text.endsWith('}')) {
        try {
            const data = JSON.parse(text);
            console.log("Parsed Bookmarklet Data:", data);

            // 1. Price
            if (data.price) {
                const priceInput = document.querySelector('#form-add-fsbo input[name="price"]');
                if (priceInput) {
                    // Remove non-digits if any, but usually bookmarklet sends clean number or string
                    let priceVal = data.price.toString().replace(/\D/g, '');
                    priceInput.value = parseInt(priceVal).toLocaleString('tr-TR');
                    parsedCount++;
                }
            }

            // 2. Attributes Mapping
            if (data.attributes) {
                const attrs = data.attributes;

                // Oda Sayısı
                if (attrs['Oda Sayısı']) {
                    const roomsSelect = document.querySelector('#form-add-fsbo select[name="rooms"]');
                    if (roomsSelect) {
                        // Try exact match or match first part (e.g. "3+1")
                        const val = attrs['Oda Sayısı'].replace(/\s/g, '');
                        for (let i = 0; i < roomsSelect.options.length; i++) {
                            if (roomsSelect.options[i].value === val) {
                                roomsSelect.selectedIndex = i;
                                break;
                            }
                        }
                    }
                }

                // Bulunduğu Kat
                if (attrs['Bulunduğu Kat']) {
                    const floorSelect = document.querySelector('#form-add-fsbo select[name="floor_current"]');
                    if (floorSelect) {
                        const val = attrs['Bulunduğu Kat'];
                        // Try to find matching option text
                        for (let i = 0; i < floorSelect.options.length; i++) {
                            if (floorSelect.options[i].text === val || floorSelect.options[i].value === val) {
                                floorSelect.selectedIndex = i;
                                break;
                            }
                        }
                    }
                }

                // Kat Sayısı
                if (attrs['Kat Sayısı']) {
                    const totalFloorSelect = document.querySelector('#form-add-fsbo select[name="floor_total"]');
                    if (totalFloorSelect) {
                        const val = attrs['Kat Sayısı'];
                        for (let i = 0; i < totalFloorSelect.options.length; i++) {
                            if (totalFloorSelect.options[i].value === val) {
                                totalFloorSelect.selectedIndex = i;
                                break;
                            }
                        }
                    }
                }

                // Bina Yaşı
                if (attrs['Bina Yaşı']) {
                    const ageSelect = document.querySelector('#form-add-fsbo select[name="building_age"]');
                    if (ageSelect) {
                        let val = attrs['Bina Yaşı'];
                        if (val === "0" || val === "Sıfır Bina") val = "0";
                        // Mapping ranges if needed, but select usually has simple values
                        for (let i = 0; i < ageSelect.options.length; i++) {
                            if (ageSelect.options[i].text.includes(val) || ageSelect.options[i].value === val) {
                                ageSelect.selectedIndex = i;
                                break;
                            }
                        }
                    }
                }

                // Size (m²)
                if (attrs['Net m²'] || attrs['m² (Net)']) {
                    const netInput = document.querySelector('#form-add-fsbo input[name="size_net"]');
                    if (netInput) netInput.value = (attrs['Net m²'] || attrs['m² (Net)']).replace(/\D/g, '');
                }
                if (attrs['Brüt m²'] || attrs['m² (Brüt)']) {
                    const grossInput = document.querySelector('#form-add-fsbo input[name="size_gross"]');
                    if (grossInput) grossInput.value = (attrs['Brüt m²'] || attrs['m² (Brüt)']).replace(/\D/g, '');
                }
            }

            // Title -> Notes Top
            const notesField = document.querySelector('#form-add-fsbo textarea[name="notes"]');
            let notesContent = "";
            if (data.title) notesContent += `BAŞLIK: ${data.title}\n`;
            if (data.description) notesContent += `\nAÇIKLAMA:\n${data.description}\n`;
            if (data.attributes) {
                notesContent += `\nÖZELLİKLER:\n`;
                for (const [key, val] of Object.entries(data.attributes)) {
                    notesContent += `- ${key}: ${val}\n`;
                }
            }
            if (data.url) {
                const linkInput = document.querySelector('#form-add-fsbo input[name="link"]');
                if (linkInput) linkInput.value = data.url;
                else notesContent += `\nLİNK: ${data.url}\n`;
            }

            if (notesField) {
                notesField.value = notesContent + "\n" + notesField.value;
                parsedCount++;
            }

            // Location Logic (Try to fuzzy match)
            if (this.adanaLocations && data.location) {
                let foundDistrict = '';
                let foundNeighborhood = '';
                const locText = data.location.toLowerCase();

                for (const [distName, distData] of Object.entries(this.adanaLocations)) {
                    if (locText.includes(distName.toLowerCase())) foundDistrict = distName;
                    for (const [neighName] of Object.entries(distData.neighborhoods)) {
                        if (locText.includes(neighName.toLowerCase())) {
                            foundNeighborhood = neighName;
                            if (!foundDistrict) foundDistrict = distName;
                        }
                    }
                }

                const distSelect = document.getElementById('fsbo-district');
                const neighSelect = document.getElementById('fsbo-neighborhood');

                if (foundDistrict && distSelect) {
                    distSelect.value = foundDistrict;
                    this.onFsboDistrictChange();
                    setTimeout(() => {
                        if (foundNeighborhood && neighSelect) neighSelect.value = foundNeighborhood;
                    }, 100);
                    parsedCount++;
                }
            }

            // Phone
            if (data.phone) {
                const phoneInput = document.querySelector('#form-add-fsbo input[name="phone"]');
                if (phoneInput) {
                    let cleanPhone = data.phone.replace(/[^\d+]/g, '');
                    if (cleanPhone.length >= 10 && cleanPhone.startsWith('0')) {
                        cleanPhone = cleanPhone.replace(/(\d{4})(\d{3})(\d{2})(\d{2})/, '$1 $2 $3 $4');
                    }
                    phoneInput.value = cleanPhone;
                    parsedCount++;
                }
            }

            // Owner Name
            let ownerName = data.owner;
            if (!ownerName && data.attributes && (data.attributes['Kimden'] || data.attributes['İlan Sahibi'])) {
                ownerName = data.attributes['Kimden'] || data.attributes['İlan Sahibi'];
            }
            if (ownerName) {
                const ownerInput = document.querySelector('#form-add-fsbo input[name="owner"]');
                if (ownerInput) {
                    ownerInput.value = ownerName;
                    parsedCount++;
                }
            }

            // Date (İlan Tarihi)
            let dateVal = data.date;
            if (!dateVal && data.attributes && data.attributes['İlan Tarihi']) {
                dateVal = data.attributes['İlan Tarihi'];
            }
            if (dateVal) {
                const months = { 'Ocak': '01', 'Şubat': '02', 'Mart': '03', 'Nisan': '04', 'Mayıs': '05', 'Haziran': '06', 'Temmuz': '07', 'Ağustos': '08', 'Eylül': '09', 'Ekim': '10', 'Kasım': '11', 'Aralık': '12' };
                for (const [n, d] of Object.entries(months)) { if (dateVal.includes(n)) { dateVal = dateVal.replace(n, d); break; } }
                const parts = dateVal.match(/(\d{1,2})[\.\s\-\/]+(\d{1,2})[\.\s\-\/]+(\d{4})/);
                if (parts) {
                    const parsedDate = `${parts[3]}-${parts[2].padStart(2, '0')}-${parts[1].padStart(2, '0')}`;
                    const dateInput = document.querySelector('#form-add-fsbo input[name="start_date"]');
                    if (dateInput) { dateInput.value = parsedDate; parsedCount++; }
                    const endDateInput = document.querySelector('#form-add-fsbo input[name="end_date"]');
                    if (endDateInput) {
                        const d = new Date(parsedDate); d.setMonth(d.getMonth() + 1);
                        endDateInput.value = d.toISOString().split('T')[0];
                    }
                }
            }

            // Success feedback
            const btn = document.querySelector('#form-add-fsbo button[onclick="app.parseFsboText()"]');
            if (btn) {
                btn.innerHTML = '<i class="ph ph-check"></i> İlan Bilgileri Aktarıldı!';
                btn.style.background = "#dcfce7";
                btn.style.color = "#166534";
                setTimeout(() => {
                    btn.innerHTML = '<i class="ph ph-lightning"></i> Bilgileri Otomatik Doldur';
                    btn.style.background = "";
                    btn.style.color = "";
                }, 2000);
            }
            return; // EXIT FUNCTION since JSON was handled

        } catch (e) {
            console.error("JSON Parse Error", e);
            // Fallthrough to normal text parsing if JSON fails
        }
    }

    // --- ORIGINAL TEXT PARSING LOGIC (FALLBACK) ---
    // 0. Always append to Notes
    const notesField = document.querySelector('#form-add-fsbo textarea[name="notes"]');
    if (notesField && !notesField.value.includes(text)) {
        const separator = notesField.value ? "\n\n--- İlan Detayları ---\n" : "";
        notesField.value += separator + text;
        parsedCount++;
    }

    // 1. Price
    const priceMatch =
        text.match(/(\d{1,3}(?:\.\d{3})*(?:,\d+)?)\s*(?:TL|tl|₺)/) ||
        text.match(/(\d{1,3}(?:\.\d{3})*)\s*TL/i) ||
        text.match(/(\d+)\s*(?:bin|milyon|m)/i);

    if (priceMatch) {
        let p = priceMatch[1].replace(/\./g, '').replace(/,/g, '.');
        let formPrice = document.querySelector('#form-add-fsbo input[name="price"]');
        if (formPrice) {
            formPrice.value = parseInt(p).toLocaleString('tr-TR');
            parsedCount++;
        }
    }

    // 2. District/Neighborhood (Simple version)
    if (this.adanaLocations) {
        let foundDistrict = '';
        let foundNeighborhood = '';

        for (const [distName, distData] of Object.entries(this.adanaLocations)) {
            if (text.toLowerCase().includes(distName.toLowerCase())) foundDistrict = distName;
            for (const [neighName] of Object.entries(distData.neighborhoods)) {
                if (text.toLowerCase().includes(neighName.toLowerCase())) {
                    foundNeighborhood = neighName;
                    if (!foundDistrict) foundDistrict = distName;
                }
            }
        }

        const distSelect = document.getElementById('fsbo-district');
        const neighSelect = document.getElementById('fsbo-neighborhood');

        if (foundDistrict && distSelect) {
            distSelect.value = foundDistrict;
            this.onFsboDistrictChange();
            setTimeout(() => {
                if (foundNeighborhood && neighSelect) neighSelect.value = foundNeighborhood;
            }, 100);
            parsedCount++;
        }
    }

    // 3. Phone
    const phoneMatch = text.match(/(0?5\d{2}[\s\-]?\d{3}[\s\-]?\d{2}[\s\-]?\d{2})/);
    if (phoneMatch) {
        const phoneInput = document.querySelector('#form-add-fsbo input[name="phone"]');
        if (phoneInput) {
            phoneInput.value = phoneMatch[1];
            parsedCount++;
        }
    }

    // 5. Date Parsing
    let foundDate = null;
    if (text.toLowerCase().includes('bugün')) foundDate = new Date().toISOString().split('T')[0];

    // Set Date
    const dateInput = document.querySelector('#form-add-fsbo input[name="start_date"]');
    const endDateInput = document.querySelector('#form-add-fsbo input[name="end_date"]');

    if (dateInput) {
        let finalDate = foundDate || new Date().toISOString().split('T')[0];
        dateInput.value = finalDate;
        parsedCount++;

        if (endDateInput) {
            const startDateObj = new Date(finalDate);
            startDateObj.setMonth(startDateObj.getMonth() + 1);
            endDateInput.value = startDateObj.toISOString().split('T')[0];
        }
    }

    // Feedback
    const btn = document.querySelector('#form-add-fsbo button[onclick="app.parseFsboText()"]');
    if (btn) {
        const originalText = btn.innerHTML;
        if (parsedCount > 0) {
            btn.innerHTML = '<i class="ph ph-check"></i> Bilgiler İşlendi!';
            btn.style.background = "#dcfce7";
            btn.style.color = "#166534";
        } else {
            btn.innerHTML = '<i class="ph ph-warning"></i> Net Bilgi Bulunamadı (Notlara Eklendi)';
            btn.style.background = "#fffbeb";
        }
        setTimeout(() => {
            btn.innerHTML = originalText;
            btn.style.background = "";
            btn.style.color = "";
        }, 2000);
    }
};

// DEBUG: Show localStorage FSBO data for migration troubleshooting
app.debugFsboData = function () {
    const raw = localStorage.getItem('rea_fsbo');
    const current = app.data.fsbo;

    let message = "=== FSBO DEBUG ===\n\n";
    message += "localStorage (rea_fsbo):\n";
    if (raw) {
        const parsed = JSON.parse(raw);
        message += `Kayıt sayısı: ${parsed.length}\n`;
        parsed.forEach((f, i) => {
            message += `${i + 1}. ${f.owner || 'N/A'} - ${f.phone || 'N/A'}\n`;
        });
    } else {
        message += "BOŞ veya YOK\n";
    }

    message += "\n\nMevcut app.data.fsbo:\n";
    message += `Kayıt sayısı: ${current ? current.length : 0}\n`;
    if (current) {
        current.forEach((f, i) => {
            message += `${i + 1}. ${f.owner || 'N/A'} - ${f.phone || 'N/A'}\n`;
        });
    }

    alert(message);
    console.log("FSBO DEBUG:", { localStorage: raw ? JSON.parse(raw) : null, appData: current });
};

app.toggleOcrMode = function () {
    const textMode = document.getElementById('smart-paste-text-mode');
    const ocrMode = document.getElementById('smart-paste-ocr-mode');
    if (!textMode || !ocrMode) return;

    if (textMode.style.display === 'none') {
        textMode.style.display = 'block';
        ocrMode.style.display = 'none';
        document.getElementById('btn-ocr-toggle').textContent = '📸 Ekran Görüntüsü ile Ekle';
    } else {
        textMode.style.display = 'none';
        ocrMode.style.display = 'block';
        document.getElementById('btn-ocr-toggle').textContent = '📝 Metin ile Ekle';
    }
};

app.handleOcrPaste = function (e) {
    const items = (e.clipboardData || e.originalEvent.clipboardData).items;
    for (let index in items) {
        const item = items[index];
        if (item.kind === 'file' && item.type.includes('image/')) {
            const blob = item.getAsFile();
            this.runOcr(blob);
        }
    }
};

app.runOcr = function (blob) {
    const status = document.getElementById('ocr-status');
    if (status) status.innerHTML = 'Okunuyor... <div class="spinner"></div>';

    // Simulations since we don't have Tesseract.js bundled locally properly or network
    // Just simulating a delay and saying "Feature unavailable offline" or similar?
    // User had Tesseract CDN in HTML?

    if (typeof Tesseract !== 'undefined') {
        Tesseract.recognize(
            blob,
            'tur',
            { logger: m => { if (status) status.textContent = `Okunuyor... %${Math.round(m.progress * 100)}`; } }
        ).then(({ data: { text } }) => {
            if (status) status.innerHTML = 'Okuma Tamamlandı! ✨';
            const textArea = document.getElementById('fsbo-smart-text');
            if (textArea) {
                textArea.value = text;
                app.parseFsboText();
                app.addFsboPhoto(blob); // Also add the image
            }
        }).catch(err => {
            if (status) status.innerHTML = 'Hata: ' + err.message;
        });
    } else {
        if (status) status.innerHTML = "OCR Kütüphanesi Yüklenemedi.";
    }
};

// Initialize App
document.addEventListener('DOMContentLoaded', () => {
    try {
        if (window.log) window.log("App Init Starting...");
        if (typeof app !== 'undefined') {
            window.app = app;
            app.init();

            // One-time Migration: Huzur -> Huzurevleri
            if (!localStorage.getItem('migration_huzur_done')) {
                let updated = 0;
                app.data.listings.forEach(item => {
                    if (item.location && item.location.includes('Huzur') && !item.location.includes('Huzurevleri')) {
                        item.location = item.location.replace('Huzur', 'Huzurevleri');
                        updated++;
                    }
                });
                if (updated > 0) {
                    app.saveData('listings');
                    app.renderListings();
                    console.log(`Migration: ${updated} ilan güncellendi (Huzur -> Huzurevleri)`);
                }
                localStorage.setItem('migration_huzur_done', 'true');
            }
        } else {
            console.error("FATAL: 'app' constant is undefined at DOMContentLoaded");
        }
        if (window.log) window.log("App Init Completed");
    } catch (e) {
        alert("CRITICAL ERROR IN INIT: " + e.message);
        console.error(e);
    }
});

// --- DATA EXPORT / IMPORT ---
app.exportData = async function () {
    // IndexedDB'den tüm fotoğrafları al
    const photosMap = await this.photoStore.getAllPhotos();

    // Data'nın derin kopyasını al ve ref ID'leri base64 ile değiştir (export için)
    const dataCopy = JSON.parse(JSON.stringify(this.data));

    // Fotoğrafları çöz (export dosyasında inline base64 olsun)
    const resolvePhotos = (items, photoField = 'photos') => {
        if (!items) return;
        items.forEach(item => {
            if (photoField === 'photos' && item.photos && Array.isArray(item.photos)) {
                item.photos = item.photos.map(p => this.isPhotoRef(p) && photosMap[p] ? photosMap[p] : p);
            }
            if (photoField === 'photo' && item.photo && this.isPhotoRef(item.photo) && photosMap[item.photo]) {
                item.photo = photosMap[item.photo];
            }
        });
    };

    resolvePhotos(dataCopy.listings, 'photos');
    resolvePhotos(dataCopy.findings, 'photos');
    resolvePhotos(dataCopy.fsbo, 'photos');
    dataCopy.fsbo?.forEach(item => {
        if (item.photo && this.isPhotoRef(item.photo) && photosMap[item.photo]) {
            item.photo = photosMap[item.photo];
        }
    });
    resolvePhotos(dataCopy.targets, 'photo');

    const exportObj = {
        version: '2.0',
        exportDate: new Date().toISOString(),
        data: dataCopy
    };

    const blob = new Blob([JSON.stringify(exportObj, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `emlak_yedek_${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    alert('Veriler başarıyla indirildi!');
};

app.importData = function (file) {
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
        try {
            const imported = JSON.parse(e.target.result);

            if (!imported.data) {
                alert('Geçersiz yedek dosyası!');
                return;
            }

            // Count items in backup
            const backupListings = imported.data.listings || [];
            const backupCustomers = imported.data.customers || [];
            const backupFsbo = imported.data.fsbo || [];
            const backupFindings = imported.data.findings || [];
            const backupAppointments = imported.data.appointments || [];

            // Count current items
            const currentListings = this.data.listings || [];
            const currentCustomers = this.data.customers || [];
            const currentFsbo = this.data.fsbo || [];
            const currentFindings = this.data.findings || [];
            const currentAppointments = this.data.appointments || [];

            if (confirm(`Yedek dosyasını birleştirmek istiyor musunuz?\n\nYedekteki veriler:\n- ${backupListings.length} ilan\n- ${backupCustomers.length} müşteri\n- ${backupFsbo.length} FSBO\n- ${backupFindings.length} bulum\n\nMevcut veriler:\n- ${currentListings.length} ilan\n- ${currentCustomers.length} müşteri\n- ${currentFsbo.length} FSBO\n- ${currentFindings.length} bulum\n\n✅ Yeni eklediğiniz veriler KORUNACAK!`)) {

                // Merge function: add items from backup that don't exist in current
                const mergeArrays = (current, backup) => {
                    const currentIds = new Set(current.map(item => item.id));
                    const newItems = backup.filter(item => !currentIds.has(item.id));
                    return [...current, ...newItems];
                };

                // Merge all data types
                this.data.listings = mergeArrays(currentListings, backupListings);
                this.data.customers = mergeArrays(currentCustomers, backupCustomers);
                this.data.fsbo = mergeArrays(currentFsbo, backupFsbo);
                this.data.findings = mergeArrays(currentFindings, backupFindings);
                this.data.appointments = mergeArrays(currentAppointments, backupAppointments);

                // Save all
                this.saveData('listings');
                this.saveData('customers');
                this.saveData('fsbo');
                this.saveData('findings');
                this.saveData('appointments');

                // Import edilen fotoğrafları IndexedDB'ye taşı
                localStorage.removeItem('rea_photos_migrated');
                this.migratePhotosToIndexedDB().then(() => {
                    // Refresh all views
                    this.renderAll();
                    this.updateStats();

                    const addedListings = this.data.listings.length - currentListings.length;
                    const addedCustomers = this.data.customers.length - currentCustomers.length;
                    const addedFsbo = this.data.fsbo.length - currentFsbo.length;

                    alert(`Veriler başarıyla birleştirildi!\n\n` +
                        `Eklenen:\n` +
                        `+ ${addedListings} yeni ilan\n` +
                        `+ ${addedCustomers} yeni müşteri\n` +
                        `+ ${addedFsbo} yeni FSBO`);
                });
            }
        } catch (err) {
            alert('Dosya okunamadı: ' + err.message);
        }
    };
    reader.readAsText(file);

    // Reset file input
    document.getElementById('import-file').value = '';
};

app.filterListingsByNeighborhood = function (name) {
    if (this.setView) {
        this.setView('listings');
    } else {
        const btn = document.querySelector('.nav-item[data-target="listings"]');
        if (btn) btn.click();
    }

    setTimeout(() => {
        const searchInput = document.querySelector('#listings .search-input');
        const districtSelect = document.getElementById('list-filter-district');

        if (districtSelect) districtSelect.value = '';

        if (searchInput) {
            searchInput.value = name;
            this.renderListings();
        }
    }, 50);
};

// --- LIGHTBOX FOR FSBO PHOTOS ---
app.openLightbox = async function (imageSrc) {
    // Always remove old lightbox first
    app.closeLightbox();

    if (!imageSrc) return;

    // Eğer photo ref ise IndexedDB'den çöz
    let finalSrc = imageSrc;
    if (this.isPhotoRef(imageSrc)) {
        if (this._photoCache[imageSrc]) {
            finalSrc = this._photoCache[imageSrc];
        } else {
            const data = await this.photoStore.getPhoto(imageSrc);
            if (data) {
                this._photoCache[imageSrc] = data;
                finalSrc = data;
            } else {
                console.warn('Lightbox: Fotoğraf bulunamadı', imageSrc);
                return;
            }
        }
    }

    // Create fresh lightbox element
    const lb = document.createElement('div');
    lb.id = 'fsbo-lightbox';
    lb.style.cssText = 'position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,0.95);z-index:999999;display:flex;align-items:center;justify-content:center;';

    // Close button
    const closeBtn = document.createElement('span');
    closeBtn.innerHTML = '×';
    closeBtn.style.cssText = 'position:absolute;top:10px;right:20px;font-size:50px;color:white;cursor:pointer;font-weight:bold;';
    closeBtn.onclick = function () { app.closeLightbox(); };

    // Image
    const img = document.createElement('img');
    img.src = finalSrc;
    img.style.cssText = 'max-width:90%;max-height:90%;object-fit:contain;';

    lb.appendChild(closeBtn);
    lb.appendChild(img);

    // Click outside to close
    lb.onclick = function (e) {
        if (e.target === lb) app.closeLightbox();
    };

    document.body.appendChild(lb);
    document.body.style.overflow = 'hidden';
};

app.closeLightbox = function () {
    const lb = document.getElementById('fsbo-lightbox');
    if (lb) {
        lb.remove();
        document.body.style.overflow = '';
    }
};

// Event delegation for FSBO photo clicks (mobile-friendly)
// Event delegation for FSBO photo clicks (mobile-friendly)
document.addEventListener('click', function (e) {
    const target = e.target;

    // Check if clicked on FSBO photo thumbnail
    if (target.classList && target.classList.contains('fsbo-photo-thumb')) {
        e.preventDefault();
        e.stopPropagation();
        const src = target.getAttribute('src') || target.src;
        if (src) {
            app.openLightbox(src);
        }
    }
});

// --- TARGET LISTINGS FEATURES ---
app.targetPhoto = null;

app.handleTargetPhoto = function (input) {
    if (!input.files || !input.files[0]) return;
    this.setTargetPhotoFromFile(input.files[0]);
};

app.handleTargetPhotoPaste = function (e) {
    e.preventDefault();
    const items = (e.clipboardData || e.originalEvent.clipboardData).items;
    for (let i = 0; i < items.length; i++) {
        if (items[i].kind === 'file' && items[i].type.includes('image/')) {
            this.setTargetPhotoFromFile(items[i].getAsFile());
            return;
        }
    }
};

app.setTargetPhotoFromFile = async function (file) {
    const base64 = await this.compressPhoto(file);
    const id = await this.photoStore.savePhoto(base64, 'targets', 'pending');
    if (id) {
        this._photoCache[id] = base64;
        this.targetPhoto = id;
    } else {
        this.targetPhoto = base64; // fallback
    }
    const previewSrc = base64; // Preview her zaman base64 gösterir
    const preview = document.getElementById('target-photo-preview');
    if (preview) {
        preview.innerHTML = `
            <div style="position:relative; display:inline-block;">
                <img src="${previewSrc}" style="width:100%; max-width:300px; height:140px; object-fit:cover; border-radius:8px; border:1px solid #ddd;">
                <button onclick="event.stopPropagation(); app.removeTargetPhoto()" style="position:absolute; top:0; right:0; background:rgba(220,38,38,0.9); color:white; border:none; width:22px; height:22px; cursor:pointer; border-radius:0 0 0 4px;">&times;</button>
            </div>`;
    }
    const pasteArea = document.getElementById('target-photo-paste-area');
    if (pasteArea) pasteArea.style.display = 'none';
};

app.removeTargetPhoto = function () {
    this.targetPhoto = null;
    const preview = document.getElementById('target-photo-preview');
    if (preview) preview.innerHTML = '';
    const input = document.getElementById('target-photo-input');
    if (input) input.value = '';
    const pasteArea = document.getElementById('target-photo-paste-area');
    if (pasteArea) pasteArea.style.display = '';
};

app.addTarget = function (formData) {
    const newItem = {
        id: 'target_' + Date.now(),
        title: formData.get('title'),
        link: formData.get('link'),
        price: formData.get('price'),
        address: formData.get('address'),
        agent_note: formData.get('agent_note'),
        photo: this.targetPhoto || null,
        date: new Date().toISOString()
    };

    if (!this.data.targets) this.data.targets = [];
    this.data.targets.push(newItem);

    this.saveData('targets');
    this.renderTargetListings();
    this.modals.closeAll();
    document.getElementById('form-add-target').reset();
    this.targetPhoto = null;
    const preview = document.getElementById('target-photo-preview');
    if (preview) preview.innerHTML = '';
    const pasteArea = document.getElementById('target-photo-paste-area');
    if (pasteArea) pasteArea.style.display = '';
};

app.deleteTarget = function (id) {
    if (confirm('Bu hedef ilanı silmek istediğinize emin misiniz?')) {
        const item = this.data.targets.find(x => x.id === id);
        if (item && item.photo && this.isPhotoRef(item.photo)) {
            this.photoStore.deletePhotos([item.photo]);
        }
        this.data.targets = this.data.targets.filter(x => x.id !== id);
        this.saveData('targets');
        this.renderTargetListings();
    }
};

app.renderTargetListings = function () {
    const list = document.getElementById('targets-grid');
    if (!list) return;

    if (!this.data.targets || this.data.targets.length === 0) {
        list.innerHTML = `
            <div class="empty-state">
                <i class="ph ph-crosshair"></i>
                <p>Hedef ilan listeniz boş.</p>
            </div>`;
        return;
    }

    list.innerHTML = this.data.targets.slice().reverse().map(item => `
        <div class="listing-card target-card" style="border: 1px solid #fecaca; background: #fff5f5;">
            <div class="card-badges" style="position:absolute; top:10px; right:10px;">
                 <span class="badge" style="background:#dc2626; color:white;">HEDEF</span>
            </div>
            ${item.photo ? (app.isPhotoRef(item.photo) ? `<img data-photo-id="${item.photo}" style="width:100%; height:140px; object-fit:cover; border-radius:8px 8px 0 0; cursor:pointer; background:#f1f5f9;" onclick="app.openLightbox(this.src)" alt="Hedef ilan fotoğrafı">` : `<img src="${item.photo}" style="width:100%; height:140px; object-fit:cover; border-radius:8px 8px 0 0; cursor:pointer;" onclick="app.openLightbox(this.src)" alt="Hedef ilan fotoğrafı">`) : ''}
            <div class="card-content" style="padding: 15px;">
                <h3 style="color:#991b1b; margin-bottom: 5px;">${item.title}</h3>
                <div style="font-size: 13px; color: #7f1d1d; margin-bottom: 10px;">
                    ${item.agent_note || ''}
                </div>

                <div style="font-weight: 700; font-size: 18px; color: #dc2626; margin-bottom: 15px;">
                    ${item.price ? item.price + ' TL' : ''}
                </div>

                <div style="font-size: 13px; color: #4b5563; margin-bottom: 15px; background: white; padding: 8px; border-radius: 6px; border: 1px solid #fee2e2;">
                    <i class="ph ph-map-pin" style="color:#dc2626;"></i> ${item.address}
                </div>

                <div class="card-actions" style="display: flex; gap: 8px;">
                    <button class="btn btn-sm btn-primary" onclick="app.openMapDirections('${item.address.replace(/\n/g, ' ')}')" style="flex:1; background-color:#dc2626; border-color:#dc2626;">
                        <i class="ph ph-navigation-arrow"></i> Yol Tarifi
                    </button>
                    ${item.link ? `
                    <a href="${item.link}" target="_blank" class="btn btn-sm btn-secondary" style="flex:1;">
                        <i class="ph ph-link"></i> Link
                    </a>
                    ` : ''}
                     <button class="btn btn-sm btn-icon" onclick="app.deleteTarget('${item.id}')" style="color: #ef4444; background: white; border: 1px solid #fecaca;">
                        <i class="ph ph-trash"></i>
                    </button>
                </div>
            </div>
        </div>
    `).join('');

    // IndexedDB'den fotoğrafları çöz
    this.resolveRenderedPhotos(list);
};

app.openMapDirections = function (address) {
    if (!address) return;
    // Open Google Maps query
    const query = encodeURIComponent(address);
    // Universal Google Maps URL works on both desktop and mobile (triggers app on mobile)
    window.open(`https://www.google.com/maps/search/?api=1&query=${query}`, '_blank');
};

// Close lightbox with ESC key
document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') {
        app.closeLightbox();
    }
});

