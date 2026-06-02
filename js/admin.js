// admin.js — admin panel logic

// ── Service Role Key ──────────────────────────────────────
const SUPABASE_SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imx5ZWZ1dnl6YmF5dnB4a2JhcnZoIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4MDMzOTkyNywiZXhwIjoyMDk1OTE1OTI3fQ.qkTArgy0_AZ3ohS5Ixw3EVrrWE014piMeJtlyftAWtE';

const sbAdmin = supabase.createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

const ADMIN_PASSWORD = 'Tomato1401@!#';
const PAGE_ADMIN = 100;
let currentPage = 0;
let totalCount  = 0;

document.addEventListener('DOMContentLoaded', () => {
  checkAuth();
  setupLightbox();
});

function checkAuth() {
  const authed = sessionStorage.getItem('admin_authed');
  if (authed === '1') {
    showPanel();
  } else {
    document.getElementById('auth-screen').style.display = 'flex';
  }
}

document.getElementById('btn-login')?.addEventListener('click', () => {
  const pw = document.getElementById('admin-pw').value;
  if (pw === ADMIN_PASSWORD) {
    sessionStorage.setItem('admin_authed', '1');
    document.getElementById('auth-screen').style.display = 'none';
    showPanel();
  } else {
    document.getElementById('auth-error').textContent = 'Wrong password.';
  }
});

async function showPanel() {
  document.getElementById('admin-panel').style.display = 'block';
  await loadCategories();
  buildCategorySelect();
  setupForm();
  setupBulkBar();
  setupCategoryManager();
  loadPromptList(0);
}

// ── Lightbox ──────────────────────────────────────────────
function setupLightbox() {
  const lb    = document.getElementById('lightbox');
  const lbImg = document.getElementById('lightbox-img');
  const lbClose = document.getElementById('lightbox-close');

  // Đóng khi click nền hoặc nút X
  lb.addEventListener('click', (e) => {
    if (e.target === lb || e.target === lbClose) closeLightbox();
  });

  // Đóng bằng phím Esc
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') closeLightbox();
  });
}

function openLightbox(src) {
  const lb    = document.getElementById('lightbox');
  const lbImg = document.getElementById('lightbox-img');
  lbImg.src = src;
  lb.classList.add('open');
  document.body.style.overflow = 'hidden';
}

function closeLightbox() {
  const lb = document.getElementById('lightbox');
  lb.classList.remove('open');
  document.body.style.overflow = '';
}

// ── Build <select> từ CATEGORIES ─────────────────────────
function buildCategorySelect() {
  const sel = document.getElementById('f-category');
  sel.innerHTML = '<option value="">— Select —</option>';
  CATEGORIES.filter(c => c.id !== 'all').forEach(c => {
    const opt = document.createElement('option');
    opt.value = c.id;
    opt.textContent = c.label;
    sel.appendChild(opt);
  });
}

// ── Category Manager ──────────────────────────────────────
function setupCategoryManager() {
  renderCategoryList();

  document.getElementById('btn-add-cat')?.addEventListener('click', async () => {
    const labelEl = document.getElementById('new-cat-label');
    const label = labelEl.value.trim();
    if (!label) return;

    const id = label.toLowerCase()
      .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '');

    const maxOrder = CATEGORIES.filter(c => c.id !== 'all')
      .reduce((m, c) => Math.max(m, c.order ?? 0), 0);

    const { error } = await sbAdmin.from('categories').insert({
      id, label, order: maxOrder + 1
    });

    if (error) { alert('Error: ' + error.message); return; }

    labelEl.value = '';
    showToast(`Added "${label}"`, 'success');
    await loadCategories();
    buildCategorySelect();
    renderCategoryList();
  });
}

function renderCategoryList() {
  const wrap = document.getElementById('cat-list');
  if (!wrap) return;
  wrap.innerHTML = '';
  CATEGORIES.filter(c => c.id !== 'all').forEach(c => {
    const row = document.createElement('div');
    row.className = 'cat-row';
    row.innerHTML = `
      <span class="cat-row-label">${escHtml(c.label)}</span>
      <code class="cat-row-id">${escHtml(c.id)}</code>
      <button class="tbl-btn del-btn cat-del-btn" data-id="${escHtml(c.id)}">Delete</button>`;
    row.querySelector('.cat-del-btn').addEventListener('click', () => deleteCategory(c.id, c.label));
    wrap.appendChild(row);
  });
}

