import os
import json
import sqlite3
import random
from datetime import datetime
from functools import wraps
from werkzeug.security import generate_password_hash, check_password_hash
from werkzeug.utils import secure_filename
from flask import Flask, render_template, request, redirect, url_for, flash, jsonify, session, send_from_directory

# ========== НАСТРОЙКА ПРИЛОЖЕНИЯ ==========
app = Flask(__name__)
app.secret_key = 'dev-secret-key-change-in-production-for-real-project'
app.config['UPLOAD_FOLDER'] = 'uploads'
app.config['MAX_CONTENT_LENGTH'] = 10 * 1024 * 1024 * 1024  # 10GB


# Создаем необходимые папки
os.makedirs('uploads/videos', exist_ok=True)
os.makedirs('uploads/images', exist_ok=True)
os.makedirs('templates', exist_ok=True)
os.makedirs('static/css', exist_ok=True)
os.makedirs('static/js', exist_ok=True)


# ========== БАЗА ДАННЫХ ==========
def init_database():
    """Инициализация базы данных SQLite"""
    conn = sqlite3.connect('site.db')
    c = conn.cursor()

    # Таблица пользователей
    c.execute('''CREATE TABLE IF NOT EXISTS users
                 (id INTEGER PRIMARY KEY AUTOINCREMENT,
                  username TEXT UNIQUE NOT NULL,
                  email TEXT UNIQUE NOT NULL,
                  password TEXT NOT NULL,
                  role TEXT DEFAULT 'user',
                  is_banned INTEGER DEFAULT 0,
                  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP)''')

    # Таблица видео
    c.execute('''CREATE TABLE IF NOT EXISTS videos
                 (id INTEGER PRIMARY KEY AUTOINCREMENT,
                  title TEXT NOT NULL,
                  filename TEXT NOT NULL,
                  category TEXT,
                  description TEXT,
                  uploader_id INTEGER,
                  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP)''')

    # Таблица слов для игр
    c.execute('''CREATE TABLE IF NOT EXISTS game_words
                 (id INTEGER PRIMARY KEY AUTOINCREMENT,
                  word TEXT NOT NULL,
                  hint TEXT,
                  category TEXT DEFAULT 'general',
                  added_by INTEGER,
                  added_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP)''')

    # Таблица логов
    c.execute('''CREATE TABLE IF NOT EXISTS activity_logs
                 (id INTEGER PRIMARY KEY AUTOINCREMENT,
                  user_id INTEGER,
                  action TEXT,
                  details TEXT,
                  timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                  ip_address TEXT)''')

    # Добавляем администратора по умолчанию
    c.execute("SELECT * FROM users WHERE username='admin'")
    if not c.fetchone():
        admin_password = generate_password_hash('admin123')
        c.execute("INSERT INTO users (username, email, password, role) VALUES (?, ?, ?, ?)",
                  ('admin', 'admin@example.com', admin_password, 'admin'))

    # Добавляем начальные слова для игры
    c.execute("SELECT COUNT(*) FROM game_words")
    if c.fetchone()[0] == 0:
        initial_words = [
            ('ПИТОН', 'Язык программирования', 'программирование'),
            ('КОМПЬЮТЕР', 'Электронное устройство', 'технологии'),
            ('БИБЛИОТЕКА', 'Место с книгами', 'места'),
            ('СОЛНЦЕ', 'Звезда нашей системы', 'космос'),
            ('МОНИТОР', 'Устройство вывода', 'техника')
        ]
        c.executemany("INSERT INTO game_words (word, hint, category) VALUES (?, ?, ?)", initial_words)

    conn.commit()
    conn.close()


# Инициализируем БД при запуске
init_database()


# ========== ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ ==========
def get_db():
    """Получение соединения с БД"""
    conn = sqlite3.connect('site.db')
    conn.row_factory = sqlite3.Row
    return conn


def log_activity(user_id, action, details=""):
    """Логирование действий пользователей"""
    conn = get_db()
    c = conn.cursor()
    c.execute("INSERT INTO activity_logs (user_id, action, details, ip_address) VALUES (?, ?, ?, ?)",
              (user_id, action, details, request.remote_addr))
    conn.commit()
    conn.close()


def admin_required(f):
    """Декоратор для проверки прав администратора"""

    @wraps(f)
    def decorated_function(*args, **kwargs):
        if 'user_id' not in session or session.get('role') != 'admin':
            flash('Требуются права администратора!', 'danger')
            return redirect(url_for('login'))
        return f(*args, **kwargs)

    return decorated_function


def login_required(f):
    """Декоратор для проверки авторизации"""

    @wraps(f)
    def decorated_function(*args, **kwargs):
        if 'user_id' not in session:
            flash('Пожалуйста, войдите в систему!', 'warning')
            return redirect(url_for('login'))
        return f(*args, **kwargs)

    return decorated_function


