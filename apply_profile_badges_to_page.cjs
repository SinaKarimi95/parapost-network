const fs = require("fs");
const path = require("path");

const profilePath = path.join(process.cwd(), "app", "profile", "[id]", "page.tsx");
const backupPath = `${profilePath}.backup-before-badges`;

function fail(message) {
  console.error(`\n❌ ${message}\n`);
  process.exit(1);
}

function insertBefore(source, marker, insertion, label) {
  if (source.includes(insertion.trim().slice(0, 70))) {
    console.log(`✓ ${label} already exists`);
    return source;
  }

  if (!source.includes(marker)) {
    fail(`Could not find marker for ${label}`);
  }

  return source.replace(marker, `${insertion}\n${marker}`);
}

function insertAfter(source, marker, insertion, label) {
  if (source.includes(insertion.trim().slice(0, 70))) {
    console.log(`✓ ${label} already exists`);
    return source;
  }

  if (!source.includes(marker)) {
    fail(`Could not find marker for ${label}`);
  }

  return source.replace(marker, `${marker}\n${insertion}`);
}

function replaceOnce(source, search, replacement, label) {
  if (source.includes(replacement)) {
    console.log(`✓ ${label} already updated`);
    return source;
  }

  if (!source.includes(search)) {
    fail(`Could not find ${label}`);
  }

  return source.replace(search, replacement);
}

function findRightRailCardStart(source, headingText) {
  const headingIndex = source.indexOf(headingText);
  if (headingIndex === -1) return -1;

  return source.lastIndexOf('            <div style={rightPanelCardStyle}>', headingIndex);
}

function replaceRightRailCard(source, headingText, nextHeadingText, replacement, label) {
  if (source.includes(replacement.trim().slice(0, 90))) {
    console.log(`✓ ${label} card already updated`);
    return source;
  }

  const start = findRightRailCardStart(source, headingText);
  if (start === -1) {
    fail(`Could not find ${label} card`);
  }

  const nextHeadingIndex = source.indexOf(nextHeadingText, start + 1);
  if (nextHeadingIndex === -1) {
    fail(`Could not find card after ${label}`);
  }

  const end = source.lastIndexOf('            <div style={rightPanelCardStyle}>', nextHeadingIndex);
  if (end === -1 || end <= start) {
    fail(`Could not locate the end of ${label} card`);
  }

  return source.slice(0, start) + replacement + "\n\n" + source.slice(end);
}

if (!fs.existsSync(profilePath)) {
  fail(`Could not find ${profilePath}. Make sure you are inside C:\\Users\\bryan\\parapost-network`);
}

let source = fs.readFileSync(profilePath, "utf8");

if (!fs.existsSync(backupPath)) {
  fs.writeFileSync(backupPath, source, "utf8");
  console.log(`✓ Backup created: ${backupPath}`);
} else {
  console.log(`✓ Backup already exists: ${backupPath}`);
}

