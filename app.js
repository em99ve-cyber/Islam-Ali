const THEME_ANIMATION_MS = 2850;
const themeSwitch = document.getElementById("themeSwitch");
const themeText = themeSwitch?.querySelector(".theme-switch-text");
const themeIcon = themeSwitch?.querySelector(".theme-switch-icon");
const themePortraits = document.querySelectorAll(".theme-portrait");
let isThemeSwitching = false;

function primeThemeAnimationTargets() {
  const targets = [
    ...document.querySelectorAll(".nav, .hero-photo, .hero-copy, .panel, .tabs-shell, .project-card, .process-card, .request-card, .contact-card, .metric, .tab-btn, .arrow-btn, .contact-link, .choice-btn, .request-main-btn, .send-request")
  ];
  targets.forEach((el, index) => {
    el.classList.add("theme-unit");
    el.classList.remove("theme-wide", "theme-tall", "theme-card", "theme-button", "theme-soft");
    if (el.classList.contains("hero-photo")) el.classList.add("theme-tall");
    else if (el.classList.contains("project-card") || el.classList.contains("process-card")) el.classList.add("theme-card");
    else if (el.matches("button, .tab-btn, .arrow-btn, .contact-link, .choice-btn, .send-request")) el.classList.add("theme-button");
    else if (el.classList.contains("nav") || el.classList.contains("hero-copy") || el.classList.contains("tabs-shell") || el.classList.contains("request-card") || el.classList.contains("contact-card")) el.classList.add("theme-wide");
    else el.classList.add("theme-soft");
    const delay = Math.min(index * 26, 560);
    el.style.setProperty("--theme-delay", `${delay}ms`);
    el.style.setProperty("--theme-tilt", index % 2 ? "-16deg" : "16deg");
  });
}

function setThemeAssets(theme) {
  themePortraits.forEach((img) => {
    const nextSrc = theme === "light" ? img.dataset.lightSrc : img.dataset.darkSrc;
    if (nextSrc && img.getAttribute("src") !== nextSrc) img.setAttribute("src", nextSrc);
  });
}

function applyTheme(theme, persist = false) {
  const isLight = theme === "light";
  document.body.classList.toggle("theme-light", isLight);
  setThemeAssets(theme);
  if (themeSwitch) {
    themeSwitch.setAttribute("aria-pressed", String(isLight));
    themeSwitch.setAttribute("aria-label", isLight ? "Switch to dark mode" : "Switch to light mode");
  }
  if (themeText) themeText.textContent = isLight ? "Light" : "Dark";
  if (themeIcon) themeIcon.textContent = "";
  if (persist) {
    try { localStorage.setItem("islamPortfolioTheme", theme); } catch (error) {}
  }
}

function readSavedTheme() {
  try { return localStorage.getItem("islamPortfolioTheme") || "dark"; }
  catch (error) { return "dark"; }
}

applyTheme(readSavedTheme());

const INTRO_MAX_MS = 7000;
const introLikelyLowPower = window.matchMedia("(pointer: coarse)").matches || window.innerWidth <= 760 || (navigator.hardwareConcurrency && navigator.hardwareConcurrency <= 4);
const INTRO_MIN_MS = introLikelyLowPower ? 4200 : 2800;

// مصفوفة الصور التي يتم تحميلها مسبقاً في اللودر الاحترافي للموقع
const INTRO_BASE_ASSETS = [
  "assets/islam-profile-dark.jpg",
  "assets/islam-profile-light.jpg"
];
const introImageCache = new Map();
const introScreen = document.getElementById("introScreen");
const introProgressText = document.getElementById("introProgressText");

function setIntroProgress(value) {
  const pct = Math.max(0, Math.min(100, value));
  document.documentElement.style.setProperty("--intro-progress", `${pct.toFixed(1)}%`);
  if (introProgressText) introProgressText.textContent = `${Math.round(pct)}%`;
}

function preloadIntroImage(src) {
  return new Promise((resolve) => {
    if (!src) {
      resolve({ src, ok: false });
      return;
    }
    const image = new Image();
    image.decoding = "async";
    image.loading = "eager";
    image.fetchPriority = "high";
    const finish = async (ok) => {
      if (ok) {
        try { await image.decode?.(); } catch (error) {}
        introImageCache.set(src, image);
      }
      resolve({ src, ok });
    };
    image.addEventListener("load", () => finish(true), { once: true });
    image.addEventListener("error", () => finish(false), { once: true });
    image.src = src;
  });
}

function waitForTwoFrames() {
  return new Promise((resolve) => {
    window.requestAnimationFrame(() => window.requestAnimationFrame(resolve));
  });
}

function waitForIdleSlice(timeout = 520) {
  return new Promise((resolve) => {
    if ("requestIdleCallback" in window) {
      window.requestIdleCallback(resolve, { timeout });
      return;
    }
    window.setTimeout(resolve, Math.min(180, timeout));
  });
}

function waitForWindowLoad() {
  if (document.readyState === "complete") return Promise.resolve();
  return new Promise((resolve) => window.addEventListener("load", resolve, { once: true }));
}

function collectIntroAssets() {
  const assets = new Set(INTRO_BASE_ASSETS);
  if (Array.isArray(window.PORTFOLIO_PROJECTS)) {
    window.PORTFOLIO_PROJECTS.forEach((project) => {
      if (project.thumbnail) assets.add(project.thumbnail);
    });
  }
  document.querySelectorAll("img").forEach((img) => {
    if (img.currentSrc || img.src) assets.add(img.currentSrc || img.src);
    if (img.dataset.darkSrc) assets.add(img.dataset.darkSrc);
    if (img.dataset.lightSrc) assets.add(img.dataset.lightSrc);
  });
  return [...assets].filter(Boolean);
}

