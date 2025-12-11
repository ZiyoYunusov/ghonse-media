// firebase.js - ПОЛНОСТЬЮ РАБОЧАЯ ВЕРСИЯ

const firebaseConfig = {
    apiKey: "AIzaSyBKCcDda45gUbsr-iNdMPQq_Bz7XE5evTQ",
    authDomain: "ghonse-media-site.firebaseapp.com",
    projectId: "ghonse-media-site",
    storageBucket: "ghonse-media-site.firebasestorage.app",
    messagingSenderId: "334804323154",
    appId: "1:334804323154:web:5f0784093e1630c798888b"
};

let app, auth, db;

try {
    if (!firebase.apps.length) {
        app = firebase.initializeApp(firebaseConfig);
    } else {
        app = firebase.app();
    }
    
    auth = firebase.auth();
    db = firebase.firestore();
    
    auth.setPersistence(firebase.auth.Auth.Persistence.LOCAL);
    console.log("✅ Firebase успешно подключен");
} catch (error) {
    console.error("❌ Ошибка Firebase:", error);
    alert("Ошибка подключения к Firebase. Проверьте консоль.");
}

class FirebaseAuthService {
    
    // Проверка валидности email
    static isValidEmail(email) {
        if (!email) return false;
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return emailRegex.test(email.trim());
    }
    
    // Проверка пароля
    static isValidPassword(password) {
        return password && password.length >= 6;
    }
    
    // Санитизация ввода
    static sanitizeInput(input) {
        if (typeof input !== 'string') return '';
        return input.trim().replace(/[<>]/g, '');
    }
    
    // Регистрация
    static async registerUser(userData) {
        try {
            console.log("📝 Регистрация пользователя:", userData.email);
            
            // Валидация
            if (!userData.email || !this.isValidEmail(userData.email)) {
                return { 
                    success: false, 
                    error: "Некорректный email адрес. Пример: user@example.com" 
                };
            }
            
            if (!this.isValidPassword(userData.password)) {
                return { 
                    success: false, 
                    error: "Пароль должен быть минимум 6 символов" 
                };
            }
            
            if (userData.password !== userData.confirmPassword) {
                return { 
                    success: false, 
                    error: "Пароли не совпадают" 
                };
            }
            
            if (!userData.firstName || userData.firstName.trim().length < 2) {
                return { 
                    success: false, 
                    error: "Имя должно содержать минимум 2 символа" 
                };
            }
            
            // Санитизация данных
            const sanitizedData = {
                email: this.sanitizeInput(userData.email).toLowerCase(),
                firstName: this.sanitizeInput(userData.firstName),
                lastName: this.sanitizeInput(userData.lastName),
                username: this.sanitizeInput(userData.username),
                age: parseInt(userData.age) || 0
            };
            
            // Создание пользователя в Firebase Auth
            const userCredential = await auth.createUserWithEmailAndPassword(
                sanitizedData.email,
                userData.password
            );
            
            const user = userCredential.user;
            
            console.log("✅ Пользователь создан в Auth:", user.uid);
            
            // Сохранение в Firestore
            await db.collection('users').doc(user.uid).set({
                uid: user.uid,
                email: sanitizedData.email,
                firstName: sanitizedData.firstName,
                lastName: sanitizedData.lastName,
                username: sanitizedData.username,
                age: sanitizedData.age,
                role: 'user',
                createdAt: firebase.firestore.FieldValue.serverTimestamp(),
                isOnline: true,
                lastLogin: firebase.firestore.FieldValue.serverTimestamp()
            });
            
            console.log("✅ Данные сохранены в Firestore");
            
            return { 
                success: true, 
                user: user,
                message: "Регистрация успешна!" 
            };
            
        } catch (error) {
            console.error("❌ Ошибка регистрации:", error.code, error.message);
            
            let errorMessage = "Ошибка регистрации";
            switch(error.code) {
                case 'auth/email-already-in-use':
                    errorMessage = "Этот email уже используется";
                    break;
                case 'auth/invalid-email':
                    errorMessage = "Неправильный формат email";
                    break;
                case 'auth/weak-password':
                    errorMessage = "Пароль слишком простой";
                    break;
                case 'auth/operation-not-allowed':
                    errorMessage = "Регистрация отключена";
                    break;
                default:
                    errorMessage = error.message || "Неизвестная ошибка";
            }
            
            return { 
                success: false, 
                error: errorMessage 
            };
        }
    }
    
