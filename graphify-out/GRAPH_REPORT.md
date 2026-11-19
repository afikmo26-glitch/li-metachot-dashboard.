# Graph Report - li-metachot-dashboard.  (2026-11-19)

## Corpus Check
- Corpus is ~10,265 words - fits in a single context window. You may not need a graph.

## Summary
- 67 nodes · 179 edges · 11 communities (7 shown, 4 thin omitted)
- Extraction: 99% EXTRACTED · 1% INFERRED · 0% AMBIGUOUS · INFERRED: 1 edges (avg confidence: 0.85)
- Token cost: 0 input · 0 output

## Community Hubs (Navigation)
- Campaign Data Scripts
- System Verification
- Facebook Connectivity Tests
- API Settings & Auth
- AI Generation
- Routes & Static Serving
- Campaigns & Posts API
- Post Scheduler
- Group Checker
- Manual Campaign Poster

## God Nodes (most connected - your core abstractions)
1. `load_data()` - 14 edges
2. `require_auth()` - 14 edges
3. `handle_posts()` - 8 edges
4. `save_data()` - 7 edges
5. `handle_campaigns()` - 7 edges
6. `generate_image()` - 7 edges
7. `log_action()` - 6 edges
8. `check_scheduled_posts()` - 5 edges
9. `handle_settings()` - 5 edges
10. `debug_models()` - 5 edges

## Surprising Connections (you probably didn't know these)
- `check_facebook_connection()` --calls--> `requests`  [EXTRACTED]
  check_fb_connectivity.py →   _Bridges community 3 → community 2_
- `check_groups()` --calls--> `requests`  [EXTRACTED]
  check_groups.py →   _Bridges community 9 → community 2_
- `get_group_names()` --calls--> `json`  [EXTRACTED]
  fetch_real_names.py →   _Bridges community 2 → community 0_
- `post_content()` --calls--> `json`  [EXTRACTED]
  post_campaign_now.py →   _Bridges community 10 → community 0_
- `post_content()` --calls--> `requests`  [EXTRACTED]
  post_campaign_now.py →   _Bridges community 10 → community 2_

## Import Cycles
- None detected.

## Communities (11 total, 4 thin omitted)

### Community 0 - "Campaign Data Scripts"
Cohesion: 0.25
Nodes (6): add_campaigns(), append_campaigns(), fix_urls(), reset_and_add_campaigns(), handle_images(), upload_file()

### Community 2 - "System Verification"
Cohesion: 0.43
Nodes (5): get_group_names(), test_ai(), test_facebook(), test_health(), test_upload()

### Community 4 - "API Settings & Auth"
Cohesion: 0.43
Nodes (7): get_history(), handle_groups(), handle_settings(), load_data(), require_auth(), decorated(), test_facebook()

### Community 5 - "AI Generation"
Cohesion: 0.40
Nodes (3): debug_models(), generate_ai(), generate_image()

### Community 6 - "Routes & Static Serving"
Cohesion: 0.40
Nodes (4): health(), serve_index(), serve_upload(), verify_token()

### Community 7 - "Campaigns & Posts API"
Cohesion: 0.83
Nodes (4): handle_campaigns(), handle_posts(), log_action(), save_data()

### Community 8 - "Post Scheduler"
Cohesion: 0.67
Nodes (3): check_scheduled_posts(), post_to_facebook(), run_scheduler()

## Knowledge Gaps
- **4 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `load_data()` connect `API Settings & Auth` to `Campaign Data Scripts`, `Server Framework`, `AI Generation`, `Routes & Static Serving`, `Campaigns & Posts API`, `Post Scheduler`?**
  _High betweenness centrality (0.051) - this node is a cross-community bridge._
- **Why does `require_auth()` connect `API Settings & Auth` to `Campaign Data Scripts`, `Server Framework`, `AI Generation`, `Routes & Static Serving`, `Campaigns & Posts API`?**
  _High betweenness centrality (0.019) - this node is a cross-community bridge._
- **Why does `post_to_facebook()` connect `Post Scheduler` to `Campaign Data Scripts`, `Server Framework`, `System Verification`, `Campaigns & Posts API`?**
  _High betweenness centrality (0.010) - this node is a cross-community bridge._