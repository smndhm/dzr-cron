# dzr-cron state

Not code. The `new-releases` cron writes `poured.json` here, and reads it on the
next run.

The playlist was its memory of what it had already poured in, and it loses a
track the moment anything takes it out — the cron on a play, or the owner
deciding they do not want it. The track then reads as new: it is in neither the
playlist nor the short Deezer listening history, and its album is still inside
the discovery window. Seven such returns were measured over two weeks.

So what has been poured in is written down, which is the rule itself: a release
is poured in once and never again. The playlist description was the obvious
place for the ids, and it holds 255 characters — Deezer keeps the first ones and
drops the rest without answering an error — which leaves room for about twenty
where sixty are needed.

`poured.json` maps a Deezer track id to the release date of the album it came
from, rather than to the day it was poured in: that is the date the window
compares against, so an id is kept exactly as long as its album can still be
looked at. A single out weeks before its album is kept until the album is out.

This branch is an orphan: it shares no history with `master` and holds no code.
No workflow listens to it, so a commit here runs nothing.
