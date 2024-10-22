import {
  createTag, getConfig, loadBlock, toClassName,
  // eslint-disable-next-line import/no-unresolved
} from '../../scripts/utils.js';

const docTitle = document.title;

export const getAvailableVimeoSubLang = () => {
  const langs = {
    fr: 'fr',
    de: 'de',
    jp: 'ja',
  };
  return langs[getConfig().locale.prefix.replace('/', '')] || 'en';
};

export async function fetchVideoAnalytics() {
  if (!window.videoAnalytics) {
    window.videoAnalytics = [];
    try {
      const resp = await fetch('/express/video-analytics.json');
      const json = await resp.json();
      json.data.forEach((entry) => {
        window.videoAnalytics.push(entry);
      });
    } catch (e) {
      // ignore
    }
  }
  return window.videoAnalytics;
}

async function getVideoAnalytic($video) {
  const videoAnalytics = await fetchVideoAnalytics();
  let videoAnalytic;

  videoAnalytics.forEach((analytic) => {
    if (window.location.pathname.includes(analytic.Page)) {
      const filenames = analytic.Filenames ? analytic.Filenames.split('\n') : [];

      filenames.forEach((filename) => {
        if ($video.currentSrc.includes(filename)) {
          videoAnalytic = {
            video: $video,
            parameters: {
              videoName: analytic.videoName ?? null,
              videoId: analytic.videoId ?? null,
              videoLength: $video.duration,
              product: 'Adobe Express',
              videoCategory: 'default',
              videoDescription: analytic.videoDescription ?? null,
              videoPlayer: 'html5-video',
              videoMediaType: 'VOD',
            },
          };
        }
      });
    }
  });

  return videoAnalytic;
}

async function fetchVideoPromotions() {
  if (!window.videoPromotions) {
    window.videoPromotions = {};
    try {
      const { prefix } = getConfig().locale;
      const resp = await fetch(`${prefix}/express/video-promotions.json`);
      const json = await resp.json();
      json.data.forEach((entry) => {
        const video = entry.Video;
        if (video) {
          window.videoPromotions[new URL(video).pathname] = entry.Promotion;
        }
      });
    } catch (e) {
      // ignore
    }
  }
  return window.videoPromotions;
}

function showVideoPromotion($video, vid) {
  const $promo = window.videoPromotions && window.videoPromotions[vid];
  const $overlay = $video.closest('.video-overlay');
  if ($promo && $promo.parentElement !== $overlay) {
    $overlay.append($promo);
    closeVideo($video)
    $promo.classList.add('appear');
  }
}

function getMimeType(src) {
  if (src.endsWith('.m3u8')) {
    return 'application/x-mpegURL';
  }
  return `video/${src.split('.').pop()}`;
}

