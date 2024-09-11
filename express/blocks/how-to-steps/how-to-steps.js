/* eslint-disable import/named, import/extensions */

import {
  createTag,
// eslint-disable-next-line import/no-unresolved
} from '../../scripts/utils.js';

export default function decorate($block, name, doc) {
  const $howto = $block;
  const $heading = $howto.closest('.section').querySelector('h2, h3, h4');
  const $rows = Array.from($howto.children);

  let numberStepStart = 1;
  const isStepNumberDefined = $rows[0].innerHTML.includes('number-step-start');
  if (isStepNumberDefined) {
    numberStepStart = +$rows[0].querySelectorAll('div')[1].innerText.trim();
    $rows[0].remove();
  }

  const narrowVariant = $block?.classList.contains('narrow');
  const container = document.querySelector('div.how-to-steps.block');
  const desktop = document.body.dataset.device === 'desktop';
  if (desktop && narrowVariant && container) {
    container.classList.add('narrow');
  } else if (narrowVariant && container) {
    container.classList.remove('narrow');
    container.classList.add('narrow-mobile-width');
  }

  const includeSchema = !$block.classList.contains('noschema');

  const schema = {
    '@context': 'http://schema.org',
    '@type': 'HowTo',
    name: ($heading && $heading.textContent.trim()) || document.title,
    step: [],
  };

  $rows.forEach(($row, i) => {
    const $cells = Array.from($row.children);
    schema.step.push({
      '@type': 'HowToStep',
      position: i + 1,
      name: $cells[0].textContent.trim(),
      itemListElement: {
        '@type': 'HowToDirection',
        text: $cells[1].textContent.trim(),
      },
    });
    const $h3 = createTag('h3');
    $h3.innerHTML = $cells[0].textContent.trim();
    const $p = createTag('p');
    $p.innerHTML = $cells[1].innerHTML;
    const $text = createTag('div', { class: 'tip-text' });
    $text.append($h3);
    $text.append($p);
    const $number = createTag('div', { class: 'tip-number' }, `<span>${i + numberStepStart - 1}</span>`);
    $cells[0].remove();
    $cells[1].innerHTML = '';
    $cells[1].classList.add('tip');
    $cells[1].append($number);
    $cells[1].append($text);
  });

  if (includeSchema) {
    const $schema = createTag('script', { type: 'application/ld+json' });
    $schema.innerHTML = JSON.stringify(schema);
    const $head = doc.head;
    $head.append($schema);
  }
}
