const catalog = require("./catalog");

/**
 * Демонстрационный план миграции между прошивками — как описано в ТЗ,
 * реальная миграция не выполняется, только показывается предполагаемый
 * план изменений и предупреждения.
 */
function buildMigrationPlan(from, to) {
  const fromLabel = catalog.FIRMWARE_LABELS[from] || from;
  const toLabel = catalog.FIRMWARE_LABELS[to] || to;

  const steps = [
    { title: "Резервное копирование", detail: "Создать полный бэкап /roms, /bios и /saves перед миграцией.", risk: "info" },
    { title: "Анализ структуры", detail: `Сравнение структуры папок ${fromLabel} и ${toLabel}.`, risk: "info" },
    { title: "Перенос ROM'ов", detail: "Копирование ROM'ов в новую структуру папок с сохранением систем.", risk: "warning" },
    { title: "Перенос сохранений", detail: "Сохранения могут иметь несовместимый формат между прошивками.", risk: "warning" },
    { title: "Перенос BIOS", detail: "BIOS обычно совместимы между прошивками на базе EmulationStation/RetroArch.", risk: "info" },
    { title: "Проверка после миграции", detail: `Запуск нескольких игр для проверки совместимости с ${toLabel}.`, risk: "critical" },
  ];

  const folderChanges = [];
  if (from === "stock" && to !== "stock") {
    folderChanges.push({ from: "/Roms", to: "/roms", note: "Изменение регистра папки ROM'ов" });
  }
  if (to === "stock" && from !== "stock") {
    folderChanges.push({ from: "/roms", to: "/Roms", note: "Изменение регистра папки ROM'ов" });
  }

  const warnings = [
    "Сохранения (saves) могут быть несовместимы между прошивками — рекомендуется резервное копирование.",
    "Пользовательские настройки эмуляторов не переносятся автоматически.",
  ];
  if (from === to) {
    warnings.unshift("Исходная и целевая прошивка совпадают — миграция не требуется.");
  }

  return { from, to, steps, folderChanges, warnings };
}

module.exports = { buildMigrationPlan };