function warmInitialLayout() {
  return waitForTwoFrames().then(() => {
    document.querySelectorAll(".nav, .hero, .hero-photo, .hero-copy, .project-card, .tabs-shell, .section-head, .request-card").forEach((el) => {
      el.getBoundingClientRect();
    });
  });
}

async function runSmartIntroLoader() {
  if (!introScreen) {
    document.body.classList.add("intro-done");
    return;
  }

  const startedAt = performance.now();
  let completed = 0;
  let finished = false;
  const markComplete = () => { completed += 1; };
  const assets = collectIntroAssets();
  const tasks = [
    ...assets.map((src) => preloadIntroImage(src).finally(markComplete)),
    Promise.resolve(document.fonts?.ready).catch(() => {}).finally(markComplete),
    waitForWindowLoad().finally(markComplete),
    warmInitialLayout().finally(markComplete),
    waitForIdleSlice(introLikelyLowPower ? 900 : 520).finally(markComplete)
  ];
  const totalTasks = tasks.length;
  let progressTimer = null;

  function updateIntroProgress() {
    if (finished) return;
    const elapsedPct = Math.min(92, ((performance.now() - startedAt) / INTRO_MAX_MS) * 92);
    const taskPct = totalTasks ? (completed / totalTasks) * 96 : 96;
    setIntroProgress(Math.min(98, Math.max(elapsedPct, taskPct)));
  }

  updateIntroProgress();
  progressTimer = window.setInterval(updateIntroProgress, 90);

  await Promise.race([
    Promise.allSettled([
      ...tasks,
      new Promise((resolve) => window.setTimeout(resolve, INTRO_MIN_MS))
    ]),
    new Promise((resolve) => window.setTimeout(resolve, INTRO_MAX_MS))
  ]);

  finished = true;
  if (progressTimer) window.clearInterval(progressTimer);
  setIntroProgress(100);
  introScreen.classList.add("intro-complete");
  const hitMaxWait = performance.now() - startedAt >= INTRO_MAX_MS - 40;
  window.setTimeout(() => {
    document.body.classList.add("intro-done");
    window.setTimeout(() => introScreen.remove(), 900);
  }, hitMaxWait ? 0 : 220);
}

themeSwitch?.addEventListener("click", () => {
  if (isThemeSwitching) return;
  isThemeSwitching = true;
  themeSwitch.disabled = true;
  primeThemeAnimationTargets();
  const nextTheme = document.body.classList.contains("theme-light") ? "dark" : "light";
  document.body.classList.add("theme-animating");
  window.setTimeout(() => applyTheme(nextTheme, true), 760);
  window.setTimeout(() => {
    document.body.classList.remove("theme-animating");
    themeSwitch.disabled = false;
    isThemeSwitching = false;
  }, THEME_ANIMATION_MS);
});

// قاعدة بيانات مشاريعك الحقيقية (قمت بتحديث أسامي المشاريع لتناسبك)
const PROJECTS = [
  {
    id: "commercial-brand-campaign",
    category: "editing",
    categoryLabel: "Video Editing",
    title: "Commercial Brand Campaign",
    subtitle: "Cinematic Promotional Video Edit",
    cardDescription: "فيديو إعلاني احترافي يركز على تصحيح الألوان المتقدم، هندسة الصوت، وضبط الإيقاع الديناميكي لجذب الجمهور.",
    thumbnail: "https://images.unsplash.com/photo-1574717024653-61fd2cf4d44d?q=80&w=600",
    type: "Commercial Edit",
    client: "Brand Campaign",
    year: "2026",
    role: "Video Editor & Colorist",
    tools: "Premiere Pro, DaVinci Resolve",
    mainMedia: { label: "Watch Campaign", type: "youtube", id: "dQw4w9WgXcQ" }, // هنا حط كود فيديو اليوتيوب بتاعك
    highlights: [
      "تعديل وتنسيق الألوان السينمائية المتطابقة لجودة العرض.",
      "بناء ريتم ومؤثرات صوتية محيطية تزيد من قوة الرسالة الإعلانية.",
      "تسليم العمل في وقت قياسي متوافق مع متطلبات النشر."
    ],
    breakdown: "هذا المشروع يوضح القدرة على أخذ الماتريال الخام للبراند وتطويره بالكامل من مرحلة الـ Rough Cut وحتى تسليم النسخة النهائية بـ Grading فخم ينافس الإعلانات التلفزيونية."
  },
  {
    id: "social-media-reels",
    category: "editing",
    categoryLabel: "Video Editing",
    title: "Short-Form Reels & Shorts",
    subtitle: "High-Retention Dynamic Content",
    cardDescription: "مونتاج فيديوهات قصيرة سريعة وديناميكية مصممة خصيصاً لرفع نسب المشاهدة والاحتفاظ بالجمهور على السوشيال ميديا.",
    thumbnail: "https://images.unsplash.com/photo-1611162617213-7d7a39e9b1d7?q=80&w=600",
    type: "Reels / Shorts",
    client: "Content Creators",
    year: "2026",
    role: "Sole Video Editor",
    tools: "Premiere Pro, After Effects",
    mainMedia: { label: "Watch Sample", type: "youtube", id: "dQw4w9WgXcQ" },
    highlights: [
      "تصميم إيقاع سريع (Fast-paced cutting) يمنع المشاهد من التمرير السريع.",
      "إضافة مؤثرات بصرية وتكبير ديناميكي ذكي للمحافظة على التركيز.",
      "هندسة صوت سريعة ومقاطع موسيقية متناسقة مع حركات المونتاج."
    ],
    breakdown: "المحتوى القصير يحتاج لذكاء وسرعة في شد الانتباه خلال أول 3 ثوانٍ. هذا المشروع يمثل عينات من ريلز حققت نسب مشاهدات عالية بفضل التقطيع الموزون."
  }
];

