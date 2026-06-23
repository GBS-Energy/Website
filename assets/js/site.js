(() => {

  const runWhenIdle = (cb, { timeout = 1800, fallbackDelay = 250 } = {}) => {
    if (typeof window === 'undefined') return;
    const w = /** @type {any} */ (window);
    if (typeof w.requestIdleCallback === 'function') {
      try {
        w.requestIdleCallback(() => cb(), { timeout });
        return;
      } catch {}
    }
    window.setTimeout(() => cb(), fallbackDelay);
  };

  const normalizeFile = (raw) => {
    let file = String(raw || '').trim();
    if (!file) return 'index.html';
    // Some hosts may expose `foo` or `foo/` instead of `foo.html`,
    // and `foo.en` instead of `foo.en.html`.
    if (file.endsWith('/')) file = file.slice(0, -1);
    if (!file) return 'index.html';
    const lower = file.toLowerCase();
    if (lower.endsWith('.en') || lower.endsWith('.yue') || lower.endsWith('.es') || lower.endsWith('.fr')) {
      file = `${file}.html`;
    }
    if (!file.toLowerCase().endsWith('.html')) file = `${file}.html`;
    if (file.toLowerCase() === 'index') file = 'index.html';
    return file;
  };

  const getPathParts = () => {
    const { pathname, hash, search } = window.location;
    const parts = pathname.split('/').filter(Boolean);
    const last = parts.length ? parts[parts.length - 1] : 'index.html';
    const file = normalizeFile(last);
    return { file, hash, search };
  };

  const LANG_ORDER = ['de', 'en', 'es', 'fr', 'yue'];
  const LANG_META = {
    de: { short: 'DE', name: 'Deutsch', label: 'Sprache', hreflang: 'de', flag: 'de', locale: 'de-DE' },
    en: { short: 'EN', name: 'English', label: 'Language', hreflang: 'en', flag: 'en', locale: 'en-GB' },
    es: { short: 'ES', name: 'Español', label: 'Idioma', hreflang: 'es', flag: 'es', locale: 'es-ES' },
    fr: { short: 'FR', name: 'Français', label: 'Langue', hreflang: 'fr', flag: 'fr', locale: 'fr-FR' },
    yue: { short: '中文', name: '简体中文', label: '语言', hreflang: 'zh-CN', flag: 'cn', locale: 'zh-CN' },
  };

  const stripLangSuffix = (file) =>
    normalizeFile(file).replace(/(\.en|\.yue|\.es|\.fr)?\.html$/i, '.html');

  const QUERY_LANG_PAGES = new Set([
    'product-ems-service.html',
    'product-mercury-233.html',
    'product-mercury-261.html',
    'product-mercury-418.html',
  ]);

  const usesQueryLang = (file) => QUERY_LANG_PAGES.has(stripLangSuffix(file));

  const getQueryLang = (file, search) => {
    if (!usesQueryLang(file)) return null;
    const params = new URLSearchParams(search || '');
    const raw = params.get('lang');
    if (!raw) return null;
    const value = raw.toLowerCase();
    if (value === 'en') return 'en';
    if (value === 'de') return 'de';
    if (value === 'es') return 'es';
    if (value === 'fr') return 'fr';
    if (value === 'yue' || value === 'zh' || value === 'zh-cn') return 'yue';
    return null;
  };

  const toLangFile = (file, lang) => {
    const base = stripLangSuffix(file);
    if (lang === 'de') return base;
    if (lang === 'en') return base.replace(/\.html$/i, '.en.html');
    if (lang === 'es') return base.replace(/\.html$/i, '.es.html');
    if (lang === 'fr') return base.replace(/\.html$/i, '.fr.html');
    if (lang === 'yue') return base.replace(/\.html$/i, '.yue.html');
    return normalizeFile(file);
  };

  const getLangFromFile = (file) => {
    const normalized = normalizeFile(file).toLowerCase();
    if (normalized.endsWith('.en.html')) return 'en';
    if (normalized.endsWith('.es.html')) return 'es';
    if (normalized.endsWith('.fr.html')) return 'fr';
    if (normalized.endsWith('.yue.html')) return 'yue';
    return 'de';
  };

  const getLangFromLocation = (file, search) => {
    const fileLang = getLangFromFile(file);
    if (fileLang !== 'de') return fileLang;
    return getQueryLang(file, search) || fileLang;
  };

  const buildLangTarget = (file, lang, search, hash) => {
    if (!usesQueryLang(file)) return `${toLangFile(file, lang)}${search || ''}${hash || ''}`;

    const targetFile = toLangFile(file, lang);
    const params = new URLSearchParams(search || '');
    // Legacy product URLs used ?lang=. Keep all other params, but normalize by removing lang.
    params.delete('lang');
    const query = params.toString();
    return `${targetFile}${query ? `?${query}` : ''}${hash || ''}`;
  };

  const getDocLang = () => {
    const raw = String(document.documentElement.lang || '').toLowerCase();
    if (raw.startsWith('de')) return 'de';
    if (raw.startsWith('en')) return 'en';
    if (raw.startsWith('es')) return 'es';
    if (raw.startsWith('fr')) return 'fr';
    if (raw.startsWith('zh')) return 'yue';
    return 'de';
  };

  const getLocaleForLang = (lang) => LANG_META[lang]?.locale || 'en-GB';

  const getAvailableLangs = () => {
    const links = Array.from(
      document.querySelectorAll('link[rel="alternate"][hreflang]'),
    ).filter((link) => link instanceof HTMLLinkElement);
    if (!links.length) return ['de', 'en'];

    const tags = new Set(
      links.map((link) => String(link.getAttribute('hreflang') || '').toLowerCase()).filter(Boolean),
    );

    const available = [];
    LANG_ORDER.forEach((lang) => {
      const tag = LANG_META[lang]?.hreflang?.toLowerCase();
      if (!tag) return;
      if (tags.has(tag)) available.push(lang);
    });

    return available.length ? available : ['de', 'en'];
  };

  const preferredLang = () => {
    const available = getAvailableLangs();
    const { file, search } = getPathParts();
    const fromQuery = getQueryLang(file, search);
    if (fromQuery && available.includes(fromQuery)) return fromQuery;
    const fromFile = getLangFromFile(file);
    if (available.includes(fromFile)) return fromFile;
    const stored = localStorage.getItem('lang');
    if (stored && available.includes(stored)) return stored;
    return available[0] || 'de';
  };

  const normalizeSearchText = (value) => {
    const raw = String(value || '').toLowerCase();
    const normalized = typeof raw.normalize === 'function' ? raw.normalize('NFD') : raw;
    return normalized
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/ß/g, 'ss')
      .replace(/ae/g, 'a')
      .replace(/oe/g, 'o')
      .replace(/ue/g, 'u')
      .replace(/[^a-z0-9\u4e00-\u9fff]+/g, ' ')
      .trim();
  };

  const getSearchGroupKey = (href) => {
    const raw = String(href || '').split('#')[0].split('?')[0];
    const withoutDomain = raw.replace(/^https?:\/\/[^/]+/i, '');
    const parts = withoutDomain.split('/').filter(Boolean);
    const file = parts.length ? parts[parts.length - 1] : 'index.html';
    return stripLangSuffix(normalizeFile(file));
  };

  const SEARCH_INDEX = {
    de: [
      { title: 'Startseite', href: 'index.html', desc: 'Überblick & Einstieg', keywords: 'home start' },
      { title: 'Referenzen', href: 'referenzen.html', desc: 'Projektübersicht & Beispiele', keywords: 'referenzen projekte' },
      { title: 'Leistungen', href: 'leistungen.html', desc: 'Projektentwicklung & Energiemanagement', keywords: 'service' },
      { title: 'Contracting', href: 'contracting.html', desc: 'Contracting ohne Investitionskosten', keywords: 'contracting dachpacht mieterstrom' },
      { title: 'Photovoltaik', href: 'photovoltaik.html', desc: 'PV & Solar', keywords: 'pv solar' },
      { title: 'CESC Stromspeicher', href: 'speicher.html', desc: 'Batteriespeicher & Fakten', keywords: 'cesc batterie storage' },
      { title: 'Speicherinvest', href: 'speicherinvest.html', desc: 'IAB Investitionsmodell', keywords: 'iab investment speicherinvest' },
      { title: 'Flächenpacht Speicher', href: 'flaechenpacht-speicher.html', desc: 'Pachtmodell für Flächeneigentümer', keywords: 'flaechenpacht pacht flaeche land' },
      { title: 'Dachpacht', href: 'dachpacht.html', desc: 'Verpachtung für Dachflächen', keywords: 'dachpacht dachflaeche pacht' },
      { title: 'Speicher', href: 'produkte.html', desc: 'Batteriespeicher Übersicht', keywords: 'speicher batteriespeicher portfolio' },
      { title: 'Mercury 233', href: 'product-mercury-233.html', desc: 'Batteriespeicher Produkt', keywords: 'mercury 233' },
      { title: 'EMS & Monitoring', href: 'product-ems-service.html', desc: 'Servicepaket', keywords: 'ems monitoring service' },
      { title: 'Über uns', href: 'ueberuns.html', desc: 'Unternehmen & Team', keywords: 'company' },
      { title: 'Karriere', href: 'karriere.html', desc: 'Jobs & Kultur', keywords: 'jobs' },
      { title: 'Kontakt', href: 'kontakt.html', desc: 'Kontaktformular & Adresse', keywords: 'kontakt' },
      { title: 'Downloads', href: 'downloads.html', desc: 'PDFs & Unterlagen', keywords: 'download' },
      { title: 'Datenschutz', href: 'datenschutz.html', desc: 'Datenschutz & Privacy', keywords: 'privacy' },
      { title: 'Impressum', href: 'impressum.html', desc: 'Rechtliches', keywords: 'impressum' },
    ],
    en: [
      { title: 'Home', href: 'index.en.html', desc: 'Overview & entry', keywords: 'home start' },
      { title: 'References', href: 'referenzen.en.html', desc: 'Project overview & examples', keywords: 'references projects' },
      { title: 'Services', href: 'leistungen.en.html', desc: 'Project development & energy management', keywords: 'services' },
      { title: 'Contracting', href: 'contracting.en.html', desc: 'No-investment contracting model', keywords: 'contracting tenant power' },
      { title: 'Photovoltaics', href: 'photovoltaik.en.html', desc: 'PV & solar', keywords: 'pv solar' },
      { title: 'CESC Storage', href: 'speicher.en.html', desc: 'Battery storage & facts', keywords: 'cesc battery storage' },
      { title: 'Storage investment', href: 'speicherinvest.en.html', desc: 'IAB investment model', keywords: 'iab investment storage investment' },
      { title: 'Storage land lease', href: 'flaechenpacht-speicher.en.html', desc: 'Lease model for land sites', keywords: 'land lease storage land' },
      { title: 'Roof lease', href: 'dachpacht.en.html', desc: 'Lease for roof areas', keywords: 'roof lease' },
      { title: 'Storage', href: 'produkte.en.html', desc: 'Battery storage overview', keywords: 'storage battery portfolio' },
      { title: 'Mercury 233', href: 'product-mercury-233.en.html', desc: 'Battery storage product', keywords: 'mercury 233' },
      { title: 'EMS & Monitoring', href: 'product-ems-service.en.html', desc: 'Service package', keywords: 'ems monitoring service' },
      { title: 'About', href: 'ueberuns.en.html', desc: 'Company & team', keywords: 'about' },
      { title: 'Careers', href: 'karriere.en.html', desc: 'Jobs & culture', keywords: 'jobs' },
      { title: 'Contact', href: 'kontakt.en.html', desc: 'Contact form & address', keywords: 'contact' },
      { title: 'Downloads', href: 'downloads.en.html', desc: 'PDFs & documents', keywords: 'download' },
      { title: 'Privacy', href: 'datenschutz.en.html', desc: 'Privacy policy', keywords: 'privacy' },
      { title: 'Imprint', href: 'impressum.en.html', desc: 'Legal notice', keywords: 'imprint' },
    ],
    es: [
      { title: 'Inicio', href: 'index.es.html', desc: 'Resumen y entrada', keywords: 'inicio' },
      { title: 'Referencias', href: 'referenzen.es.html', desc: 'Resumen de proyectos y ejemplos', keywords: 'referencias proyectos' },
      { title: 'Servicios', href: 'leistungen.es.html', desc: 'Desarrollo de proyectos y gestión energética', keywords: 'servicios' },
      { title: 'Contracting', href: 'contracting.es.html', desc: 'Modelo sin inversión', keywords: 'contracting energía' },
      { title: 'Fotovoltaica', href: 'photovoltaik.es.html', desc: 'FV y solar', keywords: 'fotovoltaica solar' },
      { title: 'CESC Almacenamiento', href: 'speicher.es.html', desc: 'Baterías y datos', keywords: 'cesc almacenamiento baterías' },
      { title: 'Inversión en almacenamiento', href: 'speicherinvest.es.html', desc: 'Modelo de inversión IAB', keywords: 'iab inversión almacenamiento' },
      { title: 'Arrendamiento de suelo', href: 'flaechenpacht-speicher.es.html', desc: 'Modelo de arrendamiento para terrenos', keywords: 'arrendamiento suelo' },
      { title: 'Arrendamiento de tejados', href: 'dachpacht.es.html', desc: 'Arrendamiento de cubiertas', keywords: 'tejado arrendamiento' },
      { title: 'Almacenamiento', href: 'produkte.es.html', desc: 'Resumen de almacenamiento', keywords: 'almacenamiento baterías' },
      { title: 'Mercury 233', href: 'product-mercury-233.es.html', desc: 'Producto de almacenamiento en baterías', keywords: 'mercury 233' },
      { title: 'EMS y monitoreo', href: 'product-ems-service.es.html', desc: 'Paquete de servicio', keywords: 'ems monitoreo' },
      { title: 'Sobre nosotros', href: 'ueberuns.es.html', desc: 'Empresa y equipo', keywords: 'sobre' },
      { title: 'Carreras', href: 'karriere.es.html', desc: 'Empleo y cultura', keywords: 'empleo' },
      { title: 'Contacto', href: 'kontakt.es.html', desc: 'Formulario y dirección', keywords: 'contacto' },
      { title: 'Descargas', href: 'downloads.es.html', desc: 'PDF y documentos', keywords: 'descargas' },
      { title: 'Privacidad', href: 'datenschutz.es.html', desc: 'Política de privacidad', keywords: 'privacidad' },
      { title: 'Aviso legal', href: 'impressum.es.html', desc: 'Aviso legal', keywords: 'legal' },
    ],
    fr: [
      { title: 'Accueil', href: 'index.fr.html', desc: 'Vue d’ensemble et accès', keywords: 'accueil' },
      { title: 'Références', href: 'referenzen.fr.html', desc: 'Aperçu des projets et exemples', keywords: 'références projets' },
      { title: 'Services', href: 'leistungen.fr.html', desc: 'Développement de projets et gestion énergétique', keywords: 'services' },
      { title: 'Contracting', href: 'contracting.fr.html', desc: 'Modèle sans investissement', keywords: 'contracting énergie' },
      { title: 'Photovoltaïque', href: 'photovoltaik.fr.html', desc: 'PV et solaire', keywords: 'photovoltaïque solaire' },
      { title: 'CESC Stockage', href: 'speicher.fr.html', desc: 'Stockage batterie et faits', keywords: 'cesc stockage batterie' },
      { title: 'Investissement stockage', href: 'speicherinvest.fr.html', desc: 'Modèle d’investissement IAB', keywords: 'iab investissement stockage' },
      { title: 'Bail de terrain', href: 'flaechenpacht-speicher.fr.html', desc: 'Modèle de bail pour terrains', keywords: 'bail terrain' },
      { title: 'Bail de toiture', href: 'dachpacht.fr.html', desc: 'Bail pour toitures', keywords: 'bail toiture' },
      { title: 'Stockage', href: 'produkte.fr.html', desc: 'Aperçu du stockage', keywords: 'stockage batteries' },
      { title: 'Mercury 233', href: 'product-mercury-233.fr.html', desc: 'Produit de stockage batterie', keywords: 'mercury 233' },
      { title: 'EMS & monitoring', href: 'product-ems-service.fr.html', desc: 'Forfait de service', keywords: 'ems monitoring' },
      { title: 'À propos', href: 'ueberuns.fr.html', desc: 'Entreprise et équipe', keywords: 'à propos' },
      { title: 'Carrières', href: 'karriere.fr.html', desc: 'Emplois et culture', keywords: 'emplois' },
      { title: 'Contact', href: 'kontakt.fr.html', desc: 'Formulaire et adresse', keywords: 'contact' },
      { title: 'Téléchargements', href: 'downloads.fr.html', desc: 'PDF et documents', keywords: 'téléchargements' },
      { title: 'Confidentialité', href: 'datenschutz.fr.html', desc: 'Politique de confidentialité', keywords: 'confidentialité' },
      { title: 'Mentions légales', href: 'impressum.fr.html', desc: 'Mentions légales', keywords: 'légal' },
    ],
    yue: [
      { title: '首页', href: 'index.yue.html', desc: '总览与入口', keywords: '首页' },
      { title: '参考案例', href: 'referenzen.yue.html', desc: '项目概览与示例', keywords: '案例 参考 项目' },
      { title: '服务', href: 'leistungen.yue.html', desc: '项目开发与能源管理', keywords: '服务' },
      { title: 'Contracting', href: 'contracting.yue.html', desc: '免投资模式', keywords: 'contracting 合同 能源' },
      { title: '光伏', href: 'photovoltaik.yue.html', desc: '光伏与太阳能', keywords: '光伏 太阳能' },
      { title: 'CESC 储能', href: 'speicher.yue.html', desc: '电池储能与要点', keywords: 'CESC 储能 电池' },
      { title: '储能投资', href: 'speicherinvest.yue.html', desc: 'IAB 投资模式', keywords: '投资 储能' },
      { title: '储能地租', href: 'flaechenpacht-speicher.yue.html', desc: '土地租赁模式', keywords: '土地 租赁 储能' },
      { title: '屋顶租赁', href: 'dachpacht.yue.html', desc: '屋顶租赁', keywords: '屋顶 租赁' },
      { title: '储能', href: 'produkte.yue.html', desc: '储能概览', keywords: '储能 电池' },
      { title: 'Mercury 233', href: 'product-mercury-233.yue.html', desc: '电池储能产品', keywords: 'Mercury 233' },
      { title: 'EMS & 监控服务', href: 'product-ems-service.yue.html', desc: '服务套餐', keywords: 'EMS 监控' },
      { title: '关于我们', href: 'ueberuns.yue.html', desc: '公司介绍', keywords: '关于' },
      { title: '招聘', href: 'karriere.yue.html', desc: '岗位与文化', keywords: '招聘 工作' },
      { title: '联络', href: 'kontakt.yue.html', desc: '表格与地址', keywords: '联系 联络' },
      { title: '下载', href: 'downloads.yue.html', desc: 'PDF 与资料', keywords: '下载' },
      { title: '隐私政策', href: 'datenschutz.yue.html', desc: '隐私与数据', keywords: '隐私' },
      { title: '法律声明', href: 'impressum.yue.html', desc: '法律信息', keywords: '法律' },
    ],
  };

  const getSearchIndex = (() => {
    const cache = {};
    return (lang) => {
      const key = lang || 'de';
      if (cache[key]) return cache[key];
      const list = SEARCH_INDEX[key] || SEARCH_INDEX.de || [];
      const mapped = list.map((item) => {
        const haystack = normalizeSearchText(
          `${item.title} ${item.desc || ''} ${item.keywords || ''}`,
        );
        return {
          ...item,
          lang: key,
          haystack,
          compactHaystack: haystack.replace(/\s+/g, ''),
          groupKey: getSearchGroupKey(item.href),
        };
      });
      cache[key] = mapped;
      return mapped;
    };
  })();

  const getSearchIndexAll = (() => {
    let cache = null;
    return () => {
      if (cache) return cache;
      const all = [];
      LANG_ORDER.forEach((lang) => {
        const list = SEARCH_INDEX[lang] || [];
        list.forEach((item) => {
          const haystack = normalizeSearchText(
            `${item.title} ${item.desc || ''} ${item.keywords || ''}`,
          );
          all.push({
            ...item,
            lang,
            haystack,
            compactHaystack: haystack.replace(/\s+/g, ''),
            groupKey: getSearchGroupKey(item.href),
          });
        });
      });
      cache = all;
      return cache;
    };
  })();

  const normalizeSearchHref = (href) => {
    try {
      const u = new URL(String(href || ''), window.location.origin);
      const pathname = u.pathname || '/';
      const parts = pathname.split('/').filter(Boolean);
      const last = parts.length ? parts[parts.length - 1] : 'index.html';
      return normalizeFile(last || 'index.html');
    } catch {
      return normalizeFile(String(href || 'index.html').split('#')[0].split('?')[0]);
    }
  };

  const isSearchableHref = (href) => {
    const file = normalizeSearchHref(href).toLowerCase();
    if (!file || file.endsWith('.php')) return false;
    return !/^(energy-reveal|shop-login|shop-callback)(?:\.[a-z-]+)?\.html$/.test(file);
  };

  const stripHtmlForSearch = (html) => {
    const parser = new DOMParser();
    const doc = parser.parseFromString(String(html || ''), 'text/html');
    if (!(doc instanceof Document)) return { title: '', desc: '', bodyText: '' };

    const title = String(doc.querySelector('title')?.textContent || '').trim();
    const desc =
      String(doc.querySelector('meta[name="description"]')?.getAttribute('content') || '').trim() ||
      String(doc.querySelector('meta[property="og:description"]')?.getAttribute('content') || '').trim();

    doc
      .querySelectorAll(
        'script,style,noscript,template,svg,header,footer,nav,.site-header,.site-footer,.mobile-drawer,.mobile-nav-overlay,.lightbox,[hidden],[aria-hidden="true"]',
      )
      .forEach((el) => el.remove());

    const main = doc.querySelector('main') || doc.body;
    const bodyText = String(main?.textContent || '').replace(/\s+/g, ' ').trim();
    return { title, desc, bodyText };
  };

  const fetchSitemapSearchPages = async () => {
    const fallback = Array.from(
      new Set(
        getSearchIndexAll()
          .map((item) => normalizeSearchHref(item.href))
          .filter(isSearchableHref),
      ),
    );

    try {
      const res = await fetch('sitemap.xml', { cache: 'no-store', credentials: 'same-origin' });
      if (!res.ok) return fallback;
      const xml = await res.text();
      const parser = new DOMParser();
      const doc = parser.parseFromString(xml, 'application/xml');
      const sitemapPages = Array.from(doc.querySelectorAll('url > loc'))
        .map((el) => normalizeSearchHref(el.textContent || ''))
        .filter(isSearchableHref);
      return Array.from(new Set([...sitemapPages, ...fallback]));
    } catch {
      return fallback;
    }
  };

  const loadFullTextSearchIndex = (() => {
    /** @type {Promise<Array<any>> | null} */
    let loadingPromise = null;
    /** @type {Array<any> | null} */
    let cache = null;

    return async () => {
      if (cache) return cache;
      if (loadingPromise) return loadingPromise;

      loadingPromise = (async () => {
        const pages = await fetchSitemapSearchPages();
        const seedByHref = new Map();
        getSearchIndexAll().forEach((item) => {
          const key = normalizeSearchHref(item.href);
          if (!seedByHref.has(key)) seedByHref.set(key, item);
        });

        const jobs = pages.map((href) => async () => {
          try {
            const res = await fetch(href, { cache: 'force-cache', credentials: 'same-origin' });
            if (!res.ok) return null;
            const html = await res.text();
            const { title, desc, bodyText } = stripHtmlForSearch(html);
            if (!title && !desc && !bodyText) return null;

            const seed = seedByHref.get(href);
            const lang = getLangFromFile(href);
            const mergedTitle = title || seed?.title || href;
            const mergedDesc = desc || seed?.desc || '';
            const keywords = seed?.keywords || '';
            const titleHaystack = normalizeSearchText(mergedTitle);
            const descHaystack = normalizeSearchText(mergedDesc);
            const keywordHaystack = normalizeSearchText(keywords);
            const bodyHaystack = normalizeSearchText(bodyText.slice(0, 22000));
            const haystack = normalizeSearchText(
              `${mergedTitle} ${mergedDesc} ${keywords} ${bodyText.slice(0, 45000)}`,
            );
            return {
              title: mergedTitle,
              href,
              desc: mergedDesc,
              keywords,
              lang,
              titleHaystack,
              descHaystack,
              keywordHaystack,
              bodyHaystack,
              haystack,
              compactHaystack: haystack.replace(/\s+/g, ''),
              groupKey: getSearchGroupKey(href),
            };
          } catch {
            return null;
          }
        });

        const concurrency = 8;
        const out = [];
        for (let i = 0; i < jobs.length; i += concurrency) {
          const chunk = jobs.slice(i, i + concurrency);
          // eslint-disable-next-line no-await-in-loop
          const settled = await Promise.all(chunk.map((run) => run()));
          settled.forEach((item) => {
            if (item) out.push(item);
          });
        }

        const dedup = new Map();
        out.forEach((item) => {
          const key = `${item.href}::${item.lang}`;
          if (!dedup.has(key)) dedup.set(key, item);
        });
        cache = Array.from(dedup.values());
        return cache;
      })();

      try {
        return await loadingPromise;
      } finally {
        loadingPromise = null;
      }
    };
  })();

  const submitUrlEncodedForm = async (form, params) => {
    const action = form.getAttribute('action') || '/kontakt-handler.php';
    const res = await fetch(action, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Accept: 'application/json',
        'X-Requested-With': 'XMLHttpRequest',
      },
      body: params.toString(),
    });

    const type = String(res.headers.get('content-type') || '').toLowerCase();
    const text = await res.text();
    if (!res.ok) throw new Error(String(res.status));
    if (!type.includes('application/json')) throw new Error('non-json response');

    const payload = JSON.parse(text || '{}');
    if (payload && payload.ok === false) throw new Error(payload.message || 'backend rejected');
    return true;
  };

  const themeKey = 'theme';
  const normalizeTheme = (value) => (value === 'light' || value === 'dark' ? value : null);
  const storedTheme = () => normalizeTheme(localStorage.getItem(themeKey));

  const themeQuery = () => window.matchMedia('(prefers-color-scheme: dark)');
  const systemTheme = () => (themeQuery().matches ? 'dark' : 'light');
  const effectiveTheme = () => storedTheme() ?? systemTheme();

  const setThemeColorMeta = (theme) => {
    const meta = document.querySelector('meta[name="theme-color"]');
    if (!(meta instanceof HTMLMetaElement)) return;
    meta.setAttribute('content', theme === 'dark' ? '#152538' : '#2f6ea6');
  };

  const applyStoredTheme = () => {
    const theme = storedTheme();
    if (theme) document.documentElement.dataset.theme = theme;
    else document.documentElement.removeAttribute('data-theme');
    setThemeColorMeta(effectiveTheme());
  };

  const redirectIfNeeded = () => {
    const { file, hash, search } = getPathParts();
    const want = preferredLang();
    const have = getLangFromLocation(file, search);
    if (want === have) return;
    const target = buildLangTarget(file, want, search, hash);
    const current = `${file}${search || ''}${hash || ''}`;
    if (target === current) return;
    window.location.replace(target);
  };

  const setupLangMenu = () => {
    const btn = document.querySelector('[data-lang-toggle]');
    if (!(btn instanceof HTMLButtonElement)) return;
    if (btn.closest('.lang-menu')) return;

    const available = getAvailableLangs();
    if (available.length < 2) {
      btn.setAttribute('aria-hidden', 'true');
      btn.disabled = true;
      return;
    }

    const wrapper = document.createElement('div');
    wrapper.className = 'lang-menu';
    wrapper.setAttribute('data-lang-menu', '1');
    const parent = btn.parentElement;
    if (!parent) return;
    parent.insertBefore(wrapper, btn);
    wrapper.appendChild(btn);

    const panel = document.createElement('div');
    panel.className = 'lang-menu-panel';
    panel.setAttribute('role', 'listbox');
    wrapper.appendChild(panel);

    const current = preferredLang();
    const currentMeta = LANG_META[current] || LANG_META.en;
    const labelText = currentMeta?.label || 'Language';

    btn.textContent = '';
    const globe = document.createElement('span');
    globe.className = 'lang-globe';
    globe.setAttribute('aria-hidden', 'true');
    const srLabel = document.createElement('span');
    srLabel.className = 'sr-only';
    srLabel.textContent = labelText;
    btn.append(globe, srLabel);
    btn.setAttribute('aria-haspopup', 'listbox');
    btn.setAttribute('aria-expanded', 'false');
    btn.setAttribute('aria-label', labelText);
    btn.title = labelText;

    const { file, hash, search } = getPathParts();

    const closeMenu = () => {
      wrapper.classList.remove('is-open');
      btn.setAttribute('aria-expanded', 'false');
    };

    LANG_ORDER.forEach((lang) => {
      if (!available.includes(lang)) return;
      const meta = LANG_META[lang];
      if (!meta) return;

      const option = document.createElement('button');
      option.type = 'button';
      option.className = 'lang-option';
      option.dataset.lang = lang;
      option.setAttribute('role', 'option');
      option.setAttribute('aria-selected', lang === current ? 'true' : 'false');

      const flag = document.createElement('span');
      flag.className = `lang-flag flag-${meta.flag || lang}`;
      flag.setAttribute('aria-hidden', 'true');
      const name = document.createElement('span');
      name.className = 'lang-option-name';
      name.textContent = meta.name;
      const code = document.createElement('span');
      code.className = 'lang-option-code';
      code.textContent = meta.short;
      option.append(flag, name, code);

      option.addEventListener('click', () => {
        if (lang === current) {
          closeMenu();
          return;
        }
        localStorage.setItem('lang', lang);
        window.location.href = buildLangTarget(file, lang, search, hash);
      });

      panel.appendChild(option);
    });

    btn.addEventListener('click', (e) => {
      e.preventDefault();
      const open = !wrapper.classList.contains('is-open');
      wrapper.classList.toggle('is-open', open);
      btn.setAttribute('aria-expanded', open ? 'true' : 'false');
    });

    document.addEventListener('click', (e) => {
      const target = e.target;
      if (!(target instanceof Node)) return;
      if (!wrapper.contains(target)) closeMenu();
    });

    document.addEventListener('keydown', (e) => {
      if (e.key !== 'Escape') return;
      closeMenu();
    });
  };

  const setupHeroVideoAutoplay = () => {
    const prefersReducedMotion = () =>
      window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const isTouchLike = () =>
      window.matchMedia && window.matchMedia('(hover: none), (pointer: coarse)').matches;
    const isSaveData = () => {
      try {
        return !!(navigator.connection && navigator.connection.saveData);
      } catch {
        return false;
      }
    };

    const videos = document.querySelectorAll('.hero-video-bg');
    if (!videos.length) return;

    // Respect reduced motion / data saver.
    if (prefersReducedMotion() || isSaveData()) {
      videos.forEach((video) => {
        if (!(video instanceof HTMLVideoElement)) return;
        try {
          video.pause();
        } catch {}
      });
      return;
    }

    videos.forEach((video) => {
      if (!(video instanceof HTMLVideoElement)) return;

      const hasSource =
        !!video.currentSrc ||
        !!video.getAttribute('src') ||
        !!video.querySelector('source[src]');
      if (!hasSource) return;

      // Ensure muted-inline playback is set (autoplay policies).
      try {
        video.muted = true;
        // playsInline is a property too; keep attribute but set defensively.
        video.playsInline = true;
      } catch {}

      // Some iOS versions are picky about this attribute.
      if (isTouchLike()) {
        try {
          video.setAttribute('playsinline', '');
          video.setAttribute('webkit-playsinline', '');
        } catch {}
      }

      // Some browsers need an explicit load() before play() when sources are media-gated.
      try {
        video.load();
      } catch {}

      const tryPlay = () => {
        try {
          const p = video.play();
          if (p && typeof p.catch === 'function') p.catch(() => {});
        } catch {}
      };

      // Try immediately, and again when the element reports it can play.
      tryPlay();
      video.addEventListener('canplay', tryPlay, { passive: true, once: true });
    });
  };

  const setupHeroVideoLoopFade = () => {
    const prefersReducedMotion = () =>
      window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const isTouchLike = () =>
      window.matchMedia && window.matchMedia('(hover: none), (pointer: coarse)').matches;
    const isSaveData = () => {
      try {
        return !!(navigator.connection && navigator.connection.saveData);
      } catch {
        return false;
      }
    };

    // On touch devices / data-saver / reduced motion, keep things simple.
    if (prefersReducedMotion() || isTouchLike() || isSaveData()) return;

    const videos = document.querySelectorAll('.hero-video-bg');
    if (!videos.length) return;

    videos.forEach((video) => {
      if (!(video instanceof HTMLVideoElement)) return;

      // If there is no source (e.g. mobile source gated via <source media>), skip.
      const hasSource =
        !!video.currentSrc ||
        !!video.getAttribute('src') ||
        !!video.querySelector('source[src]');
      if (!hasSource) return;

      const playbackRate = 0.70;
      const applyPlaybackRate = () => {
        try {
          video.defaultPlaybackRate = playbackRate;
          video.playbackRate = playbackRate;
        } catch {}
      };

      applyPlaybackRate();
      video.addEventListener('loadedmetadata', applyPlaybackRate, { passive: true });

      let lastTime = null;
      let inFadeOut = false;
      let fadeInTimer = null;
      let loopTimer = null;

      video.addEventListener(
        'timeupdate',
        () => {
          const t = video.currentTime;
          if (typeof t !== 'number' || !Number.isFinite(t)) return;

          const d = video.duration;
          const hasDuration = typeof d === 'number' && Number.isFinite(d) && d > 0;

          if (hasDuration && !inFadeOut) {
            const fadeOutSeconds = Math.min(2.0, Math.max(1.2, d * 0.14));
            if (d - t <= fadeOutSeconds) {
              inFadeOut = true;
              video.classList.add('is-fading-out');
            }
          }

          if (lastTime !== null && t + 0.2 < lastTime) {
            // Loop restart detected -> fade back in smoothly.
            inFadeOut = false;
            window.clearTimeout(fadeInTimer);
            fadeInTimer = window.setTimeout(() => video.classList.remove('is-fading-out'), 350);
          }
          lastTime = t;
        },
        { passive: true }
      );

      video.addEventListener(
        'ended',
        () => {
          window.clearTimeout(loopTimer);
          window.clearTimeout(fadeInTimer);

          // Ensure we are fully faded out before the pause.
          inFadeOut = true;
          video.classList.add('is-fading-out');

          // 1–2s pause between loops (soft "breathing" effect).
          const pauseMs = 1500;
          loopTimer = window.setTimeout(() => {
            try {
              video.currentTime = 0;
            } catch {}

            // Try to resume playback (muted autoplay should allow this).
            try {
              const p = video.play();
              if (p && typeof p.catch === 'function') p.catch(() => {});
            } catch {}

            // Fade in a moment after restart, to avoid the first frame popping in.
            fadeInTimer = window.setTimeout(() => {
              inFadeOut = false;
              video.classList.remove('is-fading-out');
            }, 220);
          }, pauseMs);
        },
        { passive: true }
      );
    });
  };

  const setupImageSwaps = () => {
    const swaps = Array.from(document.querySelectorAll('[data-image-swap]')).filter(
      (el) => el instanceof HTMLElement,
    );
    if (!swaps.length) return;

    swaps.forEach((el) => {
      if (!(el instanceof HTMLElement)) return;
      if (!el.hasAttribute('tabindex')) el.tabIndex = 0;
      if (!el.getAttribute('role')) el.setAttribute('role', 'button');

      const followLink = el.querySelector('.swap-hoverbox--follow');
      const hasFollowLink = followLink instanceof HTMLAnchorElement;
      const placeFollowLinkDefault = () => {
        if (!hasFollowLink) return;
        const link = /** @type {HTMLAnchorElement} */ (followLink);

        const rect = el.getBoundingClientRect();
        if (!rect.width || !rect.height) return;

        // Ensure we can measure size when becoming visible.
        const w = link.offsetWidth || 160;
        const h = link.offsetHeight || 36;

        const pad = 8;
        const maxX = rect.width - w - pad;
        const maxY = rect.height - h - pad;

        link.style.left = `${Math.min(Math.max(pad, pad), Math.max(pad, maxX))}px`;
        link.style.top = `${Math.min(Math.max(maxY, pad), Math.max(pad, maxY))}px`;
      };

      const positionFollowLink = (evt) => {
        if (!hasFollowLink) return;
        const link = /** @type {HTMLAnchorElement} */ (followLink);

        // Only show the hoverbox when the inside view is visible.
        const insideVisible = el.classList.contains('is-flipped') || el.matches(':hover');
        el.classList.toggle('is-hover-link', insideVisible);
        if (!insideVisible) return;

        const rect = el.getBoundingClientRect();
        const x = evt.clientX - rect.left;
        const y = evt.clientY - rect.top;
        const pad = 8;

        // Ensure we can measure size (even when just turned visible).
        const w = link.offsetWidth || 160;
        const h = link.offsetHeight || 36;

        const maxX = rect.width - w - pad;
        const maxY = rect.height - h - pad;

        // Center the hoverbox on the cursor so it's actually clickable.
        const left = Math.min(Math.max(x - w / 2, pad), Math.max(pad, maxX));
        const top = Math.min(Math.max(y - h / 2, pad), Math.max(pad, maxY));

        link.style.left = `${left}px`;
        link.style.top = `${top}px`;
      };

      const setPressed = (pressed) => el.setAttribute('aria-pressed', pressed ? 'true' : 'false');
      const toggle = () => {
        const next = !el.classList.contains('is-flipped');
        el.classList.toggle('is-flipped', next);
        setPressed(next);
        if (next && hasFollowLink) {
          // Touch/keyboard: no mousemove -> keep link reachable.
          if (!followLink.style.left || !followLink.style.top) placeFollowLinkDefault();
        }
      };

      const eventCameFromLink = (e) => {
        const target = e.target;
        if (target instanceof Element && target.closest('a')) return true;
        if (target instanceof Node) {
          const parent = target.parentElement;
          if (parent instanceof Element && parent.closest('a')) return true;
        }
        if (typeof e.composedPath === 'function') {
          return e.composedPath().some((n) => n instanceof HTMLAnchorElement);
        }
        return false;
      };

      setPressed(el.classList.contains('is-flipped'));

      el.addEventListener('click', (e) => {
        // Keep normal clicks working; ignore clicks on links inside.
        if (eventCameFromLink(e)) return;
        toggle();
      });

      if (hasFollowLink) {
        el.addEventListener('mousemove', (e) => {
          positionFollowLink(e);
        });
        el.addEventListener('mouseenter', (e) => {
          positionFollowLink(e);
        });
        el.addEventListener('mouseleave', () => {
          el.classList.remove('is-hover-link');
        });
      }

      el.addEventListener('keydown', (e) => {
        // Let inner links handle Enter/Space normally.
        if (eventCameFromLink(e)) return;
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          toggle();
          return;
        }
        if (e.key === 'Escape') {
          el.classList.remove('is-flipped');
          setPressed(false);
        }
      });
    });
  };



  const setupContactForm = () => {
    const form = document.getElementById('contactForm');
    if (!(form instanceof HTMLFormElement)) return;

    const { file } = getPathParts();
    const lang = getLangFromFile(file);

    const STRINGS = {
      de: {
        stepLabel: (step, total) => `Schritt ${step} von ${total}`,
        copySuccess: 'Kopiert',
        subjectPrefix: 'Anfrage über Website – ',
        yes: 'Ja',
        no: 'Nein',
        labels: {
          topic: 'Anliegen',
          name: 'Name',
          email: 'E-Mail',
          phone: 'Telefon',
          location: 'PLZ/Ort',
          trafo: 'Trafo/Netzpunkt',
          area: 'Fläche',
          flurstueck: 'Flurstück-Nr.',
          gemarkung: 'Gemarkung',
          dimensions: 'Maße (L×B)',
          authorityConsent: 'Vollmacht-/Einwilligungsformular anfordern',
          message: 'Nachricht',
          footer: 'Gesendet über das Website-Kontaktformular',
        },
      },
      en: {
        stepLabel: (step, total) => `Step ${step} of ${total}`,
        copySuccess: 'Copied',
        subjectPrefix: 'Website inquiry – ',
        yes: 'Yes',
        no: 'No',
        labels: {
          topic: 'Topic',
          name: 'Name',
          email: 'Email',
          phone: 'Phone',
          location: 'Postal code / city',
          trafo: 'Transformer / grid point',
          area: 'Area',
          flurstueck: 'Parcel number',
          gemarkung: 'Cadastral district',
          dimensions: 'Dimensions (L×W)',
          authorityConsent: 'Request authority consent form',
          message: 'Message',
          footer: 'Sent via the website contact form',
        },
      },
      es: {
        stepLabel: (step, total) => `Paso ${step} de ${total}`,
        copySuccess: 'Copiado',
        subjectPrefix: 'Consulta desde el sitio web – ',
        yes: 'Sí',
        no: 'No',
        labels: {
          topic: 'Tema',
          name: 'Nombre',
          email: 'Correo electrónico',
          phone: 'Teléfono',
          location: 'Código postal / ciudad',
          trafo: 'Transformador / punto de red',
          area: 'Superficie',
          flurstueck: 'Número de parcela',
          gemarkung: 'Distrito catastral',
          dimensions: 'Dimensiones (L×A)',
          authorityConsent: 'Solicitar formulario de autorización',
          message: 'Mensaje',
          footer: 'Enviado desde el formulario de contacto del sitio web',
        },
      },
      fr: {
        stepLabel: (step, total) => `Étape ${step} sur ${total}`,
        copySuccess: 'Copié',
        subjectPrefix: 'Demande via le site web – ',
        yes: 'Oui',
        no: 'Non',
        labels: {
          topic: 'Sujet',
          name: 'Nom',
          email: 'E-mail',
          phone: 'Téléphone',
          location: 'Code postal / ville',
          trafo: 'Transformateur / point de réseau',
          area: 'Surface',
          flurstueck: 'Numéro de parcelle',
          gemarkung: 'Section cadastrale',
          dimensions: 'Dimensions (L×l)',
          authorityConsent: 'Demander le formulaire d’autorisation',
          message: 'Message',
          footer: 'Envoyé via le formulaire de contact du site web',
        },
      },
      yue: {
        stepLabel: (step, total) => `第 ${step} 步 / 共 ${total} 步`,
        copySuccess: '已复制',
        subjectPrefix: '网站咨询 – ',
        yes: '是',
        no: '否',
        labels: {
          topic: '主题',
          name: '姓名',
          email: '电子邮箱',
          phone: '电话',
          location: '邮编/城市',
          trafo: '变压器/并网点',
          area: '面积',
          flurstueck: '地块编号',
          gemarkung: '地籍分区',
          dimensions: '尺寸 (长×宽)',
          authorityConsent: '申请授权/同意表',
          message: '留言',
          footer: '通过网站联系表单发送',
        },
      },
    };

    const strings = STRINGS[lang] || STRINGS.de;

    const steps = Array.from(form.querySelectorAll('.form-step'));
    const indicators = Array.from(form.querySelectorAll('[data-step-indicator]'));
    const progress = form.querySelector('.form-progress .bar');
    const progressWrap = form.querySelector('.form-progress-wrap');
    const progressValue = form.querySelector('[data-progress-value]');
    const progressDots = Array.from(form.querySelectorAll('[data-progress-dot]'));
    const notice = document.getElementById('formNotice');
    const errorNotice = document.getElementById('formError');
    const review = document.getElementById('review');
    const copyBtn = document.getElementById('copyMessage');
    const submitBtn = document.getElementById('submitBtn');
    const copyDefault = copyBtn?.textContent || '';

    let current = 0;

    const clamp = (n, min, max) => Math.min(Math.max(n, min), max);
    const get = (id) => document.getElementById(id);

    const fieldsByStep = [
      ['topic'],
      ['name', 'email'],
      ['location'],
      ['message', 'consent'],
    ];

    const setInvalid = (el, invalid) => {
      const wrap = el.closest('.field');
      if (!wrap) return;
      wrap.dataset.invalid = invalid ? 'true' : 'false';
    };

    const isEmail = (el, val) => {
      if (el.type !== 'email') return true;
      if (!val) return false;
      return el.checkValidity();
    };

    const validateStep = (stepIndex) => {
      const ids = fieldsByStep[stepIndex] || [];
      for (const id of ids) {
        const el = get(id);
        if (!(el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement)) continue;

        let ok = true;
        if (el.type === 'checkbox') {
          ok = el.checked;
        } else {
          const val = String(el.value || '').trim();
          ok = val.length > 0;
          if (ok) ok = isEmail(el, val);
        }

        setInvalid(el, !ok);
        if (!ok) {
          el.focus();
          return false;
        }
      }
      return true;
    };

    const buildBody = () => {
      const topic = get('topic')?.value.trim() || '';
      const name = get('name')?.value.trim() || '';
      const email = get('email')?.value.trim() || '';
      const phone = (get('phone')?.value || '').trim();
      const location = get('location')?.value.trim() || '';
      const trafo = (get('trafo')?.value || '').trim();
      const area = (get('area')?.value || '').trim();
      const flurstueck = (get('flurstueck')?.value || '').trim();
      const gemarkung = (get('gemarkung')?.value || '').trim();
      const dimensions = (get('dimensions')?.value || '').trim();
      const authorityConsent = get('authorityConsent')?.checked ? strings.yes : strings.no;
      const message = get('message')?.value.trim() || '';

      const lines = [
        `${strings.labels.topic}: ${topic}`,
        `${strings.labels.name}: ${name}`,
        `${strings.labels.email}: ${email}`,
        phone ? `${strings.labels.phone}: ${phone}` : null,
        `${strings.labels.location}: ${location}`,
        trafo ? `${strings.labels.trafo}: ${trafo}` : null,
        area ? `${strings.labels.area}: ${area}` : null,
        flurstueck ? `${strings.labels.flurstueck}: ${flurstueck}` : null,
        gemarkung ? `${strings.labels.gemarkung}: ${gemarkung}` : null,
        dimensions ? `${strings.labels.dimensions}: ${dimensions}` : null,
        `${strings.labels.authorityConsent}: ${authorityConsent}`,
        '',
        `${strings.labels.message}:`,
        message,
        '',
        '—',
        strings.labels.footer,
      ].filter(Boolean);

      return lines.join('\\n');
    };

    const copyToClipboard = async (text) => {
      try {
        if (navigator.clipboard && window.isSecureContext) {
          await navigator.clipboard.writeText(text);
          return true;
        }
      } catch {}

      try {
        const ta = document.createElement('textarea');
        ta.value = text;
        ta.setAttribute('readonly', '');
        ta.style.position = 'fixed';
        ta.style.left = '-9999px';
        ta.style.top = '0';
        document.body.appendChild(ta);
        ta.select();
        const ok = document.execCommand('copy');
        document.body.removeChild(ta);
        return ok;
      } catch {
        return false;
      }
    };

    const setStep = (index) => {
      current = clamp(index, 0, steps.length - 1);
      steps.forEach((s, i) => s.classList.toggle('is-active', i === current));

      indicators.forEach((li, i) => {
        if (i === current) li.setAttribute('aria-current', 'step');
        else li.removeAttribute('aria-current');
        li.classList.toggle('is-complete', i < current);
      });

      const totalSteps = steps.length || 1;
      const stepNumber = current + 1;
      const progressRatio = totalSteps > 1 ? current / (totalSteps - 1) : 1;
      if (progress) progress.style.setProperty('--progress', String(progressRatio));
      if (progressValue) progressValue.textContent = strings.stepLabel(stepNumber, totalSteps);
      if (progressWrap) {
        progressWrap.setAttribute('aria-valuemax', String(totalSteps));
        progressWrap.setAttribute('aria-valuenow', String(stepNumber));
        progressWrap.setAttribute('aria-valuetext', strings.stepLabel(stepNumber, totalSteps));
      }
      progressDots.forEach((dot, i) => {
        dot.classList.toggle('is-complete', i < current);
        dot.classList.toggle('is-active', i === current);
      });
      if (notice) notice.hidden = true;
      if (errorNotice) errorNotice.hidden = true;

      if (current === 3 && review) {
        const entries = [
          [strings.labels.topic, get('topic')?.value || '—'],
          [strings.labels.name, get('name')?.value || '—'],
          [strings.labels.email, get('email')?.value || '—'],
          [strings.labels.phone, get('phone')?.value || '—'],
          [strings.labels.location, get('location')?.value || '—'],
          [strings.labels.trafo, get('trafo')?.value || '—'],
          [strings.labels.area, get('area')?.value || '—'],
          [strings.labels.flurstueck, get('flurstueck')?.value || '—'],
          [strings.labels.gemarkung, get('gemarkung')?.value || '—'],
          [strings.labels.dimensions, get('dimensions')?.value || '—'],
          [strings.labels.authorityConsent, get('authorityConsent')?.checked ? strings.yes : strings.no],
        ];
        review.textContent = '';
        for (const [k, v] of entries) {
          const item = document.createElement('div');
          item.className = 'review-item';

          const strong = document.createElement('strong');
          strong.textContent = String(k);

          const span = document.createElement('span');
          span.textContent = String(v ?? '—');

          item.append(strong, span);
          review.append(item);
        }
      }
    };

    form.addEventListener('click', (e) => {
      const t = e.target;
      if (!(t instanceof Element)) return;

      if (t.classList.contains('next-step')) {
        if (!validateStep(current)) return;
        setStep(current + 1);
      }

      if (t.classList.contains('prev-step')) {
        setStep(current - 1);
      }
    });

    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      if ((get('company')?.value || '').trim()) return;
      if (!validateStep(3)) return;

      const bodyText = buildBody();
      const topic = get('topic')?.value.trim() || '';
      const subject = `${strings.subjectPrefix}${topic}`;

      const data = new FormData(form);
      data.set('subject', subject);
      data.set('body', bodyText);

      const params = new URLSearchParams();
      for (const [k, v] of data.entries()) {
        params.append(String(k), String(v));
      }

      try {
        form.setAttribute('aria-busy', 'true');
        if (submitBtn instanceof HTMLButtonElement) submitBtn.disabled = true;
        if (notice) notice.hidden = true;
        if (errorNotice) errorNotice.hidden = true;

        await submitUrlEncodedForm(form, params);

        form.reset();
        setStep(0);
        if (notice) notice.hidden = false;
      } catch {
        if (errorNotice) errorNotice.hidden = false;
      } finally {
        form.removeAttribute('aria-busy');
        if (submitBtn instanceof HTMLButtonElement) submitBtn.disabled = false;
      }
    });

    if (copyBtn instanceof HTMLElement) {
      copyBtn.addEventListener('click', async () => {
        if (!validateStep(3)) return;
        const body = buildBody();
        const ok = await copyToClipboard(body);
        if (notice) notice.hidden = !ok;
        if (errorNotice) errorNotice.hidden = true;
        if (ok) copyBtn.textContent = strings.copySuccess;
        window.setTimeout(() => {
          copyBtn.textContent = copyDefault;
        }, 1400);
      });
    }

    setStep(0);
  };

  const setupSpeicherinvestForms = () => {
    const forms = Array.from(document.querySelectorAll('.speicherinvest-contact-form')).filter(
      (form) => form instanceof HTMLFormElement,
    );
    if (!forms.length) return;

    const lang = getDocLang();
    const copy = {
      de: { success: 'Vielen Dank. Ihre Anfrage wurde gesendet.', error: 'Die Anfrage konnte nicht gesendet werden.' },
      en: { success: 'Thank you. Your request has been sent.', error: 'The request could not be sent.' },
      es: { success: 'Gracias. Su solicitud ha sido enviada.', error: 'No se pudo enviar la solicitud.' },
      fr: { success: 'Merci. Votre demande a été envoyée.', error: 'La demande n’a pas pu être envoyée.' },
      yue: { success: '谢谢。您的申请已发送。', error: '申请无法发送。' },
    }[lang] || { success: 'Vielen Dank. Ihre Anfrage wurde gesendet.', error: 'Die Anfrage konnte nicht gesendet werden.' };

    const ensureStatus = (form) => {
      const existing = form.querySelector('[data-form-status]');
      if (existing instanceof HTMLElement) return existing;
      const status = document.createElement('div');
      status.className = 'notice';
      status.dataset.formStatus = '1';
      status.setAttribute('aria-live', 'polite');
      status.hidden = true;
      form.append(status);
      return status;
    };

    forms.forEach((form) => {
      if (form.dataset.ajaxBound === '1') return;
      form.dataset.ajaxBound = '1';
      const status = ensureStatus(form);
      const submitBtn = form.querySelector('button[type="submit"]');

      form.addEventListener('submit', async (event) => {
        event.preventDefault();
        if ((form.elements.company?.value || '').trim()) return;
        if (!form.reportValidity()) return;

        const data = new FormData(form);
        data.set('form_type', 'speicherinvest');

        const params = new URLSearchParams();
        for (const [key, value] of data.entries()) {
          params.append(String(key), String(value));
        }

        try {
          form.setAttribute('aria-busy', 'true');
          if (submitBtn instanceof HTMLButtonElement) submitBtn.disabled = true;
          status.hidden = true;
          status.classList.remove('success', 'error');

          await submitUrlEncodedForm(form, params);

          form.reset();
          status.textContent = copy.success;
          status.classList.add('success');
          status.hidden = false;
        } catch {
          status.textContent = copy.error;
          status.classList.add('error');
          status.hidden = false;
        } finally {
          form.removeAttribute('aria-busy');
          if (submitBtn instanceof HTMLButtonElement) submitBtn.disabled = false;
        }
      });
    });
  };

  const setupFooterYear = () => {
    const year = document.getElementById('year');
    if (year) year.textContent = String(new Date().getFullYear());
  };

  const setupLocalizedContent = () => {
    const localizedBlocks = Array.from(
      document.querySelectorAll('.localized-content[data-lang]'),
    ).filter((el) => el instanceof HTMLElement);
    if (!localizedBlocks.length) return;

    const { file, search, hash } = getPathParts();
    const queryLang = getQueryLang(file, search);

    if (usesQueryLang(file) && queryLang) {
      const target = buildLangTarget(file, queryLang, search, hash);
      const current = `${file}${search || ''}${hash || ''}`;
      if (target && target !== current) {
        window.location.replace(target);
        return;
      }
    }

    const activeLang = queryLang || getLangFromFile(file);
    document.body.dataset.activeLang = activeLang;
    const meta = LANG_META[activeLang] || {};
    const htmlLang = meta.hreflang || activeLang;
    if (htmlLang) document.documentElement.lang = htmlLang;
    if (meta.dir) document.documentElement.setAttribute('dir', meta.dir);
    else document.documentElement.removeAttribute('dir');
  };

  const setupProductLightbox = () => {
    const lightbox = document.querySelector('.lightbox');
    if (!(lightbox instanceof HTMLElement)) return;

    const lightboxImg = lightbox.querySelector('img');
    if (!(lightboxImg instanceof HTMLImageElement)) return;

    const closeButton = lightbox.querySelector('.lightbox-close');
    const prevButton = lightbox.querySelector('.lightbox-nav.prev');
    const nextButton = lightbox.querySelector('.lightbox-nav.next');
    const thumbItems = Array.from(
      document.querySelectorAll('.product-hero-media .product-gallery [data-lightbox-src]'),
    ).filter((el) => el instanceof HTMLElement);
    const galleryItems = thumbItems.length
      ? thumbItems
      : Array.from(document.querySelectorAll('[data-lightbox-src]')).filter(
          (el) => el instanceof HTMLElement,
        );
    if (!galleryItems.length) return;
    const mainMedia = document.querySelector('.product-hero-media .product-media[data-lightbox-src]');

    let currentIndex = -1;

    const closeLightbox = () => {
      lightboxImg.removeAttribute('src');
      lightboxImg.alt = '';
      lightbox.hidden = true;
      currentIndex = -1;
    };

    const openLightboxAt = (index) => {
      const item = galleryItems[index];
      if (!(item instanceof HTMLElement)) return;
      const src = item.dataset.lightboxSrc;
      if (!src) return;
      const alt = item.dataset.lightboxAlt || '';
      lightboxImg.src = src;
      lightboxImg.alt = alt;
      lightbox.hidden = false;
      currentIndex = index;
    };

    const showNext = () => {
      if (currentIndex < 0) return;
      const nextIndex = (currentIndex + 1) % galleryItems.length;
      openLightboxAt(nextIndex);
    };

    const showPrev = () => {
      if (currentIndex < 0) return;
      const prevIndex = (currentIndex - 1 + galleryItems.length) % galleryItems.length;
      openLightboxAt(prevIndex);
    };

    galleryItems.forEach((item, index) => {
      item.addEventListener('click', () => openLightboxAt(index));
    });

    if (mainMedia instanceof HTMLElement) {
      mainMedia.addEventListener('click', () => {
        const src = mainMedia.dataset.lightboxSrc;
        if (!src) {
          openLightboxAt(0);
          return;
        }
        const index = galleryItems.findIndex(
          (item) => item instanceof HTMLElement && item.dataset.lightboxSrc === src,
        );
        openLightboxAt(index >= 0 ? index : 0);
      });
    }

    if (closeButton instanceof HTMLElement) {
      closeButton.addEventListener('click', closeLightbox);
    }
    if (prevButton instanceof HTMLElement) {
      prevButton.addEventListener('click', (event) => {
        event.stopPropagation();
        showPrev();
      });
    }
    if (nextButton instanceof HTMLElement) {
      nextButton.addEventListener('click', (event) => {
        event.stopPropagation();
        showNext();
      });
    }
    lightbox.addEventListener('click', (event) => {
      if (event.target === lightbox) closeLightbox();
    });
    document.addEventListener('keydown', (event) => {
      if (event.key === 'Escape') closeLightbox();
      if (event.key === 'ArrowRight') showNext();
      if (event.key === 'ArrowLeft') showPrev();
    });
  };

  const setupReferenceSlider = () => {
    const sliders = Array.from(document.querySelectorAll('[data-reference-slider]')).filter(
      (el) => el instanceof HTMLElement,
    );
    if (!sliders.length) return;

    const pageLang = getDocLang();
    const dotLabelPrefix = {
      de: 'Bild',
      en: 'Image',
      es: 'Imagen',
      fr: 'Image',
      yue: '图片',
    }[pageLang] || 'Bild';
    const dotLabelSuffix = {
      de: 'anzeigen',
      en: 'show',
      es: 'mostrar',
      fr: 'afficher',
      yue: '显示',
    }[pageLang] || 'anzeigen';

    sliders.forEach((root) => {
      const slides = Array.from(root.querySelectorAll('.reference-slide')).filter(
        (el) => el instanceof HTMLElement,
      );
      if (slides.length < 2) return;

      const viewport = root.querySelector('.reference-slider-viewport');
      const track = root.querySelector('.reference-slider-track');
      const prevBtn = root.querySelector('[data-ref-prev]');
      const nextBtn = root.querySelector('[data-ref-next]');
      const dotsWrap = root.querySelector('[data-ref-dots]');
      const prefersReduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

      slides.forEach((slide) => {
        const img = slide.querySelector('img');
        if (!(img instanceof HTMLImageElement)) return;
        slide.dataset.lightboxSrc = img.currentSrc || img.getAttribute('src') || '';
        slide.dataset.lightboxAlt = img.getAttribute('alt') || '';
        if (!slide.hasAttribute('role')) slide.setAttribute('role', 'button');
        if (!slide.hasAttribute('tabindex')) slide.setAttribute('tabindex', '0');
      });

      if (root.tabIndex < 0) root.tabIndex = 0;

      let index = Math.max(0, slides.findIndex((s) => s.classList.contains('is-active')));
      if (index < 0) index = 0;
      let timer = null;
      let swipeStartX = 0;
      let pointerStartX = null;

      let currentEl = null;
      let totalEl = null;
      if (viewport instanceof HTMLElement) {
        let meta = viewport.querySelector('.reference-slider-meta');
        if (!(meta instanceof HTMLElement)) {
          meta = document.createElement('div');
          meta.className = 'reference-slider-meta';
          meta.innerHTML = `
            <div class="reference-slider-counter"><span data-ref-current>1</span><span>/</span><span data-ref-total>${slides.length}</span></div>
            <div class="reference-slider-progress"><span class="reference-slider-progress-fill"></span></div>
          `;
          viewport.appendChild(meta);
        }
        currentEl = meta.querySelector('[data-ref-current]');
        totalEl = meta.querySelector('[data-ref-total]');
        if (totalEl instanceof HTMLElement) totalEl.textContent = String(slides.length);
      }

      const updateTrack = () => {
        if (!(track instanceof HTMLElement)) return;
        track.style.transform = `translate3d(-${index * 100}%, 0, 0)`;
      };

      const setActive = (next) => {
        index = ((next % slides.length) + slides.length) % slides.length;
        root.style.setProperty('--ref-progress', `${((index + 1) / slides.length) * 100}%`);
        if (currentEl instanceof HTMLElement) currentEl.textContent = String(index + 1);
        updateTrack();

        slides.forEach((slide, i) => {
          const active = i === index;
          slide.classList.toggle('is-active', active);
          slide.setAttribute('aria-hidden', active ? 'false' : 'true');
        });

        if (dotsWrap instanceof HTMLElement) {
          const dots = Array.from(dotsWrap.querySelectorAll('.reference-slider-dot')).filter(
            (el) => el instanceof HTMLElement,
          );
          dots.forEach((dot, i) => {
            const active = i === index;
            dot.classList.toggle('is-active', active);
            dot.setAttribute('aria-current', active ? 'true' : 'false');
          });
        }
      };

      const buildDots = () => {
        if (!(dotsWrap instanceof HTMLElement)) return;
        dotsWrap.innerHTML = '';
        slides.forEach((_, i) => {
          const dot = document.createElement('button');
          dot.type = 'button';
          dot.className = 'reference-slider-dot';
          dot.textContent = String(i + 1);
          dot.setAttribute('aria-label', `${dotLabelPrefix} ${i + 1} ${dotLabelSuffix}`);
          dot.addEventListener('click', () => {
            setActive(i);
            restartAuto();
          });
          dotsWrap.appendChild(dot);
        });
      };

      const stopAuto = () => {
        if (!timer) return;
        window.clearInterval(timer);
        timer = null;
      };

      const startAuto = () => {
        if (prefersReduce) return;
        stopAuto();
        timer = window.setInterval(() => {
          setActive(index + 1);
        }, 5800);
      };

      const restartAuto = () => {
        stopAuto();
        startAuto();
      };

      if (prevBtn instanceof HTMLButtonElement) {
        prevBtn.addEventListener('click', () => {
          setActive(index - 1);
          restartAuto();
        });
      }
      if (nextBtn instanceof HTMLButtonElement) {
        nextBtn.addEventListener('click', () => {
          setActive(index + 1);
          restartAuto();
        });
      }

      root.addEventListener('keydown', (event) => {
        if (event.key === 'ArrowLeft') {
          event.preventDefault();
          setActive(index - 1);
          restartAuto();
        } else if (event.key === 'ArrowRight') {
          event.preventDefault();
          setActive(index + 1);
          restartAuto();
        } else if (event.key === 'Home') {
          event.preventDefault();
          setActive(0);
          restartAuto();
        } else if (event.key === 'End') {
          event.preventDefault();
          setActive(slides.length - 1);
          restartAuto();
        }
      });

      if (viewport instanceof HTMLElement) {
        viewport.addEventListener(
          'touchstart',
          (event) => {
            swipeStartX = event.changedTouches[0]?.clientX || 0;
            stopAuto();
          },
          { passive: true },
        );
        viewport.addEventListener(
          'touchend',
          (event) => {
            const endX = event.changedTouches[0]?.clientX || 0;
            const delta = endX - swipeStartX;
            if (Math.abs(delta) > 40) setActive(delta > 0 ? index - 1 : index + 1);
            startAuto();
          },
          { passive: true },
        );
        viewport.addEventListener('pointerdown', (event) => {
          pointerStartX = event.clientX;
        });
        viewport.addEventListener('pointerup', (event) => {
          if (pointerStartX == null) return;
          const delta = event.clientX - pointerStartX;
          pointerStartX = null;
          if (Math.abs(delta) > 56) {
            setActive(delta > 0 ? index - 1 : index + 1);
            restartAuto();
          }
        });
      }

      root.addEventListener('mouseenter', stopAuto);
      root.addEventListener('mouseleave', startAuto);
      root.addEventListener('focusin', stopAuto);
      root.addEventListener('focusout', () => {
        window.setTimeout(() => {
          if (!root.contains(document.activeElement)) startAuto();
        }, 0);
      });
      document.addEventListener('visibilitychange', () => {
        if (document.hidden) stopAuto();
        else startAuto();
      });

      if (track instanceof HTMLElement) {
        track.style.transition = prefersReduce ? 'none' : 'transform .62s cubic-bezier(.22,.74,.22,1)';
      }

      buildDots();
      setActive(index);
      startAuto();
    });
  };

  const setupProductHeroSlider = () => {
    const wrappers = Array.from(document.querySelectorAll('.product-hero-media')).filter(
      (el) => el instanceof HTMLElement,
    );
    if (!wrappers.length) return;

    wrappers.forEach((wrap) => {
      const mainImg = wrap.querySelector('.product-media img');
      if (!(mainImg instanceof HTMLImageElement)) return;
      const mainMedia = wrap.querySelector('.product-media');
      if (mainMedia instanceof HTMLElement) {
        mainMedia.dataset.lightboxSrc = mainImg.currentSrc || mainImg.src;
        mainMedia.dataset.lightboxAlt = mainImg.alt || '';
        mainMedia.tabIndex = 0;
        mainMedia.setAttribute('role', 'button');
        mainMedia.setAttribute('aria-label', 'Bild groß anzeigen');
      }

      const thumbs = Array.from(wrap.querySelectorAll('.product-gallery [data-lightbox-src]')).filter(
        (el) => el instanceof HTMLElement,
      );
      if (!thumbs.length) return;

      thumbs.forEach((thumb) => {
        thumb.dataset.sliderThumb = '1';
        thumb.setAttribute('aria-label', 'Bildvorschau');
      });

      const setIndex = (idx) => {
        const safeIdx = ((idx % thumbs.length) + thumbs.length) % thumbs.length;
        const item = thumbs[safeIdx];
        if (!(item instanceof HTMLElement)) return;
        const src = item.dataset.lightboxSrc;
        if (!src) return;
        const alt = item.dataset.lightboxAlt || mainImg.alt || '';

        mainImg.classList.add('is-switching');
        window.setTimeout(() => mainImg.classList.remove('is-switching'), 220);
        mainImg.src = src;
        mainImg.alt = alt;
        if (mainMedia instanceof HTMLElement) {
          mainMedia.dataset.lightboxSrc = src;
          mainMedia.dataset.lightboxAlt = alt;
        }

        thumbs.forEach((thumb, i) => {
          const active = i === safeIdx;
          thumb.classList.toggle('is-active', active);
          thumb.setAttribute('aria-current', active ? 'true' : 'false');
        });

        wrap.dataset.activeIndex = String(safeIdx);
      };

      const getIndex = () => Number.parseInt(wrap.dataset.activeIndex || '0', 10) || 0;

      thumbs.forEach((thumb, i) => {
        thumb.addEventListener('click', (event) => {
          event.preventDefault();
          event.stopPropagation();
          setIndex(i);
        });
      });

      thumbs.forEach((thumb, i) => {
        thumb.addEventListener('mouseenter', () => {
          if (window.matchMedia('(hover: hover)').matches) setIndex(i);
        });
      });

      setIndex(0);
    });
  };

  const setupScrollReveal = () => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    if (!('IntersectionObserver' in window)) return;

    const candidates = Array.from(
      document.querySelectorAll(
        [
          '.card',
          '.tile',
          '.profile',
          '.media',
          '.faq details',
          '.cta-banner',
          '.cta',
          '.energy-reveal',
          'section > .container > h2',
          'main > .container > h1',
        ].join(','),
      ),
    );

    if (!candidates.length) return;

    const elements = candidates
      .filter((el) => !(el instanceof HTMLElement ? el.dataset.animate === 'none' : false))
      .filter((el) => el instanceof HTMLElement);

    elements.forEach((el, i) => {
      el.classList.add('reveal-on-scroll');
      const mod = i % 4;
      if (mod === 1) el.classList.add('reveal-delay-1');
      if (mod === 2) el.classList.add('reveal-delay-2');
      if (mod === 3) el.classList.add('reveal-delay-3');
    });

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          const el = entry.target;
          if (el instanceof HTMLElement) el.classList.add('is-visible');
          observer.unobserve(el);
        }
      },
      { root: null, rootMargin: '0px 0px -10% 0px', threshold: 0.12 },
    );

    elements.forEach((el) => observer.observe(el));
  };

  const setupFaqAccordion = () => {
    const containers = Array.from(document.querySelectorAll('.faq')).filter(
      (el) => el instanceof HTMLElement,
    );
    if (!containers.length) return;

    containers.forEach((container) => {
      const items = Array.from(container.querySelectorAll('details')).filter(
        (el) => el instanceof HTMLDetailsElement,
      );
      if (items.length < 2) return;

      items.forEach((details) => {
        details.addEventListener('toggle', () => {
          if (!details.open) return;
          items.forEach((other) => {
            if (other === details) return;
            if (!other.open) return;
            other.open = false;
          });
        });
      });
    });
  };

  const setupCountUp = () => {
    const els = Array.from(document.querySelectorAll('[data-countup]')).filter(
      (el) => el instanceof HTMLElement,
    );
    if (!els.length) return;

    const getGroupId = (el) => {
      const raw = el instanceof HTMLElement ? el.dataset.countupGroup : '';
      const v = String(raw || '').trim();
      return v ? v : null;
    };

    const langKey = preferredLang();
    const lang = getLocaleForLang(langKey);
    const prefersReduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    const parseNumber = (raw) => {
      const cleaned = String(raw).trim();
      const usesComma = langKey !== 'en';
      const thousandsSep = usesComma ? '.' : ',';
      const decimalSep = usesComma ? ',' : '.';
      const normalized = cleaned
        .replaceAll(thousandsSep, '')
        .replaceAll(decimalSep, '.')
        .replace(/[^\d.+-]/g, '');
      const value = Number(normalized);
      return Number.isFinite(value) ? value : 0;
    };

    const inferFromText = (el) => {
      const raw = String(el.textContent || '').trim();
      const match = raw.match(/[-+]?[\d][\d.,]*/);
      if (!match || match.index == null) return;

      const numRaw = match[0];
      const prefix = raw.slice(0, match.index);
      const suffix = raw.slice(match.index + numRaw.length);

      const usesComma = langKey !== 'en';
      const decimalSep = usesComma ? ',' : '.';
      const decimals = numRaw.includes(decimalSep) ? (numRaw.split(decimalSep)[1] || '').length : 0;

      el.dataset.target = String(parseNumber(numRaw));
      if (prefix) el.dataset.prefix = prefix;
      if (suffix) el.dataset.suffix = suffix;
      el.dataset.decimals = String(decimals);
    };

    const formatters = new Map();
    const getFormatter = (decimals) => {
      const key = String(decimals);
      const existing = formatters.get(key);
      if (existing) return existing;
      const formatter = new Intl.NumberFormat(lang, {
        minimumFractionDigits: decimals,
        maximumFractionDigits: decimals,
        useGrouping: true,
      });
      formatters.set(key, formatter);
      return formatter;
    };

    const formatNumber = (value, decimals) => {
      const v = decimals === 0 ? Math.round(value) : value;
      return getFormatter(decimals).format(v);
    };

    const easeInOutCubic = (p) =>
      p < 0.5 ? 4 * p * p * p : 1 - Math.pow(-2 * p + 2, 3) / 2;

    const setFinal = (el) => {
      if (!('target' in el.dataset)) inferFromText(el);
      const target = Number(el.dataset.target || el.dataset.countup || '0');
      const decimals = Number(el.dataset.decimals || '0');
      const prefix = el.dataset.prefix || '';
      const suffix = el.dataset.suffix || '';
      el.textContent = `${prefix}${formatNumber(target, decimals)}${suffix}`;
    };

    const groups = new Map();
    for (const el of els) {
      const groupId = getGroupId(el);
      if (!groupId) continue;
      const arr = groups.get(groupId) || [];
      arr.push(el);
      groups.set(groupId, arr);
    }
    const animatedGroups = new Set();

    const animateGroup = (groupId) => {
      if (!groupId) return;
      if (animatedGroups.has(groupId)) return;
      const groupEls = groups.get(groupId);
      if (!groupEls || !groupEls.length) return;
      animatedGroups.add(groupId);

      if (prefersReduce) {
        groupEls.forEach((el) => setFinal(el));
        return;
      }

      const configs = groupEls
        .filter((el) => el instanceof HTMLElement)
        .map((el) => {
          if (el.dataset.animated === 'true') return null;
          el.dataset.animated = 'true';

          if (!('target' in el.dataset)) inferFromText(el);
          const target = Number(el.dataset.target || el.dataset.countup || '0');
          const decimals = Number(el.dataset.decimals || '0');
          const prefix = el.dataset.prefix || '';
          const suffix = el.dataset.suffix || '';
          const duration = Number(el.dataset.duration || '3600');
          const startAt = Number(el.dataset.start || '0');
          return {
            el,
            target,
            decimals,
            prefix,
            suffix,
            duration,
            startAt,
            lastRendered: '',
          };
        })
        .filter(Boolean);

      if (!configs.length) return;

      const durations = configs.map((c) => c.duration).filter((d) => Number.isFinite(d) && d > 0);
      const sharedDuration = durations.length ? Math.max(...durations) : 3600;

      // If any element is invalid, fall back to final values for the whole group.
      const anyInvalid = configs.some(
        (c) => !isFinite(c.target) || !isFinite(c.startAt) || sharedDuration <= 0,
      );
      if (anyInvalid) {
        configs.forEach((c) => setFinal(c.el));
        return;
      }

      // Set initial values immediately.
      configs.forEach((c) => {
        c.el.textContent = `${c.prefix}${formatNumber(c.startAt, c.decimals)}${c.suffix}`;
      });

      const start = performance.now();
      let lastPaint = 0;

      const tick = (t) => {
        const p = Math.min(1, (t - start) / sharedDuration);
        const eased = easeInOutCubic(p);

        if (p < 1 && t - lastPaint < 16) {
          requestAnimationFrame(tick);
          return;
        }
        lastPaint = t;

        for (const c of configs) {
          const value = c.startAt + (c.target - c.startAt) * eased;
          // Keep integer counters in lockstep and prevent "early finish" before p===1.
          const displayValue =
            c.decimals === 0
              ? c.target >= c.startAt
                ? Math.floor(value)
                : Math.ceil(value)
              : value;
          const formatted = `${c.prefix}${formatNumber(displayValue, c.decimals)}${c.suffix}`;
          if (formatted !== c.lastRendered) {
            c.el.textContent = formatted;
            c.lastRendered = formatted;
          }
        }

        if (p < 1) requestAnimationFrame(tick);
        else configs.forEach((c) => setFinal(c.el));
      };

      requestAnimationFrame(tick);
    };

    const animate = (el) => {
      if (el.dataset.animated === 'true') return;
      el.dataset.animated = 'true';

      if (!('target' in el.dataset)) inferFromText(el);
      const target = Number(el.dataset.target || el.dataset.countup || '0');
      const decimals = Number(el.dataset.decimals || '0');
      const prefix = el.dataset.prefix || '';
      const suffix = el.dataset.suffix || '';
      const duration = Number(el.dataset.duration || '3600');
      const startAt = Number(el.dataset.start || '0');

      if (!isFinite(target) || !isFinite(startAt) || duration <= 0 || prefersReduce) {
        setFinal(el);
        return;
      }

      // Set initial value immediately (prevents a visible "jump" from final value).
      el.textContent = `${prefix}${formatNumber(startAt, decimals)}${suffix}`;
      const start = performance.now();
      let lastPaint = 0;
      let lastRendered = '';

      const tick = (t) => {
        const p = Math.min(1, (t - start) / duration);
        const eased = easeInOutCubic(p);
        const value = startAt + (target - startAt) * eased;
        const displayValue =
          decimals === 0
            ? target >= startAt
              ? Math.floor(value)
              : Math.ceil(value)
            : value;
        // Throttle to ~60fps and skip identical renders to avoid jank.
        if (p < 1 && t - lastPaint < 16) {
          requestAnimationFrame(tick);
          return;
        }
        lastPaint = t;

        const formatted = `${prefix}${formatNumber(displayValue, decimals)}${suffix}`;
        if (formatted !== lastRendered) {
          el.textContent = formatted;
          lastRendered = formatted;
        }
        if (p < 1) requestAnimationFrame(tick);
      };

      requestAnimationFrame(tick);
    };

    const ioSupported = 'IntersectionObserver' in window;
    if (!ioSupported) {
      for (const groupId of groups.keys()) animateGroup(groupId);
      els.forEach((el) => {
        if (!(el instanceof HTMLElement)) return;
        if (getGroupId(el)) return;
        animate(el);
      });
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          const el = entry.target;
          if (!(el instanceof HTMLElement)) continue;
          const groupId = getGroupId(el);
          if (groupId) {
            animateGroup(groupId);
            const groupEls = groups.get(groupId) || [];
            groupEls.forEach((gEl) => observer.unobserve(gEl));
            continue;
          }
          animate(el);
          observer.unobserve(el);
        }
      },
      { root: null, rootMargin: '0px 0px -15% 0px', threshold: 0.2 },
    );

    els.forEach((el) => observer.observe(el));
  };

  const setupThemeLogos = () => {
    const imgs = Array.from(document.querySelectorAll('img[data-logo-light][data-logo-dark]')).filter(
      (el) => el instanceof HTMLImageElement,
    );
    if (!imgs.length) return;

    const mq = themeQuery();
    const resolveTheme = () => document.documentElement.dataset.theme || (mq.matches ? 'dark' : 'light');

    const apply = () => {
      const theme = resolveTheme();
      const useDark = theme === 'dark';
      imgs.forEach((img) => {
        const inHeader = Boolean(img.closest('.site-header'));
        const onAccentHeader = inHeader && theme === 'light';
        const target = useDark || onAccentHeader ? img.dataset.logoDark : img.dataset.logoLight;
        if (!target) return;
        if (img.getAttribute('src') === target) return;
        img.setAttribute('src', target);
      });
    };

    apply();
    try {
      mq.addEventListener('change', apply);
    } catch {
      // Safari < 14
      // eslint-disable-next-line deprecation/deprecation
      mq.addListener(apply);
    }

    const observer = new MutationObserver(() => apply());
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
  };

  const applyHeroBackgrounds = () => {
    const pageBg = document.body?.dataset?.heroBg;
    if (!pageBg) return;

    const heroes = Array.from(document.querySelectorAll('.hero.hero-partner')).filter(
      (el) => el instanceof HTMLElement,
    );
    if (!heroes.length) return;

    const fallbackBg = '/assets/img/gesamtsystem-960.jpg';
    const isTransparent = (value) => {
      const c = String(value || '').trim().toLowerCase();
      if (!c || c === 'transparent') return true;
      if (c === 'rgba(0, 0, 0, 0)' || c === 'rgba(0,0,0,0)') return true;
      return false;
    };
    const resolveEdgeBlendColor = (hero) => {
      const next = hero.nextElementSibling;
      const rootStyle = getComputedStyle(document.documentElement);
      const fallbackMain = rootStyle.getPropertyValue('--surface').trim() || '#ffffff';
      const fallbackDefault = rootStyle.getPropertyValue('--bg-grad-2').trim() || fallbackMain;
      if (!(next instanceof HTMLElement)) return fallbackDefault;

      const nextBg = getComputedStyle(next).backgroundColor;
      if (!isTransparent(nextBg)) return nextBg;
      if (next.classList.contains('page-main')) return fallbackMain;
      return fallbackDefault;
    };
    const isDark = effectiveTheme() === 'dark';
    const overlay = isDark
      ? 'linear-gradient(180deg, rgba(7,17,14,.84), rgba(11,20,17,.72) 75%)'
      : 'linear-gradient(180deg, rgba(244,250,247,.88), rgba(255,255,255,.80) 75%)';

    heroes.forEach((hero) => {
      hero.style.backgroundImage = `${overlay}, url(${pageBg})`;
      hero.style.backgroundSize = 'cover';
      hero.style.backgroundPosition = 'center';
      hero.style.backgroundRepeat = 'no-repeat';
      hero.style.setProperty('--hero-edge-blend-color', resolveEdgeBlendColor(hero));
    });

    // If the configured file cannot be loaded (e.g. deployment lag), keep hero visuals working.
    const probe = new Image();
    probe.onload = () => {};
    probe.onerror = () => {
      heroes.forEach((hero) => {
        hero.style.backgroundImage = `${overlay}, url(${fallbackBg})`;
      });
    };
    probe.src = pageBg;

    const observer = new MutationObserver(() => {
      const dark = effectiveTheme() === 'dark';
      const dynamicOverlay = dark
        ? 'linear-gradient(180deg, rgba(7,17,14,.84), rgba(11,20,17,.72) 75%)'
        : 'linear-gradient(180deg, rgba(244,250,247,.88), rgba(255,255,255,.80) 75%)';
      heroes.forEach((hero) => {
        hero.style.backgroundImage = `${dynamicOverlay}, url(${pageBg})`;
        hero.style.setProperty('--hero-edge-blend-color', resolveEdgeBlendColor(hero));
      });
    });
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
  };

  const setupThemeToggle = () => {
    const btn = document.querySelector('[data-theme-toggle]');
    if (!(btn instanceof HTMLButtonElement)) return;

    const lang = preferredLang();

    const labelsByLang = {
      en: {
        dark: { text: 'Dark', aria: 'Switch to dark mode' },
        light: { text: 'Light', aria: 'Switch to light mode' },
        auto: { aria: 'Toggle dark mode' },
      },
      de: {
        dark: { text: 'Dark', aria: 'Dark Mode einschalten' },
        light: { text: 'Light', aria: 'Dark Mode ausschalten' },
        auto: { aria: 'Dark Mode umschalten' },
      },
      yue: {
        dark: { text: '深色', aria: '切换到深色模式' },
        light: { text: '浅色', aria: '切换到浅色模式' },
        auto: { aria: '切换深色模式' },
      },
      es: {
        dark: { text: 'Oscuro', aria: 'Cambiar a modo oscuro' },
        light: { text: 'Claro', aria: 'Cambiar a modo claro' },
        auto: { aria: 'Alternar modo oscuro' },
      },
      fr: {
        dark: { text: 'Sombre', aria: 'Passer en mode sombre' },
        light: { text: 'Clair', aria: 'Passer en mode clair' },
        auto: { aria: 'Basculer le mode sombre' },
      },
    };
    const labels = labelsByLang[lang] || labelsByLang.en;

    const ensureIconButton = () => {
      if (btn.dataset.themeIcon === '1') return;
      btn.dataset.themeIcon = '1';
      btn.classList.add('theme-toggle--icon');
      btn.textContent = '';

      const icon = document.createElement('span');
      icon.className = 'theme-icon';
      icon.setAttribute('aria-hidden', 'true');

      const label = document.createElement('span');
      label.className = 'sr-only';
      label.dataset.themeLabel = '1';

      btn.append(icon, label);
    };

    const sync = () => {
      ensureIconButton();
      const current = effectiveTheme();
      const next = current === 'dark' ? 'light' : 'dark';
      const nextLabel = labels[next] || labels.auto;
      const labelText = nextLabel.text || labels.auto.text || 'Theme';
      const ariaText = nextLabel.aria || labels.auto.aria;
      const labelEl = btn.querySelector('[data-theme-label]');
      if (labelEl) labelEl.textContent = labelText;
      btn.setAttribute('aria-label', ariaText);
      btn.title = ariaText;
      btn.setAttribute('aria-pressed', current === 'dark' ? 'true' : 'false');
      btn.dataset.nextTheme = next;
    };

    sync();

    btn.addEventListener('click', (e) => {
      e.preventDefault();

      // Optional: reset to system preference with Shift/Alt.
      if (e.shiftKey || e.altKey) {
        localStorage.removeItem(themeKey);
        applyStoredTheme();
        sync();
        return;
      }

      const current = effectiveTheme();
      const next = current === 'dark' ? 'light' : 'dark';
      localStorage.setItem(themeKey, next);
      applyStoredTheme();
      sync();
    });

    const mq = themeQuery();
    const onSystemChange = () => {
      if (storedTheme()) return;
      applyStoredTheme();
      sync();
    };
    try {
      mq.addEventListener('change', onSystemChange);
    } catch {
      // Safari < 14
      // eslint-disable-next-line deprecation/deprecation
      mq.addListener(onSystemChange);
    }
  };

  const setupSiteSearch = () => {
    const actions = document.querySelector('.site-header-actions');
    if (!(actions instanceof HTMLElement)) return;
    if (actions.querySelector('[data-search-shell]')) return;

    const normalizeLang = (value) => {
      const raw = String(value || '').toLowerCase();
      if (raw === 'zh' || raw === 'zh-cn') return 'yue';
      return raw === 'de' || raw === 'en' || raw === 'es' || raw === 'fr' || raw === 'yue' ? raw : '';
    };
    const bodyLang = normalizeLang(document.body?.dataset?.activeLang);
    const pageLang = normalizeLang(document.documentElement?.dataset?.pageLang);
    const paramLang = normalizeLang(new URLSearchParams(window.location.search).get('lang'));
    const forcedLang = bodyLang || pageLang || paramLang;
    const lang = forcedLang || preferredLang();
    const labelsByLang = {
      en: {
        label: 'Search',
        placeholder: 'Search pages',
        clear: 'Clear search',
        quick: 'Quick links',
        noResults: 'No results',
        loading: 'Indexing site content…',
        results: (count) => `${count} result${count === 1 ? '' : 's'}`,
      },
      de: {
        label: 'Suche',
        placeholder: 'Seiten durchsuchen',
        clear: 'Suche löschen',
        quick: 'Beliebte Seiten',
        noResults: 'Keine Treffer',
        loading: 'Website-Inhalte werden indiziert…',
        results: (count) => `${count} Ergebnis${count === 1 ? '' : 'se'}`,
      },
      es: {
        label: 'Buscar',
        placeholder: 'Buscar páginas',
        clear: 'Borrar búsqueda',
        quick: 'Páginas frecuentes',
        noResults: 'Sin resultados',
        loading: 'Indexando contenidos del sitio…',
        results: (count) => `${count} resultado${count === 1 ? '' : 's'}`,
      },
      fr: {
        label: 'Recherche',
        placeholder: 'Rechercher des pages',
        clear: 'Effacer la recherche',
        quick: 'Pages fréquentes',
        noResults: 'Aucun résultat',
        loading: 'Indexation du contenu du site…',
        results: (count) => `${count} résultat${count === 1 ? '' : 's'}`,
      },
      yue: {
        label: '搜索',
        placeholder: '搜索页面',
        clear: '清除搜索',
        quick: '常用页面',
        noResults: '没有结果',
        loading: '正在建立全站索引…',
        results: (count) => `${count} 条结果`,
      },
    };
    const labels = labelsByLang[lang] || labelsByLang.en;

    const shell = document.createElement('div');
    shell.className = 'search-shell';
    shell.dataset.searchShell = '1';

    const toggle = document.createElement('button');
    toggle.type = 'button';
    toggle.className = 'search-toggle';
    toggle.dataset.searchToggle = '1';
    toggle.setAttribute('aria-expanded', 'false');
    toggle.setAttribute('aria-label', labels.label);
    toggle.title = labels.label;

    const icon = document.createElement('span');
    icon.className = 'search-icon';
    icon.setAttribute('aria-hidden', 'true');

    const toggleLabel = document.createElement('span');
    toggleLabel.className = 'sr-only';
    toggleLabel.textContent = labels.label;

    toggle.append(icon, toggleLabel);

    const panel = document.createElement('div');
    panel.className = 'search-panel';
    panel.id = 'site-search-panel';
    panel.setAttribute('role', 'region');
    panel.setAttribute('aria-label', labels.label);
    panel.setAttribute('aria-hidden', 'true');
    panel.hidden = true;
    toggle.setAttribute('aria-controls', panel.id);

    const form = document.createElement('form');
    form.className = 'search-form';
    form.setAttribute('role', 'search');
    form.setAttribute('autocomplete', 'off');

    const inputWrap = document.createElement('div');
    inputWrap.className = 'search-input-wrap';

    const fieldIcon = document.createElement('span');
    fieldIcon.className = 'search-field-icon';
    fieldIcon.setAttribute('aria-hidden', 'true');

    const input = document.createElement('input');
    input.type = 'search';
    input.className = 'search-input';
    input.placeholder = labels.placeholder;
    input.setAttribute('aria-label', labels.label);
    input.setAttribute('enterkeyhint', 'search');
    input.setAttribute('autocapitalize', 'none');
    input.autocomplete = 'off';
    input.spellcheck = false;

    const clear = document.createElement('button');
    clear.type = 'button';
    clear.className = 'search-clear';
    clear.setAttribute('aria-label', labels.clear);
    clear.title = labels.clear;
    clear.disabled = true;

    inputWrap.append(fieldIcon, input, clear);
    form.append(inputWrap);

    const status = document.createElement('div');
    status.className = 'search-status';
    status.setAttribute('aria-live', 'polite');

    const results = document.createElement('div');
    results.className = 'search-results';
    results.setAttribute('role', 'list');

    panel.append(form, status, results);
    shell.append(toggle, panel);

    const themeBtn = actions.querySelector('[data-theme-toggle]');
    if (themeBtn instanceof HTMLElement) actions.insertBefore(shell, themeBtn);
    else actions.prepend(shell);

    let index = getSearchIndex(lang);
    let indexAll = getSearchIndexAll();
    const maxResults = 6;
    const groupMap = new Map();
    const rebuildGroupMap = () => {
      groupMap.clear();
      indexAll.forEach((item) => {
        const list = groupMap.get(item.groupKey) || [];
        list.push(item);
        groupMap.set(item.groupKey, list);
      });
    };
    rebuildGroupMap();
    const langOrder = [lang, ...LANG_ORDER.filter((code) => code !== lang)];
    const langRank = (code) => {
      const idx = langOrder.indexOf(code);
      return idx === -1 ? 99 : idx;
    };

    const updateClear = () => {
      const hasValue = input.value.trim().length > 0;
      clear.disabled = !hasValue;
      clear.classList.toggle('is-visible', hasValue);
    };

    const renderResults = (list, { showLang = false } = {}) => {
      results.textContent = '';
      list.forEach((item) => {
        const link = document.createElement('a');
        link.className = 'search-result';
        link.href = item.href;
        link.setAttribute('role', 'listitem');

        const header = document.createElement('div');
        header.className = 'search-result-header';

        const title = document.createElement('div');
        title.className = 'search-result-title';
        title.textContent = item.title;
        header.append(title);

        if (showLang && item.lang) {
          const meta = LANG_META[item.lang] || {};
          const langWrap = document.createElement('span');
          langWrap.className = 'search-result-lang';
          if (meta.name) langWrap.title = meta.name;

          const flag = document.createElement('span');
          flag.className = `lang-flag flag-${meta.flag || item.lang}`;
          flag.setAttribute('aria-hidden', 'true');

          const code = document.createElement('span');
          code.className = 'search-result-lang-code';
          code.textContent = meta.short || item.lang.toUpperCase();

          langWrap.append(flag, code);
          header.append(langWrap);
        }

        link.append(header);

        if (item.desc) {
          const desc = document.createElement('div');
          desc.className = 'search-result-desc';
          desc.textContent = item.desc;
          link.append(desc);
        }

        results.append(link);
      });
    };

    const updateResults = () => {
      const raw = input.value.trim();
      const query = normalizeSearchText(raw);
      updateClear();

      if (!query) {
        status.textContent = labels.quick;
        renderResults(index.slice(0, maxResults));
        return;
      }

      const tokens = query.split(/\s+/).filter(Boolean);
      const compactQuery = query.replace(/\s+/g, '');
      const matches = indexAll.filter((item) => {
        const tokenMatch = tokens.every((token) => item.haystack.includes(token));
        if (tokenMatch) return true;
        return tokens.length === 1 && compactQuery && item.compactHaystack.includes(compactQuery);
      });

      if (!matches.length) {
        status.textContent = labels.noResults;
        results.textContent = '';
        return;
      }

      const scoreItem = (item) => {
        const fieldScore = (field, weight) =>
          tokens.reduce((sum, token) => sum + (String(field || '').includes(token) ? weight : 0), 0);
        return (
          fieldScore(item.titleHaystack || item.haystack, 8) +
          fieldScore(item.keywordHaystack, 6) +
          fieldScore(item.descHaystack, 4) +
          fieldScore(item.bodyHaystack || item.haystack, 1) -
          langRank(item.lang) * 0.05
        );
      };

      const bestByGroup = new Map();
      matches.forEach((item) => {
        const score = scoreItem(item);
        const currentBest = bestByGroup.get(item.groupKey);
        if (!currentBest || score > currentBest.score) {
          bestByGroup.set(item.groupKey, { item, score });
        }
      });

      const expanded = Array.from(bestByGroup.values())
        .sort((a, b) => b.score - a.score || langRank(a.item.lang) - langRank(b.item.lang))
        .slice(0, maxResults)
        .map((entry) => entry.item);

      status.textContent = labels.results(expanded.length);
      renderResults(expanded, { showLang: expanded.some((item) => item.lang !== lang) });
    };

    status.textContent = labels.loading || labels.quick;
    void loadFullTextSearchIndex()
      .then((full) => {
        if (!Array.isArray(full) || !full.length) return;
        indexAll = full;
        index = full.filter((item) => item.lang === lang);
        if (!index.length) index = getSearchIndex(lang);
        rebuildGroupMap();
        updateResults();
      })
      .catch(() => {
        updateResults();
      });

    const setOpen = (open) => {
      shell.classList.toggle('is-open', open);
      toggle.setAttribute('aria-expanded', open ? 'true' : 'false');
      panel.hidden = !open;
      panel.setAttribute('aria-hidden', open ? 'false' : 'true');
      if (!open) return;
      updateResults();
      window.setTimeout(() => {
        try {
          input.focus({ preventScroll: true });
        } catch {
          input.focus();
        }
      }, 0);
    };

    toggle.addEventListener('click', (e) => {
      e.preventDefault();
      setOpen(!shell.classList.contains('is-open'));
    });

    clear.addEventListener('click', (e) => {
      e.preventDefault();
      input.value = '';
      updateResults();
      input.focus();
    });

    input.addEventListener('input', () => updateResults());

    form.addEventListener('submit', (e) => {
      e.preventDefault();
      const first = results.querySelector('.search-result');
      if (first instanceof HTMLAnchorElement) window.location.href = first.href;
    });

    document.addEventListener('click', (e) => {
      if (!shell.classList.contains('is-open')) return;
      const target = e.target;
      if (!(target instanceof Node)) return;
      if (!shell.contains(target)) setOpen(false);
    });

    document.addEventListener('keydown', (e) => {
      if (e.key !== 'Escape') return;
      if (!shell.classList.contains('is-open')) return;
      setOpen(false);
      toggle.focus();
    });
  };

  const setupMobileInteractiveSync = () => {
    const isMobile = () =>
      !!(
        window.matchMedia &&
        (
          window.matchMedia('(max-width: 900px)').matches ||
          !window.matchMedia('(hover: hover) and (pointer: fine)').matches
        )
      );

    const getHeaderOffset = () => {
      const header = document.querySelector('.site-header');
      if (!(header instanceof HTMLElement)) return 16;
      const rect = header.getBoundingClientRect();
      const h = typeof rect.height === 'number' && Number.isFinite(rect.height) ? rect.height : 0;
      return Math.max(16, Math.min(220, Math.round(h) + 16));
    };

    const isInView = (el, padTop = 0, padBottom = 0) => {
      if (!(el instanceof HTMLElement)) return false;
      const r = el.getBoundingClientRect();
      const topOk = r.top >= padTop;
      const bottomOk = r.bottom <= window.innerHeight - padBottom;
      return topOk && bottomOk;
    };

    const keepInteractiveStable = (stage, panel, focusEl) => {
      if (!isMobile()) return;
      if (!(stage instanceof HTMLElement)) return;
      if (!(panel instanceof HTMLElement)) return;
      const headerOffset = getHeaderOffset();

      const padTop = headerOffset + 10;
      const padBottom = 24;
      const usableTop = padTop;
      const usableBottom = window.innerHeight - padBottom;
      const usableHeight = Math.max(0, usableBottom - usableTop);

      const stageRect = stage.getBoundingClientRect();
      const panelRect = panel.getBoundingClientRect();
      if (!(Number.isFinite(stageRect.top) && Number.isFinite(stageRect.bottom))) return;

      const unionTop = Math.min(stageRect.top, panelRect.top);
      const unionBottom = Math.max(stageRect.bottom, panelRect.bottom);
      const unionHeight = unionBottom - unionTop;

      let delta = 0;

      // If the combined block fits, center it as a whole.
      if (unionHeight > 0 && unionHeight <= usableHeight) {
        const viewportCenter = (usableTop + usableBottom) / 2;
        const unionCenter = (unionTop + unionBottom) / 2;
        delta = unionCenter - viewportCenter;
      } else {
        // Otherwise: keep the stage consistently just below the header.
        delta = stageRect.top - usableTop;
      }

      if (Number.isFinite(delta) && Math.abs(delta) >= 6) {
        try {
          window.scrollBy({ top: delta, behavior: 'smooth' });
        } catch {
          window.scrollBy(0, delta);
        }
      }

      // Finally, if a specific element (e.g. the opened <details>) is meant to be interacted with,
      // make sure it stays visible without forcing it to the top.
      if (focusEl instanceof HTMLElement) {
        if (!isInView(focusEl, usableTop, padBottom)) {
          const r = focusEl.getBoundingClientRect();
          let d2 = 0;
          if (r.bottom > usableBottom) d2 = r.bottom - usableBottom + 10;
          else if (r.top < usableTop) d2 = r.top - usableTop - 10;
          if (Number.isFinite(d2) && Math.abs(d2) >= 6) {
            try {
              window.scrollBy({ top: d2, behavior: 'smooth' });
            } catch {
              window.scrollBy(0, d2);
            }
          }
        }
      }
    };

    const flash = (el, className) => {
      if (!(el instanceof HTMLElement)) return;
      el.classList.remove(className);
      // Force a reflow so the animation can restart.
      void el.offsetWidth;
      el.classList.add(className);
      window.setTimeout(() => el.classList.remove(className), 1400);
    };

    const ensureVisible = (el) => {
      if (!isMobile()) return;
      if (!(el instanceof HTMLElement)) return;
      const headerOffset = getHeaderOffset();
      if (isInView(el, headerOffset + 8, 24)) return;
      const r = el.getBoundingClientRect();
      const targetTop = window.scrollY + r.top - headerOffset - 12;
      if (!Number.isFinite(targetTop)) return;
      const next = Math.max(0, Math.round(targetTop));
      try {
        window.scrollTo({ top: next, behavior: 'smooth' });
      } catch {
        window.scrollTo(0, next);
      }
    };

    const panels = Array.from(document.querySelectorAll('.reveal-mobile-panel')).filter(
      (el) => el instanceof HTMLElement,
    );
    if (!panels.length) return;

    panels.forEach((panel) => {
      const wrapper = panel.parentElement;
      if (!(wrapper instanceof HTMLElement)) return;

      const stage = wrapper.querySelector('.reveal-stage');
      if (!(stage instanceof HTMLElement)) return;

      const hotspots = Array.from(stage.querySelectorAll('[data-hotspot]')).filter(
        (el) => el instanceof HTMLElement,
      );
      const items = Array.from(panel.querySelectorAll('details[data-hotspot]')).filter(
        (el) => el instanceof HTMLDetailsElement,
      );
      if (!hotspots.length || !items.length) return;

      const hotspotByKey = new Map(hotspots.map((el) => [String(el.dataset.hotspot), el]));
      const itemByKey = new Map(items.map((el) => [String(el.dataset.hotspot), el]));

      const clearItemHighlights = () => items.forEach((d) => d.classList.remove('is-highlight'));
      const clearHotspotHighlights = () =>
        hotspots.forEach((h) => h.classList.remove('is-highlight'));

      const closeOtherItems = (keepKey) => {
        items.forEach((d) => {
          const key = String(d.dataset.hotspot || '');
          if (!key || key === keepKey) return;
          d.open = false;
        });
      };

      const openItem = (key) => {
        const item = itemByKey.get(key);
        if (!item) return;
        closeOtherItems(key);
        item.open = true;
        flash(item, 'is-highlight');
        keepInteractiveStable(stage, panel, item);
      };

      const highlightHotspot = (key) => {
        const hs = hotspotByKey.get(key);
        if (!hs) return;
        flash(hs, 'is-highlight');
        keepInteractiveStable(stage, panel);
      };

      hotspots.forEach((hs) => {
        hs.addEventListener('click', (e) => {
          if (!isMobile()) return;
          const key = String(hs.dataset.hotspot || '');
          if (!key) return;
          e.preventDefault();

          const item = itemByKey.get(key);
          const isOpen = item instanceof HTMLDetailsElement ? item.open : false;

          clearHotspotHighlights();
          clearItemHighlights();

          if (isOpen) {
            item.open = false;
            window.setTimeout(() => keepInteractiveStable(stage, panel), 60);
            return;
          }

          flash(hs, 'is-highlight');
          openItem(key);
          // After layout changes (details open/close), re-apply once more.
          window.setTimeout(() => keepInteractiveStable(stage, panel, itemByKey.get(key)), 80);
        });
      });

      items.forEach((item) => {
        item.addEventListener('toggle', () => {
          if (!isMobile()) return;
          const key = String(item.dataset.hotspot || '');
          if (!key) return;
          if (!item.open) {
            clearHotspotHighlights();
            clearItemHighlights();
            return;
          }

          closeOtherItems(key);

          clearHotspotHighlights();
          clearItemHighlights();

          item.classList.add('is-highlight');
          highlightHotspot(key);
          // Keep stage + panel visible and reduce scroll anchoring jumps.
          window.setTimeout(() => keepInteractiveStable(stage, panel, item), 80);
        });
      });
    });
  };

  const setupRevealCursorTooltips = () => {
    const usesTapMode = () =>
      typeof window !== 'undefined' &&
      typeof window.matchMedia === 'function' &&
      (
        window.matchMedia('(max-width: 900px)').matches ||
        !window.matchMedia('(hover: hover) and (pointer: fine)').matches
      );
    if (usesTapMode()) return;

    const layers = Array.from(document.querySelectorAll('.reveal-stage .reveal-layer')).filter(
      (el) => el instanceof HTMLElement,
    );
    if (!layers.length) return;

    const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

    const getStage = (layer) => {
      const stage = layer.closest('.reveal-stage');
      return stage instanceof HTMLElement ? stage : null;
    };

    const positionTooltip = (stage, e, tooltip) => {
      if (usesTapMode()) return;
      if (!(tooltip instanceof HTMLElement)) return;

      const stageRect = stage.getBoundingClientRect();
      const pad = 10;
      const offset = 18;

      // Coordinates inside the stage (image box)
      let x = e.clientX - stageRect.left + offset;
      let y = e.clientY - stageRect.top + offset;

      tooltip.style.left = `${x}px`;
      tooltip.style.top = `${y}px`;
      tooltip.style.right = 'auto';
      tooltip.style.bottom = 'auto';

      const rect = tooltip.getBoundingClientRect();

      // If it would overflow to the right/bottom, flip to the other side of the cursor.
      if (x + rect.width > stageRect.width - pad) x = e.clientX - stageRect.left - rect.width - offset;
      if (y + rect.height > stageRect.height - pad) y = e.clientY - stageRect.top - rect.height - offset;

      x = clamp(x, pad, Math.max(pad, stageRect.width - rect.width - pad));
      y = clamp(y, pad, Math.max(pad, stageRect.height - rect.height - pad));

      tooltip.style.left = `${x}px`;
      tooltip.style.top = `${y}px`;
    };

    layers.forEach((layer) => {
      const tooltip = layer.querySelector('.reveal-tooltip');
      if (!(tooltip instanceof HTMLElement)) return;

      const stage = getStage(layer);
      if (!stage) return;

      // Move tooltip into the stage so it can be clipped to the image area.
      // This also avoids any influence from per-hotspot CSS (right/bottom) selectors.
      stage.appendChild(tooltip);

      tooltip.style.position = 'absolute';
      tooltip.style.zIndex = '6';
      tooltip.style.display = 'block';
      tooltip.style.width = 'max-content';
      tooltip.style.maxWidth = '300px';
      tooltip.style.padding = '24px 28px';
      tooltip.style.background = 'var(--surface-2)';
      tooltip.style.backdropFilter = 'blur(8px)';
      tooltip.style.webkitBackdropFilter = 'blur(8px)';
      tooltip.style.borderRadius = '12px';
      tooltip.style.color = 'var(--ink)';
      tooltip.style.textAlign = 'left';
      tooltip.style.boxShadow = '0 16px 40px rgba(0,0,0,.14)';
      tooltip.style.pointerEvents = 'none';
      tooltip.style.setProperty('--tx', '0px');
      tooltip.style.setProperty('--ty', '0px');
      tooltip.style.opacity = '0';
      tooltip.style.transform = 'translate(0,12px)';

      let raf = 0;
      /** @type {MouseEvent | null} */
      let last = null;

      const show = () => {
        tooltip.style.opacity = '1';
        tooltip.style.transform = 'translate(0,0)';
      };

      const hide = () => {
        tooltip.style.opacity = '0';
        tooltip.style.transform = 'translate(0,12px)';
      };

      const onMove = (e) => {
        last = e;
        if (raf) return;
        raf = window.requestAnimationFrame(() => {
          raf = 0;
          if (!last) return;
          positionTooltip(stage, last, tooltip);
        });
      };

      const onEnter = (e) => {
        show();
        positionTooltip(stage, e, tooltip);
      };

      const onLeave = () => {
        if (raf) {
          window.cancelAnimationFrame(raf);
          raf = 0;
        }
        last = null;
        hide();
      };

      layer.addEventListener('mouseenter', onEnter, { passive: true });
      layer.addEventListener('mousemove', onMove, { passive: true });
      layer.addEventListener('mouseleave', onLeave, { passive: true });

      // Keyboard users: place tooltip near hotspot center when focusing.
      layer.addEventListener('focus', () => {
        if (usesTapMode()) return;
        const layerRect = layer.getBoundingClientRect();
        const synthetic = {
          clientX: layerRect.left + layerRect.width / 2,
          clientY: layerRect.top + layerRect.height / 2,
        };
        show();
        positionTooltip(stage, synthetic, tooltip);
      });
      layer.addEventListener('blur', hide);
    });
  };

  const setupRevealLayerToggles = () => {
    const layers = Array.from(document.querySelectorAll('.reveal-layer')).filter(
      (el) => el instanceof HTMLElement,
    );
    if (!layers.length) return;

    const usesTapMode = () =>
      typeof window !== 'undefined' &&
      typeof window.matchMedia === 'function' &&
      (
        window.matchMedia('(max-width: 900px)').matches ||
        !window.matchMedia('(hover: hover) and (pointer: fine)').matches
      );

    const setExpanded = (btn, expanded) =>
      btn.setAttribute('aria-expanded', expanded ? 'true' : 'false');

    layers.forEach((btn) => setExpanded(btn, false));

    const closeAll = () => {
      layers.forEach((btn) => {
        btn.classList.remove('is-open');
        setExpanded(btn, false);
      });
    };

    layers.forEach((btn) => {
      btn.addEventListener('click', () => {
        if (!usesTapMode()) return;
        const wasOpen = btn.classList.contains('is-open');
        closeAll();
        if (!wasOpen) {
          btn.classList.add('is-open');
          setExpanded(btn, true);
        }
      });
    });

    document.addEventListener('click', (event) => {
      if (!(event.target instanceof HTMLElement)) return;
      if (event.target.closest('.reveal-layer')) return;
      closeAll();
    });

    document.addEventListener('keydown', (event) => {
      if (event.key !== 'Escape') return;
      closeAll();
    });
  };

  const setupHotspotWrappers = () => {
    const wrappers = Array.from(document.querySelectorAll('.hotspot-wrapper')).filter(
      (el) => el instanceof HTMLElement,
    );
    if (!wrappers.length) return;

    const isMobile = () =>
      !!(
        window.matchMedia &&
        (
          window.matchMedia('(max-width: 900px)').matches ||
          !window.matchMedia('(hover: hover) and (pointer: fine)').matches
        )
      );

    const allHotspots = Array.from(document.querySelectorAll('.hotspot-wrapper .hotspot')).filter(
      (el) => el instanceof HTMLElement,
    );
    if (!allHotspots.length) return;

    const setExpanded = (btn, expanded) => btn.setAttribute('aria-expanded', expanded ? 'true' : 'false');
    allHotspots.forEach((btn) => setExpanded(btn, false));

    const closeAll = () => {
      allHotspots.forEach((btn) => {
        btn.classList.remove('active');
        setExpanded(btn, false);
      });
    };

    const closePanels = () => {
      document.querySelectorAll('.reveal-mobile-panel details[open]').forEach((d) => {
        if (d instanceof HTMLDetailsElement) d.open = false;
      });
    };

      const openPanelItem = (btn) => {
        if (!(btn instanceof HTMLElement)) return;
        const key = String(btn.dataset.hotspot || '');
        if (!key) return;
      const container = btn.closest('.hotspot-wrapper');
      if (!(container instanceof HTMLElement)) return;
      const containerKey = String(container.dataset.hotspotContainer || '');
      if (!containerKey) return;

      const panel = document.querySelector(`.reveal-mobile-panel[data-hotspot-panel="${CSS.escape(containerKey)}"]`);
      if (!(panel instanceof HTMLElement)) return;
      const details = panel.querySelector(`details[data-hotspot="${CSS.escape(key)}"]`);
      if (!(details instanceof HTMLDetailsElement)) return;

        closePanels();
        details.open = true;
      };

    const openHotspotFromPanel = (panelKey, key) => {
      const btn = document.querySelector(
        `.hotspot-wrapper[data-hotspot-container="${CSS.escape(panelKey)}"] .hotspot[data-hotspot="${CSS.escape(key)}"]`,
      );
      if (!(btn instanceof HTMLElement)) return;
      closeAll();
      btn.classList.add('active');
      setExpanded(btn, true);
    };

    allHotspots.forEach((btn) => {
      btn.addEventListener('click', () => {
        if (isMobile()) {
          closeAll();
          btn.classList.add('active');
          setExpanded(btn, true);
          openPanelItem(btn);
          return;
        }
        const wasOpen = btn.classList.contains('active');
        closeAll();
        if (!wasOpen) {
          btn.classList.add('active');
          setExpanded(btn, true);
        }
      });
    });

    document.addEventListener('click', (e) => {
      const target = e.target;
      if (target instanceof Element && target.closest('.hotspot-wrapper .hotspot')) return;
      closeAll();
    });

    document.addEventListener('keydown', (e) => {
      if (e.key !== 'Escape') return;
      closeAll();
      closePanels();
    });

    document.querySelectorAll('.reveal-mobile-panel details[data-hotspot]').forEach((details) => {
      if (!(details instanceof HTMLDetailsElement)) return;
      details.addEventListener('toggle', () => {
        if (!isMobile()) return;
        if (!details.open) return;
        const key = String(details.dataset.hotspot || '');
        if (!key) return;
        const panel = details.closest('.reveal-mobile-panel');
        if (!(panel instanceof HTMLElement)) return;
        const panelKey = String(panel.dataset.hotspotPanel || '');
        if (!panelKey) return;
        openHotspotFromPanel(panelKey, key);
      });
    });
  };

  const hotspotStoreKey = 'hotspotPositionsV2';
  const getPageKey = () => {
    const { pathname } = window.location;
    // Stable key across pretty URLs and .html
    const cleaned = String(pathname || '/').replace(/\/+$/, '') || '/';
    const last = cleaned.split('/').filter(Boolean).pop() || 'index';
    // drop .html if present
    const base = last.replace(/\.html$/i, '');
    // prefer shared keys across language variants
    return base.replace(/\.en$/i, '');
  };

  const readHotspotStore = () => {
    try {
      const raw = localStorage.getItem(hotspotStoreKey);
      if (!raw) return {};
      const parsed = JSON.parse(raw);
      return parsed && typeof parsed === 'object' ? parsed : {};
    } catch {
      return {};
    }
  };

  const writeHotspotStore = (store) => {
    try {
      localStorage.setItem(hotspotStoreKey, JSON.stringify(store));
    } catch {}
  };

  const getHotspotContainers = () => {
    const stages = Array.from(document.querySelectorAll('.reveal-stage')).filter(
      (el) => el instanceof HTMLElement,
    );
    const wrappers = Array.from(document.querySelectorAll('.hotspot-wrapper')).filter(
      (el) => el instanceof HTMLElement,
    );

    const containers = [];
    stages.forEach((el, i) => containers.push({ type: 'reveal-stage', index: i, el }));
    wrappers.forEach((el, i) => containers.push({ type: 'hotspot-wrapper', index: i, el }));
    return containers;
  };

  const getHotspotElementsInContainer = (container) => {
    const selector =
      container.type === 'hotspot-wrapper'
        ? '.hotspot[data-hotspot]'
        : '[data-hotspot]';
    return Array.from(container.el.querySelectorAll(selector)).filter((el) => el instanceof HTMLElement);
  };

  const getContainerKey = (container) => {
    const label = container?.el instanceof HTMLElement ? String(container.el.dataset.hotspotContainer || '') : '';
    const suffix = label || String(container.index);
    return `${container.type}-${suffix}`;
  };

  const applyHotspotOverrides = () => {
    const store = readHotspotStore();
    const pageKey = getPageKey();
    const page = store[pageKey];
    if (!page || typeof page !== 'object') return;

    const containers = getHotspotContainers();
    containers.forEach((container) => {
      const containerKey = getContainerKey(container);
      const cfgs = page[containerKey];
      if (!cfgs || typeof cfgs !== 'object') return;

      const els = getHotspotElementsInContainer(container);
      els.forEach((el) => {
        const key = String(el.dataset.hotspot || '');
        if (!key) return;
        const cfg = cfgs[key];
        if (!cfg || typeof cfg !== 'object') return;

        const left = Number(cfg.left);
        const top = Number(cfg.top);
        if (![left, top].every((v) => Number.isFinite(v))) return;

        el.style.left = `${left}%`;
        el.style.top = `${top}%`;
        el.style.right = '';
        el.style.bottom = '';

        if (container.type === 'reveal-stage') {
          const width = Number(cfg.width);
          const height = Number(cfg.height);
          if ([width, height].every((v) => Number.isFinite(v))) {
            el.style.width = `${width}%`;
            el.style.height = `${height}%`;
          }
        }
      });
    });
  };

  const setupHotspotCalibrator = () => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('calibrate') !== '1') return;

    const store = readHotspotStore();
    const pageKey = getPageKey();
    if (!store[pageKey]) store[pageKey] = {};

    const containers = getHotspotContainers();
    if (!containers.length) return;

    let activeContainer = containers[0];
    let activeContainerKey = getContainerKey(activeContainer);
    if (!store[pageKey][activeContainerKey]) store[pageKey][activeContainerKey] = {};

    const getActiveEls = () => getHotspotElementsInContainer(activeContainer);
    let els = getActiveEls();
    if (!els.length) return;

    let activeKey = String(els[0].dataset.hotspot || '');
    const getKeys = () =>
      Array.from(new Set(getActiveEls().map((el) => String(el.dataset.hotspot || '')).filter(Boolean)));

    let keys = getKeys();
    if (!keys.length) return;

    const panel = document.createElement('div');
    panel.style.position = 'fixed';
    panel.style.right = '12px';
    panel.style.bottom = '12px';
    panel.style.zIndex = '2000';
    panel.style.maxWidth = 'min(92vw, 380px)';
    panel.style.padding = '10px';
    panel.style.borderRadius = '14px';
    panel.style.border = '1px solid rgba(0,0,0,.12)';
    panel.style.background = 'rgba(255,255,255,.85)';
    panel.style.backdropFilter = 'blur(10px)';
    panel.style.color = '#122018';
    panel.style.font = '500 12px/1.35 Inter, system-ui, -apple-system, Segoe UI, Roboto, sans-serif';
    panel.style.boxShadow = '0 20px 50px rgba(0,0,0,.18)';

    const title = document.createElement('div');
    title.textContent = `Hotspot Kalibrierung (${pageKey})`;
    title.style.fontWeight = '700';
    title.style.marginBottom = '8px';
    panel.append(title);

    const hint = document.createElement('div');
    hint.textContent = '1) Key wählen  2) auf Bild tippen  3) „Speichern“';
    hint.style.opacity = '0.85';
    hint.style.marginBottom = '10px';
    panel.append(hint);

    const containerSelect = document.createElement('select');
    containerSelect.style.width = '100%';
    containerSelect.style.padding = '8px 10px';
    containerSelect.style.borderRadius = '10px';
    containerSelect.style.border = '1px solid rgba(0,0,0,.14)';
    containerSelect.style.background = 'rgba(255,255,255,.8)';
    containerSelect.style.marginBottom = '10px';
    containerSelect.style.font = '600 12px/1.1 Inter, system-ui, -apple-system, Segoe UI, Roboto, sans-serif';

    containers.forEach((c) => {
      const opt = document.createElement('option');
      opt.value = getContainerKey(c);
      opt.textContent = `${opt.value} (${getHotspotElementsInContainer(c).length})`;
      containerSelect.append(opt);
    });
    containerSelect.value = activeContainerKey;
    panel.append(containerSelect);

    const row = document.createElement('div');
    row.style.display = 'flex';
    row.style.flexWrap = 'wrap';
    row.style.gap = '6px';
    row.style.marginBottom = '10px';

    const makeBtn = (label) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.textContent = label;
      b.style.padding = '6px 10px';
      b.style.borderRadius = '999px';
      b.style.border = '1px solid rgba(0,0,0,.14)';
      b.style.background = 'rgba(255,255,255,.75)';
      b.style.cursor = 'pointer';
      b.style.font = '600 11px/1 Inter, system-ui, -apple-system, Segoe UI, Roboto, sans-serif';
      return b;
    };

    const keyButtons = new Map();
    const setActive = (k) => {
      activeKey = k;
      for (const [key, btn] of keyButtons.entries()) {
        btn.style.borderColor = key === k ? 'rgba(47,110,166,.8)' : 'rgba(0,0,0,.14)';
        btn.style.background = key === k ? 'rgba(47,110,166,.16)' : 'rgba(255,255,255,.75)';
      }
    };

    const renderKeyButtons = () => {
      row.innerHTML = '';
      keyButtons.clear();
      keys.forEach((k) => {
        const b = makeBtn(k);
        b.addEventListener('click', () => setActive(k));
        keyButtons.set(k, b);
        row.append(b);
      });
      setActive(activeKey || keys[0]);
    };

    panel.append(row);
    renderKeyButtons();

    const output = document.createElement('textarea');
    output.readOnly = true;
    output.style.width = '100%';
    output.style.height = '86px';
    output.style.resize = 'none';
    output.style.padding = '8px 10px';
    output.style.borderRadius = '10px';
    output.style.border = '1px solid rgba(0,0,0,.14)';
    output.style.background = 'rgba(255,255,255,.8)';
    output.style.font = '12px/1.35 ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, \"Liberation Mono\", \"Courier New\", monospace';
    panel.append(output);

    const actions = document.createElement('div');
    actions.style.display = 'flex';
    actions.style.gap = '8px';
    actions.style.marginTop = '10px';

    const saveBtn = makeBtn('Speichern');
    const resetBtn = makeBtn('Reset');
    const closeBtn = makeBtn('Schließen');
    actions.append(saveBtn, resetBtn, closeBtn);
    panel.append(actions);

    const refreshOutput = () => {
      const page = store[pageKey] || {};
      const cfgs = page[activeContainerKey] || {};
      const lines = keys
        .map((k) => {
          const c = cfgs[k];
          if (!c) return `${k}: (unset)`;
          const left = Number(c.left);
          const top = Number(c.top);
          const width = Number(c.width);
          const height = Number(c.height);
          if (Number.isFinite(width) && Number.isFinite(height)) {
            return `${k}: left ${left.toFixed(2)}%, top ${top.toFixed(2)}%, w ${width.toFixed(2)}%, h ${height.toFixed(2)}%`;
          }
          return `${k}: left ${left.toFixed(2)}%, top ${top.toFixed(2)}%`;
        })
        .join('\n');
      output.value = lines;
      // Also log a CSS-friendly snippet for easy copy.
      const cssLines = keys
        .map((k) => {
          const c = cfgs[k];
          if (!c) return null;
          const left = Number(c.left);
          const top = Number(c.top);
          const width = Number(c.width);
          const height = Number(c.height);
          if (Number.isFinite(width) && Number.isFinite(height)) {
            return `/* ${k} */ left:${left.toFixed(2)}%; top:${top.toFixed(2)}%; width:${width.toFixed(2)}%; height:${height.toFixed(2)}%;`;
          }
          return `/* ${k} */ left:${left.toFixed(2)}%; top:${top.toFixed(2)}%;`;
        })
        .filter(Boolean)
        .join('\n');
    };

    const updateElementFromPoint = (key, clientX, clientY) => {
      const el = els.find((e) => String(e.dataset.hotspot || '') === key);
      if (!el) return;
      const containerRect = activeContainer.el.getBoundingClientRect();
      const elRect = el.getBoundingClientRect();
      const wPct = (elRect.width / containerRect.width) * 100;
      const hPct = (elRect.height / containerRect.height) * 100;

      const xPct = ((clientX - containerRect.left) / containerRect.width) * 100;
      const yPct = ((clientY - containerRect.top) / containerRect.height) * 100;

      const left = xPct - wPct / 2;
      const top = yPct - hPct / 2;

      const clampedLeft = Math.max(0, Math.min(100 - wPct, left));
      const clampedTop = Math.max(0, Math.min(100 - hPct, top));

      el.style.left = `${clampedLeft}%`;
      el.style.top = `${clampedTop}%`;
      el.style.right = '';
      el.style.bottom = '';

      if (!store[pageKey][activeContainerKey]) store[pageKey][activeContainerKey] = {};
      if (activeContainer.type === 'reveal-stage') {
        el.style.width = `${wPct}%`;
        el.style.height = `${hPct}%`;
        store[pageKey][activeContainerKey][key] = { left: clampedLeft, top: clampedTop, width: wPct, height: hPct };
      } else {
        // For hotspot-wrapper, keep element sizing controlled by CSS; store only the anchor point.
        store[pageKey][activeContainerKey][key] = { left: clampedLeft, top: clampedTop };
      }
      refreshOutput();
    };

    const onPick = (e) => {
      if (!(e instanceof MouseEvent)) return;
      updateElementFromPoint(activeKey, e.clientX, e.clientY);
    };
    const onPickTouch = (e) => {
      if (!e.touches || !e.touches.length) return;
      const t = e.touches[0];
      updateElementFromPoint(activeKey, t.clientX, t.clientY);
    };

    const bindPickHandlers = () => {
      activeContainer.el.addEventListener('click', onPick);
      activeContainer.el.addEventListener('touchstart', onPickTouch, { passive: true });
    };
    const unbindPickHandlers = () => {
      activeContainer.el.removeEventListener('click', onPick);
      activeContainer.el.removeEventListener('touchstart', onPickTouch);
    };
    bindPickHandlers();

    saveBtn.addEventListener('click', async () => {
      writeHotspotStore(store);
      try {
        await navigator.clipboard.writeText(output.value);
      } catch {}
      saveBtn.textContent = 'Gespeichert';
      window.setTimeout(() => (saveBtn.textContent = 'Speichern'), 900);
    });

    resetBtn.addEventListener('click', () => {
      if (store[pageKey]) delete store[pageKey][activeContainerKey];
      writeHotspotStore(store);
      els.forEach((el) => {
        el.style.left = '';
        el.style.top = '';
        el.style.width = '';
        el.style.height = '';
        el.style.right = '';
        el.style.bottom = '';
      });
      refreshOutput();
    });

    closeBtn.addEventListener('click', () => panel.remove());

    containerSelect.addEventListener('change', () => {
      const nextKey = String(containerSelect.value || '');
      const next = containers.find((c) => getContainerKey(c) === nextKey);
      if (!next) return;
      unbindPickHandlers();
      activeContainer = next;
      activeContainerKey = nextKey;
      if (!store[pageKey][activeContainerKey]) store[pageKey][activeContainerKey] = {};
      els = getHotspotElementsInContainer(activeContainer);
      keys = getKeys();
      activeKey = keys.includes(activeKey) ? activeKey : keys[0];
      renderKeyButtons();
      bindPickHandlers();
      refreshOutput();
    });

    document.body.append(panel);
    refreshOutput();
  };

  const setupMobileNavigation = () => {
    const header = document.querySelector('.site-header');
    if (!(header instanceof HTMLElement)) return;

    const toggle = header.querySelector('.nav-toggle');
    if (!(toggle instanceof HTMLButtonElement)) return;

    const lang = preferredLang();
    const navCopy = {
      en: {
        menuLabel: 'Menu',
        navLabel: 'Navigation',
        phoneLabel: 'Phone: ',
        openMenu: 'Open menu',
      },
      de: {
        menuLabel: 'Menü',
        navLabel: 'Navigation',
        phoneLabel: 'Telefon: ',
        openMenu: 'Menü öffnen',
      },
      yue: {
        menuLabel: '菜单',
        navLabel: '导航',
        phoneLabel: '电话：',
        openMenu: '开启菜单',
      },
    };
    const copy = navCopy[lang] || navCopy.en;
    const isMobile = () => window.matchMedia('(max-width: 900px)').matches;

    const existingDrawer = document.getElementById('mobile-menu');
    const drawer =
      existingDrawer instanceof HTMLElement ? existingDrawer : document.createElement('aside');
    if (!(existingDrawer instanceof HTMLElement)) {
      drawer.id = 'mobile-menu';
      drawer.className = 'mobile-drawer';
      drawer.setAttribute('role', 'dialog');
      drawer.setAttribute('aria-modal', 'true');
      drawer.setAttribute('aria-label', copy.menuLabel);
      drawer.hidden = true;

      const top = document.createElement('div');
      top.className = 'mobile-drawer-top';

      const brand = header.querySelector('.site-logo');
      const brandClone = brand instanceof HTMLAnchorElement ? brand.cloneNode(true) : null;
      if (brandClone instanceof HTMLElement) {
        brandClone.classList.add('mobile-drawer-brand');
        top.append(brandClone);
      }

      const nav = document.createElement('nav');
      nav.className = 'mobile-nav';
      nav.setAttribute('aria-label', copy.navLabel);

      const { file } = getPathParts();
      const createLink = (anchor, className, labelHtml) => {
        const clone = anchor.cloneNode(false);
        if (!(clone instanceof HTMLAnchorElement)) return null;
        clone.removeAttribute('data-lang-toggle');
        clone.className = '';
        if (className) clone.classList.add(className);
        clone.innerHTML = labelHtml !== undefined ? labelHtml : anchor.innerHTML;
        if (clone.getAttribute('href') === file) clone.setAttribute('aria-current', 'page');
        return clone;
      };

      const buildGroup = (detailsEl) => {
        const group = document.createElement('details');
        group.className = 'mobile-nav-group';

        const summarySource = detailsEl.querySelector('summary');
        const summary = document.createElement('summary');
        summary.innerHTML = summarySource ? summarySource.innerHTML : '';
        group.append(summary);

        const panel = document.createElement('div');
        panel.className = 'mobile-nav-panel';

        const menu = detailsEl.querySelector('.nav-menu');
        if (menu?.classList.contains('nav-mega')) {
          const cols = Array.from(menu.querySelectorAll('.nav-mega-col'));
          cols.forEach((col) => {
            const title = col.querySelector('.nav-mega-title');
            if (title) {
              const label = document.createElement('div');
              label.className = 'mobile-nav-subtitle';
              label.innerHTML = title.innerHTML;
              panel.append(label);
            }
            const links = Array.from(col.querySelectorAll('a[href]')).filter(
              (a) => a instanceof HTMLAnchorElement,
            );
            links.forEach((link) => {
              const label = link.querySelector('.nav-mega-link-title');
              const item = createLink(
                link,
                'mobile-nav-subrow',
                label ? label.innerHTML : link.innerHTML,
              );
              if (item) panel.append(item);
            });
          });
        } else if (menu) {
          const links = Array.from(menu.querySelectorAll('a[href]')).filter(
            (a) => a instanceof HTMLAnchorElement,
          );
          links.forEach((link) => {
            const item = createLink(link, 'mobile-nav-subrow');
            if (item) panel.append(item);
          });
        }

        if (panel.childElementCount) group.append(panel);
        return group;
      };

      const siteNav = header.querySelector('.site-nav');
      if (siteNav) {
        const children = Array.from(siteNav.children);
        children.forEach((child) => {
          if (child instanceof HTMLAnchorElement) {
            const item = createLink(child, 'mobile-nav-row');
            if (item) nav.append(item);
            return;
          }
          if (!(child instanceof HTMLElement)) return;
          if (!child.matches('details.nav-group')) return;
          const group = buildGroup(child);
          nav.append(group);
        });
      }

      const meta = document.createElement('div');
      meta.className = 'mobile-meta';
      meta.textContent = '';

      const phoneWrap = document.createElement('span');
      phoneWrap.style.opacity = '.9';
      phoneWrap.append(document.createTextNode(copy.phoneLabel));
      const phone = document.createElement('a');
      phone.href = 'tel:+493088708323';
      phone.textContent = '+49 (0)30 88708323';
      phoneWrap.append(phone);
      meta.append(phoneWrap);

      drawer.append(top, nav, meta);
      document.body.append(drawer);
      drawer.addEventListener('click', (e) => {
        const target = e.target;
        if (target instanceof HTMLElement && target.closest('a')) close();
      });
    }

    toggle.setAttribute('aria-controls', 'mobile-menu');
    toggle.setAttribute('aria-expanded', 'false');

    const overlayExisting = document.querySelector('.mobile-nav-overlay');
    const overlay =
      overlayExisting instanceof HTMLElement ? overlayExisting : document.createElement('div');
    if (!(overlayExisting instanceof HTMLElement)) {
      overlay.className = 'mobile-nav-overlay';
      overlay.hidden = true;
      document.body.append(overlay);
    }

    const pillExisting = document.querySelector('.menu-pill');
    const pill =
      pillExisting instanceof HTMLButtonElement ? pillExisting : document.createElement('button');
    if (!(pillExisting instanceof HTMLButtonElement)) {
      pill.type = 'button';
      pill.className = 'menu-pill';
      pill.setAttribute('aria-label', copy.openMenu);
      pill.setAttribute('aria-controls', 'mobile-menu');
      pill.setAttribute('aria-expanded', 'false');

      const logoImg = header.querySelector('.site-logo img');
      void logoImg;

      const icon = document.createElement('span');
      icon.className = 'nav-toggle-icon';
      icon.setAttribute('aria-hidden', 'true');
      pill.append(icon);

      document.body.append(pill);
    }

    const open = () => {
      document.body.classList.add('nav-open');
      overlay.hidden = false;
      drawer.hidden = false;
      toggle.setAttribute('aria-expanded', 'true');
      pill.setAttribute('aria-expanded', 'true');
    };

    const close = () => {
      document.body.classList.remove('nav-open');
      toggle.setAttribute('aria-expanded', 'false');
      pill.setAttribute('aria-expanded', 'false');
      window.setTimeout(() => {
        if (!document.body.classList.contains('nav-open')) {
          overlay.hidden = true;
          drawer.hidden = true;
        }
      }, 220);
    };

    const toggleMenu = () => {
      if (!isMobile()) return;
      if (document.body.classList.contains('nav-open')) close();
      else open();
    };

    toggle.addEventListener('click', (e) => {
      e.preventDefault();
      toggleMenu();
    });
    overlay.addEventListener('click', () => close());
    pill.addEventListener('click', (e) => {
      e.preventDefault();
      toggleMenu();
    });

    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') close();
    });

    // Scroll behavior: hide header on scroll-down and show a compact pill.
    let lastY = window.scrollY;
    const onScroll = () => {
      if (!isMobile()) {
        document.body.classList.remove('header-hidden', 'show-scroll-pill');
        return;
      }
      if (document.body.classList.contains('nav-open')) {
        document.body.classList.remove('header-hidden');
        document.body.classList.remove('show-scroll-pill');
        lastY = window.scrollY;
        return;
      }

      const y = window.scrollY;
      if (y < 24) {
        document.body.classList.remove('header-hidden', 'show-scroll-pill');
        lastY = y;
        return;
      }

      const delta = y - lastY;
      if (Math.abs(delta) < 6) return;
      if (delta > 0 && y > 90) {
        document.body.classList.add('header-hidden', 'show-scroll-pill');
      } else if (delta < 0) {
        document.body.classList.remove('header-hidden');
        if (y > 90) document.body.classList.add('show-scroll-pill');
        else document.body.classList.remove('show-scroll-pill');
      }
      lastY = y;
    };

    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll, { passive: true });
    onScroll();
    // Mark only after successful mobile drawer setup to avoid hiding nav on setup failures.
    document.body.classList.add('has-mobile-nav');
  };

  const setupHeaderDropdowns = () => {
    const nav = document.querySelector('.site-header .site-nav');
    if (!(nav instanceof HTMLElement)) return;

    const groups = Array.from(nav.querySelectorAll('details.nav-group')).filter(
      (el) => el instanceof HTMLDetailsElement,
    );
    if (!groups.length) return;

    const closeAll = (except) => {
      groups.forEach((group) => {
        if (except && group === except) return;
        group.open = false;
      });
    };

    const supportsHover =
      typeof window !== 'undefined' &&
      typeof window.matchMedia === 'function' &&
      window.matchMedia('(hover: hover) and (pointer: fine)').matches;

    const hoverState = new WeakMap();
    const getHoverState = (group) => {
      let state = hoverState.get(group);
      if (!state) {
        state = { openTimer: 0, closeTimer: 0 };
        hoverState.set(group, state);
      }
      return state;
    };

    const openDelayMs = 110;
    const closeDelayMs = 320;

    const openGroup = (group) => {
      group.open = true;
      closeAll(group);
    };

    const scheduleClose = (group) => {
      const state = getHoverState(group);
      window.clearTimeout(state.openTimer);
      window.clearTimeout(state.closeTimer);
      state.closeTimer = window.setTimeout(() => {
        group.open = false;
      }, closeDelayMs);
    };

    groups.forEach((group) => {
      group.addEventListener('toggle', () => {
        if (group.open) closeAll(group);
      });

      if (supportsHover) {
        const menu = group.querySelector('.nav-menu');

        group.addEventListener('mouseenter', () => {
          const state = getHoverState(group);
          window.clearTimeout(state.closeTimer);
          window.clearTimeout(state.openTimer);
          if (group.open) return;
          state.openTimer = window.setTimeout(() => openGroup(group), openDelayMs);
        });

        group.addEventListener('mouseleave', () => {
          scheduleClose(group);
        });

        // Keep it open while the pointer is inside the dropdown itself.
        if (menu instanceof HTMLElement) {
          menu.addEventListener('mouseenter', () => {
            const state = getHoverState(group);
            window.clearTimeout(state.closeTimer);
          });
          menu.addEventListener('mouseleave', () => {
            scheduleClose(group);
          });
        }
      }
    });

    document.addEventListener('click', (e) => {
      const target = e.target;
      if (!(target instanceof Node)) return;
      if (!nav.contains(target)) closeAll();
    });

    nav.addEventListener('keydown', (e) => {
      if (e.key !== 'Escape') return;
      const active = document.activeElement;
      const group =
        active instanceof HTMLElement ? active.closest('details.nav-group') : null;
      closeAll();
      const summary = group instanceof HTMLElement ? group.querySelector('summary') : null;
      if (summary instanceof HTMLElement) summary.focus();
    });
  };

  // Run early
  try {
    applyStoredTheme();
  } catch {}

  try {
    redirectIfNeeded();
  } catch {}

  // Run after DOM
  document.addEventListener('DOMContentLoaded', () => {
    let lang = 'de';
    try {
      const { file } = getPathParts();
      document.documentElement.dataset.pageLang = getLangFromFile(file);
    } catch {}

    try {
      lang = preferredLang();
      const htmlLang = LANG_META[lang]?.hreflang || lang;
      document.documentElement.lang = htmlLang;
    } catch {}

    try {
      if (!localStorage.getItem('lang')) localStorage.setItem('lang', lang);
    } catch {}

    const safe = (name, fn) => {
      try {
        fn();
      } catch (err) {
        // Keep the rest of the UI functional even if one feature fails.
        console.warn(`[site.js] ${name} failed`, err);
      }
    };

    const safeIdle = (name, fn, opts) => {
      runWhenIdle(() => safe(name, fn), opts);
    };

    const optimizeImages = () => {
      const imgs = Array.from(document.images);
      if (!imgs.length) return;

      imgs.forEach((img) => {
        if (!(img instanceof HTMLImageElement)) return;

        // Always allow async decoding unless explicitly set.
        if (!img.hasAttribute('decoding')) img.decoding = 'async';

        // Keep header and hero images eager (they affect perceived speed/branding).
        const inHeader = !!img.closest('.site-header');
        const inHero = !!img.closest('.hero');
        const isLcp = img.hasAttribute('data-lcp');
        if (inHeader || inHero || isLcp) return;

        // Defer everything else.
        if (!img.hasAttribute('loading')) img.loading = 'lazy';
      });
    };

    safe('setupLocalizedContent', setupLocalizedContent);
    safe('setupLangMenu', setupLangMenu);
    safe('setupSiteSearch', setupSiteSearch);
    safe('setupThemeToggle', setupThemeToggle);
    safe('setupThemeLogos', setupThemeLogos);
    safe('applyHeroBackgrounds', applyHeroBackgrounds);
    safe('setupContactForm', setupContactForm);
    safe('setupSpeicherinvestForms', setupSpeicherinvestForms);
    safe('setupFooterYear', setupFooterYear);
    safe('setupHeaderDropdowns', setupHeaderDropdowns);
    safe('setupMobileNavigation', setupMobileNavigation);
    safe('setupProductHeroSlider', setupProductHeroSlider);
    safe('setupReferenceSlider', setupReferenceSlider);
    safe('setupProductLightbox', setupProductLightbox);
    safe('setupRevealLayerToggles', setupRevealLayerToggles);
    safe('setupRevealCursorTooltips', setupRevealCursorTooltips);
    safe('setupMobileInteractiveSync', setupMobileInteractiveSync);
    safe('setupFaqAccordion', setupFaqAccordion);

    // Non-critical enhancements: schedule when the browser is idle.
    safeIdle('optimizeImages', optimizeImages, { timeout: 800 });
    safeIdle('setupHeroVideoAutoplay', setupHeroVideoAutoplay, { timeout: 1200 });
    safeIdle('setupHeroVideoLoopFade', setupHeroVideoLoopFade, { timeout: 1400 });
    safeIdle('setupImageSwaps', setupImageSwaps, { timeout: 2000 });
    safeIdle('setupHotspotWrappers', setupHotspotWrappers, { timeout: 2500 });
    safeIdle('applyHotspotOverrides', applyHotspotOverrides, { timeout: 2600 });
    safeIdle('setupHotspotCalibrator', setupHotspotCalibrator, { timeout: 2600 });
    safeIdle('setupScrollReveal', setupScrollReveal, { timeout: 2600 });
    safeIdle('setupCountUp', setupCountUp, { timeout: 2600 });
  });
})();
