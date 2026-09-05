(() => {
  const form = document.querySelector('[data-register-form]');
  const nameInput = document.querySelector('[data-name]');
  const slugInput = document.querySelector('[data-slug]');
  const fileInput = document.querySelector('[data-mark-file]');
  const preview = document.querySelector('[data-preview]');
  const status = document.querySelector('[data-status]');
  const submit = document.querySelector('[data-submit]');
  const list = document.querySelector('[data-mark-list]');
  const count = document.querySelector('[data-mark-count]');
  let slugWasEdited = false;

  const slugify = (value) => value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

  slugInput?.addEventListener('input', () => { slugWasEdited = true; });
  nameInput?.addEventListener('input', () => {
    if (!slugWasEdited && slugInput) slugInput.value = slugify(nameInput.value);
  });

  fileInput?.addEventListener('change', () => {
    const file = fileInput.files?.[0];
    if (!file || !preview) return;
    const url = URL.createObjectURL(file);
    preview.src = url;
    preview.hidden = false;
    preview.onload = () => URL.revokeObjectURL(url);
  });

  const escapeHtml = (value) => String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');

  async function loadMarks() {
    if (!list) return;
    try {
      const response = await fetch('api/marks.php', { cache: 'no-store' });
      const payload = await response.json();
      const marks = Array.isArray(payload.marks) ? payload.marks : [];
      if (count) count.textContent = String(marks.length);
      if (!marks.length) {
        list.innerHTML = '<p class="empty-state">No marks registered yet.</p>';
        return;
      }
      list.innerHTML = marks.map((mark) => `
        <article class="registry-item">
          <img src="${escapeHtml(mark.image_url)}" alt="${escapeHtml(mark.name)} mark">
          <div><strong>${escapeHtml(mark.name)}</strong><small>${escapeHtml(mark.slug)}</small></div>
          <a href="${escapeHtml(mark.landing_page)}">Open</a>
        </article>
      `).join('');
    } catch {
      list.innerHTML = '<p class="empty-state">Unable to load the registry.</p>';
    }
  }

  form?.addEventListener('submit', async (event) => {
    event.preventDefault();
    if (!submit || !status) return;
    status.textContent = 'Registering mark…';
    status.className = 'form-status';
    submit.disabled = true;

    try {
      const response = await fetch('api/register.php', {
        method: 'POST',
        body: new FormData(form),
        headers: { Accept: 'application/json' },
      });
      const payload = await response.json();
      if (!response.ok || !payload.ok) throw new Error(payload.error || 'Registration failed.');

      status.textContent = `${payload.mark.name} is registered and ready to scan.`;
      status.className = 'form-status success-text';
      form.reset();
      if (preview) {
        preview.hidden = true;
        preview.removeAttribute('src');
      }
      slugWasEdited = false;
      await loadMarks();
    } catch (error) {
      status.textContent = error instanceof Error ? error.message : 'Registration failed.';
      status.className = 'form-status error-text';
    } finally {
      submit.disabled = false;
    }
  });

  loadMarks();
})();
