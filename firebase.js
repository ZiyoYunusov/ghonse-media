// firebase.js - с улучшенной обработкой ошибок

// Конфигурация Firebase
const firebaseConfig = {
  apiKey: "AIzaSyBKCcDda45gUbsr-iNdMPQq_Bz7XE5evTQ",
  authDomain: "ghonse-media-site.firebaseapp.com",
  projectId: "ghonse-media-site",
  storageBucket: "ghonse-media-site.firebasestorage.app",
  messagingSenderId: "334804323154",
  appId: "1:334804323154:web:5f0784093e1630c798888b",
  measurementId: "G-B235F5YV98"
};

// Инициализация
let app, auth, db;

try {
    app = firebase.initializeApp(firebaseConfig);
    auth = firebase.auth();
    db = firebase.firestore();
    console.log("Firebase успешно инициализирован");
} catch (error) {
    console.error("Ошибка инициализации Firebase:", error);
}

// Класс для работы с аутентификацией
class FirebaseAuthService {
    
    // Валидация email
    static isValidEmail(email) {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return emailRegex.test(email);
    }
    
    // Валидация пароля
    static isValidPassword(password) {
        return password && password.length >= 6;
    }
    
    // Валидация данных пользователя
    static validateUserData(userData) {
        const errors = [];
        
        if (!userData.email || !this.isValidEmail(userData.email)) {
            errors.push("Введите корректный email адрес");
        }
        
        if (!userData.password || !this.isValidPassword(userData.password)) {
            errors.push("Пароль должен содержать минимум 6 символов");
        }
        
        if (!userData.firstName || userData.firstName.trim().length < 2) {
            errors.push("Имя должно содержать минимум 2 символа");
        }
        
        if (!userData.lastName || userData.lastName.trim().length < 2) {
            errors.push("Фамилия должна содержать минимум 2 символа");
        }
        
        if (!userData.age || userData.age < 1 || userData.age > 120) {
            errors.push("Введите корректный возраст (1-120 лет)");
        }
        
        if (!userData.username || userData.username.trim().length < 3) {
            errors.push("Логин должен содержать минимум 3 символа");
        }
        
        return errors;
    }
    
    // Регистрация пользователя
    static async registerUser(userData) {
        try {
            console.log("Начало регистрации пользователя:", userData.email);
            
            // Проверяем валидацию
            const validationErrors = this.validateUserData(userData);
            if (validationErrors.length > 0) {
                return { 
                    success: false, 
                    error: validationErrors.join(", ") 
                };
            }
            
            // Проверяем подтверждение пароля (если есть)
            if (userData.confirmPassword && userData.password !== userData.confirmPassword) {
                return { 
                    success: false, 
                    error: "Пароли не совпадают" 
                };
            }
            
            // Создаем пользователя в Firebase Auth
            const userCredential = await auth.createUserWithEmailAndPassword(
                userData.email.trim(),
                userData.password
            );
            const user = userCredential.user;
            
            console.log("Пользователь создан в Auth, ID:", user.uid);
            
            // Готовим данные для Firestore
            const userProfile = {
                email: userData.email.trim(),
                firstName: userData.firstName.trim(),
                lastName: userData.lastName.trim(),
                age: parseInt(userData.age),
                username: userData.username.trim(),
                role: 'user',
                createdAt: firebase.firestore.FieldValue.serverTimestamp(),
                isOnline: true,
                lastLogin: firebase.firestore.FieldValue.serverTimestamp()
            };
            
            // Сохраняем в Firestore
            await db.collection('users').doc(user.uid).set(userProfile);
            console.log("Данные сохранены в Firestore");
            
            // Автоматически логиним пользователя после регистрации
            await auth.signInWithEmailAndPassword(userData.email, userData.password);
            
            return { 
                success: true, 
                user: user,
                userData: userProfile
            };
            
        } catch (error) {
            console.error("Ошибка регистрации:", error);
            let errorMessage = "Произошла ошибка при регистрации";
            
            // Переводим ошибки Firebase на русский
            switch(error.code) {
                case 'auth/email-already-in-use':
                    errorMessage = "Этот email уже используется";
                    break;
                case 'auth/invalid-email':
                    errorMessage = "Неверный формат email адреса";
                    break;
                case 'auth/operation-not-allowed':
                    errorMessage = "Регистрация по email отключена";
                    break;
                case 'auth/weak-password':
                    errorMessage = "Пароль слишком слабый";
                    break;
                default:
                    errorMessage = error.message;
            }
            
            return { 
                success: false, 
                error: errorMessage 
            };
        }
    }
    
    // Вход пользователя
    static async loginUser(email, password) {
        try {
            console.log("Попытка входа:", email);
            
            // Базовая валидация
            if (!email || !this.isValidEmail(email)) {
                return { 
                    success: false, 
                    error: "Введите корректный email адрес" 
                };
            }
            
            if (!password || !this.isValidPassword(password)) {
                return { 
                    success: false, 
                    error: "Введите пароль (минимум 6 символов)" 
                };
            }
            
            const userCredential = await auth.signInWithEmailAndPassword(
                email.trim(),
                password
            );
            const user = userCredential.user;
            
            console.log("Успешный вход, ID пользователя:", user.uid);
            
            // Обновляем статус онлайн и время последнего входа
            await db.collection('users').doc(user.uid).update({
                isOnline: true,
                lastLogin: firebase.firestore.FieldValue.serverTimestamp()
            });
            
            return { 
                success: true, 
                user: user 
            };
            
        } catch (error) {
            console.error("Ошибка входа:", error);
            let errorMessage = "Произошла ошибка при входе";
            
            // Переводим ошибки Firebase на русский
            switch(error.code) {
                case 'auth/user-not-found':
                    errorMessage = "Пользователь с таким email не найден";
                    break;
                case 'auth/wrong-password':
                    errorMessage = "Неверный пароль";
                    break;
                case 'auth/invalid-email':
                    errorMessage = "Неверный формат email адреса";
                    break;
                case 'auth/user-disabled':
                    errorMessage = "Аккаунт отключен";
                    break;
                case 'auth/too-many-requests':
                    errorMessage = "Слишком много попыток. Попробуйте позже";
                    break;
                default:
                    errorMessage = error.message;
            }
            
            return { 
                success: false, 
                error: errorMessage 
            };
        }
    }
    
