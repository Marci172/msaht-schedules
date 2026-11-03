"use strict";
const esc = s => String(s ?? "").replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const num = v => v == null ? "–" : Number(v).toLocaleString("en-US");
const secs = (t, exact) => t == null ? "–" : (exact ? "" : "≤ ") + (t < 10 ? t.toFixed(1) : Math.round(t).toLocaleString("en-US")) + " s";
const gpuName = s => (s || "").split(" · ")[0].replace(/ \(\d+ GB\)/, "");
const VERDICT = { "improves the best known value": ["improves", "below best known"],
                  "equals the best known value": ["equals", "best known"],
                  "above the best known value": ["above", "above best known"] };

// ---------------------------------------------------------------- index page
async function siteIndex() {
  const data = await (await fetch("data/index.json")).json();
  const rows = data.rows;
  const cnt = k => rows.filter(r => VERDICT[r.verdict] && VERDICT[r.verdict][0] === k).length;
  document.getElementById("tiles").innerHTML = [["instances", rows.length], ["below best known", cnt("improves")],
    ["equal to best known", cnt("equals")], ["above best known", cnt("above")]]
    .map(([k, v]) => `<div class="tile"><div class="k">${k}</div><div class="v">${v}</div></div>`).join("");
  const fams = [...new Set(rows.map(r => r.family))];
  document.getElementById("fam").innerHTML += fams.map(f => `<option>${esc(f)}</option>`).join("");
  document.getElementById("foot").insertAdjacentHTML("beforeend", ` Generated ${esc(data.generated)}.`);
  const cols = [["instance", "instance"], ["size", "jobs × machines"], ["makespan", "our makespan", 1], ["ub", "best known", 1],
                ["lb", "lower bound", 1], ["gap", "gap", 1], ["verdict", "result"], ["time_to_best", "time to best", 1],
                ["run_seconds", "run", 1], ["system", "system"], ["solver", "solver"], ["date", "date"]];
  const st = { q: "", fam: "", ver: "", sort: null, dir: 1 };
  document.getElementById("head").innerHTML = cols.map(([k, t, n]) => `<th data-k="${k}" class="${n ? "n" : ""}">${t}</th>`).join("");
  const fill = () => {
    const q = st.q.toLowerCase();
    let list = rows.filter(r => (!q || r.instance.toLowerCase().includes(q)) && (!st.fam || r.family === st.fam)
      && (!st.ver || (VERDICT[r.verdict] || [])[0] === st.ver));
    if (st.sort) {
      const key = r => st.sort === "size" ? r.operations : r[st.sort];
      list = list.slice().sort((a, b) => { const x = key(a), y = key(b); if (x == null) return 1; if (y == null) return -1;
        return (x < y ? -1 : x > y ? 1 : 0) * st.dir; });
    }
    document.getElementById("rows").innerHTML = list.map(r => {
      const [cls, label] = VERDICT[r.verdict] || ["", "–"];
      const name = r.gantt ? `<a href="schedule.html?i=${encodeURIComponent(r.instance)}">${esc(r.instance)}</a>` : esc(r.instance);
      return `<tr><td>${name}</td><td>${r.jobs} × ${r.machines}</td><td class="n">${num(r.makespan)}</td><td class="n">${num(r.ub)}</td>`
        + `<td class="n">${num(r.lb)}</td><td class="n">${r.gap == null ? "–" : (r.gap > 0 ? "+" : "") + r.gap.toFixed(2) + " %"}</td>`
        + `<td><span class="chip ${cls}">${label}</span></td>`
        + `<td class="n" title="${r.time_exact ? "when the run first reached this makespan" : "first checkpoint of the run that shows it (the exact time was not recorded)"}">${secs(r.time_to_best, r.time_exact)}</td>`
        + `<td class="n">${secs(r.run_seconds, true)}</td><td title="${esc(r.system)}">${esc(gpuName(r.system))}</td>`
        + `<td>${esc(r.solver)}</td><td>${esc(r.date)}</td>`
        + `<td><a href="solutions/${encodeURIComponent(r.instance)}.json" download>solution</a></td></tr>`;
    }).join("");
    document.getElementById("count").textContent = `${list.length} of ${rows.length}`;
    document.querySelectorAll("#head th").forEach(th => th.textContent = th.textContent.replace(/ [▲▼]$/, "")
      + (st.sort === th.dataset.k ? (st.dir > 0 ? " ▲" : " ▼") : ""));
  };
  document.getElementById("head").insertAdjacentHTML("beforeend", "<th>download</th>");
  document.getElementById("q").addEventListener("input", e => { st.q = e.target.value; fill(); });
  document.getElementById("fam").addEventListener("change", e => { st.fam = e.target.value; fill(); });
  document.getElementById("ver").addEventListener("change", e => { st.ver = e.target.value; fill(); });
  document.querySelectorAll("#head th[data-k]").forEach(th => th.addEventListener("click", () => {
    st.dir = st.sort === th.dataset.k ? -st.dir : 1; st.sort = th.dataset.k; fill(); }));
  fill();
}

// ---------------------------------------------------------------- schedule page (Gantt chart)
async function siteSchedule() {
  const inst = new URLSearchParams(location.search).get("i") || "";
  let d;
  try { d = await (await fetch(`data/${encodeURIComponent(inst)}.json`)).json(); }
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
    `<a href="solutions/${encodeURIComponent(d.instance)}.json" download>download (ScheduleOpt format)</a>`]
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
