import {
  getMetadata,
  getIconElement,
  createTag,
  fetchPlaceholders,
  getMobileOperatingSystem,
} from '../../scripts/utils.js';

let activeDrawer = null;
function deactivateDrawer() {
  if (!activeDrawer) return;
  activeDrawer.closest('.card').setAttribute('aria-expanded', false);
  activeDrawer.setAttribute('aria-hidden', true);
  activeDrawer.querySelector('video')?.pause();
  activeDrawer = null;
}
function activateDrawer(drawer) {
  deactivateDrawer();
  drawer.closest('.card').setAttribute('aria-expanded', true);
  drawer.setAttribute('aria-hidden', false);
  const video = drawer.querySelector('video');
  if (video) {
    video.muted = true;
    const playPromise = video.play();
    if (playPromise !== undefined) {
      playPromise.catch(() => {
        // ignore
      });
    }
  }
  activeDrawer = drawer;
}
document.addEventListener('click', (e) => {
  if (!activeDrawer) return;
  if (!activeDrawer.closest('.card').contains(e.target)) {
    deactivateDrawer();
  }
});

function createDrawer(card, title, panels) {
  const titleRow = createTag('div', { class: 'title-row' });
  const titleText = title.textContent.trim();
  const drawer = createTag('div', { class: 'drawer', id: `drawer-${titleText}`, 'aria-hidden': true });
  const closeButton = createTag('button', { 'aria-label': 'close' }, getIconElement('close-black'));
  closeButton.addEventListener('click', (e) => {
    e.stopPropagation();
    deactivateDrawer();
  });
  titleRow.append(createTag('strong', { class: 'drawer-title' }, titleText), closeButton);
  drawer.append(titleRow);
  const videoAnchor = card.querySelector('a');
  videoAnchor.remove();
  const video = createTag('video', {
    playsinline: '',
    muted: '',
    loop: '',
    preload: 'metadata',
    title: titleText,
    poster: card.querySelector('img').src,
  }, `<source src="${videoAnchor.href}" type="video/mp4">`);
  const videoWrapper = createTag('div', { class: 'video-container' });
  videoWrapper.append(video);
  drawer.append(videoWrapper);
  drawer.append(...panels);

  panels.forEach((panel) => {
    panel.classList.add('ctas-container');
    [...panel.querySelectorAll('p')].forEach((p) => {
      const icon = p.querySelector('span.icon');
      const match = icon && /icon-(.+)/.exec(icon.classList);
      if (match?.[1]) {
        icon.append(getIconElement(match[1]));
      }
      const anchor = p.querySelector('a');
      if (anchor) {
        anchor.prepend(icon);
        p.replaceWith(anchor);
      }
    });
  });
  if (panels.length <= 1) {
    return drawer;
  }

  const tabList = createTag('div', { role: 'tablist' });
  let activeTab = null;
  panels.forEach((panel, i) => {
    panel.role = 'tabpanel';
    const tabHead = panel.querySelector('p:not(:has(a))');
    const tabName = tabHead.textContent;
    const id = `${titleText}-${tabName}`;
    tabHead.remove();
    panel.setAttribute('aria-labelledby', `tab-${id}`);
    panel.id = `panel-${id}`;
    i > 0 && (panel.setAttribute('aria-hidden', true));
    const tab = createTag('button', {
      role: 'tab',
      'aria-selected': i === 0,
      'aria-controls': `panel-${id}`,
      id: `tab-${id}`,
    }, tabName);
    activeTab ||= tab;
    tab.addEventListener('click', () => {
      activeTab.setAttribute('aria-selected', false);
      tab.setAttribute('aria-selected', true);
      panels.forEach((p) => {
        p.setAttribute('aria-hidden', p !== panel);
      });
      activeTab = tab;
    });
    tabList.append(tab);
  });

  panels[0].before(tabList);

  return drawer;
}
const mediaQuery = window.matchMedia('(min-width: 1200px)');
function convertToCard(item) {
  const title = item.querySelector('strong');
  const card = createTag('button', {
    class: 'card',
    'aria-controls': `drawer-${title.textContent.trim()}`,
    'aria-expanded': false,
  });
  while (item.firstChild) card.append(item.firstChild);
  item.remove();
  const cols = [...card.querySelectorAll(':scope > div')];
  const face = cols[0];
  const drawer = createDrawer(card, title, cols.slice(1));
  face.classList.add('face');
  card.append(drawer);
  card.addEventListener('click', (e) => {
    if (activeDrawer) return;
    e.stopPropagation();
    activateDrawer(drawer);
  });
  card.addEventListener('mouseenter', () => {
    const firstElem = drawer.querySelector('button, a');
    activateDrawer(drawer);
    firstElem?.focus();
  });
  card.addEventListener('focusin', (e) => {
    if (card.contains(e.relatedTarget)) return;
    activateDrawer(drawer);
  });
  card.addEventListener('mouseleave', deactivateDrawer);
  card.addEventListener('focusout', (e) => {
    if (card.contains(e.relatedTarget)) return;
    deactivateDrawer();
  });
  return card;
}

function decorateHeadline(headline) {
  headline.classList.add('headline');
  const ctas = [...headline.querySelectorAll('a')];
  if (!ctas.length) return headline;
  const ctasContainer = ctas[0].parentElement;
  ctasContainer.classList.add('ctas-container');
  ctas.forEach((cta) => cta.classList.add('button'));
  ctas[0].classList.add('primaryCTA');
  headline.querySelectorAll('p');
  return headline;
}

async function decorateRatings(el, store) {
  const placeholders = await fetchPlaceholders();
  const ratings = placeholders['app-store-ratings']?.split(';') || [];
  const link = ratings[2]?.trim();
  if (!link) {
    el.remove();
    return;
  }
  const [score, cnt] = ratings[['apple', 'google'].indexOf(store)].split(',').map((str) => str.trim());
  const star = getIconElement('star');
  const storeLink = createTag('a', { href: link }, getIconElement(`${store}-store`));
  const { default: trackBranchParameters } = await import('../../scripts/branchlinks.js');
  await trackBranchParameters([storeLink]);
  el.append(score, star, cnt, storeLink);
}

function createRatings() {
  const ratings = createTag('div', { class: 'ratings' });
  const userAgent = getMobileOperatingSystem();
  if (userAgent !== 'Android') {
    const el = createTag('div', { class: 'container' });
    ratings.append(el);
    decorateRatings(el, 'apple');
  }
  if (userAgent !== 'iOS') {
    const el = createTag('div', { class: 'container' });
    ratings.append(el);
    decorateRatings(el, 'google');
  }
  return ratings;
}

export default function init(el) {
  const rows = [...el.querySelectorAll(':scope > div')];
  const headline = decorateHeadline(rows[0]);
  const background = rows[1];
  const items = rows.slice(2);
  background.classList.add('background');
  const foreground = createTag('div', { class: 'foreground' });
  const cards = items.map((item) => convertToCard(item));
  const cardsContainer = createTag('div', { class: 'cards-container' });
  cardsContainer.append(...cards);
  foreground.append(headline, cardsContainer);
  if (document.querySelector('main .block') === el && ['on', 'yes'].includes(getMetadata('marquee-inject-logo')?.toLowerCase())) {
    const logo = getIconElement('adobe-express-logo');
    logo.classList.add('express-logo');
    foreground.prepend(logo);
  }
  if (el.classList.contains('ratings')) foreground.append(createRatings());
  el.append(foreground);
  mediaQuery.addEventListener('change', deactivateDrawer);
}
// delay dom for tablet/desktop?
