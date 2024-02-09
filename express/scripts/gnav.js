import {
  loadScript,
  getHelixEnv,
  sampleRUM,
  getCookie,
  getMetadata,
  getConfig,
  createTag,
  loadStyle,
} from './utils.js';

const isHomepage = window.location.pathname.endsWith('/express/');

async function checkRedirect(location, geoLookup) {
  const splits = location.pathname.split('/express/');
  splits[0] = '';
  const prefix = geoLookup && geoLookup !== 'us' ? `/${geoLookup}` : '';

  // remove ?geocheck param
  const params = new URLSearchParams(location.search);
  params.delete('geocheck');
  const queryString = params.toString() ? `?${params.toString()}` : '';

  return `${prefix}${splits.join('/express/')}${queryString}${location.hash}`;
}

async function checkGeo(userGeo, userLocale, geoCheckForce) {
  const geoLookup = async () => {
    let region = '';
    const resp = await fetch('/express/system/geo-map.json');
    const json = await resp.json();
    const matchedGeo = json.data.find((row) => (row.usergeo === userGeo));
    const { userlocales, redirectlocalpaths, redirectdefaultpath } = matchedGeo;
    region = redirectdefaultpath;

    if (userlocales) {
      const redirectLocalPaths = redirectlocalpaths.split(',');
      const [userLanguage] = userLocale.split('-');
      const userExpectedPath = `${userGeo.toLowerCase()}_${userLanguage}`;
      region = redirectLocalPaths.find((locale) => locale.trim() === userExpectedPath) || region;
    }
    return (region);
  };

  const region = geoCheckForce ? await geoLookup() : getCookie('international') || await geoLookup();
  return checkRedirect(window.location, region);
}

function loadIMS() {
  window.adobeid = {
    client_id: 'MarvelWeb3',
    scope: 'AdobeID,openid',
    locale: getConfig().locale.region,
    environment: 'prod',
  };
  if (!['www.stage.adobe.com'].includes(window.location.hostname)) {
    loadScript('https://auth.services.adobe.com/imslib/imslib.min.js');
  } else {
    loadScript('https://auth-stg1.services.adobe.com/imslib/imslib.min.js');
    window.adobeid.environment = 'stg1';
  }
}

