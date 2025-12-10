// admin-panel.js - с улучшенной обработкой ошибок

document.addEventListener('DOMContentLoaded', function() {
    // Проверка доступа к админ-панели
    checkAdminAccess();
});

async function checkAdminAccess() {
    const user = FirebaseAuthService.getCurrentUser();
    
    if (!user) {
        redirectToMain();
        return;
    }
    
    const isAdmin = await FirebaseAuthService.isUserAdmin(user.uid);
    
    if (!isAdmin) {
        alert("❌ Доступ запрещен! Требуются права администратора.");
        redirectToMain();
        return;
    }
    
    // Загружаем данные пользователя
    const userData = await FirebaseAuthService.getUserData(user.uid);
    if (userData.success) {
        const adminGreeting = document.getElementById('admin-greeting');
        if (adminGreeting) {
            adminGreeting.textContent = `Админ: ${userData.data.firstName} ${userData.data.lastName}`;
        }
    }
    
    // Загружаем данные для админ-панели
    loadUsers();
    loadAdmins();
    loadOnlineUsers();
    
    // Обновляем онлайн пользователей каждые 30 секунд
    setInterval(loadOnlineUsers, 30000);
}

function redirectToMain() {
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
    
    table.innerHTML = '<tr><td colspan="7">Загрузка...</td></tr>';
    
    const result = await FirebaseAuthService.getAllUsers();
    
    if (result.success) {
        if (result.users.length === 0) {
            table.innerHTML = '<tr><td colspan="7">Нет пользователей</td></tr>';
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
        table.innerHTML = `<tr><td colspan="7" style="color: red;">Ошибка: ${result.error}</td></tr>`;
    }
}

async function loadAdmins() {
    const table = document.getElementById('admins-table');
    if (!table) return;
    
    table.innerHTML = '<tr><td colspan="6">Загрузка...</td></tr>';
    
    const result = await FirebaseAuthService.getAllUsers();
    
    if (result.success) {
        const admins = result.users.filter(user => user.role === 'admin');
        
        if (admins.length === 0) {
            table.innerHTML = '<tr><td colspan="6">Нет администраторов</td></tr>';
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
        table.innerHTML = `<tr><td colspan="6" style="color: red;">Ошибка: ${result.error}</td></tr>`;
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
            table.innerHTML = '<tr><td colspan="5">Нет пользователей онлайн</td></tr>';
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
        table.innerHTML = `<tr><td colspan="5" style="color: red;">Ошибка: ${result.error}</td></tr>`;
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
}

function goToMainApp() {
    window.location.href = 'index.html';
}

async function logoutAdmin() {
    const result = await FirebaseAuthService.logout();
    if (result.success) {
        window.location.href = 'index.html';
    } else {
        alert(`Ошибка при выходе: ${result.error}`);
    }
}