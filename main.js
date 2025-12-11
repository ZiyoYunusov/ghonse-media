// main.js - ПОЛНАЯ РАБОЧАЯ ВЕРСИЯ

let currentUser = null;
let isUserAdmin = false;

// API ключ для фильмов
const TMDB_API_KEY = '8265bd1679663a7ea12ac168da84d2e8';

document.addEventListener('DOMContentLoaded', function() {
    console.log("Страница загружена");
    checkAuthState();
    setupEventListeners();
});

function checkAuthState() {
    firebase.auth().onAuthStateChanged(async function(user) {
        if (user) {
            currentUser = user;
            const userData = await FirebaseAuthService.getUserData(user.uid);
            
            if (userData.success) {
                showMainApp(userData.data);
                isUserAdmin = await FirebaseAuthService.isUserAdmin(user.uid);
                
                if (isUserAdmin) {
                    document.getElementById('admin-link').style.display = 'flex';
                }
                
                loadMovies();
            }
        } else {
            showAuthScreen();
            currentUser = null;
            isUserAdmin = false;
        }
    });
}

function setupEventListeners() {
    document.getElementById('login-password')?.addEventListener('keypress', function(e) {
        if (e.key === 'Enter') login();
    });
    
    document.getElementById('reg-confirm-password')?.addEventListener('keypress', function(e) {
        if (e.key === 'Enter') register();
    });
    
    document.getElementById('ai-input')?.addEventListener('keypress', function(e) {
        if (e.key === 'Enter') sendAIMessage();
    });
}

function switchTab(tab) {
    const loginForm = document.getElementById('login-form');
    const registerForm = document.getElementById('register-form');
    const tabs = document.querySelectorAll('.tab-btn');
    
    if (tab === 'login') {
        loginForm.style.display = 'block';
        registerForm.style.display = 'none';
        tabs[0].classList.add('active');
        tabs[1].classList.remove('active');
    } else {
        loginForm.style.display = 'none';
        registerForm.style.display = 'block';
        tabs[0].classList.remove('active');
        tabs[1].classList.add('active');
    }
    clearMessage();
}

async function login() {
    const email = document.getElementById('login-email').value.trim();
    const password = document.getElementById('login-password').value;
    
    if (!email || !password) {
        showMessage('Заполните все поля', 'error');
        return;
    }
    
    showMessage('Выполняется вход...', 'info');
    const result = await FirebaseAuthService.loginUser(email, password);
    
    if (result.success) {
        showMessage('Вход успешен!', 'success');
    } else {
        showMessage(result.error, 'error');
    }
}

async function register() {
    const userData = {
        firstName: document.getElementById('reg-firstname').value.trim(),
        lastName: document.getElementById('reg-lastname').value.trim(),
        age: document.getElementById('reg-age').value,
        username: document.getElementById('reg-username').value.trim(),
        email: document.getElementById('reg-email').value.trim(),
        password: document.getElementById('reg-password').value,
        confirmPassword: document.getElementById('reg-confirm-password').value
    };
    
    if (!userData.firstName || !userData.lastName || !userData.age || 
        !userData.username || !userData.email || !userData.password) {
        showMessage('Заполните все поля', 'error');
        return;
    }
    
    showMessage('Регистрация...', 'info');
    const result = await FirebaseAuthService.registerUser(userData);
    
    if (result.success) {
        showMessage('Регистрация успешна!', 'success');
    } else {
        showMessage(result.error, 'error');
    }
}

function showMainApp(userData) {
    document.getElementById('auth-screen').style.display = 'none';
    document.getElementById('main-app').style.display = 'block';
    
    document.getElementById('user-greeting').textContent = `Привет, ${userData.firstName}!`;
    document.getElementById('profile-name').textContent = `${userData.firstName} ${userData.lastName}`;
    document.getElementById('profile-username').textContent = userData.username;
    document.getElementById('profile-email').textContent = userData.email;
    document.getElementById('profile-age').textContent = userData.age;
    document.getElementById('profile-role').textContent = userData.role === 'admin' ? 'Администратор' : 'Пользователь';
    
    showSection('movies');
}

function showAuthScreen() {
    document.getElementById('auth-screen').style.display = 'flex';
    document.getElementById('main-app').style.display = 'none';
    switchTab('login');
}

function showSection(section) {
    document.querySelectorAll('.content-section').forEach(s => {
        s.style.display = 'none';
    });
    
    document.querySelectorAll('.nav-link').forEach(link => {
        link.classList.remove('active');
    });
    
    const sectionElement = document.getElementById(`${section}-section`);
    if (sectionElement) {
        sectionElement.style.display = 'block';
    }
    
    if (section === 'movies') loadMovies();
    if (section === 'series') loadSeries();
}

async function logout() {
    const result = await FirebaseAuthService.logout();
    if (result.success) {
        showNotification('Вы вышли из системы', 'success');
        showAuthScreen();
    }
}

function showAdminPanel() {
    if (isUserAdmin) {
        window.open('admin.html', '_blank');
    } else {
        alert('У вас нет прав администратора');
    }
}

function showMessage(text, type) {
    const messageDiv = document.getElementById('auth-message');
    if (messageDiv) {
        messageDiv.textContent = text;
        messageDiv.className = `message ${type}`;
        setTimeout(() => {
            messageDiv.textContent = '';
            messageDiv.className = 'message';
        }, 5000);
    }
}

function clearMessage() {
    const messageDiv = document.getElementById('auth-message');
    if (messageDiv) {
        messageDiv.textContent = '';
        messageDiv.className = 'message';
    }
}

function showNotification(text, type) {
    const notification = document.createElement('div');
    notification.className = `notification ${type}`;
    notification.textContent = text;
    notification.style.cssText = `
        position: fixed; top: 20px; right: 20px; padding: 15px 25px;
        border-radius: 10px; color: white; z-index: 10000; font-weight: 500;
        background: ${type === 'success' ? '#2ecc71' : type === 'error' ? '#e74c3c' : '#3498db'};
    `;
    document.body.appendChild(notification);
    setTimeout(() => notification.remove(), 3000);
}

// === ФИЛЬМЫ И СЕРИАЛЫ (TMDB API) ===

async function loadMovies() {
    const container = document.getElementById('movies-container');
    container.innerHTML = '<div class="loading">Загрузка фильмов...</div>';
    
    try {
        const response = await fetch(`https://api.themoviedb.org/3/movie/popular?api_key=${TMDB_API_KEY}&language=ru-RU&page=1`);
        const data = await response.json();
        
        container.innerHTML = '';
        data.results.slice(0, 12).forEach(movie => {
            const movieCard = document.createElement('div');
            movieCard.className = 'movie-card';
            movieCard.innerHTML = `
                <div class="movie-poster">
                    <img src="https://image.tmdb.org/t/p/w500${movie.poster_path}" 
                         alt="${movie.title}" 
                         onerror="this.src='data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 width=%22500%22 height=%22750%22><rect fill=%22%233498db%22 width=%22500%22 height=%22750%22/><text x=%2250%25%22 y=%2250%25%22 text-anchor=%22middle%22 fill=%22white%22 font-size=%2248%22>🎬</text></svg>'">
                </div>
                <div class="movie-info">
                    <h4>${movie.title}</h4>
                    <p>Год: ${movie.release_date ? movie.release_date.split('-')[0] : 'N/A'} | ⭐ ${movie.vote_average.toFixed(1)}</p>
                    <button onclick="showMovieDetails(${movie.id})" class="btn-primary">
                        <i class="fas fa-info-circle"></i> Подробнее
                    </button>
                </div>
            `;
            container.appendChild(movieCard);
        });
    } catch (error) {
        console.error('Ошибка загрузки фильмов:', error);
        container.innerHTML = '<div class="loading">Ошибка загрузки фильмов</div>';
    }
}