window.PORTFOLIO_PROJECTS = PROJECTS;

const PROJECT_ORDER = {
  editing: [
    "commercial-brand-campaign",
    "social-media-reels"
  ]
};

function sortProjectsForCategory(projects, category) {
  const order = PROJECT_ORDER[category] || [];
  return [...projects].sort((a, b) => {
    const ai = order.indexOf(a.id);
    const bi = order.indexOf(b.id);
    if (ai === -1 && bi === -1) return 0;
    if (ai === -1) return 1;
    if (bi === -1) return -1;
    return ai - bi;
  });
}

const root = document.documentElement;
const dot = document.querySelector(".cursor-dot");
const ring = document.querySelector(".cursor-ring");
const glow = document.querySelector(".cursor-glow");
const navBar = document.querySelector(".nav");
const pointer = { x: window.innerWidth / 2, y: window.innerHeight / 2 };
let playModeActive = false;
let pointerVisualQueued = false;
let pointerVisualX = pointer.x;
let pointerVisualY = pointer.y;
const coarsePointer = window.matchMedia("(pointer: coarse)");
const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
const lowPowerDevice = coarsePointer.matches || window.innerWidth <= 760 || (navigator.hardwareConcurrency && navigator.hardwareConcurrency <= 4);
document.body.classList.toggle("low-power", lowPowerDevice);

function updateFunHintPosition() {
  if (!navBar) return;
  const rect = navBar.getBoundingClientRect();
  root.style.setProperty("--fun-hint-top", `${Math.ceil(rect.bottom + 8)}px`);
}

window.addEventListener("resize", updateFunHintPosition, { passive: true });
window.addEventListener("load", updateFunHintPosition, { passive: true });
if ("ResizeObserver" in window && navBar) new ResizeObserver(updateFunHintPosition).observe(navBar);
updateFunHintPosition();

let orientationShiftTimer = null;
let viewportOrientation = window.matchMedia("(orientation: landscape)").matches ? "landscape" : "portrait";

function playOrientationShift() {
  document.body.classList.add("orientation-shift");
  updateFunHintPosition();
  if (orientationShiftTimer) window.clearTimeout(orientationShiftTimer);
  orientationShiftTimer = window.setTimeout(() => {
    document.body.classList.remove("orientation-shift");
    updateFunHintPosition();
  }, 720);
}

function watchOrientationShift(force = false) {
  const nextOrientation = window.matchMedia("(orientation: landscape)").matches ? "landscape" : "portrait";
  if (!force && nextOrientation === viewportOrientation) return;
  viewportOrientation = nextOrientation;
  playOrientationShift();
}

window.addEventListener("resize", () => watchOrientationShift(), { passive: true });
window.addEventListener("orientationchange", () => {
  window.setTimeout(() => watchOrientationShift(true), 80);
}, { passive: true });

function getPlayArenaBounds() {
  const mobile = window.innerWidth <= 720;
  const marginX = mobile ? 18 : 34;
  const top = mobile ? 76 : 82;
  const pageOffset = Math.min(880, window.innerHeight * .84);
  const safeGap = mobile ? 78 : 120;
  const floor = Math.min(top + (mobile ? 230 : 290), pageOffset - (mobile ? 56 : 74));
  const preferred = Math.min(pageOffset - safeGap, window.innerHeight * .68, window.innerHeight - safeGap);
  const bottom = Math.max(floor, preferred);
  return {
    left: marginX,
    right: Math.max(marginX + 220, window.innerWidth - marginX),
    top,
    bottom: Math.min(window.innerHeight - 42, bottom)
  };
}

function clampToPlayArena(x, y) {
  const bounds = getPlayArenaBounds();
  return {
    x: Math.max(bounds.left, Math.min(bounds.right, x)),
    y: Math.max(bounds.top, Math.min(bounds.bottom, y))
  };
}

function updatePointer(x, y) {
  if (playModeActive) {
    const clamped = clampToPlayArena(x, y);
    x = clamped.x;
    y = clamped.y;
  }
  pointer.x = x;
  pointer.y = y;
  pointerVisualX = x;
  pointerVisualY = y;
  if (pointerVisualQueued) return;
  pointerVisualQueued = true;
  window.requestAnimationFrame(() => {
    if (!playModeActive) {
      root.style.setProperty("--mouse-x", `${pointerVisualX}px`);
      root.style.setProperty("--mouse-y", `${pointerVisualY}px`);
      if (glow) glow.style.transform = `translate(${pointerVisualX}px, ${pointerVisualY}px) translate(-50%, -50%)`;
    }
    if (dot) dot.style.transform = `translate(${pointerVisualX}px, ${pointerVisualY}px) translate(-50%, -50%)`;
    if (ring) ring.style.transform = `translate(${pointerVisualX}px, ${pointerVisualY}px) translate(-50%, -50%)`;
    updatePlayerShipPosition?.();
    pointerVisualQueued = false;
  });
}

window.addEventListener("pointermove", (event) => updatePointer(event.clientX, event.clientY), { passive: true });
window.addEventListener("touchmove", (event) => {
  const touch = event.touches[0];
  if (touch) updatePointer(touch.clientX, touch.clientY);
}, { passive: true });

let activeWeightSurface = null;
const weightSurfaceStates = new WeakMap();

function getWeightState(el) {
  let state = weightSurfaceStates.get(el);
  if (!state) {
    state = {
      current: { rx: 0, ry: 0, tx: 0, ty: 0 },
      target: { rx: 0, ry: 0, tx: 0, ty: 0 },
      frame: 0
    };
    weightSurfaceStates.set(el, state);
  }
  return state;
}

