---
description: "Generate and run tests for a file, component, or API in a React, Next.js, Vue, or Node.js project"
agent: JS Test Engineer
argument-hint: "File or feature to test (defaults to current file)"
---
Write tests for: ${input:target:File, component, or feature to test}

If no target is given, test the current file: ${file}

Follow the project's existing test setup and conventions, cover happy path, edge cases, and error states, then run the tests until they pass.