const badgeHelpers = `
type ProfileBadge = {
  awardId: string;
  badgeId: string;
  slug: string;
  name: string;
  description: string;
  icon: string;
  difficulty: string;
  accentColor: string;
  awardedAt: string | null;
};

type LooseBadgeRow = Record<string, any>;
type LooseUserBadgeRow = Record<string, any>;

function readBadgeString(row: LooseBadgeRow | null | undefined, keys: string[]) {
  if (!row) return "";

  for (const key of keys) {
    const value = row[key];

    if (typeof value === "string" && value.trim()) {
      return value.trim();
    }
  }

  return "";
}

function getBadgeDifficultyColor(difficulty?: string | null) {
  const value = (difficulty || "").toLowerCase();

  if (value.includes("hard")) return "#f97316";
  if (value.includes("medium")) return "#38bdf8";
  if (value.includes("easy")) return "#a855f7";

  return "#d8b4fe";
}

function normalizeProfileBadge(
  awardRow: LooseUserBadgeRow,
  badgeRow: LooseBadgeRow | null | undefined
): ProfileBadge | null {
  if (!badgeRow) return null;

  const badgeId = String(
    badgeRow.id ||
      awardRow.badge_id ||
      awardRow.badges_id ||
      awardRow.badge ||
      ""
  );

  if (!badgeId) return null;

  const name =
    readBadgeString(badgeRow, ["name", "title", "label", "badge_name"]) ||
    "Parapost Badge";

  const description =
    readBadgeString(badgeRow, ["description", "summary", "details"]) ||
    "Earned on Parapost Network.";

  const icon =
    readBadgeString(badgeRow, ["icon", "emoji", "icon_emoji", "badge_icon"]) ||
    "🏆";

  const difficulty =
    readBadgeString(badgeRow, ["difficulty", "tier", "level"]) || "Earned";

  const accentColor =
    readBadgeString(badgeRow, [
      "accent_color",
      "color",
      "badge_color",
      "hex_color",
      "theme_color",
    ]) || getBadgeDifficultyColor(difficulty);

  const awardedAt =
    readBadgeString(awardRow, ["awarded_at", "created_at", "earned_at"]) || null;

  return {
    awardId: String(awardRow.id || \`\${awardRow.user_id || "user"}-\${badgeId}\`),
    badgeId,
    slug:
      readBadgeString(badgeRow, ["slug", "key", "code", "badge_key"]) ||
      badgeId,
    name,
    description,
    icon,
    difficulty,
    accentColor,
    awardedAt,
  };
}

function sortProfileBadges(badges: ProfileBadge[]) {
  return [...badges].sort((a, b) => {
    const bTime = b.awardedAt ? new Date(b.awardedAt).getTime() : 0;
    const aTime = a.awardedAt ? new Date(a.awardedAt).getTime() : 0;

    return bTime - aTime;
  });
}

async function loadEarnedProfileBadges(targetProfileId: string) {
  if (!targetProfileId) return [];

  const { data: joinedRows, error: joinedError } = await supabase
    .from("user_badges")
    .select("*, badges(*)")
    .eq("user_id", targetProfileId);

  if (!joinedError && Array.isArray(joinedRows)) {
    const mapped = joinedRows
      .map((awardRow) => {
        const linkedBadge = Array.isArray(awardRow.badges)
          ? awardRow.badges[0]
          : awardRow.badges;

        return normalizeProfileBadge(awardRow, linkedBadge);
      })
      .filter(Boolean) as ProfileBadge[];

    return sortProfileBadges(mapped);
  }

  const { data: awardRows, error: awardError } = await supabase
    .from("user_badges")
    .select("*")
    .eq("user_id", targetProfileId);

  if (awardError || !Array.isArray(awardRows) || awardRows.length === 0) {
    if (awardError) {
      console.warn("Could not load user badges:", awardError.message);
    }

    return [];
  }

  const badgeIds = [
    ...new Set(
      awardRows
        .map((row) => String(row.badge_id || row.badges_id || row.badge || ""))
        .filter(Boolean)
    ),
  ];

  if (badgeIds.length === 0) return [];

  const { data: badgeRows, error: badgeError } = await supabase
    .from("badges")
    .select("*")
    .in("id", badgeIds);

  if (badgeError || !Array.isArray(badgeRows)) {
    if (badgeError) {
      console.warn("Could not load badge catalog:", badgeError.message);
    }

    return [];
  }

  const badgeMap = new Map(
    badgeRows.map((badgeRow) => [String(badgeRow.id), badgeRow])
  );

  const mapped = awardRows
    .map((awardRow) => {
      const badgeId = String(awardRow.badge_id || awardRow.badges_id || awardRow.badge || "");
      return normalizeProfileBadge(awardRow, badgeMap.get(badgeId));
    })
    .filter(Boolean) as ProfileBadge[];

  return sortProfileBadges(mapped);
}
`;

source = insertBefore(
  source,
  "function mapProfileShowcaseRow(row: ProfileShowcaseRow): ProfileShowcase {",
  badgeHelpers,
  "badge helpers"
);

source = insertAfter(
  source,
  "  const [profileShowcases, setProfileShowcases] = useState<ProfileShowcase[]>([]);\n  const [showcasesLoaded, setShowcasesLoaded] = useState(false);",
  "  const [profileBadges, setProfileBadges] = useState<ProfileBadge[]>([]);\n  const [profileBadgesLoading, setProfileBadgesLoading] = useState(false);",
  "badge state"
);

source = replaceOnce(
  source,
  '    setLoading(true);\n    setErrorMessage("");',
  '    setLoading(true);\n    setErrorMessage("");\n    setProfileBadgesLoading(true);\n    const profileBadgesPromise = loadEarnedProfileBadges(profileId);',
  "badge loading start"
);

source = insertBefore(
  source,
  "    if (profileResult.error) {",
  "    const nextProfileBadges = await profileBadgesPromise;\n    setProfileBadges(nextProfileBadges);\n    setProfileBadgesLoading(false);\n",
  "badge loading result"
);

source = replaceOnce(
  source,
  "      setSharedReelPosts([]);\n      setReels([]);\n      setLoading(false);\n      return;",
  "      setSharedReelPosts([]);\n      setReels([]);\n      setProfileBadges([]);\n      setProfileBadgesLoading(false);\n      setLoading(false);\n      return;",
  "badge error reset"
);

source = insertBefore(
  source,
  "  const activeProfileTabItem =",
  `  const featuredProfileBadges = profileBadges.slice(0, 4);
  const badgePreviewBubbles = profileBadges.slice(0, 5);
  const remainingProfileBadgeCount = Math.max(
    profileBadges.length - badgePreviewBubbles.length,
    0
  );
  const profileBadgePanelTitle = isOwnProfile ? "My Badges" : "Badges";
  const profileBadgePanelCount = profileBadgesLoading
    ? "Loading"
    : \`\${profileBadges.length} total\`;
`,
  "badge display variables"
);