function animateWeightSurface(el) {
  const state = getWeightState(el);
  state.frame = 0;
  const ease = 0.18;
  let active = false;
  ["rx", "ry", "tx", "ty"].forEach((key) => {
    const next = state.current[key] + (state.target[key] - state.current[key]) * ease;
    state.current[key] = Math.abs(next - state.target[key]) < 0.01 ? state.target[key] : next;
    if (Math.abs(state.current[key] - state.target[key]) > 0.01) active = true;
  });

  el.style.setProperty("--weight-rx", `${state.current.rx.toFixed(2)}deg`);
  el.style.setProperty("--weight-ry", `${state.current.ry.toFixed(2)}deg`);
  el.style.setProperty("--weight-tx", `${state.current.tx.toFixed(2)}px`);
  el.style.setProperty("--weight-ty", `${state.current.ty.toFixed(2)}px`);

  if (active) state.frame = window.requestAnimationFrame(() => animateWeightSurface(el));
}

function setWeightTarget(el, target) {
  if (!el?.classList?.contains("weight-reactive")) return;
  const state = getWeightState(el);
  Object.assign(state.target, target);
  if (!state.frame) state.frame = window.requestAnimationFrame(() => animateWeightSurface(el));
}

function resetWeightSurface(el) {
  if (!el?.classList?.contains("weight-reactive")) return;
  setWeightTarget(el, { rx: 0, ry: 0, tx: 0, ty: 0 });
}

function getActiveWeightCandidate(target) {
  return target?.closest?.(".text-weight-reactive, .weight-reactive") || null;
}

function bindInteractiveSurface(el) {
  if (!el || el.dataset.surfaceBound === "true") return;
  el.dataset.surfaceBound = "true";
  el.addEventListener("mouseenter", () => document.body.classList.add("cursor-active"));
  el.addEventListener("mouseleave", () => {
    document.body.classList.remove("cursor-active");
    if (activeWeightSurface === el) activeWeightSurface = null;
    resetWeightSurface(el);
  });
  if (lowPowerDevice) return;
  if (el.matches(".interactive, .nav, .section-head, .gallery-head, .hero-photo, .hero-copy, .panel, .tabs-shell, .project-card, .process-card, .request-card, .contact-card, .metric, .role-card, .choice-btn, .request-main-btn, .send-request, .contact-link, .info-box, .highlight, .media-item, .youtube-card")) {
    el.classList.add("weight-reactive");
  }
  if (el.matches(".section-head h2, .section-head p, .gallery-head h3, .gallery-head p, .request-card h2, .request-card p, .contact-card h2, .contact-card p, .hero-copy h1, .hero-desc")) {
    el.classList.add("text-weight-reactive", "weight-reactive");
  }
  let localQueued = false;
  let localX = 50;
  let localY = 50;
  let weightX = 0;
  let weightY = 0;
  let shouldTilt = false;
  el.addEventListener("pointermove", (event) => {
    const rect = el.getBoundingClientRect();
    localX = ((event.clientX - rect.left) / rect.width) * 100;
    localY = ((event.clientY - rect.top) / rect.height) * 100;
    weightX = Math.max(-1, Math.min(1, (event.clientX - rect.left) / rect.width - .5));
    weightY = Math.max(-1, Math.min(1, (event.clientY - rect.top) / rect.height - .5));
    const activeCandidate = getActiveWeightCandidate(event.target);
    const canTilt = el.classList.contains("weight-reactive") && activeCandidate === el;
    if (el.classList.contains("weight-reactive") && !canTilt) {
      if (activeWeightSurface === el) activeWeightSurface = null;
      resetWeightSurface(el);
    }
    if (canTilt && activeWeightSurface !== el) {
      resetWeightSurface(activeWeightSurface);
      activeWeightSurface = el;
    }
    shouldTilt = canTilt;
    if (localQueued) return;
    localQueued = true;
    window.requestAnimationFrame(() => {
      el.style.setProperty("--local-x", `${localX}%`);
      el.style.setProperty("--local-y", `${localY}%`);
      if (shouldTilt) {
        setWeightTarget(el, {
          rx: -weightY * 7,
          ry: weightX * 8,
          tx: weightX * 4,
          ty: weightY * 4
        });
      }
      localQueued = false;
    });
  });
}

document.querySelectorAll("a, button, .project-card, .interactive, .section-head, .gallery-head, .section-head h2, .section-head p, .gallery-head h3, .gallery-head p, .request-card h2, .request-card p, .contact-card h2, .contact-card p, .hero-copy h1, .hero-desc, .info-box, .highlight").forEach(bindInteractiveSurface);

const revealItems = document.querySelectorAll(".reveal");
const observer = new IntersectionObserver((entries) => {
  entries.forEach((entry) => {
    if (entry.isIntersecting) {
      entry.target.classList.add("visible");
      observer.unobserve(entry.target);
    }
  });
}, { threshold: .13 });

revealItems.forEach((item, index) => {
  item.style.transitionDelay = `${Math.min(index * 45, 360)}ms`;
  observer.observe(item);
});

const tabButtons = document.querySelectorAll(".tab-btn");
const tabContents = document.querySelectorAll(".tab-content");
tabButtons.forEach((btn) => {
  btn.addEventListener("click", () => {
    tabButtons.forEach((b) => { b.classList.remove("active"); b.setAttribute("aria-selected", "false"); });
    tabContents.forEach((panel) => panel.classList.remove("active"));
    btn.classList.add("active");
    btn.setAttribute("aria-selected", "true");
    document.getElementById(btn.dataset.tab).classList.add("active");
  });
});

function drivePreview(id) { return `https://drive.google.com/file/d/${id}/preview`; }
function driveView(id) { return `https://drive.google.com/file/d/${id}/view`; }
function driveThumbnail(id) { return `https://drive.google.com/thumbnail?id=${id}&sz=w1000`; }

