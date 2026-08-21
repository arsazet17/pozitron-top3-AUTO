export const esc=s=>String(s??"").replace(/[&<>"']/g,m=>({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#39;"}[m]));
export const combo=c=>c?`<span class="combo">${[...String(c).padStart(3,"0")].map(x=>`<span class="digit">${x}</span>`).join("")}</span>`:`<span class="muted">—</span>`;
export function card(title,body,cls=""){return `<section class="card ${cls}"><div class="card-head">${title}<span class="spacer"></span><button class="collapse-btn">⌃</button></div><div class="card-body">${body}</div></section>`}
export function variants(arr){return ["В1","В2","В3","Г→Г"].map((x,i)=>`<div class="variant"><span>${x}</span><b>${esc(arr?.[i]??"—")}</b></div>`).join("")}
export function bindCollapsibles(root=document){root.querySelectorAll(".collapse-btn").forEach(b=>b.onclick=()=>{const c=b.closest(".card");c.classList.toggle("collapsed");b.textContent=c.classList.contains("collapsed")?"⌄":"⌃"})}
