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
    getDocs,
    updateDoc,
    where  // <- Ajouter cette ligne
} from 'https://www.gstatic.com/firebasejs/9.23.0/firebase-firestore.js';
// === CONFIGURATION ===
const firebaseConfig = {
    apiKey: "AIzaSyCPQpB3cYk2sgbOVQ8KLbU1Qj2U67D2rZ4",
    authDomain: "suivi-loan.firebaseapp.com",
    projectId: "suivi-loan",
    storageBucket: "suivi-loan.firebasestorage.app",
    messagingSenderId: "334984699415",
    appId: "1:334984699415:web:8b41abb9360d31efabc652",
    measurementId: "G-RWZ0S704RJ"
};

const NTFY_URL = 'https://ntfy.sh/SuiviLoan';

const BABY_BIRTH_DATE = new Date('2025-09-06T06:38:00');
const BABY_INFO = {
    name: 'Loan',
    birthWeight: 3.290,
    birthLength: 48,
    parents: ['Dylan', 'Chloé']
};

const FEEDING_GUIDE = {
    1: { volume: '5–10ml', frequency: '8–12 fois/24h', total: '40–120ml', comment: 'Estomac très petit, petites quantités très fréquentes' },
    2: { volume: '10–20ml', frequency: '8–12 fois/24h', total: '80–240ml', comment: 'Progression rapide, petites tétées fréquentes' },
    3: { volume: '20–30ml', frequency: '8–10 fois/24h', total: '160–300ml', comment: 'Bébé commence à boire plus régulièrement' },
    4: { volume: '45–60ml', frequency: '6–8 fois/24h', total: '270–480ml', comment: 'Adaptation au lait, souvent nécessaire de compléter un peu' },
    5: { volume: '60–80ml', frequency: '6–8 fois/24h', total: '360–640ml', comment: 'Volumes plus importants, espacer les biberons' },
    6: { volume: '60–80ml', frequency: '6–8 fois/24h', total: '360–640ml', comment: 'Rot + massages si besoin, surveiller selles et couches' },
    7: { volume: '60–80ml', frequency: '6–8 fois/24h', total: '360–640ml', comment: 'Fin de première semaine, rythme qui se stabilise' }
};

const FEEDING_RANGES = [
    { days: [8, 9, 10, 11, 12, 13, 14], volume: '60–90ml', frequency: '6–8 fois/24h', total: '360–720ml', comment: 'Deuxième semaine, augmentation progressive' },
    { days: [15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28], volume: '90–120ml', frequency: '6–7 fois/24h', total: '540–840ml', comment: 'Troisième et quatrième semaines' }
];

const FEEDING_MONTHS = {
    1: { volume: '120–150ml', frequency: '5–6 fois/24h', total: '600–900ml', comment: '1 mois - Volumes stabilisés' },
    2: { volume: '150–180ml', frequency: '5–6 fois/24h', total: '750–1080ml', comment: '2 mois - Croissance régulière' },
    3: { volume: '180–210ml', frequency: '5 fois/24h', total: '900–1050ml', comment: '3 mois - Rythme bien établi' },
    4: { volume: '210ml env.', frequency: '4–5 fois/24h', total: '840–1050ml', comment: '4 mois - Préparation diversification' },
    5: { volume: '210–240ml', frequency: '4–5 fois/24h', total: '840–1200ml', comment: '5 mois - Possible début diversification' },
    6: { volume: '240ml env.', frequency: '4–5 fois/24h', total: 'Variable', comment: '6 mois - Diversification alimentaire commence' }
};

// === VARIABLES GLOBALES ===
let app, db, dailyChart;
let entries = [];
let medications = [];
let appointments = [];
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
let editingId = null;

// === INITIALISATION FIREBASE ===
try {
    app = initializeApp(firebaseConfig);
    db = getFirestore(app);
    console.log('Firebase initialisé avec succès');
} catch (error) {
    console.error('Erreur initialisation Firebase:', error);
}

// === ÉLÉMENTS DOM ===
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
    guideAge: document.getElementById('guide-age'),
    feedingGuide: document.getElementById('feeding-guide'),
    timeInput: document.getElementById('time-input'),
    dateInput: document.getElementById('date-input'),
    selectedTimeDisplay: document.getElementById('selected-time-display'),
    saveBtnText: document.getElementById('save-btn-text')
};

// === FONCTIONS UTILITAIRES ===
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

function formatDateTime(timestamp) {
    const date = new Date(timestamp);
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    if (date.toDateString() === today.toDateString()) {
        return formatTime(timestamp);
    } else if (date.toDateString() === yesterday.toDateString()) {
        return `Hier ${formatTime(timestamp)}`;
    } else {
        return `${date.getDate()}/${date.getMonth() + 1} ${formatTime(timestamp)}`;
    }
}

function getCurrentTimeString() {
    const now = new Date();
    const hours = String(now.getHours()).padStart(2, '0');
    const minutes = String(now.getMinutes()).padStart(2, '0');
    return `${hours}:${minutes}`;
}

