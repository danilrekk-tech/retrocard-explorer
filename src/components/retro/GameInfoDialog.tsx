import { useEffect, useState } from "react";

import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { systemMeta } from "@/lib/agent/catalog";
import type { RomEntry, SystemId } from "@/lib/agent/types";

/** Имена систем в репозитории Libretro Thumbnails. */
const LIBRETRO_SYSTEMS: Partial<Record<SystemId, string>> = {
  nes: "Nintendo - Nintendo Entertainment System",
  snes: "Nintendo - Super Nintendo Entertainment System",
  gb: "Nintendo - Game Boy",
  gbc: "Nintendo - Game Boy Color",
  gba: "Nintendo - Game Boy Advance",
  megadrive: "Sega - Mega Drive - Genesis",
  genesis: "Sega - Mega Drive - Genesis",
  n64: "Nintendo - Nintendo 64",
  psx: "Sony - PlayStation",
  psp: "Sony - PlayStation Portable",
  arcade: "MAME",
  mastersystem: "Sega - Master System - Mark III",
  pcengine: "NEC - PC Engine - TurboGrafx 16",
  dos: "DOS",
};

function libretroName(rom: RomEntry) {
  const base = rom.fileName.replace(/\.[^.]+$/, "");
  return base.replace(/[&*/:`<>?\\|"]/g, "_");
}

function thumbUrl(rom: RomEntry, kind: "Named_Snaps" | "Named_Titles" | "Named_Boxarts", name: string) {
  const sys = LIBRETRO_SYSTEMS[rom.systemId];
  if (!sys) return null;
  return `https://thumbnails.libretro.com/${encodeURIComponent(sys)}/${kind}/${encodeURIComponent(name)}.png`;
}

interface WikiInfo {
  title: string;
  extract: string;
  url: string;
  image?: string | undefined;
}

async function fetchWiki(rom: RomEntry, lang: string): Promise<WikiInfo | null> {
  const q = `${rom.title} ${systemMeta(rom.systemId).name} video game`;
  const search = await fetch(
    `https://${lang}.wikipedia.org/w/api.php?action=query&list=search&format=json&origin=*&srlimit=1&srsearch=${encodeURIComponent(q)}`,
  ).then((r) => r.json());
  const hit = search?.query?.search?.[0];
  if (!hit) return null;
  const summary = await fetch(
    `https://${lang}.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(hit.title)}`,
  ).then((r) => r.json());
  return {
    title: summary.title ?? hit.title,
    extract: summary.extract ?? "",
    url: summary.content_urls?.desktop?.page ?? `https://${lang}.wikipedia.org/wiki/${encodeURIComponent(hit.title)}`,
    image: summary.thumbnail?.source,
  };
}

function Shot({ src, label }: { src: string | null; label: string }) {
  const [failed, setFailed] = useState(false);
  if (!src || failed) return null;
  return (
    <figure className="space-y-1">
      <img src={src} alt={label} loading="lazy" onError={() => setFailed(true)} className="w-full rounded-lg border border-edge bg-canvas object-contain" />
      <figcaption className="font-mono text-[10px] uppercase tracking-widest text-ink/40">{label}</figcaption>
    </figure>
  );
}

export function GameInfoDialog({ rom, onClose }: { rom: RomEntry | null; onClose: () => void }) {
  const [info, setInfo] = useState<WikiInfo | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!rom) return;
    let cancelled = false;
    setInfo(null);
    setLoading(true);
    (async () => {
      try {
        const ru = await fetchWiki(rom, "ru");
        const res = ru && ru.extract ? ru : await fetchWiki(rom, "en");
        if (!cancelled) setInfo(res);
      } catch {
        if (!cancelled) setInfo(null);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [rom]);

  const name = rom ? libretroName(rom) : "";
  const google = rom
    ? `https://www.google.com/search?tbm=isch&q=${encodeURIComponent(`${rom.title} ${systemMeta(rom.systemId).name} screenshot`)}`
    : "#";

  return (
    <Dialog open={!!rom} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto border-edge bg-panel">
        {rom && (
          <>
            <DialogHeader>
              <DialogTitle className="text-ink">{rom.title}</DialogTitle>
              <DialogDescription className="font-mono text-[11px] text-ink/50">
                {systemMeta(rom.systemId).name} · {rom.region ?? "UNK"} · {rom.fileName}
              </DialogDescription>
            </DialogHeader>
            <div className="grid grid-cols-2 gap-3">
              <Shot key={`s-${rom.id}`} src={thumbUrl(rom, "Named_Snaps", name)} label="Скриншот" />
              <Shot key={`t-${rom.id}`} src={thumbUrl(rom, "Named_Titles", name)} label="Титульный экран" />
              <Shot key={`b-${rom.id}`} src={thumbUrl(rom, "Named_Boxarts", name)} label="Обложка" />
            </div>
            <div className="space-y-2 rounded-lg border border-edge bg-canvas p-3">
              <p className="font-mono text-[10px] uppercase tracking-widest text-cyan">Об игре</p>
              {loading && <p className="text-sm text-ink/50">Ищем информацию…</p>}
              {!loading && !info && <p className="text-sm text-ink/50">Информация не найдена.</p>}
              {info && (
                <>
                  <p className="text-sm font-medium text-ink">{info.title}</p>
                  <p className="text-sm leading-relaxed text-ink/70">{info.extract}</p>
                  <a href={info.url} target="_blank" rel="noreferrer" className="font-mono text-[11px] text-magenta underline">
                    Открыть в Википедии
                  </a>
                </>
              )}
            </div>
            <a href={google} target="_blank" rel="noreferrer" className="font-mono text-[11px] text-cyan underline">
              Искать ещё скриншоты в интернете
            </a>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
