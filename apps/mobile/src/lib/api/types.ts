/** Minimal clip shape for RN feeds — mirrors `ClipWithUser` without pulling Zod into Metro. */
export type ClipFeedItem = {
  id: number;
  mocha_user_id: string;
  artist_name: string | null;
  venue_name: string | null;
  location?: string | null;
  song_title?: string | null;
  content_description: string | null;
  video_url: string;
  thumbnail_url: string | null;
  stream_video_id?: string | null;
  stream_playback_url?: string | null;
  stream_thumbnail_url?: string | null;
  r2_raw_key?: string | null;
  likes_count: number;
  comments_count: number;
  views_count: number;
  is_trending_score?: number | null;
  momentum_live_featured?: boolean | number | null;
  user_display_name: string | null;
  user_avatar: string | null;
  created_at: string;
  timestamp?: string | null;
};

export type ClipsPage = {
  clips: ClipFeedItem[];
  page: number;
  limit: number;
  hasMore: boolean;
};

export type ShowEvent = {
  id?: string;
  name?: string;
  title?: string;
  artist_name?: string;
  venue_name?: string;
  start_date?: string;
  startDate?: string;
  location?: string;
  [key: string]: unknown;
};

export type ShowsResponse = {
  events: ShowEvent[];
  location?: {
    latitude: number;
    longitude: number;
    source?: string;
    label?: string | null;
  };
  personalized?: boolean;
  source?: string;
  jambaseNotice?: string | null;
};

export type DiscoverFeedResponse = {
  clips: ClipFeedItem[];
  artists: Array<{
    name: string;
    image_url?: string | null;
    clip_count?: number;
  }>;
  nearbyEvents: ShowEvent[];
  location?: ShowsResponse['location'];
  jambaseNotice?: string | null;
};

export type FavoriteArtistFeedResponse = {
  clips: ClipFeedItem[];
  hasMore?: boolean;
  clips_offset?: number;
};

export type UserShowMark = {
  jambase_event_id: string;
  status: 'going' | 'attended' | string;
  event_title?: string | null;
  artist_name?: string | null;
  venue_name?: string | null;
  start_date?: string | null;
  [key: string]: unknown;
};

export type ShowMarksResponse = {
  marks: UserShowMark[];
  events?: Record<string, unknown>[];
};

export type FriendGoingGroup = {
  mocha_user_id: string;
  display_name: string | null;
  profile_image_url: string | null;
  marks: UserShowMark[];
};

export type FriendsGoingResponse = {
  friends?: FriendGoingGroup[];
  groups?: FriendGoingGroup[];
  eventsByEventId?: Record<string, Record<string, unknown>>;
};

export type PointsResponse = {
  points: number;
  level: number;
};

export type AppNotification = {
  id: number;
  type: string;
  content: string;
  related_user_id: string | null;
  related_clip_id: number | null;
  is_read: boolean;
  created_at: string;
  user_display_name?: string | null;
  user_avatar?: string | null;
};

export type NotificationsResponse = {
  notifications: AppNotification[];
  unread_count: number;
};
