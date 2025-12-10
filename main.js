// main.js - с улучшенной обработкой ошибок

// DOM элементы
let authMessageDiv, loginEmailInput, loginPasswordInput;
let regFirstNameInput, regLastNameInput, regAgeInput, regUsernameInput, regEmailInput, regPasswordInput, regConfirmPasswordInput;

// Инициализация при загрузке страницы
document.addEventListener('DOMContentLoaded', function() {
    // Инициализация DOM элементов
    initializeDOMElements();
    
    // Проверка состояния аутентификации
    setupAuthListener();
    
    // Добавляем обработчики клавиш для форм
    setupKeyboardEvents();
});

function initializeDOMElements() {
    authMessageDiv = document.getElementById('auth-message');
    loginEmailInput = document.getElementById('login-email');
    loginPasswordInput = document.getElementById('login-password');
    regFirstNameInput = document.getElementById('reg-firstname');
    regLastNameInput = document.getElementById('reg-lastname');
    regAgeInput = document.getElementById('reg-age');
    regUsernameInput = document.getElementById('reg-username');
    regEmailInput = document.getElementById('reg-email');
    regPasswordInput = document.getElementById('reg-password');
    regConfirmPasswordInput = document.getElementById('reg-confirm-password');
}

function setupAuthListener() {
    // Проверка состояния аутентификации
    FirebaseAuthService.onAuthStateChanged(async (user) => {
        console.log("Состояние аутентификации изменено:", user ? "вошел" : "вышел");
        
        if (user) {
            // Пользователь вошел
            const userData = await FirebaseAuthService.getUserData(user.uid);
            if (userData.success) {
                showMainApp(userData.data);
                
                // Проверка роли пользователя
                const isAdmin = await FirebaseAuthService.isUserAdmin(user.uid);
                const adminLink = document.getElementById('admin-link');
                if (adminLink) {
                    adminLink.style.display = isAdmin ? 'flex' : 'none';
                }
            } else {
                showMessage(userData.error, 'error');
            }
        } else {
            // Пользователь вышел
            showAuthScreen();
        }
    });
}

function setupKeyboardEvents() {
    // Вход по Enter на форме входа
    if (loginPasswordInput) {
        loginPasswordInput.addEventListener('keypress', function(e) {
            if (e.key === 'Enter') {
                login();
            }
        });
    }
    
    // Регистрация по Enter на форме регистрации
    if (regConfirmPasswordInput) {
        regConfirmPasswordInput.addEventListener('keypress', function(e) {
            if (e.key === 'Enter') {
                register();
            }
        });
    }
}

function switchTab(tab) {
    const loginForm = document.getElementById('login-form');
    const registerForm = document.getElementById('register-form');
    const loginTab = document.querySelector('.tab-btn:nth-child(1)');
    const registerTab = document.querySelector('.tab-btn:nth-child(2)');
    
    if (tab === 'login') {
        loginForm.style.display = 'block';
        registerForm.style.display = 'none';
        loginTab.classList.add('active');
        registerTab.classList.remove('active');
        
        // Очищаем сообщения при переключении вкладок
        clearMessage();
    } else {
        loginForm.style.display = 'none';
        registerForm.style.display = 'block';
        loginTab.classList.remove('active');
        registerTab.classList.add('active');
        
        // Очищаем сообщения при переключении вкладок
        clearMessage();
    }
}

async function login() {
    const email = loginEmailInput ? loginEmailInput.value.trim() : '';
    const password = loginPasswordInput ? loginPasswordInput.value : '';
    
    showMessage('Выполняется вход...', 'info');
    
    // Добавляем индикатор загрузки
    const loginBtn = document.querySelector('#login-form .btn-primary');
    const originalText = loginBtn.textContent;
    loginBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Вход...';
    loginBtn.disabled = true;
    
    const result = await FirebaseAuthService.loginUser(email, password);
    
    // Восстанавливаем кнопку
    loginBtn.innerHTML = originalText;
    loginBtn.disabled = false;
    
    if (result.success) {
        showMessage('Вход успешен!', 'success');
        // Автоматический переход произойдет через onAuthStateChanged
    } else {
        showMessage(result.error, 'error');
    }
}

async function register() {
    const userData = {
        firstName: regFirstNameInput ? regFirstNameInput.value.trim() : '',
        lastName: regLastNameInput ? regLastNameInput.value.trim() : '',
        age: regAgeInput ? regAgeInput.value : '',
        username: regUsernameInput ? regUsernameInput.value.trim() : '',
        email: regEmailInput ? regEmailInput.value.trim() : '',
        password: regPasswordInput ? regPasswordInput.value : '',
        confirmPassword: regConfirmPasswordInput ? regConfirmPasswordInput.value : ''
    };
    
    showMessage('Регистрация...', 'info');
    
    // Добавляем индикатор загрузки
    const registerBtn = document.querySelector('#register-form .btn-primary');
    const originalText = registerBtn.textContent;
    registerBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Регистрация...';
    registerBtn.disabled = true;
    
    const result = await FirebaseAuthService.registerUser(userData);
    
    // Восстанавливаем кнопку
    registerBtn.innerHTML = originalText;
    registerBtn.disabled = false;
    
    if (result.success) {
        showMessage('Регистрация успешна! Автоматический вход...', 'success');
        // Автоматический вход произойдет через onAuthStateChanged
    } else {
        showMessage(result.error, 'error');
    }
}