async function loadSeries() {
    const container = document.getElementById('series-container');
    container.innerHTML = '<div class="loading">Загрузка сериалов...</div>';
    
    try {
        const response = await fetch(`https://api.themoviedb.org/3/tv/popular?api_key=${TMDB_API_KEY}&language=ru-RU&page=1`);
        const data = await response.json();
        
        container.innerHTML = '';
        data.results.slice(0, 12).forEach(series => {
            const seriesCard = document.createElement('div');
            seriesCard.className = 'series-card';
            seriesCard.innerHTML = `
                <div class="series-poster">
                    <img src="https://image.tmdb.org/t/p/w500${series.poster_path}" 
                         alt="${series.name}"
                         onerror="this.src='data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 width=%22500%22 height=%22750%22><rect fill=%22%239b59b6%22 width=%22500%22 height=%22750%22/><text x=%2250%25%22 y=%2250%25%22 text-anchor=%22middle%22 fill=%22white%22 font-size=%2248%22>📺</text></svg>'">
                </div>
                <div class="series-info">
                    <h4>${series.name}</h4>
                    <p>Год: ${series.first_air_date ? series.first_air_date.split('-')[0] : 'N/A'} | ⭐ ${series.vote_average.toFixed(1)}</p>
                    <button onclick="showSeriesDetails(${series.id})" class="btn-primary">
                        <i class="fas fa-info-circle"></i> Подробнее
                    </button>
                </div>
            `;
            container.appendChild(seriesCard);
        });
    } catch (error) {
        console.error('Ошибка загрузки сериалов:', error);
        container.innerHTML = '<div class="loading">Ошибка загрузки сериалов</div>';
    }
}

async function showMovieDetails(movieId) {
    try {
        const response = await fetch(`https://api.themoviedb.org/3/movie/${movieId}?api_key=${TMDB_API_KEY}&language=ru-RU`);
        const movie = await response.json();
        
        alert(`🎬 ${movie.title}\n\n${movie.overview}\n\nЖанры: ${movie.genres.map(g => g.name).join(', ')}\nДлительность: ${movie.runtime} мин\nБюджет: $${movie.budget.toLocaleString()}`);
    } catch (error) {
        console.error('Ошибка:', error);
    }
}

async function showSeriesDetails(seriesId) {
    try {
        const response = await fetch(`https://api.themoviedb.org/3/tv/${seriesId}?api_key=${TMDB_API_KEY}&language=ru-RU`);
        const series = await response.json();
        
        alert(`📺 ${series.name}\n\n${series.overview}\n\nЖанры: ${series.genres.map(g => g.name).join(', ')}\nСезонов: ${series.number_of_seasons}\nЭпизодов: ${series.number_of_episodes}`);
    } catch (error) {
        console.error('Ошибка:', error);
    }
}

// === ИИ АССИСТЕНТ ===

function sendAIMessage() {
    const input = document.getElementById('ai-input');
    const message = input.value.trim();
    
    if (!message) return;
    
    const chatMessages = document.getElementById('chat-messages');
    
    const userMsg = document.createElement('div');
    userMsg.className = 'message user-message';
    userMsg.textContent = message;
    userMsg.style.cssText = 'background: #3498db; color: white; padding: 12px 18px; border-radius: 18px; margin: 8px 0; max-width: 70%; margin-left: auto; text-align: right;';
    chatMessages.appendChild(userMsg);
    
    input.value = '';
    
    const typingMsg = document.createElement('div');
    typingMsg.className = 'message ai-message typing';
    typingMsg.textContent = '💭 Думаю...';
    typingMsg.style.cssText = 'background: #ecf0f1; color: #7f8c8d; padding: 12px 18px; border-radius: 18px; margin: 8px 0; max-width: 70%;';
    chatMessages.appendChild(typingMsg);
    chatMessages.scrollTop = chatMessages.scrollHeight;
    
    setTimeout(() => {
        chatMessages.removeChild(typingMsg);
        
        const response = getAIResponse(message);
        const aiMsg = document.createElement('div');
        aiMsg.className = 'message ai-message';
        aiMsg.innerHTML = response;
        aiMsg.style.cssText = 'background: #ecf0f1; color: #2c3e50; padding: 12px 18px; border-radius: 18px; margin: 8px 0; max-width: 70%; line-height: 1.6;';
        chatMessages.appendChild(aiMsg);
        chatMessages.scrollTop = chatMessages.scrollHeight;
    }, 800);
}