# ========== HTML ШАБЛОНЫ ==========
def create_templates():
    """Создание HTML шаблонов"""

    # Основной layout
    base_html = '''<!DOCTYPE html>
<html lang="ru">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>{% block title %}Мультимедийная платформа{% endblock %}</title>
    <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.1.3/dist/css/bootstrap.min.css" rel="stylesheet">
    <style>
        body { padding-top: 70px; background-color: #f8f9fa; }
        .navbar-brand { font-weight: bold; }
        .app-section { margin-bottom: 30px; padding: 20px; background: white; border-radius: 10px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
        .video-card { margin-bottom: 20px; }
        .game-container { max-width: 600px; margin: 0 auto; }
        .word-display { font-size: 2em; letter-spacing: 10px; margin: 20px 0; }
        .hint { color: #666; font-style: italic; }
        .chat-message { padding: 10px; margin: 5px; border-radius: 5px; background: #e9ecef; }
        .admin-only { background-color: #fff3cd; border-left: 4px solid #ffc107; }
        .mobile-nav { display: none; }
        @media (max-width: 768px) {
            .desktop-nav { display: none; }
            .mobile-nav { display: flex; position: fixed; bottom: 0; left: 0; right: 0; background: white; padding: 10px; justify-content: space-around; box-shadow: 0 -2px 10px rgba(0,0,0,0.1); z-index: 1000; }
            body { padding-bottom: 70px; }
        }
    </style>
</head>
<body>
    <!-- Навигация для десктопа -->
    <nav class="navbar navbar-expand-lg navbar-dark bg-dark fixed-top desktop-nav">
        <div class="container">
            <a class="navbar-brand" href="/">МультиПлатформа</a>
            <div class="navbar-nav ms-auto">
                <a class="nav-link" href="/">Главная</a>
                <a class="nav-link" href="/movies">Кино</a>
                <a class="nav-link" href="/series">Сериалы</a>
                <a class="nav-link" href="/entertainment">Развлечения</a>
                <a class="nav-link" href="/chat">Чат с ИИ</a>
                <a class="nav-link" href="/help">Помощь</a>
                {% if 'user_id' in session %}
                    {% if session.role == 'admin' %}
                        <a class="nav-link text-warning" href="/admin">Админ-панель</a>
                    {% endif %}
                    <a class="nav-link" href="/profile">{{ session.username }}</a>
                    <a class="nav-link" href="/logout">Выйти</a>
                {% else %}
                    <a class="nav-link" href="/login">Войти</a>
                    <a class="nav-link" href="/register">Регистрация</a>
                {% endif %}
            </div>
        </div>
    </nav>

    <!-- Навигация для мобильных -->
    <div class="mobile-nav">
        <a href="/" class="text-center">
            <div>🏠</div>
            <small>Главная</small>
        </a>
        <a href="/movies" class="text-center">
            <div>🎬</div>
            <small>Кино</small>
        </a>
        <a href="/entertainment" class="text-center">
            <div>🎮</div>
            <small>Игры</small>
        </a>
        <a href="/chat" class="text-center">
            <div>🤖</div>
            <small>ИИ Чат</small>
        </a>
        {% if 'user_id' in session %}
            <a href="/profile" class="text-center">
                <div>👤</div>
                <small>Профиль</small>
            </a>
        {% else %}
            <a href="/login" class="text-center">
                <div>🔐</div>
                <small>Вход</small>
            </a>
        {% endif %}
    </div>

    <div class="container">
        {% with messages = get_flashed_messages(with_categories=true) %}
            {% if messages %}
                {% for category, message in messages %}
                    <div class="alert alert-{{ category if category != 'error' else 'danger' }} alert-dismissible fade show mt-3">
                        {{ message }}
                        <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
                    </div>
                {% endfor %}
            {% endif %}
        {% endwith %}

        {% block content %}{% endblock %}
    </div>

    <script src="https://cdn.jsdelivr.net/npm/bootstrap@5.1.3/dist/js/bootstrap.bundle.min.js"></script>
    {% block scripts %}{% endblock %}
</body>
</html>'''

    # Главная страница
    index_html = '''{% extends "base.html" %}
{% block title %}Главная - Мультимедийная платформа{% endblock %}
{% block content %}
<div class="row">
    <div class="col-md-8">
        <div class="app-section">
            <h2>Добро пожаловать, {% if 'username' in session %}{{ session.username }}{% else %}Гость{% endif %}!</h2>
            <p>Многофункциональная платформа для развлечений и общения</p>

            <div class="row mt-4">
                <div class="col-md-6">
                    <div class="card">
                        <div class="card-body">
                            <h5 class="card-title">🎬 Кино и сериалы</h5>
                            <p class="card-text">Смотрите фильмы и сериалы в высоком качестве</p>
                            <a href="/movies" class="btn btn-primary">Перейти</a>
                        </div>
                    </div>
                </div>
                <div class="col-md-6">
                    <div class="card">
                        <div class="card-body">
                            <h5 class="card-title">🎮 Развлечения</h5>
                            <p class="card-text">Игры: Крестики-нолики, Угадай слово и другие</p>
                            <a href="/entertainment" class="btn btn-success">Играть</a>
                        </div>
                    </div>
                </div>
            </div>

            <div class="row mt-4">
                <div class="col-md-6">
                    <div class="card">
                        <div class="card-body">
                            <h5 class="card-title">🤖 Чат с ИИ</h5>
                            <p class="card-text">Общайтесь с искусственным интеллектом</p>
                            <a href="/chat" class="btn btn-info">Чат</a>
                        </div>
                    </div>
                </div>
                <div class="col-md-6">
                    <div class="card">
                        <div class="card-body">
                            <h5 class="card-title">🆘 Помощь</h5>
                            <p class="card-text">Помощь и поддержка от администраторов</p>
                            <a href="/help" class="btn btn-warning">Помощь</a>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    </div>

    <div class="col-md-4">
        <div class="app-section">
            <h4>Новости платформы</h4>
            <ul class="list-group">
                <li class="list-group-item">Добавлены новые игры</li>
                <li class="list-group-item">Обновлен раздел кино</li>
                <li class="list-group-item">Улучшен ИИ-чат</li>
                <li class="list-group-item">Мобильная версия доступна</li>
            </ul>
        </div>

        <div class="app-section mt-3">
            <h4>Статистика</h4>
            <p>Пользователей онлайн: <strong>42</strong></p>
            <p>Всего фильмов: <strong>156</strong></p>
            <p>Активных игр: <strong>23</strong></p>
        </div>
    </div>
</div>
{% endblock %}'''

    # Страница входа
    login_html = '''{% extends "base.html" %}
{% block title %}Вход в систему{% endblock %}
{% block content %}
<div class="row justify-content-center">
    <div class="col-md-6">
        <div class="app-section">
            <h2 class="text-center">Вход в систему</h2>
            <form method="POST" action="/login">
                <div class="mb-3">
                    <label for="username" class="form-label">Имя пользователя</label>
                    <input type="text" class="form-control" id="username" name="username" required>
                </div>
                <div class="mb-3">
                    <label for="password" class="form-label">Пароль</label>
                    <input type="password" class="form-control" id="password" name="password" required>
                </div>
                <div class="d-grid gap-2">
                    <button type="submit" class="btn btn-primary">Войти</button>
                    <a href="/register" class="btn btn-link">Нет аккаунта? Зарегистрироваться</a>
                </div>
            </form>
        </div>
    </div>
</div>
{% endblock %}'''

    # Страница регистрации
    register_html = '''{% extends "base.html" %}
{% block title %}Регистрация{% endblock %}
{% block content %}
<div class="row justify-content-center">
    <div class="col-md-6">
        <div class="app-section">
            <h2 class="text-center">Регистрация</h2>
            <form method="POST" action="/register">
                <div class="mb-3">
                    <label for="username" class="form-label">Имя пользователя</label>
                    <input type="text" class="form-control" id="username" name="username" required minlength="3">
                </div>
                <div class="mb-3">
                    <label for="email" class="form-label">Email</label>
                    <input type="email" class="form-control" id="email" name="email" required>
                </div>
                <div class="mb-3">
                    <label for="password" class="form-label">Пароль</label>
                    <input type="password" class="form-control" id="password" name="password" required minlength="6">
                </div>
                <div class="mb-3">
                    <label for="confirm_password" class="form-label">Подтвердите пароль</label>
                    <input type="password" class="form-control" id="confirm_password" name="confirm_password" required>
                </div>
                <div class="d-grid gap-2">
                    <button type="submit" class="btn btn-success">Зарегистрироваться</button>
                    <a href="/login" class="btn btn-link">Уже есть аккаунт? Войти</a>
                </div>
            </form>
        </div>
    </div>
</div>
{% endblock %}'''

    # Страница кино
    movies_html = '''{% extends "base.html" %}
{% block title %}Кино{% endblock %}
{% block content %}
<div class="app-section">
    <h2>🎬 Фильмы и сериалы</h2>

    {% if session.role == 'admin' %}
    <div class="admin-only p-3 mb-4">
        <h5>Панель администратора (управление видео)</h5>
        <form method="POST" action="/admin/upload_video" enctype="multipart/form-data" class="row g-3">
            <div class="col-md-4">
                <input type="text" class="form-control" name="title" placeholder="Название" required>
            </div>
            <div class="col-md-3">
                <select class="form-select" name="category">
                    <option value="movie">Фильм</option>
                    <option value="series">Сериал</option>
                    <option value="cartoon">Мультфильм</option>
                </select>
            </div>
            <div class="col-md-3">
                <input type="file" class="form-control" name="video_file" accept="video/*" required>
            </div>
            <div class="col-md-2">
                <button type="submit" class="btn btn-primary w-100">Загрузить</button>
            </div>
        </form>
    </div>
    {% endif %}

    <div class="row">
        {% for video in videos %}
        <div class="col-md-4 video-card">
            <div class="card">
                <div class="card-body">
                    <h5 class="card-title">{{ video.title }}</h5>
                    <p class="card-text">
                        <small class="text-muted">
                            {{ video.category }} • {{ video.created_at[:10] }}
                        </small>
                    </p>
                    <video width="100%" controls>
                        <source src="/uploads/videos/{{ video.filename }}" type="video/mp4">
                        Ваш браузер не поддерживает видео.
                    </video>
                    {% if session.role == 'admin' %}
                    <div class="mt-2">
                        <a href="/admin/delete_video/{{ video.id }}" class="btn btn-sm btn-danger" 
                           onclick="return confirm('Удалить видео?')">Удалить</a>
                    </div>
                    {% endif %}
                </div>
            </div>
        </div>
        {% endfor %}
    </div>
</div>
{% endblock %}'''

    # Страница игр
    entertainment_html = '''{% extends "base.html" %}
{% block title %}Развлечения{% endblock %}
{% block content %}
<div class="app-section">
    <h2>🎮 Развлечения и игры</h2>

    <ul class="nav nav-tabs" id="gamesTab" role="tablist">
        <li class="nav-item" role="presentation">
            <button class="nav-link active" id="tictactoe-tab" data-bs-toggle="tab" data-bs-target="#tictactoe" type="button">Крестики-нолики</button>
        </li>
        <li class="nav-item" role="presentation">
            <button class="nav-link" id="wordguess-tab" data-bs-toggle="tab" data-bs-target="#wordguess" type="button">Угадай слово</button>
        </li>
        <li class="nav-item" role="presentation">
            <button class="nav-link" id="phrase-tab" data-bs-toggle="tab" data-bs-target="#phrase" type="button">Продолжи фразу</button>
        </li>
    </ul>

    <div class="tab-content mt-3" id="gamesTabContent">
        <!-- Крестики-нолики -->
        <div class="tab-pane fade show active" id="tictactoe" role="tabpanel">
            <div class="game-container">
                <h4>Крестики-нолики</h4>
                <div id="ticTacToeBoard" class="text-center">
                    <div class="row mb-2">
                        <div class="col-4 border p-5 display-6 cell" data-cell="0"> </div>
                        <div class="col-4 border p-5 display-6 cell" data-cell="1"> </div>
                        <div class="col-4 border p-5 display-6 cell" data-cell="2"> </div>
                    </div>
                    <div class="row mb-2">
                        <div class="col-4 border p-5 display-6 cell" data-cell="3"> </div>
                        <div class="col-4 border p-5 display-6 cell" data-cell="4"> </div>
                        <div class="col-4 border p-5 display-6 cell" data-cell="5"> </div>
                    </div>
                    <div class="row">
                        <div class="col-4 border p-5 display-6 cell" data-cell="6"> </div>
                        <div class="col-4 border p-5 display-6 cell" data-cell="7"> </div>
                        <div class="col-4 border p-5 display-6 cell" data-cell="8"> </div>
                    </div>
                </div>
                <div class="mt-3">
                    <button id="resetTicTacToe" class="btn btn-secondary">Новая игра</button>
                    <div id="ticTacToeStatus" class="mt-2"></div>
                </div>
            </div>
        </div>

        <!-- Угадай слово -->
        <div class="tab-pane fade" id="wordguess" role="tabpanel">
            <div class="game-container">
                <h4>Угадай слово</h4>
                <div id="wordDisplay" class="word-display text-center"></div>
                <div id="hint" class="hint text-center mb-3"></div>
                <div class="input-group mb-3">
                    <input type="text" id="guessInput" class="form-control" placeholder="Введите букву или слово">
                    <button id="guessButton" class="btn btn-primary">Угадать</button>
                </div>
                <div>
                    <button id="newWordButton" class="btn btn-success">Новое слово</button>
                    <button id="getHintButton" class="btn btn-info">Подсказка</button>
                </div>
                <div id="guessedLetters" class="mt-3">
                    <p>Использованные буквы: <span id="usedLetters"></span></p>
                    <p>Осталось попыток: <span id="attemptsLeft">6</span></p>
                </div>
            </div>
        </div>

        <!-- Продолжи фразу -->
        <div class="tab-pane fade" id="phrase" role="tabpanel">
            <div class="game-container">
                <h4>Продолжи фразу</h4>
                <div id="phraseStart" class="alert alert-info"></div>
                <div class="mb-3">
                    <input type="text" id="phraseInput" class="form-control" placeholder="Продолжите фразу...">
                </div>
                <button id="checkPhrase" class="btn btn-primary">Проверить</button>
                <button id="newPhrase" class="btn btn-secondary">Новая фраза</button>
                <div id="phraseResult" class="mt-3"></div>
            </div>
        </div>
    </div>

    {% if session.role == 'admin' %}
    <div class="admin-only p-3 mt-4">
        <h5>Управление словами для игр (админ)</h5>
        <form id="addWordForm" class="row g-3">
            <div class="col-md-4">
                <input type="text" class="form-control" id="newWord" placeholder="Новое слово" required>
            </div>
            <div class="col-md-4">
                <input type="text" class="form-control" id="newHint" placeholder="Подсказка">
            </div>
            <div class="col-md-3">
                <input type="text" class="form-control" id="newCategory" placeholder="Категория" value="general">
            </div>
            <div class="col-md-1">
                <button type="submit" class="btn btn-success w-100">+</button>
            </div>
        </form>
    </div>
    {% endif %}
</div>

<script>
// Крестики-нолики
let currentPlayer = 'X';
let gameActive = true;
let gameState = ['', '', '', '', '', '', '', '', ''];

const winningConditions = [
    [0, 1, 2], [3, 4, 5], [6, 7, 8], // горизонтали
    [0, 3, 6], [1, 4, 7], [2, 5, 8], // вертикали
    [0, 4, 8], [2, 4, 6] // диагонали
];

document.querySelectorAll('.cell').forEach(cell => {
    cell.addEventListener('click', function() {
        const cellIndex = parseInt(this.getAttribute('data-cell'));

        if (gameState[cellIndex] !== '' || !gameActive) return;

        gameState[cellIndex] = currentPlayer;
        this.textContent = currentPlayer;
        this.classList.add(currentPlayer === 'X' ? 'text-primary' : 'text-danger');

        checkWinner();

        currentPlayer = currentPlayer === 'X' ? 'O' : 'X';
    });
});

function checkWinner() {
    let roundWon = false;

    for (let i = 0; i < winningConditions.length; i++) {
        const [a, b, c] = winningConditions[i];
        if (gameState[a] && gameState[a] === gameState[b] && gameState[a] === gameState[c]) {
            roundWon = true;
            break;
        }
    }

    if (roundWon) {
        document.getElementById('ticTacToeStatus').innerHTML = 
            `<div class="alert alert-success">Игрок ${currentPlayer} победил!</div>`;
        gameActive = false;
        return;
    }

    if (!gameState.includes('')) {
        document.getElementById('ticTacToeStatus').innerHTML = 
            `<div class="alert alert-info">Ничья!</div>`;
        gameActive = false;
    }
}

document.getElementById('resetTicTacToe').addEventListener('click', function() {
    gameState = ['', '', '', '', '', '', '', '', ''];
    gameActive = true;
    currentPlayer = 'X';
    document.querySelectorAll('.cell').forEach(cell => {
        cell.textContent = '';
        cell.classList.remove('text-primary', 'text-danger');
    });
    document.getElementById('ticTacToeStatus').innerHTML = '';
});

// Угадай слово
let currentWord = '';
let hiddenWord = '';
let usedLetters = [];
let attempts = 6;

async function startWordGame() {
    const response = await fetch('/api/get_random_word');
    const data = await response.json();
    currentWord = data.word.toUpperCase();
    hiddenWord = '_ '.repeat(currentWord.length).trim().split(' ');
    usedLetters = [];
    attempts = 6;

    updateWordDisplay();
    document.getElementById('hint').textContent = 'Подсказка: ' + data.hint;
    document.getElementById('attemptsLeft').textContent = attempts;
    document.getElementById('usedLetters').textContent = '';
    document.getElementById('guessInput').value = '';
}

function updateWordDisplay() {
    document.getElementById('wordDisplay').textContent = hiddenWord.join(' ');
}

document.getElementById('newWordButton').addEventListener('click', startWordGame);
document.getElementById('getHintButton').addEventListener('click', function() {
    alert('Подсказка: ' + document.getElementById('hint').textContent);
});

document.getElementById('guessButton').addEventListener('click', function() {
    const input = document.getElementById('guessInput').value.toUpperCase();
    if (!input) return;

    if (input.length === 1) {
        // Угадывание буквы
        if (usedLetters.includes(input)) {
            alert('Эта буква уже использовалась!');
            return;
        }

        usedLetters.push(input);
        document.getElementById('usedLetters').textContent = usedLetters.join(', ');

        let found = false;
        for (let i = 0; i < currentWord.length; i++) {
            if (currentWord[i] === input) {
                hiddenWord[i] = input;
                found = true;
            }
        }

        if (!found) {
            attempts--;
            document.getElementById('attemptsLeft').textContent = attempts;
        }

        updateWordDisplay();

        if (!hiddenWord.includes('_')) {
            setTimeout(() => alert('Поздравляем! Вы угадали слово: ' + currentWord), 100);
        } else if (attempts <= 0) {
            setTimeout(() => alert('Игра окончена! Слово было: ' + currentWord), 100);
        }
    } else {
        // Угадывание всего слова
        if (input === currentWord) {
            hiddenWord = currentWord.split('');
            updateWordDisplay();
            setTimeout(() => alert('Поздравляем! Вы угадали слово!'), 100);
        } else {
            attempts--;
            document.getElementById('attemptsLeft').textContent = attempts;
            if (attempts <= 0) {
                setTimeout(() => alert('Игра окончена! Слово было: ' + currentWord), 100);
            }
        }
    }

    document.getElementById('guessInput').value = '';
});

// Продолжи фразу
const phrases = [
    ["Кто рано встает,", "тому Бог подает"],
    ["Без труда,", "не выловишь и рыбку из пруда"],
    ["Лучше синица в руках,", "чем журавль в небе"],
    ["Семь раз отмерь,", "один раз отрежь"]
];

let currentPhrase = [];

function newPhraseGame() {
    currentPhrase = phrases[Math.floor(Math.random() * phrases.length)];
    document.getElementById('phraseStart').textContent = currentPhrase[0];
    document.getElementById('phraseInput').value = '';
    document.getElementById('phraseResult').innerHTML = '';
}

document.getElementById('newPhrase').addEventListener('click', newPhraseGame);
document.getElementById('checkPhrase').addEventListener('click', function() {
    const userInput = document.getElementById('phraseInput').value.trim().toLowerCase();
    const correctAnswer = currentPhrase[1].toLowerCase();

    if (userInput === correctAnswer) {
        document.getElementById('phraseResult').innerHTML = 
            '<div class="alert alert-success">Правильно! ' + currentPhrase[0] + ' ' + currentPhrase[1] + '</div>';
    } else {
        document.getElementById('phraseResult').innerHTML = 
            '<div class="alert alert-danger">Неправильно. Правильный ответ: ' + currentPhrase[1] + '</div>';
    }
});

// Добавление нового слова (админ)
{% if session.role == 'admin' %}
document.getElementById('addWordForm').addEventListener('submit', async function(e) {
    e.preventDefault();

    const word = document.getElementById('newWord').value;
    const hint = document.getElementById('newHint').value;
    const category = document.getElementById('newCategory').value;

    const response = await fetch('/admin/add_word', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({word: word, hint: hint, category: category})
    });

    if (response.ok) {
        alert('Слово добавлено!');
        document.getElementById('addWordForm').reset();
    } else {
        alert('Ошибка при добавлении слова');
    }
});
{% endif %}

// Запуск игр при загрузке
window.onload = function() {
    startWordGame();
    newPhraseGame();
};
</script>
{% endblock %}'''

    # Чат с ИИ
    chat_html = '''{% extends "base.html" %}
{% block title %}Чат с ИИ{% endblock %}
{% block content %}
<div class="app-section">
    <h2>🤖 Чат с искусственным интеллектом</h2>

    <div class="row">
        <div class="col-md-8">
            <div id="chatContainer" style="height: 400px; overflow-y: auto; border: 1px solid #ddd; padding: 15px; border-radius: 5px; margin-bottom: 15px; background: #f9f9f9;">
                <div class="chat-message alert alert-info">
                    <strong>ИИ:</strong> Привет! Я ваш виртуальный помощник. Задайте мне любой вопрос!
                </div>
            </div>

            <div class="input-group">
                <input type="text" id="messageInput" class="form-control" placeholder="Введите ваше сообщение...">
                <button id="sendButton" class="btn btn-primary">Отправить</button>
            </div>

            <div class="mt-3">
                <button id="clearChat" class="btn btn-secondary">Очистить чат</button>
                <button id="suggestTopic" class="btn btn-info">Предложить тему</button>
            </div>
        </div>

        <div class="col-md-4">
            <div class="card">
                <div class="card-header">Темы для обсуждения</div>
                <div class="card-body">
                    <ul class="list-group list-group-flush">
                        <li class="list-group-item topic-item" data-topic="технологии">🤖 Технологии и ИИ</li>
                        <li class="list-group-item topic-item" data-topic="кино">🎬 Кино и сериалы</li>
                        <li class="list-group-item topic-item" data-topic="игры">🎮 Компьютерные игры</li>
                        <li class="list-group-item topic-item" data-topic="программирование">💻 Программирование</li>
                        <li class="list-group-item topic-item" data-topic="наука">🔬 Наука и образование</li>
                    </ul>
                </div>
            </div>
        </div>
    </div>
</div>

<script>
const chatContainer = document.getElementById('chatContainer');
const messageInput = document.getElementById('messageInput');
const sendButton = document.getElementById('sendButton');

// Ответы ИИ (можно подключить реальный API в будущем)
const aiResponses = {
    'технологии': ['Искусственный интеллект развивается очень быстро!', 'Нейросети меняют наш мир уже сегодня.', 'В будущем ИИ поможет решить многие проблемы человечества.'],
    'кино': ['Мой любимый фильм - "Матрица"!', 'Сериалы становятся все качественнее с каждым годом.', 'Рекомендую посмотреть "Игру в кальмара" если еще не видели.'],
    'игры': ['Игры отлично развивают реакцию и стратегическое мышление!', 'Любите играть в компьютерные игры?', 'Скоро выйдет много интересных новинок в игровой индустрии.'],
    'программирование': ['Python - отличный язык для начинающих!', 'Веб-разработка очень востребована сегодня.', 'Изучаете какой-нибудь язык программирования?'],
    'наука': ['Космос полон загадок!', 'Биотехнологии совершат революцию в медицине.', 'Наука не стоит на месте!'],
    'default': ['Интересный вопрос! Давайте поговорим об этом.', 'Я еще учусь, но постараюсь помочь.', 'Можете уточнить ваш вопрос?', 'Это хорошая тема для обсуждения!']
};

function addMessage(sender, message, isAI = false) {
    const messageDiv = document.createElement('div');
    messageDiv.className = `chat-message alert ${isAI ? 'alert-info' : 'alert-success'}`;
    messageDiv.innerHTML = `<strong>${sender}:</strong> ${message}`;
    chatContainer.appendChild(messageDiv);
    chatContainer.scrollTop = chatContainer.scrollHeight;
}

function getAIResponse(userMessage) {
    userMessage = userMessage.toLowerCase();

    // Проверка тем
    for (const [topic, responses] of Object.entries(aiResponses)) {
        if (topic !== 'default' && userMessage.includes(topic)) {
            return responses[Math.floor(Math.random() * responses.length)];
        }
    }

    // Ответы на приветствия
    if (userMessage.includes('привет') || userMessage.includes('здравств')) {
        return 'Привет! Рад вас видеть! Как ваши дела?';
    }

    if (userMessage.includes('как дела') || userMessage.includes('как ты')) {
        return 'У меня все отлично! Готов помочь вам с любыми вопросами!';
    }

    if (userMessage.includes('спасибо')) {
        return 'Пожалуйста! Всегда рад помочь!';
    }

    if (userMessage.includes('пока') || userMessage.includes('до свидан')) {
        return 'До свидания! Возвращайтесь еще!';
    }

    // Случайный ответ по умолчанию
    const defaultResponses = aiResponses.default;
    return defaultResponses[Math.floor(Math.random() * defaultResponses.length)];
}

sendButton.addEventListener('click', function() {
    const message = messageInput.value.trim();
    if (message) {
        addMessage('Вы', message);

        // Имитация задержки ответа ИИ
        setTimeout(() => {
            const aiResponse = getAIResponse(message);
            addMessage('ИИ', aiResponse, true);
        }, 500);

        messageInput.value = '';
    }
});

messageInput.addEventListener('keypress', function(e) {
    if (e.key === 'Enter') {
        sendButton.click();
    }
});

// Очистка чата
document.getElementById('clearChat').addEventListener('click', function() {
    chatContainer.innerHTML = '<div class="chat-message alert alert-info"><strong>ИИ:</strong> Привет! Я ваш виртуальный помощник. Задайте мне любой вопрос!</div>';
});

// Предложить тему
document.getElementById('suggestTopic').addEventListener('click', function() {
    const topics = ['технологии', 'кино', 'игры', 'программирование', 'наука'];
    const randomTopic = topics[Math.floor(Math.random() * topics.length)];
    const responses = aiResponses[randomTopic];
    const question = responses[Math.floor(Math.random() * responses.length)];

    addMessage('ИИ', `Давайте поговорим о ${randomTopic}! ${question}`, true);
});

// Выбор темы из списка
document.querySelectorAll('.topic-item').forEach(item => {
    item.addEventListener('click', function() {
        const topic = this.getAttribute('data-topic');
        const responses = aiResponses[topic];
        const question = responses[Math.floor(Math.random() * responses.length)];

        addMessage('ИИ', `Тема: ${this.textContent}. ${question}`, true);
    });
});
</script>
{% endblock %}'''

    # Страница помощи
    help_html = '''{% extends "base.html" %}
{% block title %}Помощь и поддержка{% endblock %}
{% block content %}
<div class="app-section">
    <h2>🆘 Помощь и поддержка</h2>

    <div class="row">
        <div class="col-md-8">
            <div class="card">
                <div class="card-header">Обращение к администратору</div>
                <div class="card-body">
                    <form id="helpForm">
                        <div class="mb-3">
                            <label for="helpCategory" class="form-label">Категория проблемы</label>
                            <select class="form-select" id="helpCategory">
                                <option value="technical">Техническая проблема</option>
                                <option value="content">Контент</option>
                                <option value="account">Аккаунт</option>
                                <option value="suggestion">Предложение</option>
                                <option value="other">Другое</option>
                            </select>
                        </div>
                        <div class="mb-3">
                            <label for="helpMessage" class="form-label">Подробное описание</label>
                            <textarea class="form-control" id="helpMessage" rows="4" placeholder="Опишите вашу проблему или вопрос..."></textarea>
                        </div>
                        <button type="submit" class="btn btn-primary">Отправить обращение</button>
                    </form>
                    <div id="helpResponse" class="mt-3"></div>
                </div>
            </div>

            <div class="mt-4">
                <h4>Часто задаваемые вопросы</h4>
                <div class="accordion" id="faqAccordion">
                    <div class="accordion-item">
                        <h2 class="accordion-header">
                            <button class="accordion-button" type="button" data-bs-toggle="collapse" data-bs-target="#faq1">
                                Как зарегистрироваться?
                            </button>
                        </h2>
                        <div id="faq1" class="accordion-collapse collapse show" data-bs-parent="#faqAccordion">
                            <div class="accordion-body">
                                Нажмите "Регистрация" в верхнем меню, заполните форму и нажмите "Зарегистрироваться".
                            </div>
                        </div>
                    </div>
                    <div class="accordion-item">
                        <h2 class="accordion-header">
                            <button class="accordion-button collapsed" type="button" data-bs-toggle="collapse" data-bs-target="#faq2">
                                Как добавить видео?
                            </button>
                        </h2>
                        <div id="faq2" class="accordion-collapse collapse" data-bs-parent="#faqAccordion">
                            <div class="accordion-body">
                                Только администраторы могут добавлять видео. В разделе "Кино" есть форма для загрузки.
                            </div>
                        </div>
                    </div>
                    <div class="accordion-item">
                        <h2 class="accordion-header">
                            <button class="accordion-button collapsed" type="button" data-bs-toggle="collapse" data-bs-target="#faq3">
                                Как играть в игры?
                            </button>
                        </h2>
                        <div id="faq3" class="accordion-collapse collapse" data-bs-parent="#faqAccordion">
                            <div class="accordion-body">
                                Перейдите в раздел "Развлечения" и выберите игру из вкладок.
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>

        <div class="col-md-4">
            <div class="card">
                <div class="card-header">Контакты администрации</div>
                <div class="card-body">
                    <p><strong>Администратор платформы:Юнусов Зиёвуддин</strong></p>
                    <p>Email: admin@example.com</p>
                    <p>Телефон: +998(99)442-57-75</p>
                    <p>Время работы: 10:00 - 22:00</p>

                    <hr>

                    <h5>Статус системы</h5>
                    <div class="alert alert-success">
                        <strong>Все системы работают нормально</strong>
                    </div>

                    <p>Пользователей онлайн: <strong>42</strong></p>
                    <p>Всего обращений сегодня: <strong>3</strong></p>
                </div>
            </div>
        </div>
    </div>
</div>

<script>
document.getElementById('helpForm').addEventListener('submit', function(e) {
    e.preventDefault();

    const category = document.getElementById('helpCategory').value;
    const message = document.getElementById('helpMessage').value;

    if (message.length < 10) {
        document.getElementById('helpResponse').innerHTML = 
            '<div class="alert alert-warning">Пожалуйста, опишите проблему подробнее.</div>';
        return;
    }

    document.getElementById('helpResponse').innerHTML = 
        '<div class="alert alert-success">Ваше обращение отправлено администратору. Ответ придет на вашу почту в течение 24 часов.</div>';

    document.getElementById('helpForm').reset();
});
</script>
{% endblock %}'''

    # Админ панель
    admin_html = '''{% extends "base.html" %}
{% block title %}Административная панель{% endblock %}
{% block content %}
<div class="app-section">
    <h2 class="text-danger">⚙️ Административная панель</h2>

    <ul class="nav nav-tabs" id="adminTab" role="tablist">
        <li class="nav-item">
            <button class="nav-link active" id="users-tab" data-bs-toggle="tab" data-bs-target="#users">Пользователи</button>
        </li>
        <li class="nav-item">
            <button class="nav-link" id="videos-tab" data-bs-toggle="tab" data-bs-target="#videos">Видео</button>
        </li>
        <li class="nav-item">
            <button class="nav-link" id="words-tab" data-bs-toggle="tab" data-bs-target="#words">Слова для игр</button>
        </li>
        <li class="nav-item">
            <button class="nav-link" id="logs-tab" data-bs-toggle="tab" data-bs-target="#logs">Логи активности</button>
        </li>
    </ul>

    <div class="tab-content mt-3" id="adminTabContent">
        <!-- Пользователи -->
        <div class="tab-pane fade show active" id="users">
            <h4>Управление пользователями</h4>
            <table class="table table-striped">
                <thead>
                    <tr>
                        <th>ID</th>
                        <th>Имя пользователя</th>
                        <th>Email</th>
                        <th>Роль</th>
                        <th>Статус</th>
                        <th>Дата регистрации</th>
                        <th>Действия</th>
                    </tr>
                </thead>
                <tbody>
                    {% for user in users %}
                    <tr>
                        <td>{{ user.id }}</td>
                        <td>{{ user.username }}</td>
                        <td>{{ user.email }}</td>
                        <td>
                            {% if user.role == 'admin' %}
                                <span class="badge bg-danger">Админ</span>
                            {% else %}
                                <span class="badge bg-primary">Пользователь</span>
                            {% endif %}
                        </td>
                        <td>
                            {% if user.is_banned %}
                                <span class="badge bg-dark">Забанен</span>
                            {% else %}
                                <span class="badge bg-success">Активен</span>
                            {% endif %}
                        </td>
                        <td>{{ user.created_at[:10] }}</td>
                        <td>
                            {% if user.id != session.user_id %}
                                <div class="btn-group btn-group-sm">
                                    {% if user.is_banned %}
                                        <a href="/admin/unban_user/{{ user.id }}" class="btn btn-success" title="Разбанить">
                                            ✓
                                        </a>
                                    {% else %}
                                        <a href="/admin/ban_user/{{ user.id }}" class="btn btn-warning" title="Забанить">
                                            ✗
                                        </a>
                                    {% endif %}
                                    <a href="/admin/delete_user/{{ user.id }}" class="btn btn-danger" 
                                       onclick="return confirm('Удалить пользователя {{ user.username }}?')" title="Удалить">
                                        🗑
                                    </a>
                                    <button class="btn btn-info view-password" data-username="{{ user.username }}" 
                                            data-password="{{ user.password }}" title="Показать пароль">
                                        🔑
                                    </button>
                                </div>
                            {% endif %}
                        </td>
                    </tr>
                    {% endfor %}
                </tbody>
            </table>
        </div>

        <!-- Видео -->
        <div class="tab-pane fade" id="videos">
            <h4>Управление видео</h4>
            <div class="mb-3">
                <form method="POST" action="/admin/upload_video" enctype="multipart/form-data" class="row g-3">
                    <div class="col-md-3">
                        <input type="text" class="form-control" name="title" placeholder="Название видео" required>
                    </div>
                    <div class="col-md-2">
                        <select class="form-select" name="category">
                            <option value="movie">Фильм</option>
                            <option value="series">Сериал</option>
                            <option value="cartoon">Мультфильм</option>
                            <option value="music">Музыка</option>
                        </select>
                    </div>
                    <div class="col-md-3">
                        <textarea class="form-control" name="description" placeholder="Описание" rows="1"></textarea>
                    </div>
                    <div class="col-md-3">
                        <input type="file" class="form-control" name="video_file" accept="video/*" required>
                    </div>
                    <div class="col-md-1">
                        <button type="submit" class="btn btn-primary w-100">↑</button>
                    </div>
                </form>
            </div>

            <table class="table table-striped">
                <thead>
                    <tr>
                        <th>ID</th>
                        <th>Название</th>
                        <th>Категория</th>
                        <th>Файл</th>
                        <th>Дата</th>
                        <th>Действия</th>
                    </tr>
                </thead>
                <tbody>
                    {% for video in videos %}
                    <tr>
                        <td>{{ video.id }}</td>
                        <td>{{ video.title }}</td>
                        <td><span class="badge bg-info">{{ video.category }}</span></td>
                        <td><small>{{ video.filename }}</small></td>
                        <td>{{ video.created_at[:10] }}</td>
                        <td>
                            <div class="btn-group btn-group-sm">
                                <a href="/uploads/videos/{{ video.filename }}" class="btn btn-primary" target="_blank">
                                    👁
                                </a>
                                <a href="/admin/delete_video/{{ video.id }}" class="btn btn-danger"
                                   onclick="return confirm('Удалить видео?')">
                                    🗑
                                </a>
                            </div>
                        </td>
                    </tr>
                    {% endfor %}
                </tbody>
            </table>
        </div>

        <!-- Слова для игр -->
        <div class="tab-pane fade" id="words">
            <h4>Управление словами для игр</h4>
            <div class="mb-3">
                <form id="adminAddWordForm" class="row g-3">
                    <div class="col-md-4">
                        <input type="text" class="form-control" id="adminWord" placeholder="Слово" required>
                    </div>
                    <div class="col-md-4">
                        <input type="text" class="form-control" id="adminHint" placeholder="Подсказка">
                    </div>
                    <div class="col-md-3">
                        <input type="text" class="form-control" id="adminCategory" placeholder="Категория">
                    </div>
                    <div class="col-md-1">
                        <button type="submit" class="btn btn-success w-100">+</button>
                    </div>
                </form>
            </div>

            <table class="table table-striped">
                <thead>
                    <tr>
                        <th>ID</th>
                        <th>Слово</th>
                        <th>Подсказка</th>
                        <th>Категория</th>
                        <th>Дата добавления</th>
                        <th>Действия</th>
                    </tr>
                </thead>
                <tbody id="wordsTableBody">
                    {% for word in game_words %}
                    <tr id="word-{{ word.id }}">
                        <td>{{ word.id }}</td>
                        <td>{{ word.word }}</td>
                        <td>{{ word.hint }}</td>
                        <td><span class="badge bg-secondary">{{ word.category }}</span></td>
                        <td>{{ word.added_at[:10] }}</td>
                        <td>
                            <button class="btn btn-danger btn-sm delete-word" data-id="{{ word.id }}">
                                Удалить
                            </button>
                        </td>
                    </tr>
                    {% endfor %}
                </tbody>
            </table>
        </div>

        <!-- Логи -->
        <div class="tab-pane fade" id="logs">
            <h4>Логи активности пользователей</h4>
            <div class="mb-3">
                <button id="clearLogs" class="btn btn-danger">Очистить все логи</button>
            </div>

            <div style="max-height: 500px; overflow-y: auto;">
                <table class="table table-sm">
                    <thead>
                        <tr>
                            <th>ID</th>
                            <th>Пользователь</th>
                            <th>Действие</th>
                            <th>Детали</th>
                            <th>IP адрес</th>
                            <th>Время</th>
                        </tr>
                    </thead>
                    <tbody>
                        {% for log in logs %}
                        <tr>
                            <td>{{ log.id }}</td>
                            <td>
                                {% if log.user_id %}
                                    {{ log.user_id }}
                                {% else %}
                                    Гость
                                {% endif %}
                            </td>
                            <td><span class="badge bg-info">{{ log.action }}</span></td>
                            <td><small>{{ log.details|default('', true) }}</small></td>
                            <td><code>{{ log.ip_address }}</code></td>
                            <td>{{ log.timestamp }}</td>
                        </tr>
                        {% endfor %}
                    </tbody>
                </table>
            </div>
        </div>
    </div>
</div>

<script>
// Показать пароль пользователя
document.querySelectorAll('.view-password').forEach(button => {
    button.addEventListener('click', function() {
        const username = this.getAttribute('data-username');
        const passwordHash = this.getAttribute('data-password');
        alert(`Пользователь: ${username}\nХеш пароля: ${passwordHash}\n\nПароль хранится в зашифрованном виде для безопасности.`);
    });
});

// Добавление слова через AJAX
document.getElementById('adminAddWordForm').addEventListener('submit', async function(e) {
    e.preventDefault();

    const word = document.getElementById('adminWord').value;
    const hint = document.getElementById('adminHint').value;
    const category = document.getElementById('adminCategory').value || 'general';

    const response = await fetch('/admin/add_word', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({word: word, hint: hint, category: category})
    });

    if (response.ok) {
        const data = await response.json();

        // Добавляем новую строку в таблицу
        const newRow = `
            <tr id="word-${data.id}">
                <td>${data.id}</td>
                <td>${word}</td>
                <td>${hint}</td>
                <td><span class="badge bg-secondary">${category}</span></td>
                <td>Сегодня</td>
                <td>
                    <button class="btn btn-danger btn-sm delete-word" data-id="${data.id}">
                        Удалить
                    </button>
                </td>
            </tr>
        `;

        document.getElementById('wordsTableBody').insertAdjacentHTML('afterbegin', newRow);
        document.getElementById('adminAddWordForm').reset();
        alert('Слово добавлено!');
    } else {
        alert('Ошибка при добавлении слова');
    }
});

// Удаление слова
document.addEventListener('click', function(e) {
    if (e.target.classList.contains('delete-word')) {
        const wordId = e.target.getAttribute('data-id');

        if (confirm('Удалить это слово?')) {
            fetch(`/admin/delete_word/${wordId}`, {method: 'DELETE'})
                .then(response => {
                    if (response.ok) {
                        document.getElementById(`word-${wordId}`).remove();
                    }
                });
        }
    }
});

// Очистка логов
document.getElementById('clearLogs').addEventListener('click', function() {
    if (confirm('Очистить все логи? Это действие нельзя отменить.')) {
        fetch('/admin/clear_logs', {method: 'POST'})
            .then(response => {
                if (response.ok) {
                    alert('Логи очищены!');
                    location.reload();
                }
            });
    }
});
</script>
{% endblock %}'''

    # Профиль пользователя
    profile_html = '''{% extends "base.html" %}
{% block title %}Профиль пользователя{% endblock %}
{% block content %}
<div class="row">
    <div class="col-md-4">
        <div class="app-section text-center">
            <div class="mb-3">
                <div style="width: 150px; height: 150px; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); border-radius: 50%; display: inline-flex; align-items: center; justify-content: center; font-size: 60px; color: white;">
                    {{ session.username[0].upper() }}
                </div>
            </div>
            <h3>{{ session.username }}</h3>
            <p class="text-muted">{{ session.email }}</p>

            {% if session.role == 'admin' %}
                <span class="badge bg-danger">Администратор</span>
            {% else %}
                <span class="badge bg-primary">Пользователь</span>
            {% endif %}

            <div class="mt-3">
                <p>Дата регистрации: <strong>{{ user_info.created_at[:10] }}</strong></p>
                <p>Статус: 
                    {% if user_info.is_banned %}
                        <span class="badge bg-dark">Забанен</span>
                    {% else %}
                        <span class="badge bg-success">Активен</span>
                    {% endif %}
                </p>
            </div>
        </div>
    </div>

    <div class="col-md-8">
        <div class="app-section">
            <h4>Статистика активности</h4>

            <div class="row text-center">
                <div class="col-md-4">
                    <div class="card">
                        <div class="card-body">
                            <h5 class="card-title">🎮</h5>
                            <p class="card-text">Игр сыграно</p>
                            <h3>{{ stats.games_played|default(0) }}</h3>
                        </div>
                    </div>
                </div>
                <div class="col-md-4">
                    <div class="card">
                        <div class="card-body">
                            <h5 class="card-title">🎬</h5>
                            <p class="card-text">Видео просмотрено</p>
                            <h3>{{ stats.videos_watched|default(0) }}</h3>
                        </div>
                    </div>
                </div>
                <div class="col-md-4">
                    <div class="card">
                        <div class="card-body">
                            <h5 class="card-title">🤖</h5>
                            <p class="card-text">Сообщений в чате</p>
                            <h3>{{ stats.chat_messages|default(0) }}</h3>
                        </div>
                    </div>
                </div>
            </div>

            <div class="mt-4">
                <h4>История действий</h4>
                <div style="max-height: 300px; overflow-y: auto;">
                    <ul class="list-group">
                        {% for log in user_logs %}
                        <li class="list-group-item">
                            <small class="text-muted">{{ log.timestamp[:19] }}</small><br>
                            {{ log.action }} 
                            {% if log.details %}
                                - <em>{{ log.details }}</em>
                            {% endif %}
                        </li>
                        {% endfor %}
                    </ul>
                </div>
            </div>

            {% if session.role == 'admin' %}
            <div class="mt-4 alert alert-warning">
                <h5>⚙️ Административные функции</h5>
                <p>Вы имеете доступ к админ-панели для управления платформой.</p>
                <a href="/admin" class="btn btn-danger">Перейти в админ-панель</a>
            </div>
            {% endif %}
        </div>
    </div>
</div>
{% endblock %}'''

    # Сохраняем все шаблоны
    templates_dir = 'templates'
    os.makedirs(templates_dir, exist_ok=True)

    templates = {
        'base.html': base_html,
        'index.html': index_html,
        'login.html': login_html,
        'register.html': register_html,
        'movies.html': movies_html,
        'entertainment.html': entertainment_html,
        'chat.html': chat_html,
        'help.html': help_html,
        'admin.html': admin_html,
        'profile.html': profile_html
    }

    for filename, content in templates.items():
        with open(os.path.join(templates_dir, filename), 'w', encoding='utf-8') as f:
            f.write(content)


