import { execFileSync } from "node:child_process";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import sharp from "sharp";

const WIDTH = 1920;
const HEIGHT = 1080;
const FPS = 30;
const TRANSITION_SECONDS = 0.45;
const PALETTE = {
  cobalt: "#0029da",
  sky: "#0094fa",
  pale: "#f1f5f9",
  muted: "#484a4b",
  red: "#f1012f",
  navy: "#020e4e",
  white: "#ffffff",
  stroke: "#d9d9d9",
  surface: "#e3e7ef",
};

const scenes = [
  {
    eyebrow: "A MERKLE TOOL  /  PROJECT ESTIMATION",
    title: "Great projects\nstart with clear scope.",
    voice:
      "Feasibly gives pre-sales and delivery teams a clearer way to build project estimates, without rebuilding scope from scratch in spreadsheets.",
    image: (c) => `
      <rect width="1920" height="1080" fill="${c.navy}"/>
      <circle cx="1640" cy="130" r="420" fill="${c.cobalt}"/>
      <circle cx="1745" cy="1010" r="260" fill="${c.sky}" opacity=".72"/>
      ${brandMark(150, 108, 58, c.red)}
      ${text(238, 143, "Feasibly", 32, c.white, 700)}
      ${text(150, 250, "A MERKLE TOOL  /  PROJECT ESTIMATION", 20, "#b2bff4", 700, 2)}
      ${multilineText(150, 405, ["Great projects", "start with clear scope."], 82, c.white, 700, 1.06)}
      ${text(155, 635, "A guided way to shape and share project estimates", 28, "#dce4ff", 400)}
      ${text(155, 680, "before delivery begins.", 28, "#dce4ff", 400)}
      <g transform="translate(1115 330) rotate(-6)">
        <rect x="0" y="0" width="555" height="126" rx="20" fill="#ffffff"/>
        <circle cx="58" cy="63" r="20" fill="${c.red}"/>
        ${text(104, 74, "Clear project scope", 28, c.navy, 700)}
        <rect x="0" y="150" width="555" height="126" rx="20" fill="#ffffff" opacity=".92"/>
        <circle cx="58" cy="213" r="20" fill="${c.sky}"/>
        ${text(104, 224, "Effort you can explain", 28, c.navy, 700)}
        <rect x="0" y="300" width="555" height="126" rx="20" fill="#ffffff" opacity=".84"/>
        <circle cx="58" cy="363" r="20" fill="${c.cobalt}"/>
        ${text(104, 374, "A shareable estimate", 28, c.navy, 700)}
      </g>
      ${footer(1, "START WITH CLARITY", c.white, "#b2bff4")}`,
  },
  {
    eyebrow: "01  /  SET UP THE PROJECT",
    title: "Start with the project.\nNot another spreadsheet.",
    voice:
      "Start with a project and choose components, templates, or both. If a live site exists, add it. For a new build, start without one.",
    image: (c) => `
      <rect width="1920" height="1080" fill="${c.pale}"/>
      <path d="M1350 0h570v1080h-570z" fill="${c.cobalt}"/>
      <circle cx="1850" cy="80" r="290" fill="${c.sky}" opacity=".72"/>
      ${text(145, 150, "01  /  SET UP THE PROJECT", 20, c.cobalt, 700, 2)}
      ${multilineText(145, 295, ["Start with the project.", "Not another", "spreadsheet."], 66, c.navy, 700, 1.1)}
      ${text(150, 565, "Choose the scope that fits the work.", 28, c.muted, 400)}
      ${text(150, 610, "Use a live site when you have one, or begin", 26, c.muted, 400)}
      ${text(150, 650, "with a blank scope for a new build.", 26, c.muted, 400)}
      <rect x="1045" y="220" width="680" height="620" rx="26" fill="#ffffff"/>
      ${text(1100, 295, "NEW PROJECT", 17, c.muted, 700, 1.8)}
      ${text(1100, 365, "Project name", 19, c.navy, 600)}
      <rect x="1100" y="390" width="570" height="72" rx="14" fill="#ffffff" stroke="${c.stroke}" stroke-width="2"/>
      ${text(1128, 437, "Spring campaign", 21, c.muted, 400)}
      ${text(1100, 515, "Live site (optional)", 19, c.navy, 600)}
      <rect x="1100" y="540" width="570" height="72" rx="14" fill="#ffffff" stroke="${c.stroke}" stroke-width="2"/>
      ${text(1128, 587, "Add a website URL", 21, "#8b9099", 400)}
      <rect x="1100" y="664" width="250" height="76" rx="16" fill="#e8eeff"/>
      <rect x="1370" y="664" width="300" height="76" rx="16" fill="#fce8ec"/>
      ${text(1130, 711, "Components", 21, c.cobalt, 700)}
      ${text(1400, 711, "Templates", 21, c.red, 700)}
      ${footer(2, "A GUIDED START", c.navy, c.muted)}`,
  },
  {
    eyebrow: "02  /  DISCOVER AND REVIEW",
    title: "Have a live site?\nBring it into the picture.",
    voice:
      "Feasibly suggests likely scope from the live site. Your team reviews each suggestion and adds, removes, or adjusts what belongs.",
    image: (c) => `
      <rect width="1920" height="1080" fill="${c.cobalt}"/>
      <circle cx="160" cy="980" r="360" fill="${c.sky}" opacity=".38"/>
      <rect x="180" y="235" width="760" height="610" rx="24" fill="#ffffff"/>
      <rect x="180" y="235" width="760" height="76" rx="24" fill="#e9edf5"/>
      <circle cx="222" cy="273" r="8" fill="${c.red}"/>
      <circle cx="252" cy="273" r="8" fill="#f3b34c"/>
      <circle cx="282" cy="273" r="8" fill="#4bbf8a"/>
      <rect x="335" y="254" width="455" height="38" rx="19" fill="#ffffff"/>
      ${text(365, 280, "brand-site.com", 16, c.muted, 400)}
      <rect x="225" y="350" width="670" height="190" rx="14" fill="#d7e8f8"/>
      <rect x="265" y="395" width="360" height="22" rx="11" fill="#ffffff" opacity=".9"/>
      <rect x="265" y="437" width="280" height="14" rx="7" fill="#ffffff" opacity=".72"/>
      <rect x="265" y="478" width="145" height="38" rx="19" fill="${c.red}"/>
      <rect x="225" y="570" width="315" height="185" rx="14" fill="#f1f5f9"/>
      <rect x="560" y="570" width="335" height="185" rx="14" fill="#f1f5f9"/>
      <rect x="255" y="602" width="255" height="18" rx="9" fill="#c7cfdd"/>
      <rect x="255" y="637" width="205" height="12" rx="6" fill="#d7dce5"/>
      <rect x="590" y="602" width="265" height="18" rx="9" fill="#c7cfdd"/>
      <rect x="590" y="637" width="180" height="12" rx="6" fill="#d7dce5"/>
      <rect x="255" y="690" width="90" height="32" rx="16" fill="#dce7ff"/>
      ${text(275, 712, "Likely match", 13, c.cobalt, 700)}
      <rect x="590" y="690" width="90" height="32" rx="16" fill="#dce7ff"/>
      ${text(610, 712, "Likely match", 13, c.cobalt, 700)}
      <path d="M1000 550h112" stroke="#ffffff" stroke-width="5" stroke-linecap="round"/>
      <path d="m1087 518 34 32-34 32" fill="none" stroke="${c.red}" stroke-width="8" stroke-linecap="round" stroke-linejoin="round"/>
      <rect x="1165" y="330" width="590" height="420" rx="22" fill="#ffffff"/>
      ${text(1225, 405, "SUGGESTED SCOPE", 17, c.muted, 700, 1.8)}
      ${suggestionRow(1225, 475, "Navigation", "Component", c)}
      ${suggestionRow(1225, 565, "Landing page", "Template", c)}
      ${suggestionRow(1225, 655, "Feature cards", "Component", c)}
      ${text(1165, 820, "Your team reviews every suggestion.", 25, "#ffffff", 600)}
      ${footer(3, "DISCOVER, THEN DECIDE", c.white, "#dce4ff")}`,
  },
  {
    eyebrow: "03  /  REFINE THE SCOPE",
    title: "Shape the scope\ntogether.",
    voice:
      "As scope changes, design and development effort updates in one place. Adjust quantities and planning buffer as decisions evolve.",
    image: (c) => `
      <rect width="1920" height="1080" fill="#ffffff"/>
      <path d="M0 0h1920v205H0z" fill="${c.pale}"/>
      ${text(145, 116, "03  /  REFINE THE SCOPE", 19, c.cobalt, 700, 2)}
      ${text(145, 184, "Shape the scope together.", 59, c.navy, 700)}
      <rect x="145" y="275" width="1020" height="585" rx="24" fill="#ffffff" stroke="${c.stroke}" stroke-width="2"/>
      ${text(205, 345, "INCLUDED IN THIS ESTIMATE", 17, c.muted, 700, 1.5)}
      ${scopeRow(205, 420, "Navigation", "Components", "2", c)}
      ${scopeRow(205, 515, "Landing page", "Templates", "1", c)}
      ${scopeRow(205, 610, "Feature cards", "Components", "4", c)}
      ${scopeRow(205, 705, "Contact page", "Templates", "1", c)}
      <rect x="1225" y="275" width="550" height="585" rx="24" fill="${c.navy}"/>
      ${text(1280, 345, "EFFORT AT A GLANCE", 17, "#b2bff4", 700, 1.5)}
      ${text(1280, 430, "Design", 25, c.white, 600)}
      <rect x="1280" y="458" width="420" height="18" rx="9" fill="#35416e"/>
      <rect x="1280" y="458" width="292" height="18" rx="9" fill="${c.sky}"/>
      ${text(1280, 548, "Development", 25, c.white, 600)}
      <rect x="1280" y="576" width="420" height="18" rx="9" fill="#35416e"/>
      <rect x="1280" y="576" width="355" height="18" rx="9" fill="${c.red}"/>
      <rect x="1280" y="660" width="420" height="76" rx="16" fill="#ffffff" opacity=".12"/>
      ${text(1310, 708, "Planning buffer included", 20, c.white, 500)}
      ${text(1280, 800, "Updates as your scope evolves", 19, "#dce4ff", 400)}
      ${text(145, 930, "A shared view makes trade-offs easier to discuss.", 24, c.muted, 400)}
      ${footer(4, "REFINE WITH CONFIDENCE", c.navy, c.muted)}`,
  },
  {
    eyebrow: "04  /  SHARE THE ESTIMATE",
    title: "Clearer estimates.\nEasier to share.",
    voice:
      "Share a branded PDF or spreadsheet with your team, proposal, or statement of work. Less manual assembly. More consistent estimates. Clearer conversations.",
    image: (c) => `
      <rect width="1920" height="1080" fill="${c.navy}"/>
      <path d="M0 780 1920 405v675H0z" fill="${c.cobalt}"/>
      <circle cx="1720" cy="180" r="350" fill="${c.sky}" opacity=".46"/>
      ${text(145, 150, "04  /  SHARE THE ESTIMATE", 19, "#b2bff4", 700, 2)}
      ${multilineText(145, 315, ["Clearer estimates.", "Easier to share."], 72, c.white, 700, 1.08)}
      ${text(150, 520, "A branded PDF or spreadsheet, ready for", 26, "#dce4ff", 400)}
      ${text(150, 560, "review, proposal, or statement of work.", 26, "#dce4ff", 400)}
      <g transform="translate(1110 185) rotate(4)">
        <rect x="0" y="0" width="515" height="650" rx="20" fill="#ffffff"/>
        <rect x="0" y="0" width="515" height="102" rx="20" fill="#f1f5f9"/>
        ${brandMark(36, 32, 36, c.red)}
        ${text(91, 65, "Feasibly", 23, c.navy, 700)}
        ${text(38, 158, "PROJECT ESTIMATE", 15, c.muted, 700, 1.4)}
        ${text(38, 205, "Spring campaign", 28, c.navy, 700)}
        <rect x="38" y="244" width="439" height="2" fill="${c.stroke}"/>
        ${text(38, 295, "Scope", 16, c.muted, 700)}
        ${text(38, 338, "Components and templates", 19, c.navy, 500)}
        ${text(38, 401, "Design effort", 18, c.muted, 500)}
        <rect x="38" y="420" width="420" height="13" rx="6.5" fill="#dce7ff"/>
        <rect x="38" y="420" width="270" height="13" rx="6.5" fill="${c.sky}"/>
        ${text(38, 492, "Development effort", 18, c.muted, 500)}
        <rect x="38" y="512" width="420" height="13" rx="6.5" fill="#fce8ec"/>
        <rect x="38" y="512" width="336" height="13" rx="6.5" fill="${c.red}"/>
        <rect x="38" y="575" width="439" height="47" rx="12" fill="#f1f5f9"/>
        ${text(58, 605, "Buffer included", 15, c.muted, 500)}
      </g>
      <rect x="1515" y="700" width="215" height="125" rx="18" fill="#ffffff"/>
      <path d="M1570 736h42l18 18v43h-60z" fill="#fce8ec" stroke="${c.red}" stroke-width="2"/>
      ${text(1645, 760, "PDF", 18, c.navy, 700)}
      ${text(1645, 790, "Ready to share", 13, c.muted, 400)}
      ${text(145, 770, "Less manual assembly.", 27, c.white, 600)}
      ${text(145, 815, "More consistent estimates.", 27, c.white, 600)}
      ${text(145, 860, "A clearer start to delivery.", 27, c.white, 600)}
      ${brandMark(145, 900, 34, c.red)}
      ${text(195, 928, "Feasibly", 24, c.white, 700)}
      ${text(145, 972, "Scope clearly. Estimate with confidence.", 19, "#dce4ff", 400)}`,
  },
];