function renderProjects() {
  const tracks = document.querySelectorAll(".project-track");
  tracks.forEach((track) => {
      const category = track.dataset.category;
      const items = sortProjectsForCategory(PROJECTS.filter((project) => project.category === category), category);
    track.innerHTML = items.map((project) => `
      <article class="project-card interactive" tabindex="0" data-project="${project.id}" aria-label="Open project: ${project.title}">
        <div class="project-thumb" style="background-image:url('${project.thumbnail}')">
          <span class="press-label">Press to explore -></span>
        </div>
        <div class="project-body">
          <div>
            <div class="kicker">${project.categoryLabel}</div>
            <h3>${project.title}</h3>
            <p>${project.subtitle}</p>
            <p style="margin-top:10px">${project.cardDescription}</p>
          </div>
          <div class="project-meta">
            <span class="pill orange">${project.type}</span>
            <span class="pill">${project.year}</span>
            <span class="pill">${project.client}</span>
          </div>
        </div>
      </article>
    `).join("");
  });

  document.querySelectorAll(".project-card").forEach((card) => {
    const open = () => openProject(card.dataset.project);
    card.addEventListener("click", open);
    card.addEventListener("keydown", (event) => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        open();
      }
    });
    bindInteractiveSurface(card);
  });
}

renderProjects();
runSmartIntroLoader();

document.querySelectorAll(".arrow-btn").forEach((button) => {
  button.addEventListener("click", () => {
    const track = document.querySelector(`.project-track[data-category="${button.dataset.scroll}"]`);
    const direction = Number(button.dataset.dir);
    track.scrollBy({ left: direction * Math.min(620, window.innerWidth * .82), behavior: "smooth" });
  });
});

const modal = document.getElementById("projectModal");
const stage = document.getElementById("stage");
const mediaTabs = document.getElementById("mediaTabs");
const mediaList = document.getElementById("mediaList");
const openExternal = document.getElementById("openExternal");
const expandBtn = document.getElementById("expandBtn");
const breakdown = document.getElementById("breakdown");
let currentProject = null;
let youtubeScrollTimer = null;

function setStageHTML(html, externalUrl = "#", options = {}) {
  stage.innerHTML = html;
  stage.classList.remove("stage-portrait", "stage-wide", "stage-facebook", "stage-youtube", "stage-drive");
  if (options.className) stage.classList.add(...String(options.className).split(/\s+/).filter(Boolean));
  stage.style.setProperty("--stage-aspect", options.aspect || "16 / 9");
  stage.style.setProperty("--stage-max-width", options.maxWidth || "100%");
  openExternal.href = externalUrl;
  openExternal.style.display = externalUrl === "#" ? "none" : "inline-flex";
}

function loadDriveMedia(id, label = "Drive media", options = {}) {
  setStageHTML(
    `<iframe title="${label}" src="${drivePreview(id)}" loading="lazy" allow="autoplay; fullscreen; picture-in-picture" allowfullscreen></iframe>`,
    driveView(id),
    {
      className: `stage-drive ${options.aspect === "9 / 16" ? "stage-portrait" : ""}`,
      aspect: options.aspect || "16 / 9",
      maxWidth: options.maxWidth || "100%"
    }
  );
}

function loadImageMedia(media = {}) {
  const src = media.src || media.thumbnail || "";
  setStageHTML(
    `<img src="${escapeHTML(src)}" alt="${escapeHTML(media.label || "Project preview")}" loading="lazy" decoding="async" />`,
    media.url || "#",
    {
      className: media.className || "stage-wide",
      aspect: media.aspect || "16 / 9",
      maxWidth: media.maxWidth || "100%"
    }
  );
}

function youtubeThumb(id) { return `https://i.ytimg.com/vi/${id}/hqdefault.jpg`; }
function youtubeWatch(id) { return `https://www.youtube.com/watch?v=${id}`; }
function youtubeEmbed(id) { return `https://www.youtube.com/embed/${id}?rel=0&modestbranding=1&playsinline=1`; }
function escapeHTML(value = "") {
  return String(value).replace(/[&<>"']/g, (char) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    "\"": "&quot;",
    "'": "&#39;"
  char] || char));
}

function clearYouTubeNowPlaying() {
  document.getElementById("youtubeNowPlaying")?.remove();
}

function setYouTubeNowPlaying(video) {
  clearYouTubeNowPlaying();
  if (!video || !stage) return;
  const info = document.createElement("div");
  info.id = "youtubeNowPlaying";
  info.className = "youtube-now-playing";
  info.innerHTML = `
    <small>Now playing</small>
    <strong class="youtube-now-title">${escapeHTML(video.title)}</strong>
    <a class="youtube-play-link" href="${youtubeWatch(video.id)}" target="_blank" rel="noopener">Play on YouTube</a>
  `;
  stage.insertAdjacentElement("afterend", info);
}

function loadYouTubeVideo(video) {
  if (!video) return;
  setStageHTML(`<iframe title="${escapeHTML(video.title)}" src="${youtubeEmbed(video.id)}" loading="lazy" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share; fullscreen" allowfullscreen></iframe>`, youtubeWatch(video.id), { className: "stage-youtube" });
}

function loadExternalMedia(media) {
  setStageHTML(`
    <div class="locked-stage">
      <div>
        <div class="lock-icon">-></div>
        <strong>${media.label || "External project link"}</strong>
        <p>${media.message || "Open this project externally to view the related channel or reference."}</p>
      </div>
    </div>
  `, media.url || "#");
}

function loadNoteMedia(media) {
  setStageHTML(`
    <div class="locked-stage">
      <div>
        <div class="lock-icon">i</div>
        <strong>${media.label || "Project note"}</strong>
        <p>${media.message || "Selected media for this project is available on request."}</p>
      </div>
    </div>
  `, "#");
}

