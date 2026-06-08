-- ============================================================
-- ZERO BROKER — Complete Database Schema
-- Based on IDE303 Software Engineering Startup Proposal
-- Run this ENTIRE file in Supabase SQL Editor
-- ============================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ─────────────────────────────────────────
-- 1. PROFILES
-- ─────────────────────────────────────────
CREATE TABLE profiles (
  id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  full_name TEXT NOT NULL DEFAULT 'User',
  phone TEXT,
  avatar_url TEXT,
  role TEXT NOT NULL DEFAULT 'buyer' CHECK (role IN ('buyer','seller','broker','admin')),
  is_verified BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ─────────────────────────────────────────
-- 2. BROKER PROFILES
-- ─────────────────────────────────────────
CREATE TABLE broker_profiles (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE UNIQUE NOT NULL,
  license_number TEXT,
  bio TEXT,
  years_experience INTEGER DEFAULT 0,
  specialization TEXT,
  is_verified BOOLEAN DEFAULT FALSE,
  avg_rating NUMERIC(3,2) DEFAULT 0,
  total_reviews INTEGER DEFAULT 0,
  total_deals INTEGER DEFAULT 0,
  subscription_tier TEXT DEFAULT 'free' CHECK (subscription_tier IN ('free','basic','premium')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ─────────────────────────────────────────
-- 3. LISTINGS (pending → active via admin)
-- ─────────────────────────────────────────
CREATE TABLE listings (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  owner_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  broker_id UUID REFERENCES profiles(id),
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  price NUMERIC(15,2) NOT NULL,
  property_type TEXT NOT NULL CHECK (property_type IN ('land','house','apartment','commercial','vehicle')),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','active','enquiring','negotiating','sold','paused')),
  dzongkhag TEXT NOT NULL,
  gewog TEXT,
  location_name TEXT NOT NULL,
  latitude NUMERIC(10,7),
  longitude NUMERIC(10,7),
  bedrooms INTEGER,
  bathrooms INTEGER,
  area_sqft NUMERIC(10,2),
  is_featured BOOLEAN DEFAULT FALSE,
  images TEXT[] DEFAULT '{}',
  amenities TEXT[] DEFAULT '{}',
  approved_at TIMESTAMPTZ,
  approved_by UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ─────────────────────────────────────────
-- 4. ENQUIRIES
-- ─────────────────────────────────────────
CREATE TABLE enquiries (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  listing_id UUID REFERENCES listings(id) ON DELETE CASCADE NOT NULL,
  buyer_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  seller_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  message TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','accepted','declined','negotiating','completed')),
  buyer_confirmed_deal BOOLEAN DEFAULT FALSE,
  seller_confirmed_deal BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(listing_id, buyer_id)
);

-- ─────────────────────────────────────────
-- 5. REVIEWS
-- ─────────────────────────────────────────
CREATE TABLE reviews (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  broker_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  reviewer_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  listing_id UUID REFERENCES listings(id) ON DELETE SET NULL,
  rating INTEGER NOT NULL CHECK (rating BETWEEN 1 AND 5),
  comment TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(broker_id, reviewer_id, listing_id)
);

-- ─────────────────────────────────────────
-- 6. SAVED LISTINGS
-- ─────────────────────────────────────────
CREATE TABLE saved_listings (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  listing_id UUID REFERENCES listings(id) ON DELETE CASCADE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, listing_id)
);

-- ─────────────────────────────────────────
-- 7. NOTIFICATIONS
-- ─────────────────────────────────────────
CREATE TABLE notifications (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('enquiry','status_change','deal','review','admin','system')),
  is_read BOOLEAN DEFAULT FALSE,
  link TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- TRIGGERS
-- ============================================================

-- Auto-create profile on signup
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, role)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', 'User'),
    COALESCE(NEW.raw_user_meta_data->>'role', 'buyer')
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- Auto-update listing status based on enquiries
CREATE OR REPLACE FUNCTION update_listing_status()
RETURNS TRIGGER AS $$
DECLARE
  lid UUID;
  accepted_count INTEGER;
  pending_count INTEGER;
BEGIN
  lid := COALESCE(NEW.listing_id, OLD.listing_id);
  SELECT COUNT(*) INTO accepted_count FROM enquiries WHERE listing_id = lid AND status IN ('accepted','negotiating');
  SELECT COUNT(*) INTO pending_count FROM enquiries WHERE listing_id = lid AND status = 'pending';
  IF accepted_count > 0 THEN
    UPDATE listings SET status = 'negotiating', updated_at = NOW() WHERE id = lid AND status NOT IN ('sold','pending');
  ELSIF pending_count > 0 THEN
    UPDATE listings SET status = 'enquiring', updated_at = NOW() WHERE id = lid AND status NOT IN ('sold','pending');
  ELSE
    UPDATE listings SET status = 'active', updated_at = NOW() WHERE id = lid AND status NOT IN ('sold','pending','paused');
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_enquiry_change
  AFTER INSERT OR UPDATE ON enquiries
  FOR EACH ROW EXECUTE FUNCTION update_listing_status();

-- Handle dual deal confirmation
CREATE OR REPLACE FUNCTION handle_deal_confirmation()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.buyer_confirmed_deal = TRUE AND NEW.seller_confirmed_deal = TRUE THEN
    UPDATE enquiries SET status = 'completed', updated_at = NOW() WHERE id = NEW.id;
    UPDATE listings SET status = 'sold', updated_at = NOW() WHERE id = NEW.listing_id;
    UPDATE enquiries SET status = 'declined', updated_at = NOW() WHERE listing_id = NEW.listing_id AND id != NEW.id;
    INSERT INTO notifications (user_id, title, message, type, link)
    SELECT buyer_id, 'Property no longer available',
      'A property you enquired about has been sold.', 'status_change', '/listings/' || NEW.listing_id
    FROM enquiries WHERE listing_id = NEW.listing_id AND id != NEW.id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_deal_confirmed
  AFTER UPDATE ON enquiries
  FOR EACH ROW
  WHEN (NEW.buyer_confirmed_deal IS DISTINCT FROM OLD.buyer_confirmed_deal
     OR NEW.seller_confirmed_deal IS DISTINCT FROM OLD.seller_confirmed_deal)
  EXECUTE FUNCTION handle_deal_confirmation();

-- Auto-update broker rating
CREATE OR REPLACE FUNCTION update_broker_rating()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE broker_profiles SET
    avg_rating = (SELECT COALESCE(AVG(rating),0) FROM reviews WHERE broker_id = NEW.broker_id),
    total_reviews = (SELECT COUNT(*) FROM reviews WHERE broker_id = NEW.broker_id)
  WHERE user_id = NEW.broker_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_review_added
  AFTER INSERT OR UPDATE ON reviews
  FOR EACH ROW EXECUTE FUNCTION update_broker_rating();

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE broker_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE listings ENABLE ROW LEVEL SECURITY;
ALTER TABLE enquiries ENABLE ROW LEVEL SECURITY;
ALTER TABLE reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE saved_listings ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

-- Profiles
CREATE POLICY "profiles_select_all" ON profiles FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "profiles_insert_own" ON profiles FOR INSERT TO authenticated WITH CHECK (auth.uid() = id);
CREATE POLICY "profiles_update_own" ON profiles FOR UPDATE TO authenticated USING (auth.uid() = id);

-- Broker profiles
CREATE POLICY "broker_profiles_select" ON broker_profiles FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "broker_profiles_manage" ON broker_profiles FOR ALL TO authenticated USING (auth.uid() = user_id);

-- Listings — anon and authenticated can see active listings
CREATE POLICY "listings_select_active" ON listings FOR SELECT TO anon, authenticated USING (
  status IN ('active','enquiring','negotiating','sold') OR auth.uid() = owner_id OR
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
);
CREATE POLICY "listings_insert" ON listings FOR INSERT TO authenticated WITH CHECK (auth.uid() = owner_id);
CREATE POLICY "listings_update_owner" ON listings FOR UPDATE TO authenticated USING (
  auth.uid() = owner_id OR
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
);
CREATE POLICY "listings_delete_owner" ON listings FOR DELETE TO authenticated USING (auth.uid() = owner_id);

-- Enquiries
CREATE POLICY "enquiries_select" ON enquiries FOR SELECT TO authenticated
  USING (auth.uid() = buyer_id OR auth.uid() = seller_id OR
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));
CREATE POLICY "enquiries_insert" ON enquiries FOR INSERT TO authenticated WITH CHECK (auth.uid() = buyer_id);
CREATE POLICY "enquiries_update" ON enquiries FOR UPDATE TO authenticated
  USING (auth.uid() = buyer_id OR auth.uid() = seller_id);

-- Reviews
CREATE POLICY "reviews_select" ON reviews FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "reviews_insert" ON reviews FOR INSERT TO authenticated WITH CHECK (auth.uid() = reviewer_id);

-- Saved listings
CREATE POLICY "saved_select" ON saved_listings FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "saved_manage" ON saved_listings FOR ALL TO authenticated USING (auth.uid() = user_id);

-- Notifications
CREATE POLICY "notif_select" ON notifications FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "notif_update" ON notifications FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "notif_insert" ON notifications FOR INSERT TO authenticated WITH CHECK (true);

-- ============================================================
-- MESSAGES (chat between buyer and seller on an enquiry)
-- ============================================================
CREATE TABLE messages (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  enquiry_id  UUID NOT NULL REFERENCES enquiries(id) ON DELETE CASCADE,
  sender_id   UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  content     TEXT NOT NULL,
  is_read     BOOLEAN NOT NULL DEFAULT false,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE messages ENABLE ROW LEVEL SECURITY;

-- Only the buyer or seller of the linked enquiry can read messages
CREATE POLICY "messages_select" ON messages FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM enquiries e
      WHERE e.id = messages.enquiry_id
        AND (e.buyer_id = auth.uid() OR e.seller_id = auth.uid())
    )
  );

