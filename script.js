(() => {
  const header = document.querySelector('[data-header]');
  const toggle = document.querySelector('[data-menu-toggle]');
  const drawer = document.querySelector('[data-mobile-nav]');
  const cartCount = document.querySelector('.cart-count');
  const toast = document.querySelector('[data-toast]');
  const form = document.querySelector('[data-newsletter-form]');
  const formMessage = document.querySelector('[data-form-message]');
  let cart = 0;
  let toastTimer;

  const setScrolled = () => header?.classList.toggle('is-scrolled', window.scrollY > 8);
  setScrolled();
  window.addEventListener('scroll', setScrolled, { passive: true });

  if (toggle && drawer) {
    toggle.addEventListener('click', () => {
      const open = toggle.getAttribute('aria-expanded') === 'true';
      toggle.setAttribute('aria-expanded', String(!open));
      drawer.hidden = open;
    });

    drawer.addEventListener('click', (event) => {
      if (event.target.closest('a')) {
        drawer.hidden = true;
        toggle.setAttribute('aria-expanded', 'false');
      }
    });
  }

  const showToast = (message) => {
    if (!toast) return;
    clearTimeout(toastTimer);
    toast.textContent = message;
    toast.classList.add('is-visible');
    toastTimer = setTimeout(() => toast.classList.remove('is-visible'), 2200);
  };

  document.querySelectorAll('.add-to-cart').forEach((button) => {
    button.addEventListener('click', () => {
      cart += 1;
      if (cartCount) cartCount.textContent = String(cart);
      const product = button.dataset.product || 'Item';
      showToast(`${product} added to cart`);
    });
  });

  if (form) {
    form.addEventListener('submit', (event) => {
      event.preventDefault();
      const email = new FormData(form).get('email');
      if (!email) return;
      form.reset();
      if (formMessage) formMessage.textContent = 'You’re on the list. Good things incoming.';
    });
  }
})();
