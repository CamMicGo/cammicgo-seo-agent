# LinkedIn — live checks (real account, real phone)

These are **live** checks, run by hand through the MCP tools with the CamMicGo Android app open on its
LinkedIn tab ("LinkedIn MCP" allowed). They are not automated: their result depends on the account, the
LinkedIn layout of the day and what LinkedIn chooses to show. The automated **fixture** tests
(`tests/linkedin-reader.test.ts`) run the same shipped script on saved, fictional pages; a fixture pass is
never a live pass.

Validation reference supplied by the owner (used only here, never in code):
author "El kacemi wafae" (https://www.linkedin.com/in/elkacemi-wafae/), post « GTA VI... on peut parler de
ces graphismes deux minutes ? » (Rockstar, RAGE, ray tracing, PBR, 1440p→4K, 30 FPS, 4 images), last seen
with 14 reactions and 3 comments (Tarik MEDJAHED; Sabri FOURY; a reply of the author to Sabri FOURY).
Counts may have changed since: compare with what LinkedIn shows at test time.

| # | Tool call | Expected |
|---|-----------|----------|
| 1 | `linkedin_search_profiles {keywords:"El kacemi wafae"}` | the profile is listed |
| 2 | `linkedin_search_posts {keywords:"GTA VI graphismes", author:"El kacemi wafae"}` | status ok, the post first, author/profile/photo/text/4 images; postUrl when LinkedIn exposes the id |
| 3 | `linkedin_search_posts {author:"El kacemi wafae"}` | posts of the author (attempts shows the strategy used) |
| 4 | `linkedin_profile_posts {profile:"elkacemi-wafae", keywords:"GTA VI"}` | the post from the activity page |
| 5 | `linkedin_feed {limit:10}` | status ok and posts; if empty, status explains (never "no news") |
| 6 | `linkedin_post_comments {postUrl:<from 2>}` | all comments, the reply threaded under Sabri FOURY with isPostAuthor=true on the author, real photos, displayedCount/complete |
| 7 | open the post's comment sheet over the search results in the app, then `linkedin_current_post_comments {}` | read in place, no navigation |
| 8 | `linkedin_current_post_reactions {}` / `linkedin_post_reactions {postUrl}` | expectedTotal = LinkedIn's counter, byType per category, complete or explicit missing |
| 9 | `linkedin_post_full_extraction {keywords:"GTA VI graphismes", author:"El kacemi wafae"}` | the 17 steps: search → filter → keywords/author → activity fallback → URL → open → comments → wait → expand → read → reactions → categories → read → consistency → result |
| 10 | Watch the phone during 6–9 | no three-dots menu opens, no reaction is added, nothing is posted |