-- Only the buyer or seller of the linked enquiry can insert messages
CREATE POLICY "messages_insert" ON messages FOR INSERT TO authenticated
  WITH CHECK (
    auth.uid() = sender_id AND
    EXISTS (
      SELECT 1 FROM enquiries e
      WHERE e.id = enquiry_id
        AND (e.buyer_id = auth.uid() OR e.seller_id = auth.uid())
    )
  );

-- Sender can update their own messages (e.g. mark read)
CREATE POLICY "messages_update" ON messages FOR UPDATE TO authenticated
  USING (auth.uid() = sender_id);

-- ============================================================
-- REALTIME
-- ============================================================
ALTER PUBLICATION supabase_realtime ADD TABLE listings;
ALTER PUBLICATION supabase_realtime ADD TABLE enquiries;
ALTER PUBLICATION supabase_realtime ADD TABLE notifications;
ALTER PUBLICATION supabase_realtime ADD TABLE messages;

-- ============================================================
-- DUMMY DATA — auto-inserts after schema is ready
-- Creates a system seller account and 6 sample listings
-- ============================================================

-- Insert a dummy seller profile directly (no auth needed for seed)
INSERT INTO profiles (id, full_name, role, is_verified, phone)
VALUES (
  '00000000-0000-0000-0000-000000000001',
  'Zero Broker Demo',
  'seller',
  true,
  '+975 17000000'
) ON CONFLICT (id) DO NOTHING;

