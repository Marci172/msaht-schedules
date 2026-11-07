"use strict";
const esc = s => String(s ?? "").replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const num = v => v == null ? "–" : Number(v).toLocaleString("en-US");
const NAT = new Intl.Collator("en", { numeric: true });  // (instance names in number order: dmu9 < dmu41, tai_.._2 < tai_.._10)
const secs = (t, exact) => t == null ? "–" : (exact ? "" : "≤ ") + (t < 10 ? t.toFixed(1) : Math.round(t).toLocaleString("en-US")) + " s";
const gpuName = s => (s || "").split(" · ")[0].replace(/ \(\d+ GB\)/, "");
const VERDICT = { "improves the best known value": ["improves", "below best known"],
                  "equals the best known value": ["equals", "best known"],
                  "above the best known value": ["above", "above best known"] };

// ---------------------------------------------------------------- index page
// (v: the build stamp, appended to every data URL: GitHub Pages lets browsers cache files for 10 minutes, and old data
// with a new script showed empty columns)
async function siteIndex(v) {
  const data = await (await fetch(`data/index.json?v=${v}`)).json();
  const rows = data.rows;
  const cnt = k => rows.filter(r => VERDICT[r.verdict] && VERDICT[r.verdict][0] === k).length;
  document.getElementById("tiles").innerHTML = [["instances", rows.length], ["below best known", cnt("improves")],
    ["equal to best known", cnt("equals")], ["above best known", cnt("above")]]
    .map(([k, val]) => `<div class="tile"><div class="k">${k}</div><div class="v">${val}</div></div>`).join("");
  // one card per family, stacked; the search and the result filter apply to all of them, each card sorts on its own
  const ORDER = ["Fisher, Thompson", "Lawrence", "Adams, Balas, Zawack", "Applegate, Cook", "Storer, Wu, Vaccari",
                 "Yamada, Nakano", "Taillard", "Demirkol", "Da Col & Teppan (tai)"];
  const fams = [...new Set(rows.map(r => r.family))]
    .sort((a, b) => ((ORDER.indexOf(a) + 1) || 99) - ((ORDER.indexOf(b) + 1) || 99) || a.localeCompare(b));
  document.getElementById("foot").insertAdjacentHTML("beforeend", ` Generated ${esc(data.generated)}.`);
  // (two lines per cell, so everything fits without scrolling sideways; a header sorts by its cell's first line)
  const cols = [["instance", "instance", ""], ["makespan", "makespan", "n"], ["gap", "result", ""],
                ["time_to_best", "time to best", "n"], ["system", "run", ""], ["date", "date", ""]];
  const st = { q: "", ver: "" };
  const box = document.getElementById("fams");
  const cards = fams.map((f, i) => {
    const mine = rows.filter(r => r.family === f);
    const c = k => mine.filter(r => (VERDICT[r.verdict] || [])[0] === k).length;
    const parts = [["improves", "below"], ["equals", "equal"], ["above", "above"]].filter(([k]) => c(k))
      .map(([k, t]) => `<span class="${k}">${c(k)} ${t}</span>`).join(" · ");
    box.insertAdjacentHTML("beforeend", `<section class="card fam" id="fam${i}">
      <div class="fhead"><h2>${esc(f)}</h2><span class="fsum">${mine.length} instance${mine.length > 1 ? "s" : ""} · ${parts}</span></div>
      <div class="tbox"><table><thead><tr>${cols.map(([k, t, cl]) => `<th data-k="${k}" class="${cl}">${t}</th>`).join("")}<th></th></tr></thead>
      <tbody></tbody></table></div></section>`);
    const el = document.getElementById(`fam${i}`);
    return { el, mine, sort: null, dir: 1 };
  });
  const row = r => {
    const [cls, label] = VERDICT[r.verdict] || ["", "–"];
    const name = r.gantt ? `<a href="schedule.html?i=${encodeURIComponent(r.instance)}">${esc(r.instance)}</a>` : esc(r.instance);
    const gap = r.gap == null ? "–" : (r.gap > 0 ? "+" : "") + r.gap.toFixed(2) + " %";
    const tt = r.time_exact ? "when the run first reached this makespan"
                            : "first checkpoint of the run that shows it (the exact time was not recorded)";
    return `<tr><td>${name}<div class="sub">${r.jobs} × ${r.machines}</div></td>`
      + `<td class="n">${num(r.makespan)}<div class="sub">best known ${num(r.ub)} · LB ${num(r.lb)}</div></td>`
      + `<td><span class="chip ${cls}">${label}</span><div class="sub">gap ${gap}</div></td>`
      + `<td class="n" title="${tt}">${secs(r.time_to_best, r.time_exact)}<div class="sub">of ${secs(r.run_seconds, true)}</div></td>`
      + `<td title="${esc(r.system)}&#10;${esc(r.solver)}">${esc(gpuName(r.system))}<div class="sub">${esc(r.solver_short || r.solver)}</div></td>`
      + `<td>${esc(r.date)}</td>`
      + `<td class="dl"><a href="instances/${encodeURIComponent(r.instance)}.txt" download title="the instance: jobs and machines, then per job machine / duration pairs (machines from 0)">instance</a>`
      + `<div class="sub"><a href="solutions/${encodeURIComponent(r.instance)}.json" download title="schedule in ScheduleOpt's format">schedule</a></div></td></tr>`;
  };
  const fill = () => {
    const q = st.q.toLowerCase();
    let shown = 0;
    for (const c of cards) {
      let list = c.mine.filter(r => (!q || r.instance.toLowerCase().includes(q)) && (!st.ver || (VERDICT[r.verdict] || [])[0] === st.ver));
      if (c.sort) {
        const key = r => r[c.sort];
        list = list.slice().sort((a, b) => {
          if (c.sort === "instance") return NAT.compare(a.instance, b.instance) * c.dir;  // (dmu41 .. dmu80, ta01 .. ta80)
          const x = key(a), y = key(b); if (x == null) return 1; if (y == null) return -1;
          return (x < y ? -1 : x > y ? 1 : 0) * c.dir; });
      }
      c.el.hidden = list.length === 0;
      c.el.querySelector("tbody").innerHTML = list.map(row).join("");
      c.el.querySelectorAll("th[data-k]").forEach(th => th.textContent = th.textContent.replace(/ [▲▼]$/, "")
        + (c.sort === th.dataset.k ? (c.dir > 0 ? " ▲" : " ▼") : ""));
      shown += list.length;
    }
    document.getElementById("count").textContent = `${shown} of ${rows.length}`;
  };
  siteSjs(v);
  document.getElementById("q").addEventListener("input", e => { st.q = e.target.value; fill(); });
  document.getElementById("ver").addEventListener("change", e => { st.ver = e.target.value; fill(); });
  for (const c of cards) c.el.querySelectorAll("th[data-k]").forEach(th => th.addEventListener("click", () => {
    c.dir = c.sort === th.dataset.k ? -c.dir : 1; c.sort = th.dataset.k; fill(); }));
  fill();
}