function getAIResponse(message) {
    const lower = message.toLowerCase();
    
    // Математика - вычисления
    if (lower.match(/сколько будет|реши|вычисли|посчитай/)) {
        const mathMatch = message.match(/(\d+)\s*([+\-*/×÷])\s*(\d+)/);
        if (mathMatch) {
            const [, a, op, b] = mathMatch;
            const num1 = parseFloat(a);
            const num2 = parseFloat(b);
            let result;
            let operation = op;
            
            switch(op) {
                case '+': result = num1 + num2; break;
                case '-': result = num1 - num2; break;
                case '*':
                case '×': result = num1 * num2; operation = '×'; break;
                case '/':
                case '÷': result = num2 !== 0 ? (num1 / num2).toFixed(2) : 'Ошибка: деление на ноль'; operation = '÷'; break;
            }
            
            return `🧮 <strong>${num1} ${operation} ${num2} = ${result}</strong>`;
        }
    }
    
    // Математические константы
    if (lower.includes('пи') || lower.includes('число пи')) {
        return '🔢 Число <strong>Пи (π) ≈ 3.14159</strong><br>Это отношение длины окружности к её диаметру. Используется в формулах площади круга и длины окружности.';
    }
    
    // Площадь прямоугольника
    if (lower.includes('площадь') && lower.includes('прямоугольник')) {
        return '📐 <strong>Площадь прямоугольника</strong> = длина × ширина<br><br>Пример: если длина 5 см, ширина 3 см<br>Площадь = 5 × 3 = <strong>15 см²</strong>';
    }
    
    // Периметр прямоугольника
    if (lower.includes('периметр') && lower.includes('прямоугольник')) {
        return '📏 <strong>Периметр прямоугольника</strong> = 2 × (длина + ширина)<br><br>Пример: длина 5 см, ширина 3 см<br>Периметр = 2 × (5 + 3) = <strong>16 см</strong>';
    }
    
    // Площадь круга
    if (lower.includes('площадь') && (lower.includes('круг') || lower.includes('окружност'))) {
        return '⭕ <strong>Площадь круга</strong> = π × радиус²<br><br>Пример: радиус 5 см<br>Площадь = 3.14 × 25 = <strong>78.5 см²</strong>';
    }
    
    // Дроби
    if (lower.includes('дроб')) {
        return '🔢 <strong>Дроби</strong> — это части целого:<br>• ½ = 0.5 (одна вторая)<br>• ¼ = 0.25 (одна четвертая)<br>• ¾ = 0.75 (три четвертых)<br>• ⅓ = 0.33 (одна третья)';
    }
    
    // Уравнения
    if (lower.includes('уравнение') || lower.includes('реши x')) {
        return '✏️ <strong>Решение уравнений:</strong><br>Нужно найти неизвестное число.<br><br>Пример: x + 5 = 10<br>x = 10 - 5<br>x = <strong>5</strong>';
    }
    
    // Таблица умножения
    if (lower.includes('таблица умножения')) {
        return '📊 <strong>Таблица умножения</strong> - это основа математики!<br>Например:<br>5 × 6 = 30<br>7 × 8 = 56<br>9 × 9 = 81<br><br>Попробуй решить примеры в разделе "Развлечение"!';
    }
    
    // Фильмы
    if (lower.includes('фильм') || lower.includes('кино') || lower.includes('посоветуй посмотреть')) {
        const films = [
            "🎬 <strong>'Интерстеллар'</strong> - захватывающая научная фантастика о космосе и времени",
            "🎥 <strong>'Начало'</strong> - умопомрачительный фильм о снах и реальности",
            "🍿 <strong>'Побег из Шоушенка'</strong> - одна из лучших драм всех времен",
            "📽️ <strong>'Зеленая книга'</strong> - трогательная история о дружбе",
            "🎭 <strong>'1+1'</strong> - французская комедия, которая растрогает до слез",
            "🚀 <strong>'Марсианин'</strong> - выживание на Марсе",
            "🦇 <strong>'Темный рыцарь'</strong> - лучший фильм про Бэтмена"
        ];
        return films[Math.floor(Math.random() * films.length)];
    }
    
    // Сериалы
    if (lower.includes('сериал')) {
        const series = [
            "📺 <strong>'Игра престолов'</strong> - эпическое фэнтези о борьбе за трон",
            "🔮 <strong>'Очень странные дела'</strong> - мистика и приключения в 80-х",
            "⚗️ <strong>'Во все тяжкие'</strong> - история учителя химии",
            "👑 <strong>'Корона'</strong> - история британской монархии"
        ];
        return series[Math.floor(Math.random() * series.length)];
    }
    
    // Помощь с играми
    if (lower.includes('игр') || lower.includes('развлечение')) {
        return `🎮 <strong>На сайте есть 6 игр:</strong><br><br>• <strong>Морской бой</strong><br>• <strong>Угадай слово</strong><br>• <strong>Крестики-нолики</strong><br>• <strong>Продолжи фразу</strong><br>• <strong>Найди столицу</strong><br>• <strong>Математика</strong> (1-6 класс)<br><br>Перейди в раздел "Развлечение"!`;
    }
    
    // Помощь с математикой
    if (lower.includes('помощь') && lower.includes('математик')) {
        return `🧮 <strong>Могу помочь с математикой!</strong><br><br>• Сложение (+): 5 + 3 = 8<br>• Вычитание (-): 10 - 4 = 6<br>• Умножение (×): 6 × 7 = 42<br>• Деление (÷): 20 ÷ 4 = 5<br><br>Напиши "реши 25 + 17" или "сколько будет 8 × 9"`;
    }
    
    // Приветствие
    if (lower.includes('привет') || lower.includes('здравствуй') || lower.includes('hi')) {
        return '👋 <strong>Привет!</strong> Я твой ИИ-помощник!<br>Могу помочь с:<br>• Выбором фильмов 🎬<br>• Решением математики 🧮<br>• Объяснением формул 📐<br>• Играми 🎮';
    }
    
    if (lower.includes('спасибо')) {
        return '😊 Пожалуйста! Рад помочь! Обращайся если что!';
    }
    
    // Общие ответы
    const responses = [
        "Интересный вопрос! Могу помочь с <strong>математикой</strong> или посоветовать <strong>фильм</strong>? 🎬",
        "Хороший вопрос! Попробуй спросить про <strong>математику</strong>, <strong>фильмы</strong> или <strong>игры</strong>! 🧮",
        "Я здесь, чтобы помочь! Спроси меня про:<br>• Математику<br>• Фильмы<br>• Игры 💡",
        "Могу решить <strong>математику</strong>, посоветовать <strong>фильм</strong> или помочь с <strong>играми</strong>! 🎯"
    ];
    
    return responses[Math.floor(Math.random() * responses.length)];
}

function suggestMovies() {
    document.getElementById('ai-input').value = "Посоветуй интересный фильм";
    sendAIMessage();
}

function solveMath() {
    document.getElementById('ai-input').value = "Реши 144 / 12";
    sendAIMessage();
}

function helpNavigation() {
    document.getElementById('ai-input').value = "Помощь с играми";
    sendAIMessage();
}

// === ИГРЫ ===

let gameState = {
    ticTacToe: { board: ['','','','','','','','',''], player: 'X', active: true },
    wordGuess: { word: '', guessed: [], attempts: 6 },
    mathQuiz: { score: 0, current: null },
    capitalGame: { score: 0 }
};

function startGame(gameType) {
    const container = document.getElementById('game-container');
    
    switch(gameType) {
        case 'tictactoe':
            container.innerHTML = createTicTacToe();
            resetTicTacToe();
            break;
        case 'wordguess':
            container.innerHTML = createWordGuess();
            initWordGuess();
            break;
        case 'capital':
            container.innerHTML = createCapitalGame();
            loadCapitalQuestion();
            break;
        case 'math':
            container.innerHTML = createMathGame();
            loadMathQuestion();
            break;
        case 'phrase':
            container.innerHTML = createPhraseGame();
            loadPhraseQuestion();
            break;
        default:
            container.innerHTML = '<div class="game-notice" style="background: white; padding: 40px; border-radius: 20px; text-align: center; margin-top: 30px;">🎮 Игра в разработке!</div>';
    }
}

// === КРЕСТИКИ-НОЛИКИ ===

function createTicTacToe() {
    return `
        <div class="game-area">
            <h3>❌⭕ Крестики-Нолики</h3>
            <div class="game-info" style="text-align: center; margin: 20px 0;">
                <div style="font-size: 18px; margin-bottom: 10px;">Сейчас ходит: <strong id="current-player" style="color: #e74c3c;">X</strong></div>
                <div id="game-status" style="color: #3498db; font-weight: 500;">Игра началась!</div>
            </div>
            <div class="tic-tac-toe-board" style="display: grid; grid-template-columns: repeat(3, 100px); gap: 10px; margin: 30px auto; width: fit-content;">
                ${[0,1,2,3,4,5,6,7,8].map(i => `<div class="cell" onclick="makeMove(${i})" style="width: 100px; height: 100px; background: #f8f9fa; border-radius: 15px; display: flex; align-items: center; justify-content: center; font-size: 48px; cursor: pointer; border: 2px solid transparent; transition: all 0.3;"></div>`).join('')}
            </div>
            <button onclick="resetTicTacToe()" class="btn-primary" style="display: block; margin: 20px auto;">🔄 Новая игра</button>
        </div>
    `;
}

function makeMove(index) {
    const state = gameState.ticTacToe;
    if (!state.active || state.board[index] !== '') return;
    
    state.board[index] = state.player;
    const cells = document.querySelectorAll('.cell');
    cells[index].textContent = state.player;
    cells[index].style.color = state.player === 'X' ? '#e74c3c' : '#2ecc71';
    
    if (checkWinner()) {
        document.getElementById('game-status').textContent = `🎉 Игрок ${state.player} победил!`;
        state.active = false;
        return;
    }
    
    if (!state.board.includes('')) {
        document.getElementById('game-status').textContent = '🤝 Ничья!';
        state.active = false;
        return;
    }
    
    state.player = state.player === 'X' ? 'O' : 'X';
    document.getElementById('current-player').textContent = state.player;
    document.getElementById('current-player').style.color = state.player === 'X' ? '#e74c3c' : '#2ecc71';
}

function checkWinner() {
    const b = gameState.ticTacToe.board;
    const wins = [[0,1,2],[3,4,5],[6,7,8],[0,3,6],[1,4,7],[2,5,8],[0,4,8],[2,4,6]];
    return wins.some(([a,b1,c]) => b[a] && b[a] === b[b1] && b[a] === b[c]);
}

function resetTicTacToe() {
    gameState.ticTacToe = { board: ['','','','','','','','',''], player: 'X', active: true };
    document.querySelectorAll('.cell').forEach(cell => {
        cell.textContent = '';
        cell.style.color = '';
    });
    document.getElementById('current-player').textContent = 'X';
    document.getElementById('current-player').style.color = '#e74c3c';
    document.getElementById('game-status').textContent = 'Игра началась!';
}

