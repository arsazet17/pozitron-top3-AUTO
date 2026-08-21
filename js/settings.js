import {card} from "../ui.js";
export function renderSettings(ctx){
 return `<div class="grid cols-2">${card("ИСТОЧНИК ДАННЫХ",`<div class="list-row"><span>Источник</span><b>https://www.stoloto.ru/top3</b></div><div class="list-row"><span>Автопроверка</span><b>каждые 5 минут</b></div><div class="list-row"><span>Ручной ввод</span><b class="bad">ОТКЛЮЧЁН</b></div>`)}${card("О ПРИЛОЖЕНИИ",`<div class="list-row"><span>Название</span><b>TOP-3 AUTO</b></div><div class="list-row"><span>Версия</span><b>${ctx.version.version}</b></div><div class="list-row"><span>Репозиторий</span><b>pozitron-top3-AUTO</b></div>`)}</div>
 ${card("ПЛАНШЕТ",`<p>Интерфейс адаптивный: <b>портретный и альбомный режим</b>. Жёсткая блокировка ориентации отсутствует. В альбомном режиме используются 2–4 колонки, в портретном блоки перестраиваются вертикально.</p>`)}
 ${card("ОБНОВЛЕНИЕ",`<p>Одна кнопка <b>«Обновить»</b> в шапке одновременно проверяет <b>version.json</b> и <b>latest.json</b>. Автосборщик на GitHub Actions проверяет официальный источник каждые 5 минут.</p>`)}`;
}
