# VHS cassette — the ax-ray launch GIF.
#
# Usage:
#   brew install vhs                  # one-time
#   npm run build                     # produce dist/ for the local "ax-ray" alias below
#   vhs cassette.tape                 # produces launch.gif in the repo root
#
# The recording runs the dual-surfaced demo report (--demo --connect):
# attestation band at the top, severity-grouped findings below, in one
# screen. Remediation (--how-to-fix) is intentionally NOT in this GIF —
# it's a second-step reveal worth its own asset.

Output launch.gif

Set FontSize 16
Set Width 1400
Set Height 920
Set Padding 32
Set Theme "Catppuccin Mocha"
Set TypingSpeed 40ms

# Pre-recording setup: alias `ax-ray` to the local built binary so the
# command on screen reads cleanly without `npx`. Hidden from the viewer.
Hide
Type 'alias ax-ray="node ./dist/cli.js"'
Enter
Sleep 300ms
Type "clear"
Enter
Sleep 300ms
Show

# Title card — short, sets context.
Type "# ax-ray — see what your AI agents can actually do."
Sleep 1200
Enter
Sleep 400

# The headline command.
Type "ax-ray --demo --connect"
Sleep 600
Enter

# Pause on the rendered report so viewers can read it.
Sleep 14s
