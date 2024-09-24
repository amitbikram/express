import { createTag } from '../../scripts/utils.js';
import buildGallery from '../../features/gallery/gallery.js';

export default async function decorate(block) {
  const isBottomImageVariant = block.classList.contains('bottom-image');
  block.classList.toggle('no-bg', isBottomImageVariant);
  const firstChild = block.querySelector(':scope > div:first-child');

  if (firstChild && firstChild.querySelector('h3')) {
    firstChild.classList.add('centered-title');
    block.insertBefore(firstChild, block.firstChild);
  }

  const cardsWrapper = createTag('div', {
    class: 'cards-container',
  });

  const cards = block.querySelectorAll(':scope > div');
  const subHeader = firstChild.querySelector('h4');
  if (isBottomImageVariant) {
    subHeader.classList.add('sub-header');
  } else if (subHeader) {
    subHeader.style.display = 'none';
    firstChild.style.marginBottom = '30px';
  }

  cards.forEach((card, index) => {
    if (index === 0 && firstChild) return;
    card.classList.add('card');
    card.classList.toggle('short', isBottomImageVariant);
    card.classList.toggle('image-bottom', isBottomImageVariant);

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
        textHeader.classList.add('header');
        textBody.classList.add('body');
        element.classList.add('text-content');
      }

      if (textHeader && textBody && isBottomImageVariant) {
        textHeader.style.fontWeight = 600;
        textHeader.style.fontSize = '17px';
        textHeader.style.textAlign = 'left';
        element.style.textAlign = 'left';
        element.style.display = 'contents';
        textBody.classList.add('small-text-content');
      }

      if (element.classList.contains('button-container')) {
        element.classList.toggle('center-button', isBottomImageVariant);
      }

      const image = element.querySelector('picture img');
      if (image) {
        image.classList.add(isBottomImageVariant ? 'tall' : 'short');
        image.classList.remove(isBottomImageVariant ? 'short' : 'tall');
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