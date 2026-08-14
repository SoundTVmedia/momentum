import { describe, expect, it } from 'vitest';
import { selectAcrCloudMatch } from './acrcloud-client';

function acrJson(music: Array<{ title: string; artists: Array<{ name: string }> }>) {
  return { metadata: { music } };
}

describe('selectAcrCloudMatch', () => {
  it('returns the top hit when no show artist is set', () => {
    const selected = selectAcrCloudMatch(
      acrJson([
        { title: 'Started From the Bottom', artists: [{ name: 'Drake' }] },
        { title: 'Sittin\' Sidewayz', artists: [{ name: 'Paul Wall' }] },
      ]),
    );
    expect(selected.match?.title).toBe('Started From the Bottom');
    expect(selected.artistFiltered).toBe(false);
  });

  it('picks the Paul Wall candidate instead of a higher-ranked other artist', () => {
    const selected = selectAcrCloudMatch(
      acrJson([
        { title: 'Started From the Bottom', artists: [{ name: 'Drake' }] },
        { title: 'Sittin\' Sidewayz', artists: [{ name: 'Paul Wall' }, { name: 'Big Pokey' }] },
      ]),
      'Paul Wall',
    );
    expect(selected.match).toEqual(
      expect.objectContaining({
        title: 'Sittin\' Sidewayz',
        artist: 'Paul Wall, Big Pokey',
      }),
    );
    expect(selected.artistFiltered).toBe(false);
  });

  it('treats only-wrong-artist hits as no match', () => {
    const selected = selectAcrCloudMatch(
      acrJson([{ title: 'Started From the Bottom', artists: [{ name: 'Drake' }] }]),
      'Paul Wall',
    );
    expect(selected.match).toBeNull();
    expect(selected.artistFiltered).toBe(true);
  });
});
