/**
 * Silent-audio anchor — gives the TOP-LEVEL PAGE an active audio stream so
 * Chrome Android routes its media-notification to OUR Media Session (with
 * prev/next buttons) instead of the YouTube iframe's session (pause-only).
 *
 * Background
 * ----------
 * Chrome Android has special YouTube-embed handling: when a youtube.com iframe
 * is the active audio producer, Chrome shows a YouTube-style notification that
 * only contains [⏸] + seek bar — our setActionHandler('nexttrack') registrations
 * are silently ignored. The fix is to claim audio focus by playing a 1-frame
 * silent WAV on the main page. Once Chrome sees our page as the audio source,
 * it uses our Media Session for the lock-screen notification, revealing [⏮][⏸][⏭].
 *
 * Usage
 * -----
 * Call startSilentAudio() inside a user-gesture handler (play-button onClick)
 * — Android's autoplay policy blocks audio.play() outside of gestures.
 * The call is idempotent; subsequent calls are no-ops once started.
 */

// Minimal 44-byte RIFF/WAV — 1 channel, 44.1 kHz, 16-bit, 2 samples of silence.
const SILENT_WAV =
  'data:audio/wav;base64,' +
  'UklGRigAAABXQVZFZm10IBAAAAABAAEARKwAAIhYAQACABAAZGF0YQQAAAAAAA==';

let _audio: HTMLAudioElement | null = null;
let _started = false;

export function startSilentAudio(): void {
  if (typeof window === 'undefined' || _started) return;
  if (!_audio) {
    _audio = new Audio(SILENT_WAV);
    _audio.loop   = true;
    _audio.volume = 0;
  }
  _audio
    .play()
    .then(() => { _started = true; })
    .catch(() => { /* autoplay blocked — will retry on next gesture */ });
}

/**
 * Module-level ref to assertMediaSession() from page.tsx.
 * Lets any component call it synchronously inside a user-gesture handler
 * without prop-drilling, mirroring the ytCommand pattern.
 */
export const msAssert: { fn: (() => void) | null } = { fn: null };