-- Insert 6 dummy listings
INSERT INTO listings (owner_id, title, description, price, property_type, status, dzongkhag, gewog, location_name, latitude, longitude, bedrooms, bathrooms, area_sqft, is_featured, images, amenities)
VALUES
(
  '00000000-0000-0000-0000-000000000001',
  '3 Bedroom House in Thimphu',
  'A well-maintained 3 bedroom house located in the heart of Thimphu. Close to schools, markets, and government offices. Features a garden and ample parking space. Recently renovated with modern finishes.',
  8500000, 'house', 'active', 'Thimphu', 'Motithang', 'Chubachu',
  27.4728, 89.6390, 3, 2, 1800, true,
  ARRAY['https://images.unsplash.com/photo-1568605114967-8130f3a36994?w=800'],
  ARRAY['Parking','Garden','Water Supply','Solar Power']
),
(
  '00000000-0000-0000-0000-000000000001',
  'Land Plot in Paro Valley',
  'Prime land plot located in the scenic Paro valley with breathtaking mountain views. Suitable for residential construction. All utilities available nearby. Clear thram documentation available.',
  12000000, 'land', 'active', 'Paro', 'Paro Town', 'Paro Town',
  27.4289, 89.4169, null, null, 8000, true,
  ARRAY['https://images.unsplash.com/photo-1500382017468-9049fed747ef?w=800'],
  ARRAY['Road Access','Water Connection','Electricity']
),
(
  '00000000-0000-0000-0000-000000000001',
  '2 Bedroom Apartment in Phuntsholing',
  'Modern 2 bedroom apartment in a prime commercial area of Phuntsholing. Walking distance to the border gate and main market. Ideal for working professionals.',
  4200000, 'apartment', 'active', 'Chhukha', 'Phuntsholing', 'Phuntsholing',
  26.8516, 89.3882, 2, 1, 950, false,
  ARRAY['https://images.unsplash.com/photo-1522708323590-d24dbb6b0267?w=800'],
  ARRAY['Security','Lift','Parking','Water Supply']
),
(
  '00000000-0000-0000-0000-000000000001',
  'Commercial Space in Gelephu',
  'Ground floor commercial space suitable for retail or office use. High footfall area near the main bus terminal. Ready to occupy immediately.',
  6500000, 'commercial', 'active', 'Sarpang', 'Gelephu', 'Gelephu Town',
  26.8667, 90.4833, null, null, 1200, false,
  ARRAY['https://images.unsplash.com/photo-1497366216548-37526070297c?w=800'],
  ARRAY['Parking','Security','Power Backup']
),
(
  '00000000-0000-0000-0000-000000000001',
  '4 Bedroom Villa in Punakha',
  'Spacious villa with breathtaking views of the Punakha valley and dzong. Set on a large plot with mature garden. Perfect for a family home or boutique guesthouse.',
  18000000, 'house', 'active', 'Punakha', 'Punakha', 'Punakha Town',
  27.5917, 89.8697, 4, 3, 3200, true,
  ARRAY['https://images.unsplash.com/photo-1512917774080-9991f1c4c750?w=800'],
  ARRAY['Garden','Parking','Solar Power','Water Supply','Mountain View']
),
(
  '00000000-0000-0000-0000-000000000001',
  'Studio Apartment near CST Phuntsholing',
  'Compact and affordable studio apartment close to the College of Science and Technology. Ideal for students or young professionals. Fully furnished option available.',
  1800000, 'apartment', 'active', 'Chhukha', 'Rinchending', 'Rinchending',
  26.8761, 89.3944, 1, 1, 450, false,
  ARRAY['https://images.unsplash.com/photo-1493809842364-78817add7ffb?w=800'],
  ARRAY['Water Supply','Electricity','Internet Ready']
);

