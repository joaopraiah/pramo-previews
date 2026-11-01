/* Pramo Motion — biblioteca de animação das prévias.
 * Tudo é ligado por atributo no HTML (veja template/README.md). Não edite este arquivo por prévia:
 * personalize no estilo.css e no HTML. Depende de GSAP + ScrollTrigger + Lenis (CDN); sem eles, a página
 * aparece inteira e estática. Respeita prefers-reduced-motion. Mobile first: efeitos de ponteiro só em mouse.
 */
(() => {
  const doc = document.documentElement;
  const $ = (s, c = document) => c.querySelector(s);
  const $$ = (s, c = document) => [...c.querySelectorAll(s)];
  const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const fine = matchMedia("(hover: hover) and (pointer: fine)").matches;
  const desktop = () => matchMedia("(min-width: 900px)").matches;
  const G = window.gsap, ST = window.ScrollTrigger;

  // ---------- texto quebrado em palavras/letras (antes de qualquer animação) ----------
  const split = (el, mode) => {
    const walk = node => [...node.childNodes].forEach(n => {
      if (n.nodeType === 3) {
        const frag = document.createDocumentFragment();
        n.textContent.split(/(\s+)/).forEach(part => {
          if (!part) return;
          if (/^\s+$/.test(part)) return frag.append(document.createTextNode(" "));
          const w = document.createElement("span"); w.className = "w";
          if (mode === "chars") [...part].forEach(ch => { const c = document.createElement("span"); c.className = "c"; c.textContent = ch; w.append(c); });
          else { const i = document.createElement("span"); i.textContent = part; w.append(i); }
          frag.append(w);
        });
        n.replaceWith(frag);
      } else if (n.nodeType === 1 && !n.matches("br")) walk(n);
    });
    walk(el);
  };
  $$("[data-split]").forEach(el => split(el, el.dataset.split === "chars" ? "chars" : "words"));
  $$("[data-scrub-text]").forEach(el => split(el, "words"));

  // ---------- ano no rodapé, WhatsApp do lead ----------
  $$("[data-year]").forEach(el => el.textContent = new Date().getFullYear());

  if (!G || !ST || reduce) {
    doc.classList.add("no-motion");
    $(".loader")?.remove();
    document.body.classList.remove("is-loading");
    initPointer(null);
    initMarquees(null);
    return;
  }

  G.registerPlugin(ST);
  ST.config({ ignoreMobileResize: true });
  doc.classList.add("has-motion");

  // ---------- rolagem suave ----------
  let lenis = null;
  if (window.Lenis) {
    lenis = new Lenis({ duration: 1.15, easing: t => Math.min(1, 1.001 - Math.pow(2, -10 * t)), smoothWheel: true });
    lenis.on("scroll", ST.update);
    G.ticker.add(t => lenis.raf(t * 1000));
    G.ticker.lagSmoothing(0);
    lenis.stop();
    $$('a[href^="#"]').forEach(a => a.addEventListener("click", e => {
      const alvo = $(a.getAttribute("href")); if (!alvo) return;
      e.preventDefault(); lenis.scrollTo(alvo, { offset: -10, duration: 1.4 });
    }));
  }

  // ---------- loader → intro ----------
  const intro = G.timeline({ paused: true, defaults: { ease: "expo.out" } });
  intro
    .from("[data-intro] .w > span, [data-intro] .c", { yPercent: 115, rotate: 4, duration: 1.4, stagger: 0.04 }, 0.15)
    .from("[data-intro-fade]", { opacity: 0, y: 26, duration: 1.2, stagger: 0.08 }, 0.45)
    .from("[data-intro-media]", { clipPath: "inset(18% 12% 18% 12% round 24px)", scale: 1.25, duration: 1.8, ease: "expo.inOut" }, 0)
    .from(".site-header", { yPercent: -100, opacity: 0, duration: 1 }, 0.5);

  const loader = $(".loader");
  const comecar = () => {
    document.body.classList.remove("is-loading");
    lenis?.start();
    intro.play();
    ST.refresh();
  };
  if (loader) {
    const count = $("[data-count]", loader), n = { v: 0 };
    const minimo = new Promise(r => setTimeout(r, 1300));
    const fontes = document.fonts ? document.fonts.ready : Promise.resolve();
    const img = $("[data-intro-media] img");
    const imagem = new Promise(r => { if (!img || img.complete) return r(); img.addEventListener("load", r, { once: true }); img.addEventListener("error", r, { once: true }); setTimeout(r, 3500); });
    const conta = G.to(n, { v: 87, duration: 1.3, ease: "power2.out", onUpdate: () => count && (count.textContent = Math.round(n.v)) });
    Promise.all([minimo, fontes, imagem]).then(() => {
      conta.kill();
      G.timeline()
        .to(n, { v: 100, duration: 0.4, ease: "power1.inOut", onUpdate: () => count && (count.textContent = Math.round(n.v)) })
        .to(loader, { clipPath: "inset(0 0 100% 0)", duration: 1.05, ease: "expo.inOut" })
        .add(() => { loader.remove(); comecar(); }, "-=0.55");
    });
  } else comecar();

  // ---------- títulos e textos ----------
  $$("[data-split]:not([data-intro])").forEach(el => {
    G.from(el.querySelectorAll(".w > span, .c"), {
      yPercent: 115, rotate: 3, duration: 1.2, ease: "expo.out", stagger: el.dataset.split === "chars" ? 0.018 : 0.05,
      scrollTrigger: { trigger: el, start: "top 88%" },
    });
  });
  ST.batch("[data-reveal]", {
    start: "top 90%",
    onEnter: els => G.fromTo(els, { opacity: 0, y: 40 }, { opacity: 1, y: 0, duration: 1.1, ease: "expo.out", stagger: 0.08, overwrite: true }),
  });
  G.set("[data-reveal]", { opacity: 0 });
  // Texto que "acende" palavra por palavra enquanto rola
  $$("[data-scrub-text]").forEach(el => {
    G.fromTo(el.querySelectorAll(".w"), { opacity: 0.14 }, {
      opacity: 1, stagger: 0.1, ease: "none",
      scrollTrigger: { trigger: el, start: "top 80%", end: "bottom 45%", scrub: true },
    });
  });

  // ---------- imagens ----------
  $$("[data-img-reveal]").forEach(el => {
    const img = el.querySelector("img, video");
    const tl = G.timeline({ scrollTrigger: { trigger: el, start: "top 85%" } });
    tl.fromTo(el, { clipPath: el.dataset.imgReveal === "side" ? "inset(0 100% 0 0)" : "inset(100% 0 0 0)" }, { clipPath: "inset(0% 0% 0% 0%)", duration: 1.4, ease: "expo.inOut" });
    if (img) tl.fromTo(img, { scale: 1.35 }, { scale: 1, duration: 1.8, ease: "expo.out" }, 0);
  });
  $$("[data-parallax]").forEach(el => {
    const f = parseFloat(el.dataset.parallax) || 0.15;
    G.fromTo(el, { yPercent: -f * 50 }, { yPercent: f * 50, ease: "none", scrollTrigger: { trigger: el.closest("section") || el, start: "top bottom", end: "bottom top", scrub: true } });
  });
  // Hero que afunda e escurece ao rolar
  $$("[data-hero-out]").forEach(el => {
    G.to(el, { yPercent: 18, scale: 0.94, opacity: 0.35, ease: "none", scrollTrigger: { trigger: el, start: "top top", end: "bottom top", scrub: true } });
  });

  // ---------- números ----------
  $$("[data-counter]").forEach(el => {
    const fim = parseFloat(el.dataset.counter), dec = (el.dataset.counter.split(".")[1] || "").length, o = { v: 0 };
    G.to(o, { v: fim, duration: 2, ease: "expo.out", scrollTrigger: { trigger: el, start: "top 90%" },
      onUpdate: () => el.textContent = o.v.toLocaleString("pt-BR", { minimumFractionDigits: dec, maximumFractionDigits: dec }) });
  });

  // ---------- galeria horizontal fixa (desktop); no celular vira carrossel com scroll-snap ----------
  ST.matchMedia({
    "(min-width: 900px)": () => {
      $$("[data-horizontal]").forEach(sec => {
        const trilho = sec.querySelector("[data-track]"); if (!trilho) return;
        const dist = () => trilho.scrollWidth - innerWidth + 48;
        G.to(trilho, { x: () => -dist(), ease: "none", scrollTrigger: { trigger: sec, start: "top top", end: () => "+=" + dist(), pin: true, scrub: 1, invalidateOnRefresh: true } });
      });
    },
  });

  // ---------- cartões empilhados ----------
  $$("[data-stack] > *").forEach((card, i, all) => {
    if (i === all.length - 1) return;
    G.to(card, { scale: 0.9, opacity: 0.4, filter: "blur(2px)", ease: "none",
      scrollTrigger: { trigger: all[i + 1], start: "top bottom", end: "top 20%", scrub: true } });
  });

  // ---------- cabeçalho que some ao descer e volta ao subir; troca de tema em seções escuras ----------
  const header = $(".site-header");
  if (header) {
    ST.create({ start: 120, end: "max", onUpdate: s => header.classList.toggle("is-hidden", s.direction === 1 && s.scroll() > 400) });
    $$("[data-theme='dark']").forEach(sec => ST.create({ trigger: sec, start: "top 60", end: "bottom 60", toggleClass: { targets: header, className: "on-dark" } }));
  }
  const barra = $(".progress"); if (barra) G.to(barra, { scaleX: 1, ease: "none", scrollTrigger: { start: 0, end: "max", scrub: 0.3 } });

  initPointer(G);
  initMarquees(G);

  // ---------- ponteiro: botões magnéticos, cursor com rótulo, inclinação ----------
  function initPointer(G) {
    if (!fine || !G) return;
    $$("[data-magnetic]").forEach(el => {
      const f = parseFloat(el.dataset.magnetic) || 0.35;
      const xTo = G.quickTo(el, "x", { duration: 0.6, ease: "elastic.out(1, .4)" }), yTo = G.quickTo(el, "y", { duration: 0.6, ease: "elastic.out(1, .4)" });
      el.addEventListener("pointermove", e => { const r = el.getBoundingClientRect(); xTo((e.clientX - r.left - r.width / 2) * f); yTo((e.clientY - r.top - r.height / 2) * f); });
      el.addEventListener("pointerleave", () => { xTo(0); yTo(0); });
    });
    const cur = $(".cursor");
    if (cur) {
      doc.classList.add("has-cursor");
      const xTo = G.quickTo(cur, "x", { duration: 0.45, ease: "power3" }), yTo = G.quickTo(cur, "y", { duration: 0.45, ease: "power3" });
      addEventListener("pointermove", e => { xTo(e.clientX); yTo(e.clientY); });
      $$("a, button, [data-cursor]").forEach(el => {
        el.addEventListener("pointerenter", () => { cur.classList.add("is-hover"); cur.dataset.label = el.dataset.cursor || ""; });
        el.addEventListener("pointerleave", () => { cur.classList.remove("is-hover"); cur.dataset.label = ""; });
      });
    }
    $$("[data-tilt]").forEach(el => {
      const rx = G.quickTo(el, "rotationX", { duration: 0.8, ease: "power3" }), ry = G.quickTo(el, "rotationY", { duration: 0.8, ease: "power3" });
      G.set(el, { transformPerspective: 900 });
      el.addEventListener("pointermove", e => { const r = el.getBoundingClientRect(); ry(((e.clientX - r.left) / r.width - 0.5) * 10); rx(-((e.clientY - r.top) / r.height - 0.5) * 10); });
      el.addEventListener("pointerleave", () => { rx(0); ry(0); });
    });
  }

  // ---------- faixas infinitas (aceleram com a velocidade da rolagem) ----------
  function initMarquees(G) {
    $$("[data-marquee]").forEach(m => {
      const faixa = m.querySelector(".marquee__track"); if (!faixa) return;
      faixa.innerHTML += faixa.innerHTML; // duplica para o laço sem emenda
      if (!G) return m.classList.add("is-css");
      const dur = parseFloat(m.dataset.speed) || 28;
      const tw = m.dataset.marquee === "reverse"
        ? G.fromTo(faixa, { xPercent: -50 }, { xPercent: 0, duration: dur, ease: "none", repeat: -1 })
        : G.to(faixa, { xPercent: -50, duration: dur, ease: "none", repeat: -1 });
      ST.create({ onUpdate: s => { const v = Math.min(4, 1 + Math.abs(s.getVelocity()) / 600); G.to(tw, { timeScale: v * (s.direction === 1 ? 1 : -1), duration: 0.3, overwrite: true, onComplete: () => G.to(tw, { timeScale: 1, duration: 1 }) }); } });
    });
  }
})();