function getCurrentDateString() {
    const now = new Date();
    // Utiliser directement les méthodes locales pour éviter les problèmes de timezone
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

function createTimestampFromInputs() {
    const timeValue = elements.timeInput.value;
    const dateValue = elements.dateInput.value;

    if (!timeValue || !dateValue) {
        return new Date().toISOString();
    }

    try {
        const [hours, minutes] = timeValue.split(':').map(Number);
        const date = new Date(dateValue + 'T00:00:00');
        
        // Vérifier que la date est valide
        if (isNaN(date.getTime())) {
            console.error('Date invalide:', dateValue);
            return new Date().toISOString();
        }
        
        date.setHours(hours, minutes, 0, 0);
        return date.toISOString();
    } catch (error) {
        console.error('Erreur création timestamp:', error);
        return new Date().toISOString();
    }
}

function getDayStart(date) {
    const dayStart = new Date(date);
    dayStart.setHours(7, 0, 0, 0);
    if (date.getHours() < 7) {
        dayStart.setDate(dayStart.getDate() - 1);
    }
    return dayStart;
}

function getDayEnd(date) {
    const dayEnd = new Date(date);
    dayEnd.setHours(6, 30, 0, 0);
    dayEnd.setDate(dayEnd.getDate() + 1);
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

// === NOTIFICATIONS NTFY ===
// async function sendNotification(message, title = 'Petit Loan', priority = 'default', tags = 'baby') {
//     try {
//         await fetch(NTFY_URL, {
//             method: 'POST',
//             body: message,
//             headers: {
//                 'Title': title,
//                 'Priority': priority,
//                 'Tags': tags
//             }
//         });
//     } catch (error) {
//         console.error('Erreur notification:', error);
//     }
// }

// === FONCTIONS D'ALIMENTATION ===
function getFeedingRecommendations(ageInDays) {
    if (FEEDING_GUIDE[ageInDays]) {
        return FEEDING_GUIDE[ageInDays];
    }

    for (const range of FEEDING_RANGES) {
        if (range.days.includes(ageInDays)) {
            return {
                volume: range.volume,
                frequency: range.frequency,
                total: range.total,
                comment: range.comment
            };
        }
    }

    if (ageInDays >= 29) {
        const ageInMonths = Math.floor(ageInDays / 30);
        const monthData = FEEDING_MONTHS[Math.min(ageInMonths, 6)];

        if (monthData) {
            return {
                volume: monthData.volume,
                frequency: monthData.frequency,
                total: monthData.total,
                comment: monthData.comment
            };
        }

        return {
            volume: '240ml+',
            frequency: '4–5 fois/24h',
            total: 'Variable',
            comment: 'Diversification alimentaire en cours, consulter le pédiatre'
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
                ${recommendations.total ? `
                    <div class="mb-2">
                        <strong>📊 Total/jour :</strong>
                        <span class="text-blue-900 font-medium">${recommendations.total}</span>
                    </div>
                ` : ''}
                <div class="text-xs text-blue-600 italic">
                    💡 ${recommendations.comment}
                </div>
            `;
        }
    }
}

// === GESTION FIREBASE ===
// === GESTION FIREBASE ===
function initializeFirebase() {
    if (!db) {
        console.error('Firebase non disponible');
        return;
    }

    try {
        // Sync des entrées (biberons/couches) - garder comme avant
        const entriesQuery = query(collection(db, 'entries'), orderBy('timestamp', 'desc'));
        onSnapshot(entriesQuery, (snapshot) => {
            entries = [];
            snapshot.forEach((doc) => {
                const data = doc.data();
                entries.push({
                    id: doc.id,
                    ...data
                });
            });
            updateDisplay();
            localStorage.setItem('babyTrackerEntries', JSON.stringify(entries));
        }, (error) => {
            console.error('Erreur sync entries:', error);
        });

        // Sync des médicaments (Firebase uniquement)
        const medicationsQuery = query(collection(db, 'medications'), orderBy('timestamp', 'desc'));
        onSnapshot(medicationsQuery, (snapshot) => {
            medications = [];
            snapshot.forEach((doc) => {
                const data = doc.data();
                medications.push({
                    id: doc.id,
                    ...data
                });
            });
            console.log(`${medications.length} médicaments chargés depuis Firebase`);
            updateMedicationDisplay();
            // PAS de localStorage pour les médicaments
        }, (error) => {
            console.error('Erreur sync médicaments:', error);
        });

        // Sync des rendez-vous (Firebase uniquement)
        const appointmentsQuery = query(collection(db, 'appointments'), orderBy('timestamp', 'desc'));
        onSnapshot(appointmentsQuery, (snapshot) => {
            appointments = [];
            snapshot.forEach((doc) => {
                const data = doc.data();
                appointments.push({
                    id: doc.id,
                    ...data
                });
            });
            console.log(`${appointments.length} rendez-vous chargés depuis Firebase`);
            updateAppointmentDisplay();
            // PAS de localStorage pour les RDV
        }, (error) => {
            console.error('Erreur sync RDV:', error);
        });

        // Sync des stocks - garder comme avant
    const stocksQuery = query(collection(db, 'stocks'));
onSnapshot(stocksQuery, (snapshot) => {
    console.log(`${snapshot.size} éléments de stock chargés depuis Firebase`);
    
    snapshot.forEach((doc) => {
        const data = doc.data();
        
        if (data.type === 'milk-powder' && data.date) {
            const element = document.getElementById('milk-powder-date');
            if (element) {
                element.textContent = data.date;
                console.log('Date lait en poudre affichée:', data.date);
            }
            // PAS de localStorage pour être cohérent avec les autres données
        }
        
        if (data.type === 'water-bottle' && data.datetime) {
            const element = document.getElementById('water-bottle-datetime');
            if (element) {
                element.textContent = data.datetime;
                console.log('Date/heure bouteille affichée:', data.datetime);
            }
            // PAS de localStorage pour être cohérent avec les autres données
        }
    });
}, (error) => {
    console.error('Erreur sync stocks:', error);
});

    } catch (error) {
        console.error('Erreur Firebase:', error);
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
        if (editingId) {
            const index = entries.findIndex(e => e.id === editingId);
            if (index !== -1) {
                entries[index] = { ...entry, id: editingId };
            }
        } else {
            entries.unshift({ ...entry, id: Date.now().toString() });
        }
        localStorage.setItem('babyTrackerEntries', JSON.stringify(entries));
        updateDisplay();
        return;
    }

    try {
        if (editingId) {
            await updateDoc(doc(db, 'entries', editingId), {
                type: entry.type,
                amount: entry.amount,
                hasPee: entry.hasPee,
                hasPoop: entry.hasPoop,
                poopQuantity: entry.poopQuantity,
                poopConsistency: entry.poopConsistency,
                poopColor: entry.poopColor,
                timestamp: entry.timestamp
            });
        } else {
            await addDoc(collection(db, 'entries'), {
                type: entry.type,
                amount: entry.amount,
                hasPee: entry.hasPee,
                hasPoop: entry.hasPoop,
                poopQuantity: entry.poopQuantity,
                poopConsistency: entry.poopConsistency,
                poopColor: entry.poopColor,
                timestamp: entry.timestamp
            });
        }
    } catch (error) {
        if (editingId) {
            const index = entries.findIndex(e => e.id === editingId);
            if (index !== -1) {
                entries[index] = { ...entry, id: editingId };
            }
        } else {
            entries.unshift({ ...entry, id: Date.now().toString() });
        }
        localStorage.setItem('babyTrackerEntries', JSON.stringify(entries));
        updateDisplay();
    }
}

async function deleteEntry(entryId) {
    if (!db) {
        entries = entries.filter(e => e.id !== entryId);
        localStorage.setItem('babyTrackerEntries', JSON.stringify(entries));
        updateDisplay();
        return;
    }

    try {
        await deleteDoc(doc(db, 'entries', entryId));
    } catch (error) {
        entries = entries.filter(e => e.id !== entryId);
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

// === GESTION DES STATISTIQUES ===
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

// === GESTION DU GRAPHIQUE ===
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

    const hourLabels = [];
    const data = [];

    for (let h = 7; h < 31; h++) {
        const displayHour = h > 24 ? h - 24 : h;
        const hourStr = h === 30 ? '6:30' : `${displayHour}h`;
        hourLabels.push(hourStr);

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

// === GESTION DES ONGLETS ===
function switchTab(tabId) {
    // Masquer les nouvelles sections
    document.querySelectorAll('[id$="-section"]:not(#history-section)').forEach(section => {
        section.style.display = 'none';
    });

    // Réinitialiser tous les onglets
    document.querySelectorAll('.tab-button').forEach(btn => {
        btn.classList.remove('active');
        btn.classList.add('text-gray-600');
    });

    document.getElementById(tabId).classList.add('active');
    document.getElementById(tabId).classList.remove('text-gray-600');

    // Afficher les bonnes sections
    document.getElementById('daily-stats').style.display = tabId === 'tab-daily' ? 'grid' : 'none';
    document.getElementById('weekly-stats').style.display = tabId === 'tab-weekly' ? 'grid' : 'none';
    document.getElementById('monthly-stats').style.display = tabId === 'tab-monthly' ? 'grid' : 'none';
    
    // Toujours afficher l'historique et les boutons pour les onglets principaux
    document.getElementById('history-section').style.display = 'block';
    elements.actionButtons.style.display = 'flex';

    const period = tabId.replace('tab-', '');
    const filteredEntries = getFilteredEntries(period);
    updateStatistics(period, filteredEntries);
}

function switchToSection(sectionId) {
    // Masquer toutes les sections SAUF l'historique
    document.querySelectorAll('[id$="-section"], [id$="-stats"]').forEach(section => {
        if (section.id !== 'history-section') {
            section.style.display = 'none';
        }
    });
    
    // Réafficher l'historique pour les onglets principaux
    if (sectionId.includes('daily') || sectionId.includes('weekly') || sectionId.includes('monthly')) {
        document.getElementById('history-section').style.display = 'block';
    } else {
        document.getElementById('history-section').style.display = 'none';
    }

    // Réinitialiser tous les onglets
    document.querySelectorAll('.tab-button').forEach(btn => {
        btn.classList.remove('active');
        btn.classList.add('text-gray-600');
    });

    // Afficher la section et activer l'onglet correspondant
    const section = document.getElementById(sectionId);
    if (section) {
        section.style.display = 'block';
    }

    const tabId = sectionId.replace('-section', '').replace('-stats', '');
    const tab = document.getElementById(`tab-${tabId}`);
    if (tab) {
        tab.classList.add('active');
        tab.classList.remove('text-gray-600');
    }
}

// === GESTION DES FORMULAIRES ===
function showForm(type) {
    if (!editingId) {
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

        // CORRECTION: Initialiser avec la date/heure actuelle
        elements.timeInput.value = getCurrentTimeString();
        elements.dateInput.value = getCurrentDateString();
        
        elements.formTitle.textContent = type === 'feeding' ? '🍼 Nouveau biberon' : '👶 Nouvelle couche';
        elements.saveBtnText.textContent = 'Enregistrer';
    }

    elements.actionButtons.style.display = 'none';
    elements.settingsContainer.style.display = 'none';
    elements.formContainer.style.display = 'block';
    elements.historySection.style.display = 'none';

    if (type === 'feeding') {
        elements.amountSection.style.display = 'block';
        if (!editingId) {
            updateBottleRecommendations();
            elements.amountInput.focus();
        }
    } else {
        elements.amountSection.style.display = 'none';
    }

    if (!editingId) {
        resetFormButtons();
    }
}

function hideForm() {
    elements.formContainer.style.display = 'none';
    elements.settingsContainer.style.display = 'none';
    elements.actionButtons.style.display = 'flex';
    elements.historySection.style.display = 'block';

    editingId = null;
    elements.amountInput.value = '';
    elements.amountInput.placeholder = 'Ex: 120';
    
    // CORRECTION: Réinitialiser aux valeurs actuelles
    elements.timeInput.value = getCurrentTimeString();
    elements.dateInput.value = getCurrentDateString();

    document.getElementById('poop-quantity').value = '';
    document.getElementById('poop-consistency').value = '';
    document.getElementById('poop-color').value = '';

    const feedbackEl = document.getElementById('amount-feedback');
    if (feedbackEl) {
        feedbackEl.style.display = 'none';
    }

    elements.saveBtnText.textContent = 'Enregistrer';
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

// === GESTION DES ENTRÉES ===
function addEntry() {
    // Validation pour les biberons
    if (currentEntry.type === 'feeding' && !elements.amountInput.value) {
        alert('Veuillez saisir la quantité de lait');
        return;
    }

    // Validation pour les couches (au moins pipi ou caca)
    if (currentEntry.type === 'diaper' && !currentEntry.hasPee && !currentEntry.hasPoop) {
        alert('Veuillez indiquer au moins pipi ou caca pour la couche');
        return;
    }

    if (currentEntry.type === 'feeding') {
        currentEntry.amount = elements.amountInput.value;
    }

    // CORRECTION: S'assurer que le timestamp est correct
    currentEntry.timestamp = createTimestampFromInputs();

    const newEntry = { ...currentEntry };

    saveEntryToFirebase(newEntry);
    hideForm();
}
function editEntry(entryId) {
    const entry = entries.find(e => e.id === entryId);
    if (!entry) return;

    editingId = entryId;
    currentEntry = { ...entry };

    const entryDate = new Date(entry.timestamp);
    elements.timeInput.value = entryDate.toTimeString().slice(0, 5);
    elements.dateInput.value = entryDate.toISOString().slice(0, 10);

    elements.formTitle.textContent = entry.type === 'feeding' ? '🍼 Modifier le biberon' : '👶 Modifier la couche';
    elements.saveBtnText.textContent = 'Modifier';

    if (entry.type === 'feeding') {
        elements.amountSection.style.display = 'block';
        elements.amountInput.value = entry.amount || '';
    } else {
        elements.amountSection.style.display = 'none';
    }

    // Set pee buttons
    if (entry.hasPee) {
        document.getElementById('pee-yes').className = 'flex-1 py-3 rounded-xl font-medium transition-all bg-blue-500 text-white shadow-lg';
        document.getElementById('pee-no').className = 'flex-1 py-3 rounded-xl font-medium transition-all bg-gray-100 text-gray-600 hover:bg-gray-200';
    } else {
        document.getElementById('pee-no').className = 'flex-1 py-3 rounded-xl font-medium transition-all bg-gray-500 text-white shadow-lg';
        document.getElementById('pee-yes').className = 'flex-1 py-3 rounded-xl font-medium transition-all bg-gray-100 text-gray-600 hover:bg-gray-200';
    }

    // Set poop buttons and details
    if (entry.hasPoop) {
        document.getElementById('poop-yes').className = 'flex-1 py-3 rounded-xl font-medium transition-all bg-orange-500 text-white shadow-lg';
        document.getElementById('poop-no').className = 'flex-1 py-3 rounded-xl font-medium transition-all bg-gray-100 text-gray-600 hover:bg-gray-200';
        elements.consistencySection.style.display = 'block';

        document.getElementById('poop-quantity').value = entry.poopQuantity || '';
        document.getElementById('poop-consistency').value = entry.poopConsistency || '';
        document.getElementById('poop-color').value = entry.poopColor || '';
    } else {
        document.getElementById('poop-no').className = 'flex-1 py-3 rounded-xl font-medium transition-all bg-gray-500 text-white shadow-lg';
        document.getElementById('poop-yes').className = 'flex-1 py-3 rounded-xl font-medium transition-all bg-gray-100 text-gray-600 hover:bg-gray-200';
        elements.consistencySection.style.display = 'none';
    }

    showForm(entry.type);
}

function confirmDeleteEntry(entryId) {
    if (confirm('Êtes-vous sûr de vouloir supprimer cette entrée ?')) {
        deleteEntry(entryId);
    }
}

function updateBottleRecommendations() {
    const age = calculateAge();
    const recommendations = getFeedingRecommendations(age);
    const recommendedAmountEl = document.getElementById('recommended-amount');

    if (recommendedAmountEl && recommendations) {
        recommendedAmountEl.textContent = `(Recommandé : ${recommendations.volume})`;

        const amountInput = elements.amountInput;
        if (!editingId) {
            const defaultValue = getDefaultAmount(recommendations.volume);
            if (defaultValue && amountInput) {
                amountInput.value = defaultValue;
                amountInput.placeholder = `Recommandé: ${defaultValue}ml`;
            }
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

// === GESTION DE L'HISTORIQUE ===
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
        entryDiv.className = 'entry-item bg-white/80 glass rounded-2xl p-4 shadow-sm border border-white/50 fade-in relative';

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
                <div class="flex items-center gap-2">
                    <div class="flex items-center gap-1 text-sm text-gray-500">
                        <i class="far fa-clock"></i>
                        ${formatDateTime(entry.timestamp)}
                    </div>
                    <div class="entry-actions flex gap-1">
                        <button onclick="editEntry('${entry.id}')" 
                            class="w-8 h-8 flex items-center justify-center text-blue-500 hover:text-blue-700 hover:bg-blue-50 rounded-full transition-all">
                            <i class="fas fa-edit text-sm"></i>
                        </button>
                        <button onclick="confirmDeleteEntry('${entry.id}')" 
                            class="w-8 h-8 flex items-center justify-center text-red-500 hover:text-red-700 hover:bg-red-50 rounded-full transition-all">
                            <i class="fas fa-trash text-sm"></i>
                        </button>
                    </div>
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

// === GESTION DES MÉDICAMENTS ===
function showMedicationForm() {
    document.getElementById('medication-form').style.display = 'block';
    elements.actionButtons.style.display = 'none';
    elements.historySection.style.display = 'none';

    // CORRECTION: Initialiser avec la date/heure actuelle
    document.getElementById('medication-date').value = getCurrentDateString();
    document.getElementById('medication-time').value = getCurrentTimeString();
}

function hideMedicationForm() {
    document.getElementById('medication-form').style.display = 'none';
    elements.actionButtons.style.display = 'flex';
    elements.historySection.style.display = 'block';

    document.getElementById('medication-name').value = '';
    document.getElementById('medication-dosage').value = '';
    document.getElementById('medication-interval').value = '';
}

async function saveMedication() {
    const name = document.getElementById('medication-name').value;
    const dosage = document.getElementById('medication-dosage').value;
    const date = document.getElementById('medication-date').value;
    const time = document.getElementById('medication-time').value;
    const interval = document.getElementById('medication-interval').value;

    if (!name || !dosage || !date || !time) {
        alert('Veuillez remplir tous les champs obligatoires');
        return;
    }

    if (!db) {
        alert('Firebase non disponible');
        return;
    }

    try {
        const medication = {
            name,
            dosage,
            timestamp: new Date(`${date}T${time}:00`).toISOString(),
            interval: interval ? parseInt(interval) : null,
            lastGiven: new Date(`${date}T${time}:00`).toISOString()
        };

        // Sauvegarder UNIQUEMENT dans Firebase
        await addDoc(collection(db, 'medications'), medication);
        
        console.log('Médicament sauvegardé dans Firebase');
        hideMedicationForm();
        
        // Les données s'afficheront automatiquement via onSnapshot
        
    } catch (error) {
        console.error('Erreur sauvegarde médicament Firebase:', error);
        alert('Erreur lors de la sauvegarde du médicament');
    }
}

async function saveMedicationToFirebase(medication) {
    try {
        await addDoc(collection(db, 'medications'), medication);
    } catch (error) {
        console.error('Erreur sauvegarde médicament:', error);
    }
}

function updateMedicationDisplay() {
    const container = document.getElementById('medication-entries');
    if (!container) return;

    container.innerHTML = '';

    medications.forEach(medication => {
        const now = new Date();
        const lastGiven = new Date(medication.lastGiven);
        const hoursSinceLastDose = (now - lastGiven) / (1000 * 60 * 60);

        let statusClass = 'medication-available';
        let statusText = 'Peut être donné';
        let statusIcon = '✅';

        if (medication.interval) {
            if (hoursSinceLastDose < medication.interval) {
                // Calculer l'heure de la prochaine prise
                const nextDose = new Date(lastGiven);
                nextDose.setHours(nextDose.getHours() + medication.interval);
                
                const hoursRemaining = medication.interval - hoursSinceLastDose;
                
                if (hoursRemaining <= 1) {
                    statusClass = 'medication-soon pulse-gentle';
                    statusText = `Prochaine prise à : ${formatTime(nextDose.toISOString())}`;
                    statusIcon = '⏰';
                } else {
                    statusClass = 'medication-waiting';
                    statusText = `Prochaine prise à : ${formatTime(nextDose.toISOString())}`;
                    statusIcon = '⏳';
                }
            }
        }

        const medicationDiv = document.createElement('div');
        medicationDiv.className = `medication-item ${statusClass} rounded-xl p-3 mb-3 border-2`;

        medicationDiv.innerHTML = `
            <div class="flex items-center justify-between mb-2">
                <div class="flex items-center gap-2">
                    <span class="text-lg">${statusIcon}</span>
                    <div>
                        <h5 class="font-semibold text-gray-800">${medication.name}</h5>
                        <p class="text-sm text-gray-600">${medication.dosage}</p>
                    </div>
                </div>
                <div class="text-right">
                    <p class="text-xs text-gray-500">${formatDateTime(medication.lastGiven)}</p>
                    <p class="text-xs font-medium">${statusText}</p>
                </div>
            </div>
            <div class="flex gap-2">
                ${hoursSinceLastDose >= (medication.interval || 0) ?
                `<button onclick="giveMedication('${medication.id}')" class="flex-1 bg-green-500 text-white py-2 rounded-lg text-sm font-medium">Donner maintenant</button>` :
                `<button disabled class="flex-1 bg-gray-300 text-gray-500 py-2 rounded-lg text-sm font-medium">Pas encore</button>`
            }
                <button onclick="deleteMedication('${medication.id}')" class="px-3 bg-red-100 text-red-600 rounded-lg text-sm">
                    <i class="fas fa-trash"></i>
                </button>
            </div>
        `;

        container.appendChild(medicationDiv);
    });
}

async function giveMedication(medicationId) {
    const medication = medications.find(m => m.id === medicationId);
    if (!medication) return;

    if (!db) {
        alert('Firebase non disponible');
        return;
    }

    const newLastGiven = new Date().toISOString();
    
    try {
        // Mettre à jour dans Firebase
        await updateDoc(doc(db, 'medications', medicationId), {
            lastGiven: newLastGiven
        });
        
        console.log('Médicament mis à jour dans Firebase');
        
        // L'affichage se mettra à jour automatiquement via onSnapshot
        
    } catch (error) {
        console.error('Erreur mise à jour médicament Firebase:', error);
        alert('Erreur lors de la mise à jour');
    }
}


async function scheduleNextMedicationNotification(medication) {
    if (!medication.interval) return;

    const nextDose = new Date(medication.lastGiven);
    nextDose.setHours(nextDose.getHours() + medication.interval);

    const now = new Date();
    const delay = nextDose - now;

    if (delay > 0) {
        setTimeout(() => {
            sendNotification(
                `💊 Il est temps de donner ${medication.name} (${medication.dosage}) à ${BABY_INFO.name}`,
                'Médicament - Petit Loan',
                'default',
                'pill,baby,medication'
            );
        }, delay);
    }
}

// === GESTION DES RENDEZ-VOUS ===
function showAppointmentForm() {
    document.getElementById('appointment-form').style.display = 'block';
    elements.actionButtons.style.display = 'none';
    elements.historySection.style.display = 'none';
    
    // CORRECTION: Initialiser avec la date actuelle (pas l'heure pour les RDV)
    document.getElementById('appointment-date').value = getCurrentDateString();
}

function hideAppointmentForm() {
    document.getElementById('appointment-form').style.display = 'none';
    elements.actionButtons.style.display = 'flex';
    elements.historySection.style.display = 'block';

    document.getElementById('appointment-type').value = '';
    document.getElementById('appointment-doctor').value = '';
    document.getElementById('appointment-date').value = '';
    document.getElementById('appointment-time').value = '';
    document.getElementById('appointment-location').value = '';
}
async function saveAppointment() {
    const type = document.getElementById('appointment-type').value;
    const doctor = document.getElementById('appointment-doctor').value;
    const date = document.getElementById('appointment-date').value;
    const time = document.getElementById('appointment-time').value;
    const location = document.getElementById('appointment-location').value;

    if (!type || !date || !time) {
        alert('Veuillez remplir tous les champs obligatoires');
        return;
    }

    if (!db) {
        alert('Firebase non disponible');
        return;
    }

    try {
        const appointment = {
            type,
            doctor,
            location,
            timestamp: new Date(`${date}T${time}:00`).toISOString()
        };

        // Sauvegarder UNIQUEMENT dans Firebase
        await addDoc(collection(db, 'appointments'), appointment);
        
        console.log('Rendez-vous sauvegardé dans Firebase');
        hideAppointmentForm();
        
        // Les données s'afficheront automatiquement via onSnapshot
        
    } catch (error) {
        console.error('Erreur sauvegarde RDV Firebase:', error);
        alert('Erreur lors de la sauvegarde du rendez-vous');
    }
}
async function saveAppointmentToFirebase(appointment) {
    try {
        await addDoc(collection(db, 'appointments'), appointment);
    } catch (error) {
        console.error('Erreur sauvegarde RDV:', error);
    }
}

function updateAppointmentDisplay() {
    const container = document.getElementById('appointment-entries');
    if (!container) return;

    container.innerHTML = '';

    appointments.forEach(appointment => {
        const appointmentDate = new Date(appointment.timestamp);
        const now = new Date();
        const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        const appointmentDay = new Date(appointmentDate.getFullYear(), appointmentDate.getMonth(), appointmentDate.getDate());

        let statusClass = '';
        let statusIcon = '📅';

        if (appointmentDay.getTime() === today.getTime()) {
            statusClass = 'appointment-today pulse-gentle';
            statusIcon = '🚨';
        } else if (appointmentDate > now && appointmentDate < new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000)) {
            statusClass = 'appointment-upcoming';
            statusIcon = '⏰';
        }

        const appointmentDiv = document.createElement('div');
        appointmentDiv.className = `${statusClass} rounded-xl p-3 mb-3 border-2 border-gray-200`;

        appointmentDiv.innerHTML = `
            <div class="flex items-center justify-between mb-2">
                <div class="flex items-center gap-2">
                    <span class="text-lg">${statusIcon}</span>
                    <div>
                        <h5 class="font-semibold text-gray-800">${appointment.type}</h5>
                        <p class="text-sm text-gray-600">${appointment.doctor || 'Praticien non renseigné'}</p>
                    </div>
                </div>
                <button onclick="deleteAppointment('${appointment.id}')" class="text-red-500 hover:text-red-700">
                    <i class="fas fa-trash"></i>
                </button>
            </div>
            <div class="text-sm text-gray-600">
                <p><i class="far fa-calendar mr-2"></i>${formatDateTime(appointment.timestamp)}</p>
                ${appointment.location ? `<p><i class="fas fa-map-marker-alt mr-2"></i>${appointment.location}</p>` : ''}
            </div>
        `;

        container.appendChild(appointmentDiv);
    });
}

async function deleteMedication(medicationId) {
    if (!confirm('Supprimer ce médicament ?')) return;
    
    if (!db) {
        alert('Firebase non disponible');
        return;
    }

    try {
        await deleteDoc(doc(db, 'medications', medicationId));
        console.log('Médicament supprimé de Firebase');
        
        // L'affichage se mettra à jour automatiquement via onSnapshot
        
    } catch (error) {
        console.error('Erreur suppression médicament Firebase:', error);
        alert('Erreur lors de la suppression');
    }
}
async function deleteAppointment(appointmentId) {
    if (!confirm('Supprimer ce rendez-vous ?')) return;
    
    if (!db) {
        alert('Firebase non disponible');
        return;
    }

    try {
        await deleteDoc(doc(db, 'appointments', appointmentId));
        console.log('Rendez-vous supprimé de Firebase');
        
        // L'affichage se mettra à jour automatiquement via onSnapshot
        
    } catch (error) {
        console.error('Erreur suppression RDV Firebase:', error);
        alert('Erreur lors de la suppression');
    }
}
async function scheduleAppointmentReminder(appointment) {
    const appointmentDate = new Date(appointment.timestamp);
    const reminderDate = new Date(appointmentDate);
    reminderDate.setDate(reminderDate.getDate() - 1);
    reminderDate.setHours(9, 0, 0, 0);

    const now = new Date();
    const delay = reminderDate - now;

    if (delay > 0) {
        setTimeout(() => {
            const locationText = appointment.location ? ` à ${appointment.location}` : '';
            const doctorText = appointment.doctor ? ` chez ${appointment.doctor}` : '';

            sendNotification(
                `🏥 Rappel: RDV ${appointment.type} demain à ${formatTime(appointment.timestamp)}${doctorText}${locationText}`,
                'Rappel RDV - Petit Loan',
                'default',
                'calendar,baby,reminder'
            );
        }, delay);
    }
}

// === GESTION DES STOCKS ===
async function setMilkPowderDate() {
    const date = prompt('Date d\'ouverture du lait en poudre (JJ/MM/AAAA):');
    if (!date) return;

    if (!db) {
        alert('Firebase non disponible');
        return;
    }

    try {
        // Supprimer l'ancien enregistrement s'il existe
        const existingQuery = query(collection(db, 'stocks'), where('type', '==', 'milk-powder'));
        const querySnapshot = await getDocs(existingQuery);
        
        querySnapshot.forEach(async (document) => {
            await deleteDoc(doc(db, 'stocks', document.id));
        });

        // Ajouter le nouveau
        await addDoc(collection(db, 'stocks'), {
            type: 'milk-powder',
            date: date,
            timestamp: new Date().toISOString()
        });

        console.log('Date lait en poudre sauvegardée dans Firebase');
        
    } catch (error) {
        console.error('Erreur sauvegarde date lait Firebase:', error);
        alert('Erreur lors de la sauvegarde');
    }
}

async function setWaterBottleDateTime() {
    const datetime = prompt('Date et heure d\'ouverture de la bouteille d\'eau (JJ/MM/AAAA HH:MM):');
    if (!datetime) return;

    if (!db) {
        alert('Firebase non disponible');
        return;
    }

    try {
        // Supprimer l'ancien enregistrement s'il existe
        const existingQuery = query(collection(db, 'stocks'), where('type', '==', 'water-bottle'));
        const querySnapshot = await getDocs(existingQuery);
        
        querySnapshot.forEach(async (document) => {
            await deleteDoc(doc(db, 'stocks', document.id));
        });

        // Ajouter le nouveau
        await addDoc(collection(db, 'stocks'), {
            type: 'water-bottle',
            datetime: datetime,
            timestamp: new Date().toISOString()
        });

        console.log('Date/heure bouteille d\'eau sauvegardée dans Firebase');
        
    } catch (error) {
        console.error('Erreur sauvegarde datetime eau Firebase:', error);
        alert('Erreur lors de la sauvegarde');
    }
}

// === CONSEILS PAR ÂGE ===
function updateTipsContent() {
    const age = calculateAge();
    const tipsContainer = document.getElementById('tips-content');
    if (!tipsContainer) return;

    let tips = '';

    if (age <= 7) {
        tips = `
            <div class="bg-white/80 glass rounded-2xl p-4 shadow-sm border border-white/50 mb-4">
                <h4 class="text-sm font-semibold text-gray-800 mb-3">🍼 Premiers jours (${age} jours)</h4>
                <ul class="text-sm text-gray-700 space-y-2">
                    <li>• Proposer le biberon toutes les 2-3h, même la nuit</li>
                    <li>• Faire un rot après chaque biberon</li>
                    <li>• Surveiller les signes de faim : pleurs, suçotement</li>
                    <li>• Température du lait : 37°C (tiède sur le poignet)</li>
                </ul>
            </div>
        `;
    } else if (age <= 30) {
        tips = `
            <div class="bg-white/80 glass rounded-2xl p-4 shadow-sm border border-white/50 mb-4">
                <h4 class="text-sm font-semibold text-gray-800 mb-3">👶 Premier mois (${age} jours)</h4>
                <ul class="text-sm text-gray-700 space-y-2">
                    <li>• Le rythme commence à se stabiliser</li>
                    <li>• Possibles coliques du nourrisson (massages du ventre)</li>
                    <li>• Surveiller la prise de poids (pesée hebdomadaire)</li>
                    <li>• Maintenir l'hygiène stricte des biberons</li>
                </ul>
            </div>
        `;
    }

    tipsContainer.innerHTML = tips;
}



// === MISE À JOUR DE L'AFFICHAGE ===
function updateDisplay() {
    const age = calculateAge();
    elements.babyAge.textContent = age;
    elements.settingsAge.textContent = age;

    updateFeedingGuide(age);

    const activeTab = document.querySelector('.tab-button.active');
    if (activeTab) {
        const tabType = activeTab.id.replace('tab-', '');
        const filteredEntries = getFilteredEntries(tabType);
        updateStatistics(tabType, filteredEntries);
    }

    elements.totalEntries.textContent = entries.length;
    elements.firstEntry.textContent = entries.length > 0 ? formatDate(entries[entries.length - 1].timestamp) : 'Aucune';
    elements.lastEntry.textContent = entries.length > 0 ? formatDate(entries[0].timestamp) : 'Aucune';

    updateDailyChart();
    updateHistory();
}

async function resetData() {
    if (confirm('⚠️ Êtes-vous sûr de vouloir effacer toutes les données ? Cette action est irréversible.')) {
        await deleteAllEntriesFirebase();
        localStorage.removeItem('babyTrackerEntries');
        entries = [];
        updateDisplay();
    }
}

// === FONCTIONS GLOBALES ===
window.editEntry = editEntry;
window.confirmDeleteEntry = confirmDeleteEntry;
window.showMedicationForm = showMedicationForm;
window.hideMedicationForm = hideMedicationForm;
window.saveMedication = saveMedication;
window.giveMedication = giveMedication;
window.deleteMedication = deleteMedication;
window.showAppointmentForm = showAppointmentForm;
window.hideAppointmentForm = hideAppointmentForm;
window.saveAppointment = saveAppointment;
window.deleteAppointment = deleteAppointment;
window.setMilkPowderDate = setMilkPowderDate;
window.setWaterBottleDateTime = setWaterBottleDateTime;
window.addCareEntry = function() { alert('Fonction en développement'); };
window.addFoodEntry = function() { alert('Fonction en développement'); };

// === INITIALISATION ===
document.addEventListener('DOMContentLoaded', function () {
    loadEntriesLocal();

    updateDisplay();
    initializeDailyChart();

    const age = calculateAge();
    updateFeedingGuide(age);

    setTimeout(() => {
        initializeFirebase();
    }, 1000);

    // Event listeners pour les onglets principaux
    document.getElementById('tab-daily').addEventListener('click', () => switchTab('tab-daily'));
    document.getElementById('tab-weekly').addEventListener('click', () => switchTab('tab-weekly'));
    document.getElementById('tab-monthly').addEventListener('click', () => switchTab('tab-monthly'));

    // Event listeners pour les nouveaux onglets
    document.getElementById('tab-supplies').addEventListener('click', () => switchToSection('supplies-section'));
    document.getElementById('tab-care').addEventListener('click', () => switchToSection('care-section'));
    document.getElementById('tab-medical').addEventListener('click', () => switchToSection('medical-section'));
    document.getElementById('tab-food').addEventListener('click', () => switchToSection('food-section'));
    document.getElementById('tab-tips').addEventListener('click', () => {
        switchToSection('tips-section');
        updateTipsContent();
    });

    // Event listeners pour les boutons principaux
    document.getElementById('feeding-btn').addEventListener('click', () => showForm('feeding'));
    document.getElementById('diaper-btn').addEventListener('click', () => showForm('diaper'));
    document.getElementById('settings-btn').addEventListener('click', showSettings);

    // Event listeners pour les formulaires
    document.getElementById('close-form').addEventListener('click', hideForm);
    document.getElementById('save-btn').addEventListener('click', addEntry);

    // Event listeners pour l'heure et la date
    document.getElementById('now-btn').addEventListener('click', function () {
        elements.timeInput.value = getCurrentTimeString();
    });

    document.getElementById('today-btn').addEventListener('click', function () {
        elements.dateInput.value = getCurrentDateString();
    });

    // Event listeners pour pipi
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

    // Event listeners pour caca
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

    // Event listeners pour les détails du caca
    document.getElementById('poop-quantity').addEventListener('change', function () {
        currentEntry.poopQuantity = this.value;
    });

    document.getElementById('poop-consistency').addEventListener('change', function () {
        currentEntry.poopConsistency = this.value;
    });

    document.getElementById('poop-color').addEventListener('change', function () {
        currentEntry.poopColor = this.value;
    });

    // Event listeners pour les paramètres
    document.getElementById('close-settings').addEventListener('click', hideSettings);
    document.getElementById('reset-btn').addEventListener('click', resetData);

    // Event listener pour validation du formulaire
    elements.amountInput.addEventListener('input', function () {
        const saveBtn = document.getElementById('save-btn');
        if (currentEntry.type === 'feeding' && !this.value) {
            saveBtn.disabled = true;
        } else {
            saveBtn.disabled = false;
        }
    });
     const nowBtn = document.getElementById('now-btn');
    if (nowBtn) {
        nowBtn.addEventListener('click', function () {
            elements.timeInput.value = getCurrentTimeString();
        });
    }

    // CORRECTION: Event listener pour le bouton "Aujourd'hui" 
    const todayBtn = document.getElementById('today-btn');
    if (todayBtn) {
        todayBtn.addEventListener('click', function () {
            elements.dateInput.value = getCurrentDateString();
        });
    }

    // CORRECTION: Initialiser les champs de date/heure au chargement
    if (elements.timeInput) {
        elements.timeInput.value = getCurrentTimeString();
    }
    if (elements.dateInput) {
        elements.dateInput.value = getCurrentDateString();
    }

    // Mettre à jour l'affichage des médicaments toutes les minutes
    setInterval(updateMedicationDisplay, 60000);
});
// === FONCTION POUR RÉCUPÉRER LES STOCKS DEPUIS FIREBASE ===
async function loadStocksFromFirebase() {
    if (!db) {
        console.warn('Firebase non disponible pour charger les stocks');
        return;
    }

    try {
        const stocksSnapshot = await getDocs(collection(db, 'stocks'));
        
        stocksSnapshot.forEach((doc) => {
            const data = doc.data();
            
            if (data.type === 'milk-powder' && data.date) {
                const element = document.getElementById('milk-powder-date');
                if (element) element.textContent = data.date;
            }
            
            if (data.type === 'water-bottle' && data.datetime) {
                const element = document.getElementById('water-bottle-datetime');
                if (element) element.textContent = data.datetime;
            }
        });
        
        console.log('Stocks chargés depuis Firebase');
        
    } catch (error) {
        console.error('Erreur chargement stocks Firebase:', error);
    }
}

// === SUPPRIMER STOCK ===
async function clearMilkPowderDate() {
    if (!confirm('Supprimer la date d\'ouverture du lait en poudre ?')) return;
    
    if (!db) {
        alert('Firebase non disponible');
        return;
    }

    try {
        const existingQuery = query(collection(db, 'stocks'), where('type', '==', 'milk-powder'));
        const querySnapshot = await getDocs(existingQuery);
        
        querySnapshot.forEach(async (document) => {
            await deleteDoc(doc(db, 'stocks', document.id));
        });

        console.log('Date lait en poudre supprimée de Firebase');
        
    } catch (error) {
        console.error('Erreur suppression date lait Firebase:', error);
        alert('Erreur lors de la suppression');
    }
}

async function clearWaterBottleDateTime() {
    if (!confirm('Supprimer la date/heure d\'ouverture de la bouteille d\'eau ?')) return;
    
    if (!db) {
        alert('Firebase non disponible');
        return;
    }

    try {
        const existingQuery = query(collection(db, 'stocks'), where('type', '==', 'water-bottle'));
        const querySnapshot = await getDocs(existingQuery);
        
        querySnapshot.forEach(async (document) => {
            await deleteDoc(doc(db, 'stocks', document.id));
        });

        console.log('Date/heure bouteille d\'eau supprimée de Firebase');
        
    } catch (error) {
        console.error('Erreur suppression datetime eau Firebase:', error);
        alert('Erreur lors de la suppression');
    }
}

// === EXPOSER LES NOUVELLES FONCTIONS ===
window.setMilkPowderDate = setMilkPowderDate;
window.setWaterBottleDateTime = setWaterBottleDateTime;
window.clearMilkPowderDate = clearMilkPowderDate;
window.clearWaterBottleDateTime = clearWaterBottleDateTime;