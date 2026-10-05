# RetroCard Local Agent

Локальный помощник для [RetroCard Explorer](https://retrocard-explorer.lovable.app).
Даёт веб-интерфейсу доступ к настоящей microSD-карте на компьютере пользователя —
без него сервис работает только на Mock Data.

Реализует ровно контракт `LocalAgentClient` из
`src/lib/agent/client.ts` проекта `retrocard-explorer-main`, поэтому фронтенд
можно переключить на него, ничего не меняя в UI (см. `HttpAgentClient` ниже).

## Что делает агент по-настоящему (не мок!)

- находит подключённые SD-карты/флешки (Windows: `Get-CimInstance Win32_LogicalDisk`);
- определяет прошивку (ArkOS / Stock OS / JELOS / ROCKNIX / Unknown) по структуре папок;
- реально сканирует `/roms`, `/bios`, `/saves`, строит дерево файлов;
- раскладывает ROM'ы по системам (по папке и/или расширению файла);
- ищет дубликаты (точные — по размеру, версии/регионы — по названию и тегам в скобках);
- проверяет наличие обязательных BIOS-файлов;
- строит и **применяет** план организации карты (реально перемещает файлы);
- строит предпросмотр очистки и **удаляет** только явно подтверждённые пути;
- создаёт zip-бэкапы (`archiver`) в `%APPDATA%\RetroCardAgent\backups`;
- измеряет реальную скорость чтения/записи карты (пишет/читает тестовый файл 8 МБ);
- строит план структуры для новой карты и демонстрационный план миграции между прошивками.

Ничего не удаляется и не перемещается без явного вызова apply/delete с фронтенда —
агент только показывает планы, пока пользователь не подтвердит их в UI.

## Запуск

### Готовый .exe (для конечного пользователя)

Скачайте `RetroCard-Local-Agent.exe`, запустите двойным кликом. Откроется
консольное окно — оставьте его открытым, пока пользуетесь RetroCard. Агент
слушает **только** `127.0.0.1:7345` (недоступен из сети). Порт можно
изменить переменной окружения `AGENT_PORT`.

### Из исходников (для разработки)

```sh
npm install
npm start
```

### Пересборка .exe

```sh
npm install
npx pkg . --targets node18-win-x64 --output dist/RetroCard-Local-Agent.exe
```

`pkg` сам скачивает нужный Node.js-рантайм и упаковывает всё в один exe —
на компьютере пользователя Node.js не нужен.

## HTTP API

Base URL: `http://127.0.0.1:7345`. CORS открыт для любого origin (агент и
так доступен только с localhost).

| Метод | Путь | Соответствие в `LocalAgentClient` |
|---|---|---|
| GET | `/api/status` | `getStatus()` |
| GET | `/api/drives` | (доп.) список найденных SD/USB |
| POST | `/api/connect` `{path?, consoleId?}` | `connect()` |
| POST | `/api/disconnect` | `disconnect()` |
| GET | `/api/consoles` | `listConsoles()` |
| POST | `/api/scan` *(NDJSON-стрим)* | `scanCard(onProgress)` |
| POST | `/api/organize/plan` `{scan}` | `buildOrganizationPlan(scan)` |
| POST | `/api/organize/apply` `{plan}` *(NDJSON)* | `applyOrganizationPlan(plan, onProgress)` |
| POST | `/api/cleaner/preview` `{scan, filters}` | `previewCleanup(scan, filters)` |
| POST | `/api/delete` `{paths}` *(NDJSON)* | `deletePaths(paths, onProgress)` |
| GET | `/api/backups` | `listBackups()` |
| POST | `/api/backup/create` `{includes}` *(NDJSON)* | `createBackup(includes, onProgress)` |
| POST | `/api/setup/plan` `{consoleId, firmwareId, cardSizeGb}` | `buildSetupPlan(...)` |
| POST | `/api/migrate/plan` `{from, to}` | `buildMigrationPlan(from, to)` |

Операции с прогрессом отдают `Content-Type: application/x-ndjson` — по
одной JSON-строке на событие:

```
{"type":"progress","phase":"roms","percent":40,"message":"Поиск ROM'ов и каталогизация"}
...
{"type":"result","data":{...}}
```

## Подключение к фронтенду

В комплекте — `frontend/http-agent-client.ts`, готовая реализация
`LocalAgentClient` поверх HTTP-агента. Чтобы включить настоящий агент
вместо Mock Data, в проекте `retrocard-explorer-main`:

1. Скопируйте файл в `src/lib/agent/http-agent.ts`.
2. В `src/lib/agent/index.ts` замените `MockAgentClient` на `HttpAgentClient`
   (или переключайте по настройке — `getAgent()` уже спроектирован для этого).

## Структура проекта

```
src/
  server.js           — HTTP-сервер (Express), маршруты, стриминг прогресса
  lib/
    catalog.js         — справочники систем/консолей/BIOS (синхронно с фронтендом)
    drives.js           — поиск съёмных дисков, инфо о томе
    firmware.js         — эвристики определения прошивки
    scan.js             — сканирование карты: дерево, ROM'ы, BIOS, saves, дубликаты
    organize.js          — построение и применение плана организации
    cleaner.js           — предпросмотр и удаление при очистке
    backup.js             — резервное копирование (zip)
    setup.js               — план структуры для новой карты
    migrate.js              — демо-план миграции между прошивками
```

## Известные ограничения / что стоит доработать дальше

- Определение прошивки — эвристика по характерным файлам/папкам; на реальных
  картах разных сборок признаки могут отличаться — стоит уточнить по
  фактическим дампам ArkOS/JELOS/ROCKNIX.
- `Migrate SD Card` — демонстрационный режим (как и требовалось в ТЗ),
  реальный перенос файлов между прошивками не выполняется.
- `Prepare New SD Card` — агент строит план структуры; физическое создание
  папок на диске сейчас делает фронтенд (скачивание архива), можно вынести
  сюда отдельным эндпоинтом `/api/setup/create`, если понадобится.
- Определение artwork — по совпадению имени файла в той же папке или в
  `images/media/imgs/screenshots`; не покрывает все конвенции скраперов.