async function loadFEDS() {
  const config = getConfig();
  const prefix = config.locale.prefix.replaceAll('/', '');
  let jarvis = true;
  // if metadata found jarvis must not be initialized in gnav because it will be initiated later
  const jarvisMeta = getMetadata('jarvis-chat')?.toLowerCase();
  if (!jarvisMeta || !['mobile', 'desktop', 'on'].includes(jarvisMeta)
    || !config.jarvis?.id || !config.jarvis?.version) jarvis = false;

  async function showRegionPicker() {
    const { getModal } = await import('../blocks/modal/modal.js');
    const details = {
      path: '/express/fragments/regions',
      id: 'langnav',
    };
    loadStyle('/express/blocks/modal/modal.css');
    return getModal(details);
  }

  function handleConsentSettings() {
    try {
      if (!window.adobePrivacy || window.adobePrivacy.hasUserProvidedCustomConsent()) {
        window.sprk_full_consent = false;
        return;
      }
      if (window.adobePrivacy.hasUserProvidedConsent()) {
        window.sprk_full_consent = true;
      } else {
        window.sprk_full_consent = false;
      }
    } catch (e) {
      // eslint-disable-next-line no-console
      console.warn("Couldn't determine user consent status:", e);
      window.sprk_full_consent = false;
    }
  }

  window.addEventListener('adobePrivacy:PrivacyConsent', handleConsentSettings);
  window.addEventListener('adobePrivacy:PrivacyReject', handleConsentSettings);
  window.addEventListener('adobePrivacy:PrivacyCustom', handleConsentSettings);

  const isMegaNav = window.location.pathname.startsWith('/express')
    || window.location.pathname.startsWith('/in/express')
    || window.location.pathname.startsWith('/uk/express')
    || window.location.pathname.startsWith('/education')
    || window.location.pathname.startsWith('/in/education')
    || window.location.pathname.startsWith('/uk/education')
    || window.location.pathname.startsWith('/drafts');
  const fedsExp = isMegaNav
    ? 'adobe-express/ax-gnav-x'
    : 'adobe-express/ax-gnav-x-row';

  async function buildBreadcrumbs() {
    const baseFrag = getMetadata('breadcrumbs-base');
    if (isHomepage || getMetadata('breadcrumbs') !== 'on' || !baseFrag) {
      return null;
    }

    const baseRes = await fetch(`${baseFrag}.plain.html`);
    if (!baseRes.ok) return null;

    const base = createTag('div');
    base.innerHTML = await baseRes.text();
    const baseBreadcrumbs = base.querySelectorAll('.breadcrumbs ul > li > a');

    if (baseBreadcrumbs.length < 2) return null;

    const breadCrumbList = Array.from(baseBreadcrumbs).map((a) => (
      {
        title: a.textContent.trim(),
        url: a.href,
      }
    ));

    const lastBreadcrumb = getMetadata('short-title') || getMetadata('breadcrumbs-page-title');
    const lastBaseUrl = new URL(baseBreadcrumbs[baseBreadcrumbs.length - 1].href);
    if (lastBreadcrumb && window.location.pathname !== lastBaseUrl.pathname) {
      breadCrumbList.push({ title: lastBreadcrumb, url: window.location.href });
    }

    return breadCrumbList;
  }

  window.fedsConfig = {
    ...(window.fedsConfig || {}),

    footer: {
      regionModal: () => {
        showRegionPicker();
      },
    },
    locale: (prefix === '' ? 'en' : prefix),
    content: {
      experience: getMetadata('gnav') || fedsExp,
    },
    profile: {
      customSignIn: () => {
        const sparkLang = config.locale.ietf;
        const sparkPrefix = sparkLang === 'en-US' ? '' : `/${sparkLang}`;
        let sparkLoginUrl = `https://express.adobe.com${sparkPrefix}/sp/`;
        const env = getHelixEnv();
        if (env && env.spark) {
          sparkLoginUrl = sparkLoginUrl.replace('express.adobe.com', env.spark);
        }
        if (isHomepage) {
          sparkLoginUrl = 'https://new.express.adobe.com/?showCsatOnExportOnce=True&promoid=GHMVYBFM&mv=other';
        }
        window.location.href = sparkLoginUrl;
      },
    },
    jarvis: !jarvis ? {
      surfaceName: config.jarvis.id,
      surfaceVersion: config.jarvis.version,
      onDemand: true,
    } : {},
    breadcrumbs: {
      showLogo: false,
      links: await buildBreadcrumbs(prefix),
    },
  };

  window.addEventListener('feds.events.experience.loaded', async () => {
    document.querySelector('body').classList.add('feds-loaded');

    if (['no', 'f', 'false', 'n', 'off'].includes(getMetadata('gnav-retract').toLowerCase())) {
      window.feds.components.NavBar.disableRetractability();
    }

    /* attempt to switch link */
    if (window.location.pathname.includes('/create/')
      || window.location.pathname.includes('/discover/')
      || window.location.pathname.includes('/feature/')) {
      const $aNav = document.querySelector('header a.feds-navLink--primaryCta');
      const $aHero = document.querySelector('main > div:first-of-type a.button.accent');
      if ($aNav && $aHero) {
        $aNav.href = $aHero.href;
      }
    }

    /* switch all links if lower env */
    const env = getHelixEnv();
    if (env && env.spark) {
      // eslint-disable-next-line no-console
      // console.log('lower env detected');
      document.querySelectorAll('a[href^="https://spark.adobe.com/"]').forEach(($a) => {
        const hrefURL = new URL($a.href);
        hrefURL.host = env.spark;
        $a.setAttribute('href', hrefURL.toString());
      });
      document.querySelectorAll('a[href^="https://express.adobe.com/"]').forEach(($a) => {
        const hrefURL = new URL($a.href);
        hrefURL.host = env.spark;
        $a.setAttribute('href', hrefURL.toString());
      });
    }

    const geocheck = new URLSearchParams(window.location.search).get('geocheck');
    if (geocheck === 'on' || geocheck === 'force') {
      const userGeo = window.feds
      && window.feds.data
      && window.feds.data.location
      && window.feds.data.location.country
        ? window.feds.data.location.country : null;
      const navigatorLocale = navigator.languages
      && navigator.languages.length
        ? navigator.languages[0].toLowerCase()
        : navigator.language.toLowerCase();
      const redirect = await checkGeo(userGeo, navigatorLocale, geocheck === 'force');
      if (redirect) {
        window.location.href = redirect;
      }
    }
    /* region based redirect to homepage */
    if (window.feds && window.feds.data && window.feds.data.location && window.feds.data.location.country === 'CN') {
      const regionpath = prefix === '' ? '/' : `/${prefix}/`;
      window.location.href = regionpath;
    }
  });
  let domain = '';
  if (!['www.adobe.com', 'www.stage.adobe.com'].includes(window.location.hostname)) {
    domain = 'https://www.adobe.com';
  }
  loadScript(`${domain}/etc.clientlibs/globalnav/clientlibs/base/feds.js`).then((script) => {
    script.id = 'feds-script';
  });
  setTimeout(() => {
    const acom = '7a5eb705-95ed-4cc4-a11d-0cc5760e93db';
    const ids = {
      'hlx.page': '3a6a37fe-9e07-4aa9-8640-8f358a623271-test',
      'hlx.live': '926b16ce-cc88-4c6a-af45-21749f3167f3-test',
    };
    // eslint-disable-next-line max-len
    const otDomainId = ids?.[Object.keys(ids).find((domainId) => window.location.host.includes(domainId))] ?? acom;
    window.fedsConfig.privacy = {
      otDomainId,
    };
    loadScript('https://www.adobe.com/etc.clientlibs/globalnav/clientlibs/base/privacy-standalone.js');
  }, 4000);
  const footer = document.querySelector('footer');
  footer?.addEventListener('click', (event) => {
    if (event.target.closest('a[data-feds-action="open-adchoices-modal"]')) {
      event.preventDefault();
      window.adobePrivacy?.showPreferenceCenter();
    }
  });
}

if (!window.hlx || window.hlx.gnav) {
  loadIMS();
  loadFEDS();
  setTimeout(() => {
    import('./google-yolo.js').then((mod) => {
      mod.default();
    });
  }, 4000);
}
/* Core Web Vitals RUM collection */

sampleRUM('cwv');
