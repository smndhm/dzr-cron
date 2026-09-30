# dzr-cron state

Not code. The `new-releases` cron writes `removed.json` here, and reads it on
the next run.

The playlist was its memory of what it had already poured in, and taking a
played track out destroys that memory: the track falls out of the Deezer
listening history within hours, its album is still inside the discovery window,
and the next run pours it straight back in. Seven such returns were measured
over two weeks.

The playlist description was the obvious place to write the ids instead. Deezer
keeps 255 characters of it and drops the rest without answering an error, which
leaves room for about twenty ids where sixty are needed, so they live here.

`removed.json` maps a Deezer track id to the day it was taken out. An id is
dropped once its album can no longer fall inside the window.

This branch is an orphan: it shares no history with `master` and holds no code.
No workflow listens to it, so a commit here runs nothing.
