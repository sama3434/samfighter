/* The music indicator and its keys.

   A DOM strip under the canvas rather than anything drawn into the pixel
   buffer, so this never touches src/render/. It shows the track that is
   playing and the volume, brightens for a moment whenever either changes, and
   dims back down between times. It sat over the top-right of the canvas at
   first, which put it straight on top of player two's health bar. */

export const MUSIC_KEYS = { mute: 'n', down: '[', up: ']' };

const FLASH_MS = 1800;

export function installMusicUI(Music, { root = null, target = window } = {}) {
  if (typeof document === 'undefined') return null;
  const frame = root || document.getElementById('frame');

  const chip = document.createElement('div');
  chip.id = 'music-hud';
  chip.setAttribute('aria-live', 'polite');
  chip.innerHTML = '<b>♪</b><span class="track"></span><span class="vol"></span>'
    + '<span class="keys">N mute &nbsp; [ ] volume</span>';
  if (frame && frame.parentNode) frame.parentNode.insertBefore(chip, frame.nextSibling);
  else document.body.appendChild(chip);

  const trackEl = chip.querySelector('.track');
  const volEl = chip.querySelector('.vol');
  let flashUntil = 0;
  let raf = 0;

  function paint() {
    const muted = Music.muted || Music.volume === 0;
    trackEl.textContent = muted ? 'MUSIC OFF' : Music.trackName;
    volEl.textContent = muted ? '' : `${Math.round(Music.volume * 100)}%`;
    chip.classList.toggle('muted', muted);
  }

  function flash() {
    flashUntil = performance.now() + FLASH_MS;
    chip.classList.add('lit');
    if (!raf) raf = requestAnimationFrame(step);
  }

  function step() {
    if (performance.now() >= flashUntil) {
      chip.classList.remove('lit');
      raf = 0;
      return;
    }
    raf = requestAnimationFrame(step);
  }

  Music.onChange = () => { paint(); flash(); };
  paint();
  flash();

  target.addEventListener('keydown', (e) => {
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    const k = e.key.toLowerCase();
    if (k === MUSIC_KEYS.mute) Music.toggleMute();
    else if (k === MUSIC_KEYS.down) Music.nudgeVolume(-0.1);
    else if (k === MUSIC_KEYS.up) Music.nudgeVolume(0.1);
    else return;
    e.preventDefault();
    paint();
    flash();
  });

  return { chip, paint };
}