# Создаем HTML шаблоны при запуске
create_templates()


# ========== ОСНОВНЫЕ МАРШРУТЫ ==========
@app.route('/')
def index():
    """Главная страница"""
    return render_template('index.html')


@app.route('/login', methods=['GET', 'POST'])
def login():
    """Страница входа"""
    if request.method == 'POST':
        username = request.form['username']
        password = request.form['password']

        conn = get_db()
        c = conn.cursor()
        c.execute("SELECT * FROM users WHERE username = ?", (username,))
        user = c.fetchone()
        conn.close()

        if user and check_password_hash(user['password'], password):
            if user['is_banned']:
                flash('Ваш аккаунт заблокирован!', 'danger')
                return redirect(url_for('login'))

            session['user_id'] = user['id']
            session['username'] = user['username']
            session['email'] = user['email']
            session['role'] = user['role']

            log_activity(user['id'], 'LOGIN', f'Пользователь {username} вошел в систему')
            flash('Вы успешно вошли в систему!', 'success')
            return redirect(url_for('index'))
        else:
            flash('Неверное имя пользователя или пароль!', 'danger')

    return render_template('login.html')


@app.route('/register', methods=['GET', 'POST'])
def register():
    """Страница регистрации"""
    if request.method == 'POST':
        username = request.form['username']
        email = request.form['email']
        password = request.form['password']
        confirm_password = request.form['confirm_password']

        if password != confirm_password:
            flash('Пароли не совпадают!', 'danger')
            return redirect(url_for('register'))

        if len(password) < 6:
            flash('Пароль должен содержать минимум 6 символов!', 'danger')
            return redirect(url_for('register'))

        conn = get_db()
        c = conn.cursor()

        # Проверка существующего пользователя
        c.execute("SELECT * FROM users WHERE username = ? OR email = ?", (username, email))
        if c.fetchone():
            flash('Пользователь с таким именем или email уже существует!', 'danger')
            conn.close()
            return redirect(url_for('register'))

        # Создание нового пользователя
        hashed_password = generate_password_hash(password)
        c.execute("INSERT INTO users (username, email, password) VALUES (?, ?, ?)",
                  (username, email, hashed_password))
        user_id = c.lastrowid
        conn.commit()
        conn.close()

        log_activity(user_id, 'REGISTER', f'Новый пользователь: {username}')
        flash('Регистрация прошла успешно! Теперь войдите в систему.', 'success')
        return redirect(url_for('login'))

    return render_template('register.html')


