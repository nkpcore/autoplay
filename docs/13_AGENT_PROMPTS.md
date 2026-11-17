# 13 — Copy-Paste Prompts for the Agent (for the human to use)

Use ONE prompt at a time. Wait until the agent says the phase is done and you have tested it. Then send the next prompt.

## MASTER PROMPT (send first, once)
```
You are building the web app "PartyAux". All instructions are in the /docs folder.
Read docs/00_START_HERE_README_FOR_AGENT.md, 01_PROJECT_OVERVIEW.md and 02_ARCHITECTURE.md completely now.
Then reply with: (1) a 5-line summary of what we are building, (2) the 12 golden rules in your own words, (3) the list of questions you need me to answer before coding.
Do not write code yet.
```

## PHASE 0–1
```
Read docs/03_SETUP_AND_FOLDERS.md and docs/04_DATA_MODEL.md.
Do tasks T01 to T05 from docs/10_BUILD_TASKS_EASY_TO_HARD.md, one at a time. After each task tell me how you checked its "Done when" lines, and tick PROGRESS_CHECKLIST.md.
For T06 stop and ask me for the song data.
```

## PHASE 2 (engine)
```
Read docs/05_PLAYER_ENGINE_SPEC.md fully, twice.
Do tasks T07 to T16 in order. Use the reference code from the document; do not redesign it.
After T11, show me the /engine-test page working with 5 songs. Stop after T16 and wait.
```

## PHASE 3 (tune tool)
```
Read docs/08_TUNE_TOOL_SPEC.md. Do T17 and T18. Then explain to me, step by step, how I use the tool to tune songs and export songs.json.
```

## PHASE 4 (set generator)
```
Read docs/06_SET_GENERATOR_SPEC.md. Do T19 to T23. Print the self-test results (PASS/FAIL) in your report.
```

## PHASE 5 (UI)
```
Read docs/07_UI_SPEC.md. Do T24 to T31 in order. Show me what each screen looks like (describe it) and list any deviations from the spec.
```

## PHASE 6 (local files)
```
Re-read docs/05 sections 7 and 8 and docs/09 Part C sections C2 only. Do T32 to T35.
Warn me about anything that might not work on iPhone Safari.
```

## PHASE 7 (telemetry)
```
Read docs/09 Part A and docs/12 Supabase section. Do T36. For T37 give me exact click-by-click instructions for the Supabase dashboard, then wait for me. Then do T38 and test the script with fake data.
```

## PHASE 8 (rooms)
```
Read docs/09 Part B. Do T39 to T42. Explain how I test with two browser windows and one phone.
```

## PHASE 9 (beats)
```
Read docs/09 Part C. Do T43 to T45. Tell me which test songs (with known BPM) I should use to verify.
```

## PHASE 10 (ship)
```
Read docs/11 and docs/12. Do T46 to T48. Produce KNOWN_ISSUES.md and a final README.md for the repo.
```

## WHEN THE AGENT GETS STUCK (use this)
```
Stop. Do not rewrite everything. Tell me: (1) the exact error text, (2) which task you are on, (3) which file and line, (4) what you already tried, (5) which doc section you think applies. Then re-read docs/11_TESTING_AND_DEBUGGING.md and try the smallest possible fix.
```

## WHEN THE AGENT INVENTS THINGS (use this)
```
You added something that is not in the docs (a library / a feature / data you made up). Remove it. Follow the docs exactly. If the docs are missing something you need, ask me.
```

## WHEN YOU WANT A REVIEW
```
Review your own work for task T<nn>. List each "Done when" line and say PASS or FAIL with evidence. Do not claim PASS without having run it.
```