    // Вход
    static async loginUser(email, password) {
        try {
            console.log("🔐 Попытка входа:", email);
            
            if (!email || !this.isValidEmail(email)) {
                return { 
                    success: false, 
                    error: "Некорректный email адрес" 
                };
            }
            
            if (!password || password.length < 6) {
                return { 
                    success: false, 
                    error: "Пароль должен быть минимум 6 символов" 
                };
            }
            
            const sanitizedEmail = this.sanitizeInput(email).toLowerCase();
            
            // Вход через Firebase Auth
            const userCredential = await auth.signInWithEmailAndPassword(
                sanitizedEmail,
                password
            );
            
            const user = userCredential.user;
            
            console.log("✅ Успешный вход:", user.uid);
            
            // Обновляем статус онлайн
            try {
                await db.collection('users').doc(user.uid).update({
                    isOnline: true,
                    lastLogin: firebase.firestore.FieldValue.serverTimestamp()
                });
                console.log("✅ Статус онлайн обновлен");
            } catch (firestoreError) {
                console.warn("⚠️ Не удалось обновить статус:", firestoreError);
                // Не прерываем вход из-за этой ошибки
            }
            
            return { 
                success: true, 
                user: user,
                message: "Вход успешен!" 
            };
            
        } catch (error) {
            console.error("❌ Ошибка входа:", error.code, error.message);
            
            let errorMessage = "Ошибка входа";
            switch(error.code) {
                case 'auth/user-not-found':
                    errorMessage = "Пользователь с таким email не найден";
                    break;
                case 'auth/wrong-password':
                    errorMessage = "Неправильный пароль";
                    break;
                case 'auth/invalid-email':
                    errorMessage = "Некорректный email";
                    break;
                case 'auth/too-many-requests':
                    errorMessage = "Слишком много попыток. Попробуйте позже";
                    break;
                case 'auth/user-disabled':
                    errorMessage = "Аккаунт отключен";
                    break;
                default:
                    errorMessage = error.message || "Неизвестная ошибка";
            }
            
            return { 
                success: false, 
                error: errorMessage 
            };
        }
    }
    
    // Выход
    static async logout() {
        try {
            const user = auth.currentUser;
            if (user) {
                try {
                    await db.collection('users').doc(user.uid).update({
                        isOnline: false,
                        lastLogout: firebase.firestore.FieldValue.serverTimestamp()
                    });
                    console.log("✅ Статус оффлайн установлен");
                } catch (error) {
                    console.warn("⚠️ Не удалось обновить статус:", error);
                }
            }
            
            await auth.signOut();
            console.log("✅ Выход выполнен");
            return { success: true };
            
        } catch (error) {
            console.error("❌ Ошибка выхода:", error);
            return { 
                success: false, 
                error: error.message 
            };
        }
    }
    
    // Получить текущего пользователя
    static getCurrentUser() {
        return auth.currentUser;
    }
    
    // Получить данные пользователя
    static async getUserData(uid) {
        try {
            console.log("📊 Получение данных для UID:", uid);
            const doc = await db.collection('users').doc(uid).get();
            
            if (doc.exists) {
                const data = doc.data();
                console.log("✅ Данные получены:", data.email);
                return { 
                    success: true, 
                    data: data 
                };
            } else {
                console.warn("⚠️ Документ пользователя не найден");
                return { 
                    success: false, 
                    error: "Данные пользователя не найдены" 
                };
            }
        } catch (error) {
            console.error("❌ Ошибка получения данных:", error);
            return { 
                success: false, 
                error: error.message 
            };
        }
    }
    
    // 🔥 ИСПРАВЛЕННЫЙ МЕТОД ПРОВЕРКИ АДМИНА
    static async isUserAdmin(uid) {
        try {
            console.log("👑 Проверка прав администратора для UID:", uid);
            
            if (!uid) {
                console.log("❌ Нет UID для проверки");
                return false;
            }
            
            // Проверяем существование документа
            const userRef = db.collection('users').doc(uid);
            const doc = await userRef.get();
            
            if (!doc.exists) {
                console.log("❌ Документ пользователя не найден");
                return false;
            }
            
            const data = doc.data();
            console.log("📄 Данные пользователя:", {
                email: data.email,
                role: data.role,
                firstName: data.firstName
            });
            
            // 🔥 АВТОМАТИЧЕСКОЕ НАЗНАЧЕНИЕ АДМИНА ПО EMAIL
            if (data.email && data.email.toLowerCase() === 'ziyoyunusov27@gmail.com') {
                console.log("👑 Обнаружен специальный email - назначаем админом");
                
                // Проверяем текущую роль
                if (data.role !== 'admin') {
                    console.log("🔄 Обновляем роль на 'admin'");
                    try {
                        await userRef.update({
                            role: 'admin',
                            updatedAt: firebase.firestore.FieldValue.serverTimestamp()
                        });
                        console.log("✅ Роль успешно обновлена на 'admin'");
                        return true;
                    } catch (updateError) {
                        console.error("❌ Ошибка обновления роли:", updateError);
                        // Возвращаем false в случае ошибки
                        return false;
                    }
                } else {
                    console.log("✅ Пользователь уже админ");
                    return true;
                }
            }
            
            // Проверка стандартной роли
            const isAdmin = data.role === 'admin';
            console.log("🎯 Роль пользователя:", data.role, "Админ:", isAdmin);
            
            return isAdmin;
            
        } catch (error) {
            console.error("🔥 Критическая ошибка проверки админа:", error);
            console.error("Стек ошибки:", error.stack);
            return false;
        }
    }
    
