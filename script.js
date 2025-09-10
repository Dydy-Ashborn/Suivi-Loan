
        import { initializeApp } from 'https://www.gstatic.com/firebasejs/9.23.0/firebase-app.js';
        import {
            getFirestore,
            collection,
            addDoc,
            onSnapshot,
            query,
            orderBy,
            deleteDoc,
            doc,
            getDocs
        } from 'https://www.gstatic.com/firebasejs/9.23.0/firebase-firestore.js';

        const firebaseConfig = {
            apiKey: "AIzaSyCPQpB3cYk2sgbOVQ8KLbU1Qj2U67D2rZ4",
            authDomain: "suivi-loan.firebaseapp.com",
            projectId: "suivi-loan",
            storageBucket: "suivi-loan.firebasestorage.app",
            messagingSenderId: "334984699415",
            appId: "1:334984699415:web:8b41abb9360d31efabc652",
            measurementId: "G-RWZ0S704RJ"
        };

        let app, db, dailyChart;

        try {
            app = initializeApp(firebaseConfig);
            db = getFirestore(app);
            console.log('Firebase initialisé avec succès');
        } catch (error) {
            console.error('Erreur initialisation Firebase:', error);
        }

        let entries = [];
        let currentEntry = {
            type: '',
            amount: '',
            hasPee: false,
            hasPoop: false,
            poopQuantity: '',
            poopConsistency: '',
            poopColor: '',
            timestamp: new Date().toISOString()
        };

        const BABY_BIRTH_DATE = new Date('2025-09-06T06:38:00');
        const BABY_INFO = {
            name: 'Loan',
            birthWeight: 3.290,
            birthLength: 48,
            parents: ['Dylan', 'Chloé']
        };

        const FEEDING_GUIDE = {
            1: { volume: '5–10ml', frequency: '8–12 fois/24h', comment: 'Estomac très petit, petites quantités très fréquentes' },
            2: { volume: '10–20ml', frequency: '8–12 fois/24h', comment: 'Progression rapide, petites tétées fréquentes' },
            3: { volume: '20–30ml', frequency: '8–10 fois/24h', comment: 'Bébé commence à boire plus régulièrement' },
            4: { volume: '45–60ml', frequency: '6–8 fois/24h', comment: 'Adaptation au lait, souvent nécessaire de compléter un peu' },
            5: { volume: '60–70ml', frequency: '6–8 fois/24h', comment: 'Attention aux signes de satiété, pas de suralimentation' },
            6: { volume: '70–75ml', frequency: '6–8 fois/24h', comment: 'Rot + massages si besoin, surveiller selles et couches' },
            7: { volume: '70–80ml', frequency: '6–8 fois/24h', comment: 'Même principe que jour 6, ajuster légèrement si bébé demande plus' }
        };

        const FEEDING_RANGES = [
            { days: [8, 9, 10], volume: '80–90ml', frequency: '6–8 fois/24h', comment: 'Augmentation progressive des volumes' },
            { days: [11, 12, 13, 14], volume: '90–100ml', frequency: '5–6 fois/24h', comment: 'Bébé commence à espacer les biberons, volumes plus stables' },
            { days: [15, 16, 17, 18, 19, 20, 21], volume: '100–120ml', frequency: '5–6 fois/24h', comment: 'Transition vers volumes "standard" pour 1 mois' },
            { days: [22, 23, 24, 25, 26, 27, 28], volume: '120–150ml', frequency: '5–6 fois/24h', comment: 'Bébé boit maintenant des biberons plus conséquents, espacés de 3–4h' }
        ];

        function getFeedingRecommendations(ageInDays) {
            if (FEEDING_GUIDE[ageInDays]) {
                return FEEDING_GUIDE[ageInDays];
            }

            for (const range of FEEDING_RANGES) {
                if (range.days.includes(ageInDays)) {
                    return {
                        volume: range.volume,
                        frequency: range.frequency,
                        comment: range.comment
                    };
                }
            }

            if (ageInDays > 28) {
                return {
                    volume: '150–180ml',
                    frequency: '5–6 fois/24h',
                    comment: 'Volumes stabilisés, consulter le pédiatre pour ajustements'
                };
            }

            return null;
        }

        function getDefaultAmount(volumeRange) {
            const ranges = volumeRange.match(/(\d+)(?:–(\d+))?/);
            if (!ranges) return null;

            const min = parseInt(ranges[1]);
            const max = ranges[2] ? parseInt(ranges[2]) : min;

            const average = Math.round((min + max) / 2);
            return Math.round(average / 5) * 5;
        }

        const elements = {
            babyAge: document.getElementById('baby-age'),
            settingsAge: document.getElementById('settings-age'),
            totalMilk: document.getElementById('total-milk'),
            totalPees: document.getElementById('total-pees'),
            totalPoops: document.getElementById('total-poops'),
            actionButtons: document.getElementById('action-buttons'),
            formContainer: document.getElementById('form-container'),
            settingsContainer: document.getElementById('settings-container'),
            historySection: document.getElementById('history-section'),
            entriesContainer: document.getElementById('entries-container'),
            noEntries: document.getElementById('no-entries'),
            formTitle: document.getElementById('form-title'),
            amountSection: document.getElementById('amount-section'),
            amountInput: document.getElementById('amount-input'),
            consistencySection: document.getElementById('consistency-section'),
            totalEntries: document.getElementById('total-entries'),
            firstEntry: document.getElementById('first-entry'),
            lastEntry: document.getElementById('last-entry'),
            firebaseStatus: document.getElementById('firebase-status'),
            connectionIndicator: document.getElementById('connection-indicator'),
            guideAge: document.getElementById('guide-age'),
            feedingGuide: document.getElementById('feeding-guide')
        };

        function calculateAge() {
            const now = new Date();
            const birthDate = new Date(BABY_BIRTH_DATE);

            const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
            const birth = new Date(birthDate.getFullYear(), birthDate.getMonth(), birthDate.getDate());

            const diffTime = today - birth;
            const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));

            return Math.max(0, diffDays);
        }

        function formatTime(timestamp) {
            return new Date(timestamp).toLocaleTimeString('fr-FR', {
                hour: '2-digit',
                minute: '2-digit'
            });
        }

        function formatDate(timestamp) {
            return new Date(timestamp).toLocaleDateString('fr-FR', {
                weekday: 'long',
                day: 'numeric',
                month: 'long'
            });
        }

        function getDayStart(date) {
            // Le jour commence à 7h du matin
            const dayStart = new Date(date);
            dayStart.setHours(7, 0, 0, 0);
            
            // Si on est avant 7h, on prend le jour d'avant
            if (date.getHours() < 7) {
                dayStart.setDate(dayStart.getDate() - 1);
            }
            
            return dayStart;
        }

        function getDayEnd(date) {
            // Le jour se termine à 6h30 du matin suivant
            const dayEnd = new Date(date);
            dayEnd.setHours(6, 30, 0, 0);
            dayEnd.setDate(dayEnd.getDate() + 1);
            
            // Si on est après 7h, on prend le jour suivant
            if (date.getHours() >= 7) {
                dayEnd.setDate(dayEnd.getDate() + 1);
            }
            
            return dayEnd;
        }

        function getWeekStart(date) {
            const weekStart = getDayStart(date);
            const dayOfWeek = weekStart.getDay();
            const diffToMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
            weekStart.setDate(weekStart.getDate() - diffToMonday);
            return weekStart;
        }

        function getMonthStart(date) {
            const monthStart = getDayStart(date);
            monthStart.setDate(1);
            return monthStart;
        }

        function updateFirebaseStatus(status, isConnected = false) {
            if (elements.firebaseStatus) {
                elements.firebaseStatus.textContent = status;
            }
            if (elements.connectionIndicator) {
                if (isConnected) {
                    elements.connectionIndicator.className = 'w-3 h-3 bg-green-500 rounded-full';
                } else {
                    elements.connectionIndicator.className = 'w-3 h-3 bg-yellow-500 rounded-full animate-pulse';
                }
            }
        }

        function updateFeedingGuide(ageInDays) {
            if (elements.guideAge) {
                elements.guideAge.textContent = ageInDays;
            }

            if (elements.feedingGuide) {
                const recommendations = getFeedingRecommendations(ageInDays);

                if (recommendations) {
                    elements.feedingGuide.innerHTML = `
                        <div class="grid grid-cols-2 gap-2 mb-2">
                            <div>
                                <strong>📏 Volume :</strong><br>
                                <span class="text-blue-900 font-medium">${recommendations.volume}</span>
                            </div>
                            <div>
                                <strong>⏰ Fréquence :</strong><br>
                                <span class="text-blue-900 font-medium">${recommendations.frequency}</span>
                            </div>
                        </div>
                        <div class="text-xs text-blue-600 italic">
                            💡 ${recommendations.comment}
                        </div>
                    `;
                }
            }
        }

        function initializeFirebase() {
            if (!db) {
                updateFirebaseStatus('❌ Firebase non disponible');
                loadEntriesLocal();
                return;
            }

            try {
                updateFirebaseStatus('🔄 Connexion...');

                const q = query(collection(db, 'entries'), orderBy('timestamp', 'desc'));

                onSnapshot(q, (snapshot) => {
                    entries = [];

                    snapshot.forEach((doc) => {
                        const data = doc.data();
                        entries.push({
                            id: doc.id,
                            ...data
                        });
                    });

                    updateDisplay();
                    updateFirebaseStatus('✅ Connecté et synchronisé', true);

                    localStorage.setItem('babyTrackerEntries', JSON.stringify(entries));
                }, (error) => {
                    updateFirebaseStatus('❌ Erreur de connexion');
                    loadEntriesLocal();
                });

            } catch (error) {
                updateFirebaseStatus('❌ Erreur Firebase');
                loadEntriesLocal();
            }
        }

        function loadEntriesLocal() {
            const saved = localStorage.getItem('babyTrackerEntries');
            if (saved) {
                try {
                    entries = JSON.parse(saved);
                    updateDisplay();
                } catch (error) {
                    entries = [];
                }
            }
        }

        async function saveEntryToFirebase(entry) {
            if (!db) {
                entries.unshift({ ...entry, id: Date.now().toString() });
                localStorage.setItem('babyTrackerEntries', JSON.stringify(entries));
                updateDisplay();
                return;
            }

            try {
                updateFirebaseStatus('💾 Sauvegarde...');

                const docRef = await addDoc(collection(db, 'entries'), {
                    type: entry.type,
                    amount: entry.amount,
                    hasPee: entry.hasPee,
                    hasPoop: entry.hasPoop,
                    poopQuantity: entry.poopQuantity,
                    poopConsistency: entry.poopConsistency,
                    poopColor: entry.poopColor,
                    timestamp: entry.timestamp
                });

                updateFirebaseStatus('✅ Sauvegardé', true);

            } catch (error) {
                entries.unshift({ ...entry, id: Date.now().toString() });
                localStorage.setItem('babyTrackerEntries', JSON.stringify(entries));
                updateDisplay();
            }
        }

        async function deleteAllEntriesFirebase() {
            if (!db) return;

            try {
                const querySnapshot = await getDocs(collection(db, 'entries'));
                const deletePromises = [];

                querySnapshot.forEach((document) => {
                    deletePromises.push(deleteDoc(doc(db, 'entries', document.id)));
                });

                await Promise.all(deletePromises);

            } catch (error) {
                console.error('Erreur suppression Firebase:', error);
            }
        }

        function getFilteredEntries(period) {
            const now = new Date();
            let startDate, endDate;

            switch (period) {
                case 'daily':
                    startDate = getDayStart(now);
                    endDate = getDayEnd(now);
                    break;
                case 'weekly':
                    startDate = getWeekStart(now);
                    endDate = new Date(now);
                    break;
                case 'monthly':
                    startDate = getMonthStart(now);
                    endDate = new Date(now);
                    break;
                default:
                    return [];
            }

            return entries.filter(entry => {
                const entryDate = new Date(entry.timestamp);
                return entryDate >= startDate && entryDate <= endDate;
            });
        }

        function updateStatistics(period, filteredEntries) {
            const feedings = filteredEntries.filter(entry => entry.type === 'feeding');
            const totalMilk = feedings.reduce((sum, entry) => sum + parseInt(entry.amount || 0), 0);
            const totalPees = filteredEntries.filter(entry => entry.hasPee).length;
            const totalPoops = filteredEntries.filter(entry => entry.hasPoop).length;

            const periodElements = {
                daily: {
                    milk: 'total-milk',
                    pees: 'total-pees',
                    poops: 'total-poops'
                },
                weekly: {
                    milk: 'weekly-milk',
                    pees: 'weekly-pees',
                    poops: 'weekly-poops',
                    feedings: 'weekly-feedings',
                    milkAvg: 'weekly-milk-avg',
                    peesAvg: 'weekly-pees-avg',
                    poopsAvg: 'weekly-poops-avg',
                    feedingsAvg: 'weekly-feedings-avg'
                },
                monthly: {
                    milk: 'monthly-milk',
                    pees: 'monthly-pees',
                    poops: 'monthly-poops',
                    feedings: 'monthly-feedings',
                    milkAvg: 'monthly-milk-avg',
                    peesAvg: 'monthly-pees-avg',
                    poopsAvg: 'monthly-poops-avg',
                    feedingsAvg: 'monthly-feedings-avg'
                }
            };

            const elemIds = periodElements[period];
            if (!elemIds) return;

            const milkEl = document.getElementById(elemIds.milk);
            const peesEl = document.getElementById(elemIds.pees);
            const poopsEl = document.getElementById(elemIds.poops);

            if (milkEl) milkEl.textContent = totalMilk + 'ml';
            if (peesEl) peesEl.textContent = totalPees;
            if (poopsEl) poopsEl.textContent = totalPoops;

            if (period !== 'daily') {
                const days = period === 'weekly' ? 7 : 30;
                const feedingsEl = document.getElementById(elemIds.feedings);
                const milkAvgEl = document.getElementById(elemIds.milkAvg);
                const peesAvgEl = document.getElementById(elemIds.peesAvg);
                const poopsAvgEl = document.getElementById(elemIds.poopsAvg);
                const feedingsAvgEl = document.getElementById(elemIds.feedingsAvg);

                if (feedingsEl) feedingsEl.textContent = feedings.length;
                if (milkAvgEl) milkAvgEl.textContent = `Moy: ${Math.round(totalMilk / days)}ml/jour`;
                if (peesAvgEl) peesAvgEl.textContent = `Moy: ${Math.round(totalPees / days)}/jour`;
                if (poopsAvgEl) poopsAvgEl.textContent = `Moy: ${Math.round(totalPoops / days)}/jour`;
                if (feedingsAvgEl) feedingsAvgEl.textContent = `Moy: ${Math.round(feedings.length / days)}/jour`;
            }
        }

        function initializeDailyChart() {
            const ctx = document.getElementById('dailyChart').getContext('2d');
            
            dailyChart = new Chart(ctx, {
                type: 'line',
                data: {
                    labels: [],
                    datasets: [{
                        label: 'Lait (ml)',
                        data: [],
                        borderColor: '#3B82F6',
                        backgroundColor: 'rgba(59, 130, 246, 0.1)',
                        tension: 0.4,
                        fill: true
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    scales: {
                        y: {
                            beginAtZero: true,
                            ticks: {
                                fontSize: 10
                            }
                        },
                        x: {
                            ticks: {
                                fontSize: 10
                            }
                        }
                    },
                    plugins: {
                        legend: {
                            display: false
                        }
                    }
                }
            });
        }

        function updateDailyChart() {
            if (!dailyChart) return;

            const now = new Date();
            const dayStart = getDayStart(now);
            const dayEnd = getDayEnd(now);
            
            const todayFeedings = entries.filter(entry => {
                const entryDate = new Date(entry.timestamp);
                return entry.type === 'feeding' && entryDate >= dayStart && entryDate <= dayEnd;
            });

            // Créer les points horaires de 7h à 6h30 (24h)
            const hourLabels = [];
            const data = [];
            
            for (let h = 7; h < 31; h++) { // 7h à 6h30 (24h)
                const displayHour = h > 24 ? h - 24 : h;
                const hourStr = h === 30 ? '6:30' : `${displayHour}h`;
                hourLabels.push(hourStr);
                
                // Calculer le lait consommé jusqu'à cette heure
                let cumulativeMilk = 0;
                const currentTime = new Date(dayStart);
                currentTime.setHours(h > 24 ? h - 24 : h, h === 30 ? 30 : 0);
                
                todayFeedings.forEach(feeding => {
                    const feedingTime = new Date(feeding.timestamp);
                    if (feedingTime <= currentTime) {
                        cumulativeMilk += parseInt(feeding.amount || 0);
                    }
                });
                
                data.push(cumulativeMilk);
            }

            dailyChart.data.labels = hourLabels;
            dailyChart.data.datasets[0].data = data;
            dailyChart.update();
        }

        function updateDisplay() {
            const age = calculateAge();
            elements.babyAge.textContent = age;
            elements.settingsAge.textContent = age;

            updateFeedingGuide(age);

            // Mettre à jour les statistiques selon l'onglet actif
            const activeTab = document.querySelector('.tab-button.active').id.replace('tab-', '');
            const filteredEntries = getFilteredEntries(activeTab);
            updateStatistics(activeTab, filteredEntries);

            elements.totalEntries.textContent = entries.length;
            elements.firstEntry.textContent = entries.length > 0 ? formatDate(entries[entries.length - 1].timestamp) : 'Aucune';
            elements.lastEntry.textContent = entries.length > 0 ? formatDate(entries[0].timestamp) : 'Aucune';

            updateDailyChart();
            updateHistory();
        }

        function switchTab(tabId) {
            // Mettre à jour les classes des onglets
            document.querySelectorAll('.tab-button').forEach(btn => {
                btn.classList.remove('active');
                btn.classList.add('text-gray-600');
            });
            
            document.getElementById(tabId).classList.add('active');
            document.getElementById(tabId).classList.remove('text-gray-600');

            // Afficher/masquer les statistiques appropriées
            document.getElementById('daily-stats').style.display = tabId === 'tab-daily' ? 'grid' : 'none';
            document.getElementById('weekly-stats').style.display = tabId === 'tab-weekly' ? 'grid' : 'none';
            document.getElementById('monthly-stats').style.display = tabId === 'tab-monthly' ? 'grid' : 'none';

            // Mettre à jour les données
            const period = tabId.replace('tab-', '');
            const filteredEntries = getFilteredEntries(period);
            updateStatistics(period, filteredEntries);
        }

        function getPoopInfo(quantity, consistency, color) {
            const quantities = {
                'peu': { label: 'Un peu', emoji: '🤏' },
                'moyen': { label: 'Moyen', emoji: '👌' },
                'beaucoup': { label: 'Beaucoup', emoji: '🙌' }
            };

            const consistencies = {
                'liquide': { label: 'Liquide', emoji: '💧' },
                'molle': { label: 'Molle', emoji: '🟡' },
                'normale': { label: 'Normale', emoji: '🟤' },
                'dure': { label: 'Dure', emoji: '🔴' }
            };

            const colors = {
                'noir': { label: 'Noir', emoji: '⚫', bgColor: 'bg-gray-800', textColor: 'text-white' },
                'marron': { label: 'Marron', emoji: '🟤', bgColor: 'bg-amber-700', textColor: 'text-white' },
                'vert': { label: 'Vert', emoji: '🟢', bgColor: 'bg-green-600', textColor: 'text-white' },
                'jaune': { label: 'Jaune', emoji: '🟡', bgColor: 'bg-yellow-400', textColor: 'text-gray-800' }
            };

            return {
                quantity: quantities[quantity] || { label: '', emoji: '' },
                consistency: consistencies[consistency] || { label: '', emoji: '' },
                color: colors[color] || { label: '', emoji: '', bgColor: 'bg-orange-100', textColor: 'text-orange-800' }
            };
        }

        function updateHistory() {
            if (entries.length === 0) {
                elements.noEntries.style.display = 'block';
                elements.entriesContainer.innerHTML = '';
                elements.entriesContainer.appendChild(elements.noEntries);
                return;
            }

            elements.noEntries.style.display = 'none';
            elements.entriesContainer.innerHTML = '';

            entries.forEach(entry => {
                const entryDiv = document.createElement('div');
                entryDiv.className = 'bg-white/80 glass rounded-2xl p-4 shadow-sm border border-white/50 fade-in';

                let poopDisplay = '';
                if (entry.hasPoop) {
                    const poopInfo = getPoopInfo(entry.poopQuantity, entry.poopConsistency, entry.poopColor);
                    const parts = [];

                    if (poopInfo.quantity.label) parts.push(`${poopInfo.quantity.emoji} ${poopInfo.quantity.label}`);
                    if (poopInfo.consistency.label) parts.push(`${poopInfo.consistency.emoji} ${poopInfo.consistency.label}`);
                    if (poopInfo.color.label) parts.push(`${poopInfo.color.emoji} ${poopInfo.color.label}`);

                    const displayText = parts.length > 0 ? parts.join(' • ') : '💩 Caca';
                    const bgColor = poopInfo.color.bgColor || 'bg-orange-100';
                    const textColor = poopInfo.color.textColor || 'text-orange-800';

                    poopDisplay = `<span class="${bgColor} ${textColor} px-3 py-1 rounded-full text-xs">${displayText}</span>`;
                }

                entryDiv.innerHTML = `
                    <div class="flex items-center justify-between mb-2">
                        <div class="flex items-center gap-2">
                            ${entry.type === 'feeding' ?
                        '<i class="fas fa-bottle-water text-blue-500 text-lg"></i>' :
                        '<div class="text-lg">👶</div>'
                    }
                            <span class="font-semibold text-gray-800">
                                ${entry.type === 'feeding' ? 'Biberon' : 'Couche'}
                            </span>
                        </div>
                        <div class="flex items-center gap-1 text-sm text-gray-500">
                            <i class="far fa-clock"></i>
                            ${formatTime(entry.timestamp)}
                        </div>
                    </div>
                    <div class="flex items-center gap-2 text-sm flex-wrap">
                        ${entry.type === 'feeding' && entry.amount ?
                        `<span class="bg-blue-100 text-blue-800 px-3 py-1 rounded-full font-medium">${entry.amount}ml</span>` : ''
                    }
                        ${entry.hasPee ?
                        '<span class="bg-blue-100 text-blue-700 px-3 py-1 rounded-full">💧 Pipi</span>' : ''
                    }
                        ${poopDisplay}
                    </div>
                `;

                elements.entriesContainer.appendChild(entryDiv);
            });
        }

        function updateBottleRecommendations() {
            const age = calculateAge();
            const recommendations = getFeedingRecommendations(age);
            const recommendedAmountEl = document.getElementById('recommended-amount');

            if (recommendedAmountEl && recommendations) {
                recommendedAmountEl.textContent = `(Recommandé : ${recommendations.volume})`;

                const amountInput = elements.amountInput;
                const defaultValue = getDefaultAmount(recommendations.volume);
                if (defaultValue && amountInput) {
                    amountInput.value = defaultValue;
                    amountInput.placeholder = `Recommandé: ${defaultValue}ml`;

                    amountInput.dispatchEvent(new Event('input'));
                }

                const feedbackEl = document.getElementById('amount-feedback');

                const checkAmount = () => {
                    const value = parseInt(amountInput.value);
                    if (!value) {
                        feedbackEl.style.display = 'none';
                        return;
                    }

                    const ranges = recommendations.volume.match(/(\d+)(?:–(\d+))?/);
                    if (!ranges) return;

                    const min = parseInt(ranges[1]);
                    const max = ranges[2] ? parseInt(ranges[2]) : min;

                    feedbackEl.style.display = 'block';

                    if (value < min) {
                        feedbackEl.className = 'text-xs mt-1 text-orange-600';
                        feedbackEl.textContent = `⚠️ Un peu faible pour jour ${age} (minimum ~${min}ml)`;
                    } else if (value > max * 1.5) {
                        feedbackEl.className = 'text-xs mt-1 text-red-600';
                        feedbackEl.textContent = `⚠️ Beaucoup pour jour ${age} (maximum conseillé ~${max}ml)`;
                    } else if (value >= min && value <= max) {
                        feedbackEl.className = 'text-xs mt-1 text-green-600';
                        feedbackEl.textContent = `✅ Parfait pour jour ${age} !`;
                    } else {
                        feedbackEl.className = 'text-xs mt-1 text-blue-600';
                        feedbackEl.textContent = `👍 Un peu plus que recommandé, mais OK`;
                    }
                };

                amountInput.removeEventListener('input', checkAmount);
                amountInput.addEventListener('input', checkAmount);
            }
        }

        function showForm(type) {
            currentEntry = {
                type: type,
                amount: '',
                hasPee: false,
                hasPoop: false,
                poopQuantity: '',
                poopConsistency: '',
                poopColor: '',
                timestamp: new Date().toISOString()
            };

            elements.actionButtons.style.display = 'none';
            elements.settingsContainer.style.display = 'none';
            elements.formContainer.style.display = 'block';
            elements.historySection.style.display = 'none';

            if (type === 'feeding') {
                elements.formTitle.textContent = '🍼 Nouveau biberon';
                elements.amountSection.style.display = 'block';

                updateBottleRecommendations();
                elements.amountInput.focus();
            } else {
                elements.formTitle.textContent = '👶 Nouvelle couche';
                elements.amountSection.style.display = 'none';
            }

            resetFormButtons();
        }

        function hideForm() {
            elements.formContainer.style.display = 'none';
            elements.settingsContainer.style.display = 'none';
            elements.actionButtons.style.display = 'flex';
            elements.historySection.style.display = 'block';
            elements.amountInput.value = '';
            elements.amountInput.placeholder = 'Ex: 120';

            document.getElementById('poop-quantity').value = '';
            document.getElementById('poop-consistency').value = '';
            document.getElementById('poop-color').value = '';

            const feedbackEl = document.getElementById('amount-feedback');
            if (feedbackEl) {
                feedbackEl.style.display = 'none';
            }
        }

        function showSettings() {
            elements.settingsContainer.style.display = 'block';
            elements.formContainer.style.display = 'none';
            elements.actionButtons.style.display = 'none';
            elements.historySection.style.display = 'none';
            updateDisplay();
        }

        function hideSettings() {
            elements.settingsContainer.style.display = 'none';
            elements.actionButtons.style.display = 'flex';
            elements.historySection.style.display = 'block';
        }

        function resetFormButtons() {
            document.getElementById('pee-yes').className = 'flex-1 py-3 rounded-xl font-medium transition-all bg-gray-100 text-gray-600 hover:bg-gray-200';
            document.getElementById('pee-no').className = 'flex-1 py-3 rounded-xl font-medium transition-all bg-gray-500 text-white shadow-lg';

            document.getElementById('poop-yes').className = 'flex-1 py-3 rounded-xl font-medium transition-all bg-gray-100 text-gray-600 hover:bg-gray-200';
            document.getElementById('poop-no').className = 'flex-1 py-3 rounded-xl font-medium transition-all bg-gray-500 text-white shadow-lg';

            document.getElementById('poop-quantity').value = '';
            document.getElementById('poop-consistency').value = '';
            document.getElementById('poop-color').value = '';

            elements.consistencySection.style.display = 'none';
        }

        function addEntry() {
            if (currentEntry.type === 'feeding' && !elements.amountInput.value) return;

            if (currentEntry.type === 'feeding') {
                currentEntry.amount = elements.amountInput.value;
            }

            const newEntry = {
                ...currentEntry,
                timestamp: new Date().toISOString()
            };

            saveEntryToFirebase(newEntry);
            hideForm();
        }

        async function resetData() {
            if (confirm('⚠️ Êtes-vous sûr de vouloir effacer toutes les données ? Cette action est irréversible.')) {
                await deleteAllEntriesFirebase();
                localStorage.removeItem('babyTrackerEntries');
                entries = [];
                updateDisplay();
            }
        }

        document.addEventListener('DOMContentLoaded', function () {
            loadEntriesLocal();
            updateDisplay();
            initializeDailyChart();

            const age = calculateAge();
            updateFeedingGuide(age);

            setTimeout(() => {
                initializeFirebase();
            }, 1000);

            // Gestionnaires d'onglets
            document.getElementById('tab-daily').addEventListener('click', () => switchTab('tab-daily'));
            document.getElementById('tab-weekly').addEventListener('click', () => switchTab('tab-weekly'));
            document.getElementById('tab-monthly').addEventListener('click', () => switchTab('tab-monthly'));

            document.getElementById('feeding-btn').addEventListener('click', () => showForm('feeding'));
            document.getElementById('diaper-btn').addEventListener('click', () => showForm('diaper'));
            document.getElementById('settings-btn').addEventListener('click', showSettings);

            document.getElementById('close-form').addEventListener('click', hideForm);
            document.getElementById('save-btn').addEventListener('click', addEntry);

            document.getElementById('pee-yes').addEventListener('click', function () {
                currentEntry.hasPee = true;
                this.className = 'flex-1 py-3 rounded-xl font-medium transition-all bg-blue-500 text-white shadow-lg';
                document.getElementById('pee-no').className = 'flex-1 py-3 rounded-xl font-medium transition-all bg-gray-100 text-gray-600 hover:bg-gray-200';
            });

            document.getElementById('pee-no').addEventListener('click', function () {
                currentEntry.hasPee = false;
                this.className = 'flex-1 py-3 rounded-xl font-medium transition-all bg-gray-500 text-white shadow-lg';
                document.getElementById('pee-yes').className = 'flex-1 py-3 rounded-xl font-medium transition-all bg-gray-100 text-gray-600 hover:bg-gray-200';
            });

            document.getElementById('poop-yes').addEventListener('click', function () {
                currentEntry.hasPoop = true;
                this.className = 'flex-1 py-3 rounded-xl font-medium transition-all bg-orange-500 text-white shadow-lg';
                document.getElementById('poop-no').className = 'flex-1 py-3 rounded-xl font-medium transition-all bg-gray-100 text-gray-600 hover:bg-gray-200';
                elements.consistencySection.style.display = 'block';
            });

            document.getElementById('poop-no').addEventListener('click', function () {
                currentEntry.hasPoop = false;
                currentEntry.poopQuantity = '';
                currentEntry.poopConsistency = '';
                currentEntry.poopColor = '';
                this.className = 'flex-1 py-3 rounded-xl font-medium transition-all bg-gray-500 text-white shadow-lg';
                document.getElementById('poop-yes').className = 'flex-1 py-3 rounded-xl font-medium transition-all bg-gray-100 text-gray-600 hover:bg-gray-200';
                elements.consistencySection.style.display = 'none';

                document.getElementById('poop-quantity').value = '';
                document.getElementById('poop-consistency').value = '';
                document.getElementById('poop-color').value = '';
            });

            document.getElementById('poop-quantity').addEventListener('change', function () {
                currentEntry.poopQuantity = this.value;
            });

            document.getElementById('poop-consistency').addEventListener('change', function () {
                currentEntry.poopConsistency = this.value;
            });

            document.getElementById('poop-color').addEventListener('change', function () {
                currentEntry.poopColor = this.value;
            });

            document.getElementById('close-settings').addEventListener('click', hideSettings);
            document.getElementById('reset-btn').addEventListener('click', resetData);

            elements.amountInput.addEventListener('input', function () {
                const saveBtn = document.getElementById('save-btn');
                if (currentEntry.type === 'feeding' && !this.value) {
                    saveBtn.disabled = true;
                } else {
                    saveBtn.disabled = false;
                }
            });
        });
