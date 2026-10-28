/**
 * Plan-8 Layout: Interactive 3D/2D Architectural Map Engine
 * Reads window.PLAN8_CONFIG (config.js) and window.PLAN8_PLAN (plan-data.js).
 */
(() => {
  "use strict";

  const CFG = window.PLAN8_CONFIG || {};
  const PLAN = window.PLAN8_PLAN;
  if (!PLAN) {
    console.error("Plan data not found! Ensure js/plan-data.js is loaded before js/app.js.");
    return;
  }

  const {
    K, R, RAW, CORNER_N, SITE, WIDEN_N, WIDEN_W, PARK1, PARK2, UTILITY, STP, ROADS,
    L1, L2, L3, L4, ROAD_END, WIDEN_OUT, OUT_ROAD9, EXIST_ROAD, SLOPE, SURVEY,
    PLOTS14_BOX, BOUNDS, HOME, RESIDENTIAL_M2, SIDE_BY_NORMAL
  } = PLAN;

  const STATUS_META = {
    available: { label: "Available",     color: "var(--st-available)" },
    booked:    { label: "Booked",        color: "var(--st-booked)" },
    sold:      { label: "Sold",          color: "var(--st-sold)" },
    na:        { label: "Not available", color: "var(--st-na)" }
  };
  const FACINGS = ["East", "West", "North", "South"];
  const SIZES = { "30x50": "30′ × 50′", "30x40": "30′ × 40′", odd: "Odd sites" };

  /* ================= Plot data ================= */
  const statusOf = {};
  Object.entries(CFG.status || {}).forEach(([s, list]) => (list || []).forEach(n => (statusOf[n] = s)));

  const dist = (a, b) => Math.hypot(b[0] - a[0], b[1] - a[1]);
  const shoelace = pts => Math.abs(pts.reduce((s, p, i) => { const q = pts[(i + 1) % pts.length]; return s + p[0] * q[1] - q[0] * p[1]; }, 0)) / 2;
  function centroid(pts) {
    let a = 0, cx = 0, cy = 0;
    pts.forEach((p, i) => { const q = pts[(i + 1) % pts.length]; const f = p[0] * q[1] - q[0] * p[1]; a += f; cx += (p[0] + q[0]) * f; cy += (p[1] + q[1]) * f; });
    a /= 2; return [cx / (6 * a), cy / (6 * a)];
  }
  function sideOfEdge(a, b) {
    const dx = b[0] - a[0], dy = b[1] - a[1];
    const nx = dy, ny = -dx; // outward normal for clockwise points (y down)
    if (Math.abs(nx) > Math.abs(ny)) return SIDE_BY_NORMAL[nx > 0 ? "right" : "left"];
    return SIDE_BY_NORMAL[ny > 0 ? "down" : "up"];
  }

  const PLOTS = RAW.map(r => {
    const dims = r.dims.map((v, i) => v ?? +(dist(r.pts[i], r.pts[(i + 1) % r.pts.length]) / K).toFixed(2));
    const sorted = [dims[0], dims[1]].sort((a, b) => a - b).join("x");
    const isRect = dims.length === 4 && dims[0] === dims[2] && dims[1] === dims[3];
    let type = "odd";
    if (isRect && sorted === "9.14x15.24") type = "30x50";
    else if (isRect && sorted === "9.14x12.19") type = "30x40";
    const edges = r.pts.map((p, i) => {
      const q = r.pts[(i + 1) % r.pts.length];
      return { a: p, b: q, m: dims[i], est: r.dims[i] == null, side: sideOfEdge(p, q) };
    });
    const xs = r.pts.map(p => p[0]), ys = r.pts.map(p => p[1]);
    const roads = [r.facing, ...(r.corner ? [r.corner] : []), ...(CORNER_N[r.no] ? ["North"] : [])];
    return {
      no: r.no, pts: r.pts, dims, edges, type, isRect,
      facing: r.facing, roads, corner: roads.length > 1,
      status: statusOf[r.no] || "available",
      c: centroid(r.pts),
      minSide: Math.min(Math.max(...xs) - Math.min(...xs), Math.max(...ys) - Math.min(...ys)),
      geoArea: shoelace(r.pts) / (K * K)
    };
  }).sort((a, b) => a.no - b.no);

  // Calculate areas: exact from written dimensions for standard plots; odd plots use scaled surveyor shape
  (function setAreas() {
    let fixed = 0, geo = 0;
    PLOTS.forEach(p => { if (p.isRect) { p.area = p.dims[0] * p.dims[1]; fixed += p.area; } else geo += p.geoArea; });
    const f = (RESIDENTIAL_M2 - fixed) / geo;
    PLOTS.forEach(p => { if (!p.isRect) { p.area = p.geoArea * f; p.approx = true; } });
  })();

  const byNo = Object.fromEntries(PLOTS.map(p => [p.no, p]));
  const counts = {};
  PLOTS.forEach(p => (counts[p.status] = (counts[p.status] || 0) + 1));

  /* ================= Formatting ================= */
  const SQFT = 10.7639, CENT = 40.4686, GUNTA = 101.17;
  const nf0 = new Intl.NumberFormat("en-IN", { maximumFractionDigits: 0 });
  const nf2 = new Intl.NumberFormat("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  function ftIn(m) { const i = Math.round(m / 0.0254); return `${Math.floor(i / 12)}′ ${i % 12}″`; }
  const ftShort = m => { const i = Math.round(m / 0.0254); const f = Math.floor(i / 12), r = i % 12; return r ? `${f}′${r}″` : `${f}′`; };
  const sizeLabel = p => SIZES[p.type] === "Odd sites" ? "Odd site" : SIZES[p.type];
  const approx = p => (p.approx ? "≈ " : "");
  const escapeHTML = s => String(s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

  function priceOf(p) {
    if (CFG.prices && CFG.prices[p.no] != null) return +CFG.prices[p.no];
    if (!CFG.pricePerSqft) return null;
    const premium = p.corner && CFG.cornerPremiumPct ? 1 + CFG.cornerPremiumPct / 100 : 1;
    return p.area * SQFT * CFG.pricePerSqft * premium;
  }
  function inr(v) {
    if (v >= 1e7) return `₹${(v / 1e7).toFixed(2)} Cr`;
    if (v >= 1e5) return `₹${(v / 1e5).toFixed(2)} L`;
    return `₹${nf0.format(v)}`;
  }
  let units = "m";
  const dimText = (m, est) => (est ? "≈" : "") + (units === "ft" ? ftShort(m) : `${m.toFixed(2)}m`);
  const areaText = p => units === "ft" ? `${nf0.format(p.area * SQFT)} ft²` : `${p.area.toFixed(1)} m²`;

  /* ================= SVG build ================= */
  const svg = document.getElementById("map");
  const ptsAttr = pts => pts.map(p => p.map(v => +v.toFixed(1)).join(",")).join(" ");
  function rng(seed) { return () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }

  function texture(id, base, specks, seed, size = 56) {
    const r = rng(seed);
    let s = `<pattern id="${id}" patternUnits="userSpaceOnUse" width="${size}" height="${size}"><rect width="${size}" height="${size}" fill="${base}"/>`;
    specks.forEach(sp => {
      for (let i = 0; i < sp.n; i++) {
        const x = (r() * size).toFixed(1), y = (r() * size).toFixed(1);
        if (sp.blade) {
          const a = (r() - 0.5) * 1.1, l = sp.len * (0.6 + r() * 0.6);
          s += `<path d="M${x} ${y} l${(Math.sin(a) * l).toFixed(1)} ${(-Math.cos(a) * l).toFixed(1)}" stroke="${sp.c}" stroke-width="${sp.w}" stroke-linecap="round" opacity="${sp.o}"/>`;
        } else {
          s += `<circle cx="${x}" cy="${y}" r="${(sp.r * (0.5 + r())).toFixed(2)}" fill="${sp.c}" opacity="${sp.o}"/>`;
        }
      }
    });
    return s + "</pattern>";
  }
  function pointInPoly(pt, pts) {
    let inside = false;
    for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
      const [xi, yi] = pts[i], [xj, yj] = pts[j];
      if ((yi > pt[1]) !== (yj > pt[1]) && pt[0] < (xj - xi) * (pt[1] - yi) / (yj - yi) + xi) inside = !inside;
    }
    return inside;
  }
  function distToPoly(pt, pts) {
    let d = Infinity;
    pts.forEach((a, i) => {
      const b = pts[(i + 1) % pts.length];
      const dx = b[0] - a[0], dy = b[1] - a[1];
      const t = Math.max(0, Math.min(1, ((pt[0] - a[0]) * dx + (pt[1] - a[1]) * dy) / (dx * dx + dy * dy)));
      d = Math.min(d, Math.hypot(pt[0] - a[0] - t * dx, pt[1] - a[1] - t * dy));
    });
    return d;
  }
  function trees(poly, avoid, seed, step) {
    const r = rng(seed);
    const xs = poly.map(p => p[0]), ys = poly.map(p => p[1]);
    let shadow = "", crown = "";
    for (let y = Math.min(...ys) + step / 2; y < Math.max(...ys); y += step) {
      for (let x = Math.min(...xs) + step / 2; x < Math.max(...xs); x += step) {
        const p = [x + (r() - 0.5) * step * 0.7, y + (r() - 0.5) * step * 0.7];
        if (r() < 0.38) continue;
        if (!pointInPoly(p, poly) || distToPoly(p, poly) < 16) continue;
        if (avoid.some(a => pointInPoly(p, a) || distToPoly(p, a) < 14)) continue;
        const rad = 8 + r() * 7;
        const shade = ["#2f7a2a", "#3b8a2f", "#2a6e27", "#47943a"][Math.floor(r() * 4)];
        shadow += `<circle cx="${(p[0] + 5).toFixed(1)}" cy="${(p[1] + 7).toFixed(1)}" r="${rad.toFixed(1)}"/>`;
        crown += `<circle cx="${p[0].toFixed(1)}" cy="${p[1].toFixed(1)}" r="${rad.toFixed(1)}" fill="${shade}"/><circle cx="${(p[0] - rad * 0.3).toFixed(1)}" cy="${(p[1] - rad * 0.3).toFixed(1)}" r="${(rad * 0.45).toFixed(1)}" fill="#6fbf4c" opacity=".55"/>`;
      }
    }
    return `<g fill="rgba(0,0,0,.22)">${shadow}</g><g>${crown}</g>`;
  }

  // Upright and along-edge label helpers
  const upright = (x, y, inner, cls = "") => `<g class="${cls}" data-ux="${x.toFixed(1)}" data-uy="${y.toFixed(1)}">${inner}</g>`;
  const along = (x, y, ang, inner, cls = "") => `<g class="${cls}" data-ax="${x.toFixed(1)}" data-ay="${y.toFixed(1)}" data-ang="${ang.toFixed(1)}">${inner}</g>`;

  function plotLabels(p) {
    let s = "";
    p.edges.forEach(e => {
      const L = dist(e.a, e.b);
      if (L < 38 || !e.m) return;
      const dx = (e.b[0] - e.a[0]) / L, dy = (e.b[1] - e.a[1]) / L;
      const nx = -dy, ny = dx; // inward
      const mx = (e.a[0] + e.b[0]) / 2 + nx * 8.5, my = (e.a[1] + e.b[1]) / 2 + ny * 8.5;
      const ang = Math.atan2(dy, dx) * 180 / Math.PI;
      s += along(mx, my, ang, `<text class="p-dim" text-anchor="middle" dominant-baseline="central" data-m="${e.m}" data-est="${e.est ? 1 : ""}">${dimText(e.m, e.est)}</text>`);
    });
    const fs = Math.max(15, Math.min(25, p.minSide * 0.25));
    p.fs = fs;
    s += upright(p.c[0], p.c[1], `<text class="p-no" text-anchor="middle" x="${p.c[0].toFixed(1)}" y="${(p.c[1] + fs * 0.15).toFixed(1)}" font-size="${fs.toFixed(1)}" data-no="${p.no}">${p.no}</text><text class="p-area" text-anchor="middle" x="${p.c[0].toFixed(1)}" y="${(p.c[1] + fs * 0.15 + 12).toFixed(1)}" data-area="${p.no}">${areaText(p)}</text>`);
    return s;
  }

  function build() {
    const defs = `<defs>
      ${texture("tx-available", "#6dbb3e", [{ c: "#4f9a2b", n: 70, blade: 1, len: 5, w: 1.1, o: .8 }, { c: "#8fd45a", n: 40, blade: 1, len: 4, w: 1, o: .7 }, { c: "#3f8424", n: 20, r: 1.6, o: .5 }], 11)}
      ${texture("tx-booked", "#cfa33a", [{ c: "#b38726", n: 55, r: 1.6, o: .7 }, { c: "#e6c35e", n: 45, r: 1.3, o: .7 }, { c: "#9d7520", n: 14, blade: 1, len: 4, w: 1, o: .6 }], 23)}
      ${texture("tx-sold", "#9a7346", [{ c: "#7f5c34", n: 60, r: 1.7, o: .75 }, { c: "#b58c5b", n: 45, r: 1.4, o: .7 }, { c: "#6a4b29", n: 16, r: 2.4, o: .45 }], 37)}
      ${texture("tx-na", "#9aa0a4", [{ c: "#868c90", n: 50, r: 1.5, o: .7 }, { c: "#b1b6b9", n: 40, r: 1.3, o: .7 }], 41)}
      ${texture("pat-park", "#78bf4a", [{ c: "#5ea53a", n: 80, blade: 1, len: 5, w: 1.1, o: .8 }, { c: "#94d464", n: 50, blade: 1, len: 4, w: 1, o: .65 }], 53, 64)}
      <pattern id="pat-hatch" patternUnits="userSpaceOnUse" width="10" height="10" patternTransform="rotate(45)"><rect width="10" height="10" fill="transparent"/><path d="M0 0V10" stroke="#e58a2b" stroke-width="2.4" opacity=".55"/></pattern>
    </defs>`;

    let g = `<g id="content">`;
    // Outside roads and site ground
    g += `<polygon class="m-road-widen" points="${ptsAttr(WIDEN_OUT)}"/><polygon class="m-road-out" points="${ptsAttr(OUT_ROAD9)}"/>`;
    g += `<polygon class="m-site" points="${ptsAttr(SITE)}"/>`;
    // Land between the plots and the boundary that goes to the 18 m widening
    g += `<polygon class="m-road-widen" points="${ptsAttr([[573, L1(573)], [998, L1(998)], [998, 2049], [574, 2082]])}"/>`;
    g += `<g class="zone-hit" data-tip="Existing 12 m road|Widening to 18 m"><polygon class="m-road-out" points="${ptsAttr(EXIST_ROAD)}"/></g>`;
    g += `<line class="m-roadline" x1="-650" y1="1747" x2="511" y2="1747"/>`;
    g += `<line class="m-roadline" x1="512" y1="1800" x2="512" y2="${L2(512) + 60}"/>`;
    g += `<line class="m-roadline" x1="512" y1="${(L2(512) + L3(512)) / 2}" x2="${ROAD_END - 20}" y2="${(L2(ROAD_END - 20) + L3(ROAD_END - 20)) / 2}"/>`;
    g += `<line class="m-roadline" x1="647" y1="${L4(647) + 20}" x2="647" y2="2880"/>`;

    // Parks
    g += `<g class="zone-hit" data-tip="Park / open space 1|2,080.80 m²"><polygon class="m-park" points="${ptsAttr(PARK1)}"/><polygon class="m-park-edge" points="${ptsAttr(PARK1)}"/></g>`;
    g += `<g class="zone-hit" data-tip="Park / open space 2|469.88 m²"><polygon class="m-park" points="${ptsAttr(PARK2)}"/><polygon class="m-park-edge" points="${ptsAttr(PARK2)}"/></g>`;

    // Roads
    ROADS.forEach(r => { g += `<polygon class="m-road" points="${ptsAttr(r.pts)}"/>`; });
    g += `<g class="zone-hit" data-tip="Road widening area|Hatched on the approved plan"><polygon points="${ptsAttr(WIDEN_N)}" fill="url(#pat-hatch)"/><polygon points="${ptsAttr(WIDEN_W)}" fill="url(#pat-hatch)"/></g>`;
    ROADS.forEach(r => { g += `<line class="m-roadline" x1="${r.c[0][0]}" y1="${r.c[0][1]}" x2="${r.c[1][0]}" y2="${r.c[1][1]}"/>`; });

    // Walls (extruded sides) for raised elements
    g += `<g id="walls">`;
    PLOTS.forEach(p => { g += `<polygon class="m-wall" points="${ptsAttr(p.pts)}"/>`; });
    g += `</g>`;
    g += `<g id="walls-hi">${[UTILITY, STP].map(q => `<polygon class="m-wall" points="${ptsAttr(q)}" style="stroke-width:3"/>`).join("")}</g>`;

    g += trees(PARK1, [PLOTS14_BOX, UTILITY, STP], 7, 30) + trees(PARK2, [], 9, 30);

    // Curbs (block outlines)
    g += `<g>${PLOTS.map(p => `<polygon class="m-curb" points="${ptsAttr(p.pts)}"/>`).join("")}</g>`;

    // Utility & STP
    g += `<g class="zone-hit" data-tip="Public utility|101.73 m²"><polygon class="m-utility" points="${ptsAttr(UTILITY)}"/></g>`;
    g += `<g class="zone-hit" data-tip="Sewage treatment plant|STP"><polygon class="m-stp" points="${ptsAttr(STP)}"/></g>`;

    // Plots
    g += `<g id="plots">`;
    PLOTS.forEach(p => {
      g += `<g class="plot" data-no="${p.no}" tabindex="0" role="button" aria-label="Plot ${p.no}, ${STATUS_META[p.status].label}, ${sizeLabel(p)}, ${p.facing} facing">
        <polygon class="hit" points="${ptsAttr(p.pts)}"/>
        <g class="top"><polygon class="face" points="${ptsAttr(p.pts)}" fill="url(#tx-${p.status})"/><polygon class="ring" points="${ptsAttr(p.pts)}"/>${plotLabels(p)}</g>
      </g>`;
    });
    g += `</g>`;

    g += `<polygon class="m-boundary" points="${ptsAttr(SITE)}"/>`;

    // Zone, road and survey labels
    g += upright(300, 420, `<text class="m-label-zone" text-anchor="middle" x="300" y="414">PARK / OPEN SPACE 1</text><text class="m-label-zone m-label-zone-sub" text-anchor="middle" x="300" y="432">2,080.80 m²</text>`);
    g += upright(1010, 150, `<text class="m-label-zone" text-anchor="middle" x="1010" y="152">PARK / OPEN SPACE 2</text><text class="m-label-zone m-label-zone-sub" text-anchor="middle" x="1010" y="168">469.88 m²</text>`);
    g += along(545, 994, -90, `<text class="m-label-zone m-label-zone-sub" text-anchor="middle" dominant-baseline="central" style="font-size:9.5px;font-weight:700">UTILITY 101.73 m²</text>`);
    g += upright(313, 666, `<text class="m-label-zone m-label-zone-sub" text-anchor="middle" x="313" y="670" style="font-size:10px;font-weight:800">STP</text>`);
    ROADS.forEach(r => { g += along(r.at[0], r.at[1], r.ang, `<text class="m-label-road" text-anchor="middle" dominant-baseline="central" dy="-9">${r.label}</text>`); });
    g += along(-90, 1747, 0, `<text class="m-label-out" text-anchor="middle" dominant-baseline="central" dy="-14">← TO HALESAMPIGEHALLI · EXISTING 12 M ROAD, WIDENING TO 18 M</text>`);
    g += along(1240, (L2(1240) + L3(1240)) / 2, SLOPE, `<text class="m-label-out" text-anchor="middle" dominant-baseline="central" dy="-14">EXISTING 12 M ROAD, WIDENING TO 18 M · FROM BANNERUGHATTA →</text>`);
    g += along(647, 2520, -90, `<text class="m-label-out" text-anchor="middle" dominant-baseline="central" dy="-14">9.0 M WIDE ROAD</text>`);
    g += `<g class="survey">` + SURVEY.map(([n, x, y]) => upright(x, y, `<text class="m-survey" text-anchor="middle" x="${x}" y="${y + 4}">SY No. ${n}</text>`)).join("") + `</g>`;

    g += `</g>`;
    svg.innerHTML = defs + g;
  }
  build();

  const content = document.getElementById("content");
  const walls = document.getElementById("walls");
  const wallsHi = document.getElementById("walls-hi");
  const uprights = [...svg.querySelectorAll("[data-ux]")].map(el => ({ el, x: +el.dataset.ux, y: +el.dataset.uy }));
  const alongs = [...svg.querySelectorAll("[data-ax]")].map(el => ({ el, x: +el.dataset.ax, y: +el.dataset.ay, ang: +el.dataset.ang }));
  const numLabels = [...svg.querySelectorAll(".p-no")].map(el => {
    const p = byNo[el.dataset.no];
    return { el, area: el.nextElementSibling, p, fsMax: Math.min(p.minSide * 0.46, 46) };
  });
  const plotEls = Object.fromEntries([...svg.querySelectorAll(".plot")].map(el => [el.dataset.no, el]));

  /* ================= View: pan / zoom / rotate / tilt ================= */
  const stage = document.getElementById("stage");
  const panel = document.getElementById("panel");
  const TILT_3D = 45;
  const DIMS_MIN_Z = 0.8;
  const view = { cx: HOME.cx, cy: HOME.cy, z: 0.3, tilt: TILT_3D, rot: 0, pl: 0 };
  let SW = 0, SH = 0, lastZ = 0;
  const isWide = () => window.matchMedia("(min-width: 900px)").matches;
  const pads = () => isWide() ? { t: 8, r: 64, b: 86 } : { t: 64, r: 58, b: 96 };

  function layout() {
    SW = stage.clientWidth; SH = stage.clientHeight;
    svg.setAttribute("viewBox", `0 0 ${SW} ${SH}`);
    svg.setAttribute("width", SW); svg.setAttribute("height", SH);
  }
  const panelPad = () => (isWide() && panel.classList.contains("open") ? panel.offsetLeft + panel.offsetWidth : 0);

  function matrixFor(v) {
    const r = v.rot * Math.PI / 180, ct = Math.cos(v.tilt * Math.PI / 180);
    const a = v.z * Math.cos(r), c = -v.z * Math.sin(r);
    const b = v.z * ct * Math.sin(r), d = v.z * ct * Math.cos(r);
    const P = pads();
    const sx = v.pl + (SW - v.pl) / 2, sy = P.t + (SH - P.t - P.b) / 2;
    return { a, b, c, d, e: sx - (a * v.cx + c * v.cy), f: sy - (b * v.cx + d * v.cy), ct };
  }
  function unproject(m, X, Y) {
    const det = m.a * m.d - m.b * m.c;
    return [(m.d * X - m.c * Y) / det, (-m.b * X + m.a * Y) / det];
  }
  function fitZoom(tilt = view.tilt, rot = view.rot, pl = view.pl) {
    const w = BOUNDS.x1 - BOUNDS.x0, h = BOUNDS.y1 - BOUNDS.y0;
    const r = rot * Math.PI / 180, c = Math.abs(Math.cos(r)), s = Math.abs(Math.sin(r));
    const bw = w * c + h * s, bh = (w * s + h * c) * Math.cos(tilt * Math.PI / 180);
    const P = pads();
    const availW = Math.max(200, SW - pl - (pl ? 24 : 0) - P.r);
    const availH = Math.max(200, SH - P.t - P.b);
    return Math.min(availW / bw, availH / bh) * 0.96;
  }
  const minZ = () => fitZoom() * 0.35;
  const MAX_Z = 10;
  const clampZ = z => Math.max(minZ(), Math.min(z, MAX_Z));

  function apply() {
    const m = matrixFor(view);
    const f = n => n.toFixed(4);
    content.setAttribute("transform", `matrix(${f(m.a)} ${f(m.b)} ${f(m.c)} ${f(m.d)} ${m.e.toFixed(2)} ${m.f.toFixed(2)})`);
    const st = Math.sin(view.tilt * Math.PI / 180);
    const w1 = unproject(m, 0, 9 * view.z * st), w2 = unproject(m, 0, 20 * view.z * st);
    walls.setAttribute("transform", `translate(${w1[0].toFixed(2)} ${w1[1].toFixed(2)})`);
    wallsHi.setAttribute("transform", `translate(${w2[0].toFixed(2)} ${w2[1].toFixed(2)})`);
    const lift = unproject(m, 0, -view.z * (2 + 5 * st));
    svg.style.setProperty("--lift-x", `${lift[0].toFixed(2)}px`);
    svg.style.setProperty("--lift-y", `${lift[1].toFixed(2)}px`);
    const sy = (1 / m.ct).toFixed(4), rr = (-view.rot).toFixed(2);
    uprights.forEach(u => u.el.setAttribute("transform", `translate(${u.x} ${u.y}) rotate(${rr}) scale(1 ${sy}) translate(${-u.x} ${-u.y})`));
    alongs.forEach(a => {
      let ang = a.ang;
      const eff = ((ang + view.rot) % 360 + 540) % 360 - 180;
      if (eff > 90.5 || eff <= -89.5) ang += 180;
      a.el.setAttribute("transform", `translate(${a.x} ${a.y}) rotate(${ang.toFixed(2)})`);
    });
    if (Math.abs(view.z - lastZ) / (lastZ || 1) > 0.01) {
      numLabels.forEach(n => {
        const fs = Math.min(n.fsMax, Math.max(n.p.fs, 12 / view.z));
        const y = n.p.c[1] + fs * 0.35;
        n.el.setAttribute("font-size", fs.toFixed(1));
        n.el.setAttribute("y", y.toFixed(1));
        n.area.setAttribute("y", (y + 11).toFixed(1));
      });
      lastZ = view.z;
    }
    const far = view.z < DIMS_MIN_Z;
    svg.classList.toggle("far", far);
    zoomHint.hidden = !far || document.body.classList.contains("hide-dims") || !!root.firstChild;
    document.getElementById("needle").style.transform = `rotate(${(Math.atan2(-m.a, m.b) * 180 / Math.PI).toFixed(1)}deg)`;
  }

  function toPlan(sx, sy) {
    const m = matrixFor(view);
    return unproject(m, sx - m.e, sy - m.f);
  }
  function zoomAt(sx, sy, factor) {
    const before = toPlan(sx, sy);
    view.z = clampZ(view.z * factor);
    const after = toPlan(sx, sy);
    view.cx += before[0] - after[0]; view.cy += before[1] - after[1];
    clampCenter(); apply();
  }
  function clampCenter() {
    view.cx = Math.max(BOUNDS.x0 - 400, Math.min(BOUNDS.x1 + 400, view.cx));
    view.cy = Math.max(BOUNDS.y0 - 400, Math.min(BOUNDS.y1 + 500, view.cy));
  }

  let anim = null;
  const reduceMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;
  function animateTo(target, ms = 650) {
    cancelAnimationFrame(anim);
    const from = { ...view };
    const to = { ...view, ...target };
    if (reduceMotion) { Object.assign(view, to); apply(); syncModeBtn(); return; }
    const t0 = performance.now();
    const ease = t => t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
    const step = now => {
      const k = Math.min(1, (now - t0) / ms), e = ease(k);
      for (const key of ["cx", "cy", "z", "tilt", "rot", "pl"]) view[key] = from[key] + (to[key] - from[key]) * e;
      apply();
      if (k < 1) anim = requestAnimationFrame(step); else syncModeBtn();
    };
    anim = requestAnimationFrame(step);
  }
  function resetView() {
    animateTo({ ...HOME, z: fitZoom(TILT_3D, 0, view.pl), tilt: TILT_3D, rot: 0 });
  }
  function zoomBy(f) {
    animateTo({ z: clampZ(view.z * f) }, 320);
  }

  /* Pointer Interaction */
  const pointers = new Map();
  let drag = null, pinch = null, downPlot = null, moved = 0;
  const onMap = e => e.target.closest("#map") || e.target === stage;
  stage.addEventListener("contextmenu", e => { if (e.target.closest("#map")) e.preventDefault(); });
  stage.addEventListener("pointerdown", e => {
    if (!onMap(e)) return;
    cancelAnimationFrame(anim);
    pointers.set(e.pointerId, [e.clientX, e.clientY]);
    stage.setPointerCapture(e.pointerId);
    const rect = stage.getBoundingClientRect();
    moved = 0;
    downPlot = e.target.closest(".plot");
    if (pointers.size === 1) {
      drag = { rotateMode: e.button === 2 || e.shiftKey, sx: e.clientX, sy: e.clientY, lx: e.clientX, ly: e.clientY, p0: toPlan(e.clientX - rect.left, e.clientY - rect.top) };
    } else if (pointers.size === 2) {
      const [a, b] = [...pointers.values()];
      pinch = { d: Math.hypot(a[0] - b[0], a[1] - b[1]), z: view.z, mid: [(a[0] + b[0]) / 2 - rect.left, (a[1] + b[1]) / 2 - rect.top] };
      pinch.p0 = toPlan(pinch.mid[0], pinch.mid[1]);
      drag = null;
    }
  });
  stage.addEventListener("pointermove", e => {
    if (!pointers.has(e.pointerId)) return;
    pointers.set(e.pointerId, [e.clientX, e.clientY]);
    const rect = stage.getBoundingClientRect();
    if (pinch && pointers.size >= 2) {
      const [a, b] = [...pointers.values()];
      const d = Math.hypot(a[0] - b[0], a[1] - b[1]);
      const mid = [(a[0] + b[0]) / 2 - rect.left, (a[1] + b[1]) / 2 - rect.top];
      view.z = clampZ(pinch.z * d / pinch.d);
      const p = toPlan(mid[0], mid[1]);
      view.cx += pinch.p0[0] - p[0]; view.cy += pinch.p0[1] - p[1];
      moved = 99; clampCenter(); apply();
      return;
    }
    if (!drag) return;
    moved = Math.max(moved, Math.hypot(e.clientX - drag.sx, e.clientY - drag.sy));
    if (moved < 5) return;
    stage.classList.add("dragging");
    hideTip();
    if (drag.rotateMode) {
      view.rot += (e.clientX - drag.lx) * 0.35;
      view.tilt = Math.max(0, Math.min(62, view.tilt - (e.clientY - drag.ly) * 0.25));
      syncModeBtn();
    } else {
      const p = toPlan(e.clientX - rect.left, e.clientY - rect.top);
      view.cx += drag.p0[0] - p[0]; view.cy += drag.p0[1] - p[1];
      clampCenter();
    }
    drag.lx = e.clientX; drag.ly = e.clientY;
    apply();
  });
  function endPointer(e) {
    if (!pointers.has(e.pointerId)) return;
    pointers.delete(e.pointerId);
    if (pointers.size < 2) pinch = null;
    if (pointers.size === 0) {
      stage.classList.remove("dragging");
      if (drag && moved < 5 && downPlot && e.type === "pointerup" && e.button !== 2) openPlot(+downPlot.dataset.no);
      drag = null; downPlot = null;
    }
  }
  stage.addEventListener("pointerup", endPointer);
  stage.addEventListener("pointercancel", endPointer);
  stage.addEventListener("wheel", e => {
    if (!onMap(e)) return;
    e.preventDefault();
    cancelAnimationFrame(anim);
    const rect = stage.getBoundingClientRect();
    const dy = e.deltaMode === 1 ? e.deltaY * 16 : e.deltaY;
    zoomAt(e.clientX - rect.left, e.clientY - rect.top, Math.exp(-dy * (e.ctrlKey ? 0.01 : 0.0018)));
  }, { passive: false });

  /* Keyboard controls */
  svg.addEventListener("keydown", e => {
    const pl = e.target.closest && e.target.closest(".plot");
    if (pl && (e.key === "Enter" || e.key === " ")) { e.preventDefault(); openPlot(+pl.dataset.no); }
  });
  document.addEventListener("keydown", e => {
    if (root.firstChild || e.metaKey || e.ctrlKey || e.altKey) return;
    if (e.target.closest("input, textarea")) return;
    const pan = (dx, dy) => { const m = matrixFor(view); const d = unproject(m, dx, dy); animateTo({ cx: view.cx + d[0], cy: view.cy + d[1] }, 200); };
    const map = {
      "+": () => zoomBy(1.4), "=": () => zoomBy(1.4), "-": () => zoomBy(1 / 1.4), "_": () => zoomBy(1 / 1.4),
      "0": resetView, q: () => animateTo({ rot: view.rot - 45 }, 400), e: () => animateTo({ rot: view.rot + 45 }, 400),
      t: () => modeBtn.click(), "/": () => { openPanel(); qInput.focus(); },
      ArrowLeft: () => pan(-120, 0), ArrowRight: () => pan(120, 0), ArrowUp: () => pan(0, -120), ArrowDown: () => pan(0, 120)
    };
    const fn = map[e.key];
    if (fn && !(e.key.startsWith("Arrow") && e.target.closest(".plot"))) { e.preventDefault(); fn(); }
  });

  /* View mode & HUD Controls */
  const modeBtn = document.getElementById("btn-mode");
  function syncModeBtn() {
    const is3d = view.tilt > 8;
    modeBtn.querySelector(".mode").textContent = is3d ? "2D" : "3D";
    modeBtn.setAttribute("aria-label", is3d ? "Switch to 2D view" : "Switch to 3D view");
  }
  modeBtn.addEventListener("click", () => animateTo({ tilt: view.tilt <= 8 ? TILT_3D : 0, z: clampZ(view.z) }));
  document.getElementById("btn-zin").addEventListener("click", () => zoomBy(1.5));
  document.getElementById("btn-zout").addEventListener("click", () => zoomBy(1 / 1.5));
  document.getElementById("btn-rl").addEventListener("click", () => animateTo({ rot: view.rot - 45 }, 450));
  document.getElementById("btn-rr").addEventListener("click", () => animateTo({ rot: view.rot + 45 }, 450));
  document.getElementById("btn-reset").addEventListener("click", resetView);
  document.getElementById("compass").addEventListener("click", () => {
    const northUp = Math.abs(((view.rot - 90) % 360 + 540) % 360 - 180) < 1;
    const target = northUp ? 0 : 90;
    const delta = ((target - view.rot) % 360 + 540) % 360 - 180;
    animateTo({ rot: view.rot + delta, z: fitZoom(view.tilt, target) }, 600);
  });
  const zoomHint = document.getElementById("zoom-hint");
  document.getElementById("zoom-hint-btn").addEventListener("click", () => animateTo({ z: Math.max(DIMS_MIN_Z * 1.35, view.z) }, 500));

  /* ================= Tooltip & Toast ================= */
  const tip = document.getElementById("tooltip");
  function hideTip() { tip.hidden = true; }
  function showTip(html, color, x, y) {
    tip.innerHTML = html;
    tip.style.color = color;
    tip.style.left = Math.max(110, Math.min(window.innerWidth - 110, x)) + "px";
    tip.style.top = y + "px";
    tip.hidden = false;
  }
  const canHover = matchMedia("(hover: hover)").matches;
  stage.addEventListener("pointermove", e => {
    if (!canHover || (drag && moved >= 5) || pinch) return;
    const pl = e.target.closest(".plot");
    if (pl) {
      const p = byNo[pl.dataset.no];
      const price = priceOf(p);
      showTip(`Plot ${p.no} · ${STATUS_META[p.status].label}<small>${sizeLabel(p)} · ${p.facing} facing · ${approx(p)}${nf0.format(p.area * SQFT)} sq.ft${price && p.status === "available" ? " · " + inr(price) : ""}</small>`, STATUS_META[p.status].color, e.clientX, e.clientY);
      return;
    }
    const z = e.target.closest(".zone-hit");
    if (z) {
      const [a, b] = z.dataset.tip.split("|");
      showTip(`${a}<small>${b}</small>`, "var(--panel-fg)", e.clientX, e.clientY);
      return;
    }
    hideTip();
  });
  stage.addEventListener("pointerleave", hideTip);
  let toastTimer = null;
  function toast(msg) {
    document.querySelector(".toast")?.remove();
    const t = document.createElement("div");
    t.className = "toast"; t.setAttribute("role", "status"); t.textContent = msg;
    document.body.appendChild(t);
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => t.remove(), 2200);
  }

  /* ================= Search & Filters ================= */
  const F = {
    q: "",
    status: new Set(Object.keys(STATUS_META)),
    facing: new Set(FACINGS),
    size: new Set(Object.keys(SIZES))
  };
  const ALL = { status: Object.keys(STATUS_META), facing: FACINGS, size: Object.keys(SIZES) };
  document.getElementById("avail-count").textContent = counts.available || 0;
  document.getElementById("fab-count").textContent = `${counts.available || 0} available`;

  function chip(label, pressed, attrs, dot) {
    return `<button type="button" class="chip" aria-pressed="${pressed}" ${attrs}>${dot ? `<i class="dot" style="background:${dot}"></i>` : ""}${label}</button>`;
  }
  document.getElementById("f-status").innerHTML = Object.entries(STATUS_META).filter(([k]) => k !== "na" || counts.na).map(([k, m]) => chip(`${m.label} <span class="n">${counts[k] || 0}</span>`, true, `data-f="status" data-v="${k}"`, m.color)).join("");
  document.getElementById("f-facing").innerHTML = FACINGS.map(f => chip(`${f} <span class="n">${PLOTS.filter(p => p.facing === f).length}</span>`, true, `data-f="facing" data-v="${f}"`)).join("");
  document.getElementById("f-size").innerHTML = Object.entries(SIZES).map(([k, l]) => chip(`${l} <span class="n">${PLOTS.filter(p => p.type === k).length}</span>`, true, `data-f="size" data-v="${k}"`)).join("");

  function syncChips(group) {
    document.querySelectorAll(`.chip[data-f="${group}"]`).forEach(c => c.setAttribute("aria-pressed", String(F[group].has(c.dataset.v))));
  }
  panel.addEventListener("click", e => {
    const c = e.target.closest(".chip");
    if (c) {
      const group = c.dataset.f, v = c.dataset.v, set = F[group];
      const all = ALL[group].every(x => set.has(x));
      if (all) { set.clear(); set.add(v); }
      else if (set.has(v) && set.size === 1) ALL[group].forEach(x => set.add(x));
      else set.has(v) ? set.delete(v) : set.add(v);
      syncChips(group);
      applyFilters();
      return;
    }
    const r = e.target.closest(".prow");
    if (r) {
      if (!isWide()) closePanel();
      focusPlot(+r.dataset.no, true);
    }
  });
  panel.addEventListener("pointerover", e => {
    const r = e.target.closest(".prow");
    svg.querySelectorAll(".plot.is-hover").forEach(el => el.classList.remove("is-hover"));
    if (r) plotEls[r.dataset.no].classList.add("is-hover");
  });
  panel.addEventListener("pointerleave", () => svg.querySelectorAll(".plot.is-hover").forEach(el => el.classList.remove("is-hover")));
  document.getElementById("clear-filters").addEventListener("click", () => {
    F.q = ""; qInput.value = "";
    Object.keys(ALL).forEach(g => { ALL[g].forEach(x => F[g].add(x)); syncChips(g); });
    applyFilters();
  });
  document.getElementById("f-units").addEventListener("click", e => {
    const b = e.target.closest("button"); if (!b) return;
    document.querySelectorAll("#f-units button").forEach(x => x.setAttribute("aria-pressed", String(x === b)));
    const u = b.dataset.u;
    document.body.classList.toggle("hide-dims", u === "off");
    if (u !== "off") {
      units = u;
      svg.querySelectorAll(".p-dim").forEach(t => (t.textContent = dimText(+t.dataset.m, !!t.dataset.est)));
      svg.querySelectorAll(".p-area").forEach(t => (t.textContent = areaText(byNo[t.dataset.area])));
    }
    apply();
  });
  document.getElementById("f-survey").addEventListener("click", e => {
    const b = e.target.closest("button"); if (!b) return;
    document.querySelectorAll("#f-survey button").forEach(x => x.setAttribute("aria-pressed", String(x === b)));
    document.body.classList.toggle("hide-survey", b.dataset.s === "off");
  });

  const qInput = document.getElementById("q");
  qInput.addEventListener("input", () => {
    F.q = qInput.value.replace(/\D/g, "");
    applyFilters();
    if (byNo[F.q]) focusPlot(+F.q, false);
  });
  qInput.addEventListener("keydown", e => {
    if (e.key === "Enter" && byNo[F.q]) { e.preventDefault(); if (!isWide()) closePanel(); focusPlot(+F.q, true); }
  });

  const matches = p => F.status.has(p.status) && F.facing.has(p.facing) && F.size.has(p.type) && (!F.q || String(p.no).startsWith(F.q));
  function applyFilters() {
    const list = PLOTS.filter(matches);
    const ids = new Set(list.map(p => p.no));
    Object.entries(plotEls).forEach(([no, el]) => el.classList.toggle("dim", !ids.has(+no)));
    const filtered = list.length !== PLOTS.length;
    document.getElementById("results-head").innerHTML = filtered ? `<b>${list.length}</b> of 61 plots match` : `All <b>61</b> plots`;
    document.getElementById("clear-filters").hidden = !filtered;
    document.getElementById("results").innerHTML = list.length ? list.map(p => {
      const m = STATUS_META[p.status], price = priceOf(p);
      return `<button type="button" class="prow" data-no="${p.no}" style="--c:${m.color}">
        <span class="pno">${p.no}</span>
        <span class="pmeta"><b>${sizeLabel(p)} · ${p.facing}${p.corner ? " · Corner" : ""}</b><small>${approx(p)}${nf0.format(p.area * SQFT)} sq.ft · ${p.area.toFixed(2)} m²${price && p.status === "available" ? " · " + inr(price) : ""}</small></span>
        <span class="pst">${m.label}</span>
      </button>`;
    }).join("") : `<div class="empty">No plots match these filters.<br>Try another status, facing or size.</div>`;
  }
  applyFilters();

  const fab = document.getElementById("panel-open");
  function setPanel(open, animate = true) {
    panel.classList.toggle("open", open);
    fab.hidden = open;
    fab.setAttribute("aria-expanded", String(open));
    stage.classList.toggle("panel-docked", open && isWide());
    const pl = panelPad();
    if (animate) animateTo({ pl, z: Math.abs(view.z - fitZoom(view.tilt, view.rot, view.pl)) < 0.01 ? fitZoom(view.tilt, view.rot, pl) : view.z }, 300);
    else { view.pl = pl; }
  }
  const openPanel = () => setPanel(true);
  const closePanel = () => setPanel(false);
  fab.addEventListener("click", openPanel);
  document.getElementById("panel-close").addEventListener("click", closePanel);

  /* Legend */
  document.getElementById("legend").insertAdjacentHTML("beforeend", Object.entries(STATUS_META).filter(([k]) => k !== "na" || counts.na).map(([k, m]) =>
    `<span class="item" style="color:${m.color}"><i class="dot" style="background:${m.color}"></i><span style="color:var(--panel-fg)">${m.label}</span><span class="n">${counts[k] || 0}</span></span>`).join(""));

  /* Focus plot on map */
  let focused = null;
  function markFocus(no) {
    if (focused) focused.classList.remove("is-focus", "pulse");
    focused = plotEls[no];
    focused.classList.add("is-focus");
    void focused.getBoundingClientRect();
    focused.classList.add("pulse");
  }
  function focusPlot(no, open) {
    const p = byNo[no]; if (!p) return;
    markFocus(no);
    animateTo({ cx: p.c[0], cy: p.c[1], z: Math.max(view.z, fitZoom() * 2.6, DIMS_MIN_Z * 1.2) }, 700);
    if (open) setTimeout(() => openPlot(no), reduceMotion ? 0 : 520);
  }

  /* ================= Plot Detail Modal ================= */
  const ICONS = {
    close: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M6 6l12 12M18 6 6 18"/></svg>`,
    prev: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="m15 6-6 6 6 6"/></svg>`,
    next: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="m9 6 6 6-6 6"/></svg>`,
    link: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M10 13a5 5 0 0 0 7.5.5l3-3a5 5 0 0 0-7-7l-1.7 1.7"/><path d="M14 11a5 5 0 0 0-7.5-.5l-3 3a5 5 0 0 0 7 7l1.7-1.7"/></svg>`,
    sold: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="4.5" y="10.5" width="15" height="10" rx="2.5"/><path d="M8 10.5V7.5a4 4 0 0 1 8 0v3"/></svg>`,
    booked: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M6.5 3.5h11v17l-5.5-4-5.5 4z"/></svg>`,
    na: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><circle cx="12" cy="12" r="8.5"/><path d="M6 6l12 12"/></svg>`,
    ok: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m5 12.5 4.5 4.5L19 7.5"/></svg>`,
    phone: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1.9.4 1.8.7 2.7a2 2 0 0 1-.5 2.1L8 9.8a16 16 0 0 0 6 6l1.3-1.3a2 2 0 0 1 2.1-.4c.9.3 1.8.6 2.7.7a2 2 0 0 1 1.7 2z"/></svg>`,
    chat: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 11.5a8.4 8.4 0 0 1-12.4 7.4L3 21l2.1-5.4A8.5 8.5 0 1 1 21 11.5z"/></svg>`,
    sketch: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><rect x="4" y="4" width="16" height="16" rx="2"/><path d="M4 10h16M10 4v16"/></svg>`
  };
  const MSG = {
    sold: `This plot is <em>Sold</em>. Please check other available plots highlighted in bright green on the layout plan.`,
    booked: `This plot is currently <em>Booked</em>. Please explore other available plots marked in green on the layout plan.`,
    na: `This plot is <em>Not available</em> for sale right now. Please choose one of the plots marked in green.`
  };
  const root = document.getElementById("modal-root");
  let lastFocus = null, openNo = null;

  function sidesOf(p) {
    const out = {};
    p.edges.forEach(e => {
      const o = out[e.side] || (out[e.side] = { m: 0, est: false });
      o.m += e.m; o.est = o.est || e.est;
    });
    return out;
  }

  function sketchSVG(p) {
    const rot = ([x, y]) => [-y, x];
    const pts = p.pts.map(rot);
    const W = 340, H = 290, pad = 64;
    const xs = pts.map(q => q[0]), ys = pts.map(q => q[1]);
    const bw = Math.max(...xs) - Math.min(...xs), bh = Math.max(...ys) - Math.min(...ys);
    const s = Math.min((W - 2 * pad) / bw, (H - 2 * pad) / bh);
    const ox = (W - bw * s) / 2 - Math.min(...xs) * s, oy = (H - bh * s) / 2 - Math.min(...ys) * s + 12;
    const P = pts.map(q => [q[0] * s + ox, q[1] * s + oy]);
    let road = "", labels = "";
    p.edges.forEach((e, i) => {
      const a = P[i], b = P[(i + 1) % P.length];
      const L = dist(a, b), dx = (b[0] - a[0]) / L, dy = (b[1] - a[1]) / L;
      const nx = dy, ny = -dx; // outward
      if (p.roads.includes(e.side)) {
        const q = [[a[0] + nx * 26, a[1] + ny * 26], [b[0] + nx * 26, b[1] + ny * 26], [b[0] + nx * 48, b[1] + ny * 48], [a[0] + nx * 48, a[1] + ny * 48]];
        road += `<polygon points="${ptsAttr(q)}" fill="#2f3337"/><line x1="${(a[0] + nx * 37).toFixed(1)}" y1="${(a[1] + ny * 37).toFixed(1)}" x2="${(b[0] + nx * 37).toFixed(1)}" y2="${(b[1] + ny * 37).toFixed(1)}" stroke="#f3efe2" stroke-width="1" stroke-dasharray="6 6" opacity=".6"/>`;
      }
      if (!e.m) return;
      let ang = Math.atan2(dy, dx) * 180 / Math.PI;
      if (ang > 90.5 || ang <= -89.5) ang += 180;
      const mx = (a[0] + b[0]) / 2 + nx * 13, my = (a[1] + b[1]) / 2 + ny * 13;
      labels += `<g transform="translate(${mx.toFixed(1)} ${my.toFixed(1)}) rotate(${ang.toFixed(1)})"><text text-anchor="middle" dominant-baseline="central" font-family="JetBrains Mono, monospace" font-size="10.5" font-weight="700" fill="#e9efe9">${e.est ? "≈" : ""}${ftIn(e.m)}</text></g>`;
    });
    const c = centroid(P);
    const nfs = Math.max(14, Math.min(28, Math.min(bw, bh) * s * 0.36));
    return `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Sketch of plot ${p.no} with side lengths">
      ${road}
      <polygon points="${ptsAttr(P)}" fill="var(--sketch-paper)" stroke="var(--sketch-ink)" stroke-width="2" stroke-linejoin="round"/>
      <polygon points="${ptsAttr(P.map(q => [q[0] + (c[0] - q[0]) * 0.06, q[1] + (c[1] - q[1]) * 0.06]))}" fill="none" stroke="var(--sketch-ink)" stroke-width=".6" opacity=".35"/>
      ${labels}
      <text x="${c[0].toFixed(1)}" y="${(c[1] + nfs * 0.35).toFixed(1)}" text-anchor="middle" font-family="Outfit, sans-serif" font-size="${nfs.toFixed(1)}" font-weight="700" fill="var(--sketch-num)">${p.no}</text>
    </svg>`;
  }
  function compassSmall(facing) {
    const ang = { North: 0, East: 90, South: 180, West: 270 }[facing];
    return `<svg viewBox="0 0 26 26"><circle cx="13" cy="13" r="11.5" fill="none" stroke="rgba(255,255,255,.25)"/><text x="13" y="6.4" text-anchor="middle" font-size="5" font-weight="800" fill="#fff" font-family="Outfit, sans-serif">N</text><g transform="rotate(${ang} 13 13)"><path d="M13 7.5 L16 15 L13 13.4 L10 15 Z" fill="var(--st-available)"/></g></svg>`;
  }
  function cardTools(p) {
    return `<div class="card-tools">
      <button type="button" data-nav="${p.no - 1}" ${p.no <= 1 ? "disabled" : ""} aria-label="Previous plot">${ICONS.prev}</button>
      <button type="button" data-nav="${p.no + 1}" ${p.no >= PLOTS.length ? "disabled" : ""} aria-label="Next plot">${ICONS.next}</button>
      <button type="button" data-copy aria-label="Copy link to this plot" title="Copy link">${ICONS.link}</button>
      <button type="button" data-close aria-label="Close">${ICONS.close}</button>
    </div>`;
  }
  function contactButtons(p) {
    const ct = CFG.contact || {};
    const text = encodeURIComponent(`Hi, I'm interested in Plot ${p.no} (${sizeLabel(p)}, ${p.facing} facing) in ${CFG.project || "Plan-8 Layout"}.`);
    let s = "";
    if (ct.phone) s += `<a class="btn ghost" href="tel:${ct.phone.replace(/[^\d+]/g, "")}">${ICONS.phone}${escapeHTML(ct.phone)}</a>`;
    if (ct.whatsapp) s += `<a class="btn ghost" href="https://wa.me/${ct.whatsapp.replace(/\D/g, "")}?text=${text}" target="_blank" rel="noopener">${ICONS.chat}WhatsApp</a>`;
    return s ? `<div class="btn-row">${s}</div>` : "";
  }

  function setHash(no) {
    try { history.replaceState(null, "", no ? `#plot-${no}` : location.pathname + location.search); } catch (_) { /* sandboxed */ }
  }

  function openPlot(no) {
    const p = byNo[no];
    if (!p) return;
    hideTip();
    if (!root.firstChild) lastFocus = document.activeElement;
    openNo = no;
    markFocus(no);
    setHash(no);
    const meta = STATUS_META[p.status];
    const sqft = p.area * SQFT;
    const price = priceOf(p);
    let html;
    if (p.status !== "available") {
      html = `<div class="card locked" style="--c:${meta.color}">
          ${cardTools(p)}
          <div class="card-in">
            <div class="lock-ico">${ICONS[p.status]}</div>
            <span class="sbadge">${meta.label}</span>
            <h2 class="ptitle" id="m-title">Plot ${p.no}</h2>
            <p class="msg">${MSG[p.status]}</p>
            <div class="minispec">
              <div><span>Size</span><b>${sizeLabel(p)}</b></div>
              <div><span>Area</span><b>${approx(p)}${nf0.format(sqft)} sq.ft</b></div>
              <div><span>Facing</span><b>${p.facing}</b></div>
            </div>
            <button type="button" class="btn" data-close>Back to layout plan</button>
            <button type="button" class="linkbtn" data-only-available>Show only available plots</button>
          </div>
        </div>`;
    } else {
      const sides = sidesOf(p);
      const sideCells = ["North", "South", "East", "West"].map(s => !sides[s] ? "" :
        `<div class="side${p.roads.includes(s) ? " road" : ""}"><span>${s}${p.roads.includes(s) ? " · road" : ""}</span><b>${sides[s].est ? "≈" : ""}${ftIn(sides[s].m)}</b><small>${sides[s].m.toFixed(2)} m${sides[s].est ? " · measured" : ""}</small></div>`).join("");
      const roadsTxt = p.corner ? `Corner plot · roads on ${p.roads.join(" & ")}` : `${p.facing} facing`;
      html = `<div class="card" style="--c:${meta.color}">
          ${cardTools(p)}
          <div class="card-in" id="detail">
            <div>
              <span class="sbadge">${meta.label}</span>
              <h2 class="ptitle" id="m-title" style="margin-top:12px">Plot ${p.no}</h2>
              <p class="psub">${sizeLabel(p)} · ${roadsTxt}</p>
              ${price ? `<div class="price"><b>${inr(price)}</b><span>${CFG.prices && CFG.prices[p.no] != null ? "" : `at ₹${nf0.format(CFG.pricePerSqft)}/sq.ft${p.corner && CFG.cornerPremiumPct ? ` + ${CFG.cornerPremiumPct}% corner` : ""}`}</span></div>` : ""}
            </div>
            <div class="sketch">
              <span class="sketch-tag">${ICONS.sketch} Plot ${p.no} sketch</span>
              ${sketchSVG(p)}
              <div class="facing-chip">${compassSmall(p.facing)}<div><span>Facing</span><b>${p.facing}</b></div></div>
            </div>
            <div class="stats">
              <div class="stat"><span>Facing</span><b>${p.facing}</b><small>${p.corner ? "Corner plot" : "Road on " + p.facing.toLowerCase() + " side"}</small></div>
              <div class="stat"><span>Area (sq.ft)</span><b>${approx(p)}${nf0.format(sqft)}</b><small>${nf2.format(p.area)} m²</small></div>
              <div class="stat"><span>Area (cents)</span><b>${approx(p)}${(p.area / CENT).toFixed(2)}</b><small>${(p.area / GUNTA).toFixed(2)} guntas</small></div>
            </div>
            <div class="sides">
              <div class="sides-head"><b>Boundary side dimensions</b><span>Feet &amp; inches</span></div>
              <div class="sides-grid">${sideCells}</div>
            </div>
            ${p.approx ? `<p class="note">Odd-shaped site: side lengths are as written on the approved plan${p.edges.some(e => e.est) ? " (≈ marks a side with no written figure, measured from the drawing)" : ""}. Area is measured from the plan drawing.</p>` : ""}
            <button type="button" class="btn solid" data-enquire>Enquire now</button>
            ${contactButtons(p)}
          </div>
        </div>`;
    }
    root.innerHTML = `<div class="modal" id="modal" role="dialog" aria-modal="true" aria-labelledby="m-title">${html}</div>`;
    zoomHint.hidden = true;
    const card = root.querySelector(".card");
    card.tabIndex = -1;
    card.focus({ preventScroll: true });
  }

  function enquiryForm(p) {
    const plotTxt = p ? `Plot ${p.no} (${sizeLabel(p)}, ${p.facing} facing)` : "a plot";
    return `<div>
        <span class="sbadge">Enquiry</span>
        <h2 class="ptitle" id="m-title" style="margin-top:12px">${p ? `Plot ${p.no}` : escapeHTML(CFG.project || "Plan-8 Layout")}</h2>
        <p class="psub">${p ? `${sizeLabel(p)} · ${p.facing} facing · ${approx(p)}${nf0.format(p.area * SQFT)} sq.ft` : "Tell us what you're looking for and we'll get back to you."}</p>
      </div>
      <form class="form" id="enq" novalidate>
        ${p ? `<input type="hidden" name="plot" value="${p.no}">` : `<label for="enq-plot">Plot number (optional)<input id="enq-plot" name="plot" inputmode="numeric" placeholder="e.g. 24"></label>`}
        <label for="enq-name">Your name<input id="enq-name" name="name" autocomplete="name" required placeholder="John Doe"></label>
        <label for="enq-phone">Phone number<input id="enq-phone" name="phone" type="tel" inputmode="tel" autocomplete="tel" required placeholder="+91 98450 00000"></label>
        <label for="enq-msg">Message<textarea id="enq-msg" name="message">I'm interested in ${plotTxt}. Please share the price and site visit options.</textarea></label>
        <p class="err" id="enq-err" role="alert"></p>
        <button class="btn solid" type="submit">Send enquiry</button>
        ${CFG.enquiryEndpoint ? "" : `<p class="note" style="text-align:center">Demo mode: set <code>enquiryEndpoint</code> in config.js to receive enquiries.</p>`}
      </form>`;
  }

  function openEnquiry(p) {
    if (!root.firstChild) lastFocus = document.activeElement;
    if (!root.firstChild || !document.getElementById("detail")) {
      root.innerHTML = `<div class="modal" id="modal" role="dialog" aria-modal="true" aria-labelledby="m-title"><div class="card" style="--c:var(--st-available)"><div class="card-tools"><button type="button" data-close aria-label="Close">${ICONS.close}</button></div><div class="card-in" id="detail"></div></div></div>`;
    }
    const box = document.getElementById("detail");
    box.innerHTML = enquiryForm(p);
    zoomHint.hidden = true;
    const form = document.getElementById("enq");
    document.getElementById("enq-name").focus();
    form.addEventListener("submit", async e => {
      e.preventDefault();
      const data = Object.fromEntries(new FormData(form));
      const err = document.getElementById("enq-err");
      if (!data.name.trim()) { err.textContent = "Enter your name so we know who to call."; return; }
      if (data.phone.replace(/\D/g, "").length < 10) { err.textContent = "Enter a phone number with at least 10 digits."; return; }
      const btn = form.querySelector('button[type="submit"]');
      btn.disabled = true; btn.textContent = "Sending…";
      const sent = await sendEnquiry({ ...data, project: CFG.project, page: location.href.split("#")[0] });
      if (sent === false) {
        btn.disabled = false; btn.textContent = "Send enquiry";
        err.textContent = "The enquiry couldn't be sent. Check your connection or configuration.";
        return;
      }
      box.innerHTML = `<div class="done">
        <div class="lock-ico" style="--c:var(--st-available)">${ICONS.ok}</div>
        <span class="sbadge" style="justify-self:center">${sent ? "Enquiry sent" : "Demo mode"}</span>
        <h2 class="ptitle" id="m-title">Thanks, ${escapeHTML(data.name.trim().split(" ")[0])}!</h2>
        <p class="psub">${sent ? `We'll call you on ${escapeHTML(data.phone)}${data.plot ? ` about Plot ${escapeHTML(data.plot)}` : ""}.` : "This enquiry was recorded in demo mode. Set enquiryEndpoint in config.js to route to your backend."}</p>
        <button type="button" class="btn" data-close style="margin-top:8px">Back to layout plan</button>
      </div>`;
    });
  }

  // Returns true when sent, null in demo mode, false on network failure
  async function sendEnquiry(payload) {
    if (!CFG.enquiryEndpoint) { console.info("[Enquiry - Demo Mode]", payload); return null; }
    try {
      const res = await fetch(CFG.enquiryEndpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify(payload)
      });
      return res.ok;
    } catch (_) {
      // If local preview doesn't run backend, fallback gracefully to demo mode log
      console.warn("Could not reach endpoint, falling back to local demo response", payload);
      return null;
    }
  }

  async function copyLink(no) {
    const url = `${location.href.split("#")[0]}#plot-${no}`;
    try { await navigator.clipboard.writeText(url); toast(`Link to Plot ${no} copied`); }
    catch (_) { toast(url); }
  }

  root.addEventListener("click", e => {
    const modal = document.getElementById("modal");
    if (!modal) return;
    if (e.target === modal || e.target.closest("[data-close]")) return closeModal();
    if (e.target.closest("[data-only-available]")) { closeModal(); onlyAvailable(); return; }
    if (e.target.closest("[data-enquire]")) return openEnquiry(byNo[openNo]);
    if (e.target.closest("[data-copy]")) return copyLink(openNo);
    const nav = e.target.closest("[data-nav]");
    if (nav && !nav.disabled) {
      const no = +nav.dataset.nav, p = byNo[no];
      openPlot(no);
      animateTo({ cx: p.c[0], cy: p.c[1] }, 500);
    }
  });
  document.getElementById("btn-enquire").addEventListener("click", () => openEnquiry(null));

  function closeModal() {
    root.innerHTML = "";
    openNo = null;
    setHash(null);
    apply();
    if (lastFocus && lastFocus.focus) lastFocus.focus({ preventScroll: true });
  }
  function onlyAvailable() {
    F.status = new Set(["available"]);
    syncChips("status");
    applyFilters();
    openPanel();
  }
  document.addEventListener("keydown", e => {
    if (!root.firstChild) return;
    if (e.key === "Escape") closeModal();
    if (openNo && !e.target.closest("input, textarea") && (e.key === "ArrowLeft" || e.key === "ArrowRight")) {
      const no = openNo + (e.key === "ArrowLeft" ? -1 : 1);
      if (byNo[no]) { openPlot(no); animateTo({ cx: byNo[no].c[0], cy: byNo[no].c[1] }, 500); }
    }
    if (e.key === "Tab") {
      const f = [...root.querySelectorAll("button, input, textarea, a[href]")].filter(x => !x.disabled);
      if (!f.length) return;
      const first = f[0], last = f[f.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    }
  });

  /* ================= Startup ================= */
  const project = CFG.project || "Plan-8 Layout";
  document.getElementById("proj-title").textContent = project;
  if (CFG.subtitle) document.getElementById("proj-sub").textContent = CFG.subtitle;
  document.title = `${project} · Interactive 3D Plot Layout`;

  layout();
  setPanel(isWide(), false);
  view.z = fitZoom();
  apply();
  syncModeBtn();
  let resizeTimer = null;
  window.addEventListener("resize", () => {
    layout();
    stage.classList.toggle("panel-docked", panel.classList.contains("open") && isWide());
    view.pl = panelPad();
    apply();
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => { if (view.z < minZ()) { view.z = minZ(); apply(); } }, 150);
  });

  // Deep links: #plot-24 opens that plot
  function fromHash() {
    const m = /^#plot-(\d+)$/.exec(location.hash);
    if (m && byNo[m[1]]) focusPlot(+m[1], true);
  }
  window.addEventListener("hashchange", fromHash);
  fromHash();
})();
