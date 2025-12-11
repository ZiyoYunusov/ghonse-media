// admin-panel.js - ИСПРАВЛЕННАЯ ВЕРСИЯ 2.0

document.addEventListener('DOMContentLoaded', function() {
    console.log("Админ панель загружена");
    
    // 🔥 ЖДЕМ, ПОКА FIREBASE ИНИЦИАЛИЗИРУЕТСЯ
    const checkInterval = setInterval(async () => {
        if (firebase && firebase.auth) {
            clearInterval(checkInterval);
            await initializeAdminPanel();
        }
    }, 100);
});

async function initializeAdminPanel() {
    console.log("Инициализация админ-панели...");
    
    // 🔥 ЖДЕМ АВТОРИЗАЦИЮ ПОЛЬЗОВАТЕЛЯ
    await waitForAuth();
    
    // Проверяем доступ
    await checkAdminAccess();
}

// 🔥 ФУНКЦИЯ, КОТОРАЯ ЖДЕТ АВТОРИЗАЦИЮ ПОЛЬЗОВАТЕЛЯ
function waitForAuth() {
    return new Promise((resolve) => {
        console.log("Ожидание авторизации...");
        
        // Проверяем текущего пользователя
        const user = firebase.auth().currentUser;
        
        if (user) {
            console.log("Пользователь уже авторизован:", user.email);
            resolve(user);
            return;
        }
        
        // Если пользователя нет, ждем изменения состояния
        const unsubscribe = firebase.auth().onAuthStateChanged((user) => {
            if (user) {
                console.log("Пользователь авторизован через onAuthStateChanged:", user.email);
                unsubscribe(); // Отписываемся
                resolve(user);
            } else {
                console.log("Пользователь не авторизован");
                // Ждем еще 2 секунды
                setTimeout(() => {
                    unsubscribe();
                    resolve(null);
                }, 2000);
            }
        });
        
        // Таймаут на случай если авторизация никогда не придет
        setTimeout(() => {
            unsubscribe();
            resolve(null);
        }, 5000);
    });
}

async function checkAdminAccess() {
    console.log("Проверка доступа к админ-панели");
    
    try {
        // 🔥 ПРОВЕРЯЕМ ТЕКУЩЕГО ПОЛЬЗОВАТЕЛЯ
        const user = firebase.auth().currentUser;
        
        if (!user) {
            console.log("❌ Пользователь не авторизован в Firebase");
            
            // Показываем сообщение и редиректим
            setTimeout(() => {
                alert('❌ Требуется авторизация! Сначала войдите в систему.');
                window.location.href = 'index.html';
            }, 500);
            
            return;
        }
        
        console.log("✅ Пользователь авторизован:", user.email, "UID:", user.uid);
        
        // 🔥 ПРОВЕРЯЕМ ПРАВА АДМИНИСТРАТОРА
        const isAdmin = await FirebaseAuthService.isUserAdmin(user.uid);
        
        if (!isAdmin) {
            console.log("❌ Пользователь не является админом");
            alert('❌ У вас нет прав администратора!');
            setTimeout(() => {
                window.location.href = 'index.html';
            }, 1000);
            return;
        }
        
        console.log("✅ Доступ разрешен - пользователь администратор");
        
        // 🔥 ЗАГРУЖАЕМ ДАННЫЕ ПОЛЬЗОВАТЕЛЯ ДЛЯ ПРИВЕТСТВИЯ
        const userData = await FirebaseAuthService.getUserData(user.uid);
        if (userData.success) {
            const adminGreeting = document.getElementById('admin-greeting');
            if (adminGreeting) {
                adminGreeting.textContent = `Админ: ${userData.data.firstName} ${userData.data.lastName}`;
            }
        }
        
        // 🔥 ЗАГРУЖАЕМ ДАННЫЕ АДМИН-ПАНЕЛИ
        loadUsers();
        loadAdmins();
        loadOnlineUsers();
        
        // Обновляем каждые 30 секунд
        setInterval(loadOnlineUsers, 30000);
        
    } catch (error) {
        console.error("❌ Ошибка проверки доступа:", error);
        alert('Ошибка при проверке доступа: ' + error.message);
        setTimeout(() => {
            window.location.href = 'index.html';
        }, 2000);
    }
}