@app.route('/logout')
def logout():
    """Выход из системы"""
    if 'user_id' in session:
        log_activity(session['user_id'], 'LOGOUT')
    session.clear()
    flash('Вы вышли из системы.', 'info')
    return redirect(url_for('index'))


@app.route('/profile')
@login_required
def profile():
    """Профиль пользователя"""
    conn = get_db()
    c = conn.cursor()

    # Информация о пользователе
    c.execute("SELECT * FROM users WHERE id = ?", (session['user_id'],))
    user_info = dict(c.fetchone())

    # Логи пользователя
    c.execute("SELECT * FROM activity_logs WHERE user_id = ? ORDER BY timestamp DESC LIMIT 10",
              (session['user_id'],))
    user_logs = [dict(row) for row in c.fetchall()]

    conn.close()

    # Статистика (заглушка)
    stats = {
        'games_played': 15,
        'videos_watched': 8,
        'chat_messages': 42
    }

    return render_template('profile.html', user_info=user_info, user_logs=user_logs, stats=stats)


@app.route('/movies')
@login_required
def movies():
    """Страница с видео"""
    conn = get_db()
    c = conn.cursor()
    c.execute("SELECT * FROM videos ORDER BY created_at DESC")
    videos = [dict(row) for row in c.fetchall()]
    conn.close()

    return render_template('movies.html', videos=videos)


