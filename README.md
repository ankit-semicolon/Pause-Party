# Pause Party

Pause Party is a responsive music controller for Musical Chairs, Pass the Ball, Freeze Dance, and other games that need surprise music stops. It plays a small original soundtrack out of the box, chooses a fresh random interval for each round, pauses the real audio player, and waits for a person to press **Resume Music**.

Developed with AI-assisted coding, with personal direction, testing and interative refinement.

## Run it locally

You need Node.js 20.19 or newer and pnpm (npm works too).

```sh
pnpm install
pnpm dev
```

Open the local URL printed by Vite. To build and preview a production bundle:

```sh
pnpm build
pnpm preview
```

Run the automated tests with:

```sh
pnpm test
```

No environment variables are needed for built-in music. There is no `.env.example` because this project does not require a secret or API credential.

## Add your own playlists and songs

1. Copy audio files you have permission to use into `public/audio/` (create the folder if needed). MP3, WAV, Ogg, and AAC are supported by most current browsers. Locally hosted files are the most reliable choice. If you use a remote host, it must permit browser playback and should use HTTPS.
2. Add a playlist and its tracks to [`src/config/musicLibrary.ts`](src/config/musicLibrary.ts). That is the only music-library configuration file; the game engine and UI read from it.
3. Put optional artwork in `public/art/` and set `coverImage` to a root-relative path such as `/art/summer-party.jpg`.
4. Restart the development server if needed and select the playlist in the app.

Example entry:

```ts
{
  id: 'summer-party',
  name: 'Summer Party',
  description: 'Sunny songs for suspiciously competitive dancing.',
  coverImage: '/art/summer-party.jpg',
  tracks: [
    {
      id: 'my-track',
      title: 'My Track',
      artist: 'Your Name',
      audioUrl: '/audio/my-track.mp3',
      duration: 184,
      category: 'Party',
    },
  ],
}
```

Audio URLs must be direct audio files that your browser is allowed to play. Do not use a streaming-service page URL, extract audio from a streaming service, or add music unless you have the necessary rights. The included `Sugar Rush Shuffle` is an original synthesized loop created for this project.

The player supports track selection, next/previous, shuffle, repeat, and volume. Repeat starts enabled, so a single-track playlist can continue through long pause windows. If you turn repeat off, a track ending moves the game into a user-paused state; the game never silently starts the next one.

## Pause timing

- **Quick Chaos:** 20–35 seconds.
- **Balanced (default):** 20–75 seconds.
- **Long Suspense:** 45–75 seconds.
- **Custom:** 5 seconds through 10 minutes, with a minimum that cannot exceed the maximum.

Each round uses a fresh cryptographically generated integer in the selected inclusive range. The game engine counts changes in the audio element's playback position, not elapsed wall time. Paused and buffering time is excluded. It checks playback again when a suspended tab becomes visible. If the browser delays media events while a tab or device is asleep, the stop can happen as soon as the browser processes the next playback update; a game pause never resumes automatically.

The game screen does not show a playback countdown or progress bar, so the selected interval stays a surprise to players.

Changing timing bounds during an active round begins a fresh random window from the time of that edit. Stop ends the current game and detaches its playback and page-visibility listeners. Restart explicitly starts a new round.

The optional suspense pulse adds a soft glow to the manual resume button; it never delays or triggers playback. Reduced motion turns that animation off.

## YouTube songs and playlists

Choose **YouTube** as the source and paste either a single song/video link (such as `music.youtube.com/watch?v=...` or `youtu.be/...`) or a playlist link (such as `music.youtube.com/playlist?list=...`), then load it. A single video is cued with YouTube's official IFrame Player API and starts only when **Start Game** is pressed; playlist links cue the playlist without starting early. No API key or account sign-in is needed for a shareable video or playlist. The player itself supplies video titles and playback information; playlist details are not fetched through the YouTube Data API.

YouTube playback is supported only in the visible, branded video player shown in the game stage. YouTube controls and ads remain available. The game can pause/resume the player using its documented controls, but it does not extract audio or keep YouTube playing in a background tab. Public or unlisted playlists are most likely to work; private playlists, removed videos, restricted tracks, embed-disabled videos, autoplay restrictions, or network/browser limitations can prevent playback. A normal HTTPS deployment is required so the player can identify its embedding page. Selecting the YouTube source loads Google's player code; its standard playback data collection and privacy practices apply. See Google's [IFrame Player API](https://developers.google.com/youtube/iframe_api_reference), [player requirements](https://developers.google.com/youtube/terms/required-minimum-functionality), and [developer policies](https://developers.google.com/youtube/terms/developer-policies).

### Fixing YouTube player Error 153

Error 153 means YouTube did not receive the page's referrer or other client identification. The app explicitly uses the recommended `strict-origin-when-cross-origin` referrer policy. If you opened `outputs/Pause Party.html` directly from your files, YouTube playback cannot work there because a `file://` page has no normal website origin. Use the GitHub Pages HTTPS address after publishing, or start the development server and open its `http://localhost:...` address. The standalone file remains useful for the built-in soundtrack and displays this explanation instead of a broken player. Also check that browser privacy settings or an extension are not stripping referrer information.

## Browser notes

- Audio starts only after the user presses Start, subject to the browser's autoplay rules.
- The included original WAV is served locally and does not require a network connection.
- YouTube song and playlist playback requires an internet connection and an on-screen embedded video; some videos or playlists may block playback.
- HTML5 audio and pause timing work in current desktop and mobile browsers. iOS may apply its own speaker-volume and background-playback rules.
- Playback position events are the timing source. When a device suspends the page, JavaScript cannot run until the browser wakes it; the engine reconciles the current audio position on the next media update or page visibility event.
- The sound-wave bars are decorative rather than frequency measurements. This avoids routing externally hosted audio through Web Audio, which can make cross-origin audio silent when a host does not grant CORS access.
- The selected theme and game preferences are stored locally in the browser. Audio files are loaded from the project or their configured URL.

## Project map

```text
src/
  components/       Game controls, library, visuals, and theme
  config/           Built-in playlists and tracks
  hooks/            Theme, player, and game subscriptions
  services/game/    Playback-progress-driven game state machine
  services/music/   HTML5 built-in and YouTube IFrame providers
  types/            Provider, playback, and game state types
  utils/            Secure random intervals and time formatting
  styles.css        Responsive glass UI and both color themes
public/audio/       Original sample audio and your added music
public/art/         Playlist artwork
```
