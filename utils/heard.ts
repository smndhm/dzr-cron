// Taking a track out of a playlist once it has been played is what both the
// releases crons do with the answers they already hold, so the rule lives here
// rather than in whichever of them happens to run.
import { deletePlaylistTracks } from './dzr';

// The songs parameter of a delete travels in the url, so it is split rather
// than finding out where Deezer stops reading.
const DELETE_SIZE = 100;

// Returns what it took out, so the caller reports it under its own name.
export const takeOutHeard = async (
  access_token: string,
  playlistId: number,
  playlistTracksId: Iterable<number>,
  playedTracksId: Set<number>,
): Promise<number[]> => {
  const tracksToRemove = Array.from(playlistTracksId).filter((track) =>
    playedTracksId.has(track),
  );

  for (let i = 0; i < tracksToRemove.length; i += DELETE_SIZE) {
    await deletePlaylistTracks(
      access_token,
      playlistId,
      tracksToRemove.slice(i, i + DELETE_SIZE),
    );
  }

  return tracksToRemove;
};