async function deleteCategory(id, label) {
  if (!confirm(`Delete category "${label}"?\nPrompts dùng category này sẽ không bị xóa.`)) return;
  const { error } = await sbAdmin.from('categories').delete().eq('id', id);
  if (error) { alert('Error: ' + error.message); return; }
  showToast(`Deleted "${label}"`, 'deleted');
  await loadCategories();
  buildCategorySelect();
  renderCategoryList();
}

// ── Upload form ───────────────────────────────────────────
function setupForm() {
  const form     = document.getElementById('prompt-form');
  const imgInput = document.getElementById('f-image');
  const preview  = document.getElementById('img-preview');

  imgInput?.addEventListener('change', () => {
    const file = imgInput.files[0];
    if (!file) return;
    preview.src = URL.createObjectURL(file);
    preview.style.display = 'block';
  });

  form?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = document.getElementById('btn-submit');
    btn.disabled = true;
    btn.textContent = 'Uploading...';

    try {
      const editId  = form.dataset.editId || null;
      let image_url = document.getElementById('f-image-url').value.trim() || null;

      const file = imgInput.files[0];
      if (file) {
        const ext = file.name.split('.').pop();
        const filename = `${Date.now()}.${ext}`;
        const { data: upData, error: upErr } = await sbAdmin.storage
          .from('storyboard-images')
          .upload(filename, file, { upsert: false });
        if (upErr) throw upErr;
        const { data: urlData } = sbAdmin.storage
          .from('storyboard-images')
          .getPublicUrl(upData.path);
        image_url = urlData.publicUrl;
      }

      const payload = {
        title:       document.getElementById('f-title').value.trim(),
        description: document.getElementById('f-description').value.trim() || null,
        prompt:      document.getElementById('f-prompt').value.trim(),
        category:    document.getElementById('f-category').value,
        author:      document.getElementById('f-author').value.trim() || 'LeeveoAI',
        tags:        document.getElementById('f-tags').value.split(',').map(t => t.trim()).filter(Boolean),
        image_url,
      };

      if (editId) {
        const { error } = await sbAdmin.from('prompts').update(payload).eq('id', editId);
        if (error) throw error;
        showToast('Updated!', 'success');
        form.dataset.editId = '';
        document.getElementById('form-title').textContent = 'Add New Prompt';
        document.getElementById('btn-submit').textContent = 'Save Prompt';
      } else {
        const { error } = await sbAdmin.from('prompts').insert(payload);
        if (error) throw error;
        showToast('Saved!', 'success');
      }

      form.reset();
      preview.style.display = 'none';
      loadPromptList(currentPage);

    } catch (err) {
      alert('Error: ' + (err.message || JSON.stringify(err)));
    }

    btn.disabled = false;
    btn.textContent = document.getElementById('prompt-form').dataset.editId ? 'Update Prompt' : 'Save Prompt';
  });
}

// ── Bulk bar ──────────────────────────────────────────────
let selectedIds = new Set();

function setupBulkBar() {
  document.getElementById('btn-bulk-delete')?.addEventListener('click', async () => {
    if (!selectedIds.size) return;
    const count = selectedIds.size;
    if (!confirm(`Delete ${count} prompt(s)?`)) return;
    for (const id of selectedIds) {
      await sbAdmin.from('prompts').delete().eq('id', id);
    }
    selectedIds.clear();
    updateBulkBar();
    showToast(`Deleted ${count} prompts.`, 'deleted');
    loadPromptList(currentPage);
  });

  document.getElementById('btn-bulk-cancel')?.addEventListener('click', () => {
    selectedIds.clear();
    updateBulkBar();
    document.querySelectorAll('.row-check').forEach(cb => cb.checked = false);
    document.getElementById('check-all').checked = false;
  });
}

function updateBulkBar() {
  const bar   = document.getElementById('bulk-bar');
  const count = document.getElementById('bulk-count');
  bar.style.display = selectedIds.size > 0 ? 'flex' : 'none';
  count.textContent = `${selectedIds.size} selected`;
}