@app.route('/series')
@login_required
def series():
    """Страница сериалов (аналогично фильмам)"""
    return redirect(url_for('movies'))


@app.route('/entertainment')
@login_required
def entertainment():
    """Страница с играми"""
    return render_template('entertainment.html')


@app.route('/chat')
@login_required
def chat():
    """Чат с ИИ"""
    return render_template('chat.html')


@app.route('/help')
@login_required
def help_page():
    """Страница помощи"""
    return render_template('help.html')


# ========== API ДЛЯ ИГР ==========
@app.route('/api/get_random_word')
def get_random_word():
    """API для получения случайного слова для игры"""
    conn = get_db()
    c = conn.cursor()
    c.execute("SELECT * FROM game_words ORDER BY RANDOM() LIMIT 1")
    word_data = c.fetchone()
    conn.close()

    if word_data:
        return jsonify({
            'word': word_data['word'],
            'hint': word_data['hint'],
            'category': word_data['category']
        })
    return jsonify({'word': 'ПРИМЕР', 'hint': 'Это пример слова', 'category': 'general'})


# ========== АДМИН РАЗДЕЛ ==========
@app.route('/admin')
@admin_required
def admin_panel():
    """Административная панель"""
    conn = get_db()
    c = conn.cursor()

    # Все пользователи
    c.execute("SELECT * FROM users ORDER BY id")
    users = [dict(row) for row in c.fetchall()]

    # Все видео
    c.execute("SELECT * FROM videos ORDER BY id")
    videos = [dict(row) for row in c.fetchall()]

    # Все слова для игр
    c.execute("SELECT * FROM game_words ORDER BY id")
    game_words = [dict(row) for row in c.fetchall()]

    # Логи активности
    c.execute("SELECT * FROM activity_logs ORDER BY timestamp DESC LIMIT 100")
    logs = [dict(row) for row in c.fetchall()]

    conn.close()

    return render_template('admin.html',
                           users=users,
                           videos=videos,
                           game_words=game_words,
                           logs=logs)


