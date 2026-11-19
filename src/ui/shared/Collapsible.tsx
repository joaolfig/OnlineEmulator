import type { ComponentChildren } from 'preact';

interface Props {
  readonly title: string;
  readonly defaultOpen: boolean;
  readonly children: ComponentChildren;
}

/** Painel que pode ser recolhido (no celular, os painéis secundários começam fechados). */
export function Collapsible({ title, defaultOpen, children }: Props) {
  return (
    <details class="panel collapsible" open={defaultOpen}>
      <summary>
        <h2>{title}</h2>
      </summary>
      <div class="stack collapsible-body">{children}</div>
    </details>
  );
}