// ── Prompt list ───────────────────────────────────────────
async function loadPromptList(page = 0) {
  currentPage = page;
  const tbody = document.getElementById('list-body');
  tbody.innerHTML = `<tr class="empty-row"><td colspan="8">Loading...</td></tr>`;
  selectedIds.clear();
  updateBulkBar();

  const from = page * PAGE_ADMIN;
  const to   = from + PAGE_ADMIN - 1;

  const { data, error, count } = await sbAdmin.from('prompts')
    .select('id, title, description, category, author, image_url, created_at', { count: 'exact' })
    .order('created_at', { ascending: false })
    .range(from, to);

  if (error || !data) {
    tbody.innerHTML = `<tr class="empty-row"><td colspan="8">Error loading.</td></tr>`;
    return;
  }

  totalCount = count ?? totalCount;
  const totalPages = Math.ceil(totalCount / PAGE_ADMIN);
  document.getElementById('list-info').textContent =
    `Trang ${page + 1}/${totalPages} — ${totalCount} prompts`;

  if (!data.length) {
    tbody.innerHTML = `<tr class="empty-row"><td colspan="8">No prompts on this page.</td></tr>`;
    renderPagination(page, totalPages);
    return;
  }

  document.getElementById('check-all').onchange = (e) => {
    document.querySelectorAll('.row-check').forEach(cb => {
      cb.checked = e.target.checked;
      if (e.target.checked) selectedIds.add(cb.dataset.id);
      else selectedIds.delete(cb.dataset.id);
    });
    updateBulkBar();
  };

  tbody.innerHTML = '';
  data.forEach((p, i) => {
    const stt      = from + i + 1;
    const catLabel = CATEGORIES.find(c => c.id === p.category)?.label || p.category;
    const thumb    = p.image_url
      ? `<img src="${escHtml(p.image_url)}" class="thumb" alt="" loading="lazy" data-src="${escHtml(p.image_url)}">`
      : `<div class="thumb-empty">🖼</div>`;

    const catOptions = CATEGORIES.filter(c => c.id !== 'all').map(c =>
      `<option value="${c.id}" ${c.id === p.category ? 'selected' : ''}>${c.label}</option>`
    ).join('');

    const tr = document.createElement('tr');
    tr.dataset.id = p.id;
    tr.innerHTML = `
      <td class="td-check"><input type="checkbox" class="row-check" data-id="${p.id}"></td>
      <td class="td-stt">${stt}</td>
      <td class="td-thumb">${thumb}</td>
      <td class="td-title">
        <span class="view-mode">${escHtml(p.title)}</span>
        <div class="edit-mode" style="display:none">
          <input class="qe-title" value="${escHtml(p.title)}" placeholder="Title">
          <input class="qe-desc"  value="${escHtml(p.description || '')}" placeholder="Description">
        </div>
      </td>
      <td>
        <span class="cat-pill view-mode">${escHtml(catLabel)}</span>
        <select class="qe-cat edit-mode" style="display:none">${catOptions}</select>
      </td>
      <td class="view-mode">${escHtml(p.author)}</td>
      <td style="white-space:nowrap">${fmtDate(p.created_at)}</td>
      <td style="white-space:nowrap">
        <button class="tbl-btn qedit-btn"     data-id="${p.id}" title="Quick Edit">✏️</button>
        <button class="tbl-btn save-qe-btn"   data-id="${p.id}" style="display:none" title="Save">💾</button>
        <button class="tbl-btn cancel-qe-btn" data-id="${p.id}" style="display:none" title="Cancel">✕</button>
        <button class="tbl-btn edit-btn"      data-id="${p.id}">Edit Full</button>
        <button class="tbl-btn del-btn"       data-id="${p.id}">Delete</button>
      </td>`;
    tbody.appendChild(tr);

    // Lightbox: click vào thumbnail
    const thumbEl = tr.querySelector('.thumb');
    if (thumbEl) {
      thumbEl.addEventListener('click', () => openLightbox(thumbEl.dataset.src));
    }

    tr.querySelector('.row-check').addEventListener('change', (e) => {
      if (e.target.checked) selectedIds.add(p.id);
      else selectedIds.delete(p.id);
      updateBulkBar();
    });
    tr.querySelector('.qedit-btn').addEventListener('click',     () => toggleQE(tr, true));
    tr.querySelector('.cancel-qe-btn').addEventListener('click', () => toggleQE(tr, false));
    tr.querySelector('.save-qe-btn').addEventListener('click',   () => saveQE(tr, p.id));
    tr.querySelector('.del-btn').addEventListener('click',  () => deletePrompt(p.id));
    tr.querySelector('.edit-btn').addEventListener('click', () => editPrompt(p.id));
  });

  renderPagination(page, totalPages);
}