function showMessage(message, type = 'info') {
    if (!authMessageDiv) return;
    
    authMessageDiv.textContent = message;
    authMessageDiv.className = 'message';
    
    switch(type) {
        case 'success':
            authMessageDiv.style.color = 'green';
            authMessageDiv.style.backgroundColor = '#e8f5e9';
            break;
        case 'error':
            authMessageDiv.style.color = 'red';
            authMessageDiv.style.backgroundColor = '#ffebee';
            break;
        case 'info':
            authMessageDiv.style.color = '#2196f3';
            authMessageDiv.style.backgroundColor = '#e3f2fd';
            break;
    }
    
    // Автоматически скрываем сообщение через 5 секунд
    if (type !== 'info') {
        setTimeout(clearMessage, 5000);
    }
}

function clearMessage() {
    if (authMessageDiv) {
        authMessageDiv.textContent = '';
        authMessageDiv.style.backgroundColor = '';
    }
}

function showMainApp(userData) {
    const authScreen = document.getElementById('auth-screen');
    const mainApp = document.getElementById('main-app');
    
    if (authScreen) authScreen.style.display = 'none';
    if (mainApp) mainApp.style.display = 'block';
    
    // Заполняем информацию о пользователе
    const userGreeting = document.getElementById('user-greeting');
    const profileName = document.getElementById('profile-name');
    const profileUsername = document.getElementById('profile-username');
    const profileEmail = document.getElementById('profile-email');
    const profileAge = document.getElementById('profile-age');
    const profileRole = document.getElementById('profile-role');
    
    if (userGreeting) {
        userGreeting.textContent = `Привет, ${userData.firstName}!`;
    }
    
    if (profileName) {
        profileName.textContent = `${userData.firstName} ${userData.lastName}`;
    }
    
    if (profileUsername) {
        profileUsername.textContent = userData.username;
    }
    
    if (profileEmail) {
        profileEmail.textContent = userData.email;
    }
    
    if (profileAge) {
        profileAge.textContent = userData.age;
    }
    
    if (profileRole) {
        profileRole.textContent = userData.role === 'admin' ? 'Администратор' : 'Пользователь';
    }
    
    // Показываем первый раздел
    showSection('movies');
    
    // Загружаем данные профиля
    loadUserProfile();
}

function showAuthScreen() {
    const authScreen = document.getElementById('auth-screen');
    const mainApp = document.getElementById('main-app');
    
    if (authScreen) {
        authScreen.style.display = 'flex';
        // Очищаем поля формы при выходе
        if (loginEmailInput) loginEmailInput.value = '';
        if (loginPasswordInput) loginPasswordInput.value = '';
        clearMessage();
    }
    if (mainApp) mainApp.style.display = 'none';
}

function showSection(section) {
    // Скрываем все разделы
    const sections = document.querySelectorAll('.content-section');
    sections.forEach(s => s.style.display = 'none');
    
    // Показываем выбранный раздел
    const sectionElement = document.getElementById(`${section}-section`);
    if (sectionElement) {
        sectionElement.style.display = 'block';
    }
    
    // Загружаем данные если нужно
    if (section === 'movies') loadMovies();
    if (section === 'series') loadSeries();
}

async function logout() {
    const result = await FirebaseAuthService.logout();
    if (result.success) {
        showMessage('Вы вышли из системы', 'success');
    } else {
        showMessage('Ошибка при выходе: ' + result.error, 'error');
    }
}

function showAdminPanel() {
    window.location.href = 'admin.html';
}

// Загрузка профиля пользователя
async function loadUserProfile() {
    const user = FirebaseAuthService.getCurrentUser();
    if (user) {
        const userData = await FirebaseAuthService.getUserData(user.uid);
        if (userData.success) {
            // Обновляем информацию в профиле
            const profileName = document.getElementById('profile-name');
            const profileUsername = document.getElementById('profile-username');
            const profileEmail = document.getElementById('profile-email');
            const profileAge = document.getElementById('profile-age');
            const profileRole = document.getElementById('profile-role');
            
            if (profileName) {
                profileName.textContent = `${userData.data.firstName} ${userData.data.lastName}`;
            }
            
            if (profileUsername) {
                profileUsername.textContent = userData.data.username;
            }
            
            if (profileEmail) {
                profileEmail.textContent = userData.data.email;
            }
            
            if (profileAge) {
                profileAge.textContent = userData.data.age;
            }
            
            if (profileRole) {
                profileRole.textContent = userData.data.role === 'admin' ? 'Администратор' : 'Пользователь';
            }
        }
    }
}

// Функции для ИИ ассистента (остаются без изменений)
async function sendAIMessage() {
    const input = document.getElementById('ai-input');
    if (!input) return;
    
    const message = input.value.trim();
    if (!message) return;
    
    const chatMessages = document.getElementById('chat-messages');
    if (!chatMessages) return;
    
    // Добавляем сообщение пользователя
    const userMsg = document.createElement('div');
    userMsg.className = 'message user-message';
    userMsg.textContent = message;
    chatMessages.appendChild(userMsg);
    
    input.value = '';
    
    // Имитируем ответ ИИ
    setTimeout(() => {
        const aiResponse = generateAIResponse(message);
        const aiMsg = document.createElement('div');
        aiMsg.className = 'message ai-message';
        aiMsg.textContent = aiResponse;
        chatMessages.appendChild(aiMsg);
        chatMessages.scrollTop = chatMessages.scrollHeight;
    }, 1000);
}

function generateAIResponse(message) {
    // ... (остается как было в предыдущем коде)
    return "Я ваш ИИ ассистент!";
}

// Остальные функции остаются без изменений