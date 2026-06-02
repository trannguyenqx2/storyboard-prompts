// detail.js — single prompt detail page

document.addEventListener('DOMContentLoaded', async () => {
  const params = new URLSearchParams(location.search);
  const id = params.get('id');

  if (!id) { showError('No prompt ID specified.'); return; }

  const { data, error } = await sb.from('prompts')
    .select('*')
    .eq('id', id)
    .single();

  if (error || !data) { showError('Prompt not found.'); return; }

  document.title = `${data.title} — Storyboard Prompts`;

  document.getElementById('detail-category').textContent =
    CATEGORIES.find(c => c.id === data.category)?.label || data.category;

  document.getElementById('detail-date').textContent = fmtDate(data.created_at);
  document.getElementById('detail-title').textContent = data.title;
  document.getElementById('detail-author').textContent = data.author || 'Anonymous';
  document.getElementById('detail-prompt').textContent = data.prompt;

  // Description
  const descEl = document.getElementById('detail-desc');
  if (data.description) {
    descEl.textContent = data.description;
    descEl.style.display = 'block';
  } else {
    descEl.style.display = 'none';
  }

  if (data.image_url) {
    const img = document.getElementById('detail-img');
    img.src = data.image_url;
    img.alt = data.title;
    img.style.display = 'block';
  }

  if (data.tags?.length) {
    const tagsEl = document.getElementById('detail-tags');
    data.tags.forEach(t => {
      const span = document.createElement('span');
      span.className = 'tag';
      span.textContent = t;
      tagsEl.appendChild(span);
    });
  }

  // Copy button
  document.getElementById('btn-copy-full').addEventListener('click', async (e) => {
    try {
      await navigator.clipboard.writeText(data.prompt);
      const btn = e.currentTarget;
      btn.textContent = '✓ Copied!';
      btn.classList.add('copied');
      setTimeout(() => { btn.textContent = 'Copy Prompt'; btn.classList.remove('copied'); }, 2000);
    } catch { /* ignore */ }
  });

  // Load related
  loadRelated(data.category, data.id);
});

async function loadRelated(category, excludeId) {
  const { data } = await sb.from('prompts')
    .select('id, title, image_url, category')
    .eq('category', category)
    .neq('id', excludeId)
    .order('created_at', { ascending: false })
    .limit(4);

  if (!data?.length) return;

  const section = document.getElementById('related-section');
  const grid = document.getElementById('related-grid');
  section.style.display = 'block';

  data.forEach(p => {
    const card = document.createElement('a');
    card.className = 'related-card';
    card.href = `detail.html?id=${p.id}`;
    const img = p.image_url
      ? `<img src="${escHtml(p.image_url)}" alt="${escHtml(p.title)}" loading="lazy">`
      : `<div class="related-no-img"></div>`;
    card.innerHTML = `${img}<span>${escHtml(p.title)}</span>`;
    grid.appendChild(card);
  });
}

function showError(msg) {
  document.getElementById('detail-content').innerHTML =
    `<div class="error-msg">${msg} <a href="index.html">← Back</a></div>`;
}

function escHtml(s) {
  return String(s ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}
function fmtDate(iso) {
  if (!iso) return '';
  return new Date(iso).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
}