// ── Pagination ────────────────────────────────────────────
function renderPagination(current, total) {
  const wrap = document.getElementById('pagination');
  wrap.innerHTML = '';
  if (total <= 1) return;

  const btn = (label, page, disabled = false, active = false) => {
    const b = document.createElement('button');
    b.textContent = label;
    b.className = 'pg-btn' + (active ? ' pg-active' : '') + (disabled ? ' pg-disabled' : '');
    b.disabled = disabled;
    if (!disabled) b.addEventListener('click', () => loadPromptList(page));
    return b;
  };

  wrap.appendChild(btn('«', 0, current === 0));
  wrap.appendChild(btn('‹', current - 1, current === 0));
  const start = Math.max(0, current - 3);
  const end   = Math.min(total - 1, start + 6);
  for (let i = start; i <= end; i++) wrap.appendChild(btn(i + 1, i, false, i === current));
  wrap.appendChild(btn('›', current + 1, current === total - 1));
  wrap.appendChild(btn('»', total - 1, current === total - 1));
}

// ── Quick Edit ────────────────────────────────────────────
function toggleQE(tr, on) {
  tr.querySelectorAll('.view-mode').forEach(el => el.style.display = on ? 'none' : '');
  tr.querySelectorAll('.edit-mode').forEach(el => el.style.display = on ? '' : 'none');
  tr.querySelector('.qedit-btn').style.display     = on ? 'none' : '';
  tr.querySelector('.save-qe-btn').style.display   = on ? '' : 'none';
  tr.querySelector('.cancel-qe-btn').style.display = on ? '' : 'none';
  tr.classList.toggle('qe-active', on);
  if (on) tr.querySelector('.qe-title').focus();
}

async function saveQE(tr, id) {
  const title = tr.querySelector('.qe-title').value.trim();
  const desc  = tr.querySelector('.qe-desc').value.trim();
  const cat   = tr.querySelector('.qe-cat').value;
  if (!title) { alert('Title cannot be empty'); return; }
  const { error } = await sbAdmin.from('prompts').update({
    title, description: desc || null, category: cat
  }).eq('id', id);
  if (error) { alert('Error: ' + error.message); return; }
  showToast('Updated!', 'success');
  loadPromptList(currentPage);
}

// ── Delete / Edit full ────────────────────────────────────
async function deletePrompt(id) {
  if (!confirm('Delete this prompt?')) return;
  await sbAdmin.from('prompts').delete().eq('id', id);
  showToast('Deleted.', 'deleted');
  loadPromptList(currentPage);
}

async function editPrompt(id) {
  const { data } = await sbAdmin.from('prompts').select('*').eq('id', id).single();
  if (!data) return;

  document.getElementById('form-title').textContent = 'Edit Prompt';
  document.getElementById('f-title').value          = data.title;
  document.getElementById('f-description').value    = data.description || '';
  document.getElementById('f-prompt').value         = data.prompt;
  document.getElementById('f-category').value       = data.category;
  document.getElementById('f-author').value         = data.author || '';
  document.getElementById('f-tags').value           = (data.tags || []).join(', ');
  document.getElementById('f-image-url').value      = data.image_url || '';

  if (data.image_url) {
    const preview = document.getElementById('img-preview');
    preview.src = data.image_url;
    preview.style.display = 'block';
  }

  document.getElementById('prompt-form').dataset.editId = id;
  document.getElementById('btn-submit').textContent     = 'Update Prompt';
  document.getElementById('prompt-form').scrollIntoView({ behavior: 'smooth' });
}

// ── Utils ─────────────────────────────────────────────────
function showToast(msg, type = 'success') {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.className = '';
  t.classList.add('show', type);
  setTimeout(() => t.classList.remove('show'), 2500);
}
function escHtml(s) {
  return String(s ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}
function fmtDate(iso) {
  if (!iso) return '';
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}