function buildVideoElement($element, vidUrls = [], playerType, title, ts, autoplay) {
  const [primaryUrl] = vidUrls;
  if (!primaryUrl) return;
  if (playerType === 'html5') {
    const sources = vidUrls.map((src) => `<source src="${src}" type="${getMimeType(src)}"></source>`).join('');
    const videoHTML = `<video controls playsinline>${sources}</video>`;
    $element.innerHTML = videoHTML;
    const $video = $element.querySelector('video');
    $video.addEventListener('loadeddata', async () => {
      if (ts) {
        $video.currentTime = ts;
      }
    });

    $video.addEventListener('loadeddata', async () => {
      // check for video promotion
      const videoPromos = await fetchVideoPromotions();
    
      const promoName = videoPromos[primaryUrl];
      if (typeof promoName === 'string') {
        $element.insertAdjacentHTML('beforeend', `<div class="promotion block" data-block-name="promotion">${promoName}</div>`);
        const $promo = $element.querySelector('.promotion');
        await loadBlock($promo, true);
        $promo.querySelector(':scope a.button').className = 'button accent';
        const $PromoClose = $promo.appendChild(createTag('div', { class: 'close' }));
        $PromoClose.addEventListener('click', () => {
          // eslint-disable-next-line no-use-before-define
          closeVideo($video)
        });
        window.videoPromotions[primaryUrl] = $promo;
      }

      const videoAnalytic = await getVideoAnalytic($video);
      if (videoAnalytic) {
        const videoLoaded = new CustomEvent('videoloaded', { detail: videoAnalytic });
        document.dispatchEvent(videoLoaded);
      }
      
      if (autoplay) {
        const playPromise = $video.play();
        if (playPromise !== undefined) {
          playPromise.catch(() => {
            // ignore
          });
        }
      }
    });
    $video.addEventListener('ended', async () => {
      // hide player and show promotion
      showVideoPromotion($video, primaryUrl);
    });

    const $videoClose = $element.appendChild(createTag('div', { class: 'close' }));
    $videoClose.addEventListener('click', async () => { 
      closeVideo($video)
    });
  } else {
    if (playerType === 'adobetv') {
      let videoURL = `${primaryUrl.replace(/[/]$/, '')}`;
      if (autoplay) {
        videoURL += '/?autoplay=true'
      }
      const $iframe = createTag('iframe', {
        title,
        src: videoURL,
        frameborder: '0',
        allow: 'autoplay',
        webkitallowfullscreen: '',
        mozallowfullscreen: '',
        allowfullscreen: '',
        scrolling: 'no',
      });

      $element.replaceChildren($iframe);
    } else {
      // iframe 3rd party player
      const $iframe = createTag('iframe', {
        title,
        src: primaryUrl,
        frameborder: '0',
        allow: 'accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture',
        allowfullscreen: '',
      });
      $element.replaceChildren($iframe);
    }
    const $videoClose = $element.appendChild(createTag('div', { class: 'close' }));
    $videoClose.addEventListener('click', () => {
      closeVideo($element)
    });
  }
  $element.classList.add(playerType);
}

function parseVideoURLs(primaryUrl, vidUrls, autoplay) {
  let parsedVidUls = vidUrls;
  let vidType = 'default';
  let ts = 0;
  if (/^https?:[/][/]video[.]tv[.]adobe[.]com/.test(primaryUrl)) {
    vidType = 'adobetv';
  } else if (primaryUrl.includes('youtu')) {
    vidType = 'youtube';
    const yturl = new URL(primaryUrl);
    let vid = yturl.searchParams.get('v');
    if (!vid) {
      vid = yturl.pathname.substr(1);
    }
    parsedVidUls = [`https://www.youtube.com/embed/${vid}?feature=oembed&enablejsapi=1`];
  } else if (primaryUrl.includes('vimeo')) {
    vidType = 'vimeo';
    const vid = new URL(primaryUrl).pathname.split('/')[1];
    const language = getAvailableVimeoSubLang();
    parsedVidUls = [`https://player.vimeo.com/video/${vid}?app_id=122963&texttrack=${language}&enablejsapi=1`];
  } else if (primaryUrl.includes('/media_')) {
    vidType = 'html5';
    const { hash } = new URL(vidUrls[0]);
    if (hash.startsWith('#t=')) {
      ts = parseInt(hash.substring(3), 10);
      if (Number.isNaN(ts)) ts = 0;
    }
    // local video url(s), remove origin, extract timestamp
    parsedVidUls = parsedVidUls.map((vidUrl) => new URL(vidUrl).pathname);
  }
  return { vidType, parsedVidUls, ts };
}

export function isVideoLink(url) {
  if (!url) return null;
  return url.includes('youtube.com/watch')
    || url.includes('youtu.be/')
    || url.includes('vimeo')
    || /^https?:[/][/]video[.]tv[.]adobe[.]com/.test(url)
    || /.*\/media_.*(mp4|webm|m3u8)$/.test(new URL(url).pathname);
}

