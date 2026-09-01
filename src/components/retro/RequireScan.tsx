/** Заглушка для разделов, которым нужен результат сканирования. */
import type { ReactNode } from "react";

import { useRetroCard } from "@/lib/agent/agent-context";
import type { ScanResult } from "@/lib/agent/types";
import { EmptyState, RetroButton } from "./primitives";

export function RequireScan({ children }: { children: (scan: ScanResult) => ReactNode }) {
  const { scan, connect, scanCard, status, stage } = useRetroCard();

  if (!scan) {
    return (
      <EmptyState
        title="КАРТА НЕ ПРОСКАНИРОВАНА"
        detail="Подключите локального помощника и выполните сканирование — после этого раздел заполнится данными демонстрационной карты."
        action={
          <RetroButton
            onClick={() => (status.state === "connected" ? scanCard() : connect())}
            disabled={stage === "scanning" || status.state === "connecting"}
          >
            {status.state === "connected" ? "Сканировать карту" : "Connect Local Agent"}
          </RetroButton>
        }
      />
    );
  }

  return <>{children(scan)}</>;
}