function xml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function text(x, y, value, size, fill, weight = 400, spacing = 0) {
  return `<text x="${x}" y="${y}" fill="${fill}" font-family="Inter, Helvetica Neue, Arial, sans-serif" font-size="${size}" font-weight="${weight}" letter-spacing="${spacing}">${xml(value)}</text>`;
}

function multilineText(x, y, lines, size, fill, weight, leading) {
  return `<text x="${x}" y="${y}" fill="${fill}" font-family="Inter, Helvetica Neue, Arial, sans-serif" font-size="${size}" font-weight="${weight}" letter-spacing="0">${lines.map((line, index) => `<tspan x="${x}" dy="${index === 0 ? 0 : size * leading}">${xml(line)}</tspan>`).join("")}</text>`;
}

function brandMark(x, y, size, color) {
  const scale = size / 41;
  return `<g transform="translate(${x} ${y}) scale(${scale})" fill="${color}"><path d="M27.333 13.667V41L0 13.667h27.333Z"/><path d="M41 0v27.333L13.667 0H41Z"/></g>`;
}

function footer(number, label, primary, secondary) {
  const y = 1012;
  return `${text(145, y, `${String(number).padStart(2, "0")}  /  05`, 15, secondary, 700, 1)}<rect x="280" y="1001" width="94" height="4" rx="2" fill="${primary}" opacity=".28"/><rect x="280" y="1001" width="${number * 18.8}" height="4" rx="2" fill="${PALETTE.red}"/>${text(402, y, label, 14, secondary, 600, 1.2)}`;
}

