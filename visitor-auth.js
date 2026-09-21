/* ============================================================
   XLAND — visitor-auth.js
   Lets site visitors register/log in with Firebase Authentication
   (email + password), collecting name + phone at signup. This is
   a completely separate concern from the admin panel's login:
   having a visitor account here does NOT grant admin access —
   x89-manage-xland.html additionally checks an "admins" allow-list
   in the database that only the site owner can populate (via the
   Firebase Console), never from client-side code.
   Requires `auth` and `database` (Firebase compat) to be defined
   on the page before this script runs.
   ============================================================ */

document.addEventListener('DOMContentLoaded', () => {
  const modal = document.getElementById('auth-modal');
  const navAuth = document.getElementById('nav-auth');
  if (!modal || !navAuth || typeof auth === 'undefined') return;

  const closeBtn = document.getElementById('auth-modal-close');
  const loginForm = document.getElementById('auth-login-form');
  const registerForm = document.getElementById('auth-register-form');
  const tabBtns = modal.querySelectorAll('.auth-tab-btn');

  function openModal() { modal.style.display = 'flex'; }
  function closeModal() { modal.style.display = 'none'; }

  function switchTab(tab) {
    tabBtns.forEach(b => b.classList.toggle('active', b.dataset.authTab === tab));
    modal.querySelectorAll('.auth-form').forEach(f => {
      f.classList.toggle('active', f.id === 'auth-' + tab + '-form');
    });
  }

  tabBtns.forEach(btn => btn.addEventListener('click', () => switchTab(btn.dataset.authTab)));
  if (closeBtn) closeBtn.addEventListener('click', closeModal);
  modal.addEventListener('click', (e) => { if (e.target === modal) closeModal(); });

  function renderLoggedOut() {
    navAuth.innerHTML = '<button class="btn btn-outline nav-auth-btn" id="auth-open-btn">ورود / ثبت‌نام</button>';
    document.getElementById('auth-open-btn').addEventListener('click', () => {
      switchTab('login');
      openModal();
    });
  }

  function renderLoggedIn(user, profileName) {
    navAuth.innerHTML = '';
    const label = document.createElement('span');
    label.className = 'nav-auth-label';
    label.textContent = profileName || user.email;
    const logoutBtn = document.createElement('button');
    logoutBtn.className = 'btn btn-outline nav-auth-btn';
    logoutBtn.textContent = 'خروج';
    logoutBtn.addEventListener('click', () => auth.signOut());
    navAuth.appendChild(label);
    navAuth.appendChild(logoutBtn);
  }

  if (loginForm) {
    loginForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const errBox = document.getElementById('auth-login-error');
      const email = document.getElementById('auth-login-email').value.trim().toLowerCase();
      const password = document.getElementById('auth-login-password').value;
      try {
        await auth.signInWithEmailAndPassword(email, password);
        errBox.classList.remove('show');
        loginForm.reset();
        closeModal();
      } catch (err) {
        errBox.textContent = err.message;
        errBox.classList.add('show');
      }
    });
  }

  if (registerForm) {
    registerForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const errBox = document.getElementById('auth-register-error');
      const name = document.getElementById('auth-reg-name').value.trim();
      const phone = document.getElementById('auth-reg-phone').value.trim();
      const email = document.getElementById('auth-reg-email').value.trim().toLowerCase();
      const password = document.getElementById('auth-reg-password').value;

      if (!name || !phone) {
        errBox.textContent = 'نام و شماره موبایل الزامی است.';
        errBox.classList.add('show');
        return;
      }

      try {
        const cred = await auth.createUserWithEmailAndPassword(email, password);
        await database.ref('users/' + cred.user.uid).set({
          name, phone, email, createdAt: Date.now()
        });
        errBox.classList.remove('show');
        registerForm.reset();
        closeModal();
      } catch (err) {
        errBox.textContent = err.message;
        errBox.classList.add('show');
      }
    });
  }

  auth.onAuthStateChanged((user) => {
    if (!user) {
      renderLoggedOut();
      return;
    }
    if (typeof database !== 'undefined') {
      database.ref('users/' + user.uid).once('value')
        .then(snap => renderLoggedIn(user, snap.val() && snap.val().name))
        .catch(() => renderLoggedIn(user, null));
    } else {
      renderLoggedIn(user, null);
    }
  });
});
