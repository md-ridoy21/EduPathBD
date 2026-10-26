#!/usr/bin/env python3
import re
import shutil
import sys
from pathlib import Path

if len(sys.argv) != 2:
    print("Usage: python3 fix_admission_rule_nullable_compat.py <store.ts>")
    raise SystemExit(2)

path = Path(sys.argv[1]).expanduser().resolve()
if not path.exists():
    raise SystemExit(f"HARD_STOP: file not found: {path}")

text = path.read_text(encoding="utf-8")
original = text

backup = path.with_suffix(path.suffix + ".pre-admission-nullable-compat.bak")
if not backup.exists():
    shutil.copy2(path, backup)
    print(f"BACKUP_CREATED {backup}")
else:
    print(f"BACKUP_EXISTS {backup}")

changes = []

helper_name = "requireProgramScopedAdmissionField"
if helper_name not in text:
    marker_match = re.search(r'(?ms)(?:export\s+)?(?:type|interface)\s+AdmissionRuleRecord\b.*?(?:\};|\})\s*\n', text)
    if not marker_match:
        raise SystemExit("HARD_STOP: AdmissionRuleRecord type/interface block not found")
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
    pos = marker_match.end()
    text = text[:pos] + "\n" + helper + text[pos:]
    changes.append("added_runtime_guard_helper")

replacements = {
    "programId: item.programId,": 'programId: requireProgramScopedAdmissionField(item.programId, "programId"),',
    "academicSession: item.academicSession,": 'academicSession: requireProgramScopedAdmissionField(item.academicSession, "academicSession"),',
    "applicantStage: item.applicantStage,": 'applicantStage: requireProgramScopedAdmissionField(item.applicantStage, "applicantStage"),',
}
for old, new in replacements.items():
    if old in text:
        text = text.replace(old, new)
        changes.append(f"guarded_{old.split(':')[0]}")
    elif new not in text:
        raise SystemExit(f"HARD_STOP: expected mapper assignment not found: {old}")

needle = "if (latestByProgram.has(row.programId)) continue;"
guard = "if (!row.programId || !row.program) continue;"
if needle in text and guard not in text:
    text = text.replace(needle, guard + "\n    " + needle, 1)
    changes.append("guarded_latest_by_program")
elif needle not in text and guard not in text:
    raise SystemExit("HARD_STOP: latestByProgram anchor not found")

old_admin = '''...admissionRules.map((item) => ({ id: item.id, kind: "ADMISSION_RULE" as const, title: `${item.program.name} admission rule`, subtitle: `${item.program.institution.name} · ${item.academicSession}`, status: item.verificationStatus, sourceUrl: item.sourceUrl, updatedAt: item.updatedAt.toISOString(), editable: { academicSession: item.academicSession, sourceUrl: item.sourceUrl } })),'''
new_admin = '''...admissionRules.map((item) => ({
      id: item.id,
      kind: "ADMISSION_RULE" as const,
      title: item.program ? `${item.program.name} admission rule` : "Institution admission rule",
      subtitle: item.program
        ? `${item.program.institution.name}${item.academicSession ? ` · ${item.academicSession}` : ""}`
        : (item.academicSession ?? "Institution-wide rule"),
      status: item.verificationStatus,
      sourceUrl: item.sourceUrl,
      updatedAt: item.updatedAt.toISOString(),
      editable: { academicSession: item.academicSession ?? undefined, sourceUrl: item.sourceUrl },
    })),'''
if old_admin in text:
    text = text.replace(old_admin, new_admin, 1)
    changes.append("admin_content_null_safe")
elif 'title: item.program ? `${item.program.name} admission rule`' not in text:
    rx = re.compile(
        r'\.\.\.admissionRules\.map\(\(item\)\s*=>\s*\(\{\s*'
        r'id:\s*item\.id,\s*'
        r'kind:\s*"ADMISSION_RULE"\s+as\s+const,\s*'
        r'title:\s*`\$\{item\.program\.name\}\s+admission rule`,\s*'
        r'subtitle:\s*`\$\{item\.program\.institution\.name\}\s*·\s*\$\{item\.academicSession\}`,\s*'
        r'status:\s*item\.verificationStatus,\s*'
        r'sourceUrl:\s*item\.sourceUrl,\s*'
        r'updatedAt:\s*item\.updatedAt\.toISOString\(\),\s*'
        r'editable:\s*\{\s*academicSession:\s*item\.academicSession,\s*sourceUrl:\s*item\.sourceUrl\s*\}\s*'
        r'\}\)\),'
    )
    text, n = rx.subn(new_admin, text, count=1)
    if n:
        changes.append("admin_content_null_safe")
    else:
        raise SystemExit("HARD_STOP: admin admissionRules map anchor not found")

old_publish = '''if (row.program.verificationStatus !== "VERIFIED" || row.program.institution.verificationStatus !== "VERIFIED") throw new Error("Verify the parent institution and program before publishing this admission rule.");'''
new_publish = '''if (!row.program) {
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
if old_publish in text:
    text = text.replace(old_publish, new_publish, 1)
    changes.append("publish_guard_null_safe")
elif "Institution-level admission rules cannot be published" not in text:
    raise SystemExit("HARD_STOP: admission publish guard anchor not found")

if text == original:
    print("NO_CHANGES_NEEDED")
else:
    path.write_text(text, encoding="utf-8")
    print("PATCH_APPLIED")
    for c in changes:
        print(f"  - {c}")

patched = path.read_text(encoding="utf-8")
for bad in [
    'programId: item.programId ?? ""',
    'academicSession: item.academicSession ?? ""',
    'applicantStage: item.applicantStage ?? ""',
]:
    if bad in patched:
        raise SystemExit(f"HARD_STOP: unsafe fake fallback detected: {bad}")

print("SAFETY_ASSERTIONS_PASS")
print("No DB changes performed.")
