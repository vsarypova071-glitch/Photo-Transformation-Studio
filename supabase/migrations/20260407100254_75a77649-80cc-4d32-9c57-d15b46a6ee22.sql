
INSERT INTO storage.buckets (id, name, public) VALUES ('user-photos', 'user-photos', true);

CREATE POLICY "Anyone can upload photos"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'user-photos');

CREATE POLICY "Anyone can read photos"
ON storage.objects FOR SELECT
USING (bucket_id = 'user-photos');