    // Добавить админа
    static async addAdmin(adminData) {
        try {
            const currentUser = this.getCurrentUser();
            if (!currentUser) {
                return { success: false, error: "Требуется авторизация" };
            }
            
            // Проверяем права текущего пользователя
            const isAdmin = await this.isUserAdmin(currentUser.uid);
            if (!isAdmin) {
                return { success: false, error: "Нет прав администратора" };
            }
            
            // Валидация данных
            if (!this.isValidEmail(adminData.email)) {
                return { success: false, error: "Некорректный email" };
            }
            
            if (!this.isValidPassword(adminData.password)) {
                return { success: false, error: "Пароль должен быть минимум 6 символов" };
            }
            
            // Санитизация
            const sanitizedData = {
                email: this.sanitizeInput(adminData.email).toLowerCase(),
                firstName: this.sanitizeInput(adminData.firstName),
                lastName: this.sanitizeInput(adminData.lastName),
                username: this.sanitizeInput(adminData.username),
                age: parseInt(adminData.age) || 0
            };
            
            // Создание нового пользователя
            const userCredential = await auth.createUserWithEmailAndPassword(
                sanitizedData.email,
                adminData.password
            );
            
            // Сохраняем с ролью админа
            await db.collection('users').doc(userCredential.user.uid).set({
                uid: userCredential.user.uid,
                email: sanitizedData.email,
                firstName: sanitizedData.firstName,
                lastName: sanitizedData.lastName,
                username: sanitizedData.username,
                age: sanitizedData.age,
                role: 'admin',
                createdAt: firebase.firestore.FieldValue.serverTimestamp(),
                isOnline: true,
                addedBy: currentUser.uid
            });
            
            console.log("✅ Админ добавлен:", userCredential.user.uid);
            return { success: true, message: "Администратор успешно добавлен" };
            
        } catch (error) {
            console.error("❌ Ошибка добавления админа:", error);
            
            let errorMessage = "Ошибка добавления администратора";
            if (error.code === 'auth/email-already-in-use') {
                errorMessage = "Этот email уже используется";
            }
            
            return { success: false, error: errorMessage };
        }
    }
    
    // Получить всех пользователей
    static async getAllUsers() {
        try {
            console.log("👥 Получение списка всех пользователей");
            const snapshot = await db.collection('users')
                .orderBy('createdAt', 'desc')
                .get();
            
            const users = [];
            snapshot.forEach(doc => {
                users.push({
                    id: doc.id,
                    ...doc.data()
                });
            });
            
            console.log("✅ Получено пользователей:", users.length);
            return { success: true, users: users };
            
        } catch (error) {
            console.error("❌ Ошибка получения пользователей:", error);
            return { 
                success: false, 
                error: error.message,
                users: [] 
            };
        }
    }
    
    // Получить онлайн пользователей
    static async getOnlineUsers() {
        try {
            console.log("🌐 Получение онлайн пользователей");
            
            // Пользователи онлайн за последние 5 минут
            const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
            
            const snapshot = await db.collection('users')
                .where('isOnline', '==', true)
                .where('lastLogin', '>', firebase.firestore.Timestamp.fromDate(fiveMinutesAgo))
                .get();
            
            const users = [];
            snapshot.forEach(doc => {
                users.push({
                    id: doc.id,
                    ...doc.data()
                });
            });
            
            console.log("✅ Онлайн пользователей:", users.length);
            return { success: true, users: users };
            
        } catch (error) {
            console.error("❌ Ошибка получения онлайн пользователей:", error);
            return { 
                success: false, 
                error: error.message,
                users: [] 
            };
        }
    }
    
    // Слушатель авторизации
    static onAuthStateChanged(callback) {
        return auth.onAuthStateChanged(callback);
    }
    
    // Проверка инициализации Firebase
    static isInitialized() {
        return !!app;
    }
}

// Экспорт для глобального использования
window.FirebaseAuthService = FirebaseAuthService;

// Автоматическая проверка при загрузке
setTimeout(() => {
    if (FirebaseAuthService.isInitialized()) {
        console.log("🚀 Firebase готов к использованию");
    } else {
        console.error("❌ Firebase не инициализирован");
    }
}, 1000);