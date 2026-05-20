import { describe, expect, it } from 'vitest';
import {
  aggregateFavoriteArtistVideos,
  buildFavoriteArtistMostLikedFeed,
  parseYoutubeChannelIdFromSocialLinks,
  parseYoutubeChannelIdFromUrl,
} from './youtube-client';

describe('parseYoutubeChannelIdFromUrl', () => {
  it('extracts UC id from channel URL', () => {
    expect(
      parseYoutubeChannelIdFromUrl('https://www.youtube.com/channel/UCxyz1234567890abcdefghijk'),
    ).toBe('UCxyz1234567890abcdefghijk');
  });

  it('returns null for non-channel URLs', () => {
    expect(parseYoutubeChannelIdFromUrl('https://www.youtube.com/watch?v=abc')).toBeNull();
  });
});

describe('parseYoutubeChannelIdFromSocialLinks', () => {
  it('reads youtube key from social_links JSON', () => {
    const json = JSON.stringify({
      spotify: 'https://open.spotify.com/artist/x',
      youtube: 'https://www.youtube.com/channel/UCtestchannel00000000001',
    });
    expect(parseYoutubeChannelIdFromSocialLinks(json)).toBe('UCtestchannel00000000001');
  });
});

describe('aggregateFavoriteArtistVideos', () => {
  it('returns global top by views and likes', () => {
    const pools = [
      {
        artistName: 'A',
        videos: [
          {
            videoId: 'v1',
            title: 'A1',
            thumbnailUrl: '',
            viewCount: 100,
            likeCount: 10,
            publishedAt: '',
            channelTitle: 'A',
            artistName: 'A',
            watchUrl: 'https://youtu.be/v1',
          },
          {
            videoId: 'v2',
            title: 'A2',
            thumbnailUrl: '',
            viewCount: 50,
            likeCount: 200,
            publishedAt: '',
            channelTitle: 'A',
            artistName: 'A',
            watchUrl: 'https://youtu.be/v2',
          },
        ],
      },
      {
        artistName: 'B',
        videos: [
          {
            videoId: 'v3',
            title: 'B1',
            thumbnailUrl: '',
            viewCount: 500,
            likeCount: 5,
            publishedAt: '',
            channelTitle: 'B',
            artistName: 'B',
            watchUrl: 'https://youtu.be/v3',
          },
        ],
      },
    ];

    const { mostViewed, mostLiked } = aggregateFavoriteArtistVideos(pools, 2);
    expect(mostViewed.map((v) => v.videoId)).toEqual(['v3', 'v1']);
    expect(mostLiked.map((v) => v.videoId)).toEqual(['v2', 'v1']);
  });
});

describe('buildFavoriteArtistMostLikedFeed', () => {
  const mk = (
    id: string,
    artist: string,
    likes: number,
  ): {
    videoId: string;
    title: string;
    thumbnailUrl: string;
    viewCount: number;
    likeCount: number;
    publishedAt: string;
    channelTitle: string;
    artistName: string;
    watchUrl: string;
  } => ({
    videoId: id,
    title: id,
    thumbnailUrl: '',
    viewCount: 0,
    likeCount: likes,
    publishedAt: '',
    channelTitle: artist,
    artistName: artist,
    watchUrl: `https://youtu.be/${id}`,
  });

  it('includes one top-liked per artist before filling', () => {
    const pools = [
      {
        artistName: 'A',
        videos: [mk('a1', 'A', 50), mk('a2', 'A', 100)],
      },
      {
        artistName: 'B',
        videos: [mk('b1', 'B', 30)],
      },
    ];

    const feed = buildFavoriteArtistMostLikedFeed(pools, 4);
    expect(feed.map((v) => v.videoId)).toEqual(['a2', 'b1', 'a1']);
  });

  it('caps at totalLimit when many artists', () => {
    const pools = [
      { artistName: 'A', videos: [mk('a1', 'A', 10)] },
      { artistName: 'B', videos: [mk('b1', 'B', 20)] },
      { artistName: 'C', videos: [mk('c1', 'C', 30)] },
    ];
    expect(buildFavoriteArtistMostLikedFeed(pools, 2).map((v) => v.videoId)).toEqual(['a1', 'b1']);
  });
});
