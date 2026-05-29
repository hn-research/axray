# VHS cassette — the ax-ray launch GIF.
#
# Usage:
#   brew install vhs
#   npm run build                 # ensures dist/ exists for the local alias
#   vhs cassette.tape             # produces launch.gif (and launch.mp4) at the repo root
#
# Three-act tour of the synthetic demo surface:
#   1. ax-ray --demo                     (default static report)
#   2. ax-ray --demo --connect           (same, plus live deep-mode findings)
#   3. ax-ray --demo --connect --how-to-fix
#                                        (same, plus per-finding remediation
#                                         including publisher-declared safer-mode hints)
# No real machine state is touched (synthetic demo path).

Output launch.gif
Output launch.mp4

Set FontSize 13
Set Width 1500
Set Height 2200
Set Padding 28
Set Theme "Catppuccin Mocha"
Set TypingSpeed 30ms

# Hidden setup: alias `ax-ray` to the local built binary so the command
# on screen reads cleanly without `npx`.
Hide
Type 'alias ax-ray="node ./dist/cli.js"'
Enter
Sleep 300ms
Type "clear"
Enter
Sleep 300ms
Show

# ── Act 1 — default static report ───────────────────────────────
Type "ax-ray --demo"
Sleep 500ms
Enter
Sleep 11s

Type "clear"
Enter
Sleep 400ms

# ── Act 2 — deep mode (--connect) adds D1/D2/D3 + P4 ────────────
Type "ax-ray --demo --connect"
Sleep 500ms
Enter
Sleep 13s

Type "clear"
Enter
Sleep 400ms

# ── Act 3 — expanded remediation with publisher safer-mode hints ─
Type "ax-ray --demo --connect --how-to-fix"
Sleep 500ms
Enter
Sleep 17s
