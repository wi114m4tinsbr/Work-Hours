const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), Math.max(min, max));

const setReactNumberInput = (labelText: string, value: number) => {
  const labels = Array.from(document.querySelectorAll('label')) as HTMLLabelElement[];
  const label = labels.find((item) => item.textContent?.trim() === labelText);
  const input = label?.parentElement?.querySelector('input[type="number"]') as HTMLInputElement | null;
  if (!input) return;

  const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set;
  setter?.call(input, String(Math.round(value)));
  input.dispatchEvent(new Event('input', { bubbles: true }));
  input.dispatchEvent(new Event('change', { bubbles: true }));
};

const initInvoiceLogoEditor = () => {
  const sheet = document.getElementById('invoice-sheet') as HTMLElement | null;
  const image = sheet?.querySelector('img[alt="Logo"]') as HTMLImageElement | null;
  const wrapper = image?.parentElement as HTMLElement | null;
  if (!sheet || !image || !wrapper || wrapper.dataset.logoEditorFixed === 'true') return;

  const handles = Array.from(wrapper.children).filter(
    (child): child is HTMLElement => child instanceof HTMLElement && child.tagName === 'DIV'
  );
  const resizeHandle = handles[0];
  const rotateHandle = handles[1];

  wrapper.dataset.logoEditorFixed = 'true';
  wrapper.style.touchAction = 'none';
  wrapper.style.userSelect = 'none';
  wrapper.style.boxSizing = 'border-box';

  if (resizeHandle) {
    resizeHandle.style.right = '3px';
    resizeHandle.style.bottom = '3px';
    resizeHandle.style.left = 'auto';
    resizeHandle.style.top = 'auto';
    resizeHandle.style.opacity = '0.9';
    resizeHandle.style.transform = 'none';
    resizeHandle.style.touchAction = 'none';
  }

  if (rotateHandle) {
    rotateHandle.style.right = '3px';
    rotateHandle.style.top = '3px';
    rotateHandle.style.left = 'auto';
    rotateHandle.style.bottom = 'auto';
    rotateHandle.style.opacity = '0.9';
    rotateHandle.style.transform = 'none';
    rotateHandle.style.touchAction = 'none';
  }

  const startInteraction = (event: PointerEvent, mode: 'move' | 'resize' | 'rotate') => {
    if (event.button !== 0) return;

    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation();

    const startPointerX = event.clientX;
    const startPointerY = event.clientY;
    const startLeft = Number.parseFloat(wrapper.style.left || '0') || 0;
    const startTop = Number.parseFloat(wrapper.style.top || '0') || 0;
    const startWidth = wrapper.getBoundingClientRect().width;
    const startHeight = wrapper.getBoundingClientRect().height;
    const startRotation = Number.parseFloat(wrapper.style.rotate || '0') || 0;
    const sheetRect = sheet.getBoundingClientRect();

    wrapper.style.transform = 'none';

    const onMove = (moveEvent: PointerEvent) => {
      moveEvent.preventDefault();
      moveEvent.stopPropagation();
      moveEvent.stopImmediatePropagation();

      const dx = moveEvent.clientX - startPointerX;
      const dy = moveEvent.clientY - startPointerY;

      if (mode === 'move') {
        const nextLeft = clamp(startLeft + dx, 0, sheet.clientWidth - wrapper.offsetWidth);
        const nextTop = clamp(startTop + dy, 0, sheet.scrollHeight - wrapper.offsetHeight);
        wrapper.style.left = `${nextLeft}px`;
        wrapper.style.top = `${nextTop}px`;
      }

      if (mode === 'resize') {
        const maxWidth = Math.max(20, sheet.clientWidth - startLeft);
        const maxHeight = Math.max(20, sheet.scrollHeight - startTop);
        wrapper.style.width = `${clamp(startWidth + dx, 20, maxWidth)}px`;
        wrapper.style.height = `${clamp(startHeight + dy, 20, maxHeight)}px`;
      }

      if (mode === 'rotate') {
        const rect = wrapper.getBoundingClientRect();
        const centerX = rect.left + rect.width / 2;
        const centerY = rect.top + rect.height / 2;
        const startAngle = Math.atan2(startPointerY - centerY, startPointerX - centerX);
        const currentAngle = Math.atan2(moveEvent.clientY - centerY, moveEvent.clientX - centerX);
        const deltaDegrees = ((currentAngle - startAngle) * 180) / Math.PI;
        wrapper.style.rotate = `${startRotation + deltaDegrees}deg`;
      }
    };

    const onEnd = (endEvent: PointerEvent) => {
      endEvent.preventDefault();
      endEvent.stopPropagation();
      endEvent.stopImmediatePropagation();

      window.removeEventListener('pointermove', onMove, true);
      window.removeEventListener('pointerup', onEnd, true);
      window.removeEventListener('pointercancel', onEnd, true);

      const finalLeft = Number.parseFloat(wrapper.style.left || '0') || 0;
      const finalTop = Number.parseFloat(wrapper.style.top || '0') || 0;
      const finalWidth = wrapper.getBoundingClientRect().width;
      const finalHeight = wrapper.getBoundingClientRect().height;
      const finalRotation = Number.parseFloat(wrapper.style.rotate || '0') || 0;

      setReactNumberInput('Posição X', finalLeft);
      setReactNumberInput('Posição Y', finalTop);
      setReactNumberInput('Largura', finalWidth);
      setReactNumberInput('Altura', finalHeight);
      setReactNumberInput('Rotação (°)', finalRotation);
    };

    window.addEventListener('pointermove', onMove, true);
    window.addEventListener('pointerup', onEnd, true);
    window.addEventListener('pointercancel', onEnd, true);
  };

  wrapper.addEventListener(
    'pointerdown',
    (event) => {
      if (resizeHandle?.contains(event.target as Node) || rotateHandle?.contains(event.target as Node)) return;
      startInteraction(event, 'move');
    },
    true
  );

  resizeHandle?.addEventListener('pointerdown', (event) => startInteraction(event, 'resize'), true);
  rotateHandle?.addEventListener('pointerdown', (event) => startInteraction(event, 'rotate'), true);
};

const observer = new MutationObserver(() => initInvoiceLogoEditor());

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    initInvoiceLogoEditor();
    observer.observe(document.body, { childList: true, subtree: true });
  });
} else {
  initInvoiceLogoEditor();
  observer.observe(document.body, { childList: true, subtree: true });
}
