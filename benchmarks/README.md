# Benchmark runs scored in CI

Each file in `runs/` is one answer produced by an assistant for a task defined in `lib/benchmark.ts` (prompts and scoring live in the repository; the public `/benchmark` page was removed), with a small header:

```
---
task: author-bibliography        # id from lib/benchmark.ts
mode: web                        # web | cammicgo
assistant: Claude                # who answered
seconds: 25                      # measured time to the complete answer
---
(the answer, as given)
```

Pushing a file triggers the *Benchmark scoring* workflow, which scores every changed run with `scoreAnswer` from `lib/benchmark.ts` and posts the results as a commit comment.