function getSectionMeta(section) {
  return currentProject?.sectionLabels?.[section] || {};
}

function showLockedSection(section) {
  const locked = currentProject.lockedSections?.[section] || {};
  const count = (currentProject[section] || []).length;
  const itemLabel = locked.item || "Protected media";
  mediaList.innerHTML = Array.from({ length: count }, (_, i) => `
    <button class="media-item" type="button" title="Locked for client privacy" data-locked="true">
      Locked ${itemLabel} ${String(i + 1).padStart(2, "0")}
    </button>
  `).join("");
  setStageHTML(`
    <div class="locked-stage">
      <div>
        <div class="lock-icon">L</div>
        <strong>${locked.title || "Media locked"}</strong>
        <p>${locked.message || "This media is locked for client privacy."}</p>
      </div>
    </div>
  `, "#");
}

function showDriveSection(section, index = 0) {
  const items = currentProject[section] || [];
  const meta = getSectionMeta(section);
  const itemLabel = meta.item || "Render";
  mediaList.innerHTML = items.map((id, i) => `<button class="media-item ${i === index ? "active" : ""}" type="button" data-kind="${section}" data-index="${i}">${itemLabel} ${String(i + 1).padStart(2, "0")}</button>`).join("");
  if (items[index]) loadDriveMedia(items[index], `${itemLabel} ${index + 1}`);
}

function renderBaseProjectInfo(project) {
  if (!project) return;
  document.getElementById("modalCategory").textContent = project.categoryLabel;
  document.getElementById("modalTitle").innerHTML = `${project.title}<br><span style="color:var(--orange)">${project.subtitle}</span>`;
  document.getElementById("modalDescription").textContent = project.description;
  document.getElementById("modalInfoGrid").innerHTML = `
    <div class="info-box"><small>Client</small><strong>${project.client}</strong></div>
    <div class="info-box"><small>Year</small><strong>${project.year}</strong></div>
    <div class="info-box"><small>Role</small><strong>${project.role}</strong></div>
    <div class="info-box"><small>Tools</small><strong>${project.tools}</strong></div>
  `;
  document.getElementById("modalHighlights").innerHTML = project.highlights.map((item) => `<div class="highlight">${item}</div>`).join("");
  breakdown.innerHTML = `<h3>Full breakdown</h3><p>${project.breakdown}</p>`;
}

function showMediaSection(section, index = 0) {
  if (!currentProject) return;
  renderBaseProjectInfo(currentProject);
  document.querySelectorAll(".media-tab").forEach((tab) => tab.classList.toggle("active", tab.dataset.section === section));
  mediaList.innerHTML = "";
  mediaList.classList.remove("youtube-list", "tele-list");
  mediaList.onscroll = null;
  clearYouTubeNowPlaying();

  if (section === "main") {
    const media = currentProject.mainMedia || {};
    if (media.type === "youtube") loadYouTubeVideo({id: media.id, title: currentProject.title});
    else if (media.type === "external") loadExternalMedia(media);
    else if (media.type === "note") loadNoteMedia(media);
    else if (media.type === "image") loadImageMedia(media);
    else loadDriveMedia(media.id, media.label, media);
    return;
  }
}

function openProject(projectId) {
  currentProject = PROJECTS.find((project) => project.id === projectId);
  if (!currentProject) return;

  renderBaseProjectInfo(currentProject);
  breakdown.classList.remove("open");
  expandBtn.textContent = "Show full breakdown";

  const sections = [{ id: "main", label: currentProject.mainMedia.label || "Main media" }];
  mediaTabs.innerHTML = sections.map((section, i) => `<button class="media-tab ${i === 0 ? "active" : ""}" type="button" data-section="${section.id}">${section.label}</button>`).join("");
  showMediaSection(sections[0]?.id || "main");

  modal.classList.add("open");
  modal.setAttribute("aria-hidden", "false");
  document.body.style.overflow = "hidden";
}

function closeProject() {
  modal.classList.remove("open");
  modal.setAttribute("aria-hidden", "true");
  clearYouTubeNowPlaying();
  stage.innerHTML = "";
  mediaList.innerHTML = "";
  currentProject = null;
  document.body.style.overflow = "";
}

document.querySelector(".close-modal").addEventListener("click", closeProject);
modal.addEventListener("click", (event) => { if (event.target === modal) closeProject(); });
window.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && modal.classList.contains("open")) closeProject();
});
expandBtn.addEventListener("click", () => {
  breakdown.classList.toggle("open");
  expandBtn.textContent = breakdown.classList.contains("open") ? "Hide full breakdown" : "Show full breakdown";
});

// إعداد فورمة طلب البروجيكت وتوجيه الإيميل التلقائي لبريدك الخاص بالكامل
const requestTool = document.getElementById("requestTool");
const makeRequestBtn = document.getElementById("makeRequestBtn");
const requestChoices = document.getElementById("requestChoices");
const requestSubChoices = document.getElementById("requestSubChoices");
const requestForm = document.getElementById("requestForm");
const requestTypeSelect = document.getElementById("requestTypeSelect");
const requestDetails = document.getElementById("requestDetails");
const sendRequestBtn = document.getElementById("sendRequestBtn");
const mailOptions = document.getElementById("mailOptions");
const mailConfirmation = document.getElementById("mailConfirmation");
const mailConfirmationClose = document.getElementById("mailConfirmationClose");
const mailConfirmationText = document.getElementById("mailConfirmationText");

// بريدك الإلكتروني الاحترافي لإرسال الطلبات مباشرة لك
const REQUEST_EMAIL = "contact@islam-ali.com"; 
let selectedRequestCategory = "";
let selectedRequestType = "Video Editing - Commercial Brand Campaign";

