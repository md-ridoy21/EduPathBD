import { existsSync, mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { spawnSync } from "node:child_process";

const output = resolve("apps/web/public/media/edupath-admission-guide-en.mp4");
const fontCandidates = [
  "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf",
  "/usr/share/fonts/truetype/liberation2/LiberationSans-Bold.ttf"
];
const font = fontCandidates.find(existsSync);

if (!font) throw new Error("A supported sans-serif font is required to build the fallback video.");
mkdirSync(dirname(output), { recursive: true });

const slide = (start, end, heading, detail) => [
  `drawtext=fontfile=${font}:text='${heading}':fontcolor=white:fontsize=42:x=(w-text_w)/2:y=205:enable='between(t,${start},${end})'`,
  `drawtext=fontfile=${font}:text='${detail}':fontcolor=0xA7F3D0:fontsize=22:x=(w-text_w)/2:y=275:enable='between(t,${start},${end})'`
];

const filters = [
  "drawbox=x=0:y=0:w=iw:h=ih:color=0x071B2E:t=fill",
  "drawbox=x=55:y=48:w=70:h=70:color=0x22D3EE:t=fill",
  `drawtext=fontfile=${font}:text='EDUPATH BD':fontcolor=white:fontsize=27:x=145:y=58`,
  `drawtext=fontfile=${font}:text='PLAN WITH CONFIDENCE':fontcolor=0x99F6E4:fontsize=16:x=145:y=96`,
  ...slide(0, 4.99, "BUILD YOUR STUDENT PROFILE", "Add your level, group, GPA and interests"),
  ...slide(5, 9.99, "CHECK ELIGIBILITY", "Review sourced programs that match your results"),
  ...slide(10, 14.99, "COMPARE YOUR OPTIONS", "Compare institutions, fees and career pathways"),
  ...slide(15, 19.99, "TRACK DEADLINES", "Shortlist choices and plan every application step"),
  ...slide(20, 25, "VERIFY BEFORE APPLYING", "Confirm requirements on the official institution website"),
  "drawbox=x=55:y=480:w=850:h=5:color=0x334155:t=fill",
  "drawbox=x=55:y=480:w='34*t':h=5:color=0x34D399:t=fill",
  "fade=t=in:st=0:d=0.6",
  "fade=t=out:st=24.3:d=0.7"
];

const result = spawnSync("ffmpeg", [
  "-y", "-f", "lavfi", "-i", "color=c=0x071B2E:s=960x540:r=24:d=25",
  "-vf", filters.join(","), "-an", "-c:v", "libx264", "-preset", "veryfast",
  "-crf", "24", "-pix_fmt", "yuv420p", "-movflags", "+faststart", output
], { stdio: "inherit" });

if (result.error) throw result.error;
if (result.status !== 0) throw new Error(`ffmpeg exited with status ${result.status}`);
console.log(`Built ${output}`);
