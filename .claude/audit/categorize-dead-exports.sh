#!/bin/bash
# Categorize dead exports flagged by twicely-audit.sh wiring stream
# Each export is classified as:
#   TESTED   — has a test in __tests__ that calls it (FP-064)
#   TWIN     — has a sibling in packages/ with same name (FP-105)
#   DEAD     — neither tested nor twinned (genuine drift)

cd "$(git rev-parse --show-toplevel)/apps/web" || exit 1

# Parse the wiring output for "Dead export: NAME() in FILE"
INPUT="${1:-/tmp/wiring-output.txt}"

if [ ! -f "$INPUT" ]; then
  echo "Usage: $0 [path-to-wiring-output.txt]" >&2
  exit 1
fi

TESTED=0
TWIN=0
DEAD=0

while IFS= read -r LINE; do
  # Extract function name and file
  FUNC=$(echo "$LINE" | sed -n 's/.*Dead export: \([a-zA-Z_][a-zA-Z0-9_]*\)().*/\1/p')
  FILE=$(echo "$LINE" | sed -n 's/.*in \([a-zA-Z_-]*\.ts\).*/\1/p')
  [ -z "$FUNC" ] && continue
  [ -z "$FILE" ] && continue

  # Check 1: is the function called in any test file?
  HAS_TEST=$(grep -rl "\b$FUNC(" src/ ../../packages/ \
    --include="*.test.ts" --include="*.test.tsx" 2>/dev/null \
    | head -1)

  # Check 2: does a package twin exist with same function?
  HAS_TWIN=$(grep -rl "export.*function $FUNC\b" \
    ../../packages/ 2>/dev/null \
    | grep -v "test" | head -1)

  if [ -n "$HAS_TEST" ]; then
    echo "TESTED  $FUNC ($FILE)"
    TESTED=$((TESTED + 1))
  elif [ -n "$HAS_TWIN" ]; then
    echo "TWIN    $FUNC ($FILE)"
    TWIN=$((TWIN + 1))
  else
    echo "DEAD    $FUNC ($FILE)"
    DEAD=$((DEAD + 1))
  fi
done < <(grep "Dead export:" "$INPUT")

echo ""
echo "===== SUMMARY ====="
echo "TESTED (FP-064): $TESTED"
echo "TWIN   (FP-105): $TWIN"
echo "DEAD   (drift):  $DEAD"
echo "Total: $((TESTED + TWIN + DEAD))"
