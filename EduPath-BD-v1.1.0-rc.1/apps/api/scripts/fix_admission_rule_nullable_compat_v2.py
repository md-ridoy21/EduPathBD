#!/usr/bin/env python3
import re
import shutil
import sys
from pathlib import Path

if len(sys.argv) != 2:
    print("Usage: python3 fix_admission_rule_nullable_compat_v2.py <store.ts>")
    raise SystemExit(2)

path = Path(sys.argv[1]).expanduser().resolve()
if not path.exists():
    raise SystemExit(f"HARD_STOP: file not found: {path}")

text = path.read_text(encoding="utf-8")
original = text

backup = path.with_suffix(path.suffix + ".pre-admission-nullable-compat-v2.bak")
if not backup.exists():
    shutil.copy2(path, backup)
    print(f"BACKUP_CREATED {backup}")
else:
    print(f"BACKUP_EXISTS {backup}")

changes = []

helper_name = "requireProgramScopedAdmissionField"
if helper_name not in text:
    m = re.search(
        r'(?ms)((?:export\s+)?(?:type|interface)\s+AdmissionRuleRecord\b.*?(?:\n\};|\n\}))',
        text,
    )
    if not m:
        raise SystemExit("HARD_STOP: AdmissionRuleRecord definition not found")

    helper = '''
function requireProgramScopedAdmissionField(
  value: string | null | undefined,
  field: "programId" | "academicSession" | "applicantStage",
): string {
  if (!value) {
    throw new Error(
      `Program-scoped admission rule output requires ${field}; institution-level/incomplete rules must use the institution-scope path.`,
    );
  }
  return value;
}
'''
    text = text[:m.end()] + helper + text[m.end():]
    changes.append("added_guard_helper")

anchor = "if (latestByProgram.has(row.programId)) continue;"
guard = "if (!row.programId || !row.program) continue;"
if guard not in text:
    if anchor not in text:
        raise SystemExit("HARD_STOP: latestByProgram anchor not found")
    text = text.replace(anchor, guard + "\n    " + anchor, 1)
    changes.append("guarded_latestByProgram")

mapping_replacements = [
    (
        re.compile(r'\bprogramId:\s*item\.programId\s*,'),
        'programId: requireProgramScopedAdmissionField(item.programId, "programId"),',
        "guarded_mapper_programId",
    ),
    (
        re.compile(r'\bacademicSession:\s*item\.academicSession\s*,'),
        'academicSession: requireProgramScopedAdmissionField(item.academicSession, "academicSession"),',
        "guarded_mapper_academicSession",
    ),
    (
        re.compile(r'\bapplicantStage:\s*item\.applicantStage\s*,'),
        'applicantStage: requireProgramScopedAdmissionField(item.applicantStage, "applicantStage"),',
        "guarded_mapper_applicantStage",
    ),
]

for rx, repl, label in mapping_replacements:
    if repl not in text:
        text, n = rx.subn(repl, text, count=1)
        if n == 0:
            raise SystemExit(f"HARD_STOP: {label} anchor not found")
        changes.append(label)

map_start = text.find("...admissionRules.map")
if map_start < 0:
    map_start = text.find("admissionRules.map")
if map_start < 0:
    raise SystemExit("HARD_STOP: admissionRules.map not found")

map_end_candidates = [
    text.find("...scholarships.map", map_start),
    text.find("...scholarship", map_start),
    text.find("];", map_start),
]
map_end_candidates = [x for x in map_end_candidates if x > map_start]
map_end = min(map_end_candidates) if map_end_candidates else min(len(text), map_start + 4000)

segment = text[map_start:map_end]
segment_original = segment

segment = re.sub(
    r'title:\s*`\$\{item\.program\.name\}\s+admission rule`',
    'title: item.program ? `${item.program.name} admission rule` : "Institution admission rule"',
    segment,
    count=1,
)

segment = re.sub(
    r'subtitle:\s*`\$\{item\.program\.institution\.name\}\s*·\s*\$\{item\.academicSession\}`',
    'subtitle: item.program ? `${item.program.institution.name}${item.academicSession ? ` · ${item.academicSession}` : ""}` : (item.academicSession ?? "Institution-wide rule")',
    segment,
    count=1,
)

segment = re.sub(
    r'editable:\s*\{\s*academicSession:\s*item\.academicSession\s*,',
    'editable: { academicSession: item.academicSession ?? undefined,',
    segment,
    count=1,
)

if segment != segment_original:
    text = text[:map_start] + segment + text[map_end:]
    changes.append("patched_admin_map")
else:
    if "item.program.name" in segment and "item.program ?" not in segment:
        raise SystemExit("HARD_STOP: admin map still contains unsafe item.program.name")

publish_message = "Institution-level admission rules cannot be published until explicit parent-institution verification support is configured."

if publish_message not in text:
    rx = re.compile(
        r'if\s*\(\s*row\.program\.verificationStatus\s*!==\s*"VERIFIED"\s*\|\|\s*'
        r'row\.program\.institution\.verificationStatus\s*!==\s*"VERIFIED"\s*\)\s*'
        r'throw\s+new\s+Error\(\s*"Verify the parent institution and program before publishing this admission rule\."\s*\)\s*;'
    )
    replacement = '''if (!row.program) {
      throw new Error(
        "Institution-level admission rules cannot be published until explicit parent-institution verification support is configured.",
      );
    }
    if (
      row.program.verificationStatus !== "VERIFIED" ||
      row.program.institution.verificationStatus !== "VERIFIED"
    ) {
      throw new Error("Verify the parent institution and program before publishing this admission rule.");
    }'''
    text, n = rx.subn(replacement, text, count=1)
    if n == 0:
        raise SystemExit("HARD_STOP: admission publish guard anchor not found")
    changes.append("patched_publish_guard")

for bad in [
    'programId: item.programId ?? ""',
    'academicSession: item.academicSession ?? ""',
    'applicantStage: item.applicantStage ?? ""',
]:
    if bad in text:
        raise SystemExit(f"HARD_STOP: unsafe fake fallback found: {bad}")

if text != original:
    path.write_text(text, encoding="utf-8")
    print("PATCH_APPLIED")
    for c in changes:
        print("  -", c)
else:
    print("NO_CHANGES_NEEDED")

print("SAFETY_ASSERTIONS_PASS")
print("No database changes performed.")