const requestGroups = {
  editing: {
    label: "Video Editing Services",
    prompt: "Choose an editing focus",
    options: [
      {
        value: "Video Editing - Commercial Brand Campaign",
        label: "Commercial Brand Campaign",
        body: "Hello Islam,\n\nI would like to request a high-end promotional/commercial video edit.\n\nProject Overview:\nBrand/Company Name:\nFootage Status (Raw footage available / Need sourcing):\nEstimated final duration:\nReference style or examples:\nPreferred Deadline:\n\nThank you,"
      },
      {
        value: "Video Editing - Short-Form Reels/Shorts",
        label: "Short-Form Social Reels",
        body: "Hello Islam,\n\nI would like to request short-form video content creation for social media.\n\nProject Details:\nPlatform (Instagram Reels / TikTok / YouTube Shorts):\nNumber of videos needed:\nRaw material status:\nPreferred dynamic style / layout:\n\nThank you,"
      }
    ]
  }
};

const requestOptionsByValue = Object.fromEntries(
  Object.entries(requestGroups).flatMap(([category, group]) => (
    group.options.map((option) => [option.value, { ...option, category, categoryLabel: group.label }])
  ))
);

function openRequestChoices() {
  requestTool.classList.add("choices-open");
  requestChoices.setAttribute("aria-hidden", "false");
}

function renderRequestSubChoices(category) {
  const group = requestGroups[category];
  if (!group) return;
  selectedRequestCategory = category;
  requestSubChoices.innerHTML = `
    <div class="request-step-label" id="requestSubLabel">${group.prompt}</div>
    ${group.options.map((option) => `<button class="choice-btn subchoice-btn interactive" type="button" data-request-value="${option.value}">${option.label}</button>`).join("")}
  `;
  requestSubChoices.querySelectorAll(".subchoice-btn").forEach(bindInteractiveSurface);
  refreshDamageTargets?.();
  document.querySelectorAll(".request-choices .choice-btn").forEach((btn) => btn.classList.toggle("active", btn.dataset.category === category));
  requestTool.classList.add("choices-open", "subchoices-open");
  requestTool.classList.remove("mail-open");
}

function selectRequestCategory(category) {
  renderRequestSubChoices(category);
  requestTool.classList.remove("form-open");
}

function updateAutoRequestText(option) {
  requestDetails.value = option.body;
}

function selectRequestType(type) {
  const option = requestOptionsByValue[type] || requestOptionsByValue[selectedRequestType];
  if (!option) return;
  selectedRequestType = option.value;
  if (selectedRequestCategory !== option.category) renderRequestSubChoices(option.category);
  requestTypeSelect.value = option.value;
  document.querySelectorAll(".subchoice-btn").forEach((btn) => btn.classList.toggle("active", btn.dataset.requestValue === option.value));
  requestTool.classList.add("choices-open", "subchoices-open", "form-open");
  requestTool.classList.remove("mail-open");
  updateAutoRequestText(option);
  sendRequestBtn.querySelector("span").textContent = "Send request";
}

makeRequestBtn.addEventListener("click", openRequestChoices);
requestTypeSelect.addEventListener("change", () => selectRequestType(requestTypeSelect.value));

function buildEmailUrls() {
  const type = requestTypeSelect.value || selectedRequestType || "General Project";
  const subject = `Request | ${type} | Islam Ali Portfolio`;
  const body = requestDetails.value.trim();
  return {
    gmail: `https://mail.google.com/mail/?view=cm&fs=1&to=${encodeURIComponent(REQUEST_EMAIL)}&su=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`,
    outlook: `https://outlook.live.com/mail/0/deeplink/compose?to=${encodeURIComponent(REQUEST_EMAIL)}&subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`
  };
}

function showMailOptions() {
  requestTool.classList.add("mail-open");
  sendRequestBtn.querySelector("span").textContent = "Choose email app";
}

function sendProjectRequest(provider) {
  const urls = buildEmailUrls();
  const labels = { gmail: "Gmail", outlook: "Outlook" };
  const selectedProvider = provider in urls ? provider : "gmail";
  const openedWindow = window.open(urls[selectedProvider], "_blank");
  if (openedWindow) openedWindow.opener = null;
  if (mailConfirmationText) {
    mailConfirmationText.textContent = `${labels[selectedProvider]} should now open your prepared request. Review the draft and press send!`;
  }
  mailConfirmation?.classList.add("open");
}

function closeMailConfirmation() {
  mailConfirmation?.classList.remove("open");
}

sendRequestBtn.addEventListener("click", showMailOptions);
mailConfirmationClose?.addEventListener("click", closeMailConfirmation);

document.addEventListener("click", (event) => {
  const makeButton = event.target.closest?.("#makeRequestBtn");
  const categoryButton = event.target.closest?.(".choice-btn[data-category]");
  const subchoiceButton = event.target.closest?.(".subchoice-btn[data-request-value]");
  const sendButton = event.target.closest?.("#sendRequestBtn");
  const mailButton = event.target.closest?.(".mail-option[data-provider]");

  if (makeButton) { openRequestChoices(); }
  if (categoryButton) { selectRequestCategory(categoryButton.dataset.category); }
  if (subchoiceButton) { selectRequestType(subchoiceButton.dataset.requestValue); }
  if (sendButton) { showMailOptions(); }
  if (mailButton) { sendProjectRequest(mailButton.dataset.provider); }
});