    // Выход из системы
    static async logout() {
        try {
            const user = auth.currentUser;
            if (user) {
                // Обновляем статус оффлайн
                await db.collection('users').doc(user.uid).update({
                    isOnline: false,
                    lastLogout: firebase.firestore.FieldValue.serverTimestamp()
                });
            }
            await auth.signOut();
            return { success: true };
        } catch (error) {
            console.error("Ошибка выхода:", error);
            return { 
                success: false, 
                error: error.message 
            };
        }
    }
    
    // Получение текущего пользователя
    static getCurrentUser() {
        return auth.currentUser;
    }
    
    // Получение данных пользователя из Firestore
    static async getUserData(uid) {
        try {
            const doc = await db.collection('users').doc(uid).get();
            if (doc.exists) {
                return { 
                    success: true, 
                    data: doc.data() 
                };
            } else {
                return { 
                    success: false, 
                    error: "Пользователь не найден" 
                };
            }
        } catch (error) {
            console.error("Ошибка получения данных пользователя:", error);
            return { 
                success: false, 
                error: error.message 
            };
        }
    }
    
    // Проверка, является ли пользователь админом
    static async isUserAdmin(uid) {
        try {
            const doc = await db.collection('users').doc(uid).get();
            if (doc.exists) {
                const data = doc.data();
                // Автоматически делаем админом пользователя с указанным email
                if (data.email === 'ziyoyunusov27@gmail.com') {
                    // Обновляем роль если еще не админ
                    if (data.role !== 'admin') {
                        await db.collection('users').doc(uid).update({
                            role: 'admin'
                        });
                    }
                    return true;
                }
                return data.role === 'admin';
            }
            return false;
        } catch (error) {
            console.error("Ошибка проверки прав администратора:", error);
            return false;
        }
    }
    
    // Добавление администратора
    static async addAdmin(adminData) {
        try {
            console.log("Добавление администратора:", adminData.email);
            
            // Валидация данных
            const validationErrors = this.validateUserData(adminData);
            if (validationErrors.length > 0) {
                return { 
                    success: false, 
                    error: validationErrors.join(", ") 
                };
            }
            
            // Создаем пользователя
            const userCredential = await auth.createUserWithEmailAndPassword(
                adminData.email.trim(),
                adminData.password
            );
            
            // Сохраняем с ролью админа
            await db.collection('users').doc(userCredential.user.uid).set({
                email: adminData.email.trim(),
                firstName: adminData.firstName.trim(),
                lastName: adminData.lastName.trim(),
                age: parseInt(adminData.age),
                username: adminData.username.trim(),
                role: 'admin',
                createdAt: firebase.firestore.FieldValue.serverTimestamp(),
                isOnline: true,
                addedBy: this.getCurrentUser().uid
            });
            
            console.log("Администратор добавлен:", adminData.email);
            return { success: true };
            
        } catch (error) {
            console.error("Ошибка добавления администратора:", error);
            let errorMessage = "Произошла ошибка при добавлении администратора";
            
            switch(error.code) {
                case 'auth/email-already-in-use':
                    errorMessage = "Этот email уже используется";
                    break;
                case 'auth/invalid-email':
                    errorMessage = "Неверный формат email адреса";
                    break;
                default:
                    errorMessage = error.message;
            }
            
            return { 
                success: false, 
                error: errorMessage 
            };
        }
    }
    
    // Получение всех пользователей
    static async getAllUsers() {
        try {
            const snapshot = await db.collection('users').get();
            const users = [];
            snapshot.forEach(doc => {
                users.push({
                    id: doc.id,
                    ...doc.data()
                });
            });
            return { 
                success: true, 
                users: users 
            };
        } catch (error) {
            console.error("Ошибка получения пользователей:", error);
            return { 
                success: false, 
                error: error.message 
            };
        }
    }
    
    // Получение онлайн пользователей
    static async getOnlineUsers() {
        try {
            const snapshot = await db.collection('users').where('isOnline', '==', true).get();
            const users = [];
            snapshot.forEach(doc => {
                users.push({
                    id: doc.id,
                    ...doc.data()
                });
            });
            return { 
                success: true, 
                users: users 
            };
        } catch (error) {
            console.error("Ошибка получения онлайн пользователей:", error);
            return { 
                success: false, 
                error: error.message 
            };
        }
    }
    
    // Слушатель изменения состояния аутентификации
    static onAuthStateChanged(callback) {
        return auth.onAuthStateChanged(callback);
    }
}

// Экспорт для использования в других файлах
window.FirebaseAuthService = FirebaseAuthService;
window.firebaseApp = app;
window.firebaseAuth = auth;
window.firebaseDb = db;