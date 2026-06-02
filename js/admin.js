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

// ── Prompt list ───────────────────────────────────────────
async function loadPromptList() {
  const tbody = document.getElementById('list-body');
  tbody.innerHTML = '<tr class="empty-row"><td colspan="5">Loading...</td></tr>';

  const { data, error } = await sbAdmin.from('prompts')
    .select('id, title, category, author, created_at')
    .order('created_at', { ascending: false })
    .limit(100);

  if (error || !data) {
    tbody.innerHTML = '<tr class="empty-row"><td colspan="5">Error loading.</td></tr>';
    return;
  }

  if (!data.length) {
    tbody.innerHTML = '<tr class="empty-row"><td colspan="5">No prompts yet. Add one!</td></tr>';
    return;
  }

  tbody.innerHTML = '';
  data.forEach(p => {
    const tr = document.createElement('tr');
    const catLabel = CATEGORIES.find(c => c.id === p.category)?.label || p.category;
    tr.innerHTML = `
      <td class="td-title"><span>${escHtml(p.title)}</span></td>
      <td><span class="cat-pill">${escHtml(catLabel)}</span></td>
      <td>${escHtml(p.author)}</td>
      <td style="white-space:nowrap">${fmtDate(p.created_at)}</td>
      <td style="white-space:nowrap">
        <button class="tbl-btn edit-btn" data-id="${p.id}">Edit</button>
        <button class="tbl-btn del-btn" data-id="${p.id}">Delete</button>
      </td>`;
    tbody.appendChild(tr);
  });

  tbody.querySelectorAll('.del-btn').forEach(btn => {
    btn.addEventListener('click', () => deletePrompt(btn.dataset.id));
  });
  tbody.querySelectorAll('.edit-btn').forEach(btn => {
    btn.addEventListener('click', () => editPrompt(btn.dataset.id));
  });
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
