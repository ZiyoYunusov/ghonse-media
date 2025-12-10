import { auth, db } from "./firebase.js";
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  updatePassword,
  deleteUser,
  onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/10.11.1/firebase-auth.js";
import {
  doc,
  setDoc,
  getDoc,
  updateDoc,
  deleteDoc,
  collection,
  query,
  where,
  getDocs
} from "https://www.gstatic.com/firebasejs/10.11.1/firebase-firestore.js";

let currentUID = null;

// ---------------------- Утилиты ----------------------
function showError(el, msg) {
  if (!el) return;
  el.textContent = msg;
  el.classList.add("show");
}
function clearError(el) {
  if (!el) return;
  el.textContent = "";
  el.classList.remove("show");
}

// ---------------------- Переключение окон (index.html использует эти функции) ----------------------
function switchToRegister(e) {
  e && e.preventDefault();
  document.getElementById("loginContainer").classList.remove("active");
  document.getElementById("registerContainer").classList.add("active");
}
function switchToLogin(e) {
  e && e.preventDefault();
  document.getElementById("registerContainer").classList.remove("active");
  document.getElementById("loginContainer").classList.add("active");
}
window.switchToRegister = switchToRegister;
window.switchToLogin = switchToLogin;

// ---------------------- Логин (логин или email) ----------------------
document.getElementById("loginForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  const identifier = document.getElementById("loginEmail").value.trim(); // можно ввести email или username
  const password = document.getElementById("loginPassword").value;
  const err = document.getElementById("loginError");
  clearError(err);

  if (!identifier || !password) {
    showError(err, "Заполните поля");
    return;
  }

  try {
    let emailToSignIn = identifier;

    // Если ввели не email (нет @), считаем это username и ищем по Firestore
    if (!identifier.includes("@")) {
      const q = query(collection(db, "users"), where("username", "==", identifier));
      const snaps = await getDocs(q);
      if (snaps.empty) {
        showError(err, "Пользователь с таким логином не найден");
        return;
      }
      // берем первый документ
      const userDoc = snaps.docs[0].data();
      emailToSignIn = userDoc.email;
    }

    const credential = await signInWithEmailAndPassword(auth, emailToSignIn, password);
    currentUID = credential.user.uid;
    console.log("Login success UID:", currentUID);
    showMain(currentUID);
  } catch (error) {
    console.error("Login error:", error);
    if (error.code === "auth/user-not-found") {
      showError(err, "Пользователь не найден");
    } else if (error.code === "auth/wrong-password") {
      showError(err, "Неверный пароль");
    } else {
      showError(err, "Ошибка входа: " + error.message);
    }
  }
});

// ---------------------- Регистрация ----------------------
document.getElementById("registerForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  const firstName = document.getElementById("firstName").value.trim();
  const lastName = document.getElementById("lastName").value.trim();
  const ageVal = document.getElementById("age").value.trim();
  const email = document.getElementById("registerEmail").value.trim().toLowerCase();
  const username = document.getElementById("username").value.trim();
  const password = document.getElementById("registerPassword").value;
  const confirmPassword = document.getElementById("confirmPassword").value;
  const err = document.getElementById("registerError");
  clearError(err);

  if (!firstName || !lastName || !ageVal || !email || !username || !password || !confirmPassword) {
    showError(err, "Заполните все поля");
    return;
  }
  const age = parseInt(ageVal, 10);
  if (isNaN(age) || age < 10) {
    showError(err, "Укажите корректный возраст (>=10)");
    return;
  }
  if (password !== confirmPassword) {
    showError(err, "Пароли не совпадают");
    return;
  }
  if (password.length < 6) {
    showError(err, "Пароль должен быть минимум 6 символов");
    return;
  }

  try {
    // Проверка уникальности логина в Firestore
    const qLogin = query(collection(db, "users"), where("username", "==", username));
    const snapsLogin = await getDocs(qLogin);
    if (!snapsLogin.empty) {
      showError(err, "Логин уже занят");
      return;
    }

    // Доп. проверка email в Firestore (ранняя проверка, основная проверка в Auth)
    const qEmail = query(collection(db, "users"), where("email", "==", email));
    const snapsEmail = await getDocs(qEmail);
    if (!snapsEmail.empty) {
      showError(err, "Email уже зарегистрирован");
      return;
    }

    // Создаем пользователя в Authentication
    const userCredential = await createUserWithEmailAndPassword(auth, email, password);
    const uid = userCredential.user.uid;

    // Сохраняем данные пользователя в Firestore
    await setDoc(doc(db, "users", uid), {
      firstName,
      lastName,
      age,
      email,
      username,
      createdAt: new Date().toISOString()
    });

    console.log("Registration success UID:", uid);
    document.getElementById("registerForm").reset();
    showMain(uid);
  } catch (error) {
    console.error("Registration error:", error);
    if (error.code === "auth/email-already-in-use") {
      showError(err, "Email уже зарегистрирован");
    } else {
      showError(err, "Ошибка регистрации: " + error.message);
    }
  }
});

// ---------------------- Показать главное окно ----------------------
function showMain(uid) {
  currentUID = uid;
  document.getElementById("loginContainer").style.display = "none";
  document.getElementById("registerContainer").style.display = "none";
  document.getElementById("mainSection").style.display = "flex";
  loadProfile(uid);
  loadMovies();
  showSection("cinema");
}

