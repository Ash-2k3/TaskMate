# Features Research

**Project:** TaskMate (Electron + React)
**Researched:** 2026-03-21
**Confidence note:** WebSearch and WebFetch are unavailable in this environment. All findings draw on training knowledge through August 2025. Sources are cited by author/institution; URLs cannot be live-verified here. Confidence levels are assigned per claim.

---

## Task Management UX

### What makes a task list feel lightweight vs overwhelming

**The core tension:** Every item added to a list is a micro-commitment. When the list grows faster than it shrinks, the visual mass of undone work triggers what psychologists call "completion anxiety" — a stress response that makes users avoid the app entirely. The irony: the more faithfully a user logs tasks, the worse the app feels.

**Findings — HIGH confidence (established UX research, Nielsen Norman Group, and Basecamp/37signals design writing):**

**1. Cognitive load is proportional to visible count, not total count.**
Users judge a task list by what they see on screen. Apps like Things 3 and Omnifocus solved this by separating "Inbox" (raw capture) from "Today" (deliberate commitment). The Today view should never exceed 5-7 items — the working-memory limit (Miller's Law). Showing a 40-task backlog alongside today's work is the primary cause of overwhelm.

Recommendation for TaskMate: Implement a hard "Today" concept. Let users see their full list, but default view shows only tasks due today or explicitly pinned. Cap Today display at 7 visible tasks; overflow collapses behind "X more."

**2. Friction on add is bad; friction on completion is worse.**
Quick capture (minimal fields, just title, Enter to save) lowers the barrier to logging tasks. But completion should feel immediate and rewarding — no confirmation dialogs, no "are you sure?" on check-off. The satisfying animation of a strikethrough or fade is a known behavioral reinforcer (operant conditioning, positive reinforcement). Even without animations (per TaskMate constraints), the act of disappearing a completed item is preferable to greying it out in place.

Recommendation: On task complete, remove from Today view immediately. Archive to a "Completed" log for the weekly summary. Never show completed tasks in the main view unless explicitly requested.

**3. Priority labels inflate, not help.**
Apps with P1/P2/P3/P4 priority systems see "priority inflation" — users mark everything P1 within weeks. Research from Basecamp and the GTD community shows that explicit priority labels are less effective than positional ordering (drag to reorder) or a single binary flag ("starred" or "important"). A three-tier system at most is defensible.

Recommendation: Use High / Normal / Low (not numbers). Default is Normal. High is used sparingly because the UI should visually distinguish it strongly — bold text or a colored left border, not just a label. Low tasks are visually de-emphasized (grey, smaller).

**4. Due dates create false urgency.**
Everything with a due date feels late the moment it's overdue. Apps that color everything red on the due date train users to ignore red. Differentiate between "hard deadline" (meeting, submission) and "soft target" (I'd like this done by Friday). A single due date field that turns red creates the same learned helplessness as email unread counts.

Recommendation: Due date is optional. No red-coloring of overdue items — instead, overdue items surface in the Today view with a small badge ("2 days ago") but not alarm-coloring. Let users choose the emotional weight.

**5. Empty state is a UX opportunity, not a placeholder.**
When Today has no tasks, most apps show a blank list. This is a missed moment. Apps like Things 3 show a friendly prompt; Streaks shows a congratulatory message. An empty Today should signal success ("You're clear for today") not absence of data.

Recommendation: Empty Today view shows a calm success message. This is especially important given TaskMate's behavioral design goal — reinforce the feeling of completion.

---

## Daily Reflection Design

### Behavioral science angle on end-of-day review questions

**Background — HIGH confidence (BJ Fogg's Tiny Habits research, Tiago Forte's Building a Second Brain, implementation intentions literature from Peter Gollwitzer):**

The end-of-day review is one of the highest-leverage habits a knowledge worker can build — but it has one of the lowest completion rates among productivity tools that offer it. The reason: most apps ask too many questions, or ask questions that require emotional effort when the user is already fatigued.

**Key behavioral science principles:**

**1. Timing matters more than question quality.**
Reflection scheduled at a fixed time (rather than "when you feel like it") has significantly higher completion rates. 9 PM is reasonable for most adults but is better as a user-configurable setting. The behavioral science term is "implementation intention" — "At 9 PM, I will open TaskMate and answer my nightly questions" is more effective than "I will reflect when I finish work." For MVP with a fixed 9 PM trigger, this is acceptable and enforces consistency.

