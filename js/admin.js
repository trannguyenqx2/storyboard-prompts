// admin.js — admin panel logic

// ── Service Role Key ──────────────────────────────────────
const SUPABASE_SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imx5ZWZ1dnl6YmF5dnB4a2JhcnZoIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4MDMzOTkyNywiZXhwIjoyMDk1OTE1OTI3fQ.qkTArgy0_AZ3ohS5Ixw3EVrrWE014piMeJtlyftAWtE';

const sbAdmin = supabase.createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

// ── Auth ──────────────────────────────────────────────────
const ADMIN_PASSWORD = 'Tomato1401@!#';

document.addEventListener('DOMContentLoaded', () => {
  checkAuth();
});

function checkAuth() {
  const authed = sessionStorage.getItem('admin_authed');
  if (authed === '1') {
    showPanel();
    loadPromptList();
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
    loadPromptList();
  } else {
    document.getElementById('auth-error').textContent = 'Wrong password.';
  }
});

function showPanel() {
  document.getElementById('admin-panel').style.display = 'block';
  setupForm();
  setupBulkBar();
}

// ── Upload form ───────────────────────────────────────────
function setupForm() {
  const form = document.getElementById('prompt-form');
  const imgInput = document.getElementById('f-image');
  const preview = document.getElementById('img-preview');

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
      const editId = form.dataset.editId || null;
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
      loadPromptList();

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
    if (!confirm(`Delete ${selectedIds.size} prompt(s)?`)) return;
    for (const id of selectedIds) {
      await sbAdmin.from('prompts').delete().eq('id', id);
    }
    selectedIds.clear();
    updateBulkBar();
    showToast(`Deleted ${selectedIds.size || 'selected'} prompts.`, 'deleted');
    loadPromptList();
  });

  document.getElementById('btn-bulk-cancel')?.addEventListener('click', () => {
    selectedIds.clear();
    updateBulkBar();
    document.querySelectorAll('.row-check').forEach(cb => cb.checked = false);
    document.getElementById('check-all').checked = false;
  });
}

function updateBulkBar() {
  const bar = document.getElementById('bulk-bar');
  const count = document.getElementById('bulk-count');
  if (selectedIds.size > 0) {
    bar.style.display = 'flex';
    count.textContent = `${selectedIds.size} selected`;
  } else {
    bar.style.display = 'none';
  }
}

