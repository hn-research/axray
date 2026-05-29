# VHS cassette — ax-ray launch GIF.
#
# Uses `less -R` so the terminal stays at a normal readable size and the
# report scrolls page-by-page (Space). Color escapes preserved (-R);
# prompt string suppressed (-P "") for a clean bottom row.
#
# Usage:
#   brew install vhs
#   npm run build                   # ensures dist/ exists for the local alias
#   vhs cassette.tape               # produces launch.gif + launch.mp4

Output launch.gif
Output launch.mp4

Set FontSize 18
Set Width 1300
Set Height 900
Set Padding 28
Set Theme "Catppuccin Mocha"
Set TypingSpeed 35ms

# Hidden setup: alias the local built binary so the typed command stays clean.
Hide
Type 'alias ax-ray="node ./dist/cli.js"'
Enter
Sleep 300ms
Type "clear"
Enter
Sleep 300ms
Show

# Single command: pipe the full deep + remediation report through less
# so the viewer sees the top of the output first, then pages down.
Type 'ax-ray --demo --connect --how-to-fix | less -R -P ""'
Sleep 500ms
Enter

# Page 1 — header, AGENT CLIENTS, OK / ATTESTED, top of severity blocks
Sleep 6s
Space

# Page 2 — more findings
Sleep 5s
Space

# Page 3 — INFO findings tail / top of HOW TO FIX
Sleep 5s
Space

# Page 4 — HOW TO FIX detail (safer-mode hints, etc.)
Sleep 6s
Space

# Page 5 — tail of HOW TO FIX
Sleep 5s

# Quit less
Type "q"
Sleep 500ms
