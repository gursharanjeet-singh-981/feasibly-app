---
description: "Review code and give prioritized recommendations for correctness, security, performance, and best practices in React, Next.js, Vue, or Node.js"
agent: JS Reviewer
argument-hint: "File, folder, or topic to review (defaults to current file)"
---
Review: ${input:target:File, folder, or topic to review}

If no target is given, review the current file: ${file}

Return findings grouped by severity with file/line references and concrete fixes, followed by broader recommendations.
