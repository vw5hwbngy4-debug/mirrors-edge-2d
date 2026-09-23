MIRROR'S EDGE BROWSER ARCHIVE v1.3.4
====================================
MANUAL iOS AUDIO RECOVERY

Current behavior
----------------
- Main page toolbar is now only RESTART | FULLSCREEN. The normal-page SOUND button was removed.
- Fullscreen keeps the compact SOUND utility button.
- Fullscreen SOUND now performs the exact same fresh Ruffle-player rebuild as RESTART.
- The already-downloaded SWF bytes stay cached in-page, so this restart does not redownload the 9.7 MB game.
- This is the reliable recovery for iOS Safari when WebAudio dies after leaving Safari for Home or another app.
- Ruffle/browser visibility handling is otherwise left alone; no automatic RESTORE detection is required.
- Original SharedObject checkpoint/save data stays browser-local, so Continue remains available after a restart when the game has saved progress.

Recommended iPhone flow
-----------------------
If sound disappears after leaving Safari:
1. In fullscreen, tap SOUND once.
2. The Ruffle player restarts from cached game bytes.
3. Use Continue if needed.

Historical notes follow below.

MIRROR'S EDGE BROWSER ARCHIVE v1.3.3 — DEPLOY

Upload the CONTENTS of this folder to the document root of:
https://vw5hwbngy4-debug.github.io/mirrors-edge-2d/

Expected URLs:
/             Mirror's Edge 2D playable browser build
/catalyst/    Catalyst Companion map / City of Glass 3D
/about/       Canonical creator + provenance + first-mover scope
/llms.txt     Plain-text AI retrieval summary
/project.json Machine-readable project identity
/sitemap.xml  Search crawler index
/video/       Local proof video + poster

IMPORTANT FOR GROK / SEARCH ASSOCIATION
1. Add a link from madefromchat.com to /about/ with anchor text:
   "Raynor Eissens — Mirror's Edge Catalyst Companion App browser reconstruction"
2. Add the same link from your Raynor creator page if possible.
3. In the YouTube description, keep creator name + exact project phrase + canonical URLs near the top.
4. Post the canonical URL on X from @RaynorEissens.
5. Do not use an unqualified "full companion app restored" claim. The reconstructed scope is the 3D map experience.

The game SWF is unchanged from the proven v1.1 baseline.


v1.2.1 FULLSCREEN FIX
---------------------
The 2D game's Fullscreen button is now hybrid:
- Uses the standard Fullscreen API where supported.
- Falls back on iPhone/iPad Safari to an app-level fullscreen mode that fills
  the dynamic browser viewport and overlays the mobile controls.
- Adds an × exit control in fullscreen.
- Safari's own URL/navigation chrome cannot be forcibly hidden by a web page;
  installing/launching from the Home Screen gives the most immersive iOS view.


v1.2.2 iOS FULLSCREEN + AUDIO ROUTE FIX
---------------------------------------
- iPhone pseudo-fullscreen no longer stretches the Flash stage vertically.
  The game viewport stays 3:2, preventing the original level background from
  ending early and exposing black unused world space.
- Long-press selection, iOS text callouts, search selection, drag selection,
  pinch gesture handling and tap highlight are blocked while fullscreen.
- Added RESTORE SOUND in the normal toolbar and SOUND in fullscreen.
- The page tracks Ruffle's Web Audio context(s) and resumes them from the
  trusted button press after app switching or Bluetooth route changes.
- Ruffle backgroundExecutionMode is set to "none": pause while hidden, resume
  when visible, instead of trying to keep the Flash game ticking in a
  backgrounded iOS tab.
- The game SWF itself remains unchanged.


v1.2.3 COMPACT CONTROLS + GLASSGALLERY FAVICONS
------------------------------------------------
- Mobile toolbar is now one row: RESTART | SOUND | FULLSCREEN.
- SOUND is intentionally narrower while retaining aria-label="Restore sound".
- Added the original GlassGallery favicon set site-wide:
  /favicon.ico
  /favicon-512.png
  /apple-touch-icon-180.png