// اللعبة التفاعلية الفخمة ونظام تدمير العناصر (تم المحافظة عليه وتطوير حركته ليكون خفيف جداً)
const playModeBtn = document.getElementById("playModeBtn");
const tryAgainBtn = document.getElementById("tryAgainBtn");
const closeGameOverBtn = document.getElementById("closeGameOverBtn");
const soundToggle = document.getElementById("soundToggle");
const arenaStatus = document.getElementById("arenaStatus");
const bossStatus = document.getElementById("bossStatus");
const playerShip = document.getElementById("playerShip");
const gameOverPanel = document.getElementById("gameOverPanel");
const levelStatus = document.getElementById("levelStatus");
const killsStatus = document.getElementById("killsStatus");
const healthStatus = document.getElementById("healthStatus");
const healthBar = document.getElementById("healthBar");
const shieldStatus = document.getElementById("shieldStatus");
const shieldBar = document.getElementById("shieldBar");
const powerupStatus = document.getElementById("powerupStatus");

const BASE_SHIP_HP = 12;
const PLAYER_DAMAGE_MULTIPLIER = .25;
const SHIELD_MAX = 100;
const SHIELD_PICKUP = 25;
let gameLost = false;
let gameWon = false;
let gameAudio = null;
let melodyTimer = null;
let audioMuted = false;
let score = 0;
let playerHealth = 100;
let shieldHP = 0;
let currentLevel = 1;
let currentLevelPattern = 1;
let enemyHealthMultiplier = 1;
let straightStacks = 0;
let diagonalStacks = 0;
let blastStacks = 0;
let lastPlayerShot = 0;
let lastEnemyShot = 0;
let playerInvulnerableUntil = 0;
let pointerShooting = false;
let destroyedShipCount = 0;
let lastShipFrame = performance.now();
const playerBullets = [];
const enemyProjectiles = [];
const enemyLasers = [];
const powerUps = [];
const enemyShips = [];

function updatePlayerShipPosition() {
  root.style.setProperty("--player-x", `${pointer.x}px`);
  root.style.setProperty("--player-y", `${pointer.y}px`);
}

function updateGameHud() {
  if(shipCounter) shipCounter.textContent = `SCORE ${String(score).padStart(5, "0")}`;
  if(levelStatus) levelStatus.textContent = `${currentLevel}`;
  if(killsStatus) killsStatus.textContent = `${destroyedShipCount}`;
  if(healthStatus) healthStatus.textContent = `${Math.max(0, Math.ceil(playerHealth))}/100`;
  if(healthBar) healthBar.style.setProperty("--bar", `${Math.max(0, Math.min(100, playerHealth))}%`);
  if(arenaStatus) arenaStatus.textContent = playModeActive ? "Click or Press X to shoot and destroy elements!" : "Arena ready";
}

function initGameAudio() {
  if (gameAudio) return gameAudio;
  const AudioContextClass = window.AudioContext || window.webkitAudioContext;
  if (!AudioContextClass) return null;
  const ctx = new AudioContextClass();
  const master = ctx.createGain();
  master.gain.value = audioMuted ? 0 : .18;
  master.connect(ctx.destination);
  gameAudio = { ctx, master };
  return gameAudio;
}

soundToggle?.addEventListener("click", () => {
  audioMuted = !audioMuted;
  initGameAudio();
  soundToggle.classList.toggle("muted", audioMuted);
});

function playTone(freq, start, duration, type = "square", volume = .08) {
  const audio = initGameAudio();
  if (!audio || audioMuted) return;
  const ctx = audio.ctx;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, start);
  gain.gain.setValueAtTime(volume, start);
  gain.gain.exponentialRampToValueAtTime(.001, start + duration);
  osc.connect(gain).connect(audio.master);
  osc.start(start);
  osc.stop(start + duration + .02);
}

function triggerFunBlast(x = pointer.x, y = pointer.y) {
  playTone(180, initGameAudio()?.ctx.currentTime || 0, .2, "sawtooth", .12);
  createBlastVisual(x, y);
  joltElements(x, y);
}

function createBlastVisual(x, y) {
  const blast = document.createElement("div");
  blast.className = "blast";
  blast.style.setProperty("--x", `${x}px`);
  blast.style.setProperty("--y", `${y}px`);
  blast.innerHTML = `<span class="blast-ring"></span>`;
  document.body.appendChild(blast);
  window.setTimeout(() => blast.remove(), 600);
}

const physicsSelector = ".nav, .hero-photo, .hero-copy, .panel, .project-card, .request-card, .contact-card, button, a";
let physicsTargets = [...document.querySelectorAll(physicsSelector)];

function joltElements(x, y) {
  const radius = 350;
  physicsTargets.forEach((el) => {
    const rect = el.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    const dist = Math.hypot(cx - x, cy - y);
    if (dist < radius) {
      const force = (1 - dist / radius);
      const pushX = (cx - x) / dist * force * 35;
      const pushY = (cy - y) / dist * force * 35;
      el.style.transform = `translate3d(${pushX}px, ${pushY}px, 0) rotate(${force * 5}deg)`;
      el.style.transition = "transform 0.1s ease-out";
      window.setTimeout(() => {
        el.style.transform = "none";
        el.style.transition = "transform 0.6s cubic-bezier(0.16, 1, 0.3, 1)";
      }, 150);
    }
  });
}

function startGameSession() {
  playModeActive = true;
  document.body.classList.add("play-mode");
  updateGameHud();
}

function endGameSession() {
  playModeActive = false;
  document.body.classList.remove("play-mode");
}

playModeBtn?.addEventListener("click", () => {
  if (playModeActive) endGameSession();
  else startGameSession();
});

window.addEventListener("keydown", (event) => {
  if (event.key.toLowerCase() === "x") {
    triggerFunBlast(pointer.x, pointer.y);
  }
});

// تعيين تاريخ السنة تلقائياً بالفوتر المودرن
const yearEl = document.getElementById("year");
if(yearEl) yearEl.textContent = new Date().getFullYear();