const achievementsCard = `            <div style={rightPanelCardStyle}>
              <div style={rightPanelHeaderStyle}>
                <h3 style={rightPanelTitleStyle}>Achievements</h3>
                <span style={miniPurpleLinkStyle}>{profileBadgePanelCount}</span>
              </div>

              {profileBadgesLoading ? (
                <div style={profileBadgeEmptyStateStyle}>
                  Loading earned badges...
                </div>
              ) : featuredProfileBadges.length > 0 ? (
                <div style={profileBadgeGridStyle}>
                  {featuredProfileBadges.map((badge) => (
                    <div key={badge.awardId} style={profileRealBadgeItemStyle}>
                      <div
                        title={badge.name}
                        style={{
                          ...achievementIconStyle,
                          borderColor: badge.accentColor,
                          color: badge.accentColor,
                          background:
                            "linear-gradient(145deg, rgba(255,255,255,0.060), rgba(255,255,255,0.024))",
                        }}
                      >
                        {badge.icon}
                      </div>

                      <strong style={profileRealBadgeNameStyle}>{badge.name}</strong>
                      <span style={profileRealBadgeDifficultyStyle}>
                        {badge.difficulty}
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <div style={profileBadgeEmptyStateStyle}>
                  No badges earned yet.
                </div>
              )}
            </div>`;

source = replaceRightRailCard(
  source,
  '<h3 style={rightPanelTitleStyle}>Achievements</h3>',
  '<h3 style={rightPanelTitleStyle}>My Badges</h3>',
  achievementsCard,
  "Achievements"
);

const myBadgesCard = `            <div style={rightPanelCardStyle}>
              <div style={rightPanelHeaderStyle}>
                <h3 style={rightPanelTitleStyle}>{profileBadgePanelTitle}</h3>
                <span style={miniPurpleLinkStyle}>{profileBadgePanelCount}</span>
              </div>

              {profileBadgesLoading ? (
                <div style={profileBadgeEmptyStateStyle}>
                  Loading badges...
                </div>
              ) : badgePreviewBubbles.length > 0 ? (
                <div style={profileBadgeBubbleRowStyle}>
                  {badgePreviewBubbles.map((badge) => (
                    <div
                      key={badge.awardId}
                      title={\`\${badge.name} · \${badge.description}\`}
                      style={{
                        ...badgeBubbleStyle,
                        borderColor: badge.accentColor,
                        color: badge.accentColor,
                        background:
                          "linear-gradient(145deg, rgba(168,85,247,0.14), rgba(255,255,255,0.035))",
                      }}
                    >
                      {badge.icon}
                    </div>
                  ))}

                  {remainingProfileBadgeCount > 0 ? (
                    <div
                      style={{
                        ...badgeBubbleStyle,
                        color: "#d1d5db",
                        background: "rgba(255,255,255,0.06)",
                      }}
                    >
                      +{remainingProfileBadgeCount}
                    </div>
                  ) : null}
                </div>
              ) : (
                <div style={profileBadgeEmptyStateStyle}>
                  Earned badges will appear here.
                </div>
              )}
            </div>`;

source = replaceRightRailCard(
  source,
  '<h3 style={rightPanelTitleStyle}>My Badges</h3>',
  '<h3 style={rightPanelTitleStyle}>Recent Visitors</h3>',
  myBadgesCard,
  "My Badges"
);

const badgeStyles = `
const profileBadgeGridStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
  gap: "10px",
};

const profileRealBadgeItemStyle: CSSProperties = {
  display: "grid",
  justifyItems: "center",
  gap: "6px",
  minWidth: 0,
  textAlign: "center",
  color: "#d1d5db",
  fontSize: "10px",
  lineHeight: 1.2,
};

const profileRealBadgeNameStyle: CSSProperties = {
  width: "100%",
  maxWidth: "100%",
  color: "#f8fafc",
  fontSize: "10px",
  fontWeight: 950,
  lineHeight: 1.14,
  overflow: "hidden",
  textOverflow: "ellipsis",
  display: "-webkit-box",
  WebkitLineClamp: 2,
  WebkitBoxOrient: "vertical",
};

const profileRealBadgeDifficultyStyle: CSSProperties = {
  color: "#9ca3af",
  fontSize: "9px",
  fontWeight: 850,
  textTransform: "uppercase",
  letterSpacing: "0.05em",
};

const profileBadgeBubbleRowStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: "9px",
  flexWrap: "wrap",
};

const profileBadgeEmptyStateStyle: CSSProperties = {
  minHeight: "72px",
  display: "grid",
  placeItems: "center",
  borderRadius: "14px",
  border: "1px dashed rgba(255,255,255,0.12)",
  background: "rgba(255,255,255,0.030)",
  color: "#9ca3af",
  fontSize: "12px",
  fontWeight: 850,
  textAlign: "center",
  padding: "12px",
};
`;

source = insertAfter(
  source,
  `const achievementGridStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(4, minmax(0, 1fr))",
  gap: "8px",
};`,
  badgeStyles,
  "badge styles"
);

fs.writeFileSync(profilePath, source, "utf8");

console.log("");
console.log("✅ Profile badge update applied.");
console.log(`Updated: ${profilePath}`);
console.log(`Backup:  ${backupPath}`);
console.log("");
console.log("Next run:");
console.log("npm run dev");
