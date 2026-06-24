import { describe, expect, it } from 'vitest';
import { acrMatchToClipFieldPatch } from '@/react-app/lib/acrClipFieldPatch';

describe('acrMatchToClipFieldPatch', () => {
  it('fills song and artist when fields are empty', () => {
    expect(
      acrMatchToClipFieldPatch(
        { artist_name: '', song_title: '', content_description: 'Great night' },
        { artist: 'Taylor Swift', title: 'Anti-Hero' },
      ),
    ).toEqual({
      song_title: 'Anti-Hero',
      artist_name: 'Taylor Swift',
      content_description: 'Anti-Hero\n\nGreat night',
    });
  });

  it('does not overwrite an existing song title during upload-style runs', () => {
    expect(
      acrMatchToClipFieldPatch(
        { artist_name: '', song_title: 'Manual', content_description: '' },
        { artist: 'Taylor Swift', title: 'Anti-Hero' },
        { overwriteSongTitle: false },
      ),
    ).toEqual({ artist_name: 'Taylor Swift' });
  });

  it('overwrites song title for post-upload recognition', () => {
    expect(
      acrMatchToClipFieldPatch(
        { artist_name: 'Headliner', song_title: 'Old title', content_description: 'Caption' },
        { artist: 'Other Artist', title: 'New Song' },
        { overwriteSongTitle: true },
      ),
    ).toEqual({
      song_title: 'New Song',
      content_description: 'New Song\n\nCaption',
    });
  });
});