@app.route('/admin/ban_user/<int:user_id>')
@admin_required
def ban_user(user_id):
    """Бан пользователя"""
    conn = get_db()
    c = conn.cursor()
    c.execute("UPDATE users SET is_banned = 1 WHERE id = ?", (user_id,))
    conn.commit()

    c.execute("SELECT username FROM users WHERE id = ?", (user_id,))
    username = c.fetchone()['username']
    conn.close()

    log_activity(session['user_id'], 'BAN_USER', f'Забанен пользователь: {username}')
    flash(f'Пользователь {username} забанен!', 'success')
    return redirect(url_for('admin_panel'))


@app.route('/admin/unban_user/<int:user_id>')
@admin_required
def unban_user(user_id):
    """Разбан пользователя"""
    conn = get_db()
    c = conn.cursor()
    c.execute("UPDATE users SET is_banned = 0 WHERE id = ?", (user_id,))
    conn.commit()

    c.execute("SELECT username FROM users WHERE id = ?", (user_id,))
    username = c.fetchone()['username']
    conn.close()

    log_activity(session['user_id'], 'UNBAN_USER', f'Разбанен пользователь: {username}')
    flash(f'Пользователь {username} разбанен!', 'success')
    return redirect(url_for('admin_panel'))


@app.route('/admin/delete_user/<int:user_id>')
@admin_required
def delete_user(user_id):
    """Удаление пользователя"""
    if user_id == session['user_id']:
        flash('Нельзя удалить самого себя!', 'danger')
        return redirect(url_for('admin_panel'))

    conn = get_db()
    c = conn.cursor()

    c.execute("SELECT username FROM users WHERE id = ?", (user_id,))
    username = c.fetchone()['username']

    c.execute("DELETE FROM users WHERE id = ?", (user_id,))
    conn.commit()
    conn.close()

    log_activity(session['user_id'], 'DELETE_USER', f'Удален пользователь: {username}')
    flash(f'Пользователь {username} удален!', 'success')
    return redirect(url_for('admin_panel'))