// === УГАДАЙ СЛОВО ===

function createWordGuess() {
    return `
        <div class="game-area">
            <h3>🔤 Угадай слово</h3>
            <div style="text-align: center; margin: 30px 0;">
                <div id="word-display" style="font-size: 32px; letter-spacing: 15px; margin: 30px 0; font-weight: bold; color: #2c3e50;"></div>
                <div style="margin: 25px 0;">
                    <input type="text" id="letter-input" maxlength="1" placeholder="Буква" 
                           style="padding: 15px; font-size: 24px; text-align: center; width: 80px; border: 2px solid #3498db; border-radius: 12px; text-transform: uppercase;">
                    <button onclick="guessLetter()" class="btn-primary" style="margin-left: 15                    <button onclick="guessLetter()" class="btn-primary" style="margin-left: 15px; padding: 15px 25px;">Угадать</button>
                </div>
                <div style="margin: 20px 0;">
                    <div style="color: #666; margin: 10px 0;">Осталось попыток: <span id="attempts" style="color: #e74c3c; font-weight: bold;">6</span></div>
                    <div style="color: #666; margin: 10px 0;">Использованные буквы: <span id="used-letters" style="color: #3498db; font-weight: bold;"></span></div>
                    <div id="word-hint" style="color: #666; font-size: 14px; margin-top: 20px;"></div>
                </div>
            </div>
            <div id="word-result" style="text-align: center; margin-top: 20px;"></div>
        </div>
    `;
}

function initWordGuess() {
    const words = [
        { word: "КОМПЬЮТЕР", hint: "Электронное устройство для работы с информацией" },
        { word: "ПРОГРАММИРОВАНИЕ", hint: "Процесс создания компьютерных программ" },
        { word: "ИНТЕРНЕТ", hint: "Всемирная сеть компьютеров" },
        { word: "ТЕХНОЛОГИЯ", hint: "Научные знания, применяемые на практике" },
        { word: "АЛГОРИТМ", hint: "Последовательность действий для решения задачи" },
        { word: "БАЗА ДАННЫХ", hint: "Структурированный набор информации" },
        { word: "МАТЕМАТИКА", hint: "Наука о числах и фигурах" },
        { word: "ФИЗИКА", hint: "Наука о природе и её законах" },
        { word: "ХИМИЯ", hint: "Наука о веществах и их превращениях" },
        { word: "БИОЛОГИЯ", hint: "Наука о живых организмах" }
    ];
    
    const randomWord = words[Math.floor(Math.random() * words.length)];
    gameState.wordGuess = {
        word: randomWord.word,
        guessed: [],
        attempts: 6,
        hint: randomWord.hint
    };
    
    updateWordDisplay();
    document.getElementById('word-hint').textContent = `Подсказка: ${gameState.wordGuess.hint}`;
    document.getElementById('attempts').textContent = gameState.wordGuess.attempts;
    document.getElementById('used-letters').textContent = '';
    document.getElementById('word-result').innerHTML = '';
}

function updateWordDisplay() {
    const display = document.getElementById('word-display');
    if (!display) return;
    
    const word = gameState.wordGuess.word;
    const guessed = gameState.wordGuess.guessed;
    
    const displayWord = word.split('').map(letter => 
        guessed.includes(letter.toUpperCase()) ? letter : '_'
    ).join(' ');
    
    display.textContent = displayWord;
}

function guessLetter() {
    const input = document.getElementById('letter-input');
    const letter = input.value.toUpperCase().trim();
    
    if (!letter || !/^[А-ЯЁ]$/.test(letter)) {
        alert('Введите одну русскую букву!');
        return;
    }
    
    const state = gameState.wordGuess;
    
    if (state.guessed.includes(letter)) {
        alert('Вы уже пробовали эту букву!');
        input.value = '';
        return;
    }
    
    state.guessed.push(letter);
    document.getElementById('used-letters').textContent = state.guessed.join(', ');
    
    if (!state.word.includes(letter)) {
        state.attempts--;
        document.getElementById('attempts').textContent = state.attempts;
        document.getElementById('attempts').style.color = state.attempts <= 2 ? '#e74c3c' : '#f39c12';
        
        if (state.attempts === 0) {
            document.getElementById('word-result').innerHTML = `
                <div style="color: #e74c3c; font-size: 18px; margin: 20px 0;">
                    ❌ Вы проиграли! Слово было: <strong>${state.word}</strong>
                </div>
                <button onclick="initWordGuess()" class="btn-primary" style="margin-top: 10px;">
                    🔄 Новая игра
                </button>
            `;
            input.disabled = true;
        }
    }
    
    updateWordDisplay();
    
    // Проверка победы
    const currentDisplay = document.getElementById('word-display').textContent;
    if (!currentDisplay.includes('_')) {
        document.getElementById('word-result').innerHTML = `
            <div style="color: #2ecc71; font-size: 18px; margin: 20px 0;">
                🎉 Поздравляем! Вы угадали слово: <strong>${state.word}</strong>
            </div>
            <button onclick="initWordGuess()" class="btn-primary" style="margin-top: 10px;">
                🔄 Новая игра
            </button>
        `;
        input.disabled = true;
    }
    
    input.value = '';
    input.focus();
}

// === НАЙДИ СТОЛИЦУ ===

function createCapitalGame() {
    return `
        <div class="game-area">
            <h3>🌍 Найди столицу</h3>
            <div id="capital-game" style="text-align: center; margin: 30px 0;">
                <div id="capital-question" style="font-size: 24px; margin: 20px 0; color: #2c3e50;"></div>
                <div id="capital-options" style="display: grid; grid-template-columns: 1fr 1fr; gap: 15px; max-width: 500px; margin: 30px auto;"></div>
                <div id="capital-result" style="margin: 20px 0; min-height: 50px;"></div>
                <div style="color: #666; margin-top: 20px;">
                    Счет: <span id="capital-score" style="color: #2ecc71; font-weight: bold;">0</span>
                </div>
            </div>
        </div>
    `;
}

const countriesData = [
    { country: 'Россия', capital: 'Москва', continent: 'Европа/Азия' },
    { country: 'Франция', capital: 'Париж', continent: 'Европа' },
    { country: 'Германия', capital: 'Берлин', continent: 'Европа' },
    { country: 'Италия', capital: 'Рим', continent: 'Европа' },
    { country: 'Испания', capital: 'Мадрид', continent: 'Европа' },
    { country: 'Великобритания', capital: 'Лондон', continent: 'Европа' },
    { country: 'Япония', capital: 'Токио', continent: 'Азия' },
    { country: 'Китай', capital: 'Пекин', continent: 'Азия' },
    { country: 'Индия', capital: 'Нью-Дели', continent: 'Азия' },
    { country: 'США', capital: 'Вашингтон', continent: 'Америка' },
    { country: 'Канада', capital: 'Оттава', continent: 'Америка' },
    { country: 'Бразилия', capital: 'Бразилиа', continent: 'Америка' },
    { country: 'Австралия', capital: 'Канберра', continent: 'Австралия' },
    { country: 'Египет', capital: 'Каир', continent: 'Африка' },
    { country: 'ЮАР', capital: 'Претория', continent: 'Африка' }
];