// 🔥 ДОБАВЬТЕ ЭТОТ КОД В НАЧАЛО ФАЙЛА firebase.js
// Это гарантирует, что Firebase будет доступен глобально
window.initializeFirebase = function() {
    return new Promise((resolve) => {
        const checkFirebase = setInterval(() => {
            if (window.firebase && window.firebase.auth) {
                clearInterval(checkFirebase);
                console.log("✅ Firebase доступен глобально");
                resolve();
            }
        }, 100);
    });
};

// admin-panel.js - ИСПРАВЛЕННАЯ ВЕРСИЯ

document.addEventListener('DOMContentLoaded', function() {
    console.log("Админ панель загружена");
    checkAdminAccess();
});

async function checkAdminAccess() {
    try {
        const user = FirebaseAuthService.getCurrentUser();
        
        if (!user) {
            console.log("Пользователь не авторизован");
            alert("Требуется авторизация!");
            redirectToMain();
            return;
        }
        
        console.log("Проверяем права админа для:", user.email);
        const isAdmin = await FirebaseAuthService.isUserAdmin(user.uid);
        
        if (!isAdmin) {
            console.log("Пользователь не является админом");
            alert("❌ Доступ запрещен! Требуются права администратора.");
            redirectToMain();
            return;
        }
        
        console.log("✅ Доступ к админ панели разрешен");
        
        // Загружаем данные пользователя
        const userData = await FirebaseAuthService.getUserData(user.uid);
        if (userData.success) {
            const adminGreeting = document.getElementById('admin-greeting');
            if (adminGreeting) {
                adminGreeting.textContent = `Админ: ${userData.data.firstName} ${userData.data.lastName}`;
            }
        }
        
        // Загружаем данные
        await loadUsers();
        await loadAdmins();
        await loadOnlineUsers();
        
        // Обновляем онлайн каждые 30 секунд
        setInterval(loadOnlineUsers, 30000);
        
    } catch (error) {
        console.error("❌ Ошибка проверки доступа:", error);
        alert("Ошибка проверки прав доступа");
        redirectToMain();
    }
}

function redirectToMain() {
    window.location.href = 'index.html';
}

function showAdminTab(tab) {
    console.log("Переключение на вкладку:", tab);
    
    // Скрываем все секции
    document.querySelectorAll('.admin-section').forEach(section => {
        section.style.display = 'none';
    });
    
    // Убираем активный класс со всех ссылок
    document.querySelectorAll('.nav-link').forEach(link => {
        link.classList.remove('active');
    });
    
    // Показываем выбранную секцию
    const tabElement = document.getElementById(`${tab}-tab`);
    if (tabElement) {
        tabElement.style.display = 'block';
    }
    
    // Обновляем данные при переключении
    if (tab === 'users') loadUsers();
    if (tab === 'admins') loadAdmins();
    if (tab === 'online') loadOnlineUsers();
}

async function loadUsers() {
    const table = document.getElementById('users-table');
    if (!table) {
        console.error("Таблица users-table не найдена");
        return;
    }
    
    table.innerHTML = '<tr><td colspan="7" style="text-align: center; padding: 20px;">Загрузка...</td></tr>';
    
    try {
        const result = await FirebaseAuthService.getAllUsers();
        console.log("Результат загрузки пользователей:", result);
        
        if (result.success && result.users) {
            if (result.users.length === 0) {
                table.innerHTML = '<tr><td colspan="7" style="text-align: center; padding: 20px;">Нет пользователей</td></tr>';
                return;
            }
            
            table.innerHTML = '';
            result.users.forEach(user => {
                const row = document.createElement('tr');
                row.innerHTML = `
                    <td>${user.firstName || '-'}</td>
                    <td>${user.lastName || '-'}</td>
                    <td>${user.username || '-'}</td>
                    <td>${user.email || '-'}</td>
                    <td>${user.age || '-'}</td>
                    <td><span class="role-badge ${user.role === 'admin' ? 'admin' : 'user'}">${user.role === 'admin' ? 'Админ' : 'Пользователь'}</span></td>
                    <td>${user.createdAt ? new Date(user.createdAt.seconds * 1000).toLocaleDateString('ru-RU') : '-'}</td>
                `;
                table.appendChild(row);
            });
        } else {
            table.innerHTML = `<tr><td colspan="7" style="color: red; text-align: center; padding: 20px;">Ошибка: ${result.error || 'Неизвестная ошибка'}</td></tr>`;
        }
    } catch (error) {
        console.error("❌ Ошибка загрузки пользователей:", error);
        table.innerHTML = `<tr><td colspan="7" style="color: red; text-align: center; padding: 20px;">Ошибка загрузки данных</td></tr>`;
    }
}