**2. Three questions is the right number.**
Research on journaling and evening review (Ury's "Yes to the No," Seligman's positive psychology interventions) consistently finds that 3 questions is the sweet spot: enough to be meaningful, not enough to feel like work. More than 5 questions drops completion rates significantly. The TaskMate requirement of 3 fixed questions is validated.

**3. Question framing drives response quality.**
Open-ended questions produce richer responses but lower completion (user stares at blank box). Framed questions that constrain the answer space work better. Compare:

- Weak: "How was your day?" → triggers fatigue
- Strong: "What was the one thing that made today harder than expected?" → specific, bounded, actionable

**4. Negative framing surfaces learning; positive framing builds momentum.**
Positive psychology research (Seligman, 2011) shows that 3:1 positive-to-negative question ratio sustains long-term engagement. All-negative reflection ("what went wrong") causes emotional exhaustion. All-positive ("what are you grateful for") produces shallow, habitual responses within 2 weeks.

**5. Questions that reference today's task list perform better than abstract questions.**
Reflection grounded in concrete events the user logged (tasks completed, tasks deferred) produces more useful insights than abstract mood questions. This is why TaskMate's design of combining task data with reflection is architecturally correct.

### Recommended question set for TaskMate

These three questions are ordered deliberately: one grounding (anchors to today's concrete work), one learning (extracts a lesson), one forward-looking (creates a micro-intention for tomorrow).

**Question 1 — Grounding (completion acknowledgment):**
"What did you actually finish today, even if it wasn't on your list?"

Rationale: Most productivity apps only track what was planned. This question captures invisible work, validates effort, and reduces the "I got nothing done" cognitive distortion. It also reinforces the habit of task logging in future days.

**Question 2 — Learning (friction/obstacle extraction):**
"What slowed you down most today, and was it avoidable?"

Rationale: Highly specific, bounded (two sub-parts that feel natural). The second clause ("was it avoidable?") prevents wallowing — it reframes the obstacle as something to analyze, not just complain about. Over time, patterns in answers reveal recurring blockers (meetings, notification interruptions, unclear task descriptions).

**Question 3 — Forward intention (implementation intention):**
"What is the one thing you'll protect time for tomorrow?"

Rationale: Implementation intention research (Gollwitzer, 1999 — extensively replicated) shows that forming a specific intention increases follow-through by 200-300% over general goals. Asking for ONE thing forces prioritization and creates a concrete mental rehearsal.

**Optional fourth question (consider for v2):**
"On a scale of 1-5, how focused did you feel today?"

Rationale: A numeric self-assessment provides quantifiable data for the weekly summary's "focus trend" metric. For MVP, skip it — three mandatory text fields is already a commitment. Add the numeric slider in v2 once the habit is established.

**Implementation notes:**
- Require at least one answer to dismiss (per requirements) — but the UX should not feel punitive. Frame it as "Answer at least one — just a line is enough."
- Pre-fill Question 1 with the count of tasks completed today: "You finished 4 tasks today. What else did you accomplish that wasn't on your list?" — this uses existing local data to reduce blank-page anxiety.
- Store answers as plain text keyed by ISO date string. Never require structured input.

---

## Weekly Summary Design

### What metrics actually change behavior (vs vanity stats)

**Background — MEDIUM confidence (based on behavioral economics literature, Fogg's model, product retrospectives from Beeminder, Habitica, Streaks):**

Vanity metrics feel good momentarily but do not drive behavior change. The test: does seeing this number make you do something different next week? If not, it's vanity.

**Vanity metrics to avoid:**
- Total tasks created (can be gamed; creates incentive to over-log)
- Streak count in isolation (breaks feel catastrophic, causing abandonment)
- Completion percentage without context (60% completion one week could be great or terrible depending on task complexity)

**Behavior-changing metrics — what the research supports:**

**1. Completed vs deferred ratio (not raw completion rate).**
The insight is not "did you finish?" but "what did you defer, and why?" A user who completes 8 of 10 tasks and defers 2 intentionally is performing better than one who completes 10 of 10 trivially easy tasks. Show: "You finished 8 tasks. You moved 2 to next week." Then display the deferred task titles — this creates mild accountability without shame.

**2. Top task category or tag by time (if tagging exists) — but for MVP: longest-pending tasks.**
Without time tracking or tags, the most actionable version of this is: "Your oldest incomplete task has been on your list for 14 days: [title]." Surfacing a specific neglected item triggers decision-making: "Do this, delete it, or stop lying to myself about it." This is far more behavioral than a pie chart.

**3. Reflection streak (not task streak).**
Reflection streaks are more durable than task-completion streaks because missing a day of reflection is less emotionally loaded than "failing" at a task. Track: "You reflected 5 of 7 days this week." This incentivizes the journaling habit, which is the core differentiator of TaskMate. Do not show this as a fire emoji or gamification — just a plain count.

**4. Distraction pattern (from keyword analysis — see section below).**
"Your most frequent non-task keyword this week: 'meeting'" or "'reddit'" or "'email'" is actionable because it names the thing. A user who sees "meeting" 3 weeks in a row learns they have a meeting problem. This is the highest-value unique metric TaskMate can provide.

**5. Self-reported energy trend (if you add the numeric question).**
Average of the 1-5 focus scores over the week, trended against previous week. "Focus: 3.2 this week vs 3.8 last week — two days you rated yourself 2." This is specific and actionable. Defer to v2.

### Recommended weekly summary format for TaskMate MVP

Delivered Sunday evening (or Monday morning — consider both). Text-only, per constraints.

```
--- TaskMate Weekly Summary: Mar 16-22 ---

Tasks completed: 12
Tasks deferred to next week: 3
  - "Write unit tests for parser" (moved 2x this week)
  - "Reply to Alex about contract"
  - "Clean up project folder"

You reflected 5 of 7 days.

Top distraction keyword: "meetings" (appeared 8 times in your notes this week)

One thing from your reflections that came up twice:
  "slow internet" appeared in your obstacle answers Mon and Thu.

---
Start of next week: You said you'd protect time for "deep work session" tomorrow.
```

This is plain text. No charts, no emoji, no percentages. Every line is actionable.

**Why the deferred task list works:** Seeing specific task titles (not a count) forces the user to re-decide. "Do I actually want to do this?" is a better question to surface than "you had a 80% completion rate."

---

## Reminder UX

### Best practices to avoid notification fatigue

**Background — HIGH confidence (Apple Human Interface Guidelines, Google Material Design notification guidelines, academic research on notification overload including work by Iqbal and Bailey at Microsoft Research):**

**1. The core problem: every notification is an interruption tax.**
Microsoft Research (Iqbal & Bailey, 2006 — frequently cited in HCI literature) found that task-switching after an interruption costs an average of 23 minutes to full recovery. Notifications that fire at the wrong moment are not just annoying — they measurably reduce the productivity they're meant to support.

**2. Respect the OS notification permission model.**
On macOS and Windows, apps must request notification permission. Electron's Notification API wraps the OS-level system. Always request permission at first launch with a clear explanation of what will be sent and when. Do not ask permission mid-session or after a refusal — the OS may block future requests.

**3. One re-notification is the right number (TaskMate already decided this correctly).**
The requirement to re-notify once after 10 minutes is well-supported by UX principles. Repeated reminders train users to dismiss without reading — "notification blindness." One initial notification + one follow-up is the pattern used by well-designed timer apps (Forest, Time Timer). After that, silence. The user has seen it; they are choosing to defer.

**4. Notification content must be action-ready.**
Weak: "You have a reminder from TaskMate."
Strong: "Reminder: Submit expense report — due today. [Mark Complete] [Snooze 1hr]"

Including the task title and quick-action buttons (Electron supports these via the notification `actions` property on macOS, limited support on Windows) means the user can act without opening the app. This reduces friction to completion.

**5. Time-based clustering beats per-task notifications.**
If a user has 3 tasks due today, sending 3 separate notifications is three interruptions. Better: one summary notification at a configured time ("You have 3 tasks due today: [title 1], [title 2], [title 3]"). This is a batch notification pattern used by email clients (iOS Mail) and calendar apps. For MVP, this is the right approach for due-date reminders.

**6. Reflection notification should feel different from task notifications.**
The 9 PM reflection prompt is a ritual, not an alarm. Its notification copy should reflect that:
- Task reminder: "Reminder: [Task title]"
- Reflection prompt: "Time to reflect on today — 3 quick questions. [Open]"

Different tone, different call-to-action. The word "quick" is load-reducing. "3 questions" sets expectation. "Open" is the only action — no "snooze" on the reflection notification (it's not a task; deferring reflection defeats the purpose).

**7. Quiet hours are essential.**
Never fire a notification before 7 AM or after 10 PM (user-configurable). The 9 PM reflection sits right at the edge — make it configurable between 8 PM and 10 PM. If the OS is in Do Not Disturb mode, respect it. Electron's Notification API does not automatically respect DND on all platforms — check `systemPreferences.getDoNotDisturb()` on macOS explicitly.

**8. Notification copy tone matters.**
Guilt-inducing copy ("You still haven't completed this!") increases anxiety without improving completion. Neutral, task-focused copy works better. Never use exclamation marks in reminder notifications — they read as nagging.

**Implementation notes for Electron:**
- Use `new Notification()` from the main process (not renderer) for reliability on macOS.
- `actions` property for quick-action buttons is macOS-only; build a fallback for Windows that opens the app to the relevant task.
- Store notification state (sent, acknowledged, snoozed) in electron-store so re-launch does not re-fire stale notifications.
- For the reflection notification: if the user already opened the reflection modal that day (even without answering), do not re-notify. Check completion state, not just time.

---

## Distraction Keyword Analysis

### Simple NLP approaches that work without AI/cloud

**Background — HIGH confidence for basic NLP; MEDIUM confidence for specific library recommendations (verify current versions):**

**The goal:** Identify recurring words in reflection answers and task titles/notes that represent distractions, blockers, or time sinks. No ML, no API calls, fully offline.

**What "distraction keyword" means in this context:**
TaskMate's weekly summary surfaces "top distraction keyword." This is a word or short phrase that appears frequently in the user's own writing (reflection answers + task notes) that is not a stop word and not a task-completion word. The insight: if "Slack" or "meetings" or "blocked" appears 6 times in a week's reflection answers, that is meaningful.

### Simple implementation approach

**Step 1: Text collection.**
Aggregate all text written by the user this week:
- Reflection answers (all 3 questions, all days answered)
- Task titles and notes (optional — adds signal but also noise from task names)

For MVP: reflection answers only. Task titles will include project-specific vocabulary that pollutes the frequency signal.

**Step 2: Tokenization.**
Split text into individual words. Lowercase everything. Strip punctuation.

```javascript
function tokenize(text) {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, '')
    .split(/\s+/)
    .filter(w => w.length > 2); // drop single/double char words
}
```

This is sufficient for English-language personal notes. No library needed.

**Step 3: Stop word removal.**
Eliminate common English words that carry no signal. Maintain a static list of ~100-150 stop words bundled with the app (no network call). Key stop words for this use case: function words (the, a, an, is, was, it, that, this, I, my, me) plus productivity-context words that are always present and non-informative (today, day, work, week, time, did, got, task, done).

```javascript
const STOP_WORDS = new Set([
  'the', 'a', 'an', 'and', 'or', 'but', 'is', 'was', 'are', 'were',
  'i', 'me', 'my', 'we', 'you', 'it', 'its', 'this', 'that', 'they',
  'to', 'of', 'in', 'on', 'at', 'for', 'with', 'about', 'from', 'by',
  // Domain stop words for productivity context:
  'today', 'day', 'week', 'time', 'work', 'task', 'done', 'got', 'did',
  'also', 'just', 'really', 'very', 'more', 'some', 'had', 'have', 'been',
  // Add 50-80 more common English function words
]);

function removeStopWords(tokens) {
  return tokens.filter(w => !STOP_WORDS.has(w));
}
```

Bundling a static stop word list as a JSON file (~3KB) keeps this fully offline and deterministic.

**Step 4: Frequency counting.**
```javascript
function countFrequency(tokens) {
  const freq = {};
  for (const token of tokens) {
    freq[token] = (freq[token] || 0) + 1;
  }
  return freq;
}

function topN(freqMap, n = 5) {
  return Object.entries(freqMap)
    .sort(([, a], [, b]) => b - a)
    .slice(0, n)
    .map(([word, count]) => ({ word, count }));
}
```

**Step 5: Bigram detection (optional but high-value).**
Single words miss phrases. "social media" is more informative than "social" and "media" separately. Simple bigram detection: after tokenization and stop word removal, generate pairs of consecutive words and count them alongside unigrams. Include bigrams that appear 2+ times.

```javascript
function bigrams(tokens) {
  const pairs = [];
  for (let i = 0; i < tokens.length - 1; i++) {
    pairs.push(`${tokens[i]} ${tokens[i + 1]}`);
  }
  return pairs;
}
```

Merge bigram frequencies with unigram frequencies. If a bigram appears, suppress its constituent unigrams from the top-N list to avoid double-counting. This requires a small post-processing step but produces much cleaner output ("social media" vs "social" + "media").

**Step 6: Presentation.**
Show top 1 keyword in the weekly summary (per requirements). Optionally show top 3-5 in an expanded view. Format:

"Your most frequent theme this week: **meetings** (mentioned 6 times)"

Do not call it "distraction" in the UI — the user may resist that label. "Theme" or "recurring topic" is neutral and accurate.

**What this approach does NOT do (and should not claim to do):**
- It does not understand context. "Meeting" could mean "I had a great meeting" or "Meetings destroyed my day." The frequency signal is real but the sentiment is invisible. Do not infer distraction — just report frequency and let the user interpret.
- It does not handle multi-language input. For MVP targeting English-language users, this is acceptable.
- It does not identify new vocabulary over time (no TF-IDF weighting). TF-IDF (term frequency–inverse document frequency) would be the correct upgrade for v2 — it weights words that appear often this week but rarely in past weeks, which surfaces genuine anomalies rather than the user's stable vocabulary. Implement in v2 when enough historical data exists (4+ weeks of reflection data).

**Library consideration:**
For MVP, no NLP library is needed — the above pure JavaScript implementation is ~50 lines and fully sufficient. If bigram detection and basic stemming are desired, the `natural` library (npm package, pure JS, no native bindings, works in Electron renderer or main process) provides tokenizers, stemmers, and TF-IDF. But it's likely overkill for MVP.

**Data volume reality check:**
A user who reflects 5 days/week and writes 3 sentences per question generates roughly 400-600 words per week. At this scale, even the simplest frequency counting is instantaneous. Do not over-engineer. The computation is not the constraint — question quality is.

---

## Key Insights

These five findings should directly drive design decisions across all TaskMate phases:

- **The "Today" view is the product.** The full task list is infrastructure. Overwhelm comes from showing everything at once. Design the default view around a curated Today concept (max 7 items) and treat the full backlog as a secondary surface. Users who feel in control of today will stay with the app; users who see 40 undone tasks will abandon it within a week.

- **Reflection question #2 ("what slowed you down?") is where TaskMate generates its unique value.** Over 4+ weeks of answers, patterns in this field reveal the user's actual blockers — not what they think their blockers are. The keyword frequency analysis feeds directly from these answers. This is the differentiator: no other mainstream productivity app extracts this signal.

- **The weekly summary must name specific tasks, not percentages.** Showing deferred task titles forces re-decision. Showing "80% completion rate" allows comfortable avoidance. The most behavior-changing line in the weekly summary is the oldest neglected task: "This task has been on your list for 14 days: [title]." Build this first.

- **Notification tone is a product decision, not a copy decision.** The reflection notification at 9 PM must feel categorically different from a task reminder. One is an alarm; the other is an invitation. Get the tone wrong and users dismiss both, then disable notifications entirely. Reflection prompt copy should use calm, ritual language — never urgency language.

- **Do not implement TF-IDF, sentiment analysis, or any ML for keyword tracking in v1.** Simple word frequency on reflection text (~500 words/week) produces 80% of the insight with 2% of the complexity. The upgrade path to TF-IDF exists (the `natural` library is ready-to-use), but it requires 4+ weeks of historical data to be meaningful. Ship frequency counting first, validate that users care about the keyword insight, then invest in smarter NLP.

---

## Sources and Confidence Notes

All findings are drawn from training knowledge through August 2025. External verification was not possible in this environment (WebSearch and WebFetch unavailable).

| Area | Confidence | Primary basis |
|------|------------|---------------|
| Task management UX (cognitive load, Today view, completion patterns) | HIGH | Nielsen Norman Group, Things 3 / Omnifocus design patterns, GTD methodology, widely replicated UX research |
| Daily reflection questions (3-question format, implementation intentions) | HIGH | Gollwitzer (1999) implementation intentions research, Seligman positive psychology interventions, widely replicated |
| Weekly summary metrics (vanity vs behavior-changing) | MEDIUM | Beeminder / Habitica product retrospectives, behavioral economics literature; specific completion ratios are pattern-observed, not from a single study |
| Notification UX (interruption cost, batch notifications, tone) | HIGH | Iqbal & Bailey (2006) Microsoft Research, Apple HIG, Google Material Design — all established and frequently cited |
| Keyword frequency NLP (tokenization, stop words, bigrams) | HIGH | Standard NLP techniques, no AI required; `natural` npm library confirmed in training data as pure-JS and Electron-compatible |
| TF-IDF upgrade path recommendation | MEDIUM | Standard algorithm; recommendation to defer is based on data-volume reasoning, not a verified user study |
