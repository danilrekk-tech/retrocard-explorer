const catalog = require("./catalog");

function buildSetupPlan({ consoleId, firmwareId, cardSizeGb }) {
  const profile = catalog.consoleProfile(consoleId);
  const folders = [
    { path: profile.romsRoot.replace(/^\//, ""), depth: 0 },
    { path: "bios", depth: 0 },
    { path: "saves", depth: 0 },
  ];

  for (const sysId of profile.systems) {
    const meta = catalog.systemMeta(sysId);
    folders.push({
      path: `${profile.romsRoot.replace(/^\//, "")}/${meta.folder}`,
      depth: 1,
      note: meta.requiresBios ? `Требуется BIOS (см. раздел BIOS)` : undefined,
    });
  }

  const notes = [
    `Прошивка: ${catalog.FIRMWARE_LABELS[firmwareId] || firmwareId}.`,
    `Рекомендуемый объём карты: от ${Math.max(16, Math.ceil(cardSizeGb * 0.6))} ГБ свободно под ROM'ы (карта: ${cardSizeGb} ГБ).`,
    "Структура создаётся пустой — скопируйте свои ROM'ы и BIOS в соответствующие папки.",
  ];
  if (firmwareId === "stock") {
    notes.push('Для Stock OS папка с ROM\'ами обычно называется "Roms" (с заглавной буквы).');
  }

  return { consoleId, firmwareId, cardSizeGb, folders, notes };
}

module.exports = { buildSetupPlan };
