export function algorithmShiftForecast(mainForecast,observations,rules){
  if(!rules.algorithmShift?.enabled)return {combo:null,status:"нет сигнала",reason:rules.algorithmShift?.note||"Точный закон выбора не задан"};
  // Формула подключается через rules.algorithmShift.mapping; цифры никогда не создаются из статистики.
  const m=rules.algorithmShift.mapping||{}, out=[];
  for(const p of ["A","B","C"]){
    const x=m[p]; if(!x)return {combo:null,status:"нет сигнала",reason:`Нет правила для ${p}`};
    const block=mainForecast[x.block], idx={V1:0,V2:1,V3:2,GG:3}[x.variant];
    if(!block||idx===undefined)return {combo:null,status:"нет сигнала",reason:`Некорректное правило ${p}`};
    out.push(block[idx][["A","B","C"].indexOf(p)]);
  }
  return {combo:out.join(""),status:"активен",reason:"Выбор только из текущих основных вариантов по зафиксированной карте матрицы"};
}