function suggestionRow(x, y, name, category, colors) {
  return `<circle cx="${x + 14}" cy="${y - 8}" r="12" fill="${colors.cobalt}"/><path d="m${x + 8} ${y - 8} 4 4 8-9" fill="none" stroke="#fff" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>${text(x + 38, y, name, 21, colors.navy, 600)}${text(x + 383, y, category, 15, colors.muted, 400)}`;
}

function scopeRow(x, y, name, category, quantity, colors) {
  return `<rect x="${x}" y="${y - 30}" width="30" height="30" rx="7" fill="${colors.cobalt}"/><path d="m${x + 7} ${y - 15} 6 6 11-12" fill="none" stroke="#fff" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>${text(x + 52, y - 6, name, 22, colors.navy, 600)}${text(x + 390, y - 6, category, 16, colors.muted, 400)}<rect x="${x + 800}" y="${y - 31}" width="74" height="46" rx="12" fill="${colors.pale}"/>${text(x + 827, y, quantity, 19, colors.navy, 700)}`;
}

function sceneSvg(scene) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${WIDTH}" height="${HEIGHT}" viewBox="0 0 ${WIDTH} ${HEIGHT}">${scene.image(PALETTE)}</svg>`;
}

function run(command, args) {
  execFileSync(command, args, { stdio: "inherit" });
}

