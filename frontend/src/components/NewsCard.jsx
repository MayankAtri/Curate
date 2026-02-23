import { useState, useMemo } from 'react';
import { interactionService } from '../services/api';

/**
 * Get placeholder image URL based on category/topics
 * Uses Picsum for reliable, fast placeholder images
 */
function getPlaceholderImage(article) {
  // Generate a consistent seed from article title for consistent images
  const seed = article.title ? article.title.slice(0, 20).replace(/\s/g, '') : 'news';

  // Use Picsum for reliable placeholder images (800x600)
  return `https://picsum.photos/seed/${encodeURIComponent(seed)}/800/600`;
}

/**
 * Format relative time
 */
function formatRelativeTime(dateString) {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now - date;
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;

  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

/**
 * NewsCard Component
 * Modern Bento-style card
 */
function NewsCard({ article, relevance, onClick, variant = 'standard', className = '' }) {
  const [imageError, setImageError] = useState(false);
  const [placeholderError, setPlaceholderError] = useState(false);
  const [reaction, setReaction] = useState(null);
  const [isBookmarked, setIsBookmarked] = useState(false);

  const {
    _id,
    title,
    imageUrl,
    source,
    publishedAt,
    summary,
  } = article;

  const handleImageError = () => {
    if (!imageError) {
      // Original image failed, will try placeholder
      setImageError(true);
    } else {
      // Placeholder also failed
      setPlaceholderError(true);
    }
  };

  // Interaction handlers
  const handleLike = (e) => {
    e.stopPropagation();
    const newReaction = reaction === 'like' ? null : 'like';
    setReaction(newReaction);
    if (newReaction === 'like') interactionService.like(_id).catch(console.error);
  };

  const handleBookmark = (e) => {
    e.stopPropagation();
    setIsBookmarked(!isBookmarked);
    if (!isBookmarked) interactionService.bookmark(_id).catch(console.error);
  };

  const handleCardClick = () => {
    // Track the click interaction
    interactionService.trackClick(_id).catch(console.error);
    // Call parent handler
    onClick(article);
  };

  const summaryText = summary?.text || article.description || '';
  const sourceName = source?.name || 'Unknown Source';
  const scorePercent = relevance?.score ? Math.round(relevance.score * 100) : null;

  // Get image URL - use placeholder if no image available
  const displayImageUrl = useMemo(() => {
    if (imageUrl && !imageError) return imageUrl;
    return getPlaceholderImage(article);
  }, [imageUrl, imageError, article]);

  // Variant Classes
  const variantClass = `card-variant-${variant}`;

  return (
    <article
      className={`news-card ${variantClass} ${className}`}
      onClick={handleCardClick}
    >
      <div className="card-background">
        {!placeholderError ? (
          <img
            src={displayImageUrl}
            alt={title}
            loading="lazy"
            onError={handleImageError}
          />
        ) : (
          <div className="card-placeholder-gradient" />
        )}
        <div className="card-gradient-overlay" />
      </div>

      <div className="card-content-overlay">
        <div className="card-header">
          {scorePercent !== null && (
            <span className="match-pill">{scorePercent}% match</span>
          )}
          <div className="card-actions-mini">
            <button
              onClick={handleLike}
              className={reaction === 'like' ? 'active' : ''}
              aria-label="Like article"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill={reaction === 'like' ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2"><path d="M14 9V5a3 3 0 0 0-3-3l-4 9v11h11.28a2 2 0 0 0 2-1.7l1.38-9a2 2 0 0 0-2-2.3zM7 22H4a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2h3" /></svg>
            </button>
            <button
              onClick={handleBookmark}
              className={isBookmarked ? 'active' : ''}
              aria-label="Bookmark article"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill={isBookmarked ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2"><path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" /></svg>
            </button>
          </div>
        </div>

        <div className="card-info">
          <div className="card-meta">
            <span className="source">{sourceName}</span>
            <span className="dot">•</span>
            <span className="time">{formatRelativeTime(publishedAt)}</span>
          </div>
          <h3 className="title">{title}</h3>

          {(variant === 'hero' || variant === 'featured') && (
            <p className="summary">{summaryText}</p>
          )}
        </div>
      </div>
    </article>
  );
}

export default NewsCard;
