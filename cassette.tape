# VHS cassette — the ax-ray launch GIF.
#
# Usage:
#   brew install vhs                # or follow https://github.com/charmbracelet/vhs
#   vhs cassette.tape               # produces launch.gif in the repo root
#
# This recording runs --demo --connect --how-to-fix so the viewer sees:
#   1. the dual-surface report (OK/ATTESTED + findings)
#   2. expanded remediation including publisher-declared safer-mode hints
# No real machine state is touched (it's the synthetic demo path).

Output launch.gif

Set FontSize 14
Set Width 1200
Set Height 800
Set Padding 24
Set Theme "Catppuccin Mocha"
Set TypingSpeed 35ms

# Title card
Type "# ax-ray — see what your AI agents can actually do."
Sleep 1500
Enter
Sleep 500

Type "npx ax-ray --demo --connect --how-to-fix"
Sleep 800
Enter
Sleep 12s