// ---------------------------------------------------------------- SJS: our own instance set (downloads only)
// (an introduction card with the whole-set downloads, then one card per group listing every instance)
async function siteSjs(v) {
  let d;
  try { d = await (await fetch(`data/sjs.json?v=${v}`)).json(); } catch (e) { return; }
  const mb = b => b >= 1e6 ? (b / 1e6).toFixed(1) + " MB" : Math.max(1, Math.round(b / 1e3)) + " KB";
  const box = document.getElementById("sjs");
  box.innerHTML = `<section class="card"><div class="fhead"><h2>schweminOPT Job Shop Scaling set (SJS, 2026)</h2>`
    + `<span class="fsum">${d.instances} instances, 10 per size · no schedules yet</span></div>`
    + `<p class="lead">Our own instances for measuring solvers across sizes and shapes, from Taillard's generator: `
    + `every instance can be regenerated from its two seeds. Same text format as above (gzip-compressed from 50,000 `
    + `operations).</p><p class="links"><a href="sjs/SJS2026.zip" download>whole set (zip, ${mb(d.zip_bytes)})</a> · `
    + `<a href="sjs/sjs_seeds.csv" download>seeds</a> · <a href="sjs/checksums.sha256" download>checksums</a> · `
    + `<a href="sjs/README.md">README</a></p></section>`;
  for (const g of [...new Set(d.sizes.map(s => s.group))]) {
    const sizes = d.sizes.filter(s => s.group === g);
    const n = sizes.reduce((a, s) => a + s.files.length, 0);
    const rows = sizes.flatMap(s => s.files.map(f =>
      `<tr><td>${esc(f.name)}<div class="sub">${s.jobs} × ${s.machines}</div></td>`
      + `<td class="n">${num(s.operations)}<div class="sub">times 1..${s.dmax}</div></td>`
      + `<td class="n">${f.time_seed}<div class="sub">${f.machine_seed}</div></td>`
      + `<td class="dl"><a href="${esc(f.file)}" download>instance</a><div class="sub">${mb(f.bytes)}</div></td></tr>`)).join("");
    box.insertAdjacentHTML("beforeend", `<section class="card"><div class="fhead"><h2>SJS · ${esc(g)}</h2>`
      + `<span class="fsum">${n} instances · ${sizes.map(s => `${s.jobs} × ${s.machines}`).join(", ")}</span></div>`
      + `<div class="tbox"><table class="sjst"><thead><tr><th>instance</th><th class="n">operations</th>`
      + `<th class="n">time seed<div class="sub">machine seed</div></th><th>download</th></tr></thead>`
      + `<tbody>${rows}</tbody></table></div></section>`);
  }
}

