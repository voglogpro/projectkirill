import type { BuilderPage } from "../types";
import { BlockRenderer } from "./BlockRenderer";

export function PhonePreview({ page, selectedId, onSelect }: { page: BuilderPage; selectedId?: string; onSelect: (id: string) => void }) {
  return (
    <div className="phone-shell">
      <div className="phone-top"><span>9:41</span><span className="phone-island" /><span>5G ▰</span></div>
      <div className="telegram-bar"><span className="avatar">M</span><span><b>Мой первый бот</b><small>бот</small></span><span className="more">•••</span></div>
      <main className="phone-content">
        {page.blocks.map((block) => <BlockRenderer key={block.id} block={block} selected={block.id === selectedId} onSelect={() => onSelect(block.id)} />)}
        {page.blocks.length === 0 && <div className="empty-canvas">Добавьте первый блок</div>}
      </main>
    </div>
  );
}
