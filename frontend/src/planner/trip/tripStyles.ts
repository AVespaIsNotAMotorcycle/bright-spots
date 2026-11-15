// Trip planner styles, scoped under .tp so nothing leaks into other pages.
export const TRIP_CSS = `
.tp{--tp-gap:20px;display:grid;grid-template-columns:minmax(300px,360px) 1fr;gap:var(--tp-gap);align-items:start}
.tp *{box-sizing:border-box}
.tp-side{position:sticky;top:12px;max-height:calc(100vh - 24px);overflow:auto;display:flex;flex-direction:column;gap:18px;
  background:var(--surface);border:1px solid var(--border);border-radius:20px;padding:18px 18px 22px;box-shadow:var(--shadow-sm)}
.tp-main{display:flex;flex-direction:column;gap:18px;min-width:0}
.tp-h{font-size:11px;font-weight:800;letter-spacing:.12em;text-transform:uppercase;color:var(--rust);margin:0 0 8px;display:flex;justify-content:space-between;align-items:baseline;gap:8px}
.tp-h small{font-size:11px;letter-spacing:0;text-transform:none;font-weight:500;color:var(--text-muted)}
.tp-hero{border-radius:22px;padding:22px 24px;color:#fff;position:relative;overflow:hidden;
  background:none}
.tp-hero h1{margin:0;font-family:var(--font-display);font-size:34px;line-height:1.1}
.tp-hero p{margin:6px 0 14px;opacity:.85}
.tp-moods{display:flex;gap:8px;flex-wrap:wrap}
.tp-mood{flex:0 0 auto;border:1.5px solid rgba(255,255,255,.35);background:rgba(255,255,255,.12);color:#fff;border-radius:14px;
  padding:9px 14px;font:inherit;font-weight:700;font-size:14px;cursor:pointer;transition:background .15s,transform .15s}
.tp-mood:hover{background:rgba(255,255,255,.24);transform:translateY(-1px)}
.tp-mood[aria-pressed=true]{background:#f3c969;color:#261e14;border-color:#f3c969}
/* Months */
.tp-seasons{display:grid;grid-template-columns:repeat(4,1fr);gap:6px}
.tp-season{border:0;border-radius:12px 12px 4px 4px;padding:6px 4px;font:inherit;font-size:12px;font-weight:800;cursor:pointer}
.tp-months{display:grid;grid-template-columns:repeat(4,1fr);gap:6px;margin-top:6px}
.tp-month{border:1.5px solid transparent;border-radius:10px;padding:9px 0;font:inherit;font-size:13px;font-weight:600;cursor:pointer;transition:transform .1s}
.tp-month:hover{transform:translateY(-1px)}
.tp-month[aria-pressed=true]{box-shadow:inset 0 0 0 2px currentColor;font-weight:800}
.tp-note{font-size:12px;color:var(--text-muted);margin:6px 0 0;line-height:1.45}
/* Feel */
.tp-feels{display:grid;grid-template-columns:repeat(4,1fr);gap:6px}
.tp-feel{border:1.5px solid var(--border);background:var(--surface);border-radius:12px;padding:8px 2px;font:inherit;font-size:12px;
  font-weight:700;cursor:pointer;display:flex;flex-direction:column;align-items:center;gap:2px;color:var(--text)}
.tp-feel b{font-size:18px}
.tp-feel small{font-weight:500;color:var(--text-muted);font-size:10.5px}
.tp-feel[aria-pressed=true]{border-color:var(--pine);background:var(--pine-tint);color:var(--pine)}
/* Chips */
.tp-chips{display:flex;flex-wrap:wrap;gap:6px}
.tp-chip{border:1.5px solid var(--border);background:var(--surface);color:var(--text);border-radius:999px;padding:6px 11px;font:inherit;
  font-size:13px;font-weight:600;cursor:pointer;display:inline-flex;gap:6px;align-items:center;transition:background .12s,border-color .12s}
.tp-chip:hover{border-color:var(--pine)}
.tp-chip .lvl{font-size:9.5px;font-weight:800;text-transform:uppercase;letter-spacing:.06em;padding:1px 6px;border-radius:999px}
.tp-chip.nice{border-color:var(--pine);border-style:dashed;background:var(--pine-tint);color:var(--pine)}
.tp-chip.nice .lvl{background:var(--surface);color:var(--pine)}
.tp-chip.must{border-color:var(--pine);background:var(--pine);color:var(--on-pine)}
.tp-chip.must .lvl{background:#f3c969;color:#261e14}
.tp-chips.avoid .tp-chip.nice{border-color:var(--rust);background:var(--rust-tint);color:var(--rust)}
.tp-chips.avoid .tp-chip.must{border-color:var(--rust);background:var(--rust);color:var(--on-rust)}
.tp-chips.avoid .tp-chip:hover{border-color:var(--rust)}
.tp-src{font-size:9px;opacity:.65}
.tp-more summary{cursor:pointer;font-weight:700;font-size:13px;color:var(--pine)}
.tp-more[open] summary{margin-bottom:10px}
.tp-seg{display:inline-flex;border:1.5px solid var(--border);border-radius:999px;overflow:hidden}
.tp-seg button{border:0;background:none;padding:6px 12px;font:inherit;font-size:12.5px;font-weight:600;cursor:pointer;color:var(--text-muted)}
.tp-seg button[aria-pressed=true]{background:var(--pine);color:var(--on-pine)}
/* Results */
.tp-bar{display:flex;flex-wrap:wrap;gap:10px;align-items:center;justify-content:space-between}
.tp-count{font-family:var(--font-display);font-size:24px;font-weight:800;color:var(--pine);margin:0}
.tp-top3{display:grid;grid-template-columns:repeat(auto-fit,minmax(240px,1fr));gap:16px}
.tp-card{border:1px solid var(--border);background:var(--surface);border-radius:20px;overflow:hidden;display:flex;flex-direction:column;
  cursor:pointer;text-align:left;font:inherit;color:var(--text);padding:0;box-shadow:var(--shadow-sm);transition:transform .15s,box-shadow .15s}
.tp-card:hover,.tp-card:focus-visible{transform:translateY(-3px);box-shadow:var(--shadow-md)}
.tp-photo{height:150px;position:relative;background:#cfc3a8 center/cover no-repeat}
.tp-photo::after{content:"";position:absolute;inset:0;background:rgba(20,28,22,.32)}
.tp-medal{position:absolute;left:12px;top:10px;font-size:13px;font-weight:700;color:#fff;background:rgba(0,0,0,.5);padding:2px 9px;border-radius:999px;z-index:1}
.tp-name{position:absolute;left:14px;right:84px;bottom:10px;z-index:1;color:#fff;font-family:var(--font-display);font-weight:800;font-size:22px;line-height:1.1;text-shadow:0 2px 6px rgba(0,0,0,.5)}
.tp-name small{display:block;font-family:var(--font-body);font-size:12px;font-weight:600;opacity:.9}
.tp-ring{position:absolute;right:10px;bottom:8px;z-index:1}
.tp-body{padding:12px 14px 14px;display:flex;flex-direction:column;gap:10px;flex:1}
.tp-simple{flex-direction:row;align-items:center;justify-content:space-between;gap:10px}
.tp-reasons{list-style:none;margin:0;padding:0;display:flex;flex-direction:column;gap:3px;font-size:13px}
.tp-reasons li{display:flex;gap:6px;align-items:baseline}
.tp-ok{color:var(--pine);font-weight:800}
.tp-no{color:var(--rust);font-weight:800}
.tp-strip{display:grid;grid-template-columns:repeat(12,1fr);gap:2px}
.tp-strip span{height:16px;border-radius:3px;position:relative}
.tp-strip span.best{outline:2px solid #f3c969;outline-offset:1px;z-index:1}
.tp-strip span.pick::after{content:"";position:absolute;left:50%;bottom:-5px;width:4px;height:4px;margin-left:-2px;border-radius:50%;background:var(--text)}
.tp-axis{display:grid;grid-template-columns:repeat(12,1fr);font-size:9px;color:var(--text-muted);text-align:center;margin-top:3px}
.tp-badges{display:flex;gap:6px;flex-wrap:wrap}
.tp-badge{font-size:11.5px;font-weight:700;border-radius:999px;padding:3px 9px;background:var(--surface-2);color:var(--text)}
.tp-badge.warn{background:#f6dfcf;color:#7a2e10}
.tp-badge.case{background:#e4ead4;color:#2f5419}
.tp-actions{display:flex;gap:6px;flex-wrap:wrap;margin-top:auto}
.tp-act{border:1.5px solid var(--border);background:var(--surface);border-radius:999px;padding:5px 10px;font:inherit;font-size:12px;font-weight:700;cursor:pointer;color:var(--text)}
.tp-act:hover{border-color:var(--pine);color:var(--pine)}
.tp-act[aria-pressed=true]{background:var(--pine);border-color:var(--pine);color:var(--on-pine)}
.tp-why{border-radius:16px;padding:12px 16px;background:var(--paper);color:var(--bark);font-size:14.5px;line-height:1.5}
.tp-rows{display:flex;flex-direction:column;gap:8px}
.tp-row{display:grid;grid-template-columns:28px 54px 1fr auto auto;gap:12px;align-items:center;border:1px solid var(--border);background:var(--surface);
  border-radius:14px;padding:8px 12px 8px 8px;cursor:pointer;font:inherit;color:var(--text);text-align:left}
.tp-row:hover{border-color:var(--pine)}
.tp-row.off{opacity:.62}
.tp-row.plain{grid-template-columns:54px 1fr auto}
.tp-browse{display:grid;grid-template-columns:repeat(auto-fill,minmax(190px,1fr));gap:14px}
.tp-tile{position:relative;border:1px solid var(--border);border-radius:14px;overflow:hidden;background:var(--surface);cursor:pointer;color:var(--text)}
.tp-tile:hover,.tp-tile:focus-visible{border-color:var(--pine);box-shadow:var(--shadow-sm);outline:none}
.tp-tile img,.tp-tile .ph{display:block;width:100%;height:120px;object-fit:cover;background:var(--surface-2)}
.tp-tile .t{display:block;padding:9px 12px 11px}
.tp-tile b{display:block;font-size:15px;line-height:1.25}
.tp-tile small{display:block;font-size:12px;color:var(--text-muted);margin-top:2px}
.tp-heart{border:0;background:var(--surface);width:32px;height:32px;border-radius:50%;display:grid;place-items:center;cursor:pointer;font-size:16px;line-height:1;color:var(--rust);box-shadow:var(--shadow-sm);flex:none}
.tp-heart[aria-pressed=true]{background:var(--rust);color:#fff}
.tp-tile .tp-heart{position:absolute;top:8px;right:8px}
.tp-row.off img{filter:grayscale(.7)}
.tp-find{display:flex;gap:8px;align-items:center;flex-wrap:wrap}
.tp-search{flex:1;min-width:200px;font:inherit;font-size:15px;padding:9px 14px 9px 36px;border-radius:999px;border:1.5px solid var(--border);
  background:var(--surface) url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16' fill='none' stroke='%23887' stroke-width='2'%3E%3Ccircle cx='7' cy='7' r='5'/%3E%3Cpath d='m11 11 4 4'/%3E%3C/svg%3E") 13px center no-repeat;color:var(--text)}
.tp-search:focus{outline:none;border-color:var(--pine)}
.tp-clear{border:0;background:none;color:var(--rust);font:inherit;font-size:13px;font-weight:700;cursor:pointer;text-decoration:underline;padding:4px}
.tp-more{align-self:center;margin-top:4px}
.tp-row img{width:54px;height:54px;border-radius:12px;object-fit:cover}
.tp-relax{border:2px dashed var(--rust);border-radius:16px;padding:12px 16px;background:var(--rust-tint)}
.tp-skel{border-radius:20px;height:300px;background:var(--surface-2)}
@keyframes tpsk{to{background-position:-200% 0}}
/* Drawer */
.tp-scrim{position:fixed;inset:0;background:rgba(20,16,10,.45);z-index:50;animation:tpfade .15s}
.tp-drawer{position:fixed;top:0;right:0;bottom:0;width:min(560px,100vw);background:var(--surface);z-index:51;overflow:auto;
  box-shadow:-12px 0 40px rgba(0,0,0,.25);animation:tpslide .2s ease-out;display:flex;flex-direction:column}
.tp-drawer .tp-photo{height:230px;flex-shrink:0}
.tp-drawer .tp-name{font-size:30px}
.tp-close{position:absolute;right:12px;top:12px;z-index:2;border:0;border-radius:50%;width:36px;height:36px;background:rgba(0,0,0,.45);color:#fff;font-size:18px;cursor:pointer}
.tp-sec{padding:14px 20px;border-bottom:1px solid var(--grid)}
.tp-bars{display:flex;flex-direction:column;gap:6px}
.tp-barrow{display:grid;grid-template-columns:1fr 90px;gap:10px;align-items:center;font-size:13px}
.tp-meter{height:8px;border-radius:4px;background:var(--surface-2);overflow:hidden}
.tp-meter i{display:block;height:100%;border-radius:4px}
.tp-hz{display:grid;grid-template-columns:repeat(4,1fr);gap:8px}
.tp-hz div{border:1px solid var(--border);border-radius:12px;padding:8px;text-align:center;font-size:12px}
.tp-hz div{display:flex;flex-direction:column;align-items:center;gap:2px}
.tp-hz-t{font-size:12px;font-weight:700;color:var(--text)}
.tp-hz-k{font-size:10px;letter-spacing:.06em;text-transform:uppercase;color:var(--text-muted);white-space:nowrap}
.tp-hz b{display:block;font-size:22px;font-family:var(--font-display);font-variant-numeric:tabular-nums;line-height:1.2;margin-top:2px}
.tp-hz b small{font-family:var(--font-body);font-size:.55em;font-weight:700;margin-left:1px;vertical-align:.5em}
.tp-dates{font-family:var(--font-display);font-size:26px;font-weight:800;color:var(--pine);margin:0 0 4px}
.tp-dates small{font-family:var(--font-body);font-size:13px;font-weight:600;color:var(--text-muted);margin-left:6px}
.tp-mlist{list-style:none;margin:10px 0 0;padding:0;border-top:1px solid var(--border)}
.tp-mlist li{display:grid;grid-template-columns:1fr auto 36px;gap:10px;padding:7px 4px;border-bottom:1px solid var(--border);font-size:14px}
.tp-mlist li span:last-child{text-align:right}
.tp-year-best{font-size:15px;margin:0 0 10px;color:var(--bark)}
.tp-year-best b{color:var(--moss);font-size:18px}
.tp-year-best small{color:var(--text-muted);font-size:12.5px}
.tp-year-sub{font-size:12.5px;font-weight:700;color:var(--bark-2);margin:10px 0 4px}
.tp-year-list{list-style:none;margin:0;padding:0;border-top:1px solid var(--stone)}
.tp-year-list li{display:flex;justify-content:space-between;gap:10px;padding:6px 4px;border-bottom:1px solid var(--stone);font-size:14px}
.tp-year-list li b{color:var(--moss);font-weight:600;text-align:right}
.tp-year-list li small{color:var(--moss);font-size:12px}
.tp-year-list li.on{background:var(--sand)}
.tp-year-list.bad li b{color:var(--clay)}
.tp-year-table{width:100%;border-collapse:collapse;margin-top:12px;font-size:13.5px;font-variant-numeric:tabular-nums}
.tp-year-table th{text-align:left;font-weight:600;color:var(--bark-2);font-size:12px;padding:4px 6px;border-bottom:1px solid var(--stone)}
.tp-year-table td{padding:4px 6px;border-bottom:1px solid var(--stone)}
.tp-year-table tr.best td{background:var(--sand);color:var(--moss);font-weight:600}
.tp-year-table tr.picked td:first-child{box-shadow:inset 3px 0 0 var(--moss)}
.tp-mlist li.top b{color:var(--pine)}
.tp-trend{display:inline-flex;align-items:center;gap:4px;font-size:12.5px;font-weight:500;padding:2px 9px;border-radius:99px;
  background:var(--sand);color:var(--bark-2);border:1px solid var(--stone);white-space:nowrap;max-width:100%;overflow:hidden;text-overflow:ellipsis}
.tp-trend.sm{font-size:11.5px;padding:1px 8px;margin-top:3px}
.tp-trend-real{color:var(--clay);border-color:color-mix(in srgb,var(--clay) 35%,transparent)}
.tp-trend-maybe{color:var(--bark)}
.tp-card-dates{font-size:13px;margin:0;color:var(--text)}
.tp-card-dates b{color:var(--pine)}
/* Compare tray */
.tp-tray{position:sticky;bottom:10px;z-index:20;border-radius:16px;background:#261e14;color:#f5f0e8;padding:10px 14px;display:flex;gap:10px;align-items:center;flex-wrap:wrap;box-shadow:var(--shadow-lg)}
.tp-tray button{font:inherit}
.tp-cmp{width:100%;border-collapse:collapse;font-size:13px}
.tp-cmp th,.tp-cmp td{padding:7px 8px;border-bottom:1px solid var(--grid);text-align:left;vertical-align:top}
.tp-cmp td.win{background:var(--pine-tint);font-weight:700}
@keyframes tpslide{from{transform:translateX(40px);opacity:0}}
@keyframes tpfade{from{opacity:0}}
/* Custom slider (same as the old planner's) */
.tp .range2-values{display:flex;gap:8px;align-items:baseline;font-size:16px;font-weight:600}
.tp .range2-track{position:relative;height:28px}
.tp .range2-track::before{content:"";position:absolute;left:0;right:0;top:12px;height:4px;border-radius:2px;background:var(--grid)}
.tp .range2-fill{position:absolute;top:12px;height:4px;border-radius:2px;background:var(--accent)}
.tp .range2-track input[type=range]{position:absolute;inset:0;width:100%;margin:0;background:none;pointer-events:none;appearance:none;-webkit-appearance:none}
.tp .range2-track input[type=range]::-webkit-slider-thumb{pointer-events:auto;-webkit-appearance:none;width:20px;height:20px;border-radius:50%;background:var(--accent);border:2px solid var(--surface);cursor:grab}
.tp .range2-track input[type=range]::-moz-range-thumb{pointer-events:auto;width:18px;height:18px;border-radius:50%;background:var(--accent);border:2px solid var(--surface);cursor:grab}
.tp .range2-scale{display:flex;justify-content:space-between;font-size:11px;color:var(--text-muted)}
.tp .favourite-city .row{display:flex;gap:8px}
.tp .text-input{flex:1;min-width:0;padding:8px 12px;border-radius:10px;border:1.5px solid var(--border);background:var(--surface);font:inherit;color:var(--text)}
.tp .place-results{list-style:none;margin:6px 0 0;padding:0;display:flex;flex-direction:column;gap:2px}
.tp-sci{margin-left:auto;font-size:11px;font-family:ui-monospace,Menlo,monospace;color:var(--sky);background:var(--sky-tint);border-radius:6px;padding:0 6px;white-space:nowrap}
.tp-edit{display:none}
@media (max-width:900px){
  .tp{grid-template-columns:1fr}
  .tp-side{position:fixed;inset:auto 0 0 0;max-height:85vh;border-radius:22px 22px 0 0;z-index:40;transform:translateY(105%);transition:transform .25s}
  .tp-side.open{transform:none}
  .tp-edit{display:inline-flex;position:sticky;top:8px;z-index:30;align-self:flex-start}
  .tp-hero h1{font-size:26px}
  .tp-row{grid-template-columns:22px 44px 1fr auto}
  .tp-row img{width:44px;height:44px}
  .tp-row .hide-sm{display:none}
}
@media (prefers-reduced-motion:reduce){.tp *{animation:none!important;transition:none!important}}

/* Canopy look: flat paper cards, thin stone borders, moss for "on", clay only for "avoid". */
.tp-side{background:var(--paper);border:1px solid var(--stone);border-radius:var(--radius);box-shadow:none}
.tp-h{color:var(--bark-2);font-weight:500}
.tp-hero{background:none;color:var(--bark);border-radius:0;padding:0 0 18px;border-bottom:1px solid var(--stone);overflow:visible}
.tp-hero h1{font-weight:400;font-size:clamp(28px,4vw,38px);color:var(--bark)}
.tp-hero p{opacity:1;color:var(--bark-2)}
.tp-mood{border:1px solid var(--stone);background:var(--paper);color:var(--bark);border-radius:99px;font-weight:500;padding:7px 13px;font-size:13.5px}
.tp-mood:hover{background:var(--paper);border-color:var(--moss)}
.tp-mood[aria-pressed=true]{background:var(--sage);border-color:var(--moss);color:var(--bark)}
.tp-season{background:var(--sand);color:var(--bark);border:1px solid var(--stone);border-radius:10px;font-weight:500}
.tp-month{background:var(--paper);color:var(--bark);border:1px solid var(--stone);font-weight:500}
.tp-season:hover,.tp-month:hover{border-color:var(--moss)}
.tp-month{display:flex;flex-direction:column;align-items:center;gap:1px;line-height:1.15}
.tp-month-y{font-size:10.5px;font-weight:500;color:var(--bark-2);letter-spacing:.02em}
.tp-month[aria-pressed=true] .tp-month-y{color:var(--paper);opacity:.85}
.tp-season[aria-pressed=true],.tp-month[aria-pressed=true]{background:var(--moss);border-color:var(--moss);color:var(--paper);box-shadow:none;font-weight:600}
.tp-feel{border:1px solid var(--stone);background:var(--paper);font-weight:500;color:var(--bark)}
.tp-feel[aria-pressed=true]{border-color:var(--moss);background:color-mix(in srgb,var(--sage) 35%,var(--paper));color:var(--bark)}
.tp-chip{border:1px solid var(--stone);background:var(--paper);color:var(--bark);font-weight:500}
.tp-chip:hover{border-color:var(--moss)}
.tp-chip.nice{border-color:var(--moss);background:color-mix(in srgb,var(--sage) 30%,var(--paper));color:var(--bark)}
.tp-chip.nice .lvl{background:var(--paper);color:var(--moss)}
.tp-chip.must{border-color:var(--moss);background:var(--moss);color:var(--paper)}
.tp-chip.must .lvl{background:var(--paper);color:var(--moss)}
.tp-chips.avoid .tp-chip.nice{border-color:var(--clay);background:color-mix(in srgb,var(--clay) 10%,var(--paper));color:var(--bark)}
.tp-chips.avoid .tp-chip.must{border-color:var(--clay);background:var(--clay);color:var(--paper)}
.tp-chips.avoid .tp-chip.must .lvl{color:var(--clay)}
.tp-more summary{color:var(--moss);font-weight:500}
.tp-seg{border:1px solid var(--stone)}
.tp-seg button{font-weight:500;color:var(--bark-2)}
.tp-seg button[aria-pressed=true]{background:var(--moss);color:var(--paper)}
.tp-count{font-weight:400;color:var(--bark)}
.tp-card{border:1px solid var(--stone);background:var(--paper);border-radius:var(--radius);box-shadow:none}
.tp-card:hover,.tp-card:focus-visible{box-shadow:none;border-color:var(--moss);transform:translateY(-2px)}
.tp-name{font-weight:400}
.tp-why{background:var(--paper);border:1px solid var(--stone);border-left:3px solid var(--moss);border-radius:var(--radius);color:var(--bark)}
.tp-row{border:1px solid var(--stone);background:var(--paper);border-radius:12px}
.tp-row:hover{border-color:var(--moss)}
.tp-tile{border:1px solid var(--stone);background:var(--paper);border-radius:var(--radius)}
.tp-tile:hover,.tp-tile:focus-visible{border-color:var(--moss);box-shadow:none}
.tp-act{border:1px solid var(--stone);background:var(--paper);font-weight:500;color:var(--bark)}
.tp-act:hover{border-color:var(--moss);color:var(--moss)}
.tp-act[aria-pressed=true]{background:var(--moss);border-color:var(--moss);color:var(--paper)}
.tp-search{border:1px solid var(--stone);background-color:var(--paper);color:var(--bark)}
.tp-search:focus{border-color:var(--moss)}
.tp-clear{color:var(--clay);font-weight:500}
.tp-relax{border:1px dashed var(--clay);border-radius:var(--radius);background:var(--paper)}
.tp-badge{font-weight:500;background:var(--sand);color:var(--bark);border:1px solid var(--stone)}
.tp-badge.warn{background:color-mix(in srgb,var(--clay) 10%,var(--paper));color:var(--clay)}
.tp-badge.case{background:color-mix(in srgb,var(--sage) 35%,var(--paper));color:var(--bark)}
.tp-strip span.best{outline-color:var(--moss)}
.tp-dates{font-weight:400;color:var(--bark)}
.tp-card-dates b,.tp-mlist li.top b{color:var(--bark)}
.tp-drawer{background:var(--paper)}
.tp-heart{background:var(--paper);color:var(--clay);box-shadow:none;border:1px solid var(--stone)}
.tp-heart[aria-pressed=true]{background:var(--clay);border-color:var(--clay);color:var(--paper)}
.tp-cmp td.win{background:color-mix(in srgb,var(--sage) 35%,var(--paper))}
.tp-card:hover,.tp-card:focus-visible{transform:none}
.tp-medal{filter:none}
.tp-skel{border-radius:var(--radius)}
.tp-drawer{box-shadow:none;border-left:1px solid var(--stone)}
.tp-tray{background:var(--paper);color:var(--bark);border:1px solid var(--stone);border-radius:var(--radius);box-shadow:none}
/* Step 1: preferences, one centred column. */
.tp-prefs{display:flex;flex-direction:column;gap:18px}
.tp-prefs-card{background:var(--paper);border:1px solid var(--stone);border-radius:var(--radius);padding:18px 20px;display:flex;flex-direction:column;gap:18px}
.tp-prefs-head{display:flex;justify-content:space-between;align-items:center}
.tp-prefs-head h2{margin:0;font-family:var(--font-display);color:var(--pine);font-size:22px}
.tp-go{position:sticky;bottom:10px;z-index:20;display:flex;gap:12px;align-items:center;justify-content:space-between;flex-wrap:wrap;
  background:var(--paper);border:1px solid var(--stone);border-radius:var(--radius);padding:10px 14px}
.tp-go-count{font-weight:600;color:var(--pine)}
.tp-go-btn{background:var(--clay)}

/* Step 2: ranked list on the left, a card per ticked park on the right. */
.tp-list{position:sticky;top:12px;max-height:calc(100vh - 24px);overflow:auto;display:flex;flex-direction:column;gap:12px;
  background:var(--paper);border:1px solid var(--stone);border-radius:var(--radius);padding:14px}
.tp-list-head{display:flex;justify-content:space-between;align-items:flex-start;gap:8px}
.tp-list .tp-count{font-size:20px}
.tp-list .tp-search{min-width:0}
.tp-picks{list-style:none;margin:0;padding:0;display:flex;flex-direction:column;gap:4px}
.tp-pick{display:grid;grid-template-columns:auto auto 40px 1fr auto;gap:8px;align-items:center;padding:6px 8px;border-radius:10px;
  border:1px solid transparent;cursor:pointer}
.tp-pick:hover{border-color:var(--stone)}
.tp-pick.on{background:var(--surface-2);border-color:var(--moss)}
.tp-pick.off{opacity:.62}
.tp-pick input{width:16px;height:16px;margin:0;accent-color:var(--moss)}
.tp-pick-rank{min-width:18px;text-align:right;font-size:12px;color:var(--text-muted)}
.tp-pick img,.tp-pick-ph{width:40px;height:40px;border-radius:8px;object-fit:cover;background:var(--surface-2)}
.tp-pick-name{min-width:0;display:flex;flex-direction:column}
.tp-pick-name b{font-weight:600}
.tp-pick-name small{font-size:12px;color:var(--text-muted);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
/* Two cards side by side once there is room for two 400px columns. */
.tp-cards{display:grid;grid-template-columns:repeat(auto-fill,minmax(min(100%,400px),1fr));gap:16px;align-items:start;min-width:0}
.tp-cards>.tp-note,.tp-cards>.tp-empty{grid-column:1/-1}
.tp-empty{border:2px dashed var(--stone);border-radius:var(--radius);padding:28px;text-align:center;color:var(--text-muted);margin:0}
@media (max-width:900px){
  .tp-list{position:static;max-height:50vh}
}
`;
