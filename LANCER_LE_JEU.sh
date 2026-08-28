#!/usr/bin/env sh
DIR="$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)"
FILE="$DIR/PLAY_SON_OF_A_LEGACY_FORGE.html"
if command -v xdg-open >/dev/null 2>&1; then xdg-open "$FILE";
elif command -v open >/dev/null 2>&1; then open "$FILE";
else printf 'Ouvrez ce fichier dans votre navigateur : %s\n' "$FILE"; fi
