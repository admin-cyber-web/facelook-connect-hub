-- Limit private chat-music broadcasts to the two users named in the room topic.
-- Room topics use: chat_music_sync:<user UUID>:<user UUID>

DROP POLICY IF EXISTS "Chat music room participants can receive broadcasts"
  ON realtime.messages;
CREATE POLICY "Chat music room participants can receive broadcasts"
  ON realtime.messages
  FOR SELECT
  TO authenticated
  USING (
    split_part(realtime.topic(), ':', 1) = 'chat_music_sync'
    AND auth.uid()::text IN (
      split_part(realtime.topic(), ':', 2),
      split_part(realtime.topic(), ':', 3)
    )
  );

DROP POLICY IF EXISTS "Chat music room participants can send broadcasts"
  ON realtime.messages;
CREATE POLICY "Chat music room participants can send broadcasts"
  ON realtime.messages
  FOR INSERT
  TO authenticated
  WITH CHECK (
    split_part(realtime.topic(), ':', 1) = 'chat_music_sync'
    AND auth.uid()::text IN (
      split_part(realtime.topic(), ':', 2),
      split_part(realtime.topic(), ':', 3)
    )
  );