function loadCapitalQuestion() {
    const randomCountry = countriesData[Math.floor(Math.random() * countriesData.length)];
    const allCapitals = countriesData.map(c => c.capital);
    
    // Создаем варианты ответов
    const options = [randomCountry.capital];
    while (options.length < 4) {
        const randomCapital = allCapitals[Math.floor(Math.random() * allCapitals.length)];
        if (!options.includes(randomCapital)) {
            options.push(randomCapital);
        }
    }
    
    // Перемешиваем варианты
    options.sort(() => Math.random() - 0.5);
    
    // Сохраняем правильный ответ
    gameState.capitalGame.current = randomCountry;
    
    // Обновляем интерфейс
    document.getElementById('capital-question').innerHTML = `
        <strong>${randomCountry.country}</strong> (${randomCountry.continent})<br>
        <small style="color: #666; font-size: 16px;">Найди столицу этой страны</small>
    `;
    
    const optionsDiv = document.getElementById('capital-options');
    optionsDiv.innerHTML = options.map(capital => `
        <button onclick="checkCapital('${capital}')" 
                style="padding: 20px; background: #f8f9fa; border: 2px solid #3498db; 
                       border-radius: 15px; font-size: 18px; cursor: pointer; 
                       transition: all 0.3s; color: #2c3e50;">
            ${capital}
        </button>
    `).join('');
    
    document.getElementById('capital-score').textContent = gameState.capitalGame.score || 0;
    document.getElementById('capital-result').innerHTML = '';
}

function checkCapital(selected) {
    const correct = gameState.capitalGame.current.capital;
    const resultDiv = document.getElementById('capital-result');
    
    if (selected === correct) {
        gameState.capitalGame.score = (gameState.capitalGame.score || 0) + 10;
        resultDiv.innerHTML = `
            <div style="color: #2ecc71; font-size: 18px; background: #e8f8f5; padding: 15px; border-radius: 10px;">
                ✅ Правильно! +10 очков<br>
                <small>Столица ${gameState.capitalGame.current.country} - ${correct}</small>
            </div>
        `;
    } else {
        resultDiv.innerHTML = `
            <div style="color: #e74c3c; font-size: 18px; background: #fdedec; padding: 15px; border-radius: 10px;">
                ❌ Неправильно!<br>
                <small>Правильный ответ: ${correct}</small>
            </div>
        `;
    }
    
    // Обновляем счет
    document.getElementById('capital-score').textContent = gameState.capitalGame.score;
    
    // Через 1.5 секунды новая игра
    setTimeout(loadCapitalQuestion, 1500);
}

// === МАТЕМАТИЧЕСКАЯ ИГРА ===

function createMathGame() {
    return `
        <div class="game-area">
            <h3>🧮 Математика (1-6 класс)</h3>
            <div style="text-align: center; margin: 30px 0;">
                <div id="math-question" style="font-size: 36px; margin: 30px 0; color: #2c3e50;"></div>
                <div style="display: flex; flex-wrap: wrap; gap: 15px; justify-content: center; margin: 30px 0;">
                    <input type="number" id="math-answer" placeholder="Введите ответ" 
                           style="padding: 15px; font-size: 20px; width: 200px; border: 2px solid #3498db; border-radius: 12px;">
                    <button onclick="checkMathAnswer()" class="btn-primary" style="padding: 15px 30px;">Проверить</button>
                </div>
                <div id="math-result" style="min-height: 50px; margin: 20px 0;"></div>
                <div style="color: #666; margin-top: 20px;">
                    Счет: <span id="math-score" style="color: #2ecc71; font-weight: bold;">0</span>
                </div>
                <div style="margin-top: 20px;">
                    <button onclick="loadMathQuestion('easy')" class="btn-secondary" style="margin: 5px;">🧒 1-2 класс</button>
                    <button onclick="loadMathQuestion('medium')" class="btn-secondary" style="margin: 5px;">👦 3-4 класс</button>
                    <button onclick="loadMathQuestion('hard')" class="btn-secondary" style="margin: 5px;">👨 5-6 класс</button>
                </div>
            </div>
        </div>
    `;
}

function loadMathQuestion(level = 'easy') {
    let a, b, operation, correctAnswer, question;
    
    switch(level) {
        case 'easy': // 1-2 класс
            a = Math.floor(Math.random() * 10) + 1;
            b = Math.floor(Math.random() * 10) + 1;
            operation = Math.random() > 0.5 ? '+' : '-';
            correctAnswer = operation === '+' ? a + b : a - b;
            question = `${a} ${operation} ${b} = ?`;
            break;
            
        case 'medium': // 3-4 класс
            a = Math.floor(Math.random() * 100) + 1;
            b = Math.floor(Math.random() * 10) + 1;
            const operations = ['+', '-', '×'];
            operation = operations[Math.floor(Math.random() * operations.length)];
            
            if (operation === '×') {
                a = Math.floor(Math.random() * 10) + 1;
                b = Math.floor(Math.random() * 10) + 1;
                correctAnswer = a * b;
            } else {
                correctAnswer = operation === '+' ? a + b : a - b;
            }
            question = `${a} ${operation} ${b} = ?`;
            break;
            
        case 'hard': // 5-6 класс
            const opTypes = ['divide', 'percent', 'fraction'];
            const opType = opTypes[Math.floor(Math.random() * opTypes.length)];
            
            switch(opType) {
                case 'divide':
                    a = Math.floor(Math.random() * 100) + 10;
                    b = Math.floor(Math.random() * 10) + 2;
                    correctAnswer = Math.round(a / b);
                    question = `${a} ÷ ${b} = ? (округлить до целого)`;
                    break;
                    
                case 'percent':
                    a = Math.floor(Math.random() * 100) + 1;
                    b = Math.floor(Math.random() * 100) + 1;
                    correctAnswer = Math.round((a * b) / 100);
                    question = `${a}% от ${b} = ?`;
                    break;
                    
                case 'fraction':
                    const numerator = Math.floor(Math.random() * 10) + 1;
                    const denominator = Math.floor(Math.random() * 10) + 1;
                    a = Math.floor(Math.random() * 20) + 1;
                    correctAnswer = Math.round((numerator / denominator) * a);
                    question = `${numerator}/${denominator} от ${a} = ?`;
                    break;
            }
            break;
    }
    
    gameState.mathQuiz = {
        question: question,
        answer: correctAnswer,
        level: level
    };
    
    document.getElementById('math-question').textContent = question;
    document.getElementById('math-answer').value = '';
    document.getElementById('math-result').innerHTML = '';
    document.getElementById('math-answer').focus();
}

function checkMathAnswer() {
    const input = document.getElementById('math-answer');
    const userAnswer = parseFloat(input.value);
    const correctAnswer = gameState.mathQuiz.answer;
    
    if (isNaN(userAnswer)) {
        alert('Введите число!');
        return;
    }
    
    const resultDiv = document.getElementById('math-result');
    const scoreSpan = document.getElementById('math-score');
    let currentScore = parseInt(scoreSpan.textContent) || 0;
    
    if (Math.abs(userAnswer - correctAnswer) < 0.01) {
        // Добавляем очки в зависимости от сложности
        let points = 0;
        switch(gameState.mathQuiz.level) {
            case 'easy': points = 5; break;
            case 'medium': points = 10; break;
            case 'hard': points = 15; break;
        }
        
        currentScore += points;
        resultDiv.innerHTML = `
            <div style="color: #2ecc71; font-size: 18px; background: #e8f8f5; padding: 15px; border-radius: 10px;">
                ✅ Правильно! +${points} очков<br>
                <small>Ответ: ${correctAnswer}</small>
            </div>
        `;
    } else {
        resultDiv.innerHTML = `
            <div style="color: #e74c3c; font-size: 18px; background: #fdedec; padding: 15px; border-radius: 10px;">
                ❌ Неправильно!<br>
                <small>Правильный ответ: ${correctAnswer}</small>
            </div>
        `;
    }
    
    scoreSpan.textContent = currentScore;
    
    // Через 1.5 секунды новая задача
    setTimeout(() => loadMathQuestion(gameState.mathQuiz.level), 1500);
}

// === ПРОДОЛЖИ ФРАЗУ ===

