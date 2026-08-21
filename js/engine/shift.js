const ROUTES=[
  {label:"TOP · В1",block:"TOP",variant:"V1",idx:0},
  {label:"TOP · В2",block:"TOP",variant:"V2",idx:1},
  {label:"TOP · В3",block:"TOP",variant:"V3",idx:2},
  {label:"TOP · Г→Г",block:"TOP",variant:"GG",idx:3},
  {label:"Δ · В1",block:"DELTA",variant:"V1",idx:0},
  {label:"Δ · В2",block:"DELTA",variant:"V2",idx:1},
  {label:"Δ · В3",block:"DELTA",variant:"V3",idx:2},
  {label:"Δ · Г→Г",block:"DELTA",variant:"GG",idx:3},
  {label:"ЧИСЛА · В1",block:"NUMBERS",variant:"V1",idx:0},
  {label:"ЧИСЛА · В2",block:"NUMBERS",variant:"V2",idx:1},
  {label:"ЧИСЛА · В3",block:"NUMBERS",variant:"V3",idx:2},
  {label:"ЧИСЛА · Г→Г",block:"NUMBERS",variant:"GG",idx:3}
];

function exactMapping(mainForecast,mapping){
  const out=[], diagnostics={};
  for(const p of ["A","B","C"]){
    const x=mapping[p];
    if(!x)return {combo:null,status:"нет сигнала",reason:`Нет правила для ${p}`,diagnostics};
    const idx={V1:0,V2:1,V3:2,GG:3,"Г→Г":3}[x.variant];
    const block=mainForecast[x.block];
    const pi=["A","B","C"].indexOf(p);
    if(!block||idx===undefined||!block[idx]||block[idx][pi]==="—"){
      return {combo:null,status:"нет сигнала",reason:`Некорректное правило ${p}`,diagnostics};
    }
    out.push(block[idx][pi]);
    diagnostics[p]={route:`${x.block} · ${x.variant}`,mode:"mapping"};
  }
  return {combo:out.join(""),status:"активен",reason:"Выбор только из текущих основных вариантов по зафиксированной карте матрицы",diagnostics};
}

function scoreRoutes(observations,pos,targetTime,sameTimeBoost){
  const scores=new Map(ROUTES.map(r=>[r.label,0]));
  const n=Math.max(1,observations.length);
  observations.forEach((o,i)=>{
    const recency=0.75+0.5*((i+1)/n);
    const boost=o.time===targetTime?sameTimeBoost:1;
    const set=new Set(o.criteria?.[pos]||[]);
    for(const r of ROUTES)if(set.has(r.label))scores.set(r.label,scores.get(r.label)+recency*boost);
  });
  return scores;
}
function ranked(scores){
  return ROUTES.map((r,order)=>({route:r,score:scores.get(r.label)||0,order}))
    .sort((a,b)=>b.score-a.score||a.order-b.order);
}
function routeDigit(mainForecast,route,pos){
  const pi=["A","B","C"].indexOf(pos);
  const combo=mainForecast?.[route.block]?.[route.idx];
  const d=combo?.[pi];
  return /^\d$/.test(String(d))?String(d):null;
}

export function algorithmShiftForecast(mainForecast,observations,rules){
  const cfg=rules.algorithmShift||{};
  if(!cfg.enabled)return {combo:null,status:"нет сигнала",reason:cfg.note||"Точный закон выбора не задан",diagnostics:{}};

  if(cfg.mapping)return exactMapping(mainForecast,cfg.mapping);

  const all=Array.isArray(observations)?observations:[];
  const rolling=Math.max(20,Number(cfg.rolling||120));
  const recentWindow=Math.max(6,Number(cfg.recentWindow||30));
  const minObservations=Math.max(6,Number(cfg.minObservations||12));
  const sameTimeBoost=Math.max(1,Number(cfg.sameTimeBoost||2.5));
  const minChangedPositions=Math.max(1,Math.min(3,Number(cfg.minChangedPositions||1)));
  const targetTime=mainForecast?.target?.time;

  const longObs=all.slice(-rolling);
  if(longObs.length<minObservations){
    return {
      combo:null,status:"наблюдение",
      reason:`Недостаточно истории для смены алгоритма: ${longObs.length}/${minObservations}`,
      diagnostics:{observations:longObs.length}
    };
  }

  const recentObs=longObs.slice(-recentWindow);
  const diagnostics={}, out=[];
  let changedPositions=0;

  for(const pos of ["A","B","C"]){
    const longRank=ranked(scoreRoutes(longObs,pos,targetTime,sameTimeBoost));
    const recentRank=ranked(scoreRoutes(recentObs,pos,targetTime,sameTimeBoost));
    const bestLong=longRank[0], bestRecent=recentRank[0], second=recentRank[1];
    if(!bestRecent || bestRecent.score<=0){
      return {combo:null,status:"нет сигнала",reason:`Нет подтверждённого маршрута для ${pos}`,diagnostics};
    }

    const changed=bestLong?.route?.label!==bestRecent.route.label;
    if(changed)changedPositions++;
    const dominance=second?.score>0?bestRecent.score/second.score:(bestRecent.score>0?99:0);
    const digit=routeDigit(mainForecast,bestRecent.route,pos);
    if(digit===null){
      return {combo:null,status:"нет сигнала",reason:`Выбранный маршрут ${bestRecent.route.label} не дал цифру для ${pos}`,diagnostics};
    }
    out.push(digit);
    diagnostics[pos]={
      recentRoute:bestRecent.route.label,
      recentScore:+bestRecent.score.toFixed(2),
      longRoute:bestLong?.route?.label||null,
      longScore:+(bestLong?.score||0).toFixed(2),
      secondRoute:second?.route?.label||null,
      dominance:+dominance.toFixed(2),
      changed,
      digit
    };
  }

  if(changedPositions<minChangedPositions){
    return {
      combo:null,status:"нет смены",
      reason:`Матрица стабильна: сменившихся позиций ${changedPositions}/${minChangedPositions}`,
      diagnostics
    };
  }

  return {
    combo:out.join(""),
    status:"активен",
    reason:`Смена алгоритма подтверждена матрицей: изменилось позиций ${changedPositions}/3. Цифры взяты только из текущих TOP / Δ / ЧИСЛА.`,
    diagnostics
  };
}
