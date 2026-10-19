import { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowDown, ArrowRight, AudioLines, Armchair, Check, ChevronDown, CircleDot, CircleHelp, Disc3, Headphones, Music2, PartyPopper, Play, Settings2, Shield, Sparkles, Timer, Volume2, Video, Waves, Wind, Zap } from 'lucide-react';
import { MUSIC_LIBRARY } from './config/musicLibrary';
import { DEFAULT_MUSIC_VOLUME } from './config/musicSettings';
import { GameStage } from './components/GameStage';
import { MusicLibrary } from './components/MusicLibrary';
import { YouTubePlayerSurface } from './components/YouTubePlayerSurface';
import { YouTubePlaylistInfo } from './components/YouTubePlaylistInfo';
import { ThemeToggle } from './components/ThemeToggle';
import { ToggleRow } from './components/ToggleRow';
import { useGameEngine } from './hooks/useGameEngine';
import { useMusicPlayer } from './hooks/useMusicPlayer';
import { useYouTubePlayer } from './hooks/useYouTubePlayer';
import { useTheme } from './hooks/useTheme';
import type { PauseBounds } from './types/game';
import type { MusicPlaylist } from './types/music';
import { normalizeBounds } from './utils/randomInterval';
import './styles.css';
import './youtube.css';

type MusicSource = 'built-in' | 'youtube';
type GameMode = 'Musical Chairs' | 'Pass the Ball' | 'Freeze Dance' | 'Custom Game';
type PresetId = 'quick' | 'balanced' | 'suspense' | 'custom';

interface Preferences {
  source: MusicSource;
  mode: GameMode;
  preset: PresetId;
  bounds: PauseBounds;
  humor: boolean;
  soundEffects: boolean;
  suspensePulse: boolean;
  reducedMotion: boolean;
}

const PRESETS: { id: Exclude<PresetId, 'custom'>; label: string; detail: string; bounds: PauseBounds; icon: typeof Zap }[] = [
  { id: 'quick', label: 'Quick Chaos', detail: '20–35 sec', bounds: { minSeconds: 20, maxSeconds: 35 }, icon: Zap },
  { id: 'balanced', label: 'Balanced', detail: '20–75 sec', bounds: { minSeconds: 20, maxSeconds: 75 }, icon: Waves },
  { id: 'suspense', label: 'Long Suspense', detail: '45–75 sec', bounds: { minSeconds: 45, maxSeconds: 75 }, icon: Timer },
];

const PAUSE_LINES = [
  'Too slow? The chair has chosen.',
  'The ball is judging your decisions.',
  'The silence is suspicious.',
  'Someone definitely panicked.',
  'Quick! Look like that was part of the plan.',
];

const MODES: { name: GameMode; caption: string; icon: typeof Armchair }[] = [
  { name: 'Musical Chairs', caption: 'Claim your seat', icon: Armchair },
  { name: 'Pass the Ball', caption: 'Keep it moving', icon: CircleDot },
  { name: 'Freeze Dance', caption: 'Strike a pose', icon: Wind },
  { name: 'Custom Game', caption: 'Make up the rules', icon: Sparkles },
];

function loadPreferences(): Preferences {
  const fallback: Preferences = {
    source: 'built-in', mode: 'Musical Chairs', preset: 'balanced',
    bounds: { minSeconds: 20, maxSeconds: 75 }, humor: true, soundEffects: true, suspensePulse: true,
    reducedMotion: window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false,
  };
  try {
    const raw = localStorage.getItem('pause-party-preferences');
    if (!raw) return fallback;
    const saved = JSON.parse(raw) as Partial<Preferences>;
    return {
      ...fallback,
      ...saved,
      source: saved.source === 'youtube' ? 'youtube' : 'built-in',
      bounds: saved.bounds ? normalizeBounds(saved.bounds) : fallback.bounds,
    };
  } catch {
    return fallback;
  }
}

function formatSeconds(seconds: number): string {
  if (seconds < 60) return `${seconds}s`;
  return `${Math.floor(seconds / 60)}m ${seconds % 60 ? `${seconds % 60}s` : ''}`.trim();
}