function createPhraseGame() {
    return `
        <div class="game-area">
            <h3>💬 Продолжи фразу</h3>
            <div style="text-align: center; margin: 30px 0;">
                <div id="phrase-start" style="font-size: 24px; margin: 30px 0; color: #2c3e50; line-height: 1.6;"></div>
                <div style="margin: 25px 0;">
                    <input type="text" id="phrase-answer" placeholder="Продолжите фразу..." 
                           style="padding: 15px; font-size: 18px; width: 300px; border: 2px solid #9b59b6; border-radius: 12px;">
                    <button onclick="checkPhrase()" class="btn-primary" style="margin-left: 15px; padding: 15px 25px;">Проверить</button>
                </div>
                <div style="margin-top: 20px;">
                    <button onclick="showHint()" class="btn-secondary" style="margin: 5px;">🔍 Подсказка</button>
                    <button onclick="loadPhraseQuestion()" class="btn-secondary" style="margin: 5px;">⏭ Пропустить</button>
                </div>
                <div id="phrase-result" style="min-height: 50px; margin: 20px 0;"></div>
                <div style="color: #666; margin-top: 20px;">
                    Счет: <span id="phrase-score" style="color: #9b59b6; font-weight: bold;">0</span>
                </div>
            </div>
        </div>
    `;
}

const phrasesData = [
    {
        start: "В здоровом теле...",
        end: "здоровый дух",
        hint: "Дух",
        category: "Пословицы"
    },
    {
        start: "Семь раз отмерь...",
        end: "один раз отрежь",
        hint: "один",
        category: "Пословицы"
    },
    {
        start: "Делу время...",
        end: "потехе час",
        hint: "час",
        category: "Пословицы"
    },
    {
        start: "Ученье свет...",
        end: "а неученье тьма",
        hint: "тьма",
        category: "Пословицы"
    },
    {
        start: "Тише едешь...",
        end: "дальше будешь",
        hint: "дальше",
        category: "Пословицы"
    },
    {
        start: "Я мыслю...",
        end: "следовательно существую",
        hint: "Декарт",
        category: "Философия"
    },
    {
        start: "Быть или...",
        end: "не быть",
        hint: "не",
        category: "Литература"
    },
    {
        start: "Любви все...",
        end: "возрасты покорны",
        hint: "возрасты",
        category: "Литература"
    },
    {
        start: "Человек предполагает...",
        end: "а Бог располагает",
        hint: "Бог",
        category: "Мудрость"
    }
];

function loadPhraseQuestion() {
    const randomPhrase = phrasesData[Math.floor(Math.random() * phrasesData.length)];
    
    gameState.phraseGame = {
        phrase: randomPhrase,
        score: gameState.phraseGame?.score || 0
    };
    
    document.getElementById('phrase-start').innerHTML = `
        <strong>"${randomPhrase.start}"</strong><br>
        <small style="color: #666; font-size: 16px;">Категория: ${randomPhrase.category}</small>
    `;
    
    document.getElementById('phrase-answer').value = '';
    document.getElementById('phrase-result').innerHTML = '';
    document.getElementById('phrase-score').textContent = gameState.phraseGame.score;
    document.getElementById('phrase-answer').focus();
}

function checkPhrase() {
    const input = document.getElementById('phrase-answer');
    const userAnswer = input.value.trim().toLowerCase();
    const correctAnswer = gameState.phraseGame.phrase.end.toLowerCase();
    
    if (!userAnswer) {
        alert('Введите продолжение фразы!');
        return;
    }
    
    const resultDiv = document.getElementById('phrase-result');
    
    if (userAnswer === correctAnswer) {
        gameState.phraseGame.score += 20;
        resultDiv.innerHTML = `
            <div style="color: #2ecc71; font-size: 18px; background: #e8f8f5; padding: 15px; border-radius: 10px;">
                ✅ Отлично! +20 очков<br>
                <small>Полная фраза: "${gameState.phraseGame.phrase.start} ${gameState.phraseGame.phrase.end}"</small>
            </div>
        `;
    } else {
        resultDiv.innerHTML = `
            <div style="color: #e74c3c; font-size: 18px; background: #fdedec; padding: 15px; border-radius: 10px;">
                ❌ Почти правильно<br>
                <small>Правильный ответ: "${gameState.phraseGame.phrase.end}"</small>
            </div>
        `;
    }
    
    document.getElementById('phrase-score').textContent = gameState.phraseGame.score;
    
    setTimeout(() => {
        loadPhraseQuestion();
        input.value = '';
    }, 2000);
}

function showHint() {
    const hint = gameState.phraseGame.phrase.hint;
    alert(`Подсказка: ${hint}`);
}

// === МОРСКОЙ БОЙ (упрощенный) ===

function createBattleshipGame() {
    return `
        <div class="game-area">
            <h3>🚢 Морской бой (простая версия)</h3>
            <div style="text-align: center; margin: 20px 0;">
                <p>Игра для двух игроков</p>
                <div id="battleship-grid" style="display: grid; grid-template-columns: repeat(5, 50px); gap: 2px; margin: 20px auto; width: fit-content;"></div>
                <div id="battleship-status" style="margin: 15px 0; color: #3498db; font-weight: 500;"></div>
                <button onclick="startBattleship()" class="btn-primary">Начать игру</button>
            </div>
        </div>
    `;
}

// Добавим проверку в showSection
function showSection(section) {
    document.querySelectorAll('.content-section').forEach(s => {
        s.style.display = 'none';
    });
    
    document.querySelectorAll('.nav-link').forEach(link => {
        link.classList.remove('active');
    });
    
    const sectionElement = document.getElementById(`${section}-section`);
    if (sectionElement) {
        sectionElement.style.display = 'block';
    }
    
    // Активируем навигационную ссылку
    const navLinks = document.querySelectorAll('.nav-link');
    navLinks.forEach(link => {
        if (link.onclick && link.onclick.toString().includes(`'${section}'`)) {
            link.classList.add('active');
        }
    });
    
    if (section === 'movies') loadMovies();
    if (section === 'series') loadSeries();
}

// Добавим функцию для исправления навигации при загрузке
function fixNavigation() {
    const navLinks = document.querySelectorAll('.nav-link');
    navLinks.forEach(link => {
        link.addEventListener('click', function(e) {
            e.preventDefault();
            const match = this.onclick.toString().match(/showSection\('(.+?)'\)/);
            if (match) {
                showSection(match[1]);
            }
        });
    });
}

// Вызовем функцию после загрузки
document.addEventListener('DOMContentLoaded', function() {
    fixNavigation();
});
// main.js - ИСПРАВЛЕННАЯ ВЕРСИЯ


document.addEventListener('DOMContentLoaded', function() {
    console.log("Страница загружена");
    
    // Проверяем авторизацию
    checkAuthState();
    
    // Настраиваем обработчики
    setupEventListeners();
});

function checkAuthState() {
    firebase.auth().onAuthStateChanged(async function(user) {
        console.log("Статус авторизации:", user ? "Вошел" : "Вышел");
        
        if (user) {
            currentUser = user;
            console.log("Пользователь:", user.email, "UID:", user.uid);
            
            // Получаем данные пользователя
            try {
                const userData = await FirebaseAuthService.getUserData(user.uid);
                
                if (userData.success) {
                    console.log("Данные пользователя получены");
                    showMainApp(userData.data);
                    
                    // Проверяем, админ ли пользователь
                    isUserAdmin = await FirebaseAuthService.isUserAdmin(user.uid);
                    console.log("Права админа:", isUserAdmin);
                    
                    if (isUserAdmin) {
                        document.getElementById('admin-link').style.display = 'flex';
                    } else {
                        document.getElementById('admin-link').style.display = 'none';
                    }
                    
                    // Загружаем фильмы
                    loadMovies();
                } else {
                    console.error("Ошибка получения данных пользователя:", userData.error);
                    // Если данные не получены, все равно показываем главное приложение
                    showMainApp({
                        firstName: user.email.split('@')[0],
                        email: user.email,
                        role: 'user'
                    });
                }
            } catch (error) {
                console.error("Ошибка при получении данных:", error);
            }
        } else {
            currentUser = null;
            isUserAdmin = false;
            showAuthScreen();
        }
    });
}