async function loadAdmins() {
    const table = document.getElementById('admins-table');
    if (!table) {
        console.error("Таблица admins-table не найдена");
        return;
    }
    
    table.innerHTML = '<tr><td colspan="6" style="text-align: center; padding: 20px;">Загрузка...</td></tr>';
    
    try {
        const result = await FirebaseAuthService.getAllUsers();
        console.log("Результат загрузки админов:", result);
        
        if (result.success && result.users) {
            const admins = result.users.filter(user => user.role === 'admin');
            
            if (admins.length === 0) {
                table.innerHTML = '<tr><td colspan="6" style="text-align: center; padding: 20px;">Нет администраторов</td></tr>';
                return;
            }
            
            table.innerHTML = '';
            admins.forEach(admin => {
                const row = document.createElement('tr');
                row.innerHTML = `
                    <td>${admin.firstName || '-'}</td>
                    <td>${admin.lastName || '-'}</td>
                    <td>${admin.username || '-'}</td>
                    <td>${admin.email || '-'}</td>
                    <td>${admin.age || '-'}</td>
                    <td>${admin.createdAt ? new Date(admin.createdAt.seconds * 1000).toLocaleDateString('ru-RU') : '-'}</td>
                `;
                table.appendChild(row);
            });
        } else {
            table.innerHTML = `<tr><td colspan="6" style="color: red; text-align: center; padding: 20px;">Ошибка: ${result.error || 'Неизвестная ошибка'}</td></tr>`;
        }
    } catch (error) {
        console.error("❌ Ошибка загрузки админов:", error);
        table.innerHTML = `<tr><td colspan="6" style="color: red; text-align: center; padding: 20px;">Ошибка загрузки данных</td></tr>`;
    }
}

async function loadOnlineUsers() {
    const table = document.getElementById('online-table');
    const onlineCount = document.getElementById('online-count');
    const adminsOnline = document.getElementById('admins-online');
    
    if (!table) {
        console.error("Таблица online-table не найдена");
        return;
    }
    
    try {
        const result = await FirebaseAuthService.getOnlineUsers();
        console.log("Онлайн пользователи:", result);
        
        if (result.success && result.users) {
            if (result.users.length === 0) {
                table.innerHTML = '<tr><td colspan="5" style="text-align: center; padding: 20px;">Нет пользователей онлайн</td></tr>';
                if (onlineCount) onlineCount.textContent = '0';
                if (adminsOnline) adminsOnline.textContent = '0';
                return;
            }
            
            table.innerHTML = '';
            let adminCount = 0;
            
            result.users.forEach(user => {
                if (user.role === 'admin') adminCount++;
                
                const row = document.createElement('tr');
                row.innerHTML = `
                    <td>${user.firstName || '-'} ${user.lastName || '-'}</td>
                    <td>${user.username || '-'}</td>
                    <td>${user.email || '-'}</td>
                    <td><span class="role-badge ${user.role === 'admin' ? 'admin' : 'user'}">${user.role === 'admin' ? 'Админ' : 'Пользователь'}</span></td>
                    <td>${user.lastLogin ? new Date(user.lastLogin.seconds * 1000).toLocaleTimeString('ru-RU') : 'Сейчас'}</td>
                `;
                table.appendChild(row);
            });
            
            if (onlineCount) onlineCount.textContent = result.users.length;
            if (adminsOnline) adminsOnline.textContent = adminCount;
        } else {
            table.innerHTML = `<tr><td colspan="5" style="color: red; text-align: center; padding: 20px;">Ошибка: ${result.error || 'Неизвестная ошибка'}</td></tr>`;
        }
    } catch (error) {
        console.error("❌ Ошибка загрузки онлайн пользователей:", error);
        table.innerHTML = `<tr><td colspan="5" style="color: red; text-align: center; padding: 20px;">Ошибка загрузки данных</td></tr>`;
    }
}

