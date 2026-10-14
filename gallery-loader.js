/* Load the local 3D bundle only when the visitor enters the gallery. */
(() => {
  const button = document.querySelector('#gallery-enter');
  const frame = document.querySelector('#gallery-frame');
  let bundlePromise;
  button.addEventListener('click', async () => {
    button.disabled = true;
    button.textContent = '正在走近洞口…';
    frame.dataset.state = 'loading';
    document.querySelector('#gallery-entry-message').textContent = '正在准备洞口与洞内空间，请稍候。';
    try {
      if (!bundlePromise) bundlePromise = new Promise((resolve, reject) => {
        const script = document.createElement('script');
        script.src = 'gallery.bundle.js?v=20261014-arrival';
        script.onload = resolve;
        script.onerror = () => { script.remove(); bundlePromise = null; reject(new Error('bundle')); };
        document.head.append(script);
      });
      await bundlePromise;
      await window.QianbiGallery.enter();
    } catch (error) {
      frame.dataset.state = 'error';
      document.querySelector('#gallery-entry-message').textContent = '暂时无法打开原位构视，可重试或继续细读画卷。';
      document.querySelector('#gallery-status').textContent = '原位构视暂不可用。下方的壁画探索仍可使用。';
    } finally {
      button.disabled = false;
      button.innerHTML = '抵达洞口 <span aria-hidden="true">↗</span>';
    }
  });
})();