// ---------------------------------------------------------------- schedule page (Gantt chart)
async function siteSchedule(v) {
  const inst = new URLSearchParams(location.search).get("i") || "";
  let d;
  try { d = await (await fetch(`data/${encodeURIComponent(inst)}.json?v=${v}`)).json(); }
  catch (e) { document.getElementById("title").textContent = `no schedule for "${inst}"`; return; }
  document.title = `${d.instance} Schedule`;
  const [cls, label] = VERDICT[d.verdict] || ["", ""];
  document.getElementById("title").innerHTML = `${esc(d.instance)} <span class="chip ${cls}" style="font-size:.8rem;vertical-align:middle">${label}</span>`;
  document.getElementById("sub").textContent = `${d.solver}. System: ${d.system}.${d.date ? " Run of " + d.date + "." : ""}`;
  const crit = d.ops.reduce((n, o) => n + o[5], 0);
  document.getElementById("info").innerHTML = [`makespan ${num(d.makespan)}`, `best known ${num(d.ub)}`, `lower bound ${num(d.lb)}`,
    d.gap == null ? "" : `gap ${(d.gap > 0 ? "+" : "") + d.gap.toFixed(2)} %`,
    `time to best ${secs(d.time_to_best, d.time_exact)}`, `run ${secs(d.run_seconds, true)}`, `${d.jobs} jobs × ${d.machines} machines`,
    `${num(d.operations)} operations`, `${num(crit)} critical`,
    `<a href="instances/${encodeURIComponent(d.instance)}.txt" download>instance (.txt)</a>`,
    `<a href="solutions/${encodeURIComponent(d.instance)}.json" download>schedule (ScheduleOpt format)</a>`]
    .filter(Boolean).map(x => `<span>${x.startsWith("<a") ? x : esc(x)}</span>`).join("");
  const G = { job: null, bars: [] };
  const cv = document.getElementById("gc"), box = document.getElementById("gbox"), tip = document.getElementById("tip");
  const draw = () => {
    const css = getComputedStyle(document.documentElement), col = n => css.getPropertyValue(n).trim();
    const left = 46, right = 12, top = 24, rowH = Math.max(5, Math.min(26, Math.floor(620 / d.machines)));
    const W = Math.max(640, box.clientWidth - 2), H = top + rowH * d.machines + 8, dpr = window.devicePixelRatio || 1;
    cv.width = W * dpr; cv.height = H * dpr; cv.style.width = W + "px"; cv.style.height = H + "px";
    const ctx = cv.getContext("2d"); ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const sx = (W - left - right) / d.makespan, x = t => left + t * sx;
    ctx.fillStyle = col("--surface"); ctx.fillRect(0, 0, W, H);
    ctx.font = "11px " + col("--mono"); ctx.textBaseline = "middle";
    const raw = d.makespan / 10, mag = 10 ** Math.floor(Math.log10(raw)), step = [1, 2, 5, 10].map(f => f * mag).find(v => v >= raw);
    ctx.strokeStyle = col("--line"); ctx.fillStyle = col("--muted"); ctx.lineWidth = 1;
    for (let t = 0; t <= d.makespan; t += step) {
      ctx.beginPath(); ctx.moveTo(Math.round(x(t)) + .5, top - 4); ctx.lineTo(Math.round(x(t)) + .5, H - 8); ctx.stroke();
      ctx.textAlign = "center"; ctx.fillText(t.toLocaleString("en-US"), x(t), 11);
    }
    ctx.textAlign = "right";
    for (let m = 0, every = Math.ceil(12 / rowH); m < d.machines; m += every) ctx.fillText("M" + m, left - 6, top + m * rowH + rowH / 2);
    G.bars = [];
    const pad = rowH > 10 ? 2 : rowH > 6 ? 1 : 0;
    for (const o of d.ops) {
      const [j, k, m, s, du, c] = o;
      const bx = x(s), bw = Math.max(1, du * sx), by = top + m * rowH + pad, bh = rowH - 2 * pad;
      const sel = G.job === j, dim = G.job != null && !sel;
      ctx.globalAlpha = dim ? 0.22 : 1;
      ctx.fillStyle = col(sel ? "--g-job" : c ? "--g-crit" : "--g-op");
      ctx.fillRect(bx, by, Math.max(1, bw - (bw > 3 ? 1 : 0)), bh);
      ctx.globalAlpha = 1;
      G.bars.push([bx, by, bw, bh, o]);
    }
    ctx.strokeStyle = col("--bad"); ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.moveTo(x(d.makespan), top - 4); ctx.lineTo(x(d.makespan), H - 8); ctx.stroke();
  };
  const at = e => {
    const r = cv.getBoundingClientRect(), px = e.clientX - r.left, py = e.clientY - r.top;
    for (let i = G.bars.length - 1; i >= 0; i--) { const [bx, by, bw, bh, o] = G.bars[i];
      if (px >= bx && px <= bx + Math.max(bw, 2) && py >= by && py <= by + bh) return o; }
    return null;
  };
  cv.addEventListener("mousemove", e => {
    const o = at(e); if (!o) { tip.hidden = true; return; }
    const [j, k, m, s, du, c] = o;
    tip.textContent = `job ${j}, operation ${k}\nmachine ${m}\n${s} – ${s + du} (duration ${du})${c ? "\ncritical" : ""}`;
    tip.hidden = false; tip.style.left = (e.clientX + 14) + "px"; tip.style.top = (e.clientY + 12) + "px";
  });
  cv.addEventListener("mouseleave", () => { tip.hidden = true; });
  cv.addEventListener("click", e => { const o = at(e); G.job = o && G.job !== o[0] ? o[0] : null; draw(); });
  window.addEventListener("resize", draw);
  matchMedia("(prefers-color-scheme: dark)").addEventListener("change", draw);
  draw();
}