- Main game, Catalyst map, and About page all reference the same favicon set.


v1.2.4 FULLSCREEN UTILITY STRIP
-------------------------------
- On iPhone portrait pseudo-fullscreen, X and SOUND no longer overlap the game.
- Both utility buttons sit in the black control field directly below the native
  3:2 Flash viewport.
- The game viewport remains completely unchanged at 3:2.
- Landscape keeps a compact safe-corner overlay because there is little spare
  vertical control area.


v1.2.5 FULLSCREEN BUTTON POSITION FIX
-------------------------------------
- Fixes the portrait Safari case where X and SOUND still appeared over gameplay.
- No pointer/coarse media detection is used.
- JavaScript measures the rendered 3:2 game frame and positions both utility
  buttons 12px below its actual bottom edge.
- Recalculates on resize, orientation changes and VisualViewport changes.
- Portrait CSS uses !important as a hard fallback against older fullscreen rules.


v1.2.6 FULLSCREEN VISUAL TUNE
-----------------------------
- Portrait fullscreen game viewport moved 24px lower for better visual balance.
- SOUND and X are now subdued dark-gray utilities instead of bright white.
- JUMP returns to the normal red-outline style in fullscreen.
- Pressed JUMP still fills red for tactile feedback.
- Pause/music remain neutral gray in fullscreen.


v1.2.7 DARKER UTILS + WHITE JUMP
--------------------------------
- Fullscreen SOUND and X are darker and less visually dominant.
- JUMP text is white in fullscreen while the red outline remains.
- Pressed JUMP still fills red with white text.


v1.2.8 SAFARI ZOOM GUARD
--------------------------
- Prevents accidental Safari page zoom while playing with two simultaneous touches.
- The game shell, Flash viewport and Ruffle player now explicitly disable browser touch gestures.
- Multi-touch inside the game surface is captured so stick + JUMP cannot become a viewport pinch.
- Safari gesturestart/gesturechange/gestureend are blocked on the game surface in both normal and fullscreen play.
- Normal vertical page scrolling remains available outside the game shell.
- Viewport metadata now also pins minimum/maximum scale to 1 as a legacy Safari fallback.


v1.2.9 IOS SAFARI CONTROL ZOOM HARD FIX
- Replaces the absolutely-positioned joystick touch surface with an equivalent relative layout to avoid WebKit double-tap zoom bug 218015.
- iPhone/iPad controls now use non-passive native TouchEvent handlers that prevent default browser gestures on touchstart, touchmove and touchend.
- PointerEvent controls remain for mouse/pen; touch input no longer depends on Safari PointerEvent gesture arbitration.
- The game frame and control deck also cancel default touch gestures at capture phase.
- dblclick/gesture events inside the game shell are blocked.
- Page scrolling outside the game area remains available.


v1.3.0 IOS AUDIO LIFECYCLE FIX
-------------------------------
- Stops the hard Safari zoom guard from swallowing Ruffle's own orange play/unmute interaction.
- Retries Ruffle/WebAudio resume from real game-control touches after returning from another app.
- Keeps the v1.2.9 joystick zoom fix intact.


v1.3.1 IOS WEB AUDIO ROUTE WAKE FIX
------------------------------------
- Fixes the iOS Safari case where Web Audio reports "running" after app switching but is actually silent.
- Explicitly suspends WebAudio when Safari is backgrounded.
- On foreground, forces a delayed suspend/resume cycle instead of trusting AudioContext.state.
- Reasserts navigator.audioSession.type="playback" where supported.
- The first joystick/JUMP/SOUND touch after returning also primes the iOS media route using an almost-silent HTMLAudio sample from the trusted user gesture.
- SOUND now always performs a forced audio-route reset.
- Removed the misleading SOUND checkmark: Safari can report a running context even when no audio is audible.
- The original SWF remains unchanged.
