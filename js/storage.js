const K="top3-auto-state-v1";
const DB_NAME="top3-auto-db";
const DB_VERSION=1;
const STORE="state";

let dbPromise=null;
let memoryState={};

function openDB(){
  if(dbPromise)return dbPromise;
  dbPromise=new Promise((resolve,reject)=>{
    if(!("indexedDB" in window)){
      reject(new Error("IndexedDB не поддерживается"));
      return;
    }
    const req=indexedDB.open(DB_NAME,DB_VERSION);
    req.onupgradeneeded=()=>{
      const db=req.result;
      if(!db.objectStoreNames.contains(STORE))db.createObjectStore(STORE);
    };
    req.onsuccess=()=>resolve(req.result);
    req.onerror=()=>reject(req.error||new Error("Не удалось открыть IndexedDB"));
  });
  return dbPromise;
}

async function idbGet(key){
  const db=await openDB();
  return new Promise((resolve,reject)=>{
    const tx=db.transaction(STORE,"readonly");
    const req=tx.objectStore(STORE).get(key);
    req.onsuccess=()=>resolve(req.result??null);
    req.onerror=()=>reject(req.error||new Error("Ошибка чтения IndexedDB"));
  });
}

async function idbSet(key,value){
  const db=await openDB();
  return new Promise((resolve,reject)=>{
    const tx=db.transaction(STORE,"readwrite");
    tx.objectStore(STORE).put(value,key);
    tx.oncomplete=()=>resolve(true);
    tx.onerror=()=>reject(tx.error||new Error("Ошибка записи IndexedDB"));
    tx.onabort=()=>reject(tx.error||new Error("Запись IndexedDB прервана"));
  });
}

async function migrateLegacy(){
  try{
    const raw=localStorage.getItem(K);
    if(raw){
      const parsed=JSON.parse(raw);
      memoryState=parsed&&typeof parsed==="object"?parsed:{};
      await idbSet(K,memoryState);
      localStorage.removeItem(K);
      return;
    }
    const saved=await idbGet(K);
    if(saved&&typeof saved==="object")memoryState=saved;
  }catch(e){
    console.warn("TOP-3: миграция хранилища пропущена",e);
    try{localStorage.removeItem(K)}catch{}
  }
}

export function loadState(){
  try{
    const raw=localStorage.getItem(K);
    if(raw){
      const parsed=JSON.parse(raw);
      if(parsed&&typeof parsed==="object")memoryState=parsed;
    }
  }catch{}
  return memoryState||{};
}

export function saveState(s){
  memoryState=s&&typeof s==="object"?s:{};
  idbSet(K,memoryState).then(()=>{
    try{localStorage.removeItem(K)}catch{}
  }).catch(e=>console.warn("TOP-3: не удалось сохранить состояние в IndexedDB",e));
}

export function appendLog(state,msg){
  state.log=state.log||[];
  state.log.unshift({at:new Date().toISOString(),msg});
  state.log=state.log.slice(0,200);
}

migrateLegacy();