-- ============================================================
-- LIFECYCLE MIGRATION
-- Run this section in Supabase SQL Editor after the initial schema.
-- Safe to re-run (uses IF NOT EXISTS / IF EXISTS guards).
-- ============================================================

-- 1. Add CID verification columns to profiles
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS cid_url TEXT,
  ADD COLUMN IF NOT EXISTS cid_back_url TEXT,
  ADD COLUMN IF NOT EXISTS cid_status TEXT NOT NULL DEFAULT 'unverified'
    CHECK (cid_status IN ('unverified', 'pending', 'verified', 'rejected'));

-- 2. Add lifecycle columns to listings
ALTER TABLE listings
  ADD COLUMN IF NOT EXISTS rejection_reason TEXT,
  ADD COLUMN IF NOT EXISTS rejected_by UUID REFERENCES profiles(id),
  ADD COLUMN IF NOT EXISTS rejected_at TIMESTAMPTZ;

-- 2. Expand the status check constraint to include all lifecycle states
ALTER TABLE listings DROP CONSTRAINT IF EXISTS listings_status_check;
ALTER TABLE listings ADD CONSTRAINT listings_status_check
  CHECK (status IN (
    'draft',          -- created, not submitted
    'pending',        -- submitted for admin review
    'approved',       -- admin approved → publicly visible (PUBLISHED)
    'active',         -- legacy alias for approved
    'rejected',       -- admin rejected → seller must fix & resubmit
    'archived',       -- taken off market by seller (not sold)
    'enquiring',      -- approved + has pending buyer enquiries
    'negotiating',    -- approved + enquiry accepted, in negotiation
    'sold',           -- deal confirmed by both parties
    'paused'          -- temporarily hidden (legacy)
  ));

