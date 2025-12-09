-- Migration: 003_seed_rss_feeds.sql
-- Description: Seed RSS feeds for the crawler worker
-- Created: 2024-12-09
-- Sources: https://rss.feedspot.com, https://rss.com/blog/popular-rss-feeds/

-- ============================================================================
-- Seed RSS feeds by category
-- Categories: politics, product_launch, finance, sports, entertainment, technology, misc
-- ============================================================================

-- ===== TECHNOLOGY =====
INSERT INTO rss_feeds (name, url, category_hint, active) VALUES
  ('TechCrunch', 'https://techcrunch.com/feed/', 'technology', true),
  ('The Verge', 'https://www.theverge.com/rss/index.xml', 'technology', true),
  ('Ars Technica', 'https://feeds.arstechnica.com/arstechnica/index', 'technology', true),
  ('Wired', 'https://www.wired.com/feed/rss', 'technology', true),
  ('MIT Technology Review', 'https://www.technologyreview.com/feed/', 'technology', true),
  ('Engadget', 'https://www.engadget.com/rss.xml', 'technology', true)
ON CONFLICT (url) DO NOTHING;

-- ===== FINANCE =====
INSERT INTO rss_feeds (name, url, category_hint, active) VALUES
  ('CNBC Top News', 'https://search.cnbc.com/rs/search/combinedcms/view.xml?partnerId=wrss01&id=100003114', 'finance', true),
  ('CNBC Markets', 'https://search.cnbc.com/rs/search/combinedcms/view.xml?partnerId=wrss01&id=20910258', 'finance', true),
  ('Yahoo Finance', 'https://finance.yahoo.com/news/rssindex', 'finance', true),
  ('MarketWatch Top Stories', 'https://feeds.marketwatch.com/marketwatch/topstories/', 'finance', true),
  ('Investopedia', 'https://www.investopedia.com/feedbuilder/feed/getfeed?feedName=rss_headline', 'finance', true)
ON CONFLICT (url) DO NOTHING;

-- ===== POLITICS =====
INSERT INTO rss_feeds (name, url, category_hint, active) VALUES
  ('Politico', 'https://www.politico.com/rss/politicopicks.xml', 'politics', true),
  ('The Hill', 'https://thehill.com/feed/', 'politics', true),
  ('NPR Politics', 'https://feeds.npr.org/1014/rss.xml', 'politics', true),
  ('AP Politics', 'https://rsshub.app/apnews/topics/politics', 'politics', true),
  ('Reuters Politics', 'https://www.reutersagency.com/feed/?best-topics=political-general&post_type=best', 'politics', true)
ON CONFLICT (url) DO NOTHING;

-- ===== SPORTS =====
INSERT INTO rss_feeds (name, url, category_hint, active) VALUES
  ('ESPN Top Headlines', 'https://www.espn.com/espn/rss/news', 'sports', true),
  ('ESPN NFL', 'https://www.espn.com/espn/rss/nfl/news', 'sports', true),
  ('ESPN NBA', 'https://www.espn.com/espn/rss/nba/news', 'sports', true),
  ('BBC Sport', 'https://feeds.bbci.co.uk/sport/rss.xml', 'sports', true),
  ('Yahoo Sports', 'https://sports.yahoo.com/rss/', 'sports', true),
  ('Bleacher Report', 'https://bleacherreport.com/articles/feed', 'sports', true)
ON CONFLICT (url) DO NOTHING;

-- ===== ENTERTAINMENT =====
INSERT INTO rss_feeds (name, url, category_hint, active) VALUES
  ('Variety', 'https://variety.com/feed/', 'entertainment', true),
  ('Hollywood Reporter', 'https://www.hollywoodreporter.com/feed/', 'entertainment', true),
  ('Entertainment Weekly', 'https://ew.com/feed/', 'entertainment', true),
  ('Deadline', 'https://deadline.com/feed/', 'entertainment', true),
  ('Billboard', 'https://www.billboard.com/feed/', 'entertainment', true)
ON CONFLICT (url) DO NOTHING;

-- ===== GENERAL NEWS (misc) =====
INSERT INTO rss_feeds (name, url, category_hint, active) VALUES
  ('Reuters Top News', 'https://www.reutersagency.com/feed/?taxonomy=best-topics&post_type=best', 'misc', true),
  ('AP Top News', 'https://rsshub.app/apnews/topics/apf-topnews', 'misc', true),
  ('BBC News World', 'https://feeds.bbci.co.uk/news/world/rss.xml', 'misc', true),
  ('NPR News', 'https://feeds.npr.org/1001/rss.xml', 'misc', true),
  ('New York Times', 'https://rss.nytimes.com/services/xml/rss/nyt/HomePage.xml', 'misc', true)
ON CONFLICT (url) DO NOTHING;

-- ===== PRODUCT LAUNCH (tech product focused) =====
INSERT INTO rss_feeds (name, url, category_hint, active) VALUES
  ('Product Hunt', 'https://www.producthunt.com/feed', 'product_launch', true),
  ('MacRumors', 'https://feeds.macrumors.com/MacRumors-All', 'product_launch', true),
  ('9to5Mac', 'https://9to5mac.com/feed/', 'product_launch', true),
  ('Android Authority', 'https://www.androidauthority.com/feed/', 'product_launch', true),
  ('The Next Web', 'https://thenextweb.com/feed/', 'product_launch', true)
ON CONFLICT (url) DO NOTHING;

-- ===== CRYPTO / BLOCKCHAIN (finance subcategory) =====
INSERT INTO rss_feeds (name, url, category_hint, active) VALUES
  ('CoinDesk', 'https://www.coindesk.com/arc/outboundfeeds/rss/', 'finance', true),
  ('Cointelegraph', 'https://cointelegraph.com/rss', 'finance', true),
  ('Decrypt', 'https://decrypt.co/feed', 'finance', true),
  ('The Block', 'https://www.theblock.co/rss.xml', 'finance', true)
ON CONFLICT (url) DO NOTHING;