function setupEventListeners() {
    // Вход по Enter
    const loginPass = document.getElementById('login-password');
    if (loginPass) {
        loginPass.addEventListener('keypress', function(e) {
            if (e.key === 'Enter') {
                e.preventDefault();
                login();
            }
        });
    }
    
    // Регистрация по Enter
    const regConfirm = document.getElementById('reg-confirm-password');
    if (regConfirm) {
        regConfirm.addEventListener('keypress', function(e) {
            if (e.key === 'Enter') {
                e.preventDefault();
                register();
            }
        });
    }
    
    // ИИ чат по Enter
    const aiInput = document.getElementById('ai-input');
    if (aiInput) {
        aiInput.addEventListener('keypress', function(e) {
            if (e.key === 'Enter') {
                e.preventDefault();
                sendAIMessage();
            }
        });
    }
}

function switchTab(tab) {
    const loginForm = document.getElementById('login-form');
    const registerForm = document.getElementById('register-form');
    const tabs = document.querySelectorAll('.tab-btn');
    
    if (tab === 'login') {
        loginForm.style.display = 'block';
        registerForm.style.display = 'none';
        tabs[0].classList.add('active');
        tabs[1].classList.remove('active');
    } else {
        loginForm.style.display = 'none';
        registerForm.style.display = 'block';
        tabs[0].classList.remove('active');
        tabs[1].classList.add('active');
    }
    clearMessage();
}

// 🔥 ИСПРАВЛЕННАЯ ФУНКЦИЯ ВХОДА
async function login() {
    const emailInput = document.getElementById('login-email');
    const passwordInput = document.getElementById('login-password');
    
    const email = emailInput.value.trim();
    const password = passwordInput.value;
    
    console.log("Попытка входа с email:", email);
    
    // 🔥 ПРОВЕРКА 1: Пустые поля
    if (!email || !password) {
        showMessage('Заполните все поля', 'error');
        emailInput.focus();
        return;
    }
    
    // 🔥 ПРОВЕРКА 2: Валидация email
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
        showMessage('Введите правильный email адрес', 'error');
        emailInput.focus();
        emailInput.select();
        return;
    }
    
    // 🔥 ПРОВЕРКА 3: Минимальная длина пароля
    if (password.length < 6) {
        showMessage('Пароль должен быть минимум 6 символов', 'error');
        passwordInput.focus();
        passwordInput.select();
        return;
    }
    
    // Показываем загрузку
    const loginBtn = document.querySelector('#login-form .btn-primary');
    const originalText = loginBtn.textContent;
    loginBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Вход...';
    loginBtn.disabled = true;
    
    try {
        // 🔥 ВЫЗЫВАЕМ ВХОД ЧЕРЕЗ FIREBASE
        const result = await FirebaseAuthService.loginUser(email, password);
        
        if (result.success) {
            showMessage('✅ Вход успешен!', 'success');
            // onAuthStateChanged автоматически покажет главное приложение
        } else {
            showMessage('❌ ' + result.error, 'error');
            passwordInput.value = '';
            passwordInput.focus();
        }
    } catch (error) {
        console.error("Ошибка входа:", error);
        showMessage('❌ Ошибка входа. Попробуйте еще раз.', 'error');
    } finally {
        // Восстанавливаем кнопку
        loginBtn.innerHTML = originalText;
        loginBtn.disabled = false;
    }
}

// 🔥 ИСПРАВЛЕННАЯ ФУНКЦИЯ РЕГИСТРАЦИИ
async function register() {
    const firstName = document.getElementById('reg-firstname').value.trim();
    const lastName = document.getElementById('reg-lastname').value.trim();
    const age = document.getElementById('reg-age').value;
    const username = document.getElementById('reg-username').value.trim();
    const email = document.getElementById('reg-email').value.trim();
    const password = document.getElementById('reg-password').value;
    const confirmPassword = document.getElementById('reg-confirm-password').value;
    
    console.log("Попытка регистрации:", email);
    
    // 🔥 ПРОВЕРКА 1: Все поля заполнены
    if (!firstName || !lastName || !age || !username || !email || !password || !confirmPassword) {
        showMessage('Заполните все поля', 'error');
        return;
    }
    
    // 🔥 ПРОВЕРКА 2: Валидация email
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
        showMessage('Введите правильный email адрес', 'error');
        document.getElementById('reg-email').focus();
        return;
    }
    
    // 🔥 ПРОВЕРКА 3: Пароли совпадают
    if (password !== confirmPassword) {
        showMessage('Пароли не совпадают', 'error');
        document.getElementById('reg-confirm-password').focus();
        return;
    }
    
    // 🔥 ПРОВЕРКА 4: Минимальная длина пароля
    if (password.length < 6) {
        showMessage('Пароль должен быть минимум 6 символов', 'error');
        document.getElementById('reg-password').focus();
        return;
    }
    
    // 🔥 ПРОВЕРКА 5: Возраст
    if (age < 1 || age > 120) {
        showMessage('Введите корректный возраст (1-120)', 'error');
        document.getElementById('reg-age').focus();
        return;
    }
    
    // Показываем загрузку
    const regBtn = document.querySelector('#register-form .btn-primary');
    const originalText = regBtn.textContent;
    regBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Регистрация...';
    regBtn.disabled = true;
    
    const userData = {
        firstName: firstName,
        lastName: lastName,
        age: age,
        username: username,
        email: email,
        password: password,
        confirmPassword: confirmPassword
    };
    
    try {
        const result = await FirebaseAuthService.registerUser(userData);
        
        if (result.success) {
            showMessage('✅ Регистрация успешна!', 'success');
            // onAuthStateChanged автоматически покажет главное приложение
        } else {
            showMessage('❌ ' + result.error, 'error');
        }
    } catch (error) {
        console.error("Ошибка регистрации:", error);
        showMessage('❌ Ошибка регистрации. Попробуйте еще раз.', 'error');
    } finally {
        regBtn.innerHTML = originalText;
        regBtn.disabled = false;
    }
}

function showMainApp(userData) {
    console.log("Показываем главное приложение");
    
    document.getElementById('auth-screen').style.display = 'none';
    document.getElementById('main-app').style.display = 'block';
    
    // Заполняем данные пользователя
    if (userData) {
        document.getElementById('user-greeting').textContent = `Привет, ${userData.firstName || 'Пользователь'}!`;
        document.getElementById('profile-name').textContent = `${userData.firstName || ''} ${userData.lastName || ''}`.trim() || userData.username;
        document.getElementById('profile-username').textContent = userData.username || userData.email.split('@')[0];
        document.getElementById('profile-email').textContent = userData.email;
        document.getElementById('profile-age').textContent = userData.age || 'Не указан';
        document.getElementById('profile-role').textContent = userData.role === 'admin' ? 'Администратор' : 'Пользователь';
    }
    
    // Показываем первую секцию
    showSection('movies');
}

function showAuthScreen() {
    console.log("Показываем экран авторизации");
    
    document.getElementById('auth-screen').style.display = 'flex';
    document.getElementById('main-app').style.display = 'none';
    
    // Очищаем поля паролей
    document.getElementById('login-password').value = '';
    document.getElementById('reg-password').value = '';
    document.getElementById('reg-confirm-password').value = '';
    
    // Переключаем на вкладку входа
    switchTab('login');
}

