import { render, type ComponentChild } from 'preact';
// Integra os signals ao Preact: componentes que leem `signal.value` re-renderizam sozinhos.
import '@preact/signals';
import './styles.css';

/** Monta a página no elemento #app. */
export function mount(app: ComponentChild): void {
  const root = document.getElementById('app');
  if (!root) throw new Error('Elemento #app não encontrado');
  render(app, root);
}