async function addNewAdmin() {
    const adminData = {
        firstName: document.getElementById('admin-firstname')?.value.trim() || '',
        lastName: document.getElementById('admin-lastname')?.value.trim() || '',
        age: document.getElementById('admin-age')?.value || '',
        username: document.getElementById('admin-username')?.value.trim() || '',
        email: document.getElementById('admin-email')?.value.trim() || '',
        password: document.getElementById('admin-password')?.value || ''
    };
    
    console.log("Добавление нового админа:", adminData.email);
    
    // Проверка данных
    if (!adminData.email || !FirebaseAuthService.isValidEmail(adminData.email)) {
        alert('❌ Введите корректный email адрес');
        return;
    }
    
    if (!adminData.password || adminData.password.length < 6) {
        alert('❌ Пароль должен содержать минимум 6 символов');
        return;
    }
    
    if (!adminData.firstName || adminData.firstName.length < 2) {
        alert('❌ Имя должно содержать минимум 2 символа');
        return;
    }
    
    try {
        const result = await FirebaseAuthService.addAdmin(adminData);
        
        if (result.success) {
            alert('✅ Администратор успешно добавлен!');
            
            // Очищаем форму
            ['admin-firstname', 'admin-lastname', 'admin-age', 'admin-username', 'admin-email', 'admin-password'].forEach(id => {
                const element = document.getElementById(id);
                if (element) element.value = '';
            });
            
            // Обновляем списки
            await loadAdmins();
            await loadUsers();
        } else {
            alert(`❌ Ошибка: ${result.error}`);
        }
    } catch (error) {
        console.error("❌ Ошибка добавления админа:", error);
        alert('❌ Ошибка при добавлении администратора');
    }
}

function goToMainApp() {
    window.location.href = 'index.html';
}

