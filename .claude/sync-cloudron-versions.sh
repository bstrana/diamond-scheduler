#!/usr/bin/env bash
# PostToolUse hook — auto-syncs CloudronVersions.json when CloudronManifest.json changes.
# Receives Claude tool JSON on stdin; exits silently if the edited file is not the manifest.

INPUT=$(cat)
FILE=$(echo "$INPUT" | jq -r '.tool_input.file_path // ""')

# Only act on CloudronManifest.json
[[ "$FILE" == *"CloudronManifest.json" ]] || exit 0

MANIFEST="$FILE"
VERSIONS="$(dirname "$FILE")/CloudronVersions.json"

[[ -f "$MANIFEST" ]] || exit 0
[[ -f "$VERSIONS" ]] || exit 0

VERSION=$(jq -r '.version' "$MANIFEST")
CHANGELOG=$(jq -r --arg v "$VERSION" '.changelog[$v] // ""' "$MANIFEST")

# Skip if this version is already recorded
EXISTS=$(jq -r --arg v "$VERSION" 'if .versions[$v] then "yes" else "" end' "$VERSIONS")
[[ -z "$EXISTS" ]] || exit 0

ID=$(jq -r '.id'             "$MANIFEST")
TITLE=$(jq -r '.title'       "$MANIFEST")
AUTHOR=$(jq -r '.author'     "$MANIFEST")
DESCRIPTION=$(jq -r '.description' "$MANIFEST")
TAGLINE=$(jq -r '.tagline'   "$MANIFEST")
WEBSITE=$(jq -r '.website'   "$MANIFEST")
CONTACT=$(jq -r '.contactEmail' "$MANIFEST")
HEALTH=$(jq -r '.healthCheckPath' "$MANIFEST")
PORT=$(jq -r '.httpPort'     "$MANIFEST")
MANIFEST_VER=$(jq -r '.manifestVersion' "$MANIFEST")
ICON_URL=$(jq -r '.iconUrl'  "$MANIFEST")

DATE=$(date -u +"%a, %d %b %Y 00:00:00 GMT")

TMP=$(mktemp)
jq --arg v           "$VERSION" \
   --arg id          "$ID" \
   --arg title       "$TITLE" \
   --arg author      "$AUTHOR" \
   --arg description "$DESCRIPTION" \
   --arg tagline     "$TAGLINE" \
   --arg website     "$WEBSITE" \
   --arg contact     "$CONTACT" \
   --arg health      "$HEALTH" \
   --argjson port    "$PORT" \
   --argjson mver    "$MANIFEST_VER" \
   --arg iconUrl     "$ICON_URL" \
   --arg changelog   "$CHANGELOG" \
   --arg date        "$DATE" \
   '.versions[$v] = {
     "manifest": {
       "id":               $id,
       "title":            $title,
       "author":           $author,
       "description":      $description,
       "tagline":          $tagline,
       "version":          $v,
       "website":          $website,
       "contactEmail":     $contact,
       "healthCheckPath":  $health,
       "httpPort":         $port,
       "dockerImage":      ("ghcr.io/bstrana/diamond-scheduler:" + $v),
       "addons":           { "localstorage": {} },
       "manifestVersion":  $mver,
       "minBoxVersion":    "9.1.0",
       "icon":             "file://appicon.png",
       "iconUrl":          $iconUrl,
       "tags":             ["sports","scheduling","calendar","league"],
       "mediaLinks":       [$iconUrl],
       "changelog":        $changelog,
       "postInstallMessage": "Diamond Scheduler is ready. Set VITE_KEYCLOAK_URL, VITE_KEYCLOAK_REALM, and VITE_KEYCLOAK_CLIENT_ID in the app'\''s environment variables, then restart.",
       "packagerName":     "bstrana",
       "packagerUrl":      "https://github.com/bstrana"
     },
     "creationDate": $date,
     "ts":           $date,
     "publishState": "published"
   }' "$VERSIONS" > "$TMP" && mv "$TMP" "$VERSIONS"

echo "✓ CloudronVersions.json: added v$VERSION"
