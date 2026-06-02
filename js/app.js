// app.js — main gallery page logic

let state = {
  category: 'all',
  search: '',
  page: 0,
  hasMore: true,
  loading: false,
  items: [],
};

const grid      = document.getElementById('grid');
const sentinel  = document.getElementById('sentinel');
const searchEl  = document.getElementById('search');
const countEl   = document.getElementById('count');
const skeletons = document.getElementById('skeletons');

document.addEventListener('DOMContentLoaded', () => {
  buildCategoryTabs();
  const params = new URLSearchParams(location.search);
  const cat = params.get('categories');
  if (cat) setCategory(cat);
  loadPage(true);
  setupIntersectionObserver();
  setupSearch();
});

function buildCategoryTabs() {
  const nav = document.getElementById('cat-nav');
  CATEGORIES.forEach(c => {
    const btn = document.createElement('button');
    btn.className = 'cat-btn' + (c.id === state.category ? ' active' : '');
    btn.dataset.id = c.id;
    btn.textContent = c.label;
    btn.addEventListener('click', () => setCategory(c.id));
    nav.appendChild(btn);
  });
}

function setCategory(id) {
  state.category = id;
  document.querySelectorAll('.cat-btn').forEach(b => {
    b.classList.toggle('active', b.dataset.id === id);
  });
  const url = new URL(location);
  if (id === 'all') url.searchParams.delete('categories');
  else url.searchParams.set('categories', id);
  history.replaceState(null, '', url);
  loadPage(true);
}

function setupSearch() {
  let timer;
  searchEl.addEventListener('input', () => {
    clearTimeout(timer);
    timer = setTimeout(() => {
      state.search = searchEl.value.trim();
      loadPage(true);
    }, 350);
  });
}

async function loadPage(reset = false) {
  if (state.loading) return;
  if (!reset && !state.hasMore) return;

  state.loading = true;
  if (reset) {
    state.page = 0;
    state.items = [];
    state.hasMore = true;
    grid.innerHTML = '';
  }

  showSkeletons(true);

  let query = sb.from('prompts')
    .select('id, title, description, prompt, category, image_url, author, tags, created_at', { count: 'exact' })
    .order('created_at', { ascending: false })
    .range(state.page * PAGE_SIZE, (state.page + 1) * PAGE_SIZE - 1);

  if (state.category !== 'all')
    query = query.eq('category', state.category);

  if (state.search)
    query = query.textSearch('fts', state.search, { type: 'websearch' });

  const { data, error, count } = await query;

  showSkeletons(false);
  state.loading = false;

  if (error) { console.error(error); return; }

  if (reset && countEl) countEl.textContent = `${count ?? 0} prompts`;

  if (!data || data.length < PAGE_SIZE) state.hasMore = false;
  state.items = [...state.items, ...(data || [])];
  state.page++;

  renderCards(data || [], reset);
}

function renderCards(items, reset) {
  if (reset && items.length === 0) {
    grid.innerHTML = `<div class="empty">No prompts found. Try a different search.</div>`;
    return;
  }

  items.forEach((p, i) => {
    const card = document.createElement('article');
    card.className = 'card';
    card.style.animationDelay = `${(i % PAGE_SIZE) * 40}ms`;

    const img = p.image_url
      ? `<div class="card-img"><img src="${escHtml(p.image_url)}" alt="${escHtml(p.title)}" loading="lazy"></div>`
      : `<div class="card-img no-img"><span>${escHtml(p.category)}</span></div>`;

    const descHtml = p.description
      ? `<p class="card-desc">${escHtml(p.description.length > 90 ? p.description.slice(0, 90) + '…' : p.description)}</p>`
      : '';

    const excerpt = p.prompt.length > 100
      ? escHtml(p.prompt.slice(0, 100)) + '…'
      : escHtml(p.prompt);

    const catLabel = CATEGORIES.find(c => c.id === p.category)?.label || p.category;

    card.innerHTML = `
      ${img}
      <div class="card-body">
        <div class="card-meta">
          <span class="card-cat">${escHtml(catLabel)}</span>
          <span class="card-date">${fmtDate(p.created_at)}</span>
        </div>
        <h2 class="card-title">${escHtml(p.title)}</h2>
        ${descHtml}
        <p class="card-excerpt">${excerpt}</p>
        <div class="card-footer">
          <button class="btn-copy" title="Copy prompt">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
            Copy
          </button>
          <a class="btn-view" href="detail.html?id=${p.id}">View →</a>
        </div>
      </div>`;

    card.querySelector('.btn-copy').addEventListener('click', (e) => {
      e.preventDefault();
      copyPrompt(p.prompt, e.currentTarget);
    });

    grid.appendChild(card);
  });
}

function setupIntersectionObserver() {
  const obs = new IntersectionObserver(entries => {
    if (entries[0].isIntersecting) loadPage();
  }, { rootMargin: '200px' });
  obs.observe(sentinel);
}

async function copyPrompt(text, btn) {
  try {
    await navigator.clipboard.writeText(text);
    const orig = btn.innerHTML;
    btn.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg> Copied!`;
    btn.classList.add('copied');
    setTimeout(() => { btn.innerHTML = orig; btn.classList.remove('copied'); }, 1800);
  } catch { btn.textContent = 'Error'; }
}

function showSkeletons(show) {
  if (!skeletons) return;
  skeletons.style.display = show ? 'contents' : 'none';
}

function escHtml(s) {
  return String(s ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}
function fmtDate(iso) {
  if (!iso) return '';
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}