export default function App() {
  const { theme, setTheme } = useTheme();
  const { provider: builtInProvider, playback: builtInPlayback } = useMusicPlayer();
  const { provider: youtubeProvider, playback: youtubePlayback } = useYouTubePlayer();
  const [preferences, setPreferences] = useState<Preferences>(loadPreferences);
  const [selectedPlaylistId, setSelectedPlaylistId] = useState<string | null>(MUSIC_LIBRARY[0]?.id ?? null);
  const [customMin, setCustomMin] = useState(String(preferences.bounds.minSeconds));
  const [customMax, setCustomMax] = useState(String(preferences.bounds.maxSeconds));
  const [customTimingError, setCustomTimingError] = useState<string | null>(null);
  const [shuffle, setShuffle] = useState(false);
  const [repeat, setRepeat] = useState(true);
  const [volume, setVolume] = useState(DEFAULT_MUSIC_VOLUME);
  const [pauseLine, setPauseLine] = useState(PAUSE_LINES[0]);
  const [extrasOpen, setExtrasOpen] = useState(false);
  const audioContextRef = useRef<AudioContext | null>(null);
  const previousGameState = useRef<string>('IDLE');

  const bounds = preferences.bounds;
  const provider = preferences.source === 'youtube' ? youtubeProvider : builtInProvider;
  const playback = preferences.source === 'youtube' ? youtubePlayback : builtInPlayback;
  const { engine, game } = useGameEngine(provider, bounds);
  const selectedPlaylist = useMemo(() => MUSIC_LIBRARY.find((playlist) => playlist.id === selectedPlaylistId) ?? null, [selectedPlaylistId]);

  useEffect(() => {
    if (selectedPlaylist) builtInProvider.loadPlaylist(selectedPlaylist);
  }, [builtInProvider, selectedPlaylist]);

  useEffect(() => {
    try { localStorage.setItem('pause-party-preferences', JSON.stringify(preferences)); } catch { /* session-only preference */ }
    document.documentElement.dataset.motion = preferences.reducedMotion ? 'reduced' : 'full';
  }, [preferences]);

  useEffect(() => () => { void audioContextRef.current?.close(); }, []);

  useEffect(() => {
    if (previousGameState.current !== 'PAUSED_FOR_GAME' && game.state === 'PAUSED_FOR_GAME') {
      setPauseLine(PAUSE_LINES[Math.floor(Math.random() * PAUSE_LINES.length)]!);
      playCue('stop');
      if ('vibrate' in navigator) navigator.vibrate?.(80);
    }
    if (previousGameState.current !== 'PLAYING' && game.state === 'PLAYING') playCue('start');
    previousGameState.current = game.state;
  }, [game.state, preferences.soundEffects]);

  const updatePreferences = <K extends keyof Preferences>(key: K, value: Preferences[K]) => {
    setPreferences((current) => ({ ...current, [key]: value }));
  };

  const beginAudioContext = () => {
    if (!preferences.soundEffects || typeof window === 'undefined' || !('AudioContext' in window)) return;
    try {
      if (!audioContextRef.current) audioContextRef.current = new AudioContext();
      void audioContextRef.current.resume();
    } catch {
      // Audio cues are decorative; playback remains independent.
    }
  };

  const playCue = (kind: 'start' | 'stop') => {
    const context = audioContextRef.current;
    if (!preferences.soundEffects || !context || context.state !== 'running') return;
    try {
      const oscillator = context.createOscillator();
      const gain = context.createGain();
      const now = context.currentTime;
      oscillator.type = 'sine';
      oscillator.frequency.setValueAtTime(kind === 'stop' ? 660 : 523, now);
      oscillator.frequency.exponentialRampToValueAtTime(kind === 'stop' ? 330 : 784, now + 0.14);
      gain.gain.setValueAtTime(0.0001, now);
      gain.gain.exponentialRampToValueAtTime(0.06, now + 0.018);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.2);
      oscillator.connect(gain);
      gain.connect(context.destination);
      oscillator.start(now);
      oscillator.stop(now + 0.21);
    } catch {
      // Ignore devices that do not support optional sound effects.
    }
  };

  const startGame = () => {
    if (preferences.source === 'built-in' && !selectedPlaylist?.tracks.length) return;
    if (preferences.source === 'youtube' && (!youtubeProvider.hasLoadedMedia || youtubePlayback.status !== 'paused')) return;
    beginAudioContext();
    void engine.start();
  };

  const restartGame = () => {
    beginAudioContext();
    void engine.restart();
  };

  const setBoundsPreset = (preset: PresetId) => {
    if (preset === 'custom') {
      const minSeconds = Number(customMin);
      const maxSeconds = Number(customMax);
      if (!Number.isFinite(minSeconds) || !Number.isFinite(maxSeconds) || minSeconds > maxSeconds) {
        setCustomTimingError('Minimum must be smaller than or equal to maximum.');
        updatePreferences('preset', 'custom');
        return;
      }
      const safe = normalizeBounds({ minSeconds, maxSeconds });
      setCustomMin(String(safe.minSeconds));
      setCustomMax(String(safe.maxSeconds));
      setCustomTimingError(null);
      setPreferences((current) => ({ ...current, preset: 'custom', bounds: safe }));
      return;
    }
    const chosen = PRESETS.find((item) => item.id === preset)!;
    setCustomTimingError(null);
    setPreferences((current) => ({ ...current, preset, bounds: chosen.bounds }));
    setCustomMin(String(chosen.bounds.minSeconds));
    setCustomMax(String(chosen.bounds.maxSeconds));
  };

  const onCustomTimingChange = (field: 'minSeconds' | 'maxSeconds', raw: string) => {
    if (field === 'minSeconds') setCustomMin(raw);
    else setCustomMax(raw);
    setPreferences((current) => ({ ...current, preset: 'custom' }));
    const nextMin = Number(field === 'minSeconds' ? raw : customMin);
    const nextMax = Number(field === 'maxSeconds' ? raw : customMax);
    if (raw === '' || !Number.isFinite(nextMin) || !Number.isFinite(nextMax)) {
      setCustomTimingError('Enter a time between 5 seconds and 10 minutes.');
      return;
    }
    try {
      const safe = normalizeBounds({ minSeconds: nextMin, maxSeconds: nextMax });
      setCustomTimingError(null);
      updatePreferences('bounds', safe);
    } catch {
      setCustomTimingError('Minimum must be smaller than or equal to maximum.');
    }
  };

  const handlePlaylistSelect = (playlist: MusicPlaylist) => {
    if (selectedPlaylistId === playlist.id) return;
    setSelectedPlaylistId(playlist.id);
  };

  const selectSource = (source: MusicSource) => {
    if (gameActive) void engine.stop();
    if (source !== 'youtube') void youtubeProvider.pause();
    updatePreferences('source', source);
  };

  const canStart = (preferences.source === 'built-in' ? Boolean(selectedPlaylist?.tracks.length)
    : preferences.source === 'youtube' ? Boolean(youtubeProvider.hasLoadedMedia && youtubePlayback.status === 'paused')
      : false) && !(preferences.preset === 'custom' && customTimingError);
  const gameActive = ['READY', 'PLAYING', 'PAUSED_FOR_GAME', 'PAUSED_BY_USER'].includes(game.state);

  return (
    <div className={`app-shell ${game.state === 'PAUSED_FOR_GAME' ? 'app-frozen' : ''} ${gameActive ? 'game-session-active' : ''}`}>
      <div className="ambient ambient-one" /><div className="ambient ambient-two" /><div className="ambient ambient-three" />
      <header className="site-header content-width">
        <a className="brand-lockup" href="#top" aria-label="Pause Party home"><span className="brand-mark"><AudioLines size={19} strokeWidth={2.2} /></span><span className="brand-wordmark">pause<span>party</span><small>THE NO-DJ DJ</small></span></a>
        <nav className="header-nav" aria-label="Main navigation"><a href="#setup">Set up a game</a><a href="#how-it-works">How it works</a></nav>
        <ThemeToggle theme={theme} onChange={setTheme} />
      </header>

      <main id="top" className="content-width">
        <section className="hero-section">
          <div className="hero-copy">
            <div className="eyebrow"><span className="eyebrow-dot" /> GOOD TIMES. QUESTIONABLE TIMING.</div>
            <h1>Keep moving.<br /><span>Hope the music</span><br /><em>doesn’t stop.</em></h1>
            <p className="hero-description">The party has a DJ now. It’s your phone. Start the music, let the surprise pauses do their thing, and keep both hands free for the important stuff.</p>
            <div className="hero-actions"><button className="hero-start-button" onClick={startGame} type="button" disabled={!canStart || gameActive}><Play size={17} fill="currentColor" /> Start a game <ArrowRight size={16} /></button><a className="hero-secondary-button" href="#setup">Pick the playlist <ArrowDown size={14} /></a></div>
            <div className="hero-footnote"><span className="footnote-icon"><Shield size={15} /></span> No account. No DJ. No mercy for the last dancer.</div>
          </div>
          <div className="hero-art" aria-hidden="true">
            <div className="hero-art-glow" />
            <div className="orb-ring ring-one" /><div className="orb-ring ring-two" />
            <div className="floating-note note-one">♪</div><div className="floating-note note-two">♫</div>
            <div className="hero-disc"><div className="disc-grooves"><span /><span /><span /><span /><span /></div><div className="disc-label"><span>PP</span><i>side A</i></div><div className="disc-shine" /></div>
            <div className="orbit-dot dot-one" /><div className="orbit-dot dot-two" />
            <div className="hero-art-caption"><span className="caption-line" /> POWERED BY MUSIC. CONTROLLED BY CHAOS.</div>
          </div>
        </section>

        <section className="game-layout" aria-label="Game setup and music controls">
          <div className="setup-card glass-card" id="setup">
            <div className="section-heading"><div><span className="section-eyebrow">LET’S SET THE SCENE</span><h2>Make it your game.</h2></div><span className="setup-step">01 <i /> 02 <i /> 03</span></div>

            <section className="setup-section" aria-labelledby="mode-heading">
              <div className="setup-section-title"><span className="step-number">01</span><span><h3 id="mode-heading">Pick your game</h3><p>What kind of chaos are we making?</p></span></div>
              <div className="mode-grid" role="group" aria-labelledby="mode-heading">
                {MODES.map(({ name, caption, icon: Icon }) => <button type="button" key={name} className={`mode-option ${preferences.mode === name ? 'selected' : ''}`} onClick={() => updatePreferences('mode', name)} aria-pressed={preferences.mode === name}><span className="mode-icon"><Icon size={18} strokeWidth={1.8} /></span><span><strong>{name}</strong><small>{caption}</small></span>{preferences.mode === name && <Check size={14} className="mode-check" />}</button>)}
              </div>
            </section>

            <section className="setup-section" aria-labelledby="music-heading">
              <div className="setup-section-title"><span className="step-number">02</span><span><h3 id="music-heading">Choose your soundtrack</h3><p>Good music. Terrible timing.</p></span></div>
              <div className="source-switch" role="tablist" aria-label="Music source">
                <button type="button" role="tab" aria-selected={preferences.source === 'built-in'} className={preferences.source === 'built-in' ? 'active' : ''} onClick={() => selectSource('built-in')}><Disc3 size={15} /> Library <span className="source-ready">READY</span></button>
                <button type="button" role="tab" aria-selected={preferences.source === 'youtube'} className={preferences.source === 'youtube' ? 'active' : ''} onClick={() => selectSource('youtube')}><Video size={15} /> YouTube</button>
              </div>
              {preferences.source === 'built-in' ? <MusicLibrary playlists={MUSIC_LIBRARY} selectedId={selectedPlaylistId} playback={builtInPlayback} onSelectPlaylist={handlePlaylistSelect} onSelectTrack={(trackId) => builtInProvider.selectTrack(trackId)} />
                : <YouTubePlaylistInfo provider={youtubeProvider} playback={youtubePlayback} />}
            </section>

            <section className="setup-section timing-section" aria-labelledby="timing-heading">
              <div className="setup-section-title"><span className="step-number">03</span><span><h3 id="timing-heading">Set the suspense</h3><p>Every pause time is a fresh random pick.</p></span></div>
              <div className="preset-grid" role="group" aria-labelledby="timing-heading">
                {PRESETS.map(({ id, label, detail, icon: Icon }) => <button type="button" key={id} className={`preset-option ${preferences.preset === id ? 'selected' : ''}`} onClick={() => setBoundsPreset(id)} aria-pressed={preferences.preset === id}><span className="preset-icon"><Icon size={16} /></span><strong>{label}</strong><small>{detail}</small>{preferences.preset === id && <i className="preset-selected-dot" />}</button>)}
              </div>
              <button className={`custom-timing-toggle ${preferences.preset === 'custom' ? 'active' : ''}`} type="button" onClick={() => setBoundsPreset('custom')} aria-expanded={preferences.preset === 'custom'}><Settings2 size={15} /><span>Choose your own period</span><small>5 sec–10 min</small><ChevronDown size={14} /></button>
              {preferences.preset === 'custom' && <div className="custom-timing-fields"><label>Pause as soon as <span><input type="number" min="5" max="600" value={customMin} onChange={(event) => onCustomTimingChange('minSeconds', event.target.value)} aria-label="Minimum pause time" /> sec</span></label><span className="timing-dash">to</span><label>up to <span><input type="number" min="5" max="600" value={customMax} onChange={(event) => onCustomTimingChange('maxSeconds', event.target.value)} aria-label="Maximum pause time" /> sec</span></label><small className="timing-summary">{formatSeconds(bounds.minSeconds)}–{formatSeconds(bounds.maxSeconds)}, picked freshly each round</small></div>}
              {customTimingError && preferences.preset === 'custom' && <p className="field-error timing-error" role="alert">{customTimingError}</p>}
              <div className="timing-guarantee"><span className="guarantee-icon"><Timer size={15} /></span><span>Default: <strong>20–75 seconds</strong>. The clock follows the music, so buffering doesn’t eat your round.</span><CircleHelp size={15} aria-hidden="true" /></div>
            </section>

            <section className={`setup-section extras-section ${extrasOpen ? 'extras-open' : ''}`} aria-labelledby="extras-heading">
              <button className="extras-heading" type="button" onClick={() => setExtrasOpen((open) => !open)} aria-expanded={extrasOpen}><span><Settings2 size={16} /><strong id="extras-heading">Little extras</strong><small>Make the party yours</small></span><ChevronDown size={16} /></button>
              <div className="extras-content">
                <ToggleRow label="Playful commentary" description="Give the silence a little personality" checked={preferences.humor} onChange={(checked) => updatePreferences('humor', checked)} icon={<Sparkles size={16} />} />
                <ToggleRow label="Sound effects" description="Soft chime on stop and resume" checked={preferences.soundEffects} onChange={(checked) => updatePreferences('soundEffects', checked)} icon={<Volume2 size={16} />} />
                <ToggleRow label="Suspense pulse" description="A gentle glow before you manually resume" checked={preferences.suspensePulse ?? true} onChange={(checked) => updatePreferences('suspensePulse', checked)} icon={<Waves size={16} />} />
                <ToggleRow label="Reduced motion" description="Keep things calm and still" checked={preferences.reducedMotion} onChange={(checked) => updatePreferences('reducedMotion', checked)} icon={<Wind size={16} />} />
              </div>
            </section>
            {gameActive && <div className="settings-while-playing"><span className="settings-live-dot" /> Settings can be adjusted while the game is playing.</div>}
          </div>

          <div className="stage-column">
            <GameStage
              game={game}
              playback={playback}
              humor={preferences.humor}
              suspensePulse={preferences.suspensePulse ?? true}
              selectedMode={preferences.mode}
              onStart={startGame}
              onPause={() => void engine.pauseByUser()}
              onResume={() => { beginAudioContext(); void engine.resume(); }}
              onStop={() => void engine.stop()}
              onRestart={restartGame}
              onPrevious={() => provider.previous()}
              onNext={() => provider.next()}
              onShuffle={() => { const enabled = !shuffle; setShuffle(enabled); provider.setShuffle(enabled); }}
              shuffle={shuffle}
              repeat={repeat}
              onRepeat={() => { const enabled = !repeat; setRepeat(enabled); provider.setRepeat(enabled); }}
              volume={volume}
              onVolume={(value) => { setVolume(value); provider.setVolume(value); }}
              pauseLine={pauseLine}
              onPauseLineChange={() => setPauseLine(PAUSE_LINES[Math.floor(Math.random() * PAUSE_LINES.length)]!)}
              canStart={canStart}
              mediaPlayer={preferences.source === 'youtube' ? <YouTubePlayerSurface provider={youtubeProvider} /> : null}
              startHint={preferences.source === 'youtube' ? 'load a YouTube playlist first' : 'choose a built-in playlist'}
            />
            <div className="stage-footnote"><span className="stage-footnote-icon"><Headphones size={15} /></span><span>Plug in a speaker, then put the phone where everyone can see it.</span></div>
          </div>
        </section>

        <section className="how-section" id="how-it-works">
          <div className="how-intro"><span className="section-eyebrow">SIMPLE RULES. BIG REACTIONS.</span><h2>Three steps.<br /><em>Zero chill.</em></h2><p>One person starts the music. Everyone else hopes they have good reflexes.</p></div>
          <div className="how-steps"><article><span className="how-step-number">01</span><span className="how-icon"><Music2 size={20} /></span><h3>Pick the vibe</h3><p>Choose your game, soundtrack, and how long the music might keep going.</p></article><article><span className="how-step-number">02</span><span className="how-icon"><PartyPopper size={20} /></span><h3>Press play</h3><p>Everyone moves. Pause Party secretly picks a new time from your range.</p></article><article><span className="how-step-number">03</span><span className="how-icon"><Zap size={20} /></span><h3>Make your move</h3><p>Music stops. The room freezes. You decide when the next round starts.</p></article></div>
        </section>

        <footer className="site-footer"><a className="footer-brand" href="#top"><span className="brand-mark small"><AudioLines size={15} /></span> pauseparty</a><span>Made for the music. And the panic.</span><a href="#setup">Back to the party <ArrowDown size={13} className="back-to-top" /></a></footer>
      </main>
    </div>
  );
}