function showSection(section) {
    // Скрываем все секции
    document.querySelectorAll('.content-section').forEach(s => {
        s.style.display = 'none';
    });
    
    // Снимаем активность со всех ссылок
    document.querySelectorAll('.nav-link').forEach(link => {
        link.classList.remove('active');
    });
    
    // Показываем выбранную секцию
    const sectionElement = document.getElementById(`${section}-section`);
    if (sectionElement) {
        sectionElement.style.display = 'block';
        
        // Активируем соответствующую ссылку
        const navLink = document.querySelector(`.nav-link[onclick*="${section}"]`);
        if (navLink) {
            navLink.classList.add('active');
        }
    }
    
    // Загружаем контент если нужно
    if (section === 'movies') loadMovies();
    if (section === 'series') loadSeries();
}

async function logout() {
    console.log("Выход из системы");
    
    const result = await FirebaseAuthService.logout();
    if (result.success) {
        showNotification('Вы вышли из системы', 'success');
        // showAuthScreen() вызовется через onAuthStateChanged
    } else {
        showNotification('Ошибка при выходе: ' + result.error, 'error');
    }
}

// 🔥 ИСПРАВЛЕННАЯ ФУНКЦИЯ АДМИН-ПАНЕЛИ
// 🔥 ИСПРАВЛЕННАЯ ФУНКЦИЯ АДМИН-ПАНЕЛИ
function showAdminPanel() {
    console.log("Попытка открыть админ-панель");
    console.log("Текущий пользователь:", currentUser ? currentUser.email : "нет");
    console.log("isUserAdmin:", isUserAdmin);
    
    if (!currentUser) {
        showMessage('Сначала войдите в систему', 'error');
        return;
    }
    
    if (!isUserAdmin) {
        showMessage('У вас нет прав администратора', 'error');
        return;
    }
    
    // 🔥 ОТКРЫВАЕМ В ТОЙ ЖЕ ВКЛАДКЕ, А НЕ В НОВОЙ
    window.location.href = 'admin.html';
}
function showMessage(text, type) {
    const messageDiv = document.getElementById('auth-message');
    if (messageDiv) {
        messageDiv.textContent = text;
        messageDiv.className = `message ${type}`;
        
        setTimeout(() => {
            messageDiv.textContent = '';
            messageDiv.className = 'message';
        }, 5000);
    }
}

function clearMessage() {
    const messageDiv = document.getElementById('auth-message');
    if (messageDiv) {
        messageDiv.textContent = '';
        messageDiv.className = 'message';
    }
}

function showNotification(text, type) {
    const notification = document.createElement('div');
    notification.className = `notification ${type}`;
    notification.textContent = text;
    notification.style.cssText = `
        position: fixed; top: 20px; right: 20px; padding: 15px 25px;
        border-radius: 10px; color: white; z-index: 10000; font-weight: 500;
        background: ${type === 'success' ? '#2ecc71' : type === 'error' ? '#e74c3c' : '#3498db'};
    `;
    document.body.appendChild(notification);
    setTimeout(() => notification.remove(), 3000);
}

// main.js - ДОБАВЬТЕ ОТЛАДКУ

// В функции checkAuthState добавьте:
function checkAuthState() {
    firebase.auth().onAuthStateChanged(async function(user) {
        console.log("Статус авторизации:", user ? "Вошел" : "Вышел");
        
        if (user) {
            currentUser = user;
            console.log("🟢 Пользователь вошел:", user.email);
            console.log("🆔 UID:", user.uid);
            
            try {
                const userData = await FirebaseAuthService.getUserData(user.uid);
                
                if (userData.success) {
                    console.log("📋 Данные пользователя:", userData.data);
                    
                    // 🔥 ПРОВЕРКА АДМИНА С ОТЛАДКОЙ
                    console.log("🔍 Проверяем права админа...");
                    isUserAdmin = await FirebaseAuthService.isUserAdmin(user.uid);
                    console.log("👑 Результат проверки админа:", isUserAdmin);
                    
                    // 🔥 ОТЛАДКА: выводим в консоль для проверки
                    if (isUserAdmin) {
                        console.log("🎯 ПОЛЬЗОВАТЕЛЬ ЯВЛЯЕТСЯ АДМИНОМ!");
                        console.log("🛠️ Кнопка админа должна отображаться");
                    } else {
                        console.log("👤 ПОЛЬЗОВАТЕЛЬ НЕ АДМИН");
                    }
                    
                    showMainApp(userData.data);
                    
                    // 🔥 ПРОВЕРЯЕМ КНОПКУ АДМИНА
                    const adminLink = document.getElementById('admin-link');
                    console.log("🔗 Элемент admin-link существует:", !!adminLink);
                    
                    if (isUserAdmin && adminLink) {
                        console.log("✅ Показываем кнопку админа");
                        adminLink.style.display = 'flex';
                        adminLink.style.color = '#ffd700'; // Золотой цвет для админа
                    } else {
                        console.log("❌ Скрываем кнопку админа");
                        if (adminLink) adminLink.style.display = 'none';
                    }
                    
                    loadMovies();
                } else {
                    console.error("❌ Ошибка получения данных:", userData.error);
                }
            } catch (error) {
                console.error("🔥 Критическая ошибка:", error);
            }
        } else {
            console.log("🔴 Пользователь вышел");
            currentUser = null;
            isUserAdmin = false;
            showAuthScreen();
        }
    });
}
// ... остальной код (фильмы, ИИ, игры) остается таким же ...

// В main.js добавьте в конец файла (перед последней }):

// Показать информацию о сайте
function showSiteInfo() {
    alert(`ИНФОРМАЦИЯ О САЙТЕ

🎬 МультиПортал
Версия: 1.0.0
Дата создания: 2024 год

👨‍💻 Создатель:
Зиёвуддин Юнусов
Full-stack разработчик

📞 Контакты:
• Email: ziyoyunusov27@gmail.com
• Telegram: @ziyovuddin
• Телефон: +998 (90) 123-45-67

🛠️ Технологии:
• Frontend: HTML5, CSS3, JavaScript
• Backend: Firebase (Auth, Firestore)
• API: The Movie Database (TMDB)
• Игры: Vanilla JavaScript

📋 Особенности:
✅ Фильмы и сериалы
✅ Игры для 2 игроков
✅ ИИ ассистент
✅ Админ-панель
✅ Адаптивный дизайн

⚠️ Все права защищены © 2024`);
}

// Показать контактную информацию
function showContactInfo() {
    alert(`КОНТАКТНАЯ ИНФОРМАЦИЯ

Свяжитесь с нами:

📧 Email: ziyoyunusov27@gmail.com
✈️ Telegram: @ziyovuddin
📱 Телефон: +998 (90) 123-45-67

📍 Адрес: Ташкент, Узбекистан

🕐 Время работы поддержки:
Понедельник - Пятница: 9:00 - 18:00
Суббота: 10:00 - 16:00
Воскресенье: выходной

💬 Для быстрой связи используйте Telegram
📝 Для деловых предложений - Email`);
}

// Показать техподдержку
function showSupport() {
    alert(`ТЕХНИЧЕСКАЯ ПОДДЕРЖКА

Если у вас возникли проблемы:

1. Проверьте интернет-соединение
2. Очистите кэш браузера (Ctrl+Shift+Del)
3. Обновите страницу (F5)

Если проблема не решена:

📧 Напишите на: ziyoyunusov27@gmail.com
✈️ Или в Telegram: @ziyovuddin

Обязательно укажите:
• Ваш email
• Описание проблемы
• Скриншот ошибки (если есть)
• Браузер и ОС

Мы ответим в течение 24 часов!`);
}