// ── Prompt list ───────────────────────────────────────────
async function loadPromptList() {
  const tbody = document.getElementById('list-body');
  tbody.innerHTML = '<tr class="empty-row"><td colspan="8">Loading...</td></tr>';
  selectedIds.clear();
  updateBulkBar();

  const { data, error } = await sbAdmin.from('prompts')
    .select('id, title, description, category, author, image_url, created_at')
    .order('created_at', { ascending: false })
    .limit(200);

  if (error || !data) {
    tbody.innerHTML = '<tr class="empty-row"><td colspan="8">Error loading.</td></tr>';
    return;
  }

  if (!data.length) {
    tbody.innerHTML = '<tr class="empty-row"><td colspan="8">No prompts yet. Add one!</td></tr>';
    return;
  }

  // Check-all header
  document.getElementById('check-all').onchange = (e) => {
    document.querySelectorAll('.row-check').forEach(cb => {
      cb.checked = e.target.checked;
      const id = cb.dataset.id;
      if (e.target.checked) selectedIds.add(id);
      else selectedIds.delete(id);
    });
    updateBulkBar();
  };

  tbody.innerHTML = '';
  data.forEach((p, i) => {
    const catLabel = CATEGORIES.find(c => c.id === p.category)?.label || p.category;
    const thumb = p.image_url
      ? `<img src="${escHtml(p.image_url)}" class="thumb" alt="" loading="lazy">`
      : `<div class="thumb-empty">—</div>`;

    const tr = document.createElement('tr');
    tr.dataset.id = p.id;
    tr.innerHTML = `
      <td><input type="checkbox" class="row-check" data-id="${p.id}"></td>
      <td class="td-stt">${i + 1}</td>
      <td>${thumb}</td>
      <td class="td-title">
        <span class="view-mode">${escHtml(p.title)}</span>
        <div class="edit-mode" style="display:none">
          <input class="qe-title" value="${escHtml(p.title)}" placeholder="Title">
          <input class="qe-desc" value="${escHtml(p.description || '')}" placeholder="Description" style="margin-top:4px;font-size:11px;color:#6b7280">
        </div>
      </td>
      <td>
        <span class="cat-pill view-mode">${escHtml(catLabel)}</span>
        <select class="qe-cat edit-mode" style="display:none">
          ${CATEGORIES.filter(c=>c.id!=='all').map(c=>`<option value="${c.id}" ${c.id===p.category?'selected':''}>${c.label}</option>`).join('')}
        </select>
      </td>
      <td class="view-mode">${escHtml(p.author)}</td>
      <td style="white-space:nowrap">${fmtDate(p.created_at)}</td>
      <td style="white-space:nowrap">
        <button class="tbl-btn qedit-btn" data-id="${p.id}" title="Quick Edit">✏️</button>
        <button class="tbl-btn save-qe-btn" data-id="${p.id}" style="display:none" title="Save">💾</button>
        <button class="tbl-btn cancel-qe-btn" data-id="${p.id}" style="display:none" title="Cancel">✕</button>
        <button class="tbl-btn edit-btn" data-id="${p.id}">Edit Full</button>
        <button class="tbl-btn del-btn" data-id="${p.id}">Delete</button>
      </td>`;
    tbody.appendChild(tr);

    // Checkbox
    tr.querySelector('.row-check').addEventListener('change', (e) => {
      if (e.target.checked) selectedIds.add(p.id);
      else selectedIds.delete(p.id);
      updateBulkBar();
    });

    // Quick Edit toggle
    tr.querySelector('.qedit-btn').addEventListener('click', () => toggleQE(tr, true));
    tr.querySelector('.cancel-qe-btn').addEventListener('click', () => toggleQE(tr, false));
    tr.querySelector('.save-qe-btn').addEventListener('click', () => saveQE(tr, p.id));

    // Full edit / delete
    tr.querySelector('.del-btn').addEventListener('click', () => deletePrompt(p.id));
    tr.querySelector('.edit-btn').addEventListener('click', () => editPrompt(p.id));
  });
}

function toggleQE(tr, on) {
  tr.querySelectorAll('.view-mode').forEach(el => el.style.display = on ? 'none' : '');
  tr.querySelectorAll('.edit-mode').forEach(el => el.style.display = on ? '' : 'none');
  tr.querySelector('.qedit-btn').style.display  = on ? 'none' : '';
  tr.querySelector('.save-qe-btn').style.display   = on ? '' : 'none';
  tr.querySelector('.cancel-qe-btn').style.display = on ? '' : 'none';
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
  loadPromptList();
}

async function deletePrompt(id) {
  if (!confirm('Delete this prompt?')) return;
  await sbAdmin.from('prompts').delete().eq('id', id);
  showToast('Deleted.', 'deleted');
  loadPromptList();
}

async function editPrompt(id) {
  const { data } = await sbAdmin.from('prompts').select('*').eq('id', id).single();
  if (!data) return;

  document.getElementById('form-title').textContent = 'Edit Prompt';
  document.getElementById('f-title').value       = data.title;
  document.getElementById('f-description').value = data.description || '';
  document.getElementById('f-prompt').value      = data.prompt;
  document.getElementById('f-category').value    = data.category;
  document.getElementById('f-author').value      = data.author || '';
  document.getElementById('f-tags').value        = (data.tags || []).join(', ');
  document.getElementById('f-image-url').value   = data.image_url || '';

  if (data.image_url) {
    const preview = document.getElementById('img-preview');
    preview.src = data.image_url;
    preview.style.display = 'block';
  }

  document.getElementById('prompt-form').dataset.editId = id;
  document.getElementById('btn-submit').textContent = 'Update Prompt';
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