-- 3. Update the RLS select policy so public can see all "live" states
DROP POLICY IF EXISTS "listings_select_active" ON listings;
DROP POLICY IF EXISTS "listings_select_public" ON listings;
CREATE POLICY "listings_select_public" ON listings FOR SELECT TO anon, authenticated USING (
  status IN ('approved', 'active', 'enquiring', 'negotiating', 'sold')
  OR auth.uid() = owner_id
  OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
);

-- 4. Fix the enquiry trigger: only auto-update status for listings
--    that are in an active/live state; leave all other states untouched.
CREATE OR REPLACE FUNCTION update_listing_status()
RETURNS TRIGGER AS $$
DECLARE
  lid UUID;
  accepted_count INTEGER;
  pending_count INTEGER;
BEGIN
  lid := COALESCE(NEW.listing_id, OLD.listing_id);

  -- Only apply enquiry-driven status changes to live listings
  IF NOT EXISTS (
    SELECT 1 FROM listings WHERE id = lid AND status IN ('approved','active','enquiring','negotiating')
  ) THEN
    RETURN NEW;
  END IF;

  SELECT COUNT(*) INTO accepted_count
    FROM enquiries WHERE listing_id = lid AND status IN ('accepted','negotiating');
  SELECT COUNT(*) INTO pending_count
    FROM enquiries WHERE listing_id = lid AND status = 'pending';

  IF accepted_count > 0 THEN
    UPDATE listings SET status = 'negotiating', updated_at = NOW()
      WHERE id = lid AND status IN ('approved','active','enquiring');
  ELSIF pending_count > 0 THEN
    UPDATE listings SET status = 'enquiring', updated_at = NOW()
      WHERE id = lid AND status IN ('approved','active');
  ELSE
    -- All enquiries resolved → revert to plain approved
    UPDATE listings SET status = 'approved', updated_at = NOW()
      WHERE id = lid AND status IN ('enquiring','negotiating');
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 5. Notifications type: add 'message' if not already present
--    (Supabase CHECK constraints on TEXT columns require ALTER to drop/re-add)
ALTER TABLE notifications DROP CONSTRAINT IF EXISTS notifications_type_check;
ALTER TABLE notifications ADD CONSTRAINT notifications_type_check
  CHECK (type IN ('enquiry','status_change','deal','review','admin','system','message'));

-- ============================================================
-- STORAGE BUCKET POLICIES
-- Run this section in Supabase SQL Editor if uploads return 400.
-- Supabase storage uses RLS on storage.objects — buckets need
-- explicit INSERT/SELECT/DELETE policies or all uploads are blocked.
-- ============================================================

-- listing-images (public bucket — anyone can view, authenticated can upload)
INSERT INTO storage.buckets (id, name, public, file_size_limit)
VALUES ('listing-images', 'listing-images', true, 10485760)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "listing_images_insert" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'listing-images');

CREATE POLICY "listing_images_select" ON storage.objects
  FOR SELECT TO anon, authenticated
  USING (bucket_id = 'listing-images');

-- listing-documents (private bucket — owner and admins only)
INSERT INTO storage.buckets (id, name, public, file_size_limit)
VALUES ('listing-documents', 'listing-documents', false, 10485760)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "listing_docs_insert" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'listing-documents');

CREATE POLICY "listing_docs_select" ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'listing-documents'
    AND (
      EXISTS (
        SELECT 1 FROM public.listings
        WHERE id::text = (storage.foldername(name))[1]
        AND owner_id = auth.uid()
      )
      OR EXISTS (
        SELECT 1 FROM public.profiles
        WHERE id = auth.uid() AND role = 'admin'
      )
    )
  );

CREATE POLICY "listing_docs_delete" ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'listing-documents'
    AND EXISTS (
      SELECT 1 FROM public.listings
      WHERE id::text = (storage.foldername(name))[1]
      AND owner_id = auth.uid()
    )
  );

-- cid-documents (private bucket — owner and admins only)
INSERT INTO storage.buckets (id, name, public, file_size_limit)
VALUES ('cid-documents', 'cid-documents', false, 10485760)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "cid_docs_insert" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'cid-documents'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

CREATE POLICY "cid_docs_select" ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'cid-documents'
    AND (
      (storage.foldername(name))[1] = auth.uid()::text
      OR EXISTS (
        SELECT 1 FROM public.profiles
        WHERE id = auth.uid() AND role = 'admin'
      )
    )
  );