@app.route('/admin/upload_video', methods=['POST'])
@admin_required
def upload_video():
    """Загрузка видео (админ)"""
    if 'video_file' not in request.files:
        flash('Файл не выбран!', 'danger')
        return redirect(url_for('movies'))

    video_file = request.files['video_file']
    if video_file.filename == '':
        flash('Файл не выбран!', 'danger')
        return redirect(url_for('movies'))

    # Сохранение файла
    filename = secure_filename(video_file.filename)
    filepath = os.path.join(app.config['UPLOAD_FOLDER'], 'videos', filename)
    video_file.save(filepath)

    # Сохранение в БД
    title = request.form['title']
    category = request.form.get('category', 'movie')
    description = request.form.get('description', '')

    conn = get_db()
    c = conn.cursor()
    c.execute("INSERT INTO videos (title, filename, category, description, uploader_id) VALUES (?, ?, ?, ?, ?)",
              (title, filename, category, description, session['user_id']))
    conn.commit()
    conn.close()

    log_activity(session['user_id'], 'UPLOAD_VIDEO', f'Загружено видео: {title}')
    flash('Видео успешно загружено!', 'success')
    return redirect(url_for('movies'))


@app.route('/admin/delete_video/<int:video_id>')
@admin_required
def delete_video(video_id):
    """Удаление видео"""
    conn = get_db()
    c = conn.cursor()

    c.execute("SELECT filename, title FROM videos WHERE id = ?", (video_id,))
    video = c.fetchone()

    if video:
        # Удаляем файл
        filepath = os.path.join(app.config['UPLOAD_FOLDER'], 'videos', video['filename'])
        if os.path.exists(filepath):
            os.remove(filepath)

        # Удаляем запись из БД
        c.execute("DELETE FROM videos WHERE id = ?", (video_id,))
        conn.commit()

        log_activity(session['user_id'], 'DELETE_VIDEO', f'Удалено видео: {video["title"]}')
        flash(f'Видео "{video["title"]}" удалено!', 'success')

    conn.close()
    return redirect(url_for('movies'))


