const K="top3-auto-state-v1";
export function loadState(){try{return JSON.parse(localStorage.getItem(K)||"{}")}catch{return {}}}
export function saveState(s){localStorage.setItem(K,JSON.stringify(s))}
export function appendLog(state,msg){state.log=state.log||[];state.log.unshift({at:new Date().toISOString(),msg});state.log=state.log.slice(0,200)}