// ---------------------- Навигация / профиль / остальное ----------------------
window.showSection = function(sectionId) {
  document.querySelectorAll(".section").forEach(s => s.style.display = "none");
  const section = document.getElementById(sectionId);
  if (section) section.style.display = "block";
};

async function loadProfile(uid) {
  try {
    const userDocSnap = await getDoc(doc(db, "users", uid));
    if (!userDocSnap.exists()) {
      console.warn("Profile doc not found for uid", uid);
      return;
    }
    const data = userDocSnap.data();
    document.getElementById("profileInfo").innerHTML = `
      <div class="profile-item">
        <div class="profile-item-label">Имя</div>
        <div class="profile-item-value">${data.firstName}</div>
      </div>
      <div class="profile-item">
        <div class="profile-item-label">Фамилия</div>
        <div class="profile-item-value">${data.lastName}</div>
      </div>
      <div class="profile-item">
        <div class="profile-item-label">Возраст</div>
        <div class="profile-item-value">${data.age}</div>
      </div>
      <div class="profile-item">
        <div class="profile-item-label">Логин</div>
        <div class="profile-item-value">${data.username}</div>
      </div>
      <div class="profile-item">
        <div class="profile-item-label">Email</div>
        <div class="profile-item-value">${data.email}</div>
      </div>
    `;

    // fill edit form if present
    if (document.getElementById("editFirstName")) {
      document.getElementById("editFirstName").value = data.firstName;
      document.getElementById("editLastName").value = data.lastName;
      document.getElementById("editAge").value = data.age;
      document.getElementById("editUsername").value = data.username;
    }
  } catch (err) {
    console.error("loadProfile error:", err);
  }
}

// profile save
document.getElementById("profileForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  const firstName = document.getElementById("editFirstName").value.trim();
  const lastName = document.getElementById("editLastName").value.trim();
  const age = parseInt(document.getElementById("editAge").value.trim(), 10);
  const username = document.getElementById("editUsername").value.trim();

  if (!firstName || !lastName || isNaN(age) || !username) {
    alert("Заполните все поля");
    return;
  }

  try {
    // Если пользователь меняет логин — нужно проверить уникальность
    const qLogin = query(collection(db, "users"), where("username", "==", username));
    const snaps = await getDocs(qLogin);
    if (!snaps.empty) {
      // если есть документ и его id != currentUID => занят
      const other = snaps.docs.find(d => d.id !== currentUID);
      if (other) {
        alert("Логин уже занят другим пользователем");
        return;
      }
    }

    await updateDoc(doc(db, "users", currentUID), {
      firstName, lastName, age, username
    });
    alert("Профиль обновлен");
    loadProfile(currentUID);
  } catch (err) {
    console.error("profile update error:", err);
    alert("Ошибка обновления: " + err.message);
  }
});

// password change / delete account / logout (используйте существующие реализаци)
window.openPasswordChange = function() { document.getElementById("passwordChangeForm").style.display = "block"; };
window.closePasswordChange = function() { document.getElementById("passwordChangeForm").style.display = "none"; document.getElementById("newPassword").value = ""; };

window.updatePassword = async function() {
  const newPassword = document.getElementById("newPassword").value;
  if (!newPassword || newPassword.length < 6) { alert("Пароль минимум 6 символов"); return; }
  try {
    await updatePassword(auth.currentUser, newPassword);
    alert("Пароль изменён");
    closePasswordChange();
  } catch (err) {
    console.error("updatePassword error:", err);
    alert("Ошибка смены пароля: " + err.message);
  }
};

window.deleteAccount = async function() {
  if (!confirm("Удалить аккаунт? Это действие необратимо.")) return;
  try {
    await deleteDoc(doc(db, "users", currentUID));
    await deleteUser(auth.currentUser);
    alert("Аккаунт удален");
    window.location.reload();
  } catch (err) {
    console.error("delete account error:", err);
    alert("Ошибка удаления: " + err.message);
  }
};

window.logout = async function() {
  try {
    await signOut(auth);
    currentUID = null;
    document.getElementById("mainSection").style.display = "none";
    document.getElementById("loginContainer").classList.add("active");
    document.getElementById("registerContainer").classList.remove("active");
    document.getElementById("loginForm").reset();
    document.getElementById("registerForm").reset();
  } catch (err) {
    console.error("logout error:", err);
    alert("Ошибка выхода: " + err.message);
  }
};

// ---------------------- Фильмы / Игры / Помощник — оставляем существующую логику ----------------------
// Если у вас уже есть функции loadMovies(), renderBoard(), startWordGame(), startPhraseGame() и т.д. — они продолжат работать.
// Ниже минимальный вызов инициализации (если в вашем main.js уже есть расширенная логика, добавьте вызовы туда):
window.addEventListener("load", () => {
  // если пользователь уже залогинен — автоматически откроем приложение
  onAuthStateChanged(auth, (user) => {
    if (user) {
      currentUID = user.uid;
      console.log("onAuthStateChanged: user logged in", currentUID);
      showMain(currentUID);
    } else {
      console.log("onAuthStateChanged: no user");
    }
  });

  // Вызов функций игр/и т.д. здесь, если они объявлены в этом файле:
  if (typeof renderBoard === "function") renderBoard();
  if (typeof startWordGame === "function") startWordGame();
  if (typeof startPhraseGame === "function") startPhraseGame();
});