-- StudyOffline: database setup for Supabase
-- Paste this whole file into Supabase > SQL Editor > New query, then press Run.

create table if not exists public.lessons (
  id        text primary key,
  position  integer not null,
  title     text not null,
  body      text not null,
  version   integer not null default 1
);

create table if not exists public.notes (
  id          text primary key,
  user_id     uuid not null references auth.users (id) on delete cascade,
  lesson_id   text not null,
  text        text not null,
  updated_at  bigint not null,
  synced_at   bigint
);

-- Permissions for the Data API. Since 2026, new Supabase projects do NOT give
-- these automatically, and without them the app gets "permission denied".
grant usage on schema public to authenticated;
grant select on public.lessons to authenticated;
grant select, insert, update, delete on public.notes to authenticated;

-- Row Level Security: the database itself enforces who can see what.
alter table public.lessons enable row level security;
alter table public.notes   enable row level security;

drop policy if exists "Signed-in users can read lessons" on public.lessons;
create policy "Signed-in users can read lessons"
  on public.lessons for select to authenticated using (true);

drop policy if exists "Users manage only their own notes" on public.notes;
create policy "Users manage only their own notes"
  on public.notes for all to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- The six lessons
insert into public.lessons (id, position, title, body, version) values
  ($lesson$l1$lesson$, 1, $lesson$What Is Software Engineering?$lesson$, $lesson$Software engineering is the disciplined process of designing, building, testing, and maintaining software systems. It is not just writing code, but doing so in a way that is reliable, maintainable, and fit for the people who will use it.

Unlike a quick script written to solve a one-off problem, engineered software is expected to survive changing requirements, multiple contributors, and years of real-world use. This is why the field borrows practices from other engineering disciplines: specification, planning, testing, and iteration.

At ALU, this course frames every concept around a core question: how do we build solutions that solve real problems for real communities, responsibly and sustainably?$lesson$, 1),
  ($lesson$l2$lesson$, 2, $lesson$The Software Development Lifecycle$lesson$, $lesson$Every software project, regardless of size, tends to move through the same broad phases: understanding the problem, planning a solution, building it, testing it, releasing it, and maintaining it afterward.

Different development models organize these phases differently. Waterfall treats them as strict, sequential steps. Agile treats them as a repeating cycle, revisited in short iterations so the team can adapt as they learn.

Choosing a model is not about picking the "correct" one. It is about matching the model to how well-understood your requirements are, and how much your solution is likely to change as you test it with real users.$lesson$, 1),
  ($lesson$l3$lesson$, 3, $lesson$Agile and Scrum Fundamentals$lesson$, $lesson$Agile is a philosophy: build in small increments, gather feedback constantly, and treat change as expected rather than exceptional.

Scrum is one concrete way of practising Agile. Work is organized into short sprints, usually one to two weeks long. Each sprint ends with a working, demoable piece of the product. It is not a finished product, but a real, testable slice of it.

This matters most when a team does not yet know exactly what users need. Instead of guessing everything upfront, Scrum lets the team build a small piece, learn from it, and adjust the next sprint accordingly.$lesson$, 1),
  ($lesson$l4$lesson$, 4, $lesson$Writing a Strong Problem Statement$lesson$, $lesson$A problem statement should describe who is affected, what the problem actually is, and why it matters, grounded in something observable and not assumed.

Weak problem statements are vague ("students struggle with access to learning"). Strong ones are specific: who, how often, under what conditions, and with what consequence.

A good test: could someone who has never met you read your problem statement and picture the exact situation you are describing? If not, it needs another pass.$lesson$, 1),
  ($lesson$l5$lesson$, 5, $lesson$Functional and Non-Functional Requirements$lesson$, $lesson$A functional requirement (FR) says what the system must do, for example "allow the user to save a note on the device". A non-functional requirement (NFR) says how well it must do it, for example "stored lessons must load in under one second".

Every requirement should have a unique ID and a priority. High priority means the product cannot solve its problem without it; medium means it is expected but the product still works without it; low means it is useful but can wait.

A good requirement is specific enough to be tested. If you cannot describe how you would check it, it needs rewriting.$lesson$, 1),
  ($lesson$l6$lesson$, 6, $lesson$Modelling with UML$lesson$, $lesson$The Unified Modeling Language (UML) gives teams a shared way to draw how a system is built and how it behaves, before and while it is coded.

A use case diagram shows who uses the system and what they can do. A class diagram shows the building blocks and how they relate. A sequence diagram shows the order of messages in one scenario. A state machine diagram shows the states one object moves through.

No single diagram tells the whole story. Each one answers a different question, so a good analysis uses several together.$lesson$, 1)
on conflict (id) do update set position = excluded.position, title = excluded.title, body = excluded.body, version = excluded.version;