function sendMessage(iframe, action) {
  iframe.contentWindow.postMessage('{"event":"command","func":"' + action + '","args":""}', "*");
}

export function displayVideoModal(url = [], title, push) {
  const vidUrls = typeof url === 'string' ? [url] : url;
  const [primaryUrl] = vidUrls;
  const canPlayInline = vidUrls
    .some((src) => src && isVideoLink(src));

  document.body.classList.add('no-scroll');
  if (!canPlayInline) {
    // redirect to first video url
    [window.location.href] = vidUrls;
    return;
  }
  const $overlay = createTag('div', { class: 'video-overlay' });
  const $video = createTag('div', { class: 'video-overlay-video', id: 'video-overlay-video' });

  $overlay.appendChild($video);
  $overlay.addEventListener('click', async () => {
    closeVideo($video)
  });
  $video.addEventListener('click', (evt) => {
    evt.stopPropagation();
  });
  window.onkeyup = async ({ key }) => {
    if (key === 'Escape') {
      closeVideo($video)
    }
  };
  if (push) {
    // create new history entry
    window.history.pushState({ url: primaryUrl, title }, `${docTitle} | ${title}`, `#${toClassName(title)}`);
  }
  const $main = document.querySelector('main');
  $main.append($overlay);

  const { parsedVidUls, vidType, ts } = parseVideoURLs(primaryUrl, vidUrls);
  buildVideoElement($video, parsedVidUls, vidType, title, ts, false);
}

async function playVid(element, play) {
  const video = element.querySelector('video')
  const iframe = element.querySelector('iframe')
  if (iframe) {
    if (!play) {
      sendMessage(iframe, 'stopVideo');
    } else {
      sendMessage(iframe, 'playVideo');
    }

  } else {
    if (play) {
      video.play()
    } else {

      video.pause()
    }
  }
}

export function playPreloadedVideo(title) {
  const videoOverlays = document.querySelectorAll('.video-overlay-preloaded');
  for (const vo of videoOverlays) {
    if (vo.id === `video-overlay-${title}`) {
      vo.classList.add('video-overlay');
      playVid(vo, true)
    } else if (vo.classList.contains('video-overlay')) {
      vo.classList.remove('video-overlay');
      playVid(vo, false)
    }
  }
}

async function closeVideo($video) {
  playPreloadedVideo(undefined);
  const $videoElement = $video.querySelector('video');
  if ($videoElement) {
    const videoAnalytic = await getVideoAnalytic($videoElement);
    if (videoAnalytic) {
      const linksPopulated = new CustomEvent('videoclosed', { detail: videoAnalytic });
      document.dispatchEvent(linksPopulated);
    }
  }
}
export function preloadVideoModal(url = [], title, push) {
  const vidUrls = typeof url === 'string' ? [url] : url;

  const [primaryUrl] = vidUrls;
  const canPlayInline = vidUrls
    .some((src) => src && isVideoLink(src));
  if (!canPlayInline) {
    [window.location.href] = vidUrls;
    return;
  }

  const $overlay = createTag('div', { class: 'video-overlay-preloaded', id: `video-overlay-${title}` });
  const $video = createTag('div', { class: 'video-overlay-video', id: 'video-overlay-video' });
  $overlay.appendChild($video);
  $overlay.addEventListener('click', async () => {
    closeVideo($video);
  });
  $video.addEventListener('click', (evt) => {
    evt.stopPropagation();
  });
  window.onkeyup = async ({ key }) => {
    if (key === 'Escape') {
      closeVideo($video);
    }
  };

  if (push) {
    // create new history entry
    window.history.pushState({ url: primaryUrl, title }, `${docTitle} | ${title}`, `#${toClassName(title)}`);
  }

  const $main = document.querySelector('main');
  $main.append($overlay);
  const { parsedVidUls, vidType, ts } = parseVideoURLs(primaryUrl, vidUrls);
  buildVideoElement($video, parsedVidUls, vidType, title, ts);
}