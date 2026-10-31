# Benchmark runs scored in CI

Each file in `runs/` is one answer produced by an assistant for a task of the `/benchmark` page, with a small header:

```
---
task: author-bibliography        # id from lib/benchmark.ts
mode: web                        # web | cammicgo
assistant: Claude                # who answered
seconds: 25                      # measured time to the complete answer
---
(the answer, as given)
```

Pushing a file triggers the *Benchmark scoring* workflow, which scores every changed run with the same code as the website (`scoreAnswer`) and posts the results as a commit comment.
