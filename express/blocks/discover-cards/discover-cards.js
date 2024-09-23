import { createTag } from '../../scripts/utils.js';
import buildGallery from '../../features/gallery/gallery.js';

export default async function decorate(block) {
  const isBottomImageVariant = block.classList.contains('bottom-image');
  const firstChild = block.querySelector(':scope > div:first-child');

  if (firstChild && firstChild.querySelector('h3')) {
    firstChild.classList.add('centered-title');
    block.insertBefore(firstChild, block.firstChild);
  }

  const cardsWrapper = createTag('div', {
    class: 'cards-container',
  });

  const cards = block.querySelectorAll(':scope > div');

  cards.forEach((card, index) => {
    if (index === 0 && firstChild) return;
    card.classList.add('card');
    if (isBottomImageVariant) {
      card.classList.add('short');
    }
    cardsWrapper.appendChild(card);

    const cardDivs = [...card.children];
    if (isBottomImageVariant && cardDivs.length >= 2) {
      const parent = cardDivs[0].parentNode;
      parent.insertBefore(cardDivs[1], cardDivs[0]);
      parent.insertBefore(cardDivs[0], cardDivs[1].nextSibling);
    }

    cardDivs.forEach((element) => {
      const textHeader = element.querySelector('h4');
      const textBody = element.querySelector('p');
      if (textHeader && textBody && !isBottomImageVariant) {
        textHeader.style.textAlign = 'left';
        textBody.style.marginTop = '5px';
        textBody.style.marginBottom = '5px';
        element.style.textAlign = 'left';
      }

      if (textHeader && textBody && isBottomImageVariant) {
        textHeader.style.fontWeight = 600;
        textHeader.style.fontSize = '18px';
        textHeader.style.textAlign = 'left';
        element.style.textAlign = 'left';
        element.style.display = 'contents';
        textBody.style.marginTop = '5px';
        textBody.style.marginBottom = '5px';
        textBody.style.fontSize = '14px';
      }

      const image = element.querySelector('picture img');
      if (image && isBottomImageVariant) {
        image.classList.add('tall');
        image.classList.remove('short');
      }
      if (image && !isBottomImageVariant) {
        image.classList.add('short');
        image.classList.remove('tall');
      }

      if (element.tagName === 'H2') {
        element.classList.add('card-title');
      } else if (element.querySelector('a.button')) {
        element.classList.add('cta-section');
      }
    });
  });

  block.appendChild(cardsWrapper);

  await buildGallery(cards, cardsWrapper);
}