@app.route('/admin/add_word', methods=['POST'])
@admin_required
def add_word():
    """Добавление слова для игр"""
    data = request.get_json()
    word = data.get('word', '').strip().upper()
    hint = data.get('hint', '').strip()
    category = data.get('category', 'general').strip()

    if not word:
        return jsonify({'error': 'Слово не может быть пустым'}), 400

    conn = get_db()
    c = conn.cursor()
    c.execute("INSERT INTO game_words (word, hint, category, added_by) VALUES (?, ?, ?, ?)",
              (word, hint, category, session['user_id']))
    word_id = c.lastrowid
    conn.commit()
    conn.close()

    log_activity(session['user_id'], 'ADD_WORD', f'Добавлено слово: {word}')
    return jsonify({'success': True, 'id': word_id})


@app.route('/admin/delete_word/<int:word_id>', methods=['DELETE'])
@admin_required
def delete_word(word_id):
    """Удаление слова для игр"""
    conn = get_db()
    c = conn.cursor()
    c.execute("DELETE FROM game_words WHERE id = ?", (word_id,))
    conn.commit()
    conn.close()

    log_activity(session['user_id'], 'DELETE_WORD', f'Удалено слово ID: {word_id}')
    return jsonify({'success': True})


@app.route('/admin/clear_logs', methods=['POST'])
@admin_required
def clear_logs():
    """Очистка всех логов"""
    conn = get_db()
    c = conn.cursor()
    c.execute("DELETE FROM activity_logs")
    conn.commit()
    conn.close()

    log_activity(session['user_id'], 'CLEAR_LOGS', 'Очищены все логи')
    return jsonify({'success': True})


@app.route('/uploads/videos/<filename>')
def serve_video(filename):
    """Отдача видеофайлов"""
    return send_from_directory(os.path.join(app.config['UPLOAD_FOLDER'], 'videos'), filename)





# ========== ЗАПУСК ПРИЛОЖЕНИЯ ==========
if __name__ == '__main__':
    print("=" * 50)
    print("Мультимедийная платформа запускается...")
    print("Доступные учетные данные администратора:")
    print("Логин: admin")
    print("Пароль: admin123")
    print("=" * 50)
    print("Сайт доступен по адресу: http://localhost:5000")
    print("=" * 50)

    app.run(host='0.0.0.0', port=5000, debug=True)