function mediaDuration(file) {
  const result = execFileSync("ffprobe", [
    "-v",
    "error",
    "-show_entries",
    "format=duration",
    "-of",
    "default=noprint_wrappers=1:nokey=1",
    file,
  ], { encoding: "utf8" });
  return Number(result.trim());
}

const root = path.resolve(import.meta.dirname, "..");
const outputDir = path.join(root, "artifacts");
const outputFile = path.join(outputDir, "feasibly-stakeholder-overview.mp4");
const transcriptFile = path.join(outputDir, "feasibly-stakeholder-overview.txt");
const temporaryDir = await mkdtemp(path.join(os.tmpdir(), "feasibly-video-"));
const clipPadding = 0.85;

await mkdir(outputDir, { recursive: true });

try {
  const clips = [];
  for (const [index, scene] of scenes.entries()) {
    const frameFile = path.join(temporaryDir, `scene-${index}.png`);
    const voiceFile = path.join(temporaryDir, `voice-${index}.aiff`);
    const clipFile = path.join(temporaryDir, `clip-${index}.mp4`);
    await sharp(Buffer.from(sceneSvg(scene))).png().toFile(frameFile);
    run("say", ["-v", "Samantha", "-r", "175", "-o", voiceFile, scene.voice]);
    const voiceDuration = mediaDuration(voiceFile);
    const clipDuration = voiceDuration + clipPadding;

    run("ffmpeg", [
      "-hide_banner",
      "-loglevel",
      "error",
      "-y",
      "-loop",
      "1",
      "-framerate",
      String(FPS),
      "-i",
      frameFile,
      "-i",
      voiceFile,
      "-filter_complex",
      `[0:v]zoompan=z='min(zoom+0.00018,1.025)':x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':d=1:s=${WIDTH}x${HEIGHT}:fps=${FPS},format=yuv420p[v];[1:a]apad=pad_dur=${clipPadding},afade=t=out:st=${voiceDuration.toFixed(3)}:d=0.45[a]`,
      "-map",
      "[v]",
      "-map",
      "[a]",
      "-t",
      clipDuration.toFixed(3),
      "-r",
      String(FPS),
      "-c:v",
      "libx264",
      "-preset",
      "veryfast",
      "-crf",
      "19",
      "-pix_fmt",
      "yuv420p",
      "-c:a",
      "aac",
      "-b:a",
      "160k",
      clipFile,
    ]);
    clips.push({ file: clipFile, duration: clipDuration });
    console.log(`Rendered scene ${index + 1}/${scenes.length}: ${scene.eyebrow}`);
  }

  const inputArgs = clips.flatMap((clip) => ["-i", clip.file]);
  const graph = [];
  let currentVideo = "0:v";
  let currentAudio = "0:a";
  let elapsed = clips[0].duration;

  for (let index = 1; index < clips.length; index++) {
    const nextVideo = `v${index}`;
    const nextAudio = `a${index}`;
    const videoOffset = elapsed - TRANSITION_SECONDS;
    graph.push(`[${currentVideo}][${index}:v]xfade=transition=fade:duration=${TRANSITION_SECONDS}:offset=${videoOffset.toFixed(3)}[${nextVideo}]`);
    graph.push(`[${currentAudio}][${index}:a]acrossfade=d=${TRANSITION_SECONDS}:c1=tri:c2=tri[${nextAudio}]`);
    currentVideo = nextVideo;
    currentAudio = nextAudio;
    elapsed += clips[index].duration - TRANSITION_SECONDS;
  }

  run("ffmpeg", [
    "-hide_banner",
    "-loglevel",
    "error",
    "-y",
    ...inputArgs,
    "-filter_complex",
    graph.join(";"),
    "-map",
    `[${currentVideo}]`,
    "-map",
    `[${currentAudio}]`,
    "-r",
    String(FPS),
    "-c:v",
    "libx264",
    "-preset",
    "medium",
    "-crf",
    "18",
    "-pix_fmt",
    "yuv420p",
    "-c:a",
    "aac",
    "-b:a",
    "192k",
    "-movflags",
    "+faststart",
    outputFile,
  ]);

  await writeFile(
    transcriptFile,
    `Feasibly | Stakeholder overview\n\n${scenes.map((scene) => scene.voice).join("\n\n")}\n`,
  );
  console.log(`Created ${outputFile}`);
  console.log(`Duration: ${mediaDuration(outputFile).toFixed(1)} seconds`);
} finally {
  await rm(temporaryDir, { recursive: true, force: true });
}