async function logoutAdmin() {
    try {
        const result = await FirebaseAuthService.logout();
        if (result.success) {
            window.location.href = 'index.html';
        } else {
            alert(`❌ Ошибка при выходе: ${result.error}`);
        }
    } catch (error) {
        console.error("❌ Ошибка выхода:", error);
        alert('❌ Ошибка при выходе из системы');
 
   }

// admin-panel.js - ИСПРАВЛЕННАЯ ВЕРСИЯ

document.addEventListener('DOMContentLoaded', async function() {
    console.log("Админ панель загружена");
    
    // Даем время на инициализацию Firebase
    setTimeout(async () => {
        await checkAdminAccess();
    }, 1000);
});

async function checkAdminAccess() {
    console.log("Проверка доступа к админ-панели");
    
    try {
        // 🔥 ПРОВЕРКА 1: Проверяем localStorage
        const adminCheck = localStorage.getItem('admin_check');
        const adminUid = localStorage.getItem('admin_uid');
        
        if (!adminCheck || adminCheck !== 'true') {
            console.log("Нет данных в localStorage");
            redirectToMain();
            return;
        }
        
        // 🔥 ПРОВЕРКА 2: Проверяем текущего пользователя в Firebase
        const user = firebase.auth().currentUser;
        
        if (!user) {
            console.log("Пользователь не авторизован в Firebase");
            alert('❌ Требуется авторизация!');
            redirectToMain();
            return;
        }
        
        // 🔥 ПРОВЕРКА 3: Сравниваем UID из localStorage с текущим пользователем
        if (user.uid !== adminUid) {
            console.log("UID не совпадает:", user.uid, "!=", adminUid);
            alert('❌ Несовпадение сессии!');
            redirectToMain();
            return;
        }
        
        console.log("Пользователь авторизован:", user.email);
        
        // 🔥 ПРОВЕРКА 4: Проверяем права администратора
        const isAdmin = await FirebaseAuthService.isUserAdmin(user.uid);
        
        if (!isAdmin) {
            console.log("Пользователь не является админом");
            alert('❌ У вас нет прав администратора!');
            redirectToMain();
            return;
        }
        
        // 🔥 ПРОВЕРКА 5: Загружаем данные пользователя для приветствия
        const userData = await FirebaseAuthService.getUserData(user.uid);
        if (userData.success) {
            const adminGreeting = document.getElementById('admin-greeting');
            if (adminGreeting) {
                adminGreeting.textContent = `Админ: ${userData.data.firstName} ${userData.data.lastName}`;
            }
        }
        
        console.log("✅ Доступ разрешен");
        
        // Загружаем данные
        loadUsers();
        loadAdmins();
        loadOnlineUsers();
        
        // Обновляем каждые 30 секунд
        setInterval(loadOnlineUsers, 30000);
        
    } catch (error) {
        console.error("❌ Ошибка проверки доступа:", error);
        alert('Ошибка при проверке доступа: ' + error.message);
        redirectToMain();
    }
}

function redirectToMain() {
    // Очищаем localStorage перед редиректом
    localStorage.removeItem('admin_check');
    localStorage.removeItem('admin_uid');
    localStorage.removeItem('admin_email');
    
    window.location.href = 'index.html';
}

function showAdminTab(tab) {
    // Скрываем все вкладки
    document.querySelectorAll('.admin-section').forEach(section => {
        section.style.display = 'none';
    });
    
    // Показываем выбранную вкладку
    const tabElement = document.getElementById(`${tab}-tab`);
    if (tabElement) {
        tabElement.style.display = 'block';
    }
    
    // Обновляем данные при переключении
    if (tab === 'users') loadUsers();
    if (tab === 'admins') loadAdmins();
    if (tab === 'online') loadOnlineUsers();
}

async function loadUsers() {
    const table = document.getElementById('users-table');
    if (!table) return;
    
    table.innerHTML = '<tr><td colspan="7" style="text-align: center; padding: 20px;">Загрузка...</td></tr>';
    
    const result = await FirebaseAuthService.getAllUsers();
    
    if (result.success) {
        if (result.users.length === 0) {
            table.innerHTML = '<tr><td colspan="7" style="text-align: center; padding: 20px;">Нет пользователей</td></tr>';
            return;
        }
        
        table.innerHTML = '';
        result.users.forEach(user => {
            const row = document.createElement('tr');
            row.innerHTML = `
                <td>${user.firstName || '-'}</td>
                <td>${user.lastName || '-'}</td>
                <td>${user.username || '-'}</td>
                <td>${user.email || '-'}</td>
                <td>${user.age || '-'}</td>
                <td><span class="role-badge ${user.role === 'admin' ? 'admin' : 'user'}">${user.role === 'admin' ? 'Админ' : 'Пользователь'}</span></td>
                <td>${user.createdAt ? new Date(user.createdAt.seconds * 1000).toLocaleDateString('ru-RU') : '-'}</td>
            `;
            table.appendChild(row);
        });
    } else {
        table.innerHTML = `<tr><td colspan="7" style="color: red; text-align: center; padding: 20px;">Ошибка: ${result.error}</td></tr>`;
    }
}

async function loadAdmins() {
    const table = document.getElementById('admins-table');
    if (!table) return;
    
    table.innerHTML = '<tr><td colspan="6" style="text-align: center; padding: 20px;">Загрузка...</td></tr>';
    
    const result = await FirebaseAuthService.getAllUsers();
    
    if (result.success) {
        const admins = result.users.filter(user => user.role === 'admin');
        
        if (admins.length === 0) {
            table.innerHTML = '<tr><td colspan="6" style="text-align: center; padding: 20px;">Нет администраторов</td></tr>';
            return;
        }
        
        table.innerHTML = '';
        admins.forEach(admin => {
            const row = document.createElement('tr');
            row.innerHTML = `
                <td>${admin.firstName || '-'}</td>
                <td>${admin.lastName || '-'}</td>
                <td>${admin.username || '-'}</td>
                <td>${admin.email || '-'}</td>
                <td>${admin.age || '-'}</td>
                <td>${admin.createdAt ? new Date(admin.createdAt.seconds * 1000).toLocaleDateString('ru-RU') : '-'}</td>
            `;
            table.appendChild(row);
        });
    } else {
        table.innerHTML = `<tr><td colspan="6" style="color: red; text-align: center; padding: 20px;">Ошибка: ${result.error}</td></tr>`;
    }
}

async function loadOnlineUsers() {
    const table = document.getElementById('online-table');
    const onlineCount = document.getElementById('online-count');
    const adminsOnline = document.getElementById('admins-online');
    
    if (!table) return;
    
    const result = await FirebaseAuthService.getOnlineUsers();
    
    if (result.success) {
        if (result.users.length === 0) {
            table.innerHTML = '<tr><td colspan="5" style="text-align: center; padding: 20px;">Нет пользователей онлайн</td></tr>';
            if (onlineCount) onlineCount.textContent = '0';
            if (adminsOnline) adminsOnline.textContent = '0';
            return;
        }
        
        table.innerHTML = '';
        let adminCount = 0;
        
        result.users.forEach(user => {
            if (user.role === 'admin') adminCount++;
            
            const row = document.createElement('tr');
            row.innerHTML = `
                <td>${user.firstName || '-'} ${user.lastName || '-'}</td>
                <td>${user.username || '-'}</td>
                <td>${user.email || '-'}</td>
                <td><span class="role-badge ${user.role === 'admin' ? 'admin' : 'user'}">${user.role === 'admin' ? 'Админ' : 'Пользователь'}</span></td>
                <td>${user.lastLogin ? new Date(user.lastLogin.seconds * 1000).toLocaleTimeString('ru-RU') : 'Сейчас'}</td>
            `;
            table.appendChild(row);
        });
        
        if (onlineCount) onlineCount.textContent = result.users.length;
        if (adminsOnline) adminsOnline.textContent = adminCount;
    } else {
        table.innerHTML = `<tr><td colspan="5" style="color: red; text-align: center; padding: 20px;">Ошибка: ${result.error}</td></tr>`;
    }
}

async function addNewAdmin() {
    const adminData = {
        firstName: document.getElementById('admin-firstname')?.value.trim() || '',
        lastName: document.getElementById('admin-lastname')?.value.trim() || '',
        age: document.getElementById('admin-age')?.value || '',
        username: document.getElementById('admin-username')?.value.trim() || '',
        email: document.getElementById('admin-email')?.value.trim() || '',
        password: document.getElementById('admin-password')?.value || ''
    };
    
    // Базовая проверка
    if (!adminData.email || !FirebaseAuthService.isValidEmail(adminData.email)) {
        alert('Введите корректный email адрес');
        return;
    }
    
    if (!adminData.password || adminData.password.length < 6) {
        alert('Пароль должен содержать минимум 6 символов');
        return;
    }
    
    if (!adminData.firstName || adminData.firstName.length < 2) {
        alert('Имя должно содержать минимум 2 символа');
        return;
    }
    
    try {
        const result = await FirebaseAuthService.addAdmin(adminData);
        
        if (result.success) {
            alert('✅ Администратор успешно добавлен!');
            // Очищаем форму
            ['admin-firstname', 'admin-lastname', 'admin-age', 'admin-username', 'admin-email', 'admin-password'].forEach(id => {
                const element = document.getElementById(id);
                if (element) element.value = '';
            });
            
            // Обновляем список
            loadAdmins();
            loadUsers();
        } else {
            alert(`❌ Ошибка: ${result.error}`);
        }
    } catch (error) {
        alert(`❌ Ошибка: ${error.message}`);
    }
}

function goToMainApp() {
    redirectToMain();
}

async function logoutAdmin() {
    try {
        const result = await FirebaseAuthService.logout();
        if (result.success) {
            redirectToMain();
        } else {
            alert(`Ошибка при выходе: ${result.error}`);
        }
    } catch (error) {
        alert(`Ошибка при выходе: ${error.message}`);
    }
